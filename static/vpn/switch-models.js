import {eveModel,appendEveModels,selectEveModel,validateEvePorts,renderEveInfo} from './eve-models.js';
import {mikrotikModel,populateMikrotikModels,renderMikrotikInfo,selectMikrotikModel,validateMikrotikPorts} from './mikrotik-models.js';
export const SWITCH_SOURCE='https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst2960/hardware/installation/guide/2960_hg/higover.html';
export const CISCO_SWITCHES=['Cisco Catalyst 2960-24TT-L','Cisco 2960-24TT (Packet Tracer)'];
const ports=[...Array.from({length:24},(_,i)=>({value:'FastEthernet0/'+(i+1),speed:'10/100 Mbps'})),...Array.from({length:2},(_,i)=>({value:'GigabitEthernet0/'+(i+1),speed:'1 Gbps'}))].map(p=>({...p,label:p.value+' · '+p.speed}));
export const SWITCH_PORTS=Object.fromEntries(CISCO_SWITCHES.map(name=>[name,ports]));
export function switchPortOptions(model,exclude=''){return (SWITCH_PORTS[model]||[]).filter(p=>!String(exclude).split(',').includes(p.value));}
export function selectSwitchModel(site,model){
 if(selectEveModel(site,model,'switch'))return;
 if(site.switchVendor==='mikrotik')return selectMikrotikModel(site,model,'switch');
 site.switchModel=CISCO_SWITCHES.includes(model)?model:'';
 if(site.switchVendor!=='ios'||!site.switchModel)return;
 site.uplink='GigabitEthernet0/1';site.access='FastEthernet0/1';site.vlan2Access='FastEthernet0/2';
}
export function validateSwitchPorts(site){
 if(eveModel(site.switchModel))return validateEvePorts(site,'switch');
 if(site.switchVendor==='mikrotik')return validateMikrotikPorts(site,'switch');
 if(site.switchVendor!=='ios'||!site.switchModel)return [];
 const rows=SWITCH_PORTS[site.switchModel];if(!rows)return ['Choose a supported Cisco switch model.'];
 return ['uplink','access',...(site.vlan2Enabled==='on'?['vlan2Access']:[])].filter(key=>!rows.some(p=>p.value===site[key])).map(key=>key+': choose a physical port on '+site.switchModel+'.');
}
export function populateSwitchModels(select,query='',vendor='ios'){
 if(vendor==='mikrotik')return populateMikrotikModels(select,query,'switch');
 const current=select.value;select.replaceChildren();
 for(const name of ['',...CISCO_SWITCHES.filter(name=>name.toLowerCase().includes(query.toLowerCase()))]){const option=document.createElement('option');option.value=name;option.textContent=name||'Custom / other model';select.append(option);}select.value=current;appendEveModels(select,query,vendor,'switch',current);
}
export function renderSwitchModelInfo(container,name){
 if(eveModel(name))return renderEveInfo(container,name);
 if(mikrotikModel(name))return renderMikrotikInfo(container,name);
 container.replaceChildren();container.hidden=!SWITCH_PORTS[name];if(container.hidden)return;
 const p=document.createElement('p');p.textContent=name+' · 24 × 10/100 FastEthernet + 2 × Gigabit Ethernet copper uplinks · Fixed ports, no SFP slots.';
 const link=document.createElement('a');link.href=SWITCH_SOURCE;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Official Cisco hardware specifications';container.append(p,link);
}
