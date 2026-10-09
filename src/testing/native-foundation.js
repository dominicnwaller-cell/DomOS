import {verifyNativeFinance} from './native-finance.js';
import {verifyNativeNotifications} from './native-notifications.js';
import {verifyNativeReviews} from './native-reviews.js';
import {verifyNativeHabitTracking} from './native-habits-trackers.js';
import {verifyNativeGoals} from './native-goals.js';
// Included only when VITE_DOMOS_NATIVE_VERIFY=1. Uses a separate Tauri identity
// and synthetic profiles; never runs against development or stable user data.
import {invoke} from '@tauri-apps/api/core';
import {listen,emitTo} from '@tauri-apps/api/event';
import {WebviewWindow,getAllWebviewWindows,getCurrentWebviewWindow} from '@tauri-apps/api/webviewWindow';
import {closeProfileWindows} from '../app/profile-windows.js';

const check=(value,message)=>{if(!value)throw Error(message)};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate){for(let i=0;i<80;i++){if(await predicate())return;await pause(50)}throw Error('Native synchronization timed out')}
async function expectFailure(action){let failed=false;try{await action()}catch{failed=true}check(failed,'Expected a safe rejection')}
async function waitEvent(name,send){
 let complete;const promise=new Promise(resolve=>{complete=resolve});
 const stop=await listen(name,event=>complete(event.payload));
 const timeout=setTimeout(()=>complete({error:`Timeout waiting for ${name}`}),10000);
 try{await send();const result=await promise;check(!result.error,result.error);return result;}
 finally{clearTimeout(timeout);stop()}
}
async function popup(profile){
 const label=`domos-native-${crypto.randomUUID()}`;
 const ready=await waitEvent('domos-native-ready',async()=>{
  const view=new WebviewWindow(label,{url:`/?domosPopout=quicknote&profileId=${profile.id}&nativeTestChild=1`,title:'DOM.OS Native Test Pop-out',width:600,height:500});
  view.once('tauri://error',error=>console.error(error));
 });
 check(ready.profileId===profile.id,'Pop-out selected the wrong profile');
 return {label,ready};
}
async function child(start){
 await start();const current=getCurrentWebviewWindow();
 await listen('domos-native-edit',async event=>{
  try{
   if(event.payload.kind==='draft')window.eval('newTask()');
   else if(event.payload.kind==='cancel')window.eval('closeDrawer()');
   else{const note=document.getElementById('quickNote');note.value=event.payload.value;note.dispatchEvent(new Event('input',{bubbles:true}));}
   await window.DOMOSStorage.flush();
   await emitTo('main','domos-native-edited',{profileId:window.DOMOSProfile.id});
  }catch(error){await emitTo('main','domos-native-edited',{error:String(error)})}
 });
 await emitTo('main','domos-native-ready',{profileId:window.DOMOSProfile.id,taskCount:JSON.parse(window.DOMOSStorage.getItem('lifeos4.tasks')).length,label:current.label});
}

