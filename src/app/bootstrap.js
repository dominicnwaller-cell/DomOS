import {installNotifications} from './notifications-ui.js';
import {installReviews} from './reviews-ui.js';
import {installHabitTracking} from './habits-trackers-ui.js';
import {installGoals} from './goals-ui.js';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {captureLegacy,auditLegacy} from '../data/legacy.js';
import {ProfileStorage} from '../data/storage.js';
import './foundation.css';
import {registerProfileWindow,closeProfileWindows} from './profile-windows.js';
import {ApplicationServices} from '../application/services.js';
import {installCommandBar} from '../assistant/command-bar.js';
import {installUIBridge} from '../application/ui-bridge.js';
import {installLifeTracking} from './life-tracking-ui.js';
import {installProfileClock} from '../application/date-time.js';
import {installFinance} from './finance-ui.js';
import './finance.css';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaults=()=>({currency:'GBP',location:null,payday:null,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,timeFormat:'24h',dateFormat:'DD/MM/YYYY',weekStart:1,preset:'Balanced'});
function download(payload,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
function panel(html){document.body.classList.add('dom62-booting');let el=document.getElementById('dom62Boot');if(!el){el=document.createElement('section');el.id='dom62Boot';document.body.append(el)}el.innerHTML=`<div class="dom62-onboarding"><span class="dom62-brand">DOM.OS</span>${html}<p role="alert" id="dom62BootError"></p></div>`;return el;}
function showError(error){const el=document.getElementById('dom62BootError');if(el)el.textContent=String(error?.message||error);}
function profileFields(name=''){return `<label>Your profile name<input id="dom62Name" maxlength="80" value="${esc(name)}" autocomplete="nickname" required></label><div class="dom62-field-grid"><label>Currency<select id="dom62Currency"><option>GBP</option><option>USD</option><option>EUR</option><option>CAD</option><option>AUD</option></select></label><label>Payday (optional)<input id="dom62Payday" type="number" min="1" max="31"></label><label>Week starts<select id="dom62Week"><option value="1">Monday</option><option value="0">Sunday</option></select></label><label>Dashboard layout<select id="dom62Preset"><option>Balanced</option><option>Focused</option><option>Expanded</option></select></label></div>`}
function profileInput(){const name=document.getElementById('dom62Name').value.trim();if(!name)throw new Error('Please name your profile');const payday=document.getElementById('dom62Payday')?.value;return {name,preferences:{...defaults(),currency:document.getElementById('dom62Currency')?.value||'GBP',payday:payday?Number(payday):null,weekStart:Number(document.getElementById('dom62Week')?.value||1),preset:document.getElementById('dom62Preset')?.value||'Balanced'}};}

export async function bootstrap(startApp){
 let legacy={data:{}};
 try{
  legacy=captureLegacy(window.localStorage);const audit=auditLegacy(legacy);
  if(!isTauri()){panel('<h1>Open DOM.OS on your desktop</h1><p>This build stores your life data in the desktop SQLite database. A browser preview cannot open it.</p>');return;}
  const profiles=await invoke('profiles_list');
  const popupProfile=new URLSearchParams(location.search).get('profileId');
  const active=popupProfile||window.localStorage.getItem('domos62.activeProfile');
  if(active&&profiles.some(p=>p.id===active)){await activate(active,startApp);return;}
  if(profiles.length){await selectProfile(profiles,startApp);return;}
  if(audit.hasLegacy){
   const backupPath=await invoke('legacy_backup',{data:legacy.data});
   const oldName=audit.state['domos612.settings']?.displayName||'';
   const el=panel(`<h1>Existing DOM.OS data found</h1><p>We created and verified a pre-migration backup. Your original data stays untouched.</p><p>${Object.entries(audit.counts).map(([k,n])=>`${n} ${esc(k.replaceAll('_',' '))}`).join(' · ')}</p><details><summary>Backup location</summary><code>${esc(backupPath)}</code></details><label>Name this profile<input id="dom62Name" maxlength="80" value="${esc(oldName)}" required></label><button id="dom62Migrate" ${audit.issues.length?'disabled':''}>Safely upgrade my data</button><button id="dom62LegacyExport">Export legacy snapshot</button>`);
   if(audit.issues.length)showError('Some data needs attention before migration: '+audit.issues.join('; '));
   el.querySelector('#dom62LegacyExport').onclick=()=>download(legacy,'DOM.OS-legacy-snapshot.json');
   el.querySelector('#dom62Migrate').onclick=async()=>{const button=el.querySelector('#dom62Migrate');button.disabled=true;try{const name=el.querySelector('#dom62Name').value.trim();if(!name)throw new Error('Name your profile');const receipt=await invoke('legacy_migrate',{name,data:legacy.data});await activate(receipt.profile_id,startApp);}catch(error){showError('Migration failed. Your existing data has not been changed. '+String(error));button.disabled=false}};
  }else await onboarding(startApp);
 }catch(error){const el=panel('<h1>Your data stays safe</h1><p>DOM.OS could not open its data foundation. Existing local data has not been changed.</p><button id="dom62Retry">Retry</button><button id="dom62RawExport">Export existing data</button>');showError(error);el.querySelector('#dom62Retry').onclick=()=>bootstrap(startApp);el.querySelector('#dom62RawExport').onclick=()=>download(legacy,'DOM.OS-recovery.json');}
}

async function onboarding(startApp){
 const el=panel(`<h1>Welcome to DOM.OS</h1><p>A local profile keeps your data on this device. Choose how you want to begin.</p>${profileFields()}<div class="dom62-start-options"><button data-start="fresh"><b>Start Fresh</b><small>An empty profile, entirely yours.</small></button><button data-start="templates"><b>Starter Templates</b><small>Optional generic routines and Life Areas.</small></button><label class="dom62-import">Import Backup<input id="dom62Import" type="file" accept=".json,.domosbackup"></label></div>`);
 for(const button of el.querySelectorAll('[data-start]'))button.onclick=async()=>{button.disabled=true;try{
  const input=profileInput(),changes=initialProfileData(input.name,input.preferences,button.dataset.start==='templates');const profile=await invoke('profile_create',{...input,changes});await activate(profile.id,startApp);
 }catch(error){showError(error);button.disabled=false}};
 el.querySelector('#dom62Import').onchange=async event=>{try{
  const file=event.target.files[0];if(!file)return;const payload=JSON.parse(await file.text());
  const input=profileInput(),legacy=payload.format==='DOM.OS Backup'&&payload.version===1;
  if(!legacy&&(payload.format!=='DOM.OS Backup'||payload.version!==2||![1,2,3,4,5,6].includes(payload.schemaVersion)||payload.profiles?.length!==1))throw Error('Choose a supported DOM.OS backup.');
  const preview=panel(`<h1>Import this backup?</h1><p>Profile: ${esc(input.name)}</p><p>Your existing profiles will be retained. ${legacy?'An already-imported legacy backup reopens its verified profile.':'This backup will be imported into a new isolated profile.'}</p><button id="dom62ImportCancel">Cancel</button><button id="dom62ImportConfirm">Confirm import</button>`);
  preview.querySelector('#dom62ImportCancel').onclick=async()=>{await onboarding(startApp);document.getElementById('dom62Name').value=input.name;document.getElementById('dom62Currency').value=input.preferences.currency;document.getElementById('dom62Payday').value=input.preferences.payday||'';document.getElementById('dom62Week').value=input.preferences.weekStart;document.getElementById('dom62Preset').value=input.preferences.preset};
  preview.querySelector('#dom62ImportConfirm').onclick=async()=>{const button=preview.querySelector('#dom62ImportConfirm');button.disabled=true;try{if(legacy){const receipt=await invoke('legacy_migrate',{name:input.name,data:payload.data});await activate(receipt.profile_id,startApp);}else{const profile=await invoke('profile_import',{name:input.name,payload});await activate(profile.id,startApp)}}catch(error){showError('Import failed. Existing profiles were retained. '+String(error));button.disabled=false}};
 }catch(error){showError(error)}};
}
function initialProfileData(name,preferences,templates){
 const settings={displayName:name,defaultPage:'dashboard',rememberLastPage:true,accent:'#37e68b',sidebarDensity:'default',compact:false,animations:true,reduceMotion:false};
 const order=preferences.preset==='Focused'?['today','schedule','worktimer','finance','upcoming','month','goals']:['today','schedule','month','finance','goals','upcoming','worktimer'];
 const hidden=preferences.preset==='Focused'?['quick','month','goals']:preferences.preset==='Expanded'?['quick']:['quick','worktimer'];
 const changes={'domos612.settings':JSON.stringify(settings),'lifeos4.dashboard':JSON.stringify({order,hidden,sizes:{},dims:{},names:{}}),'domos_v612_dashboard_layout':'1','lifeos4.paydayDay':JSON.stringify(preferences.payday)};
 if(templates){changes['lifeos4.routines']=JSON.stringify([{id:crypto.randomUUID(),name:'Morning check-in',icon:'☀',active:true,days:['mon','tue','wed','thu','fri'],time:'09:00',duration:10,start:'',end:'',steps:[{name:'Choose today’s priorities',mode:'duration',minutes:10}]}]);changes['lifeos4.lifeAreas']=JSON.stringify(['Work','Wellbeing','Personal'].map((name,index)=>({id:crypto.randomUUID(),name,order:index,archived:false})));}
 return changes;
}
async function selectProfile(profiles,startApp){const el=panel('<h1>Choose your local profile</h1><div id="dom62ProfileChoices"></div><button id="dom62AddProfile">Add profile</button>');for(const p of profiles){const button=document.createElement('button');button.textContent=p.name;button.onclick=()=>activate(p.id,startApp).catch(showError);el.querySelector('#dom62ProfileChoices').append(button)}el.querySelector('#dom62AddProfile').onclick=()=>onboarding(startApp);}

async function activate(id,startApp){
 const snapshot=await invoke('profile_snapshot',{profileId:id});
 if(!new URLSearchParams(location.search).has('domosPopout'))window.localStorage.setItem('domos62.activeProfile',id);
 let banner=document.getElementById('dom62Persistence');if(!banner){banner=document.createElement('div');banner.id='dom62Persistence';banner.setAttribute('role','status');document.body.append(banner);}
 const adapter=new ProfileStorage(snapshot,(profileId,expectedRevision,changes)=>invoke('profile_commit',{profileId,expectedRevision,changes}),(status,error)=>{
  document.body.dataset.saveState=status;banner.textContent=status==='pending'?'Saving to this profile…':status==='error'?'Save failed. Changes are retained in memory; export recovery before closing.':'';
  if(status==='error'){const recovery=document.createElement('button');recovery.textContent='Export unsaved changes';recovery.onclick=()=>download(adapter.recovery(),'DOM.OS-unsaved-recovery.json');banner.append(recovery);}
 });
 window.DOMOSStorage=adapter;window.DOMOSProfile=snapshot.profile;window.DOMOSDate=installProfileClock(snapshot.profile);
 await listen('profile-updated',async event=>{if(event.payload.profileId!==id||event.payload.revision<=adapter.profile.revision)return;try{await adapter.flush();const next=await invoke('profile_snapshot',{profileId:id});const previous=await adapter.acceptSnapshot(next);if(!previous)return;window.DOMOSProfile=adapter.profile;window.DOMOSDate=installProfileClock(adapter.profile);for(const key of new Set([...previous.keys(),...adapter.values.keys()])){if(previous.get(key)!==adapter.values.get(key))window.dispatchEvent(new StorageEvent('storage',{key,oldValue:previous.get(key)??null,newValue:adapter.values.get(key)??null}));}window.dispatchEvent(new Event('domos-profile-refreshed'));}catch(error){banner.textContent='Another window changed this profile. Export unsaved changes before reopening.';}});
 window.DOMOSProfiles={
  async switch(){await window.DOMOSNotifications?.pause();await closeProfileWindows();await adapter.flush();window.localStorage.removeItem('domos62.activeProfile');location.href='/'},
  async export(){await adapter.flush();download(await invoke('profile_export',{profileId:id}),'DOM.OS-profile.domosbackup')},
  async restore(file){
   await adapter.flush();const payload=JSON.parse(await file.text());
   if(payload.format!=='DOM.OS Backup'||payload.version!==2||![1,2,3,4,5,6].includes(payload.schemaVersion)||payload.profiles?.length!==1)throw Error('This is not a supported single-profile backup.');
   const source=payload.profiles[0],el=panel(`<h1>Restore this backup?</h1><p>This will replace the saved data in ${esc(window.DOMOSProfile.name)} with ${esc(source.profile?.name||'the backup profile')}. DOM.OS will verify a rollback backup first.</p><button id="dom62RestoreCancel">Cancel</button><button id="dom62RestoreConfirm">Confirm restore</button>`);
   el.querySelector('#dom62RestoreCancel').onclick=()=>{el.remove();document.body.classList.remove('dom62-booting')};
   el.querySelector('#dom62RestoreConfirm').onclick=async()=>{const button=el.querySelector('#dom62RestoreConfirm');button.disabled=true;try{await window.DOMOSNotifications?.pause();await closeProfileWindows();await adapter.flush();await invoke('profile_restore',{profileId:id,payload});location.reload()}catch(error){showError('Restore failed. Your saved data was retained. '+String(error));button.disabled=false}};
  },
  async close(){await window.DOMOSNotifications?.pause();await closeProfileWindows();await adapter.flush();window.localStorage.removeItem('domos62.activeProfile');location.href='/'},
  async settings(){
   await adapter.flush();const current=window.DOMOSProfile,p=current.preferences;const el=panel(`<h1>Profile Settings</h1>${profileFields(current.name)}<label>Location name (optional)<input id="dom62LocationName" value="${esc(p.location?.name||'')}"></label><div class="dom62-field-grid"><label>Latitude<input id="dom62Latitude" type="number" min="-90" max="90" step="any" value="${esc(p.location?.latitude??'')}"></label><label>Longitude<input id="dom62Longitude" type="number" min="-180" max="180" step="any" value="${esc(p.location?.longitude??'')}"></label><label>Time zone<input id="dom62TimeZone" value="${esc(p.timeZone||defaults().timeZone)}"></label><label>Time format<select id="dom62TimeFormat"><option value="24h">24 hour</option><option value="12h">12 hour</option></select></label><label>Date format<select id="dom62DateFormat"><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select></label></div><button id="dom62ProfileSave">Save Profile</button><button id="dom62ProfileCancel">Cancel</button>`);
   el.querySelector('#dom62Currency').value=p.currency||'GBP';el.querySelector('#dom62Payday').value=Number(JSON.parse(adapter.getItem('lifeos4.paydayDay')||'null'))||'';el.querySelector('#dom62Week').value=p.weekStart??1;el.querySelector('#dom62Preset').value=p.preset||'Balanced';el.querySelector('#dom62TimeFormat').value=p.timeFormat||'24h';el.querySelector('#dom62DateFormat').value=p.dateFormat||'DD/MM/YYYY';
   el.querySelector('#dom62ProfileCancel').onclick=()=>{el.remove();document.body.classList.remove('dom62-booting')};
   el.querySelector('#dom62ProfileSave').onclick=async()=>{try{const input=profileInput(),label=el.querySelector('#dom62LocationName').value.trim(),latitude=Number(el.querySelector('#dom62Latitude').value),longitude=Number(el.querySelector('#dom62Longitude').value);if(label&&(!el.querySelector('#dom62Latitude').value||!el.querySelector('#dom62Longitude').value||latitude<-90||latitude>90||longitude<-180||longitude>180))throw new Error('Enter valid coordinates for this location');const timeZone=el.querySelector('#dom62TimeZone').value;new Intl.DateTimeFormat('en',{timeZone});input.preferences={...p,...input.preferences,location:label?{name:label,latitude,longitude}:null,timeZone,timeFormat:el.querySelector('#dom62TimeFormat').value,dateFormat:el.querySelector('#dom62DateFormat').value};await invoke('profile_update',{profileId:id,expectedRevision:adapter.profile.revision,...input,changes:{'lifeos4.paydayDay':JSON.stringify(input.preferences.payday)}});location.reload();}catch(error){showError(error)}};
  },
  async lock(){await window.DOMOSNotifications?.pause();await adapter.flush();const el=panel('<h1>DOM.OS is locked</h1><p>This screen hides the open profile. It is not an encrypted security lock.</p><button id="dom62Unlock">Continue</button>');el.querySelector('#dom62Unlock').onclick=async()=>{el.remove();document.body.classList.remove('dom62-booting');await window.DOMOSNotifications?.resume()}}
 };
 const services=new ApplicationServices(adapter,{navigate:page=>window.eval(`showPage(${JSON.stringify(page)})`),newTask:()=>window.eval('newTask()'),newEvent:()=>window.eval('newEvent()'),refresh:(request={})=>{
  const collection=request.action==='task.delete'?'tasks':request.action==='event.delete'?'events':request.action==='record.delete'?request.collection:null;
  if(collection)for(const editor of document.querySelectorAll('[data-entity-collection]'))if(editor.dataset.entityCollection===collection&&editor.dataset.entityId===request.id){if(editor.id==='drawer')window.eval('closeDrawer()');else if(editor.id==='routineModal')window.eval('closeRoutineBuilder()');else editor.classList.remove('show')}
  window.dispatchEvent(new StorageEvent('storage',{key:'lifeos4.tasks'}));
  window.DOMOS612?.renderWorkTimer?.();
 }});
 window.DOMOSApplicationServices=services;
 await services.initializeFinance({profileId:id});
 await startApp();
 const commandBar=installCommandBar(services,id);window.DOMOSCommandBar=commandBar;installUIBridge(services,commandBar,id);installFinance(services,id);installLifeTracking(services,id);installGoals(services,id,commandBar);installHabitTracking(services,id,commandBar);installReviews(services,id);await installNotifications(services,id,commandBar);
 document.getElementById('dom62Boot')?.remove();document.body.classList.remove('dom62-booting');
 await registerProfileWindow(adapter);
 const account=document.querySelector('.account');if(account){account.textContent=snapshot.profile.name+' · Local profile';account.setAttribute('role','button');account.tabIndex=0;account.onclick=()=>profileMenu();account.onkeydown=e=>{if(['Enter',' '].includes(e.key))profileMenu()};}
}
function profileMenu(){
 let menu=document.getElementById('dom62ProfileMenu');if(menu){menu.remove();return}menu=document.createElement('div');menu.id='dom62ProfileMenu';menu.className='dom62-profile-menu';
 menu.innerHTML=`<b>${esc(window.DOMOSProfile.name)}</b><button data-profile-action="settings">Profile Settings</button><button data-profile-action="switch">Switch / add profile</button><button data-profile-action="lock">Lock DOM.OS</button><button data-profile-action="export">Export Backup</button><label>Import Backup<input type="file" accept=".domosbackup,.json"></label><button data-profile-action="close">Close Profile</button>`;
 menu.querySelectorAll('[data-profile-action]').forEach(button=>button.onclick=()=>window.DOMOSProfiles[button.dataset.profileAction]().catch(error=>alert(String(error))));menu.querySelector('input').onchange=e=>e.target.files[0]&&window.DOMOSProfiles.restore(e.target.files[0]).catch(error=>alert('Restore failed; previous data retained. '+String(error)));document.body.append(menu);
}
