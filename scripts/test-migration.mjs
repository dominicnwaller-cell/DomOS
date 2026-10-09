import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {captureLegacy,auditLegacy,LEGACY_COLLECTIONS} from '../src/data/legacy.js';
const original=new Map([
 ['lifeos4.tasks',JSON.stringify([{id:'existing',title:'Keep me',status:'completed'}])],
 ['lifeos4.routineExceptions',JSON.stringify([{routineId:'r1',date:'2026-10-04',skip:true}])],
 ['lifeos4.quickNote','"a note"'],['domos612.lastPage','tasks'],['domos_v53_daily_routine','1'],['unknown-key','raw non-JSON text']
]);
const storage={get length(){return original.size},key:i=>[...original.keys()][i],getItem:k=>original.get(k),setItem(){throw new Error('Audit must never write')},removeItem(){throw new Error('Audit must never delete')}};
const before=JSON.stringify([...original]),snapshot=captureLegacy(storage),audit=auditLegacy(snapshot);
assert.equal(JSON.stringify([...original]),before);assert.equal(snapshot.data['unknown-key'],'raw non-JSON text');assert.equal(audit.issues.length,0);assert.equal(audit.counts.tasks,1);assert.equal(audit.counts.routine_exceptions,1);assert.equal(audit.state['domos612.lastPage'],'tasks');assert(audit.hasLegacy);
assert(!auditLegacy({data:{}}).hasLegacy);
assert(auditLegacy({data:{'lifeos4.tasks':'broken JSON'}}).issues.length);
assert(auditLegacy({data:{'lifeos4.tasks':'{}'}}).issues.length);
assert(auditLegacy({data:{'lifeos4.tasks':'[{"id":"x"},{"id":"x"}]'}}).issues.length);
for(const key of Object.keys(LEGACY_COLLECTIONS)){const result=auditLegacy({data:{['lifeos4.'+key]:'[]'}});assert.equal(result.issues.length,0);assert.equal(result.counts[LEGACY_COLLECTIONS[key]],0)}
// Optional private real-data fixture is local-only, never committed or printed.
if(process.env.DOMOS_MIGRATION_FIXTURE){const backup=JSON.parse(readFileSync(process.env.DOMOS_MIGRATION_FIXTURE,'utf8'));const real=auditLegacy({data:backup.data});assert.equal(real.issues.length,0,real.issues.join('; '));assert(real.hasLegacy);console.log('PASS private 6.1.3 export: all collections audited without mutation');}
console.log('PASS migration audit: lossless capture, collections, malformed input, duplicate IDs and no writes');