export async function verifyNativeFoundation(start){
 if(new URLSearchParams(location.search).has('nativeTestChild')){await child(start);return}
 const report={stage:'foundation',startedAt:new Date().toISOString(),passed:[],failed:[]};
 try{
  const suffix=crypto.randomUUID();
  const a=await invoke('profile_create',{name:`Native A ${suffix}`,preferences:{currency:'GBP'},changes:{'lifeos4.tasks':JSON.stringify([{id:'native-task',title:'Retained task',status:'upcoming'}]),'lifeos4.notes':JSON.stringify([{id:'native-note',title:'Retained note',body:'Original body'}]),'lifeos4.quickNote':JSON.stringify('Original quick note'),'domos612.autoCheck':'false'}});
  const b=await invoke('profile_create',{name:`Native B ${suffix}`,preferences:{currency:'EUR'},changes:{'domos612.autoCheck':'false'}});
  const before=await invoke('profile_snapshot',{profileId:a.id});
  const backup=await invoke('profile_export',{profileId:a.id});
  await invoke('profile_commit',{profileId:a.id,expectedRevision:before.profile.revision,changes:{'lifeos4.tasks':'[]','lifeos4.notes':'[]'}});
  await invoke('profile_restore',{profileId:a.id,payload:backup});
  const restored=await invoke('profile_snapshot',{profileId:a.id});
  check(JSON.stringify(restored.data)===JSON.stringify(before.data),'Backup round trip changed records');report.passed.push('native backup/export/restore round trip');
  const invalid=structuredClone(backup);invalid.profiles[0].data['lifeos4.tasks']='[{"id":"duplicate"},{"id":"duplicate"}]';
  await expectFailure(()=>invoke('profile_restore',{profileId:a.id,payload:invalid}));
  await expectFailure(()=>invoke('profile_restore',{profileId:a.id,payload:{format:'corrupt'}}));
  const afterFailure=await invoke('profile_snapshot',{profileId:a.id});
  check(JSON.stringify(afterFailure)===JSON.stringify(restored),'Failed restore changed data or revision');report.passed.push('invalid/corrupt restore rollback');
  check((await invoke('profile_snapshot',{profileId:b.id})).data['lifeos4.tasks']==='[]','Backup leaked into another profile');report.passed.push('restore profile isolation');
  const imported=await invoke('profile_import',{name:`Native round trip ${suffix}`,payload:backup});
  check(imported.id!==a.id&&JSON.stringify((await invoke('profile_snapshot',{profileId:imported.id})).data)===JSON.stringify(before.data),'Imported backup did not use an isolated UUID');report.passed.push('backup import into new UUID');
  window.localStorage.setItem('domos62.activeProfile',a.id);await start();await window.DOMOSStorage.flush();
  const first=await popup(a);report.passed.push('native pop-out creation and explicit profile context');
  const value=`Native synchronized note ${suffix}`;
  await waitEvent('domos-native-edited',()=>emitTo(first.label,'domos-native-edit',{value}));
  await until(()=>window.DOMOSStorage.getItem('lifeos4.quickNote')===JSON.stringify(value)&&document.getElementById('quickNote').value===value);
  check((await invoke('profile_snapshot',{profileId:b.id})).data['lifeos4.quickNote']===undefined,'Pop-out edit escaped its profile');report.passed.push('pop-out UI edit, SQLite persistence and primary-window synchronization');
  await waitEvent('domos-native-edited',()=>emitTo(first.label,'domos-native-edit',{kind:'draft'}));
  await expectFailure(()=>closeProfileWindows());
  check((await getAllWebviewWindows()).some(w=>w.label===first.label),'Draft pop-out closed without acknowledgment');report.passed.push('profile switch refuses an unsaved pop-out draft');
  await waitEvent('domos-native-edited',()=>emitTo(first.label,'domos-native-edit',{kind:'cancel'}));
  await closeProfileWindows();check(!(await getAllWebviewWindows()).some(w=>w.label===first.label),'Saved pop-out remained open');report.passed.push('save acknowledgment and safe pop-out closing');
  const second=await popup(b);check(second.ready.taskCount===0,'Second profile received first profile tasks');
  check(window.localStorage.getItem('domos62.activeProfile')===a.id,'Pop-out changed the primary active profile');
  await closeProfileWindows();report.passed.push('different-profile pop-out isolation and unchanged primary context');
  if(window.DOMOSActions){
   report.stage='foundation-and-local-assistant';
   const otherFinance=(await invoke('profile_snapshot',{profileId:b.id})).data['lifeos4.financeDomain'];const services=window.DOMOSActions.services,context={profileId:a.id};await services.execute(context,{action:'finance.account.save',name:'Native receiving',amount:'1000.10',type:'Current'});let uiWrites=0;
   const apply=services.applyUIChanges.bind(services);services.applyUIChanges=(...args)=>{uiWrites++;return apply(...args)};
   window.eval('newTask()');const draftId=window.eval('pendingDraft.id');document.getElementById('fTitle').value='Native shared UI task';window.eval(`saveTask(${JSON.stringify(draftId)})`);await window.DOMOSStorage.flush();check(uiWrites>0,'Normal task UI bypassed shared services');report.passed.push('normal UI uses the profile-scoped application services');
   document.dispatchEvent(new KeyboardEvent('keydown',{ctrlKey:true,code:'Space',key:' ',bubbles:true}));
   const command=document.getElementById('dom62CommandInput'),form=command.closest('form'),button=form.querySelector('[type=submit]');check(document.activeElement===command,'Ctrl+Space did not focus Ask DOM.OS');
   command.value='Add £15 petrol';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
   await until(()=>!button.disabled&&JSON.parse(window.DOMOSStorage.getItem('lifeos4.financeDomain')).transactions.some(x=>x.description==='petrol'&&x.amountMinor===1500));
   const saved=await invoke('profile_snapshot',{profileId:a.id});check(JSON.parse(saved.data['lifeos4.assistantAudit']).some(x=>x.originalCommand==='Add £15 petrol'&&x.success),'Assistant audit was not persisted');check((await invoke('profile_snapshot',{profileId:b.id})).data['lifeos4.financeDomain']===otherFinance,'Assistant action crossed profiles');check(JSON.parse(saved.data['lifeos4.financeDomain']).accounts[0].openingMinor===100010,'Finance opening pennies changed');report.passed.push('native Ctrl+Space command, expense persistence, audit and isolation');
   const undo=[...document.querySelectorAll('.dom62-command [data-actions] button')].find(x=>x.textContent==='Undo');check(undo,'Assistant did not offer Undo');undo.click();await until(()=>!button.disabled&&JSON.parse(window.DOMOSStorage.getItem('lifeos4.financeDomain')).transactions.length===0);report.passed.push('native command-bar Undo');
   window.deleteTask(draftId);await until(()=>document.querySelector('.dom62-command [data-actions]')?.textContent.includes('Confirm'));
   check(JSON.parse(window.DOMOSStorage.getItem('lifeos4.tasks')).some(x=>x.id===draftId),'UI deleted before confirmation');const cancel=[...document.querySelectorAll('.dom62-command [data-actions] button')].find(x=>x.textContent==='Cancel');cancel.click();await until(()=>!button.disabled);check(JSON.parse(window.DOMOSStorage.getItem('lifeos4.tasks')).some(x=>x.id===draftId),'Cancel deleted the task');report.passed.push('native destructive UI action preview and cancellation');
   await expectFailure(()=>services.execute({profileId:b.id},{action:'task.create',title:'Wrong profile'}));report.passed.push('native shared-service context rejection');
   if(window.DOMOSTracking){
    report.stage='foundation-assistant-and-life-tracking';
    document.querySelector('.dom62-command [data-close]')?.click();document.getElementById('dom62Command')?.remove();
    window.eval(`toggleTask(${JSON.stringify(draftId)})`);await window.DOMOSStorage.flush();
    let snapshot=await invoke('profile_snapshot',{profileId:a.id});check(JSON.parse(snapshot.data['lifeos4.history']).some(x=>x.sourceId===draftId&&x.action==='completed'),'UI completion did not persist history');report.passed.push('native normal UI completion creates durable history');
    const clock=services.now;let current=Date.now();services.now=()=>current;
    await services.execute(context,{action:'work.start',taskId:'native-task',title:'Native linked work'});current+=60000;await services.execute(context,{action:'work.pause'});current+=60000;await services.execute(context,{action:'work.resume'});current+=60000;await services.execute(context,{action:'work.stop'});services.now=clock;
    snapshot=await invoke('profile_snapshot',{profileId:a.id});const session=JSON.parse(snapshot.data['lifeos4.workSessions'])[0];check(session.taskId==='native-task'&&session.status==='stopped'&&session.segments.length===2,'Linked session did not survive native persistence');check(session.segments.reduce((n,s)=>n+Date.parse(s.end)-Date.parse(s.start),0)===120000,'Session counted paused time');report.passed.push('native linked sessions persist and exclude paused time');
    window.eval("showPage('calendar')");check(document.querySelector('#dom62Timeline .dom62-timeline-day'),'Day view did not render');document.querySelector('[data-view=week]').click();check(document.querySelectorAll('.dom62-timeline-day').length===7,'Week view did not render');document.querySelector('[data-view=month]').click();check(!document.querySelector('.calendar-shell').hidden&&document.querySelector('.dom62-month-evidence'),'Month lost its legacy drag/drop view');document.querySelector('[data-view=day]').click();check(document.querySelector('.kind-work')?.textContent.includes('Actual'),'Actual session is not distinct in Day view');report.passed.push('native functional Day Week Month and planned/actual rendering');
    window.eval("showPage('history')");check(document.querySelector('#dom62HistoryBody').textContent.includes('Native shared UI task'),'History screen lost the completed task');report.passed.push('native History screen reads persisted completion');
    await window.DOMOSStorage.flush();const trackingBackup=await invoke('profile_export',{profileId:a.id}),roundTrip=await invoke('profile_import',{name:`Tracking backup ${suffix}`,payload:trackingBackup}),roundSnapshot=await invoke('profile_snapshot',{profileId:roundTrip.id});
    for(const key of ['lifeos4.history','lifeos4.workSessions'])check(roundSnapshot.data[key]===(await invoke('profile_snapshot',{profileId:a.id})).data[key],'Tracking backup round trip changed '+key);check((await invoke('profile_snapshot',{profileId:b.id})).data['lifeos4.history']==='[]','History crossed profile context');report.passed.push('native tracking backup round trip and profile isolation');
    report.stage='timeline-refinement';
    document.dispatchEvent(new KeyboardEvent('keydown',{ctrlKey:true,code:'Space',key:' ',bubbles:true}));command.value='ad';command.dispatchEvent(new Event('input',{bubbles:true}));check(document.querySelectorAll('.dom62-command-option').length>=3,'Registry typeahead did not show the Add actions');command.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));command.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));check(command.value==='Add event '&&document.activeElement===command,'Keyboard autocomplete lost the input');command.value+='Native autocomplete event';command.dispatchEvent(new Event('input',{bubbles:true}));command.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await until(()=>!button.disabled&&JSON.parse(window.DOMOSStorage.getItem('lifeos4.events')).some(x=>x.title==='Native autocomplete event'));report.passed.push('native registry autocomplete selection and Enter execution');
    command.value='ad';command.dispatchEvent(new Event('input',{bubbles:true}));const normalSpace=new KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true});command.dispatchEvent(normalSpace);check(!normalSpace.defaultPrevented&&command.value==='ad','Ambiguous Space was stolen');command.value='add ta';command.setSelectionRange(6,6);command.dispatchEvent(new Event('input',{bubbles:true}));const uniqueSpace=new KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true});command.dispatchEvent(uniqueSpace);check(uniqueSpace.defaultPrevented&&command.value==='Add task ','Unique Space did not accept the task prefix');command.value+='Native autocomplete task';command.dispatchEvent(new Event('input',{bubbles:true}));command.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await until(()=>!button.disabled&&JSON.parse(window.DOMOSStorage.getItem('lifeos4.tasks')).some(x=>x.title==='Native autocomplete task'));const captureUndo=[...document.querySelectorAll('.dom62-command [data-actions] button')].find(x=>x.textContent==='Undo');captureUndo.click();await until(()=>!button.disabled&&!JSON.parse(window.DOMOSStorage.getItem('lifeos4.tasks')).some(x=>x.title==='Native autocomplete task'));report.passed.push('native unique-prefix Space normal Space audit and Undo');
    document.querySelector('.dom62-command [data-close]').click();
    const originalZone=window.DOMOSStorage.profile.preferences.timeZone,realClock=services.now;window.DOMOSStorage.profile.preferences.timeZone='America/Los_Angeles';services.now=()=>Date.parse('2026-10-05T01:00:00Z');const quick=await services.execute(context,{action:'task.create',title:'Native timezone task'});await services.execute(context,{action:'task.complete',id:quick.result.item.id});const dayResult=await services.execute(context,{action:'today.get'}),historyResult=await services.execute(context,{action:'history.get',date:'2026-10-04'});check(dayResult.result.date==='2026-10-04'&&historyResult.result.entries.some(x=>x.title==='Native timezone task'),'Native Today and History disagree across a UTC boundary');const persistedHistory=JSON.parse((await invoke('profile_snapshot',{profileId:a.id})).data['lifeos4.history']);check(persistedHistory.some(x=>x.title==='Native timezone task'&&x.timestamp==='2026-10-05T01:00:00.000Z'),'Native timezone handling changed the underlying instant');window.DOMOSStorage.profile.preferences.timeZone=originalZone;services.now=realClock;report.passed.push('native profile date boundary and preserved UTC timestamps');
    window.eval("showPage('calendar')");const liveDay=document.querySelector('.dom62-calendar-tools input');liveDay.value=window.DOMOSDate.today();liveDay.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-view=day]').click();check(document.querySelector('.dom62-hour-canvas')&&document.querySelector('.dom62-current-time'),'Hour grid lost the live marker');document.querySelector('.dom62-positioned-item [data-open]')?.click();check(!document.querySelector('#dom62TimelineDetail').hidden,'Timeline detail pane did not open');if(window.innerWidth>=1050){const grid=document.querySelector('#dom62Timeline').getBoundingClientRect(),pane=document.querySelector('#dom62TimelineDetail').getBoundingClientRect();check(pane.left>=grid.right-1&&pane.top<grid.bottom,'Desktop detail pane must sit beside the timeline');}check(!getComputedStyle(document.querySelector('#page-calendar>.hero')).backgroundImage.includes('unsplash'),'Tracking header retained the legacy mountain image');document.querySelector('[data-detail-close]').click();document.querySelector('[data-view=month]').click();check(document.querySelectorAll('#monthGrid .day').length===42,'Refined Month lost dates');check(document.querySelectorAll('#monthGrid [draggable=true]').length>0,'Month lost event/task drag targets');document.querySelector('[data-view=day]').click();report.passed.push('native refined hour grid detail pane and month drag targets');
    await verifyNativeFinance({services,context,otherProfile:b.id,report,check,until});
    if(window.DOMOSGoals)await verifyNativeGoals({services,context,otherProfile:b.id,report,check,until});
    if(window.DOMOSHabitTracking)await verifyNativeHabitTracking({services,context,otherProfile:b.id,report,check,until});
    if(window.DOMOSReviews)await verifyNativeReviews({services,context,otherProfile:b.id,report,check,until});
    if(window.DOMOSNotifications)await verifyNativeNotifications({services,context,otherProfile:b.id,report,check,until});
    if(report.financeRestart){const latestFinance=services.read(context,'lifeos4.financeDomain');report.financeRestart.transactionCount=latestFinance.transactions.length;report.financeRestart.ruleCount=latestFinance.rules.length;}
   }
  }
 }catch(error){report.failed.push(String(error?.stack||error))}
 report.finishedAt=new Date().toISOString();report.success=report.failed.length===0;
 const path=await invoke('native_verification_report',{report});
 const panel=document.createElement('section');panel.id='nativeVerificationResult';panel.style.cssText='position:fixed;inset:0;z-index:99999;padding:40px;background:#050b08;color:#eff7f2;overflow:auto;white-space:pre-wrap';
 panel.textContent=`Native foundation verification: ${report.success?'PASS':'FAIL'}\n${report.passed.join('\n')}\n${report.failed.join('\n')}\nReport: ${path}`;document.body.append(panel);
 const view=document.createElement('button');view.textContent='View tested app';view.style.cssText='display:block;margin-top:20px;padding:12px;background:#23583b;color:white;border:1px solid #4c9970;border-radius:8px';view.onclick=()=>panel.remove();panel.append(view);
}
