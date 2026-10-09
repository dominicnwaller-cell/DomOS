import {DomAssistant} from './assistant.js';
import './command-bar.css';
import {installAutocomplete} from './autocomplete.js';

export function installCommandBar(services,profileId){
 const assistant=new DomAssistant(services),context={profileId};let returnFocus=null,busy=false,current=null;
 const dialog=document.createElement('div');dialog.className='dom62-command-backdrop';dialog.hidden=true;
 dialog.innerHTML='<section class="dom62-command" role="dialog" aria-modal="true" aria-labelledby="dom62CommandTitle"><header><h2 id="dom62CommandTitle">Ask DOM.OS</h2><span>Experimental · Local</span><button type="button" data-close aria-label="Close Ask DOM.OS">×</button></header><label for="dom62CommandInput">What would help right now?</label><form><input id="dom62CommandInput" placeholder="Ask DOM.OS…" autocomplete="off" maxlength="512"><button type="submit">Run</button></form><p class="dom62-command-hint">Try “Start work”, “Show today” or “Add £15 petrol”.</p><div data-result role="status" aria-live="polite"></div><div data-actions></div></section>';
 document.body.append(dialog);const input=dialog.querySelector('input'),result=dialog.querySelector('[data-result]'),actions=dialog.querySelector('[data-actions]'),submit=dialog.querySelector('[type=submit]');
 const inputHost=document.createElement('div');inputHost.className='dom62-command-input-host';input.before(inputHost);inputHost.append(input);
 const keyboardHelp=document.createElement('p');keyboardHelp.id='dom62CommandKeyboardHelp';keyboardHelp.className='dom62-command-keyboard-help';keyboardHelp.textContent='↑ ↓ Choose · Tab / → Complete · Enter Run · Esc Dismiss';input.closest('form').after(keyboardHelp);
 const autocomplete=installAutocomplete(input,inputHost,{execute:()=>perform(async()=>show(await assistant.run(context,input.value)))});
 const records=document.createElement('div');records.className='dom62-record-matches';records.setAttribute('aria-label','Matching records');input.closest('form').after(records);let recordMatches=[],recordIndex=0;
 function drawRecords(){records.replaceChildren();recordMatches.forEach((m,i)=>{const b=document.createElement('button');b.type='button';b.className=i===recordIndex?'selected':'';b.textContent=m.title+' · '+m.type+(m.archived?' · Archived':'');b.onclick=()=>perform(async()=>{await services.execute(context,{action:'source.open',kind:m.kind,id:m.id});close()});records.append(b)})}
 input.addEventListener('input',()=>{recordMatches=services.plan(context,{action:'search.get',query:input.value.replace(/^(find|search|open)\s+/i,'').replace(/\s+(appointment|task|habit|tracker)$/i,'')}).result.matches.slice(0,8);recordIndex=0;drawRecords()});
 input.addEventListener('keydown',e=>{if(!recordMatches.length||input.getAttribute('aria-expanded')==='true')return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopImmediatePropagation();recordIndex=(recordIndex+(e.key==='ArrowDown'?1:-1)+recordMatches.length)%recordMatches.length;drawRecords()}else if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();records.children[recordIndex]?.click()}},true);
 function open(){if(dialog.hidden){returnFocus=document.activeElement;dialog.hidden=false}input.focus();autocomplete.update()}
 function close(){if(current?.status==='confirmation-required')services.cancel(context,current.token);current=null;autocomplete.hide();dialog.hidden=true;returnFocus?.focus()}
 function button(label,handler){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>perform(handler);actions.append(b)}
 function message(value){
  if(value?.financeDraft)return 'Opened Finance. Choose the actual amount / account before recording.';
  if(value?.protection)return 'Recorded GBP cash: £'+value.accountBalance.toFixed(2)+' · '+(value.protection.ready?'estimated':'provisional')+' uncommitted cash: £'+(value.protection.remainingMinor/100).toFixed(2)+'.';
  if(value?.reminder)return 'Reminder '+(value.reminder.state.snoozeUntil?'snoozed. The schedule is unchanged.':'dismissed. The commitment remains unfinished.');
  if(value?.attention)return `${value.attention.needs.length} need attention · ${value.attention.upcoming.length} upcoming · ${value.attention.snoozed.length} snoozed`;
  if(value?.commitments)return value.commitments.current.length?value.commitments.current.map(x=>x.title).join(' · '):'Nothing scheduled right now.';
  if(value?.source)return 'Opened '+(value.source.record.title||value.source.record.name||'record')+'.';
  if(value?.matches)return value.matches.length?'Choose the record you meant.':'No matching records in this profile.';
  if(value?.summary)return 'Opened '+(value.summary.period.kind==='weekly'?'Weekly Review':'Daily Summary')+'.';
  if(value?.review)return value.review.status==='COMPLETED'?'Review completed. Facts continue to update.':'Review ready. Reflection is optional.';
  if(value?.milliseconds!==undefined){const mins=Math.floor(value.milliseconds/60000);return `You’ve worked ${Math.floor(mins/60)}h ${mins%60}m today.`}
  if(value?.progress)return (value.progress.percent===null?'Unmeasured':value.progress.percent+'%')+' · '+value.progress.label+' · '+value.progress.source;
  if(value?.time)return 'Today '+Math.floor(value.time.today/60000)+'m · This week '+Math.floor(value.time.week/60000)+'m · Lifetime '+Math.floor(value.time.lifetime/60000)+'m';
  if(value?.focus)return value.focus.length?'Weekly Focus: '+value.focus.map(f=>services.read(context,'lifeos4.'+(f.kind==='goal'?'goals':'objectives'),[]).find(x=>x.id===f.targetId)?.name||'Focus').join(' · '):'No Weekly Focus selected for this week.';
  if(value?.goals)return value.goals.length?value.goals.map(g=>g.name+(g.progressInfo?' · '+g.progressInfo.label:'')).join(' · '):'No Goals yet. Try Add goal.';
  if(value?.habits)return value.habits.length?value.habits.map(s=>s.habit.name+' · '+(s.quota?s.value+' / '+s.target:'scheduled')).join(' · '):'No Habits yet. Try Add habit.';
  if(value?.trackers)return value.trackers.length?value.trackers.map(s=>s.tracker.name+' · '+(s.value??'not logged today')).join(' · '):'No Trackers yet. Try Add tracker.';
  if(value?.habit)return value.habit.name+' · '+(value.quota?value.value+' / '+value.target:'scheduled opportunity');
  if(value?.tracker)return value.tracker.name+' · '+(value.value??'not logged today')+' · '+value.today.length+' entries today';
  if(value?.tasks)return value.tasks.length?`Today: ${value.tasks.map(x=>x.title).join(' · ')}`:'There are no Work Tasks in Today. Open your dashboard for routines and schedule.';
  if(value?.item){const item=value.item;if(item.amount!==undefined)return `${item.type==='income'?'Income':'Expense'} saved: ${new Intl.NumberFormat('en-GB',{style:'currency',currency:item.currency||services.storage.profile.preferences?.currency||'GBP'}).format(item.amount)} · ${item.description}`;return `Saved: ${item.title||item.name||'your item'}`}
  if(value?.timer)return value.timer.running?'Work timer started.':'Work timer saved.';
  if(value?.page)return `Opened ${value.page==='tasks'?'Work Tasks':value.page}.`;
  if(value?.draft)return 'Your new '+(value.kind||'task')+' is open. Add a title and save when ready.';
  if(value?.name)return `Completed: ${value.name}`;
  return 'Done.';
 }
 function show(outcome){if(outcome.result?.matches){recordMatches=outcome.result.matches;recordIndex=0;drawRecords()}current=outcome;autocomplete.hide();actions.replaceChildren();if(outcome.result?.financeDraft){close();return;}if(outcome.result?.draft){const kind=outcome.result.kind;close();if(['task','event'].includes(kind))requestAnimationFrame(()=>document.getElementById(kind==='event'?'eTitle':'fTitle')?.focus());return}
  if(outcome.status==='confirmation-required'){
   const preview=outcome.preview,item=preview.result?.item;
   result.textContent=preview.details?[preview.details.title,...preview.details.lines].join('\n'):`Please review before confirming.\n${preview.action.replaceAll('.',' ')}\n${item?.title||item?.name||item?.description||preview.result?.items?.map(x=>`${x.title} → ${x.date} ${x.time}`).join('\n')||'Tracked work time'}${item?.amount!==undefined?' · '+item.amount:''}\n${preview.risk==='always-confirm'?'This changes or removes saved data. Undo will be offered after confirmation.':''}`;
   button('Cancel',()=>{services.cancel(context,outcome.token);show({status:'unknown',message:'Cancelled. Your data was not changed.'})});button('Confirm',async()=>show(await services.confirm(context,outcome.token)));
  }else{result.textContent=outcome.message||message(outcome.result);if(outcome.undoId)button('Undo',async()=>{await services.undo(context,outcome.undoId);show({status:'unknown',message:'Undone.'})});}
 }
 async function perform(action){if(busy)return;busy=true;submit.disabled=true;try{await action()}catch(error){result.textContent=String(error?.message||error);actions.replaceChildren()}finally{busy=false;submit.disabled=false}}
 input.addEventListener('input',()=>{if(!busy&&!actions.children.length)result.textContent=''});
 dialog.querySelector('form').onsubmit=event=>{event.preventDefault();autocomplete.hide();perform(async()=>show(await assistant.run(context,input.value)))};
 dialog.querySelector('[data-close]').onclick=close;
 dialog.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.stopPropagation();event.preventDefault();close()}
  if(event.key==='Tab'){const controls=[...dialog.querySelectorAll('button,input')].filter(x=>!x.disabled),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
 });
 document.addEventListener('keydown',event=>{if(event.ctrlKey&&!event.altKey&&!event.metaKey&&(event.code==='Space'||event.key.toLowerCase()==='k')){event.preventDefault();event.stopImmediatePropagation();open()}},true);
 const launcher=document.createElement('button');launcher.className='dom62-ask-launcher';launcher.type='button';launcher.textContent='Ask DOM.OS  ·  Ctrl + K';launcher.onclick=open;document.querySelector('.brand')?.after(launcher);document.querySelector('.search')?.remove();
 return {assistant,open,close,async requestUI(request){open();await perform(async()=>show(await services.execute(context,request,{source:'ui'})))}};
}
