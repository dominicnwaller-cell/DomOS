const command=(id,label,request,description)=>({id,label,completion:label,aliases:[],description,parse:input=>input.toLowerCase()===label.toLowerCase()?{kind:'action',request:{...request}}:null});
export const REVIEW_COMMANDS=[
 command('summary-yesterday',"Show yesterday's summary",{action:'summary.get',offset:-1},'Recorded facts, no Review required'),
 command('review-daily','Start Daily Review',{action:'review.start'},'Optional loose ends, check-in and reflection'),
 command('review-loops',"Show today's loose ends",{action:'review.loops'},'Relevant planned or due tasks'),
 command('review-week','Review my week',{action:'review.open',kind:'weekly'},'Reconstruct this week from recorded activity'),
 command('review-last-week',"Show last week's review",{action:'review.open',kind:'weekly',offset:-7},'Original period if a Review was saved'),
 command('review-focus','Open Weekly Focus',{action:'focus.get'},'Recorded priorities for this week')
];
