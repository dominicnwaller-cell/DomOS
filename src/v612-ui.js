import {storage as localStorage} from './data/storage.js';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const PREFIX='lifeos4.', SETTINGS_KEY='domos612.settings', TIMER_KEY='domos612.workTimer', LAYOUT_MIGRATION='domos_v612_dashboard_layout';
const DEFAULT_SETTINGS={displayName:'',defaultPage:'dashboard',rememberLastPage:true,accent:'#37e68b',sidebarDensity:'default',compact:false,animations:true,reduceMotion:false};
const RELEASE_613=[
 'Work Deadlines includes undated tasks; simplified finance widget',
 'Finance edit/delete controls and consistent payday-cycle totals',
 'Cancelled drafts are discarded and forms validate input',
 'Midnight timer tracking and accurate weather refresh status',
 'Cross-window synchronization and concurrent-save conflict protection',
 'Safer backups with validation and rollback',
 'Clear updater states with inline download and installation progress'
];
let settings=readJSON(SETTINGS_KEY,DEFAULT_SETTINGS),timerTick=null,activeSettingsTab='general',updateUnsubscribe=null;

function readJSON(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??structuredClone(fallback)}catch{return structuredClone(fallback)}}
const writeJSON=(key,v)=>window.DOMOSActions?window.DOMOSActions.applyUIChanges({profileId:window.DOMOSProfile.id},{[key]:JSON.stringify(v)}):localStorage.setItem(key,JSON.stringify(v));
const appGet=(key,fallback)=>readJSON(PREFIX+key,fallback);
const appSet=(key,v)=>writeJSON(PREFIX+key,v);
const escapeHtml=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const money=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:window.DOMOSProfile?.preferences?.currency||'GBP'}).format(Number(v)||0);
function todayISO(){if(window.DOMOSDate)return window.DOMOSDate.today();const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function dateLabel(iso,options={weekday:'short',day:'numeric',month:'short'}){if(window.DOMOSDate)return iso?window.DOMOSDate.dateLabel(iso,options):'';return iso?new Intl.DateTimeFormat('en-GB',options).format(new Date(`${iso}T12:00:00`)):''}
function daysBetween(a,b){return Math.round((new Date(`${b}T12:00:00Z`)-new Date(`${a}T12:00:00Z`))/86400000)}
function callGlobal(code){return window.eval(code)}
function toast(message){try{callGlobal(`toastMsg(${JSON.stringify(message)},false)`)}catch{console.info(message)}}
function showPage(page){try{callGlobal(`showPage(${JSON.stringify(page)})`)}catch{}}

function getRoutinesForDate(iso){
 const routines=appGet('routines',[]),exceptions=appGet('routineExceptions',[]),keys=['sun','mon','tue','wed','thu','fri','sat'],key=keys[new Date(`${iso}T12:00:00`).getDay()];
 return routines.filter(r=>r.active&&r.days?.includes(key)&&(!r.start||iso>=r.start)&&(!r.end||iso<=r.end)&&!exceptions.some(x=>x.routineId===r.id&&x.date===iso&&x.skip));
}

function applySettings(){
 document.documentElement.style.setProperty('--g',settings.accent||DEFAULT_SETTINGS.accent);
 document.body.dataset.sidebarDensity=settings.sidebarDensity||'default';
 document.body.classList.toggle('dom612-compact',!!settings.compact);
 document.body.classList.toggle('dom612-no-animations',settings.animations===false||settings.reduceMotion===true);
}
function saveSettings(){writeJSON(SETTINGS_KEY,settings);applySettings()}

function removePinnedSidebar(){
 const title=[...document.querySelectorAll('.side-title')].find(el=>el.textContent.trim().toLowerCase()==='pinned');
 if(!title)return; title.classList.add('dom612-remove'); let node=title.nextElementSibling;
 while(node&&!node.classList.contains('grow')){const next=node.nextElementSibling;node.classList.add('dom612-remove');node=next}
}

function installDashboardRegistry(){
 window.DOMOS612=window.DOMOS612||{};
 Object.assign(window.DOMOS612,{enhanceDashboard,decorateToday,decorateSchedule,decorateCalendar,renderFinanceWidget,renderGoalsWidget,renderDeadlinesWidget,renderWorkTimer,openNativePopout,renderSettings});
 callGlobal(`
 (() => {
   const updateWidget=(id,title,body)=>{const w=widgets.find(x=>x.id===id);if(w){w.title=title;w.body=body}};
   updateWidget('finance','Finances',()=>'<div id="dom612Finance"></div>');
   updateWidget('goals','Life Goals',()=>'<div id="dom612Goals"></div>');
   updateWidget('upcoming','Work Deadlines',()=>'<div id="dom612Deadlines"></div>');
   if(!widgets.some(x=>x.id==='worktimer'))widgets.push({id:'worktimer',title:'Work Timer',cls:'',body:()=>'<div id="dom612WorkTimer"></div>'});
   if(!window.DOMOSStorage.getItem('${LAYOUT_MIGRATION}')){
     const preferred=['today','schedule','month','finance','goals','upcoming','worktimer'];
     dash.order=[...preferred,...dash.order.filter(id=>!preferred.includes(id)&&id!=='quick')];
     dash.hidden=[...new Set([...(dash.hidden||[]).filter(id=>!preferred.includes(id)),'quick'])];
     dash.names=dash.names||{};preferred.forEach(id=>delete dash.names[id]);dash.dims=dash.dims||{};
     Object.assign(dash.dims,{today:{cols:4,rows:5},schedule:{cols:4,rows:5},month:{cols:4,rows:5},finance:{cols:4,rows:4},goals:{cols:4,rows:4},upcoming:{cols:4,rows:4},worktimer:{cols:12,rows:2}});
     store.set('dashboard',dash);window.DOMOSStorage.setItem('${LAYOUT_MIGRATION}','1');
   }
   if(!window.__dom612Wrapped){
     window.__dom612Wrapped=true;
     const rd=renderDashboard;renderDashboard=function(){rd();window.DOMOS612.enhanceDashboard();const popout=new URLSearchParams(location.search).get('domosPopout');if(popout)window.DOMOS612.enterPopoutMode(popout)};
     const rdt=renderDashTasks;renderDashTasks=function(){rdt();window.DOMOS612.decorateToday()};
     const rds=renderDashSchedule;renderDashSchedule=function(){rds();window.DOMOS612.decorateSchedule()};
     const rdc=renderDashCalendar;renderDashCalendar=function(){rdc();window.DOMOS612.decorateCalendar()};
     const sp=showPage;showPage=function(name){sp(name);if(!new URLSearchParams(location.search).has('domosPopout'))window.DOMOSStorage.setItem('domos612.lastPage',name);if(name==='settings')window.DOMOS612.renderSettings();if(name==='dashboard')window.DOMOS612.enhanceDashboard()};
   }
   renderDashboard();
 })();`);
}

const cardFor=id=>document.querySelector(`#dashGrid [data-id="${id}"]`);
function setCardHeader(card,title,subtitle,icon){
 if(!card)return;title=appGet('dashboard',{}).names?.[card.dataset.id]||title;card.classList.add('dom612-widget');const h3=card.querySelector(':scope > .head h3');if(!h3)return;
 h3.innerHTML=`<span class="dom612-widget-icon">${icon}</span><span class="dom612-widget-heading"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></span>`;
}

function enhanceDashboard(){
 removePinnedSidebar();document.querySelector('#page-dashboard .summary')?.classList.add('dom612-remove');
 setCardHeader(cardFor('today'),'Today','Focus on what matters','✓');setCardHeader(cardFor('schedule'),'Schedule','Your planned events','▣');
 setCardHeader(cardFor('month'),'Calendar',dateLabel(todayISO(),{month:'long',year:'numeric'}),'▦');
 setCardHeader(cardFor('finance'),'Finances','Keep track of your money','£');setCardHeader(cardFor('goals'),'Life Goals','Build the life you want','◎');
 setCardHeader(cardFor('upcoming'),'Work Deadlines','Client work and important dates','▣');setCardHeader(cardFor('worktimer'),'Work Timer','Track focused work today','◷');
 decorateToday();decorateSchedule();decorateCalendar();renderFinanceWidget();renderGoalsWidget();renderDeadlinesWidget();renderWorkTimer();
}

function routineProgress(){
 const iso=todayISO(),checks=appGet('routineChecks',{}),keys=[];getRoutinesForDate(iso).forEach(r=>(r.steps||[]).forEach((_,i)=>keys.push(`${iso}|${r.id}|${i}`)));
 const done=keys.filter(k=>checks[k]).length;return{total:keys.length,done,pct:keys.length?Math.round(done/keys.length*100):0};
}
function iconForRoutine(name=''){const n=name.toLowerCase();if(n.includes('wake'))return'☀';if(n.includes('breakfast')||n.includes('tea'))return'☕';if(n.includes('gym')||n.includes('workout'))return'◇';if(n.includes('home'))return'⌂';if(n.includes('shower'))return'◉';if(n.includes('dog')||n.includes('walk'))return'◆';if(n.includes('work')||n.includes('office'))return'▣';if(n.includes('sleep')||n.includes('bed'))return'☾';if(n.includes('eat')||n.includes('meal'))return'◫';return'•'}
function decorateToday(){
 const box=cardFor('today')?.querySelector('.today-routine-list');if(!box)return;box.querySelector('.dom612-today-progress')?.remove();const p=routineProgress();
 const block=document.createElement('div');block.className='dom612-today-progress';block.innerHTML=`<div class="dom612-ring" style="--p:${p.pct}"><span>${p.pct}%</span></div><div class="dom612-progress-copy"><b>${p.done} of ${p.total} tasks complete</b><div class="dom612-progress"><i style="width:${p.pct}%"></i></div></div>`;box.prepend(block);
 box.querySelectorAll('.task').forEach(row=>{const title=row.querySelector('.tasktxt b');if(!title||row.querySelector('.dom612-task-icon'))return;const icon=document.createElement('span');icon.className='dom612-task-icon';icon.textContent=iconForRoutine(title.textContent);title.parentElement.prepend(icon)});
}

function setSelectedDate(iso){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return;appSet('dashSelectedDate',iso);const d=new Date(`${iso}T12:00:00`);appSet('dashCalView',{year:d.getFullYear(),month:d.getMonth()});
 callGlobal(`dashSelectedDate=${JSON.stringify(iso)};dashCalView={year:${d.getFullYear()},month:${d.getMonth()}};renderDashCalendar();renderDashSchedule();`);
}
function shiftSelectedDate(days){const iso=appGet('dashSelectedDate',todayISO()),d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+days);setSelectedDate([d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'))}
function createEventOnDate(iso){const safe=/^\d{4}-\d{2}-\d{2}$/.test(iso)?iso:todayISO();callGlobal(`newEvent(${JSON.stringify(safe)})`)}

function decorateSchedule(){
 const host=cardFor('schedule')?.querySelector('#dashSchedule');if(!host)return;const iso=appGet('dashSelectedDate',todayISO()),toolbar=host.querySelector('.dash-cal-toolbar');
 if(toolbar){toolbar.classList.add('dom612-schedule-nav');toolbar.innerHTML=`<button type="button" data-shift="-1">‹</button><span class="schedule-date">${escapeHtml(dateLabel(iso,{weekday:'short',day:'numeric',month:'short'}))}</span><button type="button" data-shift="1">›</button><button type="button" data-open-calendar>↗</button>`;toolbar.querySelector('[data-shift="-1"]').onclick=e=>{e.stopPropagation();shiftSelectedDate(-1)};toolbar.querySelector('[data-shift="1"]').onclick=e=>{e.stopPropagation();shiftSelectedDate(1)};toolbar.querySelector('[data-open-calendar]').onclick=e=>{e.stopPropagation();callGlobal(`viewDate=new Date(${JSON.stringify(iso+'T12:00:00')});showPage('calendar')`)}}
 host.querySelectorAll('.schedule-item').forEach(item=>item.classList.add('dom612-schedule-item',`dom612-kind-${item.dataset.kind||'event'}`));
 if(!host.querySelector('.dom612-schedule-footer')){const footer=document.createElement('button');footer.type='button';footer.className='dom612-schedule-footer';footer.textContent='＋ Add event';footer.onclick=e=>{e.stopPropagation();createEventOnDate(iso)};host.appendChild(footer)}
}

function calendarAgenda(iso){
 const events=appGet('events',[]).filter(e=>e.date===iso).map(e=>({...e,kind:'event'}));
 const tasks=appGet('tasks',[]).filter(t=>t.date===iso&&t.status!=='completed').map(t=>({...t,kind:'task'}));
 const routines=getRoutinesForDate(iso).map(r=>({...r,kind:'routine',title:r.name}));
 return[...events,...tasks,...routines].sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')).slice(0,4);
}
function decorateCalendar(){
 const host=cardFor('month')?.querySelector('#dashCalendar');if(!host)return;const iso=appGet('dashSelectedDate',todayISO()),toolbar=host.querySelector('.dash-cal-toolbar');
 if(toolbar&&!toolbar.querySelector('[data-dom612-today]')){const b=document.createElement('button');b.type='button';b.dataset.dom612Today='1';b.className='dom612-today-button';b.textContent='Today';b.onclick=e=>{e.stopPropagation();setSelectedDate(todayISO())};toolbar.insertBefore(b,toolbar.lastElementChild)}
 host.querySelector('.dom612-cal-agenda')?.remove();const agenda=calendarAgenda(iso),list=document.createElement('div');list.className='dom612-cal-agenda';
 list.innerHTML=agenda.length?agenda.map(item=>`<button type="button" data-kind="${item.kind}" data-id="${escapeHtml(item.id)}"><span class="dom612-dot ${item.kind}"></span><b>${escapeHtml(item.title||'Untitled')}</b><span>${escapeHtml(item.time||'All day')}</span></button>`).join(''):`<div class="dom612-empty-inline">Nothing planned for ${escapeHtml(dateLabel(iso))}.</div>`;
 list.querySelectorAll('button').forEach(btn=>btn.onclick=e=>{e.stopPropagation();if(btn.dataset.kind==='task')callGlobal(`openTask(${JSON.stringify(btn.dataset.id)})`);else if(btn.dataset.kind==='routine')callGlobal(`openRoutine(${JSON.stringify(btn.dataset.id)})`);else callGlobal(`openEvent(${JSON.stringify(btn.dataset.id)})`)});
 host.appendChild(list);
}

function financeSnapshot(){return callGlobal(`({...financeTotals(),accounts:financeAccounts,transactions:payCycleTransactions(),budgets:financeBudgets,budget:financeBudgets.reduce((sum,b)=>sum+Number(b.limit||0),0)})`)}
function daysToPayday(){if(!Number(appGet('paydayDay',null)))return null;const payday=Math.max(1,Math.min(31,Number(appGet('paydayDay',28))||28)),now=new Date(todayISO()+'T12:00:00'),make=(y,m)=>new Date(y,m,Math.min(payday,new Date(y,m+1,0).getDate()),12);let date=make(now.getFullYear(),now.getMonth());if(date<new Date(now.getFullYear(),now.getMonth(),now.getDate(),12))date=make(now.getFullYear(),now.getMonth()+1);return Math.max(0,Math.round((date-new Date(now.getFullYear(),now.getMonth(),now.getDate(),12))/86400000))}
function financeCategories(transactions){const b={Essentials:0,Food:0,Transport:0,Other:0};transactions.filter(t=>t.type==='expense'&&!t.internalTransfer).forEach(t=>{const c=String(t.category||'').toLowerCase(),v=+t.amount||0;if(/food|grocer|restaurant|meal|eating/.test(c))b.Food+=v;else if(/fuel|transport|car|taxi|train|bus/.test(c))b.Transport+=v;else if(/bill|rent|utility|essential|health|subscription/.test(c))b.Essentials+=v;else b.Other+=v});return b}
function renderFinanceWidget(){
 const host=document.getElementById('dom612Finance');if(!host)return;if(window.DOMOSFinance){window.DOMOSFinance.widget(host);return;}const d=financeSnapshot(),days=daysToPayday(),cats=financeCategories(d.transactions),pct=d.budget?Math.min(100,Math.round(d.spent/d.budget*100)):0;
 host.innerHTML=`<div class="dom612-finance"><div class="dom612-finance-main"><div><strong>${money(d.safe)}</strong><span>Available to spend</span></div><div class="dom612-payday"><b>${days===null?'Not set':days+' days'}</b><span>${days===null?'Payday':'until payday'}</span></div></div><div class="dom612-progress"><i style="width:${pct}%"></i></div><div class="dom612-finance-line"><span>${money(d.spent)} spent</span><span>${d.budget?money(d.budget)+' budget':'No budget set'}</span></div><div class="dom612-category-grid">${Object.entries(cats).map(([name,value],i)=>`<button type="button" data-open-finance><span class="cat-icon c${i}">${['▣','◫','◆','•••'][i]}</span><b>${money(value)}</b><small>${name}</small></button>`).join('')}</div></div>`;
 host.querySelectorAll('[data-open-finance]').forEach(b=>b.onclick=e=>{e.stopPropagation();showPage('finances')});
}

function goalIcon(name=''){const n=name.toLowerCase();if(/home|house/.test(n))return'⌂';if(/travel|world|trip/.test(n))return'✈';if(/health|fitness|gym/.test(n))return'◇';if(/saving|money|finance/.test(n))return'£';if(/dom\.os|app|build|project/.test(n))return'↗';return'◎'}
function renderGoalsWidget(){
 if(window.DOMOSGoals){window.DOMOSGoals.renderDashboard();return}
 const host=document.getElementById('dom612Goals');if(!host)return;const goals=appGet('goals',[]).slice().sort((a,b)=>(Number(a.progress)>=100)-(Number(b.progress)>=100)||(a.date||'9999').localeCompare(b.date||'9999')).slice(0,5);
 host.innerHTML=goals.length?`<div class="dom612-goal-list">${goals.map(g=>{const p=Math.max(0,Math.min(100,Number(g.progress)||0));return`<button type="button" data-goal-id="${escapeHtml(g.id)}"><span class="dom612-goal-icon">${goalIcon(g.name)}</span><span class="dom612-goal-copy"><b>${escapeHtml(g.name)}</b><small>${escapeHtml(g.description||(g.date?'Target '+dateLabel(g.date):'In progress'))}</small></span><span class="dom612-mini-progress"><i style="width:${p}%"></i></span><strong>${p}%</strong><span class="chev">›</span></button>`}).join('')}</div><button type="button" class="dom612-card-link" data-add-goal>＋ Add goal</button>`:`<div class="dom612-empty"><b>No life goals yet</b><span>Add what you are ultimately working towards.</span><button type="button" data-add-goal>＋ Create your first goal</button></div>`;
 host.querySelectorAll('[data-goal-id]').forEach(b=>b.onclick=e=>{e.stopPropagation();callGlobal(`openGoal(${JSON.stringify(b.dataset.goalId)})`)});host.querySelectorAll('[data-add-goal]').forEach(b=>b.onclick=e=>{e.stopPropagation();callGlobal('openGoal()')});
}
function deadlineState(date){if(!date)return{label:'Set a due date',cls:''};const d=daysBetween(todayISO(),date);if(d<0)return{label:`${Math.abs(d)} day${Math.abs(d)===1?'':'s'} overdue`,cls:'overdue'};if(d===0)return{label:'Due today',cls:'urgent'};if(d===1)return{label:'1 day left',cls:'urgent'};return{label:`${d} days left`,cls:d<=3?'urgent':''}}
function renderDeadlinesWidget(){
 const host=document.getElementById('dom612Deadlines');if(!host)return;const tasks=appGet('tasks',[]).filter(t=>!['completed','archived'].includes(t.status)).sort((a,b)=>((a.date||'9999')+(a.time||'')).localeCompare((b.date||'9999')+(b.time||''))).slice(0,5);
 host.innerHTML=tasks.length?`<div class="dom612-deadline-list">${tasks.map((t,i)=>{const s=deadlineState(t.date);return`<button type="button" data-deadline-id="${escapeHtml(t.id)}"><span class="dom612-deadline-icon d${i%4}">${['▣','▤','◉','⌘'][i%4]}</span><span class="dom612-deadline-copy"><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.desc||t.description||t.priority||'Work task')}</small></span><span class="dom612-deadline-date"><b>${escapeHtml(t.date?dateLabel(t.date):'No due date')}</b><small class="${s.cls}">${s.label}</small></span></button>`}).join('')}</div><button type="button" class="dom612-card-link" data-work-tasks>＋ View all work tasks</button>`:`<div class="dom612-empty"><b>No upcoming work deadlines</b><span>Incomplete Work Tasks appear here, including tasks without a due date.</span><button type="button" data-work-tasks>Open Work Tasks</button></div>`;
 host.querySelectorAll('[data-deadline-id]').forEach(b=>b.onclick=e=>{e.stopPropagation();callGlobal(`openTask(${JSON.stringify(b.dataset.deadlineId)})`)});host.querySelectorAll('[data-work-tasks]').forEach(b=>b.onclick=e=>{e.stopPropagation();showPage('tasks')});
}

const timerDefault=()=>({day:todayISO(),elapsedMs:0,sessionMs:0,sessionCount:0,running:false,startedAt:null,targetHours:8});
function readTimer(){
 const service=window.DOMOSActions?.services||window.DOMOSApplicationServices;if(service)return service.timerSnapshot({profileId:window.DOMOSProfile.id},true);
 let t={...timerDefault(),...readJSON(TIMER_KEY,timerDefault())};
 if(t.day!==todayISO()){
  const running=t.running&&Number.isFinite(t.startedAt),now=new Date(),midnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  t={...timerDefault(),running:!!running,startedAt:running?Math.max(midnight,t.startedAt):null};writeJSON(TIMER_KEY,t);
 }return t;
}
const writeTimer=t=>writeJSON(TIMER_KEY,t);
function timerTotals(t){const live=t.running&&t.startedAt?Math.max(0,Date.now()-t.startedAt):0;return{total:t.elapsedMs+live,session:t.sessionMs+live}}
function formatDuration(ms){const total=Math.floor(ms/1000),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;return[h,m,s].map(n=>String(n).padStart(2,'0')).join(':')}
function timerAction(action){
 if(window.DOMOSActions){if(action==='reset'){window.DOMOSActions.requestUI({action:'work.reset'});return}const focus=appGet('workFocus',{});window.DOMOSActions.performUI({profileId:window.DOMOSProfile.id},{action:'work.'+action,...(['start','resume'].includes(action)?focus:{})});renderWorkTimer();return;}
 let t=readTimer(),now=Date.now();const settle=()=>{if(t.running&&t.startedAt){const delta=Math.max(0,now-t.startedAt);t.elapsedMs+=delta;t.sessionMs+=delta;t.startedAt=null;t.running=false}};
 if(action==='start'&&!t.running){t.running=true;t.startedAt=now}else if(action==='pause')settle();else if(action==='stop'){settle();if(t.sessionMs>0)t.sessionCount+=1;t.sessionMs=0}else if(action==='reset'){if(!confirm('Reset today’s tracked work time?'))return;t=timerDefault()}writeTimer(t);renderWorkTimer();
}
function renderWorkTimer(){
 const host=document.getElementById('dom612WorkTimer');if(!host||host.contains(document.activeElement))return;const t=readTimer(),tot=timerTotals(t),target=(Number(t.targetHours)||8)*3600000,pct=Math.min(100,Math.round(tot.total/target*100));
 host.innerHTML=`<div class="dom612-timer"><div class="dom612-timer-time"><strong>${formatDuration(tot.total)}</strong><span>${t.counterResetAt?'Since reset · history retained':'Today’s tracked time'} · ${t.sessionCount} completed session${t.sessionCount===1?'':'s'}</span></div><div class="dom612-timer-progress"><div><span>8 hour target</span><b>${pct}%</b></div><div class="dom612-progress"><i style="width:${pct}%"></i></div></div><div class="dom612-timer-controls"><button type="button" class="primary" data-timer-action="${t.running?'pause':'start'}">${t.running?'Ⅱ Pause':'▶ Start'}</button><button type="button" data-timer-action="stop">■ Stop</button><button type="button" data-timer-action="reset">↻ Reset</button></div></div>`;
 if(window.DOMOSActions){const focus=appGet('workFocus',{}),tasks=appGet('tasks',[]).filter(x=>!['completed','archived'].includes(x.status)),label=document.createElement('label');label.className='dom612-field';label.innerHTML='<span>Working on</span><select aria-label="Linked work task"><option value="">Unlinked work session</option>'+tasks.map(x=>'<option value="'+escapeHtml(x.id)+'" '+(focus.taskId===x.id?'selected':'')+'>'+escapeHtml(x.title)+'</option>').join('')+'</select>';const select=label.querySelector('select');select.disabled=appGet('workSessions',[]).some(x=>['running','paused'].includes(x.status));select.onchange=()=>{const task=tasks.find(x=>x.id===select.value);appSet('workFocus',task?{taskId:task.id,title:task.title}:{});select.blur()};host.append(label);}host.querySelectorAll('[data-timer-action]').forEach(b=>b.onclick=e=>{e.stopPropagation();timerAction(b.dataset.timerAction)});if(!timerTick)timerTick=setInterval(()=>{if(document.getElementById('dom612WorkTimer'))renderWorkTimer()},1000);
}

const tabs=[['general','⚙','General'],['appearance','◉','Appearance'],['dashboard','▦','Dashboard'],['shortcuts','⌨','Shortcuts'],['data','◫','Data & Backup'],['notifications','♧','Notifications'],['weather','☁','Weather'],['updates','↻','Updates'],['about','ⓘ','About']];
function buildSettingsShell(){
 const page=document.getElementById('page-settings');if(!page||page.dataset.v612==='1')return;page.dataset.v612='1';
 page.innerHTML=`<section class="hero dom612-settings-hero"><h1 id="dom612SettingsTitle">Settings</h1><p id="dom612SettingsSubtitle">Customize DOM.OS to fit how you work.</p></section><section class="work dom612-settings-work"><nav class="dom612-settings-tabs">${tabs.map(([id,icon,label])=>`<button type="button" data-settings-tab="${id}"><span>${icon}</span>${label}</button>`).join('')}</nav><div id="dom612SettingsPanel"></div></section>`;
 page.querySelectorAll('[data-settings-tab]').forEach(b=>b.onclick=()=>renderSettings(b.dataset.settingsTab));
}
function settingToggle(label,desc,checked,key){return`<label class="dom612-setting-row"><span><b>${escapeHtml(label)}</b><small>${escapeHtml(desc)}</small></span><input type="checkbox" data-setting-toggle="${key}" ${checked?'checked':''}><i></i></label>`}
function bindSettingControls(panel){panel.querySelectorAll('[data-setting-toggle]').forEach(i=>i.onchange=()=>{settings[i.dataset.settingToggle]=i.checked;saveSettings()});panel.querySelectorAll('[data-setting-select]').forEach(s=>s.onchange=()=>{settings[s.dataset.settingSelect]=s.value;saveSettings()})}

function renderGeneralSettings(panel){
 panel.innerHTML=`<div class="dom612-settings-grid"><section class="dom612-settings-card span2"><header><span class="setting-icon">●</span><div><h3>Local Profile</h3><p>Your DOM.OS identity on this device.</p></div></header><div class="dom612-profile"><div class="avatar">${escapeHtml((settings.displayName||'D').slice(0,2).toUpperCase())}</div><div><b>${escapeHtml(settings.displayName||window.DOMOSProfile?.name||'Profile')}</b><span>Local profile · Sync planned for a future release</span></div><button type="button" data-edit-profile>Edit Profile</button></div></section><section class="dom612-settings-card"><header><span class="setting-icon">⚙</span><div><h3>General</h3><p>Core app preferences and defaults.</p></div></header><label class="dom612-field"><span>Default start page</span><select data-setting-select="defaultPage">${['dashboard','calendar','tasks','routine','finances','goals','notes'].map(v=>`<option value="${v}" ${settings.defaultPage===v?'selected':''}>${v==='tasks'?'Work Tasks':v[0].toUpperCase()+v.slice(1)}</option>`).join('')}</select></label>${settingToggle('Remember last page','Resume where you left off when DOM.OS opens.',settings.rememberLastPage,'rememberLastPage')}</section><section class="dom612-settings-card"><header><span class="setting-icon">✓</span><div><h3>Behaviour</h3><p>Small quality-of-life controls.</p></div></header>${settingToggle('Reduce motion','Minimise animated interface effects.',settings.reduceMotion,'reduceMotion')}<div class="dom612-info-row"><span><b>Local persistence</b><small>Tasks, routines, finances, goals and notes save automatically.</small></span><strong>On</strong></div></section></div>`;
 panel.querySelector('[data-edit-profile]').onclick=()=>{const v=prompt('Display name',settings.displayName||window.DOMOSProfile?.name||'Profile');if(v?.trim()){settings.displayName=v.trim();saveSettings();renderSettings('general')}};bindSettingControls(panel);
}
function renderAppearanceSettings(panel){
 const colors=['#37e68b','#479cff','#a06aff','#ff9e55','#ff6670','#ef4f91'];
 panel.innerHTML=`<div class="dom612-settings-grid"><section class="dom612-settings-card span2"><header><span class="setting-icon">◉</span><div><h3>Appearance</h3><p>Refine the look and feel of DOM.OS.</p></div></header><div class="dom612-appearance-row"><span><b>Theme</b><small>DOM.OS 6.1.2 is tuned for its dark desktop theme.</small></span><div class="dom612-segment"><button class="active">Dark</button><button disabled title="Planned for V7">Light · V7</button></div></div><div class="dom612-appearance-row"><span><b>Accent colour</b><small>Used for active controls, progress and highlights.</small></span><div class="dom612-colors">${colors.map(c=>`<button type="button" data-accent="${c}" style="--swatch:${c}" class="${settings.accent===c?'active':''}"></button>`).join('')}</div></div><div class="dom612-appearance-row"><span><b>Sidebar density</b><small>Choose how much space navigation uses.</small></span><div class="dom612-segment">${['compact','default','comfortable'].map(v=>`<button type="button" data-density="${v}" class="${settings.sidebarDensity===v?'active':''}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div></div>${settingToggle('Widget animations','Use smooth transitions and progress animations.',settings.animations,'animations')}${settingToggle('Compact mode','Reduce padding throughout the desktop layout.',settings.compact,'compact')}</section></div>`;
 panel.querySelectorAll('[data-accent]').forEach(b=>b.onclick=()=>{settings.accent=b.dataset.accent;saveSettings();renderSettings('appearance')});panel.querySelectorAll('[data-density]').forEach(b=>b.onclick=()=>{settings.sidebarDensity=b.dataset.density;saveSettings();renderSettings('appearance')});bindSettingControls(panel);
}
function dashboardWidgetState(){try{return callGlobal(`({items:widgets.map(w=>({id:w.id,title:w.title})),hidden:[...dash.hidden]})`)}catch{return{items:[],hidden:[]}}}
function renderDashboardSettings(panel){
 const d=dashboardWidgetState(),items=d.items.filter(x=>x.id!=='quick');
 panel.innerHTML=`<div class="dom612-settings-grid"><section class="dom612-settings-card span2"><header><span class="setting-icon">▦</span><div><h3>Dashboard</h3><p>Control which functional widgets are shown.</p></div></header><div class="dom612-widget-settings">${items.map(x=>`<label><span><b>${escapeHtml(x.title)}</b><small>${x.id==='upcoming'?'Incomplete Work Tasks, ordered by due date.':x.id==='goals'?'Connected to your Life Goals data.':'Dashboard widget'}</small></span><input type="checkbox" data-widget-toggle="${escapeHtml(x.id)}" ${d.hidden.includes(x.id)?'':'checked'}><i></i></label>`).join('')}</div><div class="dom612-actions"><button data-edit-dashboard>Edit layout</button><button data-widget-library>Widget library</button><button class="danger" data-reset-dashboard>Reset dashboard</button></div></section></div>`;
 panel.querySelectorAll('[data-widget-toggle]').forEach(i=>i.onchange=()=>{const id=i.dataset.widgetToggle;i.checked?callGlobal(`restoreWidget(${JSON.stringify(id)})`):callGlobal(`hideWidget(${JSON.stringify(id)})`);renderSettings('dashboard')});panel.querySelector('[data-edit-dashboard]').onclick=()=>{showPage('dashboard');callGlobal('toggleEdit(true)')};panel.querySelector('[data-widget-library]').onclick=()=>{showPage('dashboard');document.getElementById('libBtn')?.click()};panel.querySelector('[data-reset-dashboard]').onclick=()=>{if(confirm('Reset the dashboard layout?'))callGlobal('resetDashboard()')};
}
function renderShortcutsSettings(panel){panel.innerHTML=`<div class="dom612-settings-grid"><section class="dom612-settings-card span2"><header><span class="setting-icon">⌨</span><div><h3>Keyboard Shortcuts</h3><p>Click a shortcut then press the keys you want to use.</p></div></header><div id="hotkeyRows" class="dom612-hotkeys"></div><div class="dom612-actions"><button id="resetKeys">Reset defaults</button></div></section></div>`;try{callGlobal(`renderKeys();resetKeys.onclick=()=>{keys={...defaults};store.set('keys',keys);renderKeys();toastMsg('Shortcuts reset',false)}`)}catch(e){console.error(e)}}

function backupPayload(){const data={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(PREFIX)||k?.startsWith('domos_')||k?.startsWith('domos612.'))data[k]=localStorage.getItem(k)}return{format:'DOM.OS Backup',version:1,createdAt:new Date().toISOString(),data}}
function downloadLegacyBackup(){const blob=new Blob([JSON.stringify(backupPayload(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`DOM.OS-backup-${todayISO()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);localStorage.setItem('domos612.lastBackup',new Date().toISOString());toast('DOM.OS backup exported');renderSettings('data')}
function validateBackup(p){
 if(p?.format!=='DOM.OS Backup'||p.version!==1||!p.data||typeof p.data!=='object'||Array.isArray(p.data))throw new Error('Not a supported DOM.OS backup');
 const collections=['tasks','events','calendarTemplates','routines','routineExceptions','goals','notes','transactions','financeAccounts','financeBudgets','financeBills','financeSavings'];
 const inspect=value=>{if(!value||typeof value!=='object')return;for(const [key,v] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))throw new Error('Unsafe backup field');if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Invalid number');inspect(v)}};
 for(const [k,v] of Object.entries(p.data)){
  if(!(k.startsWith(PREFIX)||k.startsWith('domos_')||k.startsWith('domos612.'))||typeof v!=='string')throw new Error('Invalid backup data');
  if(k.startsWith(PREFIX)||k===SETTINGS_KEY||k===TIMER_KEY){
   const parsed=JSON.parse(v);inspect(parsed);
   if(collections.includes(k.slice(PREFIX.length))){
    if(!Array.isArray(parsed))throw new Error('Invalid collection: '+k);
    const ids=new Set();for(const item of parsed){const exception=k===PREFIX+'routineExceptions',id=exception?item?.routineId:item?.id;if(!item||typeof item!=='object'||Array.isArray(item)||typeof id!=='string'||!/^[a-zA-Z0-9_.:-]+$/.test(id)||(!exception&&ids.has(id)))throw new Error('Invalid or duplicate record ID: '+k);ids.add(id);
     for(const field of ['title','name','desc','description','body','date','time','category'])if(item[field]!==undefined&&typeof item[field]!=='string')throw new Error('Invalid '+field+': '+k);
     for(const field of ['amount','balance','limit','current','target','duration','progress'])if(item[field]!==undefined&&(!Number.isFinite(Number(item[field]))||(['amount','limit','current','target','duration','progress'].includes(field)&&Number(item[field])<0)))throw new Error('Invalid '+field+': '+k);
    }
   }
  }
 }
 return p.data;
}
function restoreBackup(data){
 const prior=new Map(),written=[];
 try{for(const [k,v] of Object.entries(data)){prior.set(k,localStorage.getItem(k));localStorage.setItem(k,v);written.push(k)}}
 catch(error){for(const k of written){const old=prior.get(k);if(old===null)localStorage.removeItem(k);else localStorage.setItem(k,old)}throw error}
}
function importLegacyBackup(file){const r=new FileReader();r.onload=()=>{try{const data=validateBackup(JSON.parse(String(r.result||'')));if(!confirm('Import this backup? Current local DOM.OS data will be replaced where keys overlap.'))return;restoreBackup(data);toast('Backup imported. Restarting DOM.OS…');setTimeout(()=>location.reload(),500)}catch(e){alert(`Could not import backup: ${e.message}`)}};r.readAsText(file)}

async function downloadBackup(){try{await window.DOMOSProfiles.export();toast('Profile backup exported')}catch(error){alert('Backup failed: '+String(error))}}
async function importBackup(file){try{await window.DOMOSProfiles.restore(file)}catch(error){alert('Restore failed; previous data retained. '+String(error))}}
function renderDataSettings(panel){
 const last=localStorage.getItem('domos612.lastBackup');panel.innerHTML=`<div class="dom612-settings-grid"><section class="dom612-settings-card span2"><header><span class="setting-icon">◫</span><div><h3>Data & Backup</h3><p>Keep your local DOM.OS data safe and portable.</p></div></header><div class="dom612-info-row"><span><b>Automatic local saving</b><small>DOM.OS saves changes to this device as you work.</small></span><strong>On</strong></div><div class="dom612-info-row"><span><b>Last exported backup</b><small>${last?(window.DOMOSDate?window.DOMOSDate.timestampLabel(last):new Date(last).toLocaleString('en-GB')):'No backup exported yet'}</small></span><button data-backup-now>Back up now</button></div><div class="dom612-actions"><button data-export>Export data</button><label class="dom612-import">Import data<input type="file" accept="application/json,.json,.domosbackup" data-import></label></div></section></div>`;panel.querySelector('[data-backup-now]').onclick=downloadBackup;panel.querySelector('[data-export]').onclick=downloadBackup;panel.querySelector('[data-import]').onchange=e=>e.target.files?.[0]&&importBackup(e.target.files[0]);
}
function renderWeatherSettings(panel){panel.innerHTML=`<div class="dom612-settings-grid"><section class="dom612-settings-card span2"><header><span class="setting-icon">☁</span><div><h3>Weather</h3><p>Current desktop weather source and status.</p></div></header><div class="dom612-info-row"><span><b>Location</b><small>Choose an optional location in Profile Settings to enable weather.</small></span><strong>${escapeHtml(window.DOMOSProfile?.preferences?.location?.name||'Not configured')}</strong></div><div class="dom612-info-row"><span><b>Provider</b><small>Weather data is fetched from Open-Meteo.</small></span><strong>Open-Meteo</strong></div><div class="dom612-actions"><button data-refresh-weather>Refresh weather now</button></div></section></div>`;panel.querySelector('[data-refresh-weather]').onclick=async()=>{const button=panel.querySelector('[data-refresh-weather]');button.disabled=true;button.textContent='Refreshing…';try{const ok=await callGlobal('loadProfileWeather()');toast(ok?'Weather refreshed':'Weather unavailable. Please try again.')}catch{toast('Weather unavailable. Please try again.')}finally{button.disabled=false;button.textContent='Refresh weather now'}}}

const updateState=()=>window.DOMOSUpdater?.getState?.()||{currentVersion:'6.2.0',status:'idle',available:false,progress:0,downloaded:0,total:0};
const formatBytes=b=>b?`${(b/1024/1024).toFixed(1)} MB`:'0 MB';
function notesList(text){if(!text||text.trim().toLowerCase()==='dom.os update')return[];return text.split(/\r?\n/).map(x=>x.replace(/^[-*•]\s*/,'').trim()).filter(Boolean).slice(0,8)}
function renderUpdatesSettings(panel){
  const s=updateState();
  const notes=s.available?notesList(s.releaseNotes):RELEASE_613;
  const last=s.lastChecked
    ? (window.DOMOSDate?window.DOMOSDate.timestampLabel(s.lastChecked):new Date(s.lastChecked).toLocaleString('en-GB'))
    : 'Not checked yet';

  const checking=s.status==='checking'||s.checking;
  const downloading=s.status==='downloading';
  const installing=s.status==='installing';
  const restarting=s.status==='installed'||s.status==='restarting';
  const busy=checking||downloading||installing||restarting;

  let heading="You're up to date";
  let description='DOM.OS checks the signed release feed for newer versions.';
  let stateLabel="You're up to date";

  if(checking){
    heading='Checking for updates...';
    description='Checking the signed DOM.OS release feed.';
    stateLabel='Checking...';
  }else if(downloading){
    heading=`Downloading DOM.OS v${escapeHtml(s.latestVersion||'')}`;
    description='The update is downloading. You can keep using DOM.OS.';
    stateLabel=`${s.progress||0}%`;
  }else if(installing){
    heading='Installing update...';
    description='DOM.OS is installing the downloaded update.';
    stateLabel='Installing...';
  }else if(restarting){
    heading='Update installed';
    description='DOM.OS is restarting to finish the update.';
    stateLabel='Restarting...';
  }else if(s.status==='error'){
    heading='Update failed';
    description='DOM.OS could not complete the update. Try again below.';
    stateLabel='Update failed';
  }else if(s.available){
    heading=`Update available - v${escapeHtml(s.latestVersion||'')}`;
    description='A new signed version of DOM.OS is ready to download and install.';
    stateLabel='Update available';
  }

  const progressHtml=downloading?`
    <div class="dom612-inline-update-progress" style="margin-top:18px">
      <div class="dom612-finance-line">
        <span>Downloading update</span>
        <strong>${s.progress||0}%</strong>
      </div>

      <div class="dom612-progress">
        <i style="width:${Math.max(0,Math.min(100,s.progress||0))}%"></i>
      </div>

      <div class="dom612-finance-line">
        <span>
          ${formatBytes(s.downloaded||0)}
          ${s.total?` of ${formatBytes(s.total)}`:''}
        </span>
        <span>Please keep DOM.OS open</span>
      </div>
    </div>`
    :installing?`
    <div class="dom612-inline-update-progress" style="margin-top:18px">
      <div class="dom612-finance-line">
        <span>Installing DOM.OS update</span>
        <strong>Installing...</strong>
      </div>
      <div class="dom612-progress">
        <i style="width:100%"></i>
      </div>
    </div>`
    :'';

  const installButton=s.available&&!busy?`
    <button class="primary" data-update-install>
      Download & install
    </button>`
    :'';

  const checkButton=!restarting?`
    <button data-update-check ${busy?'disabled':''}>
      ${checking?'Checking...':'Check for updates'}
    </button>`
    :'';

  panel.innerHTML=`
    <div class="dom612-updates-grid">

      <section class="dom612-settings-card current-version">
        <header>
          <span class="setting-icon">◇</span>
          <div>
            <h3>Current Version</h3>
            <p>Your current DOM.OS installation.</p>
          </div>
        </header>

        <div class="dom612-version">
          <span class="stack-icon">◇</span>
          <div>
            <strong>DOM.OS v${escapeHtml(s.currentVersion||'6.2.0')}</strong>
            <small>Stable desktop release</small>
          </div>
          <em>Stable</em>
        </div>

        <div class="dom612-info-row">
          <span>
            <b>Update channel</b>
            <small>Signed stable GitHub releases.</small>
          </span>
          <strong>Stable</strong>
        </div>

        <div class="dom612-info-row">
          <span>
            <b>Last checked</b>
            <small>${escapeHtml(last)}</small>
          </span>
          <span></span>
        </div>

        ${settingToggle(
          'Automatically check for updates',
          'Check shortly after DOM.OS starts.',
          localStorage.getItem('domos612.autoCheck')!=='false',
          'autoCheck'
        )}
      </section>

      <section class="dom612-settings-card update-available">
        <header>
          <span class="download-icon">↓</span>
          <div>
            <h2>${heading}</h2>
            <p>${description}</p>
          </div>
        </header>

        <div class="dom612-update-ok">
          <b>DOM.OS v${escapeHtml(
            s.available
              ? (s.latestVersion||s.currentVersion||'6.2.0')
              : (s.currentVersion||'6.2.0')
          )}</b>
          <span>${stateLabel}</span>
        </div>

        ${s.error?`
          <div class="dom612-update-error">
            ${escapeHtml(s.error)}
          </div>`
          :''}

        ${progressHtml}

        <div class="dom612-actions">
          ${installButton}
          ${checkButton}
        </div>
      </section>

      <section class="dom612-settings-card release-notes span2">
        <header>
          <span class="setting-icon">▤</span>
          <div>
            <h3>Release Notes</h3>
            <p>What changed in the current or available release.</p>
          </div>
        </header>

        <div class="dom612-release">
          <div>
            <b>v${escapeHtml(
              s.available
                ? (s.latestVersion||'')
                : (s.currentVersion||'6.2.0')
            )}</b>
            <em>${s.available?'Available':'Current'}</em>
          </div>

          <ul>
            ${(notes.length?notes:['New DOM.OS improvements and fixes.'])
              .map(n=>`<li>${escapeHtml(n)}</li>`)
              .join('')}
          </ul>
        </div>
      </section>

    </div>`;

  const check=panel.querySelector('[data-update-check]');
  if(check){
    check.onclick=()=>window.DOMOSUpdater?.checkForUpdates(false);
  }

  const install=panel.querySelector('[data-update-install]');
  if(install){
    install.onclick=()=>window.DOMOSUpdater?.updateNow();
  }

  const auto=panel.querySelector('[data-setting-toggle="autoCheck"]');
  if(auto){
    auto.onchange=()=>{
      localStorage.setItem('domos612.autoCheck',String(auto.checked));
    };
  }
}
function renderAboutSettings(panel){const s=updateState();panel.innerHTML=`<div class="dom612-settings-grid"><section class="dom612-settings-card span2"><header><span class="setting-icon">ⓘ</span><div><h3>About DOM.OS</h3><p>Your personal operating system for the life you are building.</p></div></header><div class="dom612-about"><div class="dom612-about-logo">D</div><div><h2>DOM.OS</h2><b>v${escapeHtml(s.currentVersion||'6.2.0')}</b><p>Desktop · Personal edition</p></div></div><div class="dom612-info-row"><span><b>Storage</b><small>Local profile SQLite database</small></span><strong>Local</strong></div><div class="dom612-info-row"><span><b>Updates</b><small>Signed Tauri updater releases</small></span><strong>Enabled</strong></div><div class="dom612-info-row"><span><b>Mobile direction</b><small>The 6.1.2 component system is responsive and designed to scale toward a future mobile build.</small></span><strong>Planned</strong></div></section></div>`}

function renderSettings(tab=activeSettingsTab){
 buildSettingsShell();activeSettingsTab=tab;const page=document.getElementById('page-settings');if(!page)return;page.querySelectorAll('[data-settings-tab]').forEach(b=>b.classList.toggle('active',b.dataset.settingsTab===tab));const title=page.querySelector('#dom612SettingsTitle'),sub=page.querySelector('#dom612SettingsSubtitle');if(title)title.textContent=tab==='updates'?'Updates':'Settings';if(sub)sub.textContent=tab==='updates'?'Keep DOM.OS current without reinstalling.':'Customize DOM.OS to fit how you work.';const panel=page.querySelector('#dom612SettingsPanel');if(!panel)return;
 if(tab==='notifications')window.DOMOSNotifications?.settings(panel);else if(tab==='appearance')renderAppearanceSettings(panel);else if(tab==='dashboard')renderDashboardSettings(panel);else if(tab==='shortcuts')renderShortcutsSettings(panel);else if(tab==='data')renderDataSettings(panel);else if(tab==='weather')renderWeatherSettings(panel);else if(tab==='updates')renderUpdatesSettings(panel);else if(tab==='about')renderAboutSettings(panel);else renderGeneralSettings(panel);
}

async function openNativePopout(id){
 try{
  const label=`domos-${id}-${Date.now()}`.replace(/[^a-zA-Z0-9_:/-]/g,'-'),url=`/?domosPopout=${encodeURIComponent(id)}&profileId=${encodeURIComponent(window.DOMOSProfile.id)}`,title=id==='quicknote'?'DOM.OS · Quick Note':`DOM.OS · ${cardFor(id)?.querySelector('.dom612-widget-heading strong')?.textContent||id}`;
  const popup=new WebviewWindow(label,{url,title,width:760,height:640,minWidth:420,minHeight:320,resizable:true,center:true});
  popup.once('tauri://error',e=>{console.error('DOM.OS pop-out failed:',e);toast('Could not open the DOM.OS pop-out window')});
 }catch(e){console.error(e);toast('Could not open the DOM.OS pop-out window')}
}
function interceptPopouts(){
 document.addEventListener('click',e=>{const a=e.target.closest('[data-act="pop"]'),card=a?.closest('[data-id]');if(!a||!card)return;e.preventDefault();e.stopImmediatePropagation();card.querySelector('.widget-menu')?.classList.remove('show');openNativePopout(card.dataset.id)},true);
 const q=document.getElementById('quickPop');if(q)q.onclick=e=>{e.preventDefault();document.getElementById('quickNoteMenu')?.classList.remove('show');openNativePopout('quicknote')};
}
function enterPopoutMode(id){
 // Keep the original DOM and editors so widget actions can still render and save.
 document.body.classList.add('dom612-native-popout');
 document.body.classList.toggle('dom612-quick-popout',id==='quicknote');
 const target=id==='quicknote'?document.getElementById('quickNoteBox'):cardFor(id);
 if(target){target.classList.remove('quicknote-hidden');target.classList.add('dom612-popout-content')}
}
function initUpdaterSubscription(){updateUnsubscribe?.();updateUnsubscribe=window.DOMOSUpdater?.subscribe?.(()=>{if(activeSettingsTab==='updates'&&document.getElementById('page-settings')?.classList.contains('active'))renderSettings('updates')})}
function syncOtherWindows(){
 let refresh=null,deferred=false;
 const refreshData=()=>{
  if(document.querySelector('.drawer.show,.routine-modal.show,.v52-modal.show,.rename-modal.show')||document.activeElement?.matches('input,textarea,[contenteditable="true"]')){deferred=true;return}
  deferred=false;
  callGlobal(`
   tasks=store.get('tasks',[]);events=store.get('events',[]);goals=store.get('goals',[]);
   routines=store.get('routines',[]);routineExceptions=store.get('routineExceptions',[]);routineChecks=store.get('routineChecks',{});
   transactions=store.get('transactions',[]);financeAccounts=store.get('financeAccounts',[]);
   financeBudgets=store.get('financeBudgets',[]);financeBills=store.get('financeBills',[]);financeSavings=store.get('financeSavings',[]);
   notes=store.get('notes',[]);activeNoteId=store.get('activeNoteId',null);calendarTemplates=store.get('calendarTemplates',[]);
   dash=store.get('dashboard',dash);paydayDay=store.get('paydayDay',null);dashSelectedDate=store.get('dashSelectedDate',localTodayISO());dashCalView=store.get('dashCalView',dashCalView);
   quickNoteState=store.get('quickNoteState',quickNoteState);applyQuickNoteState();document.getElementById('quickNote').value=store.get('quickNote','');keys=store.get('keys',{...defaults});
   renderAll();
  `);
 };
 const schedule=()=>{clearTimeout(refresh);refresh=setTimeout(refreshData,100)};
 document.addEventListener('focusout',()=>{if(deferred)schedule()});
 window.addEventListener('domos-editor-closed',()=>{if(deferred)schedule()});
 window.addEventListener('storage',event=>{
  if(event.key===SETTINGS_KEY){settings=readJSON(SETTINGS_KEY,DEFAULT_SETTINGS);applySettings();return}
  if(event.key===TIMER_KEY){renderWorkTimer();return}
  if(!event.key?.startsWith(PREFIX))return;
  if(event.key===PREFIX+'quickNote'){const note=document.getElementById('quickNote');if(note&&document.activeElement!==note)note.value=appGet('quickNote','');else deferred=true;return}
  schedule();
 });
}
function applyStartPage(){const last=localStorage.getItem('domos612.lastPage'),page=settings.rememberLastPage&&last?last:settings.defaultPage;if(page&&page!=='dashboard')setTimeout(()=>showPage(page),30)}

export function initV612(){
 settings=readJSON(SETTINGS_KEY,DEFAULT_SETTINGS);settings.displayName=window.DOMOSProfile?.name||settings.displayName;

 window.DOMOS612={...(window.DOMOS612||{}),enterPopoutMode};
 applySettings();removePinnedSidebar();installDashboardRegistry();buildSettingsShell();interceptPopouts();initUpdaterSubscription();syncOtherWindows();window.DOMOS612.renderSettings=renderSettings;window.DOMOS612.openNativePopout=openNativePopout;
 const popout=new URLSearchParams(location.search).get('domosPopout');if(popout)enterPopoutMode(popout);else applyStartPage();
}
