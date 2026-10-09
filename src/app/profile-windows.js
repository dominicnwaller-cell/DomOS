import {listen,emitTo} from '@tauri-apps/api/event';
import {getAllWebviewWindows,getCurrentWebviewWindow} from '@tauri-apps/api/webviewWindow';

export async function registerProfileWindow(storage){
 const current=getCurrentWebviewWindow();
 if(!current.label.startsWith('domos-'))return;
 await listen('domos-close-profile-window',async event=>{
  try{
   if(document.querySelector('.dom62-goal-dialog[open]:not(.dom62-search-dialog)'))throw Error('Finish or cancel the Goal draft in the pop-out before switching profiles.');
   if(window.eval('typeof pendingDraft!=="undefined" && pendingDraft!==null'))throw Error('Finish or cancel the draft in the pop-out before switching profiles.');
   await storage.flush();
   await emitTo('main','domos-profile-window-closed',{requestId:event.payload.requestId,label:current.label});
  }catch(error){await emitTo('main','domos-profile-window-closed',{requestId:event.payload.requestId,label:current.label,error:String(error)});}
 });
}

export async function closeProfileWindows(){
 const current=getCurrentWebviewWindow();
 const popouts=(await getAllWebviewWindows()).filter(w=>w.label.startsWith('domos-')&&w.label!==current.label);
 if(!popouts.length)return;
 const requestId=crypto.randomUUID(),pending=new Set(popouts.map(w=>w.label));
 let done,fail;
 const completed=new Promise((resolve,reject)=>{done=resolve;fail=reject});
 const stop=await listen('domos-profile-window-closed',event=>{
  if(event.payload.requestId!==requestId||!pending.has(event.payload.label))return;
  if(event.payload.error){fail(Error(event.payload.error));return;}
  pending.delete(event.payload.label);if(!pending.size)done();
 });
 const timeout=setTimeout(()=>fail(Error('A pop-out did not acknowledge saving. Close it after saving, then retry.')),8000);
 // Attach the rejection handler before dispatch, since a fast popup may reply
 // while another target is still receiving its request.
 completed.catch(()=>{});
 try{await Promise.all(popouts.map(w=>emitTo(w.label,'domos-close-profile-window',{requestId})));await completed;await Promise.all(popouts.map(w=>w.close()));}
 finally{clearTimeout(timeout);stop();}
}
