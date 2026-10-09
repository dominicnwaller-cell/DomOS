import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ProfileStorage} from '../src/data/storage.js';
import {ApplicationServices} from '../src/application/services.js';
import {FINANCE_KEY,balance,protection,occurrences,getOccurrence,validateFinance} from '../src/application/finance.js';
import {notificationData,reminderCandidates} from '../src/application/notifications.js';

let passed=0;
async function test(name,run){await run();console.log('PASS '+name);passed++;}
async function fixture(data={},shared){
 const profile={id:shared?.id||randomUUID(),revision:shared?.revision||0,preferences:{currency:'GBP',timeZone:'Europe/London'}};
 const saved=shared||{id:profile.id,revision:0,data:Object.fromEntries(Object.entries(data).map(([k,v])=>['lifeos4.'+k,JSON.stringify(v)])),fail:false};
 const storage=new ProfileStorage({profile,data:structuredClone(saved.data)},async(id,rev,changes)=>{
  await Promise.resolve();
  if(saved.fail)throw Error('Injected persistence failure');
  if(rev!==saved.revision)throw Error('Profile changed in another window');
  if(changes[FINANCE_KEY]&&saved.data[FINANCE_KEY])assert.equal(JSON.parse(changes[FINANCE_KEY]).revision,JSON.parse(saved.data[FINANCE_KEY]).revision+1,'Native financial revision invariant');
  for(const [k,v] of Object.entries(changes))v===null?delete saved.data[k]:saved.data[k]=v;
  return ++saved.revision;
 });
 const f={profile,storage,saved,context:{profileId:profile.id},clock:Date.parse('2026-10-09T12:00:00Z')};
 f.services=new ApplicationServices(storage,{uuid:randomUUID,now:()=>f.clock});
 await f.services.initializeFinance(f.context);return f;
}
const state=f=>f.services.read(f.context,FINANCE_KEY);
async function run(f,request){const out=await f.services.execute(f.context,{operationId:randomUUID(),...request});return out.status==='confirmation-required'?f.services.confirm(f.context,out.token):out;}
async function accounts(f){const a=(await run(f,{action:'finance.account.save',name:'Halifax',amount:'1000'})).result.item.id,b=(await run(f,{action:'finance.account.save',name:'Monzo',amount:'200'})).result.item.id;return [a,b];}
const rule=(a,extra={})=>({action:'finance.rule.save',name:'Bill',accountId:a,amount:'100',kind:'expense',frequency:'once',anchor:'2026-10-09',...extra});

