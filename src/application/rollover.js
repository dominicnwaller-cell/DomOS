import {dayInZone,profileZone} from './date-time.js';
// No midnight row, duplicate logs or timer mutations. A wake/focus merely rechecks the clock.
export function createDateReconciler({profile,now=()=>Date.now(),onChange=()=>{}}){
 let last=null;return {check(reason='periodic'){const p=profile(),zone=profileZone(p.preferences),date=dayInZone(now(),zone),identity=p.id+'|'+zone+'|'+(p.preferences?.weekStart??1),previous=last;if(!previous||previous.identity!==identity||previous.date!==date){onChange({date,previousDate:previous?.identity===identity?previous.date:null,reason,profileId:p.id,zone});last={identity,date};return true}return false},get current(){return last}};
}
export function installDateReconciliation(services,onChange){const reconcile=createDateReconciler({profile:()=>services.storage.profile,now:()=>services.now(),onChange});const check=()=>reconcile.check('lifecycle');reconcile.check('startup');const interval=setInterval(check,30000);window.addEventListener('focus',check);window.addEventListener('pageshow',check);document.addEventListener('visibilitychange',check);window.addEventListener('domos-profile-refreshed',check);let unlisten;
 import('@tauri-apps/api/window').then(({getCurrentWindow})=>getCurrentWindow().onFocusChanged(e=>{if(e.payload)check()})).then(fn=>unlisten=fn).catch(()=>{});return {check,dispose(){clearInterval(interval);window.removeEventListener('focus',check);window.removeEventListener('pageshow',check);document.removeEventListener('visibilitychange',check);window.removeEventListener('domos-profile-refreshed',check);unlisten?.()}};
}
