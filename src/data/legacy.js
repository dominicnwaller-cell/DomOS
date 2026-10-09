export const LEGACY_COLLECTIONS = Object.freeze({
  tasks:'tasks',events:'events',calendarTemplates:'calendar_templates',
  routines:'routines',routineExceptions:'routine_exceptions',
  transactions:'finance_transactions',financeAccounts:'finance_accounts',
  financeBudgets:'finance_budgets',financeBills:'finance_bills',financeSavings:'finance_savings',
  goals:'goals',notes:'notes'
});

// Read-only: collect every key before the old application is allowed to boot.
export function captureLegacy(storage){
  const data={};for(let i=0;i<storage.length;i++){const key=storage.key(i);data[key]=storage.getItem(key)}
  return {format:'DOM.OS Legacy Snapshot',version:1,sourceVersion:'6.1.3',data};
}

export function auditLegacy(snapshot){
  if(!snapshot?.data||Array.isArray(snapshot.data)||typeof snapshot.data!=='object')throw new Error('Invalid legacy snapshot');
  const collections={},state={},issues=[],inventory=[];
  for(const [key,raw] of Object.entries(snapshot.data)){
    if(typeof raw!=='string'){issues.push(`${key}: expected raw text`);continue}
    inventory.push({key,bytes:new TextEncoder().encode(raw).length});
    if(!key.startsWith('lifeos4.')&&!key.startsWith('domos612.'))continue;
    let value;try{value=JSON.parse(raw)}catch{if(key.startsWith('lifeos4.')||key==='domos612.settings'||key==='domos612.workTimer')issues.push(`${key}: invalid JSON`);else state[key]=raw;continue}
    const name=key.slice('lifeos4.'.length),table=LEGACY_COLLECTIONS[name];
    if(key.startsWith('lifeos4.')&&table){
      if(!Array.isArray(value)){issues.push(`${key}: expected collection`);continue}
      const ids=new Set();value.forEach((record,index)=>{
        const id=name==='routineExceptions'?`${record?.routineId}:${record?.date}:${index}`:record?.id;
        if(!record||Array.isArray(record)||typeof record!=='object'||typeof id!=='string'||!id||ids.has(id))issues.push(`${key}: invalid or duplicate record at ${index}`);
        ids.add(id);
      });collections[table]=value;
    }
    state[key]=value;
  }
  return {inventory,collections,state,issues,hasLegacy:inventory.some(x=>x.key.startsWith('lifeos4.')||x.key.startsWith('domos_v')||['tasks','routines','notes','transactions'].includes(x.key)),counts:Object.fromEntries(Object.entries(collections).map(([key,rows])=>[key,rows.length]))};
}
