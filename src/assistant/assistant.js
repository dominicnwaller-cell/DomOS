import {resolveTrackingCommand} from './tracking-commands.js';
import {resolveGoalCommand} from './goal-commands.js';
import {ProviderRegistry} from './providers.js';
import {dayInZone} from '../application/date-time.js';
export class DomAssistant {
 constructor(services,providers=new ProviderRegistry()){this.services=services;this.providers=providers;}
 async run(context,command,providerId='Local'){
  this.services.context(context);const provider=this.providers.get(providerId),meta={source:'assistant',provider:provider.id,command};let parsed;
  try{parsed=await provider.interpret(command)}catch(error){await this.services.recordFailure(context,{action:'provider.unavailable'},meta,error);throw error}
  if(parsed.kind==='unknown'){await this.services.recordFailure(context,{action:'unrecognized'},meta,parsed.message);return {status:'unknown',message:parsed.message}}
  if(parsed.kind==='goal-resolve'){try{parsed.request=resolveGoalCommand(this.services,context,parsed)}catch(error){await this.services.recordFailure(context,{action:parsed.operation,name:parsed.name},meta,error);return {status:'unknown',message:error.message}}}
  if(parsed.kind==='tracking-resolve'){try{parsed.request=resolveTrackingCommand(this.services,context,parsed)}catch(error){await this.services.recordFailure(context,{action:parsed.operation,name:parsed.name},meta,error);return {status:'unknown',message:error.message}}}
  if(parsed.kind==='search-resolve'){const matches=this.services.plan(context,{action:'search.get',query:parsed.query}).result.matches;parsed.request=matches.length===1?{action:'source.open',kind:matches[0].kind,id:matches[0].id}:{action:'search.get',query:parsed.query};}
  if(parsed.kind==='snooze-resolve'){const a=this.services.plan(context,{action:'notification.get'}).result.attention,items=[...a.needs,...a.upcoming].filter(x=>!x.state.dismissedAt).sort((a,b)=>a.due-b.due),first=items[0];if(!first||items.filter(x=>Math.abs(x.due-first.due)<30000).length!==1){const message='Choose the reminder to snooze in the Attention Centre.';await this.services.recordFailure(context,{action:'notification.snooze'},meta,message);return {status:'unknown',message}}parsed.request={action:'notification.snooze',id:first.id,minutes:10};}
  if(parsed.kind==='resolve'){
   const candidates=[],name=parsed.name.toLowerCase();
   const day=dayInZone(this.services.now(),this.services.storage.profile.preferences?.timeZone),weekDay=['sun','mon','tue','wed','thu','fri','sat'][new Date(day+'T12:00:00Z').getUTCDay()],checks=this.services.read(context,'lifeos4.routineChecks',{});
   for(const task of this.services.read(context,'lifeos4.tasks',[]))if(String(task.title).toLowerCase()===name&&!['completed','archived'].includes(task.status))candidates.push({action:'task.complete',id:task.id});
   for(const routine of this.services.read(context,'lifeos4.routines',[]))if(routine.active!==false&&(!routine.days||routine.days.includes(weekDay))&&(!routine.start||routine.start<=day)&&(!routine.end||routine.end>=day))routine.steps?.forEach((step,stepIndex)=>{if(String(step.name).toLowerCase()===name&&!checks[`${day}|${routine.id}|${stepIndex}`])candidates.push({action:'routine.complete',routineId:routine.id,stepIndex})});
   for(const habit of this.services.read(context,'lifeos4.habits',[]))if(habit.name.toLowerCase()===name)candidates.push({action:'habit.log',id:habit.id});
   const links=this.services.read(context,'lifeos4.habitLinks',[]),routines=this.services.read(context,'lifeos4.routines',[]);if(candidates.length===2){const r=candidates.find(x=>x.action==='routine.complete'),h=candidates.find(x=>x.action==='habit.log');if(r&&h&&links.some(l=>l.habitId===h.id&&l.routineId===r.routineId&&l.stepId===routines.find(x=>x.id===r.routineId)?.steps[r.stepIndex]?.id))candidates.splice(candidates.indexOf(h),1);}
   if(candidates.length!==1){const message=candidates.length?'Several items match. Please open the item you want to complete.':'I couldn’t find one unfinished item with that name.';await this.services.recordFailure(context,{action:'resolve.complete',name:parsed.name},meta,message);return {status:'unknown',message}}
   parsed.request=candidates[0];
  }
  if(!this.services.storage.getItem('lifeos4.financeDomain')&&parsed.request.currency&&parsed.request.currency!==(this.services.storage.profile.preferences?.currency||'GBP')){const message='That amount uses GBP. Change the profile currency or enter the transaction in Finances.';await this.services.recordFailure(context,parsed.request,meta,message);return {status:'unknown',message}}
  return this.services.execute(context,parsed.request,meta);
 }
}
