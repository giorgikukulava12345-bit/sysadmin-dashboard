// Keep the native select as the single state binding; render an accessible themed listbox.
let menuId=0;
export function mountSelectionMenu(select,signal){
  const field=select.closest('.noc-field'),wrap=document.createElement('div'),button=document.createElement('button'),list=document.createElement('div');
  wrap.className='noc-select';button.type='button';button.className='noc-select-trigger';
  const name=select.getAttribute('aria-label');list.id=`noc-select-${++menuId}`;
  button.setAttribute('role','combobox');button.setAttribute('aria-label',name);button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-controls',list.id);button.setAttribute('aria-expanded','false');
  list.className='noc-select-menu';list.setAttribute('role','listbox');list.setAttribute('aria-label',`${name} options`);list.hidden=true;
  select.hidden=true;select.setAttribute('aria-hidden','true');select.tabIndex=-1;
  field.append(wrap);wrap.append(button,list);
  let active=0,search='',searchTime=0;
  const options=()=>[...select.options].filter(o=>!o.disabled);
  function close(){list.hidden=true;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');}
  function mark(){[...list.children].forEach((node,i)=>node.dataset.active=String(i===active));button.setAttribute('aria-activedescendant',`${list.id}-${active}`);const row=list.children[active];if(row){if(row.offsetTop<list.scrollTop)list.scrollTop=row.offsetTop;else if(row.offsetTop+row.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=row.offsetTop+row.offsetHeight-list.clientHeight;}}
  function refresh(){button.textContent=select.selectedOptions[0]?.textContent||'Select';button.disabled=select.disabled;list.replaceChildren();options().forEach((option,i)=>{const row=document.createElement('div');row.id=`${list.id}-${i}`;row.setAttribute('role','option');row.setAttribute('aria-selected',String(option.value===select.value));row.textContent=option.textContent;row.onpointermove=()=>{active=i;mark();};row.onclick=e=>{e.preventDefault();choose(i);};list.append(row);});if(select.disabled)close();}
  function open(){refresh();active=Math.max(0,options().findIndex(o=>o.value===select.value));list.hidden=false;button.setAttribute('aria-expanded','true');mark();}
  function choose(i){const option=options()[i];if(!option)return;select.value=option.value;close();select.dispatchEvent(new Event('change',{bubbles:true}));refresh();button.focus();}
  button.addEventListener('click',e=>{e.preventDefault();list.hidden?open():close();},{signal});
  button.addEventListener('keydown',e=>{const count=options().length;if(!count)return;if(e.key==='Tab'){close();return;}if(e.key==='Escape'){e.preventDefault();close();return;}if(['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(e.key)){e.preventDefault();if(list.hidden){open();if(e.key==='End')active=count-1;}else if(e.key==='Enter'||e.key===' '){choose(active);return;}else if(e.key==='Home')active=0;else if(e.key==='End')active=count-1;else active=(active+(e.key==='ArrowUp'?-1:1)+count)%count;mark();}else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(list.hidden)open();const now=Date.now();search=now-searchTime>700?e.key:search+e.key;searchTime=now;const i=options().findIndex(o=>o.textContent.toLowerCase().startsWith(search.toLowerCase()));if(i>=0){active=i;mark();}}},{signal});
  document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))close();},{signal});
  list.addEventListener('pointerdown',e=>e.preventDefault(),{signal});
  wrap.addEventListener('focusout',e=>{if(!wrap.contains(e.relatedTarget))close();},{signal});
  select.addEventListener('change',refresh,{signal});refresh();
  return ()=>{refresh();close();};
}
