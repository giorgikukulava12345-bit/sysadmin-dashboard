import {modelProfile} from './router-models.js';
import {portOptions} from './port-options.js';
import {mountSelectionMenu} from './selection-menu.js';
let nextId=0;
/** Keep the existing named input as the model binding; offer a vendor-specific picker. */
export function mountPortPicker(input,signal){
  const select=document.createElement('select'),label=input.closest('label'),hint=document.createElement('small');
  select.dataset.portPicker=input.name;select.dataset.portSide=input.dataset.side;
  select.setAttribute('aria-label',input.getAttribute('aria-label')+' selection');
  hint.id=`port-hint-${++nextId}`;hint.textContent='Choose a suggested port or type the exact device port in the field above. Names depend on model.';
  select.setAttribute('aria-describedby',hint.id);input.setAttribute('aria-describedby',hint.id);
  label.insertBefore(select,input);
  let vendor='',custom=false,profile='';const refreshMenu=mountSelectionMenu(select,signal);label.append(hint);
  select.addEventListener('change',()=>{
    custom=select.value==='__custom__';input.hidden=false;
    if(custom){input.focus();return;}
    input.value=select.value;input.dispatchEvent(new Event('input',{bubbles:true}));
  },{signal});
  return (nextVendor,model='',role='wan',exclude='')=>{
    const nextProfile=[nextVendor,model,role,exclude].join('|');if(profile!==nextProfile){vendor=nextVendor;profile=nextProfile;custom=false;}
    const metadata=vendor==='ios'&&modelProfile(model);input.readOnly=Boolean(metadata&&!metadata.cli_supported);const rows=portOptions(vendor,model,role,exclude);hint.textContent=metadata&&!metadata.cli_supported?'Hardware inventory for '+model+'. '+metadata.port_note:model?'Onboard ports for '+model+'. For installed expansion modules, select Custom / other model.':'Choose a suggested port or type the exact device port in the field above. Names depend on model.';select.replaceChildren();
    for(const row of rows){const option=document.createElement('option');option.value=row.value;option.textContent=row.label;select.append(option);}
    const option=document.createElement('option');option.value='__custom__';option.textContent=metadata&&!metadata.cli_supported?'Module / virtual ports: see official source':'Custom / exact device port';option.disabled=Boolean(metadata&&!metadata.cli_supported);select.append(option);
    if(!rows.some(row=>row.value===input.value))custom=true;
    select.value=custom?'__custom__':input.value;input.hidden=false;refreshMenu();
  };
}

