import {readFileSync} from 'node:fs';
import {DomAssistant} from '../src/assistant/assistant.js';
import {installAutocomplete} from '../src/assistant/autocomplete.js';
import {openSource} from '../src/application/search.js';
export function installCommandFixture(w,services){const prior=services.effects.bind(services);services.effects=(request,result)=>{prior(request,result);if(result?.source)openSource(result.source,services,w)};services.navigate=page=>w.eval(`showPage(${JSON.stringify(page)})`);Object.assign(w,{DomAssistant,installAutocomplete});w.eval(readFileSync('src/assistant/command-bar.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function'));w.DOMOSCommandBar=w.installCommandBar(services,w.DOMOSProfile.id);return w.DOMOSCommandBar}
