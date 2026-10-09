import {trackingData,habitView,habitDue} from '../application/habits-trackers.js';
import {dayInZone,profileZone,shiftDay} from '../application/date-time.js';
import {routineItems} from '../application/life-tracking.js';
const direct=(id,label,action,aliases=[])=>({id,label,completion:label,aliases,description:'Local profile Tracking',parse:input=>[label,...aliases].some(x=>x.toLowerCase()===input.toLowerCase())?{kind:'action',request:{action}}:null});
const named=(id,label,operation,pattern)=>({id,label,completion:label+' ',aliases:[],takesDetails:true,description:'Use the exact Habit or Tracker name',parse:input=>{const m=pattern.exec(input);return m?{kind:'tracking-resolve',operation,name:m[1].trim(),value:m[2]}:null}});
const words={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,twenty:20,thirty:30,forty:40,fifty:50};
const numeral=v=>Object.hasOwn(words,v.toLowerCase())?words[v.toLowerCase()]:/^\d+(?:\.\d+)?$/.test(v)?Number(v):null;
export const TRACKING_COMMANDS=[
 direct('habits-show','Show my habits','habit.list',['Show habits']),direct('trackers-show','Show trackers','tracker.list'),direct('checkin-show','Show quick check-in','tracker.checkin'),
 direct('habit-draft','New habit','habit.draft'),direct('tracker-draft','New tracker','tracker.draft'),
 {id:'habit-add',label:'Add habit',completion:'Add habit ',aliases:[],takesDetails:true,description:'Name, optionally 4 times per week',parse:input=>{const m=/^add habit (.+?)(?: (\d+) times per (week|month))?$/i.exec(input);return m?{kind:'action',request:{action:'habit.create',name:m[1],...(m[2]?{schedule:{kind:m[3].toLowerCase()==='week'?'weekly':'monthly',quota:Number(m[2])}}:{})}}:null}},
 {id:'tracker-add',label:'Add tracker',completion:'Add tracker ',aliases:[],takesDetails:true,description:'Name — starts with a 1–5 rating',parse:input=>{const m=/^add tracker (.+)$/i.exec(input);return m?{kind:'action',request:{action:'tracker.create',name:m[1]}}:null}},
 named('habit-skip','Skip habit','habit.skip',/^skip (?:habit )?(.+?) today$/i),
 named('habit-pause','Pause habit','habit.pause',/^pause (?:habit )?(.+?)(?: until (\d{4}-\d{2}-\d{2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday))?$/i),
 named('habit-resume','Resume habit','habit.resume',/^resume (?:habit )?(.+)$/i),named('habit-archive','Archive habit','habit.archive',/^archive habit (.+)$/i),
 named('habit-progress','Show habit progress','habit.progress',/^show habit progress (.+)$/i),named('tracker-show','Show tracker','tracker.show',/^show tracker (.+)$/i),
 {id:'habit-log',label:'Log habit',completion:'Log habit ',aliases:[],takesDetails:true,description:'Name done, or Log 30 minutes reading',parse:input=>{if(/^complete /i.test(input))return null;const amount=/^log (\d+(?:\.\d+)?) minutes (.+)$/i.exec(input);if(amount)return {kind:'tracking-resolve',operation:'habit.log',name:amount[2],value:Number(amount[1]),mode:'duration'};const m=/^(?:log habit )?(.+?) done$/i.exec(input);return m?{kind:'tracking-resolve',operation:'habit.done',name:m[1]}:null}},
 {id:'tracker-log',label:'Log tracker',completion:'Log tracker ',aliases:[],takesDetails:true,description:'Mood four, Energy two, or Log tracker Name 3',parse:input=>{const sleep=/^slept (\w+) hours(?: (\w+))?$/i.exec(input);if(sleep){const hours=numeral(sleep[1]),mins=sleep[2]?numeral(sleep[2]):0;return hours!==null&&mins!==null&&mins<60?{kind:'tracking-resolve',operation:'tracker.log',name:'Sleep',value:hours*60+mins}:null;}const m=/^(?:log tracker )?(.+?) (\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|yes|no)$/i.exec(input);if(m&&!/^log tracker /i.test(input)&&/\s/.test(m[1]))return null;return m?{kind:'tracking-resolve',operation:'tracker.log',name:m[1],value:/^(yes|no)$/i.test(m[2])?m[2].toLowerCase()==='yes':numeral(m[2])}:null}},
 {id:'tracker-trend',label:'Show tracker trend',completion:'Show tracker trend ',aliases:[],takesDetails:true,description:'Name or Show energy this week',parse:input=>{const m=/^show (?:tracker trend )?(.+?) this week$/i.exec(input);return m?{kind:'tracking-resolve',operation:'tracker.trend',name:m[1],days:7}:null}}
];
export function resolveTrackingCommand(services,context,parsed){
 const d=trackingData(services,context),zone=profileZone(services.storage.profile.preferences),day=dayInZone(services.now(),zone),key=parsed.operation.startsWith('tracker.')?'trackers':'habits',matches=d[key].filter(x=>(x.name||x.title||'').toLowerCase()===parsed.name.toLowerCase()&&!x.archived&&x.active!==false);if(matches.length!==1)throw Error(matches.length?'Several items have that name. Please choose one in Tracking.':'I couldn’t find a uniquely named '+(key==='habits'?'Habit':'Tracker')+'.');
 const item=matches[0];if(parsed.mode&&habitView(item,day).mode!==parsed.mode)throw Error('That Habit uses a different measurement. Please log it in Tracking.');
 if(parsed.operation==='habit.done'){
  if(habitView(item,day).mode!=='completion')throw Error('This habit needs an amount. Please log it in Tracking.');
  const due=routineItems({...d,routineExceptions:services.read(context,'lifeos4.routineExceptions',[])},day).filter(x=>d.habitLinks.some(l=>l.habitId===item.id&&l.routineId===x.sourceId&&l.stepId===d.routines.find(r=>r.id===x.sourceId)?.steps[x.stepIndex]?.id));
  if(due.length>1)throw Error('Several linked Routine occurrences are due. Choose the one you completed.');if(due.length===1)return {action:'routine.complete',routineId:due[0].sourceId,stepIndex:due[0].stepIndex,date:day};return {action:'habit.log',id:item.id,value:true,source:'assistant'};
 }
 let until;if(parsed.operation==='habit.pause'&&parsed.value){if(/^\d{4}/.test(parsed.value))until=parsed.value;else{const weekday=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(parsed.value.toLowerCase()),current=new Date(day+'T12:00:00Z').getUTCDay();until=shiftDay(day,(weekday-current+7)%7||7);}}
 return {action:parsed.operation,id:item.id,...(parsed.operation.endsWith('.log')?{value:parsed.value,source:'assistant'}:{}),...(until?{until}:{}),...(parsed.days?{days:parsed.days}:{}),...(parsed.operation==='habit.skip'?{date:day}:{})};
}
