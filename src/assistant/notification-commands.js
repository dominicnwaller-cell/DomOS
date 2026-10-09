export const NOTIFICATION_COMMANDS=[
 ['attention','Open Attention Centre',['Show reminders',"Show today's reminders",'Show today’s reminders'],{action:'notification.open'},'Review upcoming, missed and snoozed reminders'],
 ['current','What should I be doing now?',[],{action:'notification.current'},'Real scheduled commitments and active work'],
 ['overdue','Show overdue Tasks',[],{action:'tasks.overdue'},'Unfinished explicit deadlines'],
].map(([id,label,aliases,request,description])=>({id,label,completion:label,aliases,description,parse:input=>[label,...aliases].some(x=>x.toLowerCase()===input.toLowerCase())?{kind:'action',request:{...request}}:null})).concat([
 {id:'find',label:'Find',completion:'Find ',aliases:[],takesDetails:true,description:'Find existing records in this profile',parse:input=>{const m=/^(?:find|search)\s+(.+)$/i.exec(input);return m?{kind:'action',request:{action:'search.get',query:m[1].replace(/\s+(appointment|task|goal|habit|tracker)$/i,'')}}:null}},
 {id:'open-existing',label:'Open existing',completion:'Open ',aliases:[],takesDetails:true,description:'Open a named record; choose when several match',parse:input=>{const m=/^open\s+(.+)$/i.exec(input);return m?{kind:'search-resolve',query:m[1].replace(/\s+(appointment|task|goal|habit|tracker)$/i,'')}:null}},
 {id:'snooze-next',label:'Snooze my next reminder',completion:'Snooze my next reminder',aliases:[],description:'Snooze one unambiguous reminder for ten minutes',parse:input=>/^snooze my next reminder$/i.test(input)?{kind:'snooze-resolve'}:null}
]);
