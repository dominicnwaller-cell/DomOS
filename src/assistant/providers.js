import {parseLocalCommand} from './parser.js';
export class LocalProvider {id='Local';available=true;async interpret(command){return parseLocalCommand(command)}}
class InactiveProvider {constructor(id){this.id=id;this.available=false}async interpret(){throw Error(`${this.id} is not connected in DOM.OS 6.2. Use Local commands.`)}}
export class ProviderRegistry {
 constructor(){this.providers=new Map([new LocalProvider(),...['Gemini','Ollama','Groq','OpenRouter'].map(id=>new InactiveProvider(id))].map(provider=>[provider.id,provider]));}
 get(id='Local'){const provider=this.providers.get(id);if(!provider)throw Error('Unknown assistant provider.');return provider}
 list(){return [...this.providers.values()].map(({id,available})=>({id,available}))}
}
