const direct=(id,label,request,description)=>({id,label,completion:label,aliases:[],description,parse:input=>input.toLowerCase()===label.toLowerCase()?{kind:'action',request}:null});
export const FINANCE_COMMANDS=[
 direct('finance-summary','Finance summary',{action:'finance.summary'},'Recorded GBP cash and protection'),
 ...[['Check balance','check'],['Record transfer','transfer'],['Record bill payment','bills'],['Preview spending','forecast']].map(([label,mode])=>direct('finance-'+mode,label,{action:'finance.draft',mode},'Open the profile-scoped Finance action')),
 {id:'income-add',label:'Add income',completion:'Add income ',aliases:[],takesDetails:true,description:'Record actual GBP income, e.g. £50 design work',parse:input=>{const m=/^add income £(\d+(?:\.\d{1,2})?)(?:\s+(.+))?$/i.exec(input);return m?{kind:'action',request:{action:'finance.transaction.create',type:'income',amount:m[1],description:m[2]||'',currency:'GBP'}}:null;}}
];
