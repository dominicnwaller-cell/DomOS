import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const source=readFileSync('src/app/profile-windows.js','utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export async function','async function');
async function switchScenario(reply){
 const closed=[],listeners=new Map();let released=0;
 const targets=['domos-a','domos-b'].map(label=>({label,close:async()=>closed.push(label)}));
 const context=vm.createContext({crypto:{randomUUID},Set,Promise,Error,window:{eval:()=>false},
  getCurrentWebviewWindow:()=>({label:'main'}),getAllWebviewWindows:async()=>targets,
  listen:async(name,callback)=>{listeners.set(name,callback);return()=>{released++;listeners.delete(name)}},
  emitTo:async(label,name,payload)=>{if(reply==='timeout')return;listeners.get('domos-profile-window-closed')({payload:{requestId:payload.requestId,label,...(reply==='failure'?{error:'unsaved changes'}:{})}})},
  setTimeout:(fn)=>setTimeout(fn,20),clearTimeout
 });
 vm.runInContext(source,context);
 if(reply==='success'){await context.closeProfileWindows();assert.deepEqual(closed,['domos-a','domos-b']);}
 else{await assert.rejects(()=>context.closeProfileWindows(),reply==='failure'?/unsaved changes/:/did not acknowledge/);assert.deepEqual(closed,[]);}
 assert.equal(released,1);assert.equal(listeners.size,0);
}
await switchScenario('success');await switchScenario('failure');await switchScenario('timeout');

for(const scenario of ['saved','failed','draft','goal-draft']){
 let handler;const responses=[];let flushed=false;
 const context=vm.createContext({window:{eval:()=>scenario==='draft'},document:{querySelector:()=>scenario==='goal-draft'?{}:null},
  getCurrentWebviewWindow:()=>({label:'domos-test'}),
  listen:async(name,callback)=>{handler=callback},
  emitTo:async(target,name,payload)=>responses.push(payload)
 });vm.runInContext(source,context);
 await context.registerProfileWindow({flush:async()=>{if(scenario==='failed')throw Error('disk failure');flushed=true}});
 await handler({payload:{requestId:'test-request'}});
 assert.equal(responses.length,1);assert.equal(responses[0].requestId,'test-request');
 assert.equal(Boolean(responses[0].error),scenario!=='saved');
 assert.equal(flushed,scenario==='saved');
}
console.log('PASS profile windows: save acknowledgment, drafts, failed saves, timeout and listener cleanup');
