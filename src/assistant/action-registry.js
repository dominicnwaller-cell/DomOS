import {NOTIFICATION_COMMANDS} from './notification-commands.js';
import {FINANCE_COMMANDS} from './finance-commands.js';
import {REVIEW_COMMANDS} from './review-commands.js';
import {TRACKING_COMMANDS} from './tracking-commands.js';
import {GOAL_COMMANDS} from './goal-commands.js';
// One Local command registry drives parsing, help and autocomplete. No second UI list.
const direct=(id,label,aliases,request,description)=>({id,label,completion:label,aliases,description,parse:input=>[label,...aliases].some(x=>x.toLowerCase()===input.toLowerCase())?{kind:'action',request:{...request}}:null});
export const LOCAL_ACTIONS=Object.freeze([
 ...REVIEW_COMMANDS,
 direct('today','Show today',[],{action:'today.get'},'Your next tasks and schedule'),
 direct('calendar','Show calendar',['Open calendar'],{action:'navigate',page:'calendar'},'Day, week and month'),
 direct('finances','Open finances',[],{action:'navigate',page:'finances'},'Your local money overview'),
 direct('tasks','Show tasks',[],{action:'navigate',page:'tasks'},'Open Work Tasks'),
 direct('notes','Open notes',[],{action:'navigate',page:'notes'},'Capture or find a note'),
 direct('history','Show history',['Open history'],{action:'navigate',page:'history'},'Recorded effort and actual time'),
 ...['Start','Pause','Resume','Stop'].map(verb=>direct('work-'+verb.toLowerCase(),verb+' work',[],{action:'work.'+verb.toLowerCase()},verb+' the work timer')),
 direct('work-totals','What have I worked today?',['What have I worked today','Work totals'],{action:'work.totals'},'Actual work in this profile today'),
 direct('task-draft','New task',[],{action:'task.draft'},'Open the task editor'),
 direct('event-draft','New event',[],{action:'event.draft'},'Open the event editor'),
 {id:'task-add',label:'Add task',completion:'Add task ',aliases:[],takesDetails:true,description:'Type a task title — organise it later',parse:input=>{const match=/^(?:add task|new task)\s+(.+)$/i.exec(input);return match?{kind:'action',request:{action:'task.create',title:match[1]}}:null}},
 {id:'event-add',label:'Add event',completion:'Add event ',aliases:[],takesDetails:true,description:'Type a title — saved to today without a time',parse:input=>{const match=/^add event\s+(.+)$/i.exec(input);return match?{kind:'action',request:{action:'event.create',title:match[1],time:''}}:null}},
 {id:'expense-add',label:'Add expense',completion:'Add expense ',aliases:[],takesDetails:true,description:'Enter an amount and description, e.g. £15 petrol',parse:input=>{const match=/^add\s+(?:expense\s+)?£(\d+(?:\.\d{1,2})?)\s+(.+)$/i.exec(input);if(!match)return null;const description=match[2].trim();return {kind:'action',request:{action:'transaction.create',type:'expense',amount:Number(match[1]),description,category:/^(petrol|fuel)$/i.test(description)?'Transport':'Other',currency:'GBP'}}}},
 ...FINANCE_COMMANDS,
 ...GOAL_COMMANDS,
 ...TRACKING_COMMANDS,
 ...NOTIFICATION_COMMANDS,
 {id:'complete',label:'Complete',completion:'Complete ',aliases:[],takesDetails:true,description:'Type the exact task, routine step or habit name',parse:input=>{const match=/^complete\s+(.+)$/i.exec(input);return match?{kind:'resolve',operation:'complete',name:match[1].trim()}:null}}
]);
export const normalizeCommand=input=>input.trim().replace(/\s+/g,' ').toLowerCase();
export function commandSuggestions(input,registry=LOCAL_ACTIONS){if(typeof input!=='string'||/[\u0000-\u001f]/.test(input)||input.length>512)return [];const query=normalizeCommand(input);return registry.filter(entry=>[entry.label,...entry.aliases].some(label=>normalizeCommand(label).startsWith(query)))}
export function completionText(entry,input){const query=normalizeCommand(input),alias=entry.aliases.find(x=>normalizeCommand(x).startsWith(query));return alias||entry.completion}
export function canCompleteOnSpace(input,suggestions,selected=0){if(!input||/\s$/.test(input)||suggestions.length!==1||selected!==0)return false;return normalizeCommand(input)!==normalizeCommand(completionText(suggestions[0],input))}
