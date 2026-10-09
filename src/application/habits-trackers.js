import {dayInZone,shiftDay,profileZone} from './date-time.js';

export const TRACKING_COLLECTIONS=['habits','habitLogs','habitPausePeriods','habitLinks','trackers','trackerEntries','trackerPins','routines','routineChecks','lifeAreas','goals','objectives','goalActionLinks'];
export function trackingData(services,context){return Object.fromEntries(TRACKING_COLLECTIONS.map(key=>[key,services.read(context,'lifeos4.'+key,key==='routineChecks'?{}:[])]))}
export const HABIT_MODES=['completion','count','duration','quantity'];
export const TRACKER_TYPES=['rating','number','count','duration','yesno','time'];
export const TRACKER_TEMPLATES=Object.freeze({
 mood:{name:'Mood',type:'rating',aggregation:'average'},energy:{name:'Energy',type:'rating',aggregation:'average'},stress:{name:'Stress',type:'rating',aggregation:'average'},
 sleep:{name:'Sleep',type:'duration',aggregation:'latest',unit:'minutes'},weight:{name:'Weight',type:'number',aggregation:'latest',unit:'kg'},water:{name:'Water',type:'number',aggregation:'total',unit:'ml'}
});
export function validDay(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw Error('Choose a valid date.');return value}
const finite=(v,label,min=0)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min)throw Error('Enter a valid '+label+'.');return v};
const named=v=>{if(typeof v!=='string'||!v.trim()||v.length>160)throw Error('Enter a name (up to 160 characters).');return v.trim()};
const choice=(v,values,label)=>{if(!values.includes(v))throw Error('Choose a valid '+label+'.');return v};
const weekday=day=>new Date(day+'T12:00:00Z').getUTCDay();
const daysBetween=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
function monthShift(day,count){const d=new Date(day+'T12:00:00Z'),date=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+count);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(date,last));return d.toISOString().slice(0,10)}
export function habitView(raw,today=dayInZone()) {return {...raw,name:raw.name||raw.title,mode:raw.mode||'completion',direction:raw.direction||'atLeast',target:raw.target??1,minimum:raw.minimum??null,unit:raw.unit||'',schedule:raw.schedule||{kind:'daily'},startDate:raw.startDate||raw.createdAt?.slice(0,10)||today,archived:raw.archived===true||raw.active===false}}
export function validateHabit(raw){
 const h={...raw,name:named(raw.name),mode:choice(raw.mode||'completion',HABIT_MODES,'measurement'),direction:choice(raw.direction||'atLeast',['atLeast','atMost'],'target direction'),target:finite(raw.target??1,'target'),minimum:raw.minimum??null};
 if(h.direction==='atLeast'&&h.target<=0)throw Error('Target must be greater than zero.');
 if(h.minimum!==null){finite(h.minimum,'minimum',0.000001);if(h.direction!=='atLeast'||h.minimum>h.target)throw Error('Minimum must not exceed an AT LEAST target.');}
 const s={...(raw.schedule||{kind:'daily'})};choice(s.kind,['daily','weekdays','weekly','monthly','interval'],'frequency');
 if(s.kind==='weekdays'){if(!Array.isArray(s.days)||!s.days.length||new Set(s.days).size!==s.days.length||s.days.some(x=>!Number.isInteger(x)||x<0||x>6))throw Error('Choose at least one weekday.');}
 if(s.kind==='interval'){choice(s.unit,['days','weeks','months'],'interval unit');finite(s.every,'interval',1);if(!Number.isInteger(s.every)||s.every>365)throw Error('Choose an interval from 1 to 365.');}
 if(['weekly','monthly'].includes(s.kind)){finite(s.quota,'period target',1);if(!Number.isInteger(s.quota)||s.quota>10000)throw Error('Choose a whole-number period target.');}
 validDay(h.startDate);for(const key of ['cue','reminderTime','unit'])if(raw[key]!==undefined&&(typeof raw[key]!=='string'||raw[key].length>200))throw Error('Invalid habit '+key+'.');
 if(raw.reminderTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.reminderTime))throw Error('Choose a valid reminder time.');
 return {...h,schedule:s};
}
export function isPaused(data,id,day){return (data.habitPausePeriods||[]).some(p=>p.habitId===id&&p.startDate<=day&&(!p.endDate||day<p.endDate))}
export function habitDue(data,raw,day){const h=habitView(raw,day),s=h.schedule;if(h.archived||day<h.startDate||isPaused(data,h.id,day)||['weekly','monthly'].includes(s.kind))return false;
 if(s.kind==='daily')return true;if(s.kind==='weekdays')return s.days.includes(weekday(day));
 if(s.unit==='months'){const a=new Date(h.startDate+'T12:00:00Z'),b=new Date(day+'T12:00:00Z'),months=(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth();return months>=0&&months%s.every===0&&monthShift(h.startDate,months)===day;}
 return daysBetween(h.startDate,day)% (s.every*(s.unit==='weeks'?7:1))===0;
}
export function habitLogDay(log,zone){return log.date||dayInZone(log.timestamp,zone)}
export function trackerEntryDay(entry,zone){return entry.appliesToDate|| (entry.timestamp&&Number.isFinite(Date.parse(entry.timestamp))?dayInZone(entry.timestamp,zone):entry.date)}
export function habitValue(h,logs){return logs.filter(x=>x.state!=='SKIPPED'&&!x.revoked).reduce((n,x)=>n+(h.mode==='completion'?(x.value===false?0:1):Number(x.value)||0),0)}
export function habitDayStatus(data,raw,day,{zone}={}){const h=habitView(raw,day),logs=(data.habitLogs||[]).filter(l=>l.habitId===h.id&&habitLogDay(l,zone)===day),value=habitValue(h,logs),logged=logs.some(l=>l.state!=='SKIPPED'&&!l.revoked);
 // An unlogged AT MOST day is unknown, never evidence of staying within target.
 const state=logs.some(l=>l.state==='SKIPPED')&&!logged?'SKIPPED':!logged?'NO_COMPLETION':h.direction==='atMost'?(value<=h.target?'TARGET_MET':'PARTIAL'):value<=0?'NO_COMPLETION':value>=h.target?'TARGET_MET':h.minimum!==null&&value>=h.minimum?'MINIMUM_MET':'PARTIAL';
 return {day,value,state,logged,logs,expected:habitDue(data,h,day),withinTarget:h.direction==='atMost'&&logged?value<=h.target:null};
}
export function quotaValue(h,logs){return logs.filter(x=>x.state!=='SKIPPED'&&!x.revoked&&(h.mode==='completion'?x.value!==false:Number(x.value)>=h.target)).length}
export function habitPeriod(raw,day,weekStart=1){const h=habitView(raw,day);if(h.schedule.kind==='monthly')return {start:day.slice(0,7)+'-01',end:monthShift(day.slice(0,7)+'-01',1),kind:'monthly'};const start=shiftDay(day,-((weekday(day)-weekStart+7)%7));return {start,end:shiftDay(start,7),kind:'weekly'}}
export function habitSummary(data,raw,day,{zone,weekStart=1,lookback=30}={}){
 const h=habitView(raw,day),period=habitPeriod(h,day,weekStart),quota=['weekly','monthly'].includes(h.schedule.kind),logs=(data.habitLogs||[]).filter(x=>x.habitId===h.id&&habitLogDay(x,zone)>=period.start&&habitLogDay(x,zone)<period.end),value=quota?quotaValue(h,logs):habitValue(h,logs),target=quota?h.schedule.quota:h.target;
 const opportunities=[];for(let d=shiftDay(day,-lookback+1);d<=day;d=shiftDay(d,1))if(habitDue(data,{...h,archived:false,active:true},d))opportunities.push(habitDayStatus(data,h,d,{zone}));
 const eligible=opportunities.filter(x=>x.state!=='SKIPPED'&&(x.day<day||x.logged)&&(h.direction!=='atMost'||x.logged)),targetMet=eligible.filter(x=>x.state==='TARGET_MET').length,minimumMet=eligible.filter(x=>x.state==='MINIMUM_MET').length;
 const completedPeriods=[];if(quota){let start=period.start;for(let i=0;i<12;i++){const end=start;start=h.schedule.kind==='monthly'?monthShift(start,-1):shiftDay(start,-7);if(start<h.startDate)break;
  // Partial periods (pause or first start) are excluded, not treated as missed quotas.
  let paused=false;for(let d=start;d<end;d=shiftDay(d,1))if(isPaused(data,h.id,d)){paused=true;break;}if(paused)continue;
  const entries=(data.habitLogs||[]).filter(x=>x.habitId===h.id&&habitLogDay(x,zone)>=start&&habitLogDay(x,zone)<end),actual=quotaValue(h,entries),logged=entries.some(x=>x.state!=='SKIPPED');completedPeriods.push({start,end,value:actual,target,met:h.direction==='atMost'?(logged?actual<=target:null):actual>=target});
 }}
 return {habit:h,period,quota,value,target,paused:isPaused(data,h.id,day),today:quota?null:habitDayStatus(data,h,day,{zone}),opportunities,eligible:eligible.length,targetMet,minimumMet,consistency:eligible.length?Math.round((targetMet+minimumMet)/eligible.length*100):null,completedPeriods};
}
export function trackerView(raw){return {...raw,name:raw.name||raw.title,type:raw.type||'number',aggregation:raw.aggregation||'latest',min:raw.min??1,max:raw.max??5,direction:raw.direction||'neutral',unit:raw.unit||'',archived:raw.archived===true}}
export function validateTracker(raw){const t=trackerView(raw);t.name=named(t.name);choice(t.type,TRACKER_TYPES,'tracker type');choice(t.aggregation,['latest','average','total'],'daily summary');choice(t.direction,['neutral','higher','lower'],'desired direction');
 if(t.type==='rating'){finite(t.min,'scale minimum');finite(t.max,'scale maximum');if(t.max<=t.min||!Number.isInteger(t.min)||!Number.isInteger(t.max))throw Error('Choose a whole-number rating scale.');}
 if(['time','yesno'].includes(t.type)&&t.aggregation==='total'||t.type==='time'&&t.aggregation==='average')throw Error('This tracker type cannot use that summary.');
 if(typeof t.unit!=='string'||t.unit.length>40)throw Error('Choose a shorter unit.');return t;
}
export function validateTrackerValue(raw,value){const t=trackerView(raw);if(t.type==='yesno'){if(typeof value!=='boolean')throw Error('Choose Yes or No.');return value;}
 if(t.type==='time'){if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw Error('Choose a valid clock time.');return value;}
 finite(value,'tracker value',t.type==='number'?-Infinity:0);if(t.type==='rating'&&(value<t.min||value>t.max||!Number.isInteger(value)))throw Error('Choose a rating within the scale.');if(t.type==='count'&&!Number.isInteger(value))throw Error('Enter a whole-number count.');return value;
}
export function aggregateEntries(raw,entries){if(!entries.length)return null;const t=trackerView(raw),sorted=[...entries].sort((a,b)=>String(a.timestamp||a.date).localeCompare(String(b.timestamp||b.date)));if(t.aggregation==='latest')return sorted.at(-1).value;const values=sorted.map(x=>Number(x.value));return values.reduce((n,v)=>n+v,0)/(t.aggregation==='average'?values.length:1)}
export function trackerSummary(data,raw,day,{zone,days=30}={}){const t=trackerView(raw),entries=(data.trackerEntries||[]).filter(x=>x.trackerId===t.id).sort((a,b)=>String(b.timestamp||b.date).localeCompare(String(a.timestamp||a.date))),today=entries.filter(x=>trackerEntryDay(x,zone)===day),start=shiftDay(day,1-days),groups=new Map();for(const entry of entries){const d=trackerEntryDay(entry,zone);if(d>=start&&d<=day){if(!groups.has(d))groups.set(d,[]);groups.get(d).push(entry)}}
 const series=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,values])=>({date,value:aggregateEntries(t,values),count:values.length}));const numeric=series.filter(x=>typeof x.value==='number'||typeof x.value==='boolean').map(x=>Number(x.value));
 return {tracker:t,entries,today,latest:entries[0]||null,value:aggregateEntries(t,today),series,average:numeric.length?numeric.reduce((n,v)=>n+v,0)/numeric.length:null,change:numeric.length>=2?numeric.at(-1)-numeric[0]:null,yesRate:t.type==='yesno'&&numeric.length?numeric.reduce((n,v)=>n+v,0)/numeric.length:null};
}
export function trackingWeekSummary(data,day,options={}){
 const start=shiftDay(day,-((weekday(day)-(options.weekStart??1)+7)%7)),end=shiftDay(start,7);
 return {start,end,habits:(data.habits||[]).map(raw=>{const summary=habitSummary(data,raw,day,options);if(summary.quota)return {...summary,periodStatus:{value:summary.value,target:summary.target}};const opportunities=[];for(let d=start;d<=day&&d<end;d=shiftDay(d,1))if(habitDue(data,{...summary.habit,archived:false,active:true},d))opportunities.push(habitDayStatus(data,summary.habit,d,options));const eligible=opportunities.filter(x=>x.state!=='SKIPPED'&&(summary.habit.direction!=='atMost'||x.logged));return {...summary,periodStatus:{value:eligible.filter(x=>x.state==='TARGET_MET').length,minimumMet:eligible.filter(x=>x.state==='MINIMUM_MET').length,target:eligible.length}}}),trackers:(data.trackers||[]).map(t=>trackerSummary(data,t,day,{...options,days:daysBetween(start,day)+1}))};
}
export function trackingSearch(data,query){const q=query.trim().toLocaleLowerCase();if(!q)return [];return ['habits','trackers'].flatMap(key=>(data[key]||[]).filter(x=>!x.archived&&(x.name||x.title||'').toLocaleLowerCase().includes(q)).map(x=>({id:x.id,kind:key==='habits'?'habit':'tracker',name:x.name||x.title,label:key==='habits'?'Habit':'Tracker · '+trackerView(x).type}))).slice(0,20)}
