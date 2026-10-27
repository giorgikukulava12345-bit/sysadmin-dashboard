import {MIKROTIK_CATALOG} from './mikrotik-catalog.js';
export {MIKROTIK_CATALOG};
export const mikrotikModel=name=>MIKROTIK_CATALOG.find(row=>row.model===name);
export const MIKROTIK_PORTS=Object.fromEntries(MIKROTIK_CATALOG.map(row=>[row.model,row.ports]));
export function mikrotikPortOptions(model,exclude=''){return (MIKROTIK_PORTS[model]||[]).filter(p=>!String(exclude).split(',').includes(p.value));}
export function populateMikrotikModels(select,query='',role='router'){
 const previous=select.value,search=query.trim().toLowerCase();select.replaceChildren();
 const custom=document.createElement('option');custom.value='';custom.textContent='Custom / other model';select.append(custom);
 let count=0;const groups=new Map();
 for(const row of MIKROTIK_CATALOG){
  if(row.device_type!==role||search&&!(row.model+' '+row.product_code+' '+row.series).toLowerCase().includes(search)&&previous!==row.model)continue;
  const category=row.series+' · '+row.availability;
  if(!groups.has(category)){const group=document.createElement('optgroup');group.label=category;groups.set(category,group);select.append(group);}
  const option=document.createElement('option');option.value=row.model;option.textContent=row.model+' · '+row.product_code+(row.cli_supported?'':' · catalog');groups.get(category).append(option);count++;
 }
 select.value=previous;return count;
}
export function selectMikrotikModel(site,name,role='router'){
 const row=mikrotikModel(name),key=role==='switch'?'switchModel':'routerModel';site[key]=row?.device_type===role?name:'';
 if(!site[key])return;
 const [first,second,third]=row.ports;const keys=role==='switch'?['uplink','access','vlan2Access']:['wan','lan'];
 site[keys[0]]=first?.value||'';site[keys[1]]=second?.value||'';if(role==='switch')site.vlan2Access=third?.value||'';
}
export function validateMikrotikPorts(site,role='router'){
 const key=role==='switch'?'switchModel':'routerModel';if(site[role==='switch'?'switchVendor':'vendor']!=='mikrotik'||!site[key])return [];
 const row=mikrotikModel(site[key]);if(!row||row.device_type!==role)return ['Choose a supported MikroTik '+role+' model.'];
 if(!row.cli_supported)return [row.model+': hardware catalog only. '+row.port_note];
 return (role==='switch'?['uplink','access',...(site.vlan2Enabled==='on'?['vlan2Access']:[])]:['wan','lan']).filter(key=>!row.ports.some(p=>p.value===site[key])).map(key=>key+': choose a port belonging to '+row.model+'.');
}
export function renderMikrotikInfo(container,name){
 container.replaceChildren();const row=mikrotikModel(name);container.hidden=!row;if(!row)return;
 const intro=document.createElement('p');intro.textContent=row.model+' · '+row.product_code+' · '+row.os+' · '+row.availability+' · Checked '+row.checked_at;container.append(intro);
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Ports, modules & official MikroTik specifications';details.append(summary);
 for(const [key,label]of [['lan_ports','Wired ports (assignable to WAN / LAN)'],['expansion_slots','Expansion'],['console_usb','Console / USB'],['features','Features']]){const p=document.createElement('p');p.textContent=label+': '+(row[key].join('; ')||'Not listed');details.append(p);}
 const note=document.createElement('p');note.textContent=row.port_note+' '+row.period_note;details.append(note);
 const link=document.createElement('a');link.href=row.source_url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Official MikroTik product specifications ↗';details.append(link);container.append(details);
}
