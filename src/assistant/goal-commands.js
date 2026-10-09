// Entries extend the same Local registry consumed by the parser and typeahead.
const exact=(id,label,action,description)=>({id,label,completion:label,aliases:[],description,actions:[action],parse:input=>input.toLowerCase()===label.toLowerCase()?{kind:'action',request:{action}}:null});
const named=(id,label,operation,description)=>({id,label,completion:label+' ',aliases:[],takesDetails:true,description,actions:[operation],parse:input=>input.toLowerCase().startsWith(label.toLowerCase()+' ')?{kind:'goal-resolve',operation,name:input.slice(label.length).trim()}:null});
export const GOAL_COMMANDS=[
 exact('goal-draft','Add goal','goal.draft','Create a simple Goal: name, area and type'),
 exact('objective-draft','Add objective','objective.draft','Add an optional Objective to the open Goal'),
 exact('area-draft','Add life area','area.draft','Create your own area of life'),
 exact('goals-list','Show goals','goals.get','Your Goals and their real progress'),
 exact('weekly-focus','Show weekly focus','focus.get','Up to three Focus items in this profile’s week'),
 named('goal-progress','Show goal progress','goal.progress','Enter the exact Goal name'),
 named('goal-time','Show goal time','goal.time','Actual linked time: today, week, month and lifetime'),
 named('area-view','Show life area','area.get','Enter the exact Life Area name'),
 named('goal-view','Open goal','goal.get','Enter the exact Goal name'),
 named('goal-pause','Pause goal','goal.pause','Pause without losing history'),
 named('goal-complete','Complete goal','goal.complete','Mark the named Goal complete'),
 named('goal-archive','Archive goal','goal.archive','Preserve actions, history, notes and time'),
 named('objective-complete','Complete objective','objective.complete','Enter the exact Objective name'),
 named('focus-set','Set weekly focus','focus.set','Enter an exact Goal or Objective name'),
 {id:'goal-capture',label:'Create goal',completion:'Create goal ',aliases:[],takesDetails:true,description:'Title in Life Area — or use Add goal for the simple form',actions:['goal.create'],parse:input=>{const m=/^(?:create|add) goal (.+) in (.+)$/i.exec(input);return m?{kind:'goal-resolve',operation:'goal.create',name:m[1],areaName:m[2]}:null}},
 {id:'objective-capture',label:'Create objective',completion:'Create objective ',aliases:[],takesDetails:true,description:'Title for Goal — or use Add objective in Goal Detail',actions:['objective.create'],parse:input=>{const m=/^(?:create|add) objective (.+) for (.+)$/i.exec(input);return m?{kind:'goal-resolve',operation:'objective.create',name:m[1],goalName:m[2]}:null}},
 {id:'goal-task-link',label:'Link task',completion:'Link task ',aliases:[],takesDetails:true,description:'Exact task name to goal / objective Exact name',actions:['goal.action.link'],parse:input=>{const m=/^link task (.+) to (goal|objective) (.+)$/i.exec(input);return m?{kind:'goal-resolve',operation:'goal.action.link',name:m[1],targetKind:m[2].toLowerCase(),targetName:m[3]}:null}},
 {id:'goal-work-link',label:'Link work session',completion:'Link work session ',aliases:[],takesDetails:true,description:'Exact session title to goal / objective Exact name',actions:['work.link'],parse:input=>{const m=/^link work session (.+) to (goal|objective) (.+)$/i.exec(input);return m?{kind:'goal-resolve',operation:'work.link',name:m[1],targetKind:m[2].toLowerCase(),targetName:m[3]}:null}},
 {id:'milestone-add',label:'Add milestone',completion:'Add milestone ',aliases:[],takesDetails:true,description:'Title for Goal',actions:['milestone.create'],parse:input=>{const m=/^add milestone (.+) for (.+)$/i.exec(input);return m?{kind:'goal-resolve',operation:'milestone.create',name:m[1],goalName:m[2]}:null}},
 named('milestone-complete','Complete milestone','milestone.complete','Enter an exact unique Milestone title'),
 named('goal-update','Rename goal','goal.rename','Current name to New name'),
 named('objective-update','Rename objective','objective.rename','Current name to New name')
];
export function resolveGoalCommand(services,context,parsed){const get=key=>services.read(context,'lifeos4.'+key,[]),match=(key,name)=>{const items=get(key).filter(x=>String(x.name||x.title).toLowerCase()===name.toLowerCase());if(items.length!==1)throw Error(items.length?'Several items match. Open the item you mean.':'No exact match in this profile.');return items[0]};
 const op=parsed.operation;
 if(op==='goal.create')return {action:op,name:parsed.name,lifeAreaId:match('lifeAreas',parsed.areaName).id};
 if(op==='objective.create'||op==='milestone.create')return {action:op,goalId:match('goals',parsed.goalName).id,[op==='objective.create'?'name':'title']:parsed.name};
 if(op==='focus.set'){const candidates=[...get('goals').filter(x=>x.name?.toLowerCase()===parsed.name.toLowerCase()).map(x=>({kind:'goal',id:x.id})),...get('objectives').filter(x=>x.name?.toLowerCase()===parsed.name.toLowerCase()).map(x=>({kind:'objective',id:x.id}))];if(candidates.length!==1)throw Error('Choose one uniquely named Goal or Objective.');return {action:op,kind:candidates[0].kind,targetId:candidates[0].id};}
 if(op==='goal.action.link'||op==='work.link'){const target=match(parsed.targetKind==='goal'?'goals':'objectives',parsed.targetName),record=match(op==='work.link'?'workSessions':'tasks',parsed.name);return {action:op,...(op==='work.link'?{id:record.id}:{kind:'task',actionId:record.id}),goalId:parsed.targetKind==='goal'?target.id:target.goalId,objectiveId:parsed.targetKind==='objective'?target.id:null};}
 if(op.endsWith('.rename')){const m=/^(.+) to (.+)$/i.exec(parsed.name);if(!m)throw Error('Use Current name to New name.');const key=op.startsWith('goal.')?'goals':'objectives',item=match(key,m[1]);return {action:op.replace('.rename','.update'),id:item.id,patch:{name:m[2]}};}
 const key=op.startsWith('goal.')?'goals':op.startsWith('objective.')?'objectives':op.startsWith('milestone.')?'goalMilestones':'lifeAreas';return {action:op,id:match(key,parsed.name).id};
}
