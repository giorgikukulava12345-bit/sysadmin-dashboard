import {fortigateModel,populateFortigateModels,selectFortigateModel,renderFortigateInfo} from './fortigate-models.js';
import {mikrotikModel,populateMikrotikModels,renderMikrotikInfo,selectMikrotikModel,validateMikrotikPorts} from './mikrotik-models.js';
import {ROUTER_CATALOG,ROUTER_PROFILES,VERIFIED_ROUTER_PORTS,CATALOG_CHECKED_AT,CATALOG_LISTING} from './cisco-router-catalog.js';
export const CISCO_ROUTERS=ROUTER_CATALOG;
export {CATALOG_CHECKED_AT,CATALOG_LISTING};
export const modelProfile=name=>ROUTER_PROFILES[name];
export const ROUTER_PORTS=Object.fromEntries(CISCO_ROUTERS.map(row=>{
 const p=ROUTER_PROFILES[row.model];
 if(VERIFIED_ROUTER_PORTS[row.model])return [row.model,VERIFIED_ROUTER_PORTS[row.model]];
 const inventory=(p.groups||[]).flatMap((g,gi)=>Array.from({length:g.count},(_,i)=>({value:'Hardware'+gi+'Port'+(i+1),label:g.type+' '+(i+1)+' · '+g.speed+' · '+(g.role==='shared'?'WAN / LAN':g.role.toUpperCase())+' · inventory',speed:g.speed,type:g.type,switched:false,role:g.role})));
 const explicitLan=inventory.filter(port=>port.role==='lan'||port.role==='shared');
 const routedLan=!explicitLan.length&&p.os==='IOS XE'?inventory.filter(port=>/Gbps/.test(port.speed)&&/RJ-45|SFP|Ethernet/.test(port.type)).map(port=>({...port,label:'Routed LAN candidate · '+port.label})):[];
 return [row.model,{wan:inventory.filter(port=>port.role!=='lan'),lan:explicitLan.length?explicitLan:routedLan}];
}));
export function modelGenerationError(site){
 if(site.vendor==='mikrotik')return validateMikrotikPorts(site).join(' ');
 if(site.vendor!=='ios'||!site.routerModel)return '';
 const p=modelProfile(site.routerModel);
 if(!p)return 'Choose a supported Cisco router model.';
 return p.cli_supported?'':site.routerModel+': hardware catalog only ('+p.os+'). '+p.port_note+' Choose Custom / other model only when you have verified an IOS / IOS XE device and its exact interface names.';
}
export function populateRouterModels(select,query='',vendor='ios'){
 if(vendor==='fortinet')return populateFortigateModels(select,query);
 if(vendor==='mikrotik')return populateMikrotikModels(select,query);
 const previous=select.value,search=query.trim().toLowerCase();
 select.replaceChildren();const custom=document.createElement('option');custom.value='';custom.textContent='Custom / other model';select.append(custom);
 const groups=new Map();let count=0;
 for(const row of CISCO_ROUTERS){
  if(search&&!((row.model+' '+row.series).toLowerCase().includes(search))&&row.model!==previous)continue;
  let group=groups.get(row.series);if(!group){group=document.createElement('optgroup');group.label=row.series;groups.set(row.series,group);select.append(group);}
  const option=document.createElement('option');option.value=row.model;option.textContent=row.model+(modelProfile(row.model).cli_supported?'':' · catalog');group.append(option);count++;
 }
 select.value=previous;return count;
}
export function renderRouterModelInfo(container,name){
 if(fortigateModel(name))return renderFortigateInfo(container,name);
 if(mikrotikModel(name))return renderMikrotikInfo(container,name);
 container.replaceChildren();const row=routerModel(name),profile=modelProfile(name);container.hidden=!row;if(!row)return;
 const intro=document.createElement('p');intro.textContent=row.series+' · '+row.form_factor+' · '+(profile.manual_ports?'Enter installed module interfaces':profile.cli_supported?'CLI Ethernet mapping available':'Hardware catalog · '+profile.os)+' · Checked '+CATALOG_CHECKED_AT;container.append(intro);
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Ports, modules & official Cisco specifications';details.append(summary);
 for(const[key,label]of [['wan_ports','WAN / routed ports'],['lan_ports','LAN ports'],['expansion_slots','Expansion slots'],['console_usb','Console / USB'],['features','Features']]){
  const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=label+': ';p.append(strong,document.createTextNode(row[key].join('; ')));details.append(p);
 }
 const note=document.createElement('p');note.textContent=profile.port_note||'Features depend on the installed software, license and modules.';details.append(note);
 const source=document.createElement('a');source.href=profile.source_url;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Official Cisco source ↗';details.append(source);container.append(details);
}
export const routerModel=name=>CISCO_ROUTERS.find(row=>row.model===name);
export function modelPortOptions(model,role,exclude=''){
  return (ROUTER_PORTS[model]?.[role]||[]).filter(p=>p.value!==exclude).map(p=>({...p,label:p.label||p.value+' · '+p.speed+' · '+p.type+(p.switched?' · LAN switchport':' · routed')}));
}
export function selectRouterModel(site,model){
 if(site.vendor==='fortinet')return selectFortigateModel(site,model);
 if(site.vendor==='mikrotik')return selectMikrotikModel(site,model);
  site.routerModel=ROUTER_PORTS[model]?model:'';
  if(site.vendor!=='ios'||!site.routerModel)return;
  const ports=ROUTER_PORTS[model];
  if(!ports.wan.some(p=>p.value===site.wan))site.wan=ports.wan.find(p=>p.type==='RJ-45')?.value||ports.wan[0]?.value||'';
  if(site.lan===site.wan||!ports.lan.some(p=>p.value===site.lan))site.lan=ports.lan.find(p=>p.value!==site.wan&&p.type==='RJ-45')?.value||ports.lan.find(p=>p.value!==site.wan)?.value||'';
}
export const switchedLan=site=>site.vendor==='ios'&&Boolean(ROUTER_PORTS[site.routerModel]?.lan.some(p=>p.value===site.lan&&p.switched));
export function validateModelPorts(site){
 if(site.vendor==='mikrotik')return validateMikrotikPorts(site);
  if(site.vendor!=='ios'||!site.routerModel)return [];
  const ports=ROUTER_PORTS[site.routerModel];
  if(!ports)return ['Choose a supported Cisco router model.'];
  if(modelProfile(site.routerModel)?.manual_ports){
    const valid=value=>/^(?:FastEthernet|GigabitEthernet|Ethernet|Serial)\d+(?:\/\d+)*$/.test(value||'');
    return ['wan','lan'].filter(role=>!valid(site[role])).map(role=>'Packet Tracer '+role.toUpperCase()+': enter the exact interface name of an installed module (for example FastEthernet0/0 or Serial0/0/0).');
  }
  return ['wan','lan'].filter(role=>!ports[role].some(p=>p.value===site[role])).map(role=>'The '+role.toUpperCase()+' port does not belong to '+site.routerModel+'. Choose an onboard port or select Custom / other model for installed modules.');
}
// Integrated LAN ports are Layer 2. Move routed commands to VLAN interfaces,
// and emit the physical access/trunk binding separately.
export function modelLanConfig(site,code){
  if(!switchedLan(site)||!code)return code;
  const dual=site.vlan2Enabled==='on';
  const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const physical=escape(site.lan);
  const sub=new RegExp(physical+'\\.(\\d+)(?![\\d/])','g');
  let output=code.replace(sub,(_,id)=>'Vlan'+id);
  const base=new RegExp(physical+'(?![\\w/.])','g');
  output=output.replace(base,'Vlan'+site.vlan);
  let vlanInterface=false;
  output=output.split('\n').filter(line=>{
    if(/^interface /.test(line))vlanInterface=/^interface Vlan\d+\s*$/.test(line);
    return !(vlanInterface&&/^\s*encapsulation dot1Q /.test(line));
  }).join('\n');
  const binding='configure terminal\n'+[site.vlan,...(dual?[site.vlan2]:[])].map(id=>'vlan '+id+'\n exit\n').join('')+'interface '+site.lan+'\n'+(dual?' switchport mode trunk\n switchport trunk native vlan '+(site.officeVlans?'1':site.vlan)+'\n switchport trunk allowed vlan '+site.vlan+','+site.vlan2:' switchport mode access\n switchport access vlan '+site.vlan)+'\n no shutdown\n exit\nend\n';
  return binding+output;
}
