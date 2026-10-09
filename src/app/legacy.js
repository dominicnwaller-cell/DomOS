const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

function localTodayISO(){
 if(window.DOMOSDate)return window.DOMOSDate.today();
 const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
 return `${y}-${m}-${day}`;
}


const storageBaseline=new Map();
const sameValue=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function mergeStored(base,local,remote){
 if(sameValue(local,base))return remote;
 if(sameValue(remote,base)||sameValue(local,remote))return local;
 if(Array.isArray(base)&&Array.isArray(local)&&Array.isArray(remote)&&[...base,...local,...remote].every(x=>x&&typeof x.id==='string')){
  const byId=a=>new Map(a.map(x=>[x.id,x])),b=byId(base),l=byId(local),r=byId(remote);
  return [...new Set([...local.map(x=>x.id),...remote.map(x=>x.id)])].map(id=>mergeStored(b.get(id),l.get(id),r.get(id))).filter(x=>x!==undefined);
 }
 if([base,local,remote].every(x=>x&&typeof x==='object'&&!Array.isArray(x))){
  const result={};for(const k of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){const v=mergeStored(base[k],local[k],remote[k]);if(v!==undefined)result[k]=v}return result;
 }
 throw new Error('This item changed in another window. Close and reopen the editor before saving again.');
}
function prepareStore(k,v){
 const raw=window.DOMOSStorage.getItem('lifeos4.'+k),remote=raw===null?undefined:JSON.parse(raw);
 const base=storageBaseline.has(k)?storageBaseline.get(k):remote;
 try{return {k,v,merged:structuredClone(mergeStored(base,v,raw===null?base:remote)),raw}}catch(e){window.dispatchEvent(new StorageEvent('storage',{key:'lifeos4.'+k}));alert(e.message);throw e}
}
function commitStore(entries){
 const written=[];
 try{if(window.DOMOSActions){window.DOMOSActions.applyUIChanges({profileId:window.DOMOSProfile.id},Object.fromEntries(entries.filter(x=>JSON.stringify(x.merged)!==x.raw).map(x=>['lifeos4.'+x.k,JSON.stringify(x.merged)])));}else for(const x of entries){const encoded=JSON.stringify(x.merged);if(encoded!==x.raw){window.DOMOSStorage.setItem('lifeos4.'+x.k,encoded);written.push(x)}}}
 catch(e){for(const x of written){if(x.raw===null)window.DOMOSStorage.removeItem('lifeos4.'+x.k);else window.DOMOSStorage.setItem('lifeos4.'+x.k,x.raw)}alert('Could not save data. Your previous data was retained.');throw e}
 for(const x of entries){storageBaseline.set(x.k,structuredClone(x.merged));if(Array.isArray(x.v)&&Array.isArray(x.merged))x.v.splice(0,x.v.length,...x.merged);else if(x.v&&x.merged&&typeof x.v==='object'&&!Array.isArray(x.v)){Object.keys(x.v).forEach(k=>delete x.v[k]);Object.assign(x.v,x.merged)}}
}
const store={get:(k,d)=>{let v;try{v=JSON.parse(window.DOMOSStorage.getItem('lifeos4.'+k))??d}catch{v=d}storageBaseline.set(k,structuredClone(v));return v},set:(k,v)=>commitStore([prepareStore(k,v)])};

let tasks=store.get('tasks',[]);
let _domToday=new Date(localTodayISO()+'T12:00:00');
let dashSelectedDate=store.get('dashSelectedDate',localTodayISO());
let dashCalView=store.get('dashCalView',{year:_domToday.getFullYear(),month:_domToday.getMonth()});
let events=store.get('events',[]);
let calendarTemplates=store.get('calendarTemplates',[]);
let routines=store.get('routines',[]);
let routineExceptions=store.get('routineExceptions',[]);
let routineChecks=store.get('routineChecks',{});
let transactions=store.get('transactions',[]);
let goals=store.get('goals',[]);
let notes=store.get('notes',[]);
let activeNoteId=store.get('activeNoteId',null);
let financeAccounts=store.get('financeAccounts',[]);
let financeBudgets=store.get('financeBudgets',[]);
let financeBills=store.get('financeBills',[]);
let financeSavings=store.get('financeSavings',[]);
let financeTab='overview';

let paydayDay=Number(store.get('paydayDay',null))||null;


const widgets=[
{id:'today',title:'Today',cls:'',body:()=>`<div class="today-routine-list"></div>`},
{id:'schedule',title:'Schedule',cls:'',body:()=>`<div id="dashSchedule"></div>`},
{id:'month',title:'Calendar',cls:'',body:()=>`<div id="dashCalendar"></div>`},
{id:'finance',title:'Finances',cls:'',body:()=>`<div class="pad"><div class="muted">Current balance</div><div style="font-size:24px;font-weight:750;margin:5px 0">${money(transactions.filter(x=>x.type==='income').reduce((s,x)=>s+Number(x.amount||0),0)-transactions.filter(x=>x.type==='expense').reduce((s,x)=>s+Number(x.amount||0),0))}</div><div class="muted">${transactions.length} transaction${transactions.length===1?'':'s'} recorded</div></div>`},
{id:'goals',title:'Goals',cls:'',body:()=>`<div class="pad">${goals.length?goals.slice(0,3).map(g=>`<div style="margin:7px 0"><div style="display:flex;justify-content:space-between"><span>${esc(g.name)}</span><span class="muted">${g.progress||0}%</span></div><div class="goal-progress"><i style="width:${g.progress||0}%"></i></div></div>`).join(''):'<span class="muted">No goals yet.</span>'}</div>`},
{id:'quick',title:'Quick Actions',cls:'w3 h2',body:()=>`<div class="pad"><button class="btn" onclick="newTask()">＋ Task</button> <button class="btn ghost" onclick="newEvent()">＋ Event</button></div>`},
{id:'upcoming',title:'Upcoming',cls:'w3 h2',body:()=>`<div class="pad" id="upcomingReal"></div>`}
];
let dash=store.get('dashboard',{order:widgets.map(w=>w.id),hidden:['quick'],sizes:{},dims:{}});
if(!dash.dims) dash.dims={};
if(!dash.hidden) dash.hidden=['quick'];
if(!dash.names) dash.names={};
dash.order=dash.order.filter(id=>id!=='routine'&&id!=='notes');
dash.hidden=dash.hidden.filter(id=>id!=='routine'&&id!=='notes');

let undo=[],redo=[],pendingDraft=null;
function snapshot(label){undo.push({label,tasks:structuredClone(tasks.filter(x=>x.id!==pendingDraft?.id)),events:structuredClone(events.filter(x=>x.id!==pendingDraft?.id)),dash:structuredClone(dash),routines:structuredClone(routines)});if(undo.length>30)undo.shift();redo=[]}
function persist(){
 const entries={tasks:tasks.filter(x=>x.id!==pendingDraft?.id),events:events.filter(x=>x.id!==pendingDraft?.id),dashboard:dash,routines,calendarTemplates:calendarTemplates.filter(x=>x.id!==pendingDraft?.id),financeAccounts,financeBudgets,financeBills,financeSavings};
 commitStore(Object.entries(entries).map(([k,v])=>prepareStore(k,v)));
 // Adopt merged collections while preserving the unsaved editor draft.
 tasks=entries.tasks.concat(pendingDraft?.kind==='tasks'?[pendingDraft.value]:[]);
 events=entries.events.concat(pendingDraft?.kind==='events'?[pendingDraft.value]:[]);
 calendarTemplates=entries.calendarTemplates.concat(pendingDraft?.kind==='calendarTemplates'?[pendingDraft.value]:[]);
}

function toastMsg(msg,canUndo=false){toast.innerHTML=esc(msg)+(canUndo?` <button onclick="doUndo()">UNDO</button>`:'');toast.classList.add('show');clearTimeout(window.tt);window.tt=setTimeout(()=>toast.classList.remove('show'),2800)}
function doUndo(){if(!undo.length)return;redo.push({tasks:structuredClone(tasks),events:structuredClone(events),dash:structuredClone(dash),routines:structuredClone(routines)});let s=undo.pop();tasks=s.tasks;events=s.events;dash=s.dash;if(s.routines)routines=s.routines;persist();renderAll();toastMsg('Undone',false)}
function doRedo(){if(!redo.length)return;undo.push({tasks:structuredClone(tasks),events:structuredClone(events),dash:structuredClone(dash),routines:structuredClone(routines)});let s=redo.pop();tasks=s.tasks;events=s.events;dash=s.dash;if(s.routines)routines=s.routines;persist();renderAll();toastMsg('Redone',false)}
function showPage(n){$$('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+n));$$('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===n));$('.main').scrollTop=0;if(n==='calendar')renderCalendar();if(n==='tasks')renderTasks();if(n==='routine')renderRoutines();if(n==='finances')renderFinance();if(n==='goals')renderGoals();if(n==='notes')renderNotes()}
$$('.nav button').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
let edit=false,dragWidget=null;