await test('F01 transfers enforce both verified boundaries and conserve permitted cash',async()=>{
 const f=await fixture(),[a,b]=await accounts(f);f.clock=Date.parse('2026-10-12T12:00Z');await run(f,{action:'finance.balance.check',accountId:b,amount:'200'});
 await assert.rejects(()=>run(f,{action:'finance.transfer',accountId:a,toAccountId:b,amount:'100',date:'2026-10-10'}),/predates/);
 await assert.rejects(()=>run(f,{action:'finance.transfer',accountId:b,toAccountId:a,amount:'100',date:'2026-10-10'}),/predates/);
 assert.equal(balance(state(f),b),20000);await run(f,{action:'finance.transfer',accountId:a,toAccountId:b,amount:'100',date:'2026-10-12'});assert.equal(balance(state(f),a)+balance(state(f),b),120000);
 await run(f,{action:'finance.transfer',accountId:b,toAccountId:a,amount:'50'});assert.equal(balance(state(f),b),25000);
});
await test('F02 internal transfers cannot settle bills while eligible history matches once',async()=>{
 const f=await fixture({financeAccounts:[{id:'a',name:'Halifax',type:'Current',balance:1000}],transactions:[{id:'internal',accountId:'a',type:'expense',amount:100,date:'2026-10-01',internalTransfer:true},{id:'real',accountId:'a',type:'expense',amount:100,date:'2026-10-01'}]});await run(f,rule('a'));const o=occurrences(state(f),'2026-10-09','2026-10-09')[0];
 await assert.rejects(()=>run(f,{action:'finance.occurrence.pay',id:o.id,transactionId:'internal'}),/matching/);assert.equal(protection(state(f),'a','2026-10-09').protectedMinor,10000);
 await run(f,{action:'finance.occurrence.pay',id:o.id,transactionId:'real'});assert.equal(protection(state(f),'a','2026-10-09').protectedMinor,0);assert.equal(balance(state(f),'a'),100000);
 await assert.rejects(()=>run(f,{action:'finance.occurrence.pay',id:o.id,transactionId:'real'}));
 const invalid=state(f);invalid.transactions[0].occurrenceId=o.id;assert.throws(()=>validateFinance(invalid,f.profile.id),/Internal transfers/);
});
await test('F03 legacy conversion stays single-use under retries and new submissions',async()=>{
 const f=await fixture({financeBills:[{id:'legacy',name:'Bill',amount:100}]});const [a]=await accounts(f),request={...rule(a),legacyId:'legacy',operationId:randomUUID()};const oldRevision=state(f).revision;await run(f,request);await run(f,request);await assert.rejects(()=>run(f,{...request,operationId:randomUUID(),expectedFinanceRevision:oldRevision}),/form was open/);const original=state(f).legacy.bills[0].ruleId;
 const duplicate=await run(f,{...request,operationId:randomUUID()});assert(duplicate.result.conversionExisting);assert.equal(state(f).rules.length,1);assert.equal(protection(state(f),a,'2026-10-09').protectedMinor,10000);assert.equal(state(f).legacy.bills[0].ruleId,original);
 assert.equal(f.services.plan(f.context,{action:'source.open',kind:'bill',id:'legacy'}).result.source.record.ruleId,original);
});
await test('F04 overlapping and rapid mutations serialize with one native revision each',async()=>{
 const f=await fixture(),[a]=await accounts(f);const second=new ApplicationServices(f.storage,{uuid:randomUUID,now:()=>f.clock});
 const results=await Promise.all(Array.from({length:12},(_,i)=>(i%2?second:f.services).execute(f.context,{action:'finance.transaction.create',accountId:a,amount:'0.10',operationId:randomUUID()})));
 assert(results.every(r=>r.status==='success'));assert.equal(balance(state(f),a),99880);assert.equal(JSON.parse(f.saved.data[FINANCE_KEY]).transactions.length,12);assert.equal(f.storage.failure,null);
});
await test('F04 action and Undo overlap without overwriting newer activity',async()=>{
 const f=await fixture(),[a]=await accounts(f),old=await run(f,{action:'finance.transaction.create',accountId:a,amount:'10'});
 const [write,undo]=await Promise.allSettled([run(f,{action:'finance.transaction.create',accountId:a,amount:'5'}),f.services.undo(f.context,old.undoId)]);assert.equal(write.status,'fulfilled');assert.equal(undo.status,'rejected');assert.equal(balance(state(f),a),98500);
 const latest=write.value;await f.services.undo(f.context,latest.undoId);assert.equal(balance(state(f),a),99000);
 const g=await fixture(),[ga]=await accounts(g),expense=await run(g,{action:'finance.transaction.create',accountId:ga,amount:'10'});await Promise.all([g.services.undo(g.context,expense.undoId),run(g,{action:'finance.transaction.create',accountId:ga,amount:'5'})]);assert.equal(balance(state(g),ga),99500);
});
await test('F04 human confirmation releases coordination and rejects changed state',async()=>{
 const f=await fixture(),[a,b]=await accounts(f),pending=await f.services.execute(f.context,{action:'finance.transfer',accountId:a,toAccountId:b,amount:'100'});
 await run(f,{action:'finance.transaction.create',accountId:a,amount:'1'});await assert.rejects(()=>f.services.confirm(f.context,pending.token),/changed/);assert.equal(balance(state(f),b),20000);
 assert.throws(()=>f.services.performUI(f.context,{action:'finance.transaction.create',accountId:a,amount:'1'}),/coordinated/);
 assert.throws(()=>f.services.applyUIChanges(f.context,{[FINANCE_KEY]:JSON.stringify(state(f))},true),/approved/);
});
await test('F04 failed persistence restores visible Finance and retains marked unsaved recovery',async()=>{
 const f=await fixture(),[a]=await accounts(f),before=f.saved.data[FINANCE_KEY];f.saved.fail=true;
 await assert.rejects(()=>run(f,{action:'finance.transaction.create',accountId:a,amount:'5'}),/persistence failure/);
 assert.equal(f.storage.getItem(FINANCE_KEY),before);assert.equal(f.saved.data[FINANCE_KEY],before);assert.equal(JSON.parse(f.storage.recovery().data[FINANCE_KEY]).transactions.length,1);assert(f.storage.failure);
 f.saved.fail=false;const reopened=await fixture({},f.saved);assert.equal(balance(state(reopened),a),100000);await run(reopened,{action:'finance.transaction.create',accountId:a,amount:'5'});assert.equal(balance(state(reopened),a),99500);
});
await test('F04 conflicting windows fail clearly and keep only committed money visible',async()=>{
 const f=await fixture(),[a]=await accounts(f),other=await fixture({},f.saved);await run(f,{action:'finance.transaction.create',accountId:a,amount:'1'});
 await assert.rejects(()=>run(other,{action:'finance.transaction.create',accountId:a,amount:'2'}),/another window/);assert.equal(JSON.parse(f.saved.data[FINANCE_KEY]).transactions.length,1);assert.equal(JSON.parse(other.storage.getItem(FINANCE_KEY)).transactions.length,0);
 const reopened=await fixture({},f.saved);assert.equal(balance(state(reopened),a),99900);
});
await test('F05 activation rejects overlapping and reversed essentials periods',async()=>{
 const f=await fixture(),[a]=await accounts(f);await run(f,{action:'finance.allocation.save',name:'Food',accountId:a,kind:'essentials',category:'Food',amount:'100',startDate:'2026-10-09',endDate:'2026-10-15'});
 await assert.rejects(()=>run(f,{action:'finance.allocation.save',name:'Food again',accountId:a,kind:'essentials',category:'Food',amount:'20',startDate:'2026-10-15',endDate:'2026-10-20'}),/overlap/);
 await run(f,{action:'finance.allocation.save',name:'Later',accountId:a,kind:'essentials',category:'Food',amount:'20',startDate:'2026-10-16',endDate:'2026-10-20'});validateFinance(state(f),f.profile.id);
 await assert.rejects(()=>run(f,{action:'finance.allocation.save',name:'Invalid',accountId:a,kind:'essentials',amount:'20',startDate:'2026-10-20',endDate:'2026-10-10'}),/period/);const reopened=await fixture({},f.saved);validateFinance(state(reopened),reopened.profile.id);assert.equal(state(reopened).allocations.length,2);
});
await test('F05 malformed optional restored fields fail activation validation',async()=>{const f=await fixture(),[a]=await accounts(f);await run(f,{action:'finance.transaction.create',accountId:a,amount:'1'});const invalid=state(f);invalid.transactions[0].description=null;assert.throws(()=>validateFinance(invalid,f.profile.id),/details/);invalid.transactions[0].description='Valid';invalid.transactions[0].voided=null;assert.throws(()=>validateFinance(invalid,f.profile.id),/lifecycle/);});
await test('F06 reserve metadata and total-amount edits preserve settlement baseline',async()=>{
 const f=await fixture(),[a]=await accounts(f),r=await run(f,rule(a)),allocation=await run(f,{action:'finance.allocation.save',name:'Cover',accountId:a,ruleId:r.result.item.id,kind:'bill',amount:'100'}),o=occurrences(state(f),'2026-10-09','2026-10-09')[0];await run(f,{action:'finance.occurrence.pay',id:o.id,amount:'40'});
 const edit={action:'finance.allocation.save',id:allocation.result.item.id,name:'Renamed',accountId:a,ruleId:r.result.item.id,kind:'bill',amount:'100'};await run(f,edit);assert.equal(protection(state(f),a,'2026-10-09').protectedMinor,6000);
 await run(f,{...edit,amount:'120'});assert.equal(protection(state(f),a,'2026-10-09').protectedMinor,8000);await run(f,{action:'finance.occurrence.pay',id:o.id,amount:'60'});assert.equal(protection(state(f),a,'2026-10-09').protectedMinor,2000);assert.equal(balance(state(f),a),90000);await run(f,{...edit,amount:'90'});assert.equal(protection(state(f),a,'2026-10-09').protectedMinor,0);assert.equal(balance(state(f),a),90000);
});
await test('F07 effective-dated changes preserve multi-year amounts and explicit overrides',async()=>{
 const f=await fixture(),[a]=await accounts(f),request=rule(a,{anchor:'2024-10-01',frequency:'monthly'}),r=await run(f,request),id=r.result.item.id;
 await run(f,{action:'finance.occurrence.update',id:id+':2024-11-01',amount:'80',date:'2026-10-09'});await run(f,{action:'finance.occurrence.pay',id:id+':2024-11-01',amount:'40'});
 await run(f,{...request,id,amount:'50',effectiveDate:'2026-10-09'});let s=state(f);assert.equal(getOccurrence(s,id+':2024-10-01').amountMinor,10000);assert.equal(getOccurrence(s,id+':2026-10-01').amountMinor,10000);assert.equal(getOccurrence(s,id+':2026-11-01').amountMinor,5000);assert.equal(getOccurrence(s,id+':2024-11-01').outstandingMinor,4000);assert.equal(s.occurrences.length,1);
 f.clock=Date.parse('2027-01-10T12:00Z');await run(f,{...request,id,amount:'70',effectiveDate:'2027-02-01'});s=state(f);assert.equal(getOccurrence(s,id+':2027-01-01').amountMinor,5000);assert.equal(getOccurrence(s,id+':2027-02-01').amountMinor,7000);assert.equal(getOccurrence(s,id+':2024-10-01').amountMinor,10000);
});
await test('F07 same-day terms and legacy rules retain their prior deterministic baseline',async()=>{
 const f=await fixture(),[a]=await accounts(f),request=rule(a,{frequency:'monthly'}),r=await run(f,request);await run(f,{...request,id:r.result.item.id,amount:'50',effectiveDate:'2026-10-09'});assert.equal(getOccurrence(state(f),r.result.item.id+':2026-10-09').amountMinor,5000);
 await assert.rejects(()=>run(f,{...request,id:r.result.item.id,amount:'20',effectiveDate:'2026-10-08'}),/prospectively/);
});
await test('F08 resolved previews identify transfers, reconciliation, payment and reversal effects',async()=>{
 const f=await fixture(),[a,b]=await accounts(f);const p=await f.services.execute(f.context,{action:'finance.transfer',accountId:a,toAccountId:b,amount:'100'});const text=p.preview.details.lines.join('\n');assert(text.includes('Halifax'));assert(text.includes('Monzo'));assert(text.includes('£100.00'));f.services.cancel(f.context,p.token);
 const c=await run(f,{action:'finance.balance.check',accountId:a,amount:'950'}),reconcile=await f.services.execute(f.context,{action:'finance.balance.reconcile',id:c.result.check.id});const rt=reconcile.preview.details.lines.join('\n');for(const x of ['Halifax','£950.00','£1,000.00','-£50.00'])assert(rt.includes(x));await f.services.confirm(f.context,reconcile.token);
 await run(f,rule(a));const o=occurrences(state(f),'2026-10-09','2026-10-09')[0],payment=await f.services.execute(f.context,{action:'finance.occurrence.pay',id:o.id,amount:'40'});assert(payment.preview.details.lines.join('\n').includes('Bill / income: Bill'));const paid=await f.services.confirm(f.context,payment.token),reverse=await f.services.execute(f.context,{action:'finance.transaction.reverse',id:paid.result.item.id});assert(reverse.preview.details.lines.join('\n').includes('change £40.00'));f.services.cancel(f.context,reverse.token);
});
await test('F08 midnight changes require renewed confirmation instead of stale posting dates',async()=>{
 const f=await fixture(),[a,b]=await accounts(f);f.clock=Date.parse('2026-10-09T22:59:00Z');const p=await f.services.execute(f.context,{action:'finance.transfer',accountId:a,toAccountId:b,amount:'100'});f.clock+=120000;await assert.rejects(()=>f.services.confirm(f.context,p.token),/financial effect changed/);assert.equal(state(f).transactions.length,0);
});
await test('canonical integrations keep settlement, reminder and profile state consistent',async()=>{
 const f=await fixture(),[a]=await accounts(f);await run(f,rule(a));const o=occurrences(state(f),'2026-10-09','2026-10-09')[0];await run(f,{action:'finance.occurrence.pay',id:o.id,amount:'100'});
 assert.equal(f.services.plan(f.context,{action:'finance.summary'}).result.expenses,100);assert.equal(f.services.plan(f.context,{action:'history.get',date:'2026-10-09'}).result.transactions.length,1);
 assert(!reminderCandidates(notificationData(f.services,f.context),{profileId:f.profile.id,zone:'Europe/London',now:f.clock}).some(x=>x.sourceId===o.id));
 await assert.rejects(()=>f.services.execute({profileId:randomUUID()},{action:'finance.transaction.create',accountId:a,amount:'1'}));
});
console.log(`${passed} Finance remediation checks passed`);
