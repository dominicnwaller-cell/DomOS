import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

// Deliberately keep browser storage different from the profile facade. This
// detects global-scope eval hooks accidentally bypassing SQLite profiles.
const values=new Map([
 ['lifeos4.dashboard',JSON.stringify({order:['today','schedule','month','finance','goals','upcoming','worktimer'],hidden:['quick','worktimer'],sizes:{},dims:{},names:{}})],
 ['domos_v612_dashboard_layout','1']
]);
const errors=[];const console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
const html=readFileSync('src/index.html','utf8').replace('</body>',()=>`<script>${readFileSync('src/app/legacy.js','utf8')}</script></body>`);
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(w){
 w.structuredClone=structuredClone;w.alert=()=>{};w.fetch=async()=>({ok:false});
 w.DOMOSProfile={id:'11111111-1111-4111-8111-111111111111',name:'Fresh',preferences:{currency:'GBP'}};
 w.DOMOSStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i]??null,get length(){return values.size}};
 w.localStorage.setItem('lifeos4.tasks','[{"id":"foreign","title":"Other profile data"}]');
}});
const w=dom.window;
w.DOMOSUpdater={getState:()=>({currentVersion:'6.2.0',status:'idle'}),subscribe:()=>()=>{}};
const ui=readFileSync('src/v612-ui.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function initV612','function initV612');
w.eval(`(()=>{const localStorage=window.DOMOSStorage;${ui}\ninitV612();})();`);
assert.equal(w.eval('tasks.length'),0);
assert(w.eval('dash.hidden.includes("worktimer")'));
assert(!w.document.querySelector('[data-widget="worktimer"]'));
w.eval('showPage("notes")');
assert.equal(values.get('domos612.lastPage'),'notes');
assert.equal(w.localStorage.getItem('domos612.lastPage'),null);
assert.equal(w.localStorage.getItem('domos_v612_dashboard_layout'),null);
assert.deepEqual(errors,[]);
dom.window.close();
process.stdout.write('PASS fresh profile: empty data, preset visibility and profile-only navigation persistence\n');