function updateLiveClock(){
 let n=new Date(),h=window.DOMOSDate?Number(new Intl.DateTimeFormat('en-GB',{timeZone:window.DOMOSDate.zone(),hour:'numeric',hourCycle:'h23'}).format(n)):n.getHours(),g=h<12?'Good morning':h<18?'Good afternoon':'Good evening';
 let ge=document.getElementById('liveGreeting'),de=document.getElementById('liveDate');
 if(ge)ge.textContent=g;
 if(de)de.textContent=(window.DOMOSDate?window.DOMOSDate.dateLabel(localTodayISO(),{weekday:'long',day:'numeric',month:'long'}):new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long'}).format(n));
}
function upcomingItems(){
 let today=localTodayISO();
 let ev=events.filter(e=>e.date&&e.date>=today).map(e=>({title:e.title,date:e.date,time:e.time||'',kind:'Event'}));
 let wt=tasks.filter(t=>t.date&&t.date>=today&&t.status!=='completed').map(t=>({title:t.title,date:t.date,time:t.time||'',kind:'Work Task'}));
 return [...ev,...wt].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,5);
}
function renderUpcomingReal(){
 let el=document.getElementById('upcomingReal');if(!el)return;
 let arr=upcomingItems();
 el.innerHTML=arr.length?arr.map(x=>{let d=new Date(x.date+'T12:00:00');let label=new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'}).format(d);return `<div style="padding:7px 0;border-bottom:1px solid #17251e"><b>${label}</b> · ${esc(x.title)}${x.time?` <span class="muted">· ${x.time}</span>`:''}<div class="muted">${x.kind}</div></div>`}).join(''):'<span class="muted">Nothing upcoming.</span>';
}
function renderDashboard(){
 let g=$('#dashGrid');g.innerHTML='';
 dash.order.forEach(id=>{
  if(dash.hidden.includes(id))return;
  let w=widgets.find(x=>x.id===id);if(!w)return;
  let el=document.createElement('div'),legacy=dash.sizes[id]||w.cls;
  let defCols=legacy.includes('w6')?6:legacy.includes('w3')?3:4,defRows=legacy.includes('h2')?2:4;
  let dim=dash.dims[id]||{cols:defCols,rows:defRows};
  el.className='card widget';el.style.setProperty('--cols',dim.cols);el.style.setProperty('--rows',dim.rows);
  el.draggable=edit;el.dataset.id=id;
  el.innerHTML=`<span class="drag-handle">⠿</span><button class="closew">✕</button><span class="resize" title="Drag to resize"></span>
   <div class="head"><h3>${esc(dash.names[id]||w.title)}</h3><button class="morebtn" aria-label="Widget options">•••</button></div>
   <div class="widget-menu">
    <button data-act="pop">↗ &nbsp; Pop out window</button>
    <button data-act="rename">✎ &nbsp; Rename widget</button>
    <hr>
    <button data-act="hide">⊘ &nbsp; Hide widget</button>
   </div>${w.body()}`;
  g.appendChild(el);
  let menu=el.querySelector('.widget-menu');
  el.querySelector('.morebtn').onclick=e=>{e.stopPropagation();$$('.widget-menu').forEach(m=>{if(m!==menu)m.classList.remove('show')});menu.classList.toggle('show')};
  el.querySelector('.closew').onclick=e=>{e.stopPropagation();hideWidget(id)};
  menu.onclick=e=>{let a=e.target.closest('[data-act]');if(!a)return;e.stopPropagation();let act=a.dataset.act;menu.classList.remove('show');
    if(act==='pop')popWidget(id);
    if(act==='rename')openRename(id);
    if(act==='hide')hideWidget(id);
  };
  let rh=el.querySelector('.resize');
  rh.onpointerdown=e=>{if(!edit)return;e.preventDefault();e.stopPropagation();snapshot('Resize widget');document.body.classList.add('resizing');
    let rect=g.getBoundingClientRect(),gap=9,colW=(rect.width-gap*11)/12,rowH=79,startX=e.clientX,startY=e.clientY,start={...dim};
    const move=ev=>{let cols=Math.max(2,Math.min(12,Math.round(start.cols+(ev.clientX-startX)/(colW+gap))));let rows=Math.max(2,Math.min(9,Math.round(start.rows+(ev.clientY-startY)/rowH)));el.style.setProperty('--cols',cols);el.style.setProperty('--rows',rows);dash.dims[id]={cols,rows}};
    const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.body.classList.remove('resizing');persist();renderDashboard();toastMsg('Widget resized')};
    document.addEventListener('pointermove',move);document.addEventListener('pointerup',up)
  };
  el.addEventListener('dragstart',()=>dragWidget=el);el.addEventListener('dragover',e=>{if(edit)e.preventDefault()});
  el.addEventListener('drop',e=>{if(!edit||!dragWidget||dragWidget===el)return;e.preventDefault();snapshot('Move widget');let a=dash.order.indexOf(dragWidget.dataset.id),b=dash.order.indexOf(id);dash.order.splice(a,1);dash.order.splice(b,0,dragWidget.dataset.id);persist();renderDashboard();toastMsg('Widget moved')})
 });
 renderDashTasks();renderDashWorkTasks();renderDashCalendar();renderDashSchedule();updateSummary();updateLiveClock();renderUpcomingReal()
}
function hideWidget(id){snapshot('Hide widget');if(!dash.hidden.includes(id))dash.hidden.push(id);persist();renderDashboard();toastMsg('Widget hidden',true)}
function popWidget(id){
 let w=widgets.find(x=>x.id===id);if(!w)return;
 let displayTitle=dash.names[id]||w.title;
 let win=window.open('','DOMOS_'+id,'popup=yes,width=720,height=620,resizable=yes,scrollbars=yes');
 if(!win){toastMsg('Pop-up blocked by browser',false);return}
 let styles=[...document.querySelectorAll('style')].map(s=>s.textContent).join('\n');
 win.document.open();win.document.write(`<!doctype html><html><head><title>DOM.OS · ${esc(displayTitle)}</title><style>${styles}
/* V4.3 quick scratchpad + widget renaming */
.quicknote{position:absolute;left:330px;right:205px;top:14px;height:116px;border:1px solid transparent;border-radius:12px;padding:10px 12px;transition:.2s;background:#07100c40}
.quicknote:hover,.quicknote:focus-within{background:#08130ecc;border-color:#21382d;backdrop-filter:blur(5px)}
.quicknote-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;opacity:.8}.quicknote-top b{font-size:11px;color:#9eaea5}.quicknote textarea{width:100%;height:76px;resize:none;border:0;outline:0;background:transparent;color:#dce8e1;font:12px/1.45 Inter,ui-sans-serif,system-ui;overflow:auto}.quicknote textarea::placeholder{color:#617168}.quicknote .note-actions{opacity:0;transition:.15s}.quicknote:hover .note-actions,.quicknote:focus-within .note-actions{opacity:1}.note-mini{border:0;background:transparent;color:#819289;padding:2px 5px}
.rename-modal{display:none;position:fixed;inset:0;background:#0009;z-index:60;place-items:center}.rename-modal.show{display:grid}.rename-box{width:min(420px,90vw);background:#0c1611;border:1px solid #2b4035;border-radius:14px;padding:18px}.rename-box input{width:100%;background:#07100c;border:1px solid #293d32;color:#fff;border-radius:8px;padding:10px;margin:10px 0 14px}
@media(max-width:1000px){.quicknote{left:260px;right:180px}}@media(max-width:760px){.quicknote{display:none}}


/* V4.4 interactive dashboard calendar + schedule */
.dash-cal-toolbar{display:flex;align-items:center;justify-content:space-between;padding:7px 9px;border-bottom:1px solid #17241e}
.dash-cal-toolbar b{font-size:11px}.dash-cal-toolbar button{border:1px solid #24372d;background:#0b1611;color:#9dadA4;border-radius:6px;width:25px;height:25px}
.dash-month{padding:7px}.dash-month-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center;font-size:9px}
.dash-month-grid .dow{color:#607168;padding:3px}.dash-date{padding:5px 2px;border-radius:5px;cursor:pointer;min-height:24px;position:relative}
.dash-date:hover{background:#16261e}.dash-date.other{opacity:.3}.dash-date.selected{background:var(--g);color:#062416;font-weight:800}.dash-date.has-items:after{content:"";width:3px;height:3px;border-radius:50%;background:var(--blue);position:absolute;bottom:2px;left:50%;transform:translateX(-50%)}.dash-date.selected:after{background:#083d26}
.schedule-date{font-size:10px;color:#8da097}.schedule-list{padding:7px 9px}.schedule-item{display:grid;grid-template-columns:44px 3px 1fr;gap:7px;align-items:stretch;margin:5px 0;min-height:32px}.schedule-item .stime{font-size:9px;color:#718078;padding-top:4px}.schedule-item .line{border-radius:5px;background:var(--g)}.schedule-item.taskitem .line{background:var(--blue)}.schedule-item .sbody{background:#101b16;border-radius:6px;padding:5px 7px;font-size:10px}.schedule-empty{padding:25px 10px;text-align:center;color:#65766d;font-size:10px}


/* V4.5 Quick Note behaves like a dashboard widget */
.quicknote{min-width:220px;min-height:72px}
.quicknote .quick-more{border:0;background:transparent;color:#83928a;font-size:16px;padding:2px 6px;border-radius:6px}.quicknote .quick-more:hover{background:#16241d;color:#fff}
.quicknote-menu{display:none;position:absolute;right:8px;top:32px;width:185px;background:#0b1511;border:1px solid #2b4035;border-radius:10px;padding:5px;z-index:20;box-shadow:0 18px 45px #000b}.quicknote-menu.show{display:block}.quicknote-menu button{width:100%;text-align:left;border:0;background:transparent;color:#c9d4ce;padding:9px;border-radius:7px}.quicknote-menu button:hover{background:#14231b}.quicknote-resize{position:absolute;right:3px;bottom:3px;width:16px;height:16px;cursor:nwse-resize;opacity:0}.quicknote:hover .quicknote-resize,.quicknote:focus-within .quicknote-resize{opacity:1}.quicknote-resize:after{content:"";position:absolute;right:3px;bottom:3px;width:7px;height:7px;border-right:2px solid #547064;border-bottom:2px solid #547064}
.quicknote-hidden{display:none!important}


/* V4.7 DOM.OS branding + profile weather */
.logo.dommark{position:relative;background:transparent!important;box-shadow:none!important;border:2px solid #e8efeb;border-radius:50%;overflow:visible}
.logo.dommark:before{content:"";position:absolute;left:5px;top:4px;width:8px;height:13px;border-left:4px solid #eef4f0;border-top:4px solid #eef4f0;border-bottom:4px solid #eef4f0;transform:skewY(-1deg)}
.logo.dommark:after{content:"";position:absolute;right:-2px;top:5px;width:12px;height:12px;border-right:5px solid #55b77f;border-top:5px solid #55b77f;transform:rotate(45deg)}
.weather-pill{position:absolute;right:25px;bottom:15px;display:flex;align-items:center;gap:9px;background:#07110dcc;border:1px solid #1d3328;border-radius:12px;padding:7px 11px;backdrop-filter:blur(8px);min-width:148px}
.weather-pill b{display:block;font-size:14px}.weather-pill small{display:block;color:#83958b;font-size:9px;line-height:1.25}
.weather-art{width:38px;height:34px;position:relative;overflow:hidden}.sun-core{position:absolute;width:18px;height:18px;border-radius:50%;background:#ffd94d;left:4px;top:3px;box-shadow:0 0 15px #ffd94d80;animation:sunPulse 2.8s ease-in-out infinite}
.sun-core:after{content:"";position:absolute;inset:-7px;border:1px dashed #ffd94d88;border-radius:50%;animation:spin 9s linear infinite}
.cloud-shape{display:none;position:absolute;width:26px;height:10px;border-radius:10px;background:#b8c5bf;left:8px;top:14px;animation:cloudFloat 2.6s ease-in-out infinite}.cloud-shape:before,.cloud-shape:after{content:"";position:absolute;border-radius:50%;background:inherit}.cloud-shape:before{width:12px;height:12px;left:4px;top:-6px}.cloud-shape:after{width:9px;height:9px;right:4px;top:-4px}
.rain{display:none;position:absolute;width:1px;height:8px;background:#74bfff;top:25px;animation:rainDrop .75s linear infinite}.r1{left:13px}.r2{left:21px;animation-delay:.25s}.r3{left:29px;animation-delay:.5s}
.weather-art.cloudy .cloud-shape,.weather-art.rainy .cloud-shape,.weather-art.snowy .cloud-shape{display:block}.weather-art.cloudy .sun-core,.weather-art.rainy .sun-core,.weather-art.snowy .sun-core{opacity:.45}.weather-art.rainy .rain{display:block}.weather-art.snowy .rain{display:block;height:3px;width:3px;border-radius:50%;background:#fff;animation-duration:1.2s}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes sunPulse{50%{transform:scale(1.08);box-shadow:0 0 22px #ffd94da0}}@keyframes cloudFloat{50%{transform:translateX(2px)}}@keyframes rainDrop{0%{transform:translateY(-5px);opacity:0}30%{opacity:1}100%{transform:translateY(8px);opacity:0}}


/* V4.8 — accurate branding direction + greeting weather only */
.dom-brand{gap:10px!important}
.dom-logo{width:31px;height:27px;position:relative;display:inline-block;flex:0 0 31px}
.dom-d{position:absolute;inset:1px 0 1px 2px;border-radius:0 15px 15px 0;background:linear-gradient(135deg,#f1f2f1 0%,#cfd3d0 48%,#6d9f80 100%);clip-path:polygon(0 0,55% 0,76% 8%,92% 26%,100% 50%,92% 73%,76% 91%,55% 100%,0 100%,31% 68%,55% 68%,67% 61%,72% 50%,67% 39%,55% 32%,31% 32%)}
.dom-cut{position:absolute;left:1px;top:8px;width:13px;height:13px;background:linear-gradient(135deg,#f4f5f4,#a9b0ac);clip-path:polygon(0 0,100% 50%,0 100%)}
.dom-word{font-size:20px!important;letter-spacing:1px;font-weight:650!important;color:#eef1ef}.dom-word span{color:#cfd4d1}.dom-word em{font-style:normal;color:#6eaa82}
.greeting{display:flex;align-items:center;gap:12px}
.greeting-weather{width:34px;height:34px;position:relative;display:inline-block;flex:0 0 34px}
.gw-sun{position:absolute;width:21px;height:21px;left:6px;top:6px;border-radius:50%;background:#ffd52f;box-shadow:0 0 15px #ffd52f66;animation:gwPulse 2.5s ease-in-out infinite}
.gw-sun:after{content:"";position:absolute;inset:-6px;border:2px dashed #ffd52f;border-radius:50%;animation:gwSpin 10s linear infinite}
.gw-cloud{display:none;position:absolute;left:8px;top:14px;width:25px;height:11px;border-radius:12px;background:#bac5c0;box-shadow:0 2px 5px #0004;animation:gwCloud 2.8s ease-in-out infinite}
.gw-cloud:before,.gw-cloud:after{content:"";position:absolute;background:inherit;border-radius:50%}.gw-cloud:before{width:13px;height:13px;left:4px;top:-7px}.gw-cloud:after{width:10px;height:10px;right:4px;top:-5px}
.gw-rain,.gw-snow{display:none;position:absolute;z-index:3}
.greeting-weather.partly .gw-cloud,.greeting-weather.cloudy .gw-cloud,.greeting-weather.rainy .gw-cloud,.greeting-weather.snowy .gw-cloud{display:block}
.greeting-weather.partly .gw-sun{left:2px;top:3px;transform:scale(.8)}
.greeting-weather.cloudy .gw-sun,.greeting-weather.rainy .gw-sun,.greeting-weather.snowy .gw-sun{display:none}
.greeting-weather.rainy .gw-rain{display:block;width:2px;height:8px;top:25px;background:#69baff;border-radius:2px;animation:gwRain .7s linear infinite}
.gw-rain.a{left:12px}.gw-rain.b{left:20px;animation-delay:.2s!important}.gw-rain.c{left:28px;animation-delay:.4s!important}
.greeting-weather.snowy .gw-snow{display:block;width:4px;height:4px;top:25px;background:#fff;border-radius:50%;animation:gwSnow 1.35s linear infinite}
.gw-snow.s1{left:12px}.gw-snow.s2{left:20px;animation-delay:.35s!important}.gw-snow.s3{left:28px;animation-delay:.7s!important}
@keyframes gwSpin{to{transform:rotate(360deg)}}@keyframes gwPulse{50%{transform:scale(1.08);box-shadow:0 0 21px #ffd52f99}}@keyframes gwCloud{50%{transform:translateX(2px)}}@keyframes gwRain{0%{transform:translateY(-3px);opacity:0}25%{opacity:1}100%{transform:translateY(7px);opacity:0}}@keyframes gwSnow{0%{transform:translate(0,-2px);opacity:0}25%{opacity:1}100%{transform:translate(3px,7px);opacity:0}}


/* DOM.OS V5 — Routine Builder */
.routine-layout{display:grid;grid-template-columns:1fr 330px;gap:10px}
.routine-list{padding:9px;min-height:500px}.routine-card{background:#101b16;border:1px solid #203229;border-radius:11px;margin:8px 0;overflow:hidden}
.routine-card.paused{opacity:.55}.routine-main{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;padding:12px;cursor:pointer}.routine-main:hover{background:#132019}
.routine-icon{width:32px;height:32px;border-radius:9px;background:#173524;display:grid;place-items:center;font-size:16px}.routine-meta{font-size:10px;color:#7f9087;margin-top:3px}.routine-actions{display:flex;gap:5px}
.routine-actions button{border:1px solid #26392f;background:#0b1511;color:#9eada5;border-radius:6px;padding:5px 7px}.routine-steps-preview{border-top:1px solid #1b2a22;padding:8px 12px 11px;display:none}.routine-card.open .routine-steps-preview{display:block}
.step-preview{display:flex;gap:8px;align-items:center;padding:5px 0;color:#aebbb4;font-size:10px}.step-preview i{width:16px;height:16px;border:1px solid #4c5d54;border-radius:4px}
.week-strip{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;padding:10px}.week-day{background:#0c1611;border:1px solid #1d2e25;border-radius:8px;padding:9px 4px;text-align:center;font-size:9px;color:#6e7f76}.week-day.on{background:#123b29;border-color:#2a6546;color:#c8f7dc}
.routine-side-section{padding:12px;border-bottom:1px solid #18251f}.routine-stat{display:flex;justify-content:space-between;margin:8px 0}.routine-empty{padding:60px 20px;text-align:center;color:#6f8077}
.routine-modal{display:none;position:fixed;inset:0;background:#000b;z-index:70;place-items:center;padding:20px}.routine-modal.show{display:grid}.routine-builder{width:min(760px,96vw);max-height:92vh;overflow:auto;background:#0b1511;border:1px solid #2b4035;border-radius:16px;box-shadow:0 30px 90px #000;padding:18px}
.builder-head{display:flex;justify-content:space-between;align-items:center}.builder-head h2{margin:0}.day-picks{display:flex;gap:5px;flex-wrap:wrap}.day-pick{border:1px solid #2a3c32;background:#0a130f;color:#819188;border-radius:7px;padding:7px 9px}.day-pick.on{background:#123b29;color:#d8f9e6;border-color:#347452}
.step-list{margin:8px 0}.step-row{display:grid;grid-template-columns:24px 1fr 90px 34px;gap:7px;align-items:center;padding:6px;border:1px solid #1d2e25;border-radius:8px;margin:5px 0;background:#0d1812}.step-grab{cursor:grab;color:#6e8177;text-align:center}.step-row input{background:#07100c;border:1px solid #26382f;color:#fff;border-radius:6px;padding:8px;width:100%}.step-row button{border:0;background:transparent;color:#a9787e}
.routine-cal{background:#182b21!important;border-left-color:#71dc9d!important}.routine-cal:before{content:"↻ ";color:#72e4a2}.routine-badge{background:#173524;color:#87eab0}
.today-routine{border-left:2px solid #63db95}.routine-complete{height:4px;background:#26352e;border-radius:5px;overflow:hidden;margin-top:5px}.routine-complete i{display:block;height:100%;background:var(--g)}
@media(max-width:1000px){.routine-layout{grid-template-columns:1fr}}


/* DOM.OS V5.2 — Finances, Goals & Notes */
.v52-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:10px}.v52-main{grid-column:span 8}.v52-side{grid-column:span 4}
.v52-pad{padding:12px}.v52-toolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.money-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px}.money-stat{background:#0d1812;border:1px solid #1d2d25;border-radius:10px;padding:12px}.money-stat span{display:block;color:#788a80;font-size:9px;text-transform:uppercase;letter-spacing:.5px}.money-stat b{font-size:19px;display:block;margin-top:4px}
.money-table{width:100%;border-collapse:collapse;font-size:10px}.money-table th{text-align:left;color:#718278;font-weight:500;padding:8px;border-bottom:1px solid #1d2c24}.money-table td{padding:9px 8px;border-bottom:1px solid #15231c}.money-table tr:hover td{background:#101c16}.money-pos{color:#79dfa4}.money-neg{color:#ee8b91}
.goal-card{background:#0e1913;border:1px solid #1e3027;border-radius:11px;padding:12px;margin:8px 0}.goal-top{display:flex;justify-content:space-between;gap:10px}.goal-progress{height:6px;background:#223129;border-radius:8px;overflow:hidden;margin:10px 0 5px}.goal-progress i{height:100%;display:block;background:var(--g);border-radius:8px}.goal-meta{display:flex;justify-content:space-between;color:#778980;font-size:9px}
.notes-layout{display:grid;grid-template-columns:260px 1fr;gap:10px}.notes-list{min-height:520px}.note-row{padding:11px;border-bottom:1px solid #19271f;cursor:pointer}.note-row:hover,.note-row.active{background:#112019}.note-row b{display:block}.note-row small{color:#6f8177}.note-editor{padding:14px;min-height:520px}.note-title{width:100%;font-size:20px;font-weight:700;background:transparent;border:0;border-bottom:1px solid #203129;color:#edf4f0;padding:7px 0;outline:0}.note-body{width:100%;height:390px;resize:vertical;margin-top:12px;background:transparent;border:0;color:#b9c7c0;outline:0;font:12px/1.6 Inter,ui-sans-serif,system-ui}
.v52-modal{display:none;position:fixed;inset:0;background:#000b;z-index:80;place-items:center;padding:20px}.v52-modal.show{display:grid}.v52-box{width:min(520px,95vw);background:#0b1511;border:1px solid #2b4035;border-radius:15px;padding:18px}.v52-box h2{margin-top:0}
.empty-state{text-align:center;color:#6e8076;padding:50px 15px}.tag-pill{display:inline-block;padding:3px 6px;border-radius:6px;background:#173324;color:#7edca5;font-size:9px}
@media(max-width:900px){.v52-main,.v52-side{grid-column:span 12}.notes-layout{grid-template-columns:1fr}.notes-list{min-height:auto}.money-summary{grid-template-columns:1fr}}


/* V5.3 flexible routine timing */
.step-row{grid-template-columns:24px minmax(150px,1fr) 130px minmax(145px,1fr) 34px!important}
.step-timing{display:flex;gap:5px;align-items:center}.step-timing input{min-width:0}
.routine-anchor{font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:#76d99f;background:#143424;border-radius:5px;padding:2px 5px;margin-left:6px}
@media(max-width:760px){.step-row{grid-template-columns:22px 1fr 34px!important}.step-row .rs-mode,.step-row .step-timing{grid-column:2}}


/* V5.4.1 — Today routine checklist + separate Work Tasks */
.today-routine-list,.work-task-list{padding:4px 8px}
.task.done{opacity:.58}.task.done .tasktxt b{text-decoration:line-through;color:#708078}


/* V5.4.2 — refined Today completion controls */
.today-routine-list .task{
  min-height:36px;
  display:grid;
  grid-template-columns:24px minmax(0,1fr) auto;
  align-items:center;
  gap:8px;
}
.today-routine-list .routine-check{
  width:18px!important;
  height:18px!important;
  min-width:18px!important;
  padding:0!important;
  margin:0!important;
  display:grid!important;
  place-items:center!important;
  align-self:center;
  justify-self:center;
  border:1px solid #52635a!important;
  border-radius:5px!important;
  background:#0b1511!important;
  box-shadow:inset 0 0 0 1px #0a110e;
  cursor:pointer;
  transition:background .14s ease,border-color .14s ease,transform .14s ease;
}
.today-routine-list .routine-check:hover{
  border-color:#6fd89a!important;
  background:#10251a!important;
  transform:scale(1.06);
}
.today-routine-list .routine-check span{
  width:6px;
  height:10px;
  display:block;
  border-right:2px solid transparent;
  border-bottom:2px solid transparent;
  transform:rotate(45deg) translate(-1px,-1px);
}
.today-routine-list .task.completing{
  animation:domRoutineDone .24s ease forwards;
  pointer-events:none;
}
.today-routine-list .task.completing .routine-check{
  background:#2fbf71!important;
  border-color:#2fbf71!important;
}
.today-routine-list .task.completing .routine-check span{
  border-color:#06120b;
}
.routine-finished{
  min-height:150px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  text-align:center;
  color:#9aaba2;
  gap:5px;
}
.routine-finished .finish-mark{
  width:30px;height:30px;border-radius:50%;
  display:grid;place-items:center;
  background:#153a27;border:1px solid #2f6e4b;color:#75e3a4;
  margin-bottom:4px;
}
.routine-finished b{color:#dce7e1;font-size:12px}
.routine-finished small{color:#65776d;font-size:9px}
@keyframes domRoutineDone{
  0%{opacity:1;transform:translateX(0);max-height:50px}
  70%{opacity:0;transform:translateX(8px);max-height:50px}
  100%{opacity:0;transform:translateX(8px);max-height:0;min-height:0;padding-top:0;padding-bottom:0;margin:0;border-width:0}
}


/* V5.4.3 connected dashboard summary cards */
#availableSpendMetric{font-variant-numeric:tabular-nums}

</style></head><body class="popout-shell"><div class="card"><div class="head"><h3>${esc(displayTitle)}</h3><span class="muted">DOM.OS Pop-Out</span></div>${w.body()}</div>
</body></html>`);win.document.close();
 toastMsg(`${displayTitle} popped out`,false)
}
document.addEventListener('click',e=>{if(!e.target.closest('.morebtn')&&!e.target.closest('.widget-menu'))$$('.widget-menu').forEach(m=>m.classList.remove('show'))});

function dashISO(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function renderDashCalendar(){
 let host=document.getElementById('dashCalendar');if(!host)return;
 let y=dashCalView.year,m=dashCalView.month;
 let label=new Date(y,m,1).toLocaleString('en-GB',{month:'long',year:'numeric'});
 let first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate(),prevDays=new Date(y,m,0).getDate();
 let cells='';
 for(let i=0;i<42;i++){
   let d,cm=m,cy=y,other=false;
   if(i<first){d=prevDays-first+i+1;cm=m-1;if(cm<0){cm=11;cy--}other=true}
   else if(i>=first+days){d=i-first-days+1;cm=m+1;if(cm>11){cm=0;cy++}other=true}
   else d=i-first+1;
   let date=dashISO(cy,cm,d),has=events.some(e=>e.date===date)||tasks.some(t=>t.date===date&&t.status!=='completed');
   cells+=`<div class="dash-date ${other?'other':''} ${date===dashSelectedDate?'selected':''} ${has?'has-items':''}" data-dashdate="${date}">${d}</div>`;
 }
 host.innerHTML=`<div class="dash-cal-toolbar"><button id="dashPrevMonth">‹</button><b>${label}</b><button id="dashNextMonth">›</button></div><div class="dash-month"><div class="dash-month-grid">${['M','T','W','T','F','S','S'].map(x=>`<div class="dow">${x}</div>`).join('')}${cells}</div></div>`;
 document.getElementById('dashPrevMonth').onclick=e=>{e.stopPropagation();m--;if(m<0){m=11;y--}dashCalView={year:y,month:m};store.set('dashCalView',dashCalView);renderDashCalendar()};
 document.getElementById('dashNextMonth').onclick=e=>{e.stopPropagation();m++;if(m>11){m=0;y++}dashCalView={year:y,month:m};store.set('dashCalView',dashCalView);renderDashCalendar()};
 host.querySelectorAll('[data-dashdate]').forEach(el=>el.onclick=e=>{
   e.stopPropagation();dashSelectedDate=el.dataset.dashdate;store.set('dashSelectedDate',dashSelectedDate);
   let dt=new Date(dashSelectedDate+'T12:00:00');dashCalView={year:dt.getFullYear(),month:dt.getMonth()};store.set('dashCalView',dashCalView);
   renderDashCalendar();renderDashSchedule();
 });
}
function renderDashSchedule(){
 let host=document.getElementById('dashSchedule');if(!host)return;
 let date=new Date(dashSelectedDate+'T12:00:00');
 let label=date.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
 let items=[
   ...events.filter(e=>e.date===dashSelectedDate).map(e=>({id:e.id,title:e.title,time:e.time||'',kind:'event'})),
   ...tasks.filter(t=>t.date===dashSelectedDate&&t.status!=='completed').map(t=>({id:t.id,title:t.title,time:t.time||'',kind:'task'})),
   ...getRoutineOccurrences(dashSelectedDate).map(r=>({id:r.id,title:r.name,time:r.time||'',kind:'routine'}))
 ].sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
 host.innerHTML=`<div class="dash-cal-toolbar"><span class="schedule-date">${label}</span><button id="dashOpenFullCal" title="Open full calendar">↗</button></div>`+
 (items.length?`<div class="schedule-list">${items.map(x=>`<div class="schedule-item ${x.kind==='task'?'taskitem':x.kind==='routine'?'today-routine':''}" data-kind="${x.kind}" data-id="${x.id}"><span class="stime">${x.time||'All day'}</span><i class="line"></i><div class="sbody">${esc(x.title)}</div></div>`).join('')}</div>`:`<div class="schedule-empty">Nothing scheduled for this date.</div>`);
 document.getElementById('dashOpenFullCal').onclick=e=>{e.stopPropagation();let dt=new Date(dashSelectedDate+'T12:00:00');viewDate=new Date(dt.getFullYear(),dt.getMonth(),1);showPage('calendar')};
 host.querySelectorAll('.schedule-item').forEach(el=>el.onclick=e=>{e.stopPropagation();el.dataset.kind==='task'?openTask(el.dataset.id):el.dataset.kind==='routine'?openRoutine(el.dataset.id):openEvent(el.dataset.id)});
}

function renderDashWorkTasks(){
 const card=document.querySelector('[data-id="tasks"]');
 if(!card)return;
 let box=card.querySelector('.work-task-list');
 if(!box){
   const old=card.querySelector('.body')||card.querySelector('.list');
   if(old){old.classList.add('work-task-list');box=old}
 }
 if(!box)return;
 const date=localTodayISO();
 const list=tasks.filter(t=>t.status!=='completed'&&(t.date===date||t.status==='today'));
 box.innerHTML=list.length?list.map(t=>`<div class="task" data-wtask="${t.id}">
   <button class="check" type="button"></button>
   <div class="tasktxt"><b>${esc(t.title)}</b><small>${t.time||''}</small></div>
 </div>`).join(''):'<div class="empty-state" style="padding:24px 10px"><b>No work tasks today</b><p>Add them from Work Tasks.</p></div>';
 box.querySelectorAll('[data-wtask]').forEach(row=>{
   row.querySelector('.check').onclick=e=>{
     e.stopPropagation();
     const t=tasks.find(x=>x.id===row.dataset.wtask);
     if(!t)return;
     t.status='completed';
     store.set('tasks',tasks);
     renderDashWorkTasks();renderTasks();
   };
   row.onclick=()=>openTask(row.dataset.wtask);
 });
}
function renderDashTasks(){
 const box=document.querySelector('.today-routine-list');
 if(!box)return;
 const date=localTodayISO();
 const rows=[];
 getRoutineOccurrences(date).forEach(r=>{
   (r.steps||[]).forEach((s,i)=>{
     const key=date+'|'+r.id+'|'+i;
     let timing='';
     if(s.mode==='exact') timing=s.exact||'';
     else if(s.mode==='window') timing=(s.from||'…')+'–'+(s.to||'…');
     else if(s.mode==='duration'&&s.minutes) timing=s.minutes+' min';
     if(!routineChecks[key]) rows.push({key,name:s.name,timing,done:false});
   });
 });
 if(!rows.length){
   const hasRoutine=getRoutineOccurrences(date).some(r=>(r.steps||[]).length);
   box.innerHTML=hasRoutine
    ? '<div class="routine-finished"><span class="finish-mark">✓</span><b>All done for today</b><small>Your routine will reset tomorrow.</small></div>'
    : '<div class="empty-state" style="padding:24px 10px"><b>No routine steps today</b><p>Your active routine will appear here.</p></div>';
   return;
 }
 box.innerHTML=rows.map(x=>`<div class="task ${x.done?'done':''}" data-rcheck="${x.key}">
   <button class="check routine-check" type="button" aria-label="Complete ${esc(x.name)}"><span></span></button>
   <div class="tasktxt"><b>${esc(x.name)}</b></div>
   <span class="muted">${x.timing}</span>
 </div>`).join('');
 box.querySelectorAll('[data-rcheck]').forEach(row=>{
   row.querySelector('.check').onclick=()=>{
     const key=row.dataset.rcheck;
     routineChecks[key]=true;
     store.set('routineChecks',routineChecks);
     row.classList.add('completing');
     updateSummary();
     setTimeout(()=>renderDashTasks(),220);
   };
 });
}
function updateSummary(){
 const today=localTodayISO();

 // TODAY / ROUTINE — same source as the Today widget.
 let routineKeys=[];
 getRoutineOccurrences(today).forEach(r=>(r.steps||[]).forEach((s,i)=>routineKeys.push(today+'|'+r.id+'|'+i)));
 const routineDone=routineKeys.filter(k=>routineChecks[k]).length;
 const routineRemaining=routineKeys.length-routineDone;
 const routinePct=routineKeys.length?Math.round(routineDone/routineKeys.length*100):0;

 // Main daily progress ring now reflects the same daily routine checklist.
 const count=document.getElementById('count');
 if(count)count.textContent=`${routineDone} / ${routineKeys.length} complete`;
 const ring=document.getElementById('ring');
 if(ring){ring.style.setProperty('--p',routinePct);ring.dataset.v=routinePct+'%'}

 // FINANCES — current manual balance is the amount available until next payday.
 const totals=financeTotals();
 const available=document.getElementById('availableSpendMetric');
 if(available)available.textContent=money(totals.balance);
 const pi=nextPaydayInfo();
 const pay=document.getElementById('paydaySummary');
 if(pay)pay.textContent=`Available · ${pi.days} day${pi.days===1?'':'s'} to payday`;

 // NEXT UP — unfinished routine steps first, then work tasks/events.
 let routineNext=[];
 getRoutineOccurrences(today).forEach(r=>(r.steps||[]).forEach((s,i)=>{
   const key=today+'|'+r.id+'|'+i;
   if(!routineChecks[key])routineNext.push({
     title:s.name,
     time:s.mode==='exact'?(s.exact||''):s.mode==='window'?(s.from||''):'',
     kind:'Routine',
     order:i
   });
 }));
 let candidates=[
   ...routineNext,
   ...tasks.filter(t=>t.date===today&&t.status!=='completed').map(t=>({title:t.title,time:t.time||'',kind:'Work Task',order:999})),
   ...events.filter(e=>e.date===today).map(e=>({title:e.title,time:e.time||'',kind:'Event',order:999}))
 ].sort((a,b)=>((a.time||'99:99').localeCompare(b.time||'99:99'))||((a.order||0)-(b.order||0)));
 let next=candidates[0],el=document.getElementById('nextUpText');
 if(el)el.textContent=next?`${next.title}${next.time?' · '+next.time:''}`:'Nothing else scheduled today';
}
function toggleEdit(v=!edit){edit=v;document.body.classList.toggle('edit',v);$('#editbar').classList.toggle('show',v);$('#editBtn').textContent=v?'✦ Editing':'⚙ Edit Layout';renderDashboard()}
$('#editBtn').onclick=()=>toggleEdit();$('#libBtn').onclick=()=>{library.classList.add('show');renderLibrary()}
function renderLibrary(){libGrid.innerHTML=(quickNoteState.hidden?`<div class="libitem"><b>${quickNoteState.name||'Quick Note'}</b><p class="muted">Header scratchpad · Hidden</p><button class="btn" onclick="restoreQuickNote()">＋ Add</button></div>`:'')+widgets.map(w=>`<div class="libitem"><b>${w.title}</b><p class="muted">${dash.hidden.includes(w.id)?'Hidden':'On dashboard'}</p><button class="btn ${dash.hidden.includes(w.id)?'':'ghost'}" onclick="restoreWidget('${w.id}')">${dash.hidden.includes(w.id)?'＋ Add':'✓ Added'}</button></div>`).join('')}
function restoreWidget(id){if(!dash.hidden.includes(id))return;snapshot('Restore widget');dash.hidden=dash.hidden.filter(x=>x!==id);persist();renderDashboard();renderLibrary();toastMsg('Widget restored',true)}
function resetDashboard(){snapshot('Reset dashboard');dash={order:widgets.map(w=>w.id),hidden:['quick'],sizes:{},dims:{},names:{}};persist();renderDashboard();toastMsg('Dashboard reset',true)}
function renderTasks(){let q=($('#taskSearch')?.value||'').toLowerCase(),pf=$('#priorityFilter')?.value||'';['today','upcoming','completed'].forEach(st=>{let arr=tasks.filter(t=>t.status===st&&t.title.toLowerCase().includes(q)&&(!pf||t.priority===pf));let col=$('#'+st+'Col');if(!col)return;col.innerHTML=arr.map(t=>`<div class="taskcard" draggable="true" data-task="${t.id}" onclick="openTask('${t.id}')"><b>${esc(t.title)}</b><div class="sub">${esc(t.desc||t.description||'')}</div><div class="badges"><span class="badge ${t.priority==='High'?'high':''}">${t.priority}</span>${t.date?`<span class="badge">${t.date} ${t.time||''}</span>`:''}</div></div>`).join('');$('#n'+st[0].toUpperCase()+st.slice(1)).textContent=arr.length+' tasks'});bindTaskDnD()}
function bindTaskDnD(){$$('.taskcard').forEach(c=>c.ondragstart=e=>{e.dataTransfer.setData('text/task',c.dataset.task)});$$('.colbody').forEach(c=>{c.ondragover=e=>{e.preventDefault();c.classList.add('dropover')};c.ondragleave=()=>c.classList.remove('dropover');c.ondrop=e=>{e.preventDefault();c.classList.remove('dropover');let id=e.dataTransfer.getData('text/task'),t=tasks.find(x=>x.id===id);if(!t)return;snapshot('Move task');t.status=c.parentElement.dataset.status;if(t.status==='completed')t.completedAt=Date.now();persist();renderAll();toastMsg(`Task moved to ${t.status}`)}})}
$('#taskSearch').oninput=renderTasks;$('#priorityFilter').onchange=renderTasks;
function openTask(id){let t=tasks.find(x=>x.id===id);if(!t)return;drawerTitle.textContent='Edit Task';drawerBody.innerHTML=`<div class="field"><label>Title</label><input id="fTitle" value="${esc(t.title)}"></div><div class="field"><label>Description</label><textarea id="fDesc">${esc(t.desc||t.description||'')}</textarea></div><div class="row"><div class="field"><label>Due date</label><input id="fDate" type="date" value="${t.date||''}"></div><div class="field"><label>Time</label><input id="fTime" type="time" value="${t.time||''}"></div></div><div class="row"><div class="field"><label>Priority</label><select id="fPri"><option ${t.priority==='Low'?'selected':''}>Low</option><option ${t.priority==='Medium'?'selected':''}>Medium</option><option ${t.priority==='High'?'selected':''}>High</option></select></div><div class="field"><label>Status</label><select id="fStatus"><option value="today" ${t.status==='today'?'selected':''}>Today</option><option value="upcoming" ${t.status==='upcoming'?'selected':''}>Upcoming</option><option value="completed" ${t.status==='completed'?'selected':''}>Completed</option></select></div></div><div class="field"><label>Subtasks (one per line)</label><textarea id="fSubs">${esc((t.subtasks||[]).join('\n'))}</textarea></div><div style="display:flex;gap:8px"><button class="btn" onclick="saveTask('${id}')">Save</button><button class="btn ghost" onclick="duplicateTask('${id}')">Duplicate</button><button class="btn ghost" style="color:#ff8790" onclick="deleteTask('${id}')">Delete</button></div>`;drawer.classList.add('show')}
function newTask(){closeDrawer();let id='t'+crypto.randomUUID();const value={id,title:'New Task',desc:'',date:localTodayISO(),time:'',priority:'Medium',status:'today',subtasks:[]};pendingDraft={kind:'tasks',id,value};tasks.push(value);openTask(id)}
function saveTask(id){if(!validForm([['fTitle','Task title']]))return;let t=tasks.find(x=>x.id===id);snapshot('Edit task');pendingDraft=null;Object.assign(t,{title:fTitle.value,desc:fDesc.value,date:fDate.value,time:fTime.value,priority:fPri.value,status:fStatus.value,subtasks:fSubs.value.split('\n').map(x=>x.trim()).filter(Boolean)});persist();closeDrawer();renderAll();toastMsg('Task saved',true)}
function deleteTask(id){snapshot('Delete task');tasks=tasks.filter(x=>x.id!==id);persist();closeDrawer();renderAll();toastMsg('Task deleted',true)}
function duplicateTask(id){let t=tasks.find(x=>x.id===id);snapshot('Duplicate task');tasks.push({...structuredClone(t),id:'t'+Date.now(),title:t.title+' copy'});persist();closeDrawer();renderAll();toastMsg('Task duplicated',true)}
function toggleTask(id){let t=tasks.find(x=>x.id===id);snapshot('Toggle task');t.status=t.status==='completed'?'today':'completed';persist();renderAll();toastMsg(t.status==='completed'?'Task completed':'Task reopened')}
function closeDrawer(){if(pendingDraft){tasks=tasks.filter(x=>x.id!==pendingDraft.id);events=events.filter(x=>x.id!==pendingDraft.id);calendarTemplates=calendarTemplates.filter(x=>x.id!==pendingDraft.id);pendingDraft=null;renderTasks();renderCalendar()}drawer.classList.remove('show');window.dispatchEvent(new Event('domos-editor-closed'))} function esc(s){return String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
let viewDate=new Date(localTodayISO()+'T12:00:00');
function iso(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function renderCalendar(){let y=viewDate.getFullYear(),m=viewDate.getMonth();calTitle.textContent=viewDate.toLocaleString('en-GB',{month:'long',year:'numeric'});weekHead.innerHTML=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<div class="hd">${x}</div>`).join('');let first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate(),prev=new Date(y,m,0).getDate(),cells=[];for(let i=0;i<42;i++){let d,cm=m,cy=y,dim=false;if(i<first){d=prev-first+i+1;cm=m-1;if(cm<0){cm=11;cy--}dim=true}else if(i>=first+days){d=i-first-days+1;cm=m+1;if(cm>11){cm=0;cy++}dim=true}else d=i-first+1;let date=iso(cy,cm,d);let ev=[...events.filter(e=>e.date===date).map(e=>({...e,kind:'event'})),...tasks.filter(t=>t.date===date&&t.status!=='completed').map(t=>({...t,kind:'task'})),...getRoutineOccurrences(date).map(r=>({id:r.id,title:r.name,time:r.time,kind:'routine'}))];cells.push(`<div class="day ${date===localTodayISO()?'today':''}" data-date="${date}" style="${dim?'opacity:.38':''}"><span class="daynum">${d}</span>${ev.slice(0,4).map(e=>`<div class="calevent ${e.kind==='task'?'taskev':e.kind==='routine'?'routine-cal':''}" draggable="true" data-kind="${e.kind}" data-id="${e.id}">${esc(e.time||'')} ${esc(e.title)}</div>`).join('')}</div>`)}monthGrid.innerHTML=cells.join('');let unscheduledTasks=tasks.filter(t=>!t.date&&t.status!=='completed');
unscheduled.innerHTML=
 `<div class="muted" style="font-size:9px;margin:4px 2px 7px">QUICK TEMPLATES · drag to any date</div>`+
 (calendarTemplates.length?calendarTemplates.map(t=>`<div class="templatecard" draggable="true" data-template="${t.id}"><b>${esc(t.title)}</b><div class="sub">${t.time||'Any time'} · template stays here</div><button class="template-edit" title="Edit template" onclick="event.stopPropagation();openCalendarTemplate('${t.id}')">⋯</button></div>`).join(''):'<p class="muted">No templates yet.</p>')+
 `<div class="muted" style="font-size:9px;margin:16px 2px 7px">WORK TASKS</div>`+
 (unscheduledTasks.length?unscheduledTasks.map(t=>`<div class="taskcard" draggable="true" data-task="${t.id}"><b>${esc(t.title)}</b><div class="sub">${t.priority}</div></div>`).join(''):'<p class="muted">All work tasks are scheduled.</p>');
bindCalendarDnD()}
function bindCalendarDnD(){
 $$('.calevent').forEach(e=>e.ondragstart=x=>{x.stopPropagation();x.dataTransfer.setData('text/cal',JSON.stringify({kind:e.dataset.kind,id:e.dataset.id}))});
 $$('#unscheduled .taskcard').forEach(e=>e.ondragstart=x=>x.dataTransfer.setData('text/task',e.dataset.task));
 $$('#unscheduled .templatecard').forEach(e=>e.ondragstart=x=>x.dataTransfer.setData('text/template',e.dataset.template));
 $$('.day').forEach(d=>{
  d.ondragover=e=>{e.preventDefault();d.classList.add('dropover')};
  d.ondragleave=()=>d.classList.remove('dropover');
  d.ondrop=e=>{
   e.preventDefault();d.classList.remove('dropover');
   let tid=e.dataTransfer.getData('text/task'),cal=e.dataTransfer.getData('text/cal'),templateId=e.dataTransfer.getData('text/template');
   if(templateId){
    let t=calendarTemplates.find(x=>x.id===templateId);if(!t)return;
    snapshot('Create event from template');
    let id='e'+Date.now();
    events.push({id,title:t.title,date:d.dataset.date,time:t.time||'',duration:t.duration||60,type:'event'});
    persist();renderAll();openEvent(id);toastMsg('Event created from template');return;
   }
   snapshot('Reschedule');
   if(tid){let t=tasks.find(x=>x.id===tid);t.date=d.dataset.date;t.status=d.dataset.date===localTodayISO()?'today':'upcoming'}
   else if(cal){let o=JSON.parse(cal);if(o.kind==='routine'){toastMsg('Edit the routine to change its repeating schedule',false);renderAll();return}let a=o.kind==='task'?tasks:events,x=a.find(z=>z.id===o.id);x.date=d.dataset.date;if(o.kind==='task')x.status=d.dataset.date===localTodayISO()?'today':'upcoming'}
   persist();renderAll();toastMsg('Rescheduled')
  }
 })
}
function newCalendarTemplate(){
 closeDrawer();let id='ct'+crypto.randomUUID();const value={id,title:'New Template',time:'',duration:60};pendingDraft={kind:'calendarTemplates',id,value};calendarTemplates.push(value);openCalendarTemplate(id)
}
function openCalendarTemplate(id){
 let t=calendarTemplates.find(x=>x.id===id);if(!t)return;
 drawerTitle.textContent='Edit Calendar Template';
 drawerBody.innerHTML=`<div class="field"><label>Template name</label><input id="ctTitle" value="${esc(t.title)}"></div><div class="row"><div class="field"><label>Default time (optional)</label><input id="ctTime" type="time" value="${t.time||''}"></div><div class="field"><label>Duration (minutes)</label><input id="ctDur" type="number" min="0" value="${t.duration||60}"></div></div><p class="muted">Dragging this template onto a date creates a separate event. The template remains here for reuse.</p><button class="btn" onclick="saveCalendarTemplate('${id}')">Save Template</button> <button class="btn ghost" onclick="deleteCalendarTemplate('${id}')">Delete</button>`;
 drawer.classList.add('show')
}
function saveCalendarTemplate(id){
 let t=calendarTemplates.find(x=>x.id===id);if(!t)return;if(!validForm([['ctTitle','Template name']],[['ctDur','Duration',0]]))return;pendingDraft=null;
 t.title=ctTitle.value.trim()||'Untitled';t.time=ctTime.value;t.duration=Math.max(0,+ctDur.value||0);
 persist();closeDrawer();renderCalendar();toastMsg('Template saved',false)
}
function deleteCalendarTemplate(id){
 calendarTemplates=calendarTemplates.filter(x=>x.id!==id);persist();closeDrawer();renderCalendar();toastMsg('Template deleted',false)
}
prevMonth.onclick=()=>{viewDate.setMonth(viewDate.getMonth()-1);renderCalendar()};nextMonth.onclick=()=>{viewDate.setMonth(viewDate.getMonth()+1);renderCalendar()};todayMonth.onclick=()=>{viewDate=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderCalendar()}
function newEvent(date=localTodayISO()){closeDrawer();let id='e'+crypto.randomUUID();const value={id,title:'New Event',date,time:'12:00',duration:60,type:'event'};pendingDraft={kind:'events',id,value};events.push(value);openEvent(id)}
function openEvent(id){let e=events.find(x=>x.id===id);drawerTitle.textContent='Edit Event';drawerBody.innerHTML=`<div class="field"><label>Title</label><input id="eTitle" value="${esc(e.title)}"></div><div class="row"><div class="field"><label>Date</label><input id="eDate" type="date" value="${e.date}"></div><div class="field"><label>Time</label><input id="eTime" type="time" value="${e.time}"></div></div><div class="field"><label>Duration (minutes)</label><input id="eDur" type="number" value="${e.duration}"></div><button class="btn" onclick="saveEvent('${id}')">Save</button> <button class="btn ghost" onclick="deleteEvent('${id}')">Delete</button>`;drawer.classList.add('show')}
function saveEvent(id){if(!validForm([['eTitle','Event title'],['eDate','Date']],[['eDur','Duration',0]]))return;let e=events.find(x=>x.id===id);snapshot('Edit event');pendingDraft=null;Object.assign(e,{title:eTitle.value,date:eDate.value,time:eTime.value,duration:+eDur.value});persist();closeDrawer();renderAll();toastMsg('Event saved',true)}function deleteEvent(id){snapshot('Delete event');events=events.filter(x=>x.id!==id);persist();closeDrawer();renderAll();toastMsg('Event deleted',true)}
document.addEventListener('dblclick',e=>{let c=e.target.closest('.calevent');if(c&&c.dataset.kind==='event')openEvent(c.dataset.id);if(c&&c.dataset.kind==='task')openTask(c.dataset.id);if(c&&c.dataset.kind==='routine')openRoutine(c.dataset.id)})
const defaults={search:'Ctrl+K',newTask:'Ctrl+T',newEvent:'Ctrl+E',editDash:'Ctrl+Shift+E',undo:'Ctrl+Z',redo:'Ctrl+Shift+Z',escape:'Escape'};
let keys=store.get('keys',{...defaults}),recordKey=null;
function renderKeys(){const hotkeyRows=document.getElementById('hotkeyRows');if(!hotkeyRows)return;let names={search:'Search DOM.OS',newTask:'Quick Add Task',newEvent:'New Calendar Event',editDash:'Edit Dashboard',undo:'Undo',redo:'Redo',escape:'Close / Cancel'};hotkeyRows.innerHTML=Object.entries(names).map(([k,n])=>`<div class="settingrow"><div><b>${n}</b></div><div class="key" data-key="${k}">${keys[k]}</div></div>`).join('');$$('.key').forEach(x=>x.onclick=()=>{recordKey=x.dataset.key;x.textContent='Press shortcut…'})}
resetKeys.onclick=()=>{keys={...defaults};store.set('keys',keys);renderKeys();toastMsg('Shortcuts reset',false)}
function combo(e){let a=[];if(e.ctrlKey||e.metaKey)a.push('Ctrl');if(e.shiftKey)a.push('Shift');if(e.altKey)a.push('Alt');let k=e.key.length===1?e.key.toUpperCase():e.key;if(!['Control','Shift','Alt','Meta'].includes(k))a.push(k);return a.join('+')}
document.addEventListener('keydown',e=>{if(recordKey){e.preventDefault();let c=combo(e);if(!c)return;let conflict=Object.entries(keys).find(([k,v])=>v===c&&k!==recordKey);if(conflict&&!confirm(`${c} is already assigned. Replace it?`))return;if(conflict)keys[conflict[0]]='Disabled';keys[recordKey]=c;recordKey=null;store.set('keys',keys);renderKeys();return}let c=combo(e);if(e.target.closest?.('input,textarea,[contenteditable="true"]')&&(c===keys.undo||c===keys.redo))return;if(c===keys.undo){e.preventDefault();doUndo()}else if(c===keys.redo){e.preventDefault();doRedo()}else if(c===keys.newTask){e.preventDefault();newTask()}else if(c===keys.newEvent){e.preventDefault();newEvent()}else if(c===keys.editDash){e.preventDefault();showPage('dashboard');toggleEdit()}else if(c===keys.search){e.preventDefault();window.DOMOSCommandBar?.open()}else if(c===keys.escape){closeDrawer();closeRoutineBuilder();closeRename();goalModal.classList.remove('show');library.classList.remove('show')}})

let renameId=null;
function openRename(id){renameId=id;let w=widgets.find(x=>x.id===id);renameInput.value=dash.names[id]||w.title;renameModal.classList.add('show');setTimeout(()=>{renameInput.focus();renameInput.select()},20)}
function closeRename(){renameModal.classList.remove('show');renameId=null;window.dispatchEvent(new Event('domos-editor-closed'))}
function saveRename(){if(!renameId)return;let w=widgets.find(x=>x.id===renameId),v=renameInput.value.trim();snapshot('Rename widget');if(!v||v===w.title)delete dash.names[renameId];else dash.names[renameId]=v;persist();closeRename();renderDashboard();toastMsg('Widget renamed',true)}
renameInput.addEventListener('keydown',e=>{if(e.key==='Enter')saveRename();if(e.key==='Escape')closeRename()});
const qn=document.getElementById('quickNote'),qbox=document.getElementById('quickNoteBox');
let quickNoteState=store.get('quickNoteState',{name:'Quick Note',hidden:false,width:null,height:null});
qn.value=store.get('quickNote','');qn.addEventListener('input',()=>store.set('quickNote',qn.value));
function applyQuickNoteState(){quickNoteTitle.textContent=(quickNoteState.name||'Quick Note').toUpperCase();qbox.classList.toggle('quicknote-hidden',!!quickNoteState.hidden);if(quickNoteState.width)qbox.style.width=quickNoteState.width+'px';if(quickNoteState.height){qbox.style.height=quickNoteState.height+'px';qn.style.height=Math.max(36,quickNoteState.height-42)+'px'}}
applyQuickNoteState();
quickNoteMore.onclick=e=>{e.stopPropagation();quickNoteMenu.classList.toggle('show')};
document.addEventListener('click',e=>{if(!e.target.closest('#quickNoteMenu')&&!e.target.closest('#quickNoteMore'))quickNoteMenu.classList.remove('show')});
clearQuickNote.onclick=()=>{quickNoteMenu.classList.remove('show');if(!qn.value)return;qn.value='';store.set('quickNote','');toastMsg('Quick note cleared',false)};
quickRename.onclick=()=>{quickNoteMenu.classList.remove('show');let v=prompt('Rename Quick Note',quickNoteState.name||'Quick Note');if(v&&v.trim()){quickNoteState.name=v.trim();store.set('quickNoteState',quickNoteState);applyQuickNoteState();toastMsg('Quick Note renamed',false)}};
quickHide.onclick=()=>{quickNoteMenu.classList.remove('show');quickNoteState.hidden=true;store.set('quickNoteState',quickNoteState);applyQuickNoteState();toastMsg('Quick Note hidden',false)};
function restoreQuickNote(){quickNoteState.hidden=false;store.set('quickNoteState',quickNoteState);applyQuickNoteState();renderLibrary();toastMsg('Quick Note restored',false)}
quickPop.onclick=()=>{quickNoteMenu.classList.remove('show');let win=window.open('','DOMOS_QuickNote','popup=yes,width=600,height=450,resizable=yes');if(!win){toastMsg('Pop-up blocked by browser',false);return}let styles=[...document.querySelectorAll('style')].map(s=>s.textContent).join('\n'),val=qn.value.replaceAll('&','&amp;').replaceAll('<','&lt;');win.document.write(`<!doctype html><html><head><title>DOM.OS · ${quickNoteState.name}</title><style>${styles}
/* V4.7 DOM.OS branding + profile weather */
.logo.dommark{position:relative;background:transparent!important;box-shadow:none!important;border:2px solid #e8efeb;border-radius:50%;overflow:visible}
.logo.dommark:before{content:"";position:absolute;left:5px;top:4px;width:8px;height:13px;border-left:4px solid #eef4f0;border-top:4px solid #eef4f0;border-bottom:4px solid #eef4f0;transform:skewY(-1deg)}
.logo.dommark:after{content:"";position:absolute;right:-2px;top:5px;width:12px;height:12px;border-right:5px solid #55b77f;border-top:5px solid #55b77f;transform:rotate(45deg)}
.weather-pill{position:absolute;right:25px;bottom:15px;display:flex;align-items:center;gap:9px;background:#07110dcc;border:1px solid #1d3328;border-radius:12px;padding:7px 11px;backdrop-filter:blur(8px);min-width:148px}
.weather-pill b{display:block;font-size:14px}.weather-pill small{display:block;color:#83958b;font-size:9px;line-height:1.25}
.weather-art{width:38px;height:34px;position:relative;overflow:hidden}.sun-core{position:absolute;width:18px;height:18px;border-radius:50%;background:#ffd94d;left:4px;top:3px;box-shadow:0 0 15px #ffd94d80;animation:sunPulse 2.8s ease-in-out infinite}
.sun-core:after{content:"";position:absolute;inset:-7px;border:1px dashed #ffd94d88;border-radius:50%;animation:spin 9s linear infinite}
.cloud-shape{display:none;position:absolute;width:26px;height:10px;border-radius:10px;background:#b8c5bf;left:8px;top:14px;animation:cloudFloat 2.6s ease-in-out infinite}.cloud-shape:before,.cloud-shape:after{content:"";position:absolute;border-radius:50%;background:inherit}.cloud-shape:before{width:12px;height:12px;left:4px;top:-6px}.cloud-shape:after{width:9px;height:9px;right:4px;top:-4px}
.rain{display:none;position:absolute;width:1px;height:8px;background:#74bfff;top:25px;animation:rainDrop .75s linear infinite}.r1{left:13px}.r2{left:21px;animation-delay:.25s}.r3{left:29px;animation-delay:.5s}
.weather-art.cloudy .cloud-shape,.weather-art.rainy .cloud-shape,.weather-art.snowy .cloud-shape{display:block}.weather-art.cloudy .sun-core,.weather-art.rainy .sun-core,.weather-art.snowy .sun-core{opacity:.45}.weather-art.rainy .rain{display:block}.weather-art.snowy .rain{display:block;height:3px;width:3px;border-radius:50%;background:#fff;animation-duration:1.2s}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes sunPulse{50%{transform:scale(1.08);box-shadow:0 0 22px #ffd94da0}}@keyframes cloudFloat{50%{transform:translateX(2px)}}@keyframes rainDrop{0%{transform:translateY(-5px);opacity:0}30%{opacity:1}100%{transform:translateY(8px);opacity:0}}


/* V4.8 — accurate branding direction + greeting weather only */
.dom-brand{gap:10px!important}
.dom-logo{width:31px;height:27px;position:relative;display:inline-block;flex:0 0 31px}
.dom-d{position:absolute;inset:1px 0 1px 2px;border-radius:0 15px 15px 0;background:linear-gradient(135deg,#f1f2f1 0%,#cfd3d0 48%,#6d9f80 100%);clip-path:polygon(0 0,55% 0,76% 8%,92% 26%,100% 50%,92% 73%,76% 91%,55% 100%,0 100%,31% 68%,55% 68%,67% 61%,72% 50%,67% 39%,55% 32%,31% 32%)}
.dom-cut{position:absolute;left:1px;top:8px;width:13px;height:13px;background:linear-gradient(135deg,#f4f5f4,#a9b0ac);clip-path:polygon(0 0,100% 50%,0 100%)}
.dom-word{font-size:20px!important;letter-spacing:1px;font-weight:650!important;color:#eef1ef}.dom-word span{color:#cfd4d1}.dom-word em{font-style:normal;color:#6eaa82}
.greeting{display:flex;align-items:center;gap:12px}
.greeting-weather{width:34px;height:34px;position:relative;display:inline-block;flex:0 0 34px}
.gw-sun{position:absolute;width:21px;height:21px;left:6px;top:6px;border-radius:50%;background:#ffd52f;box-shadow:0 0 15px #ffd52f66;animation:gwPulse 2.5s ease-in-out infinite}
.gw-sun:after{content:"";position:absolute;inset:-6px;border:2px dashed #ffd52f;border-radius:50%;animation:gwSpin 10s linear infinite}
.gw-cloud{display:none;position:absolute;left:8px;top:14px;width:25px;height:11px;border-radius:12px;background:#bac5c0;box-shadow:0 2px 5px #0004;animation:gwCloud 2.8s ease-in-out infinite}
.gw-cloud:before,.gw-cloud:after{content:"";position:absolute;background:inherit;border-radius:50%}.gw-cloud:before{width:13px;height:13px;left:4px;top:-7px}.gw-cloud:after{width:10px;height:10px;right:4px;top:-5px}
.gw-rain,.gw-snow{display:none;position:absolute;z-index:3}
.greeting-weather.partly .gw-cloud,.greeting-weather.cloudy .gw-cloud,.greeting-weather.rainy .gw-cloud,.greeting-weather.snowy .gw-cloud{display:block}
.greeting-weather.partly .gw-sun{left:2px;top:3px;transform:scale(.8)}
.greeting-weather.cloudy .gw-sun,.greeting-weather.rainy .gw-sun,.greeting-weather.snowy .gw-sun{display:none}
.greeting-weather.rainy .gw-rain{display:block;width:2px;height:8px;top:25px;background:#69baff;border-radius:2px;animation:gwRain .7s linear infinite}
.gw-rain.a{left:12px}.gw-rain.b{left:20px;animation-delay:.2s!important}.gw-rain.c{left:28px;animation-delay:.4s!important}
.greeting-weather.snowy .gw-snow{display:block;width:4px;height:4px;top:25px;background:#fff;border-radius:50%;animation:gwSnow 1.35s linear infinite}
.gw-snow.s1{left:12px}.gw-snow.s2{left:20px;animation-delay:.35s!important}.gw-snow.s3{left:28px;animation-delay:.7s!important}
@keyframes gwSpin{to{transform:rotate(360deg)}}@keyframes gwPulse{50%{transform:scale(1.08);box-shadow:0 0 21px #ffd52f99}}@keyframes gwCloud{50%{transform:translateX(2px)}}@keyframes gwRain{0%{transform:translateY(-3px);opacity:0}25%{opacity:1}100%{transform:translateY(7px);opacity:0}}@keyframes gwSnow{0%{transform:translate(0,-2px);opacity:0}25%{opacity:1}100%{transform:translate(3px,7px);opacity:0}}


/* DOM.OS V5 — Routine Builder */
.routine-layout{display:grid;grid-template-columns:1fr 330px;gap:10px}
.routine-list{padding:9px;min-height:500px}.routine-card{background:#101b16;border:1px solid #203229;border-radius:11px;margin:8px 0;overflow:hidden}
.routine-card.paused{opacity:.55}.routine-main{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;padding:12px;cursor:pointer}.routine-main:hover{background:#132019}
.routine-icon{width:32px;height:32px;border-radius:9px;background:#173524;display:grid;place-items:center;font-size:16px}.routine-meta{font-size:10px;color:#7f9087;margin-top:3px}.routine-actions{display:flex;gap:5px}
.routine-actions button{border:1px solid #26392f;background:#0b1511;color:#9eada5;border-radius:6px;padding:5px 7px}.routine-steps-preview{border-top:1px solid #1b2a22;padding:8px 12px 11px;display:none}.routine-card.open .routine-steps-preview{display:block}
.step-preview{display:flex;gap:8px;align-items:center;padding:5px 0;color:#aebbb4;font-size:10px}.step-preview i{width:16px;height:16px;border:1px solid #4c5d54;border-radius:4px}
.week-strip{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;padding:10px}.week-day{background:#0c1611;border:1px solid #1d2e25;border-radius:8px;padding:9px 4px;text-align:center;font-size:9px;color:#6e7f76}.week-day.on{background:#123b29;border-color:#2a6546;color:#c8f7dc}
.routine-side-section{padding:12px;border-bottom:1px solid #18251f}.routine-stat{display:flex;justify-content:space-between;margin:8px 0}.routine-empty{padding:60px 20px;text-align:center;color:#6f8077}
.routine-modal{display:none;position:fixed;inset:0;background:#000b;z-index:70;place-items:center;padding:20px}.routine-modal.show{display:grid}.routine-builder{width:min(760px,96vw);max-height:92vh;overflow:auto;background:#0b1511;border:1px solid #2b4035;border-radius:16px;box-shadow:0 30px 90px #000;padding:18px}
.builder-head{display:flex;justify-content:space-between;align-items:center}.builder-head h2{margin:0}.day-picks{display:flex;gap:5px;flex-wrap:wrap}.day-pick{border:1px solid #2a3c32;background:#0a130f;color:#819188;border-radius:7px;padding:7px 9px}.day-pick.on{background:#123b29;color:#d8f9e6;border-color:#347452}
.step-list{margin:8px 0}.step-row{display:grid;grid-template-columns:24px 1fr 90px 34px;gap:7px;align-items:center;padding:6px;border:1px solid #1d2e25;border-radius:8px;margin:5px 0;background:#0d1812}.step-grab{cursor:grab;color:#6e8177;text-align:center}.step-row input{background:#07100c;border:1px solid #26382f;color:#fff;border-radius:6px;padding:8px;width:100%}.step-row button{border:0;background:transparent;color:#a9787e}
.routine-cal{background:#182b21!important;border-left-color:#71dc9d!important}.routine-cal:before{content:"↻ ";color:#72e4a2}.routine-badge{background:#173524;color:#87eab0}
.today-routine{border-left:2px solid #63db95}.routine-complete{height:4px;background:#26352e;border-radius:5px;overflow:hidden;margin-top:5px}.routine-complete i{display:block;height:100%;background:var(--g)}
@media(max-width:1000px){.routine-layout{grid-template-columns:1fr}}


/* DOM.OS V5.2 — Finances, Goals & Notes */
.v52-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:10px}.v52-main{grid-column:span 8}.v52-side{grid-column:span 4}
.v52-pad{padding:12px}.v52-toolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.money-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px}.money-stat{background:#0d1812;border:1px solid #1d2d25;border-radius:10px;padding:12px}.money-stat span{display:block;color:#788a80;font-size:9px;text-transform:uppercase;letter-spacing:.5px}.money-stat b{font-size:19px;display:block;margin-top:4px}
.money-table{width:100%;border-collapse:collapse;font-size:10px}.money-table th{text-align:left;color:#718278;font-weight:500;padding:8px;border-bottom:1px solid #1d2c24}.money-table td{padding:9px 8px;border-bottom:1px solid #15231c}.money-table tr:hover td{background:#101c16}.money-pos{color:#79dfa4}.money-neg{color:#ee8b91}
.goal-card{background:#0e1913;border:1px solid #1e3027;border-radius:11px;padding:12px;margin:8px 0}.goal-top{display:flex;justify-content:space-between;gap:10px}.goal-progress{height:6px;background:#223129;border-radius:8px;overflow:hidden;margin:10px 0 5px}.goal-progress i{height:100%;display:block;background:var(--g);border-radius:8px}.goal-meta{display:flex;justify-content:space-between;color:#778980;font-size:9px}
.notes-layout{display:grid;grid-template-columns:260px 1fr;gap:10px}.notes-list{min-height:520px}.note-row{padding:11px;border-bottom:1px solid #19271f;cursor:pointer}.note-row:hover,.note-row.active{background:#112019}.note-row b{display:block}.note-row small{color:#6f8177}.note-editor{padding:14px;min-height:520px}.note-title{width:100%;font-size:20px;font-weight:700;background:transparent;border:0;border-bottom:1px solid #203129;color:#edf4f0;padding:7px 0;outline:0}.note-body{width:100%;height:390px;resize:vertical;margin-top:12px;background:transparent;border:0;color:#b9c7c0;outline:0;font:12px/1.6 Inter,ui-sans-serif,system-ui}
.v52-modal{display:none;position:fixed;inset:0;background:#000b;z-index:80;place-items:center;padding:20px}.v52-modal.show{display:grid}.v52-box{width:min(520px,95vw);background:#0b1511;border:1px solid #2b4035;border-radius:15px;padding:18px}.v52-box h2{margin-top:0}
.empty-state{text-align:center;color:#6e8076;padding:50px 15px}.tag-pill{display:inline-block;padding:3px 6px;border-radius:6px;background:#173324;color:#7edca5;font-size:9px}
@media(max-width:900px){.v52-main,.v52-side{grid-column:span 12}.notes-layout{grid-template-columns:1fr}.notes-list{min-height:auto}.money-summary{grid-template-columns:1fr}}


/* V5.3 flexible routine timing */
.step-row{grid-template-columns:24px minmax(150px,1fr) 130px minmax(145px,1fr) 34px!important}
.step-timing{display:flex;gap:5px;align-items:center}.step-timing input{min-width:0}
.routine-anchor{font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:#76d99f;background:#143424;border-radius:5px;padding:2px 5px;margin-left:6px}
@media(max-width:760px){.step-row{grid-template-columns:22px 1fr 34px!important}.step-row .rs-mode,.step-row .step-timing{grid-column:2}}


/* V5.4.1 — Today routine checklist + separate Work Tasks */
.today-routine-list,.work-task-list{padding:4px 8px}
.task.done{opacity:.58}.task.done .tasktxt b{text-decoration:line-through;color:#708078}


/* V5.4.2 — refined Today completion controls */
.today-routine-list .task{
  min-height:36px;
  display:grid;
  grid-template-columns:24px minmax(0,1fr) auto;
  align-items:center;
  gap:8px;
}
.today-routine-list .routine-check{
  width:18px!important;
  height:18px!important;
  min-width:18px!important;
  padding:0!important;
  margin:0!important;
  display:grid!important;
  place-items:center!important;
  align-self:center;
  justify-self:center;
  border:1px solid #52635a!important;
  border-radius:5px!important;
  background:#0b1511!important;
  box-shadow:inset 0 0 0 1px #0a110e;
  cursor:pointer;
  transition:background .14s ease,border-color .14s ease,transform .14s ease;
}
.today-routine-list .routine-check:hover{
  border-color:#6fd89a!important;
  background:#10251a!important;
  transform:scale(1.06);
}
.today-routine-list .routine-check span{
  width:6px;
  height:10px;
  display:block;
  border-right:2px solid transparent;
  border-bottom:2px solid transparent;
  transform:rotate(45deg) translate(-1px,-1px);
}
.today-routine-list .task.completing{
  animation:domRoutineDone .24s ease forwards;
  pointer-events:none;
}
.today-routine-list .task.completing .routine-check{
  background:#2fbf71!important;
  border-color:#2fbf71!important;
}
.today-routine-list .task.completing .routine-check span{
  border-color:#06120b;
}
.routine-finished{
  min-height:150px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  text-align:center;
  color:#9aaba2;
  gap:5px;
}
.routine-finished .finish-mark{
  width:30px;height:30px;border-radius:50%;
  display:grid;place-items:center;
  background:#153a27;border:1px solid #2f6e4b;color:#75e3a4;
  margin-bottom:4px;
}
.routine-finished b{color:#dce7e1;font-size:12px}
.routine-finished small{color:#65776d;font-size:9px}
@keyframes domRoutineDone{
  0%{opacity:1;transform:translateX(0);max-height:50px}
  70%{opacity:0;transform:translateX(8px);max-height:50px}
  100%{opacity:0;transform:translateX(8px);max-height:0;min-height:0;padding-top:0;padding-bottom:0;margin:0;border-width:0}
}


/* V5.4.3 connected dashboard summary cards */
#availableSpendMetric{font-variant-numeric:tabular-nums}

</style></head><body class="popout-shell"><div class="card pad"><h3>${quickNoteState.name}</h3><textarea style="width:100%;height:calc(100vh - 90px);background:#07100c;color:#dce8e1;border:1px solid #26382f;border-radius:8px;padding:12px">${val}</textarea></div></body></html>`);win.document.close();toastMsg('Quick Note popped out',false)};
quickNoteResize.onpointerdown=e=>{e.preventDefault();let r=qbox.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,sw=r.width,sh=r.height;const mv=ev=>{quickNoteState.width=Math.max(220,sw+ev.clientX-sx);quickNoteState.height=Math.max(72,sh+ev.clientY-sy);applyQuickNoteState()};const up=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);store.set('quickNoteState',quickNoteState);toastMsg('Quick Note resized',false)};document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up)};


async function loadProfileWeather(){
 const art=document.getElementById('greetingWeather');if(!art)return;const location=window.DOMOSProfile?.preferences?.location;if(!location||!Number.isFinite(location.latitude)||!Number.isFinite(location.longitude)){art.title='Set a weather location in Profile Settings';return false;}
 const weatherClass=code=>{
   if(code===0)return 'sunny';
   if([1,2].includes(code))return 'partly';
   if([3,45,48].includes(code))return 'cloudy';
   if([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code))return 'rainy';
   if([71,73,75,77,85,86].includes(code))return 'snowy';
   return 'cloudy';
 };
 const weatherLabel=code=>{
   let c=weatherClass(code); return c==='sunny'?'Sunny in '+location.name:c==='partly'?'Sunny intervals in '+location.name:c==='rainy'?'Rain in '+location.name:c==='snowy'?'Snow in '+location.name:'Cloudy in '+location.name;
 };
 try{
   const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=weather_code&timezone=auto`);
   if(!r.ok)throw new Error('weather');
   const d=await r.json(),code=d.current.weather_code;
   art.className='greeting-weather '+weatherClass(code);
   art.title=weatherLabel(code);return true;
 }catch(e){
   art.className='greeting-weather cloudy';
   art.title='Weather unavailable';return false;
 }
}
loadProfileWeather();
setInterval(loadProfileWeather,15*60*1000);


const dayKeys=['mon','tue','wed','thu','fri','sat','sun'],dayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function routineDayKey(date){let d=new Date(date+'T12:00:00').getDay();return dayKeys[(d+6)%7]}
function getRoutineOccurrences(date){
 return routines.filter(r=>{
   if(!r.active||!r.days?.includes(routineDayKey(date)))return false;
   if(r.start&&date<r.start)return false;if(r.end&&date>r.end)return false;
   if(routineExceptions.some(x=>x.routineId===r.id&&x.date===date&&x.skip))return false;
   return true;
 });
}
function renderRoutines(){
 let host=document.getElementById('routineList');if(!host)return;
 if(!routines.length)host.innerHTML=`<div class="routine-empty"><b>No routines yet</b><p>Create a routine and choose the days it repeats. DOM.OS will then place it on your calendar.</p><button class="btn" onclick="newRoutine()">＋ Create First Routine</button></div>`;
 else host.innerHTML=routines.map(r=>`<div class="routine-card ${r.active?'':'paused'}" draggable="true" data-routine="${r.id}">
 <div class="routine-main" onclick="this.parentElement.classList.toggle('open')"><span class="routine-icon">${esc(r.icon||'↻')}</span><div><b>${esc(r.name)}</b><div class="routine-meta">${(r.days||[]).map(x=>dayNames[dayKeys.indexOf(x)]).join(' · ')} &nbsp; ${r.time||'No time'} · ${r.duration? r.duration+' min · ':''}${(r.steps||[]).length} steps</div></div><div class="routine-actions"><button onclick="event.stopPropagation();openRoutine('${r.id}')">Edit</button><button onclick="event.stopPropagation();toggleRoutine('${r.id}')">${r.active?'Pause':'Resume'}</button></div></div>
 <div class="routine-steps-preview">${(r.steps||[]).length?r.steps.map((s,i)=>`<div class="step-preview"><i></i><span>${i+1}. ${s.name}</span><span class="muted">${s.mode==='exact'?(s.exact||'Exact time'):s.mode==='window'?`${s.from||'…'}–${s.to||'…'}`:s.mode==='duration'?(s.minutes?s.minutes+' min':'Duration'):'After previous'}</span></div>`).join(''):'<span class="muted">No steps yet.</span>'}</div></div>`).join('');
 routineActiveCount.textContent=routines.filter(r=>r.active).length;routinePausedCount.textContent=routines.filter(r=>!r.active).length;
 routineWeek.innerHTML=dayKeys.map((d,i)=>`<div class="week-day ${routines.some(r=>r.active&&r.days?.includes(d))?'on':''}">${dayNames[i]}</div>`).join('');
 bindRoutineDnD();
}
function bindRoutineDnD(){let dragging=null;document.querySelectorAll('.routine-card').forEach(c=>{c.ondragstart=()=>dragging=c;c.ondragover=e=>e.preventDefault();c.ondrop=e=>{e.preventDefault();if(!dragging||dragging===c)return;snapshot('Reorder routines');let a=routines.findIndex(r=>r.id===dragging.dataset.routine),b=routines.findIndex(r=>r.id===c.dataset.routine),x=routines.splice(a,1)[0];routines.splice(b,0,x);store.set('routines',routines);renderRoutines();toastMsg('Routine reordered')}})}
let editingRoutineId=null,selectedRoutineDays=[];
function buildDayPicks(){rDays.innerHTML=dayKeys.map((d,i)=>`<button type="button" class="day-pick ${selectedRoutineDays.includes(d)?'on':''}" data-day="${d}">${dayNames[i]}</button>`).join('');rDays.querySelectorAll('button').forEach(b=>b.onclick=()=>{let d=b.dataset.day;selectedRoutineDays=selectedRoutineDays.includes(d)?selectedRoutineDays.filter(x=>x!==d):[...selectedRoutineDays,d];buildDayPicks()})}
function newRoutine(){editingRoutineId=null;selectedRoutineDays=[];routineBuilderTitle.textContent='New Routine';rName.value='';rIcon.value='↻';rActive.value='true';rTime.value='';rDuration.value='60';rStart.value='';rEnd.value='';rSteps.innerHTML='';routineDeleteBtn.style.visibility='hidden';buildDayPicks();routineModal.classList.add('show')}
function openRoutine(id){let r=routines.find(x=>x.id===id);if(!r)return;editingRoutineId=id;selectedRoutineDays=[...(r.days||[])];routineBuilderTitle.textContent='Edit Routine';rName.value=r.name;rIcon.value=r.icon||'↻';rActive.value=String(r.active);rTime.value=r.time||'';rDuration.value=r.duration||60;rStart.value=r.start||'';rEnd.value=r.end||'';rSteps.innerHTML='';(r.steps||[]).forEach(s=>addRoutineStep(s));routineDeleteBtn.style.visibility='visible';buildDayPicks();routineModal.classList.add('show')}
function closeRoutineBuilder(){routineModal.classList.remove('show');window.dispatchEvent(new Event('domos-editor-closed'))}
function routineTimingFields(d,step={}){
 let mode=d.querySelector('.rs-mode')?.value||step.mode||'after';
 let box=d.querySelector('.step-timing'); if(!box)return;
 if(mode==='exact') box.innerHTML=`<input class="rs-exact" type="time" value="${step.exact||''}" title="Exact time">`;
 else if(mode==='window') box.innerHTML=`<input class="rs-from" type="time" value="${step.from||''}" title="Earliest"><span class="muted">–</span><input class="rs-to" type="time" value="${step.to||''}" title="Latest">`;
 else if(mode==='duration') box.innerHTML=`<input class="rs-min" type="number" min="1" placeholder="minutes" value="${step.minutes||''}">`;
 else box.innerHTML=`<span class="muted">After previous step</span>`;
}
function addRoutineStep(step={name:'',mode:'after',minutes:'',exact:'',from:'',to:''}){
 let d=document.createElement('div');d.className='step-row';d.draggable=true;
 d.innerHTML=`<span class="step-grab">⠿</span><input class="rs-name" placeholder="Step name" value="${esc(step.name||'')}"><select class="rs-mode"><option value="after">After previous</option><option value="exact">Exact time</option><option value="window">Time window</option><option value="duration">Duration</option></select><div class="step-timing"></div><button onclick="this.parentElement.remove()">✕</button>`;
 rSteps.appendChild(d);d.querySelector('.rs-mode').value=step.mode||'after';routineTimingFields(d,step);
 d.querySelector('.rs-mode').onchange=()=>routineTimingFields(d,{});
 let drag=null;d.ondragstart=()=>drag=d;rSteps.ondragover=e=>e.preventDefault();rSteps.ondrop=e=>{e.preventDefault();let target=e.target.closest('.step-row');if(drag&&target&&drag!==target)rSteps.insertBefore(drag,target)}
}
function saveRoutine(){if(!validForm([], [['rDuration','Duration',0]]))return;let name=rName.value.trim();if(!name){alert('Give the routine a name.');return}if(!selectedRoutineDays.length){alert('Choose at least one repeat day.');return}snapshot(editingRoutineId?'Edit routine':'New routine');let obj={id:editingRoutineId||'r'+Date.now(),name,icon:rIcon.value.trim()||'↻',active:rActive.value==='true',days:[...selectedRoutineDays],time:rTime.value,duration:+rDuration.value||60,start:rStart.value,end:rEnd.value,steps:[...rSteps.querySelectorAll('.step-row')].map(x=>{let mode=x.querySelector('.rs-mode').value;return{name:x.querySelector('.rs-name').value.trim(),mode,minutes:+(x.querySelector('.rs-min')?.value||0),exact:x.querySelector('.rs-exact')?.value||'',from:x.querySelector('.rs-from')?.value||'',to:x.querySelector('.rs-to')?.value||''}}).filter(x=>x.name)};if(editingRoutineId){let i=routines.findIndex(x=>x.id===editingRoutineId);routines[i]=obj}else routines.push(obj);store.set('routines',routines);closeRoutineBuilder();renderAll();renderRoutines();toastMsg('Routine saved',true)}
function toggleRoutine(id){snapshot('Toggle routine');let r=routines.find(x=>x.id===id);r.active=!r.active;store.set('routines',routines);renderAll();renderRoutines();toastMsg(r.active?'Routine resumed':'Routine paused')}
function deleteCurrentRoutine(){if(!editingRoutineId)return;if(!confirm('Delete this routine?'))return;snapshot('Delete routine');routines=routines.filter(x=>x.id!==editingRoutineId);store.set('routines',routines);closeRoutineBuilder();renderAll();renderRoutines();toastMsg('Routine deleted',true)}


function validForm(required=[],numbers=[]){
 for(const [id,label] of required){const e=document.getElementById(id);if(!e?.value.trim()||!e.checkValidity()){alert(label+' is required and must be valid.');e?.focus();return false}}
 for(const [id,label,min] of numbers){const e=document.getElementById(id),n=Number(e?.value);if(!e?.value.trim()||!Number.isFinite(n)||n<min||!e.checkValidity()){alert(label+' must be a valid number of at least '+min+'.');e?.focus();return false}}
 return true;
}
function payCycleRange(now=new Date()){
 if(window.DOMOSDate)now=new Date(window.DOMOSDate.dayAt(now)+'T12:00:00');
 const configured=Number(store.get('paydayDay',null));if(!configured)return {start:localTodayISO().slice(0,7)+'-01',end:new Date(now.getFullYear(),now.getMonth()+1,1,12).toLocaleDateString('en-CA')};const day=Math.max(1,Math.min(31,configured));
 const payday=(y,m)=>new Date(y,m,Math.min(day,new Date(y,m+1,0).getDate()),12);
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);let start=payday(today.getFullYear(),today.getMonth());
 if(start>today)start=payday(today.getFullYear(),today.getMonth()-1);
 const end=payday(start.getFullYear(),start.getMonth()+1),format=d=>iso(d.getFullYear(),d.getMonth(),d.getDate());
 return {start:format(start),end:format(end)};
}
function payCycleTransactions(){const {start,end}=payCycleRange();return transactions.filter(t=>t.date>=start&&t.date<end&&!t.internalTransfer)}
function money(v){return '£'+Number(v||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}

/* Finances */
let editingTransactionId=null;

function nextPaydayInfo(){if(!Number(paydayDay))return {date:null,days:null};
 const now=new Date(localTodayISO()+'T12:00:00');
 const safeDay=Math.max(1,Math.min(31,Number(paydayDay)||28));
 function paydayFor(y,m){
   const last=new Date(y,m+1,0).getDate();
   return new Date(y,m,Math.min(safeDay,last),0,0,0,0);
 }
 let p=paydayFor(now.getFullYear(),now.getMonth());
 if(p<new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0,0)){
   p=paydayFor(now.getFullYear(),now.getMonth()+1);
 }
 const today0=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const days=Math.max(0,Math.round((p-today0)/86400000));
 return {date:p,days};
}
function financeTotals(){
 const income=transactions.filter(x=>x.type==='income').reduce((s,x)=>s+Number(x.amount||0),0);
 const spent=transactions.filter(x=>x.type==='expense').reduce((s,x)=>s+Number(x.amount||0),0);
 return {income,spent,balance:income-spent};
}
function savePaydayDay(v){
 paydayDay=Math.max(1,Math.min(31,Number(v)||28));
 store.set('paydayDay',paydayDay);
 const input=document.getElementById('paydayDayInput');if(input)input.value=paydayDay;
 updateSummary();toastMsg('Payday updated');
}


function money(v){return new Intl.NumberFormat('en-GB',{style:'currency',currency:window.DOMOSProfile?.preferences?.currency||'GBP'}).format(Number(v)||0)}
function finAccountName(id){let a=financeAccounts.find(x=>x.id===id);return a?a.name:'Unassigned'}
function financeTotals(){
 let manual=financeAccounts.reduce((s,a)=>s+(+a.balance||0),0);
 let income=transactions.filter(t=>t.type==='income'&&!t.internalTransfer).reduce((s,t)=>s+(+t.amount||0),0);
 let spent=transactions.filter(t=>t.type==='expense'&&!t.internalTransfer).reduce((s,t)=>s+(+t.amount||0),0);
 let bills=financeBills.filter(b=>!b.paid).reduce((s,b)=>s+(+b.amount||0),0);
 let reserved=financeSavings.reduce((s,g)=>s+(+g.current||0),0);
 let total=financeAccounts.length?manual:income-spent;const cycle=payCycleTransactions();income=cycle.filter(t=>t.type==='income').reduce((sum,t)=>sum+Number(t.amount||0),0);spent=cycle.filter(t=>t.type==='expense').reduce((sum,t)=>sum+Number(t.amount||0),0);
 let safe=Math.max(0,total-bills-reserved);
 return {total,income,spent,bills,reserved,safe}
}
function financeDaysToPayday(){return nextPaydayInfo().days}

function renderFinance(){
 if(!$('#financeContent'))return;
 $$('#financeTabs button').forEach(b=>{b.classList.toggle('active',b.dataset.finTab===financeTab);b.onclick=()=>{financeTab=b.dataset.finTab;renderFinance()}});
 let t=financeTotals(),days=financeDaysToPayday(),daily=days?t.safe/days:t.safe;
 let accountFilter=`<select id="finAccountFilter" onchange="renderFinanceTransactions(this.value)"><option value="">All accounts</option>${financeAccounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>`;
 if(financeTab==='overview'){
  financeContent.innerHTML=`<div class="fin-grid">
   <div class="card fin-card fin-span-3 fin-kpi"><span>Total across accounts</span><b>${money(t.total)}</b><small>${financeAccounts.length||0} accounts</small></div>
   <div class="card fin-card fin-span-3 fin-kpi"><span>Safe to spend</span><b>${money(t.safe)}</b><small>${days===null?'Set payday to calculate a daily allowance':days+' days to payday · '+money(daily)+'/day'}</small></div>
   <div class="card fin-card fin-span-3 fin-kpi"><span>Committed bills</span><b>${money(t.bills)}</b><small>Still due</small></div>
   <div class="card fin-card fin-span-3 fin-kpi"><span>Savings reserved</span><b>${money(t.reserved)}</b><small>Excluded from spendable</small></div>
   <div class="card fin-card fin-span-6"><div class="head"><h3>Accounts</h3><button class="btn ghost" onclick="openFinanceAccount()">＋ Account</button></div>${financeAccounts.length?financeAccounts.map(a=>`<div class="fin-account"><div class="bank"><span class="bank-dot">${esc((a.bank||a.name||'?').slice(0,1).toUpperCase())}</span><div><b>${esc(a.name)}</b><div class="fin-muted">${esc(a.bank||'Manual')} · ${esc(a.type||'Current')}</div></div></div><b>${money(a.balance)}</b></div>`).join(''):`<div class="fin-empty">Add an account and track its balance manually.</div>`}</div>
   <div class="card fin-card fin-span-6"><div class="head"><h3>This pay cycle</h3></div><div class="fin-account"><span>Income</span><b class="fin-positive">${money(t.income)}</b></div><div class="fin-account"><span>Spending</span><b class="fin-negative">${money(t.spent)}</b></div><div class="fin-account"><span>Available after commitments</span><b>${money(t.safe)}</b></div></div>
  </div>`
 } else if(financeTab==='accounts'){
  financeContent.innerHTML=`<div class="fin-grid"><div class="card fin-card fin-span-12"><div class="head"><h3>Connected & Manual Accounts</h3><button class="btn" onclick="openFinanceAccount()">＋ Account</button></div>${financeAccounts.length?financeAccounts.map(a=>`<div class="fin-account"><div class="bank"><span class="bank-dot">${esc((a.bank||'?')[0])}</span><div><b>${esc(a.name)}</b><div class="fin-muted">${esc(a.bank)} · ${esc(a.type||'Current')} · ${a.source==='bank'?'Connected':'Manual / connection-ready'}</div></div></div><div><b>${money(a.balance)}</b> <button class="btn ghost" onclick="openFinanceAccount('${a.id}')">Edit</button></div></div>`).join(''):`<div class="fin-empty">No accounts yet. Add a manual account to begin.</div>`}</div></div>`
 } else if(financeTab==='budget'){
  financeContent.innerHTML=`<div class="fin-grid"><div class="card fin-card fin-span-8"><div class="head"><h3>Category Budgets</h3><button class="btn" onclick="openFinanceBudget()">＋ Budget</button></div>${financeBudgets.length?financeBudgets.map(b=>{let spent=payCycleTransactions().filter(t=>t.type==='expense'&&t.category===b.category).reduce((s,x)=>s+(+x.amount||0),0),pc=Math.min(100,b.limit?spent/b.limit*100:0);return `<div class="fin-account"><div style="flex:1"><b>${esc(b.category)}</b><div class="fin-progress"><i style="width:${pc}%"></i></div><div class="fin-muted">${money(spent)} of ${money(b.limit)} · ${money(Math.max(0,b.limit-spent))} left</div></div><button class="btn ghost" onclick="openFinanceBudget('${b.id}')">Edit</button></div>`}).join(''):`<div class="fin-empty">Create budgets for food, fuel, entertainment, shopping or any category you want.</div>`}</div><div class="card fin-card fin-span-4"><h3>Budget summary</h3><p class="fin-muted">Budgets use the same transaction categories that future bank imports will use.</p></div></div>`
 } else if(financeTab==='transactions'){
  financeContent.innerHTML=`<div class="card fin-card"><div class="head"><h3>All Transactions</h3><button class="btn" onclick="openTransaction()">＋ Transaction</button></div><div class="fin-filter">${accountFilter}<select id="finTypeFilter" onchange="renderFinanceTransactions($('#finAccountFilter').value)"><option value="">Income & expenses</option><option value="income">Income</option><option value="expense">Expenses</option></select></div><div id="financeTxRows"></div></div>`;renderFinanceTransactions('')
 } else if(financeTab==='bills'){
  financeContent.innerHTML=`<div class="fin-grid"><div class="card fin-card fin-span-12"><div class="head"><h3>Bills & Subscriptions</h3><button class="btn" onclick="openFinanceBill()">＋ Bill</button></div>${financeBills.length?financeBills.map(b=>`<div class="fin-row"><div><b>${esc(b.name)}</b><div class="fin-muted">${esc(finAccountName(b.accountId))}</div></div><span>${esc(b.due||'No date')}</span><span>${b.paid?'Paid':'Due'}</span><div><b>${money(b.amount)}</b> <button class="btn ghost" onclick="openFinanceBill('${b.id}')">Edit</button> <button class="btn ghost" onclick="toggleFinanceBill('${b.id}')">${b.paid?'Mark unpaid':'Mark paid'}</button></div></div>`).join(''):`<div class="fin-empty">Add recurring bills and subscriptions so Safe to Spend excludes money already committed.</div>`}</div></div>`
 } else if(financeTab==='savings'){
  financeContent.innerHTML=`<div class="fin-grid"><div class="card fin-card fin-span-12"><div class="head"><h3>Savings Goals & Pots</h3><button class="btn" onclick="openFinanceSaving()">＋ Saving Goal</button></div>${financeSavings.length?financeSavings.map(g=>{let pc=Math.min(100,g.target?g.current/g.target*100:0);return `<div class="fin-account"><div style="flex:1"><b>${esc(g.name)}</b><div class="fin-progress"><i style="width:${pc}%"></i></div><div class="fin-muted">${money(g.current)} of ${money(g.target)} · ${Math.round(pc)}%</div></div><button class="btn ghost" onclick="openFinanceSaving('${g.id}')">Edit</button></div>`}).join(''):`<div class="fin-empty">Create separate savings goals or pots. Money marked as saved is excluded from Safe to Spend.</div>`}</div></div>`
 } else {
  let biggest=transactions.filter(t=>t.type==='expense').slice().sort((a,b)=>b.amount-a.amount)[0];
  financeContent.innerHTML=`<div class="fin-grid"><div class="card fin-card fin-span-4 fin-kpi"><span>Average daily safe spend</span><b>${money(daily)}</b><small>Until payday</small></div><div class="card fin-card fin-span-4 fin-kpi"><span>Largest recorded expense</span><b>${biggest?money(biggest.amount):money(0)}</b><small>${biggest?esc(biggest.description||biggest.category):'No spending yet'}</small></div><div class="card fin-card fin-span-4 fin-kpi"><span>Net cash flow</span><b>${money(t.income-t.spent)}</b><small>Recorded transactions</small></div><div class="card fin-card fin-span-12"><h3>Insights foundation</h3><p class="fin-muted">As transaction history grows, this area can compare pay cycles, categories, recurring spending and projected balances. The data model already keeps account, category and transaction type separate so Monzo and Halifax imports can feed the same analysis later.</p></div></div>`
 }
}
function renderFinanceTransactions(accountId=''){
 let el=$('#financeTxRows');if(!el)return;let type=$('#finTypeFilter')?.value||'';
 let rows=transactions.filter(t=>(!accountId||t.accountId===accountId)&&(!type||t.type===type)).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 el.innerHTML=rows.length?rows.map(t=>`<div class="fin-row"><div><b>${esc(t.description||t.category||'Transaction')}</b><div class="fin-muted">${esc(t.category||'Other')} · ${esc(finAccountName(t.accountId))}</div></div><span>${esc(t.date||'')}</span><span>${t.internalTransfer?'Transfer':esc(t.type)}</span><b class="${t.type==='income'?'fin-positive':'fin-negative'}">${t.type==='income'?'+':'−'}${money(t.amount)}</b><button class="btn ghost" onclick="openTransaction('${t.id}')">Edit</button></div>`).join(''):`<div class="fin-empty">No matching transactions.</div>`
}
function openFinanceAccount(id){
 let a=financeAccounts.find(x=>x.id===id)||{name:'',bank:'',type:'Current',balance:0,source:'manual'};
 drawerTitle.textContent=id?'Edit Account':'Add Account';
 drawerBody.innerHTML=`<div class="field"><label>Account name</label><input id="faName" value="${esc(a.name)}" placeholder="e.g. Monzo Current"></div><div class="row"><div class="field"><label>Bank</label><input id="faBank" value="${esc(a.bank)}" placeholder="Monzo / Halifax"></div><div class="field"><label>Type</label><select id="faType"><option>Current</option><option>Savings</option><option>Credit</option></select></div></div><div class="field"><label>Current balance</label><input id="faBalance" type="number" step=".01" value="${a.balance}"></div><p class="muted">Manual for now. This account is structured so a secure bank connection can update it later.</p><button class="btn" onclick="saveFinanceAccount('${id||''}')">Save Account</button>${id?` <button class="btn ghost" onclick="deleteFinanceAccount('${id}')">Delete</button>`:''}`;drawer.classList.add('show');faType.value=a.type||'Current'
}
function saveFinanceAccount(id){if(!validForm([['faName','Account name']],[['faBalance','Balance',-Number.MAX_VALUE]]))return;let a=id?financeAccounts.find(x=>x.id===id):null;if(!a){a={id:'fa'+Date.now(),source:'manual'};financeAccounts.push(a)}Object.assign(a,{name:faName.value.trim()||'Account',bank:faBank.value.trim()||'Other',type:faType.value,balance:+faBalance.value||0});persist();closeDrawer();renderFinance();toastMsg('Account saved',false)}
function deleteFinanceAccount(id){financeAccounts=financeAccounts.filter(x=>x.id!==id);persist();closeDrawer();renderFinance();toastMsg('Account removed',false)}
function openFinanceBudget(id){let b=financeBudgets.find(x=>x.id===id)||{category:'Food',limit:0};drawerTitle.textContent=id?'Edit Budget':'New Budget';drawerBody.innerHTML=`<div class="field"><label>Category</label><input id="fbCat" value="${esc(b.category)}"></div><div class="field"><label>Pay-cycle budget</label><input id="fbLimit" type="number" step=".01" value="${b.limit}"></div><button class="btn" onclick="saveFinanceBudget('${id||''}')">Save Budget</button>${id?` <button class="btn ghost" onclick="deleteFinanceRecord('financeBudgets','${id}')">Delete</button>`:''}`;drawer.classList.add('show')}
function saveFinanceBudget(id){if(!validForm([['fbCat','Category']],[['fbLimit','Budget',0]]))return;let b=id?financeBudgets.find(x=>x.id===id):null;if(!b){b={id:'fb'+Date.now()};financeBudgets.push(b)}b.category=fbCat.value.trim()||'Other';b.limit=+fbLimit.value||0;persist();closeDrawer();renderFinance()}
function openFinanceBill(id=''){const bill=financeBills.find(x=>x.id===id);drawerTitle.textContent=bill?'Edit Bill / Subscription':'Add Bill / Subscription';drawerBody.innerHTML=`<div class="field"><label>Name</label><input id="fblName"></div><div class="row"><div class="field"><label>Amount</label><input id="fblAmount" type="number" step=".01"></div><div class="field"><label>Due date</label><input id="fblDue" type="date"></div></div><div class="field"><label>Paid from</label><select id="fblAccount"><option value="">Unassigned</option>${financeAccounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div><button class="btn" onclick="saveFinanceBill('${id}')">Save Bill</button>${bill?` <button class="btn ghost" onclick="deleteFinanceRecord('financeBills','${id}')">Delete</button>`:''}`;drawer.classList.add('show');if(bill){fblName.value=bill.name;fblAmount.value=bill.amount;fblDue.value=bill.due;fblAccount.value=bill.accountId||''}}
function saveFinanceBill(id=''){if(!validForm([['fblName','Bill name']],[['fblAmount','Amount',0]]))return;let bill=financeBills.find(x=>x.id===id);if(!bill){bill={id:'bill'+crypto.randomUUID(),paid:false};financeBills.push(bill)}Object.assign(bill,{name:fblName.value.trim(),amount:Number(fblAmount.value),due:fblDue.value,accountId:fblAccount.value});persist();closeDrawer();renderFinance();renderDashboard()}
function toggleFinanceBill(id){const bill=financeBills.find(x=>x.id===id);if(!bill)return;bill.paid=!bill.paid;persist();renderFinance();renderDashboard()}
function deleteFinanceRecord(kind,id){
 if(!confirm('Delete this record?'))return;
 if(kind==='transactions'){transactions=transactions.filter(x=>x.id!==id);store.set('transactions',transactions)}
 else if(kind==='financeBills')financeBills=financeBills.filter(x=>x.id!==id);
 else if(kind==='financeBudgets')financeBudgets=financeBudgets.filter(x=>x.id!==id);
 else if(kind==='financeSavings')financeSavings=financeSavings.filter(x=>x.id!==id);
 else return;
 persist();closeDrawer();renderFinance();renderDashboard();toastMsg('Record deleted',false);
}

function openFinanceSaving(id){let g=financeSavings.find(x=>x.id===id)||{name:'',current:0,target:0};drawerTitle.textContent=id?'Edit Saving Goal':'New Saving Goal';drawerBody.innerHTML=`<div class="field"><label>Name</label><input id="fsName" value="${esc(g.name)}"></div><div class="row"><div class="field"><label>Saved</label><input id="fsCurrent" type="number" step=".01" value="${g.current}"></div><div class="field"><label>Target</label><input id="fsTarget" type="number" step=".01" value="${g.target}"></div></div><button class="btn" onclick="saveFinanceSaving('${id||''}')">Save Goal</button>${id?` <button class="btn ghost" onclick="deleteFinanceRecord('financeSavings','${id}')">Delete</button>`:''}`;drawer.classList.add('show')}
function saveFinanceSaving(id){if(!validForm([['fsName','Savings name']],[['fsCurrent','Saved amount',0],['fsTarget','Target',0]]))return;let g=id?financeSavings.find(x=>x.id===id):null;if(!g){g={id:'save'+Date.now()};financeSavings.push(g)}g.name=fsName.value.trim()||'Savings';g.current=+fsCurrent.value||0;g.target=+fsTarget.value||0;persist();closeDrawer();renderFinance()}
function openTransaction(id){
 let t=id?transactions.find(x=>x.id===id):null;t=t||{type:'expense',amount:0,description:'',category:'Other',date:localTodayISO(),accountId:'',internalTransfer:false};
 drawerTitle.textContent=id?'Edit Transaction':'Add Transaction';
 drawerBody.innerHTML=`<div class="row"><div class="field"><label>Type</label><select id="txType"><option value="expense">Expense</option><option value="income">Income</option></select></div><div class="field"><label>Amount</label><input id="txAmount" type="number" step=".01" value="${t.amount}"></div></div><div class="field"><label>Description</label><input id="txDesc" value="${esc(t.description||'')}"></div><div class="row"><div class="field"><label>Category</label><input id="txCategory" value="${esc(t.category||'Other')}"></div><div class="field"><label>Date</label><input id="txDate" type="date" value="${t.date||localTodayISO()}"></div></div><div class="field"><label>Account</label><select id="txAccount"><option value="">Unassigned</option>${financeAccounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div><div class="field"><label><input id="txTransfer" type="checkbox" ${t.internalTransfer?'checked':''}> Internal transfer between my accounts</label></div><button class="btn" onclick="saveTransaction('${id||''}')">Save Transaction</button>${id?` <button class="btn ghost" onclick="deleteFinanceRecord('transactions','${id}')">Delete</button>`:''}`;drawer.classList.add('show');txType.value=t.type;txAccount.value=t.accountId||''
}
function saveTransaction(id){if(!validForm([['txDate','Date'],['txCategory','Category']],[['txAmount','Amount',0.01]]))return;let t=id?transactions.find(x=>x.id===id):null;if(!t){t={id:'tx'+Date.now()};transactions.push(t)}Object.assign(t,{type:txType.value,amount:+txAmount.value||0,description:txDesc.value.trim(),category:txCategory.value.trim()||'Other',date:txDate.value,accountId:txAccount.value,internalTransfer:txTransfer.checked});store.set('transactions',transactions);closeDrawer();renderFinance();renderDashboard();toastMsg('Transaction saved',false)}
function renderGoals(){
 let host=document.getElementById('goalList');if(!host)return;
 let sorted=[...goals].sort((a,b)=>(a.progress>=100)-(b.progress>=100)||(a.date||'9999').localeCompare(b.date||'9999'));
 host.innerHTML=sorted.length?sorted.map(g=>`<div class="goal-card" onclick="openGoal('${g.id}')"><div class="goal-top"><div><b>${esc(g.name)}</b><div class="muted">${esc(g.description||'')}</div></div><b>${Math.min(100,Math.max(0,g.progress||0))}%</b></div><div class="goal-progress"><i style="width:${Math.min(100,Math.max(0,g.progress||0))}%"></i></div><div class="goal-meta"><span>${g.progress>=100?'Completed':'In progress'}</span><span>${g.date?'Target '+g.date:'No target date'}</span></div></div>`).join(''):`<div class="empty-state"><b>No goals yet</b><p>Create your first goal when you know what you want to work toward.</p></div>`;
 let complete=goals.filter(g=>Number(g.progress)>=100).length,avg=goals.length?Math.round(goals.reduce((s,g)=>s+Number(g.progress||0),0)/goals.length):0;goalActive.textContent=goals.length-complete;goalComplete.textContent=complete;goalAverage.textContent=avg+'%';
}
function openGoal(id=null){editingGoalId=id;let g=goals.find(x=>x.id===id);goalModalTitle.textContent=g?'Edit Goal':'New Goal';gName.value=g?.name||'';gDesc.value=g?.description||'';gDate.value=g?.date||'';gProgress.value=g?.progress||0;gDelete.style.visibility=g?'visible':'hidden';goalModal.classList.add('show')}
function saveGoal(){if(!gName.value.trim()){alert('Give the goal a name.');return}let g={id:editingGoalId||'g'+Date.now(),name:gName.value.trim(),description:gDesc.value.trim(),date:gDate.value,progress:Math.min(100,Math.max(0,Number(gProgress.value)||0))};if(editingGoalId)goals[goals.findIndex(x=>x.id===editingGoalId)]=g;else goals.push(g);store.set('goals',goals);goalModal.classList.remove('show');renderGoals();renderDashboard();toastMsg('Goal saved')}
function deleteGoal(){if(!editingGoalId)return;goals=goals.filter(x=>x.id!==editingGoalId);store.set('goals',goals);goalModal.classList.remove('show');renderGoals();renderDashboard();toastMsg('Goal deleted')}

/* Notes */
function newNote(){document.getElementById('noteSearch').value='';let n={id:'n'+Date.now(),title:'Untitled Note',body:'',updated:Date.now()};notes.unshift(n);activeNoteId=n.id;store.set('notes',notes);store.set('activeNoteId',activeNoteId);renderNotes();setTimeout(()=>document.getElementById('noteTitleInput')?.select(),10)}
function renderNotes(){
 let list=document.getElementById('notesList'),editor=document.getElementById('noteEditor');if(!list||!editor)return;
 let q=(document.getElementById('noteSearch')?.value||'').toLowerCase(),shown=notes.filter(n=>`${n.title} ${n.body}`.toLowerCase().includes(q)).sort((a,b)=>(b.updated||0)-(a.updated||0));
 list.innerHTML=shown.length?shown.map(n=>`<div class="note-row ${n.id===activeNoteId?'active':''}" onclick="selectNote('${n.id}')"><b>${esc(n.title||'Untitled Note')}</b><small>${esc((n.body||'').replace(/\n/g,' ').slice(0,55)||'Empty note')}</small></div>`).join(''):`<div class="empty-state"><b>No notes yet</b><p>Create one whenever you need it.</p></div>`;
 let n=notes.find(x=>x.id===activeNoteId);if(!n&&notes.length){activeNoteId=notes[0].id;n=notes[0]}
 editor.innerHTML=n?`<div style="display:flex;justify-content:flex-end"><button class="btn ghost" onclick="deleteNote('${n.id}')">Delete</button></div><input class="note-title" id="noteTitleInput" value="${esc(n.title)}" oninput="saveNoteLive('${n.id}')"><textarea class="note-body" id="noteBodyInput" placeholder="Start writing…" oninput="saveNoteLive('${n.id}')">${esc(n.body||'')}</textarea>`:`<div class="empty-state"><b>Select or create a note</b><p>Your notes autosave as you type.</p></div>`;
}
function selectNote(id){activeNoteId=id;store.set('activeNoteId',id);renderNotes()}
function saveNoteLive(id){let n=notes.find(x=>x.id===id);if(!n)return;n.title=noteTitleInput.value||'Untitled Note';n.body=noteBodyInput.value;n.updated=Date.now();store.set('notes',notes);const row=document.querySelector('.note-row.active');if(row){row.querySelector('b').textContent=n.title;row.querySelector('small').textContent=n.body.replace(/\n/g,' ').slice(0,55)||'Empty note'}}
function deleteNote(id){notes=notes.filter(x=>x.id!==id);activeNoteId=notes[0]?.id||null;store.set('notes',notes);store.set('activeNoteId',activeNoteId);renderNotes();toastMsg('Note deleted')}

function renderAll(){renderDashboard();renderTasks();renderCalendar();renderKeys();renderRoutines();renderFinance();renderGoals();renderNotes()}renderAll();setInterval(updateLiveClock,60000);
