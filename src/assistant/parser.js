import {LOCAL_ACTIONS} from './action-registry.js';
export function parseLocalCommand(input){
 if(typeof input!=='string'||input.length>512||/[\u0000-\u001f]/.test(input))return {kind:'unknown',message:'Please enter one short command.'};
 const original=input.trim().replace(/\s+/g,' ');
 for(const entry of LOCAL_ACTIONS){const parsed=entry.parse(original);if(parsed)return parsed}
 return {kind:'unknown',message:'I’m not sure what you meant. Choose a Local command below or try “Add £15 petrol”.'};
}
