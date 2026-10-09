import {TRACKER_TEMPLATES,trackingData,habitView,validateHabit,validDay,habitDue,isPaused,habitSummary,trackerView,validateTracker,validateTrackerValue,trackerSummary,trackingWeekSummary} from './habits-trackers.js';
import {dayInZone,profileZone,shiftDay} from './date-time.js';

const allowedPatch=(patch,fields)=>{if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!fields.includes(k)))throw Error('Invalid changes.');return patch};
function linksInProfile(data,record){for(const [field,key] of [['lifeAreaId','lifeAreas'],['goalId','goals'],['objectiveId','objectives']])if(record[field]&&!data[key].some(x=>x.id===record[field]))throw Error('Choose linked records in this profile.');if(record.objectiveId){const o=data.objectives.find(x=>x.id===record.objectiveId);if(record.goalId&&o.goalId!==record.goalId)throw Error('Objective belongs to another goal.');record.goalId=o.goalId;}return record;}
function source(request){const value=request.source||'manual';if(!['manual','routine','assistant','integration'].includes(value))throw Error('Invalid log source.');if(request.sourceReference!==undefined&&(typeof request.sourceReference!=='string'||request.sourceReference.length>300))throw Error('Invalid source reference.');return {source:value,sourceReference:request.sourceReference||null};}
function instant(request,now){const value=request.timestamp??new Date(now).toISOString();if(typeof value!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('Choose a timestamp with a timezone.');return new Date(value).toISOString();}
function note(value){if(value!==undefined&&(typeof value!=='string'||value.length>2000))throw Error('Use a note up to 2000 characters.');return value||'';}
export function planTrackingAction(services,context,request){
 const a=request.action;if(!/^(habit\.|tracker\.|tracking\.)/.test(a))return null;
 const data=trackingData(services,context),now=services.now(),timestamp=new Date(now).toISOString(),zone=profileZone(services.storage.profile.preferences),day=dayInZone(now,zone),options={zone,weekStart:services.storage.profile.preferences?.weekStart??1},changes={};let risk='low-risk-write',result={};
 const put=(key,records)=>{data[key]=records;changes['lifeos4.'+key]=JSON.stringify(records)},find=(key,id=request.id)=>{const r=data[key].find(x=>x.id===id);if(!r)throw Error('That item is no longer available in this profile.');return r},active=(key)=>{const r=find(key);if(r.archived||r.active===false)throw Error('Restore this archived item before logging.');return r};
 if(['habit.draft','tracker.draft'].includes(a))return {risk:'safe-read',changes,result:{draft:true,kind:a.split('.')[0]}};
 if(a==='tracking.week')return {risk:'safe-read',changes,result:trackingWeekSummary(data,validDay(request.date||day),options)};
 if(a==='habit.list')return {risk:'safe-read',changes,result:{habits:data.habits.filter(x=>request.archived||!habitView(x,day).archived).map(x=>habitSummary(data,x,day,options))}};
 if(a==='habit.progress')return {risk:'safe-read',changes,result:habitSummary(data,find('habits'),validDay(request.date||day),options)};
 if(a==='tracker.list')return {risk:'safe-read',changes,result:{trackers:data.trackers.filter(x=>request.archived||!x.archived).map(x=>trackerSummary(data,x,day,options))}};
 if(['tracker.show','tracker.trend'].includes(a))return {risk:'safe-read',changes,result:trackerSummary(data,find('trackers'),validDay(request.date||day),{...options,days:request.days===undefined?30:([7,30,90,365].includes(request.days)?request.days:(()=>{throw Error('Choose a supported trend range.');})())})};
 if(a==='tracker.checkin')return {risk:'safe-read',changes,result:{trackers:[...data.trackerPins].sort((x,y)=>x.order-y.order).map(p=>data.trackers.find(x=>x.id===p.trackerId)).filter(x=>x&&!x.archived).map(x=>trackerSummary(data,x,day,options))}};
 if(a==='habit.create'){
  const h=linksInProfile(data,validateHabit({id:services.uuid(),name:request.name,mode:request.mode||'completion',direction:request.direction||'atLeast',target:request.target??1,minimum:request.minimum??null,unit:request.unit||'',schedule:request.schedule||{kind:'daily'},startDate:validDay(request.startDate||day),createdAt:timestamp,archived:false,lifeAreaId:request.lifeAreaId||null,goalId:request.goalId||null,objectiveId:request.objectiveId||null}));put('habits',[...data.habits,h]);result.item=h;
 }else if(a==='habit.update'){
  const h=find('habits'),patch=allowedPatch(request.patch,['name','mode','direction','target','minimum','unit','schedule','cue','reminderTime','lifeAreaId','goalId','objectiveId']);const next=linksInProfile(data,validateHabit({...habitView(h,day),...patch}));put('habits',data.habits.map(x=>x.id===h.id?next:x));result.item=next;
 }else if(['habit.archive','habit.restore'].includes(a)){const h=find('habits'),archiving=a.endsWith('archive');
  if(archiving&&!h.archived)put('habitPausePeriods',[...data.habitPausePeriods,{id:services.uuid(),habitId:h.id,startDate:shiftDay(day,1),endDate:null,reason:'archive',createdAt:timestamp}]);
  if(!archiving){for(const p of data.habitPausePeriods)if(p.habitId===h.id&&p.reason==='archive'&&!p.endDate)p.endDate=day<p.startDate?p.startDate:day;put('habitPausePeriods',data.habitPausePeriods);}
  h.archived=archiving;h.active=!h.archived;h.archivedAt=h.archived?timestamp:null;put('habits',data.habits);result.item=h;
 }else if(a==='habit.pause'){
  const h=active('habits'),startDate=validDay(request.date||day),endDate=request.until?validDay(request.until):null;if(endDate&&endDate<=startDate)throw Error('Pause until must be after the start.');if(isPaused(data,h.id,startDate))throw Error('This habit is already paused.');const p={id:services.uuid(),habitId:h.id,startDate,endDate,createdAt:timestamp};put('habitPausePeriods',[...data.habitPausePeriods,p]);result.item=p;
 }else if(a==='habit.resume'){
  const h=find('habits'),selected=validDay(request.date||day);for(const p of data.habitPausePeriods)if(p.habitId===h.id&&p.startDate<=selected&&(!p.endDate||selected<p.endDate))p.endDate=selected;put('habitPausePeriods',data.habitPausePeriods);result.item=h;
 }else if(['habit.log','habit.skip','habit.log.update'].includes(a)){
  const old=a==='habit.log.update'?find('habitLogs'):null,h=habitView(old?find('habits',old.habitId):active('habits'),day),selected=validDay(request.date||old?.date||day);if(isPaused(data,h.id,selected))throw Error('Resume this habit before logging in a paused period.');
  if(a==='habit.skip'&&!habitDue(data,h,selected))throw Error('Only a scheduled opportunity can be skipped.');
  const value=a==='habit.skip'?false:request.value??old?.value??(h.mode==='completion'?true:1);if(h.mode==='completion'&&typeof value!=='boolean')throw Error('Choose completion or no completion.');if(a!=='habit.skip'&&h.mode!=='completion'&&(typeof value!=='number'||!Number.isFinite(value)||value<0||h.mode==='count'&&!Number.isInteger(value)))throw Error('Enter a valid habit amount.');
  const metadata=old?{source:old.source||'manual',sourceReference:old.sourceReference||null}:source(request),duplicate=metadata.sourceReference&&data.habitLogs.find(x=>x.habitId===h.id&&x.source===metadata.source&&x.sourceReference===metadata.sourceReference);
  if(duplicate&&!old)return {risk,changes,result:{item:duplicate,idempotent:true}};
  const record={...(old||{}),id:old?.id||services.uuid(),habitId:h.id,date:selected,timestamp:instant(request,now),value,...metadata,state:a==='habit.skip'?'SKIPPED':undefined,note:note(request.note??old?.note)};put('habitLogs',old?data.habitLogs.map(x=>x.id===old.id?record:x):[...data.habitLogs,record]);result.item=record;
 }else if(a==='habit.linkRoutine'){
  const h=active('habits'),r=find('routines',request.routineId),step=r.steps?.[request.stepIndex];if(!step)throw Error('Choose a routine step in this profile.');if(!step.id)step.id=services.uuid();
  if(data.habitLinks.some(x=>x.routineId===r.id&&x.stepId===step.id&&x.habitId!==h.id))throw Error('That step already logs another habit.');
  const link=data.habitLinks.find(x=>x.routineId===r.id&&x.stepId===step.id&&x.habitId===h.id)||{id:services.uuid(),habitId:h.id,routineId:r.id,stepId:step.id,stepIndex:request.stepIndex,value:request.value??(habitView(h,day).mode==='completion'?true:habitView(h,day).target)};
  const hv=habitView(h,day);if(hv.mode==='completion'?typeof link.value!=='boolean':typeof link.value!=='number'||!Number.isFinite(link.value)||link.value<0)throw Error('Choose a valid automatic log amount.');
  put('routines',data.routines);if(!data.habitLinks.some(x=>x.id===link.id))put('habitLinks',[...data.habitLinks,link]);result.item=link;
 }else if(a==='habit.unlinkRoutine'){find('habitLinks');put('habitLinks',data.habitLinks.filter(x=>x.id!==request.id));
 }else if(a==='habit.delete'){
  const h=find('habits');put('habits',data.habits.filter(x=>x.id!==h.id));for(const key of ['habitLogs','habitLinks','habitPausePeriods'])put(key,data[key].filter(x=>x.habitId!==h.id));put('goalActionLinks',data.goalActionLinks.filter(x=>!(x.kind==='habit'&&x.actionId===h.id)));risk='always-confirm';result.item=h;
 }else if(a==='tracker.create'){
  const template=request.template?TRACKER_TEMPLATES[request.template]:{};if(!template)throw Error('Choose a known tracker template.');const t=validateTracker({id:services.uuid(),name:request.name||template.name,type:request.type||template.type||'rating',aggregation:request.aggregation||template.aggregation||'average',unit:request.unit??template.unit??'',min:request.min??1,max:request.max??5,direction:request.direction||'neutral',createdAt:timestamp,archived:false});put('trackers',[...data.trackers,t]);result.item=t;
 }else if(a==='tracker.update'){
  const t=find('trackers'),patch=allowedPatch(request.patch,['name','aggregation','direction','unit','min','max']);const next=validateTracker({...trackerView(t),...patch});for(const entry of data.trackerEntries.filter(x=>x.trackerId===t.id))validateTrackerValue(next,entry.value);put('trackers',data.trackers.map(x=>x.id===t.id?next:x));result.item=next;
 }else if(['tracker.archive','tracker.restore'].includes(a)){
  const t=find('trackers');t.archived=a.endsWith('archive');put('trackers',data.trackers);if(t.archived)put('trackerPins',data.trackerPins.filter(x=>x.trackerId!==t.id));result.item=t;
 }else if(['tracker.log','tracker.entry.update'].includes(a)){
  const old=a==='tracker.entry.update'?find('trackerEntries'):null,t=old?find('trackers',old.trackerId):active('trackers'),entryTime=instant(request,now),value=validateTrackerValue(t,request.value??old?.value),record={...(old||{}),id:old?.id||services.uuid(),trackerId:t.id,value,timestamp:old&&!request.timestamp?old.timestamp:entryTime,date:old&&!request.timestamp&&!old.timestamp?old.date:dayInZone(old&&!request.timestamp?old.timestamp:entryTime,zone),note:note(request.note??old?.note),...(old?{source:old.source||'manual',sourceReference:old.sourceReference||null}:source(request))};
  if(old&&request.timestamp&&record.timestamp!==old.timestamp){delete record.appliesToDate;delete record.attributionTimezone;delete record.reviewPeriodKey;}if(request.date&&validDay(request.date)!==record.date)throw Error('Tracker day must match its timestamp in this profile.');put('trackerEntries',old?data.trackerEntries.map(x=>x.id===old.id?record:x):[...data.trackerEntries,record]);result.item=record;
 }else if(a==='tracker.entry.delete'){const entry=find('trackerEntries');put('trackerEntries',data.trackerEntries.filter(x=>x.id!==entry.id));risk='always-confirm';result.item=entry;
 }else if(a==='tracker.pin'){
  const t=active('trackers');if(!data.trackerPins.some(x=>x.trackerId===t.id)){if(data.trackerPins.length>=5)throw Error('Quick Check-In holds up to five trackers.');put('trackerPins',[...data.trackerPins,{id:services.uuid(),trackerId:t.id,order:data.trackerPins.length}]);}result.item=t;
 }else if(a==='tracker.unpin'){find('trackers');put('trackerPins',data.trackerPins.filter(x=>x.trackerId!==request.id));
 }else if(a==='tracker.pins.reorder'){
  if(!Array.isArray(request.ids)||request.ids.length!==data.trackerPins.length||new Set(request.ids).size!==request.ids.length||request.ids.some(id=>!data.trackerPins.some(x=>x.trackerId===id)))throw Error('Choose every pinned tracker once.');put('trackerPins',request.ids.map((id,order)=>({...data.trackerPins.find(x=>x.trackerId===id),order})));
 }else throw Error('Unknown tracking action.');
 // Habit support uses the existing canonical goal relationship, never an implicit percentage.
 if(['habit.create','habit.update'].includes(a)){
  const h=result.item;put('goalActionLinks',data.goalActionLinks.filter(x=>!(x.kind==='habit'&&x.actionId===h.id&&x.trackingSupport)));
  if(h.goalId&&!data.goalActionLinks.some(x=>x.kind==='habit'&&x.actionId===h.id&&x.goalId===h.goalId&&x.objectiveId===(h.objectiveId||null)))put('goalActionLinks',[...data.goalActionLinks,{id:services.uuid(),kind:'habit',actionId:h.id,goalId:h.goalId,objectiveId:h.objectiveId||null,includeProgress:false,trackingSupport:true}]);
 }
 return {risk,changes,before:Object.fromEntries(Object.keys(changes).map(k=>[k,services.storage.getItem(k)])),result};
}

// Called by both semantic actions and the existing Routine UI bridge.
export function routineHabitChanges(data,changes,{now,uuid,zone}){
 if(!('lifeos4.routineChecks' in changes))return {};
 const checks=JSON.parse(changes['lifeos4.routineChecks']||'{}'),previous=data.routineChecks||{},routines='lifeos4.routines' in changes?JSON.parse(changes['lifeos4.routines']):data.routines,logs=structuredClone(data.habitLogs||[]);let modified=false;
 for(const [key,done] of Object.entries({...previous,...checks})){
  if(Boolean(previous[key])===Boolean(checks[key]))continue;const [date,routineId,index]=key.split('|'),r=routines.find(x=>x.id===routineId),step=r?.steps?.[Number(index)];if(!step)continue;
  for(const link of data.habitLinks.filter(x=>x.routineId===routineId&&x.stepId===step.id)){
   const h=data.habits.find(x=>x.id===link.habitId);if(!h||habitView(h,date).archived||isPaused(data,h.id,date))continue;const ref=`${date}|${routineId}|${step.id}`,existing=logs.find(x=>x.habitId===h.id&&x.source==='routine'&&x.sourceReference===ref);
   if(checks[key]){if(existing){if(existing.revoked){existing.value=existing.originalValue;existing.revoked=false;modified=true;}}else{logs.push({id:uuid(),habitId:h.id,date,timestamp:new Date(now).toISOString(),value:link.value,source:'routine',sourceReference:ref});modified=true;}}
   else if(existing&&!existing.revoked){existing.originalValue=existing.value;existing.value=false;existing.revoked=true;modified=true;}
  }
 }
 return modified?{'lifeos4.habitLogs':JSON.stringify(logs)}:{};
}
