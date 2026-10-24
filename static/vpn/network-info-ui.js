import { loadNetworkInfo, renderNetworkInfo, normalizeCity } from './network-info.js';

const root=document.querySelector('.noc-header-network');
if(root){
  const key='noc-city-display-v1',edit=root.querySelector('#geo-city-edit'),form=root.querySelector('#geo-city-form'),input=root.querySelector('#geo-city-input'),error=root.querySelector('#geo-city-error');
  let result={},override=null;
  try{override=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  const paint=next=>{
    result=next;
    const custom=override&&override.ip===next.ip&&override.country===next.country&&normalizeCity(override.city);
    renderNetworkInfo(root,custom?{...next,city:custom,customCity:true}:next);
    if(edit){edit.disabled=!(next.ip&&next.country);edit.dataset.custom=String(Boolean(custom));edit.setAttribute('aria-label',custom?'Edit custom city':'Correct city');}
  };
  const close=()=>{form.hidden=true;edit.setAttribute('aria-expanded','false');edit.focus();};
  if(edit&&form){
    edit.addEventListener('click',()=>{form.hidden=!form.hidden;edit.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden){input.value=override?.ip===result.ip&&override?.country===result.country?override.city:result.city||'';error.textContent='';input.focus();}});
    form.addEventListener('submit',e=>{e.preventDefault();const city=normalizeCity(input.value);if(!city){error.textContent='Enter an English city name (1–80 characters).';input.focus();return;}override={ip:result.ip,country:result.country,city};try{localStorage.setItem(key,JSON.stringify(override));}catch{}paint(result);close();});
    form.querySelector('[data-city-cancel]').addEventListener('click',close);
    form.querySelector('[data-city-reset]').addEventListener('click',()=>{override=null;try{localStorage.removeItem(key);}catch{}paint(result);close();});
    form.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
  }
  loadNetworkInfo({onUpdate:paint}).then(paint);
}
