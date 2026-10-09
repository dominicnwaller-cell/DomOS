import { check } from '@tauri-apps/plugin-updater';
import { getVersion } from '@tauri-apps/api/app';
import { initV612 } from './v612-ui.js';
import './v612.css';
import {bootstrap} from './app/bootstrap.js';
import {storage as localStorage} from './data/storage.js';
import legacySource from './app/legacy.js?raw';

let pendingUpdate = null;
let checking = false;
let installing = false;
const listeners = new Set();

const state = {
  status: 'idle', currentVersion: '', latestVersion: '', available: false,
  releaseNotes: '', releaseDate: '',
  lastChecked: localStorage.getItem('domos612.lastUpdateCheck') || '',
  downloaded: 0, total: 0, progress: 0, error: ''
};

const snapshot = () => ({ ...state, checking, installing });
function emit(){ const value=snapshot(); for(const listener of listeners){ try{listener(value)}catch(error){console.error(error)} } }

async function loadCurrentVersion(){
  try{ state.currentVersion = await getVersion(); }
  catch(error){ console.warn('Could not read DOM.OS version:', error); state.currentVersion='6.2.0'; }
  emit();
}

async function checkForUpdates(silent=false){
  if(checking||installing) return pendingUpdate;
  checking=true; state.error=''; if(!silent) state.status='checking'; emit();
  try{
    if(pendingUpdate?.close){ try{await pendingUpdate.close()}catch{} }
    pendingUpdate=await check();
    state.lastChecked=new Date().toISOString();
    localStorage.setItem('domos612.lastUpdateCheck',state.lastChecked);
    if(!pendingUpdate){ state.available=false; state.latestVersion=state.currentVersion; state.releaseNotes=''; state.releaseDate=''; state.status='up-to-date'; return null; }
    state.available=true; state.latestVersion=pendingUpdate.version||''; state.releaseNotes=pendingUpdate.body||''; state.releaseDate=pendingUpdate.date||''; state.status='available';
    return pendingUpdate;
  }catch(error){ console.error('DOM.OS update check failed:',error); state.status='error'; state.error=String(error?.message||error||'Could not check for updates.'); return null; }
  finally{ checking=false; emit(); }
}

async function updateNow(){
  if(installing) return;
  if(!pendingUpdate){ await checkForUpdates(false); if(!pendingUpdate) return; }
  installing=true; Object.assign(state,{status:'downloading',downloaded:0,total:0,progress:0,error:''}); emit();
  try{
    await pendingUpdate.downloadAndInstall(event=>{
      if(event.event==='Started'){ state.total=Number(event.data?.contentLength||0); state.downloaded=0; state.progress=0; }
      if(event.event==='Progress'){ state.downloaded+=Number(event.data?.chunkLength||0); state.progress=state.total?Math.min(100,Math.round(state.downloaded/state.total*100)):0; }
      if(event.event==='Finished'){ state.status='installing'; state.progress=100; }
      emit();
    },{restartAfterInstall:true});
    state.status='installed'; state.progress=100; emit();
  }catch(error){ console.error('DOM.OS update failed:',error); state.status='error'; state.error=String(error?.message||error||'Update failed.'); emit(); }
  finally{ installing=false; }
}

window.DOMOSUpdater={
  checkForUpdates, updateNow, getState:snapshot,
  subscribe(listener){ listeners.add(listener); listener(snapshot()); return ()=>listeners.delete(listener); }
};

async function startProfile(){
  state.lastChecked=localStorage.getItem('domos612.lastUpdateCheck')||'';
  const script=document.createElement('script');script.textContent=legacySource;document.body.append(script);
  await loadCurrentVersion();
  initV612();
  const isPopout=new URLSearchParams(location.search).has('domosPopout');
  const autoCheck=localStorage.getItem('domos612.autoCheck')!=='false';
  if(!isPopout&&autoCheck&&import.meta.env.VITE_DOMOS_NATIVE_VERIFY!=='1') setTimeout(()=>checkForUpdates(true),2500);
}
const boot=async()=>{
 if(import.meta.env.VITE_DOMOS_NATIVE_VERIFY==='1'){
  const {verifyNativeFoundation}=await import('./testing/native-foundation.js');
  await verifyNativeFoundation(()=>bootstrap(startProfile));
 }else if(import.meta.env.VITE_DOMOS_NOTIFICATION_ACCEPTANCE==='1'){const {prepareNotificationAcceptance,installNotificationAcceptance}=await import('./testing/notification-acceptance.js');await prepareNotificationAcceptance();await bootstrap(startProfile);installNotificationAcceptance();}else await bootstrap(startProfile);
};
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
