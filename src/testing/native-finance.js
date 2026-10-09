import {invoke} from '@tauri-apps/api/core';
import {getCurrentWebviewWindow} from '@tauri-apps/api/webviewWindow';
import {LogicalSize} from '@tauri-apps/api/dpi';
import {FINANCE_KEY,balance,occurrences,protection,forecast} from '../application/finance.js';
import {dayInZone,profileZone,shiftDay} from '../application/date-time.js';

// Real WebView/SQLite acceptance, exclusively in the native-verification identity.
export async function verifyNativeFinance({services,context,otherProfile,report,check,until}){
 report.stage='canonical-finance';const otherBefore=(await invoke('profile_snapshot',{profileId:otherProfile})).data[FINANCE_KEY];
 const state=()=>services.read(context,FINANCE_KEY),day=dayInZone(services.now(),profileZone(services.storage.profile.preferences));
 const run=async request=>{const out=await services.execute(context,{operationId:crypto.randomUUID(),...request});return out.status==='confirmation-required'?services.confirm(context,out.token):out;};
 const receiving=state().accounts[0];check(receiving&&balance(state(),receiving.id)===100010,'Assistant Undo failed to restore opening pennies');
 const spending=(await run({action:'finance.account.save',name:'Native spending',amount:'0'})).result.item;
 await run({action:'finance.settings',primaryAccountId:receiving.id,spendingAccountId:spending.id});
 window.eval("showPage('finances')");
 async function submit(mode,fields,id){window.DOMOSFinance.form(mode,id);const f=document.querySelector('#drawerBody form');for(const [key,value] of Object.entries(fields)){check(f.elements.namedItem(key),'Missing Finance field '+key);f.elements.namedItem(key).value=value;}const revision=state().revision;f.requestSubmit();await until(()=>!f.querySelector('[type=submit]').disabled);check(!f.querySelector('[data-error]').textContent,'Finance form error: '+f.querySelector('[data-error]').textContent);const confirm=[...document.querySelectorAll('.dom62-finance-feedback button')].find(b=>b.textContent==='Confirm');if(confirm){confirm.click();await until(()=>state().revision>revision);}check(!document.getElementById('drawer').classList.contains('show'),'Saved Finance form remained open');await services.storage.flush();}
 await submit('expense',{accountId:receiving.id,amount:'15.01',description:'Native pennies expense'});
 check(balance(state(),receiving.id)===98509,'Native expense lost exact pennies');report.passed.push('native canonical Finance expense form and exact pennies');
 await submit('transfer',{accountId:receiving.id,toAccountId:spending.id,amount:'100.05'});
 check(balance(state(),receiving.id)===88504&&balance(state(),spending.id)===10005,'Native transfer did not conserve cash');check(state().transactions.filter(t=>t.type==='transfer').length===1,'Native transfer posted twice');report.passed.push('native Finance transfer preview confirmation and conserved balances');
 const c=(await run({action:'finance.balance.check',accountId:receiving.id,amount:'900'})).result.check;
 check(c.differenceMinor===1496&&balance(state(),receiving.id)===88504,'Balance check silently changed cash');
 const preview=await services.execute(context,{action:'finance.balance.reconcile',id:c.id,operationId:crypto.randomUUID()});check(preview.status==='confirmation-required'&&preview.preview.details.lines.some(l=>l.includes('14.96')),'Reconciliation lost resolved confirmation');await services.confirm(context,preview.token);
 check(balance(state(),receiving.id)===90000,'Explicit native reconciliation wrong');report.passed.push('native Finance balance observation explicit reconciliation and persistence');
 const view=getCurrentWebviewWindow(),originalSize=await view.innerSize(),scale=await view.scaleFactor();
 report.financeLayout={nativeScaleFactor:scale,variants:[]};
 try{
  for(const [width,height,zoom] of [[1100,800,1],[360,640,1],[900,700,1.5]]){
   await view.setSize(new LogicalSize(width,height));await view.setZoom(zoom);await new Promise(r=>setTimeout(r,150));
   for(const mode of ['bill','monthly-income','four-income','allocation','settings','pay']){
    // Payment gets its real occurrence below; the other long forms share containment.
    if(mode==='pay')continue;
    window.DOMOSFinance.form(mode);const f=document.querySelector('.dom62-finance-form'),fields=f.querySelector('.dom62-finance-fields'),footer=f.querySelector('footer'),save=f.querySelector('[type=submit]'),cancel=f.querySelector('[data-finance-cancel]');
    check(document.activeElement===f.querySelector('input,select'),'Finance did not focus its first field');
    for(const control of [save,cancel]){const r=control.getBoundingClientRect();check(r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1,'Finance footer clipped at '+width+'x'+height+' zoom '+zoom);check(control.contains(document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2)),'Finance footer obscured at '+width+'x'+height+' zoom '+zoom);}
    check(fields.getBoundingClientRect().bottom<=footer.getBoundingClientRect().top+1,'Footer overlaps Finance fields');
    fields.scrollTop=fields.scrollHeight;check(fields.scrollHeight<=fields.clientHeight||fields.scrollTop>0,'Tall Finance fields cannot scroll');
    const last=[...fields.querySelectorAll('input,select')].filter(x=>!x.closest('[hidden]')).at(-1);last?.focus();last?.scrollIntoView({block:'nearest'});check(!last||last.getBoundingClientRect().bottom<=footer.getBoundingClientRect().top+1,'Last focused field hidden by footer');
    const before=JSON.stringify(state());cancel.click();check(!document.getElementById('drawer').classList.contains('show')&&JSON.stringify(state())===before,'Cancel persisted a Finance draft');
   }
   report.financeLayout.variants.push({width,height,zoom,pass:true});
  }
 }finally{await view.setZoom(1);await view.setSize(originalSize);}
 report.passed.push('native Finance footer scroll focus and cancellation at minimum size and 150 percent WebView zoom');
 await submit('bill',{name:'Native monthly bill',kind:'expense',accountId:receiving.id,amount:'50.05',anchor:day,frequency:'monthly',reminder:''});
 const bill=state().rules.find(r=>r.name==='Native monthly bill'),o=occurrences(state(),day,day).find(o=>o.ruleId===bill?.id);check(bill&&o&&o.outstandingMinor===5005,'Native Bill Save failed');check(balance(state(),receiving.id)===90000,'Schedule invented a payment');report.passed.push('native Bill Schedule Save creates canonical obligation without posting cash');
 await submit('monthly-income',{name:'Native expected income',accountId:receiving.id,amount:'200.10',anchor:day,day:String(Number(day.slice(-2))),weekend:'none'});
 const income=state().rules.find(r=>r.name==='Native expected income');check(income?.kind==='income'&&income.frequency==='monthly','Income schedule not canonical');check(balance(state(),receiving.id)===90000,'Expected income invented cash');report.passed.push('native monthly Income Schedule Save without fictional receipts');
 await run({action:'finance.allocation.save',name:'Native bill cover',kind:'bill',ruleId:bill.id,accountId:receiving.id,amount:'50.05'});
 check(protection(state(),receiving.id,day).protectedMinor===5005,'Bill and linked reserve counted twice');
 await submit('pay',{accountId:receiving.id,amount:'20.01',transactionId:''},o.id);
 check(balance(state(),receiving.id)===87999&&protection(state(),receiving.id,day).protectedMinor===3004,'Partial bill settlement or reserve release incorrect');report.passed.push('native bill payment confirmation partial settlement and single protected coverage');
 const receipt=occurrences(state(),day,day).find(o=>o.ruleId===income.id);await submit('pay',{accountId:receiving.id,amount:'200.10',transactionId:''},receipt.id);
 check(balance(state(),receiving.id)===108009,'Actual income receipt did not post once');
 const persisted=JSON.stringify(state());const f=forecast(state(),day);check(!f.rows.some(r=>r.ruleId===income.id&&r.date===day),'Settled income remained projected');check(JSON.stringify(state())===persisted,'Forecast changed cash');
 const host=document.createElement('div');window.DOMOSFinance.widget(host);check(host.textContent.includes('1,050.05'),'Dashboard differs from canonical protected cash');report.passed.push('native income receipt forecast and Finance widget agree on canonical cash');
 const backup=await invoke('profile_export',{profileId:context.profileId}),copy=await invoke('profile_import',{name:'Native canonical Finance copy',payload:backup}),snapshot=await invoke('profile_snapshot',{profileId:copy.id}),copied=JSON.parse(snapshot.data[FINANCE_KEY]);
 check(copied.profileId===copy.id&&copied.transactions.length===state().transactions.length&&balance(copied,receiving.id)===108009,'Finance backup lost ledger or ownership');check((await invoke('profile_snapshot',{profileId:otherProfile})).data[FINANCE_KEY]===otherBefore,'Finance escaped profile');report.passed.push('native canonical Finance backup roundtrip UUID rebinding and profile isolation');
 report.financeRestart={profileId:context.profileId,accountId:receiving.id,toAccountId:spending.id,balanceMinor:108009,toBalanceMinor:10005,transactionCount:state().transactions.length};
 window.eval('closeDrawer()');
}
