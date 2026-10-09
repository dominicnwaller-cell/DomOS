import {LOCAL_ACTIONS,commandSuggestions,completionText,canCompleteOnSpace,normalizeCommand} from './action-registry.js';

export function installAutocomplete(input,host,{registry=LOCAL_ACTIONS,execute=()=>{}}={}){
 const document=input.ownerDocument;
 let matches=[],selected=0,dismissed=false;
 const list=document.createElement('div');list.id='dom62CommandSuggestions';list.className='dom62-command-suggestions';list.setAttribute('role','listbox');list.setAttribute('aria-label','Local commands');list.hidden=true;
 const ghost=document.createElement('div');ghost.className='dom62-command-ghost';ghost.setAttribute('aria-hidden','true');host.append(ghost,list);
 input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','both');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');input.setAttribute('aria-describedby','dom62CommandKeyboardHelp');
 const atEnd=()=>input.selectionStart===input.value.length&&input.selectionEnd===input.value.length;
 function hide(){dismissed=true;list.hidden=true;ghost.replaceChildren();input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant')}
 function render(){list.replaceChildren();const visible=matches.length&&!dismissed;list.hidden=!visible;input.setAttribute('aria-expanded',String(!!visible));ghost.replaceChildren();if(!visible){input.removeAttribute('aria-activedescendant');return}
  matches.forEach((entry,index)=>{const row=document.createElement('div');row.id=`dom62CommandOption-${index}`;row.className='dom62-command-option';row.setAttribute('role','option');row.setAttribute('aria-selected',String(index===selected));const title=document.createElement('b'),description=document.createElement('span');title.textContent=entry.label;description.textContent=entry.description;row.append(title,description);row.onpointerdown=event=>event.preventDefault();row.onclick=()=>{selected=index;accept()};list.append(row)});
  const row=list.children[selected];input.setAttribute('aria-activedescendant',row.id);row.scrollIntoView?.({block:'nearest'});
  const completion=completionText(matches[selected],input.value);if(input.value.length>0&&atEnd()&&!input.scrollLeft&&completion.toLowerCase().startsWith(input.value.toLowerCase())){const prefix=document.createElement('span');prefix.textContent=input.value;prefix.style.visibility='hidden';ghost.append(prefix,document.createTextNode(completion.slice(input.value.length)))}
 }
 function update(){matches=commandSuggestions(input.value,registry);selected=0;dismissed=false;render()}
 function accept(){if(!matches[selected]||!atEnd())return false;input.value=completionText(matches[selected],input.value);input.focus();input.setSelectionRange(input.value.length,input.value.length);input.dispatchEvent(new input.ownerDocument.defaultView.Event('input',{bubbles:true}));hide();return true}
 input.addEventListener('input',update);input.addEventListener('click',render);input.addEventListener('scroll',render);
 input.addEventListener('keydown',event=>{
  if(event.isComposing||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey)return;
  if(event.key==='Escape'&&!list.hidden){event.preventDefault();event.stopPropagation();hide();return}
  if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(list.hidden){matches=commandSuggestions(input.value,registry);dismissed=false;selected=event.key==='ArrowUp'?matches.length-1:0}else selected=(selected+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length;if(matches.length)render();return}
  if(!list.hidden&&atEnd()&&((event.key==='Tab'&&!event.shiftKey)||event.key==='ArrowRight'||(event.key===' '&&canCompleteOnSpace(input.value,matches,selected)))){event.preventDefault();event.stopPropagation();accept();return}
  if(event.key==='Enter'){event.preventDefault();event.stopPropagation();if(!list.hidden&&atEnd()&&matches[selected]&&normalizeCommand(input.value)!==normalizeCommand(completionText(matches[selected],input.value))){const needsDetails=matches[selected].takesDetails;accept();if(needsDetails)return}hide();execute()}
 });
 return {update,hide,accept,get selected(){return selected},get matches(){return matches}};
}
