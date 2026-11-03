import {cidr,ipv4,unicastNetwork} from './address.js';
import {FEATURES,featureDefaults,featureFields,generateFeature} from './features.js';
import {terminalText} from './cli-export.js';
import {LAB_EXTRA,extraDefaults,extraGenerate} from './packet-lab-services.js';
import {DEFAULTS,generate as generateVpn} from './engine.js';

export const LAB_MODELS={router:'Cisco 2911 (Packet Tracer)',switch:'Cisco 2960 (Packet Tracer)',multilayer:'Cisco 3560 (Packet Tracer)',host:'Packet Tracer PC'};
export const LAB_ROUTER_MODELS=['Cisco 2911 (Packet Tracer)','Cisco 1941 (Packet Tracer)','Cisco 2811 (Packet Tracer)'];
// Templates requiring hardware/IOS XE or a separate multi-device workbench are not advertised here.
const OMIT=new Set(['vpn','bootstrap','enterprise','internet_access','wan_failover','vxlan','dmvpn','automation','copp','bfd','isis','remotevpn','pvlan','span','ipsla','multicast','ospf_advanced']);
export const LAB_SERVICES={...Object.fromEntries(Object.entries(FEATURES).filter(([id,f])=>f.vendors.includes('ios')&&!OMIT.has(id)).map(([id,f])=>[id,f.title])),...Object.fromEntries(Object.entries(LAB_EXTRA).map(([id,f])=>[id,f.title]))};
export const labDefaults=id=>LAB_EXTRA[id]?extraDefaults(id):featureDefaults(id,'ios');
export const labFields=id=>LAB_EXTRA[id]?.fields||[...featureFields(id,'ios'),...(id==='portforward'?[{key:'inside',label:'Reviewed inside interface',value:'',type:'text'},{key:'outside',label:'Reviewed outside interface',value:'',type:'text'}]:[])];
export const labDefinition=id=>id==='hardening'?{...FEATURES[id],roles:['router','switch']}:LAB_EXTRA[id]||FEATURES[id];
export const LAB_REPEATABLE=new Set(['vlan','static','static6','dhcp','acl','relay','lab_serial']);
const fail=m=>{throw Error(m);};
const safe=(s,label)=>/^[A-Za-z][A-Za-z0-9_.\/-]{0,62}$/.test(s||'')?s:fail(label+': use a CLI identifier.');
export function labInterfaces(text){
 const rows=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(rows.length>96)fail('Maximum 96 interfaces per device.');
 const seen=new Set();return rows.map(row=>{const [port,address='',peer='',tag='',extra]=row.split(',').map(x=>x.trim());if(extra!==undefined)fail('Interface rows: port, IPv4/prefix, peer, optional dot1Q VLAN.');
 if(!/^(?:GigabitEthernet|FastEthernet|Ethernet|Serial)\d+(?:\/\d+){0,3}(?:\.\d+)?$|^(?:Vlan|Loopback|Tunnel)\d+$/.test(port))fail('Use a full Cisco interface name: '+port);
 if(seen.has(port))fail('Duplicate interface '+port);seen.add(port);let n=null;
 if(address){n=cidr(address);const value=ipv4(address.split('/')[0]);if(!n||!unicastNetwork(n)||(+address.split('/')[1]<31&&(value<=n.network||value>=n.end)))fail(port+': enter a usable unicast IPv4/prefix.');}
 if(peer.length>80||/[\x00-\x1f]/.test(peer))fail('Invalid peer label.');if(tag&&(!/^\d+$/.test(tag)||+tag<1||+tag>4094||!port.includes('.')))fail('dot1Q requires a subinterface and VLAN 1–4094.');
 return {port,address,peer,tag,net:n};});
}
export function suggestLabDevices(text){
 const names=[...new Set((String(text||'').match(/\b(?:Router|Switch|PC|Laptop|Server|R|SW|S)[-_]?\d{1,3}\b/gi)||[]))].slice(0,32);
 return names.map(name=>({name,kind:/^(?:SW|Switch|S\d)/i.test(name)?'switch':/^(?:PC|Laptop|Server)/i.test(name)?'host':'router',interfaces:'',services:[],gateway:'',notes:''}));
}
const VERIFY={vlan:['show vlan brief','show interfaces trunk'],security:['show port-security'],stp:['show spanning-tree'],bpduguard:['show spanning-tree'],etherchannel:['show etherchannel summary'],ospf:['show ip ospf neighbor','show ip protocols'],eigrp:['show ip eigrp neighbors','show ip protocols'],bgp:['show ip bgp summary'],nat:['show ip nat translations','show ip nat statistics'],portforward:['show ip nat translations'],dhcp:['show ip dhcp binding','show ip dhcp pool'],relay:['show running-config'],fhrp:['show standby brief'],glbp:['show glbp brief'],ntp_syslog:['show ntp associations'],acl:['show access-lists'],hardening:['show ip ssh'],snmp:['show snmp'],gre_tunnel:['show interfaces tunnel 200'],redistribution:['show ip protocols']};
export function generateLab(devices,{reviewed=false,task=''}={}){
 const errors=[],scripts=[],summary=[];if(!reviewed)return {errors:['Confirm every device, interface, address and required service against the image and task.'],scripts:[],summary:[]};
 if(!Array.isArray(devices)||!devices.length||devices.length>32)return {errors:['Add 1–32 devices.'],scripts:[],summary:[]};
 const names=new Set(),addresses=new Set();
 for(const d of devices){try{
  safe(d.name,'Hostname');if(names.has(d.name.toLowerCase()))fail('Duplicate hostname.');names.add(d.name.toLowerCase());if(!Object.hasOwn(LAB_MODELS,d.kind))fail('Select a supported Packet Tracer device type.');
  if(d.aiDraft&&d.kind==='router'&&!LAB_ROUTER_MODELS.includes(d.model))fail('AI did not confirm a supported router model. Select the actual hardware model before export.');
  const model=d.kind==='router'?(d.model||LAB_MODELS.router):LAB_MODELS[d.kind];if(d.kind==='router'&&!LAB_ROUTER_MODELS.includes(model))fail('Select a supported router model.');
  const ports=labInterfaces(d.interfaces);for(const p of ports){if(!p.address)continue;const ip=p.address.split('/')[0];if(addresses.has(ip))fail('IPv4 address reused on another interface: '+ip);addresses.add(ip);}
  if(d.kind!=='host')for(const p of ports){const physical=p.port.split('.')[0];if(/^(Vlan|Loopback|Tunnel)/.test(physical))continue;if(/^Serial/.test(physical)){if(d.serialInstalled!==true)fail('Confirm that the exact serial module/ports are installed in Packet Tracer.');continue;}const valid=d.kind==='router'?model.includes('2811')?/^FastEthernet0\/[01]$/.test(physical):new RegExp('^GigabitEthernet0/[0-'+(model.includes('1941')?'1':'2')+']$').test(physical):/^FastEthernet0\/(?:[1-9]|1\d|2[0-4])$|^GigabitEthernet0\/[12]$/.test(physical);if(!valid)fail(p.port+' does not match the selected model onboard port map.');}
  if(!ports.length)fail('Enter the device interfaces; missing ports are never guessed.');
  if(d.kind==='switch'&&ports.some(p=>p.address&&!/^Vlan/.test(p.port)))fail('2960 uses an SVI for management; physical ports are Layer 2.');
  if(d.kind==='host'){
   if(ports.length!==1||!ports[0].address)fail('Host requires one addressed Ethernet interface.');const n=ports[0].net,g=ipv4(d.gateway);if(d.gateway&&(g===null||g<=n.network||g>=n.end||d.gateway===ports[0].address.split('/')[0]))fail('Enter the host gateway in its subnet, or leave blank if none is required.');
   if(d.services?.length)fail('Host service/server configuration uses Packet Tracer Desktop/Services, not IOS.');
   const verify='ipconfig'+(d.gateway?'\nping '+d.gateway:'');scripts.push({name:d.name,kind:d.kind,code:`Packet Tracer → ${d.name} → Desktop → IP Configuration → Static\nIPv4 address: ${ports[0].address.split('/')[0]}\nSubnet mask: ${n.mask}\nDefault gateway: ${d.gateway||'Leave blank if the task does not specify a gateway'}\nDNS server: ${d.dns||'Set according to the task'}\n\nCommand Prompt verification:\n${verify}`,verify});
   summary.push(`${d.name}: host ${ports[0].address}; gateway ${d.gateway||"not specified"}.`);continue;
  }
  const lines=['enable','configure terminal',`hostname ${d.name}`];if(d.kind==='multilayer')lines.push('ip routing');
  for(const p of ports){if(p.tag)lines.push(`interface ${p.port.split('.')[0]}`,' no shutdown',' exit');if(/^Vlan\d+$/.test(p.port)&&+p.port.slice(4)!==1)lines.push('vlan '+p.port.slice(4),' exit');lines.push('interface '+p.port);if(p.tag)lines.push(' encapsulation dot1Q '+p.tag);if(p.address){if(d.kind==='multilayer'&&!/^(Vlan|Loopback|Tunnel)/.test(p.port))lines.push(' no switchport');lines.push(' ip address '+p.address.split('/')[0]+' '+p.net.mask);}lines.push(' no shutdown',' exit');}lines.push('end');
  const services=d.services||[];if(!Array.isArray(services)||services.length>32)fail('Maximum 32 service blocks per device.');
  if(services.some(s=>s.id==='dhcp')&&services.some(s=>s.id==='relay'))fail('DHCP server and relay on the same device require a separately reviewed interface design. Generate separately.');
  if(services.some(s=>s.id==='nat')&&services.some(s=>s.id==='zbfw'))fail('PAT + ZBFW needs an integrated firewall/NAT design; use the gateway workbench.');
  const seenServices=new Set(),objects=new Set();for(const s of services){
   if(!Object.hasOwn(LAB_SERVICES,s.id))fail('Unsupported lab service: '+s.id);const signature=s.id+':'+(LAB_REPEATABLE.has(s.id)?JSON.stringify(s.data):'single');if(seenServices.has(signature))fail('Duplicate '+s.id+' block.');seenServices.add(signature);
   const f=labDefinition(s.id),role=d.kind==='switch'?'switch':'router';if(!(f.roles||[f.role]).includes(role)&&!(d.kind==='multilayer'&&(f.roles||[f.role]).includes('switch')))fail(s.id+': not supported for this device type.');
   const data={...labDefaults(s.id),...s.data,vendor:'ios'};if(s.id==='hardening')data.hostname=d.name;
   if(['acl','dhcp'].includes(s.id)){const key=s.id+':'+data.name;if(objects.has(key))fail('Duplicate '+s.id+' object name: '+data.name);objects.add(key);}
   if(['nat','portforward'].includes(s.id)){const inside=ports.find(p=>p.port===data.inside),outside=ports.find(p=>p.port===data.outside);if(!inside?.address||!outside?.address||inside===outside)fail(s.id+': select distinct addressed inside/outside interfaces.');if(s.id==='nat'&&data.network!==inside.net.canonical)fail('NAT source network must match the reviewed inside interface.');Object.assign(data,{publicIp:outside.address.split('/')[0],localNetwork:inside.net.canonical,lanIp:inside.address.split('/')[0]});}
   if(s.id==='dhcp'&&!ports.some(p=>p.address?.split('/')[0]===data.gateway&&p.net.canonical===data.network))fail('DHCP gateway/network must match a reviewed interface.');
   if(s.id==='fhrp'){const port=ports.find(p=>p.port===data.interface);if(!port?.address)fail('FHRP requires an addressed reviewed interface.');data.localIp=port.address.split('/')[0];data.localNetwork=port.net.canonical;}
   if(d.kind==='switch'&&['fhrp','glbp'].includes(s.id))fail('Layer 2 2960 does not provide routed first-hop redundancy. Select a router or supported Layer 3 switch.');
   if(s.id==='lab_ipv6')for(const row of String(data.addresses||'').split(/\r?\n/).filter(x=>x.trim()))if(!ports.some(p=>p.port===row.split(',')[0].trim()))fail('IPv6 interface must be included in the reviewed device port list.');
   if(s.id==='etherchannel')for(const port of String(data.members).split(',').map(x=>x.trim()))if(!ports.some(p=>p.port===port))fail('EtherChannel members must be included in the reviewed device port list.');
   if(s.id==='lab_console'&&!services.some(s=>s.id==='hardening'))fail('Console local authentication requires the SSH hardening block with local credentials.');
   for(const key of ['interface','inside','outside','uplink','access','wan','lan'])if(data[key]&&!ports.some(p=>p.port===data[key])&&!['gre_tunnel','static','static6'].includes(s.id))fail(s.id+': '+data[key]+' must be present in this device interface list.');
   if(['ospf3','static6'].includes(s.id)&&!services.some(x=>x.id==='lab_ipv6'))fail(s.id+': configure IPv6 interface addressing first.');
   if(s.id==='lab_vpn'){
    if(d.kind!=='router')fail('IPsec requires router peers.');const peer=devices.find(x=>x.name===data.peer);if(!peer||peer===d||peer.kind!=='router')fail('Select another router by its exact hostname.');const ps=peer.services?.find(x=>x.id==='lab_vpn');if(!ps||ps.data.peer!==d.name)fail('Peer must have a reciprocal IPsec service.');
    if([d,peer].some(x=>x.services.some(y=>['nat','portforward','zbfw'].includes(y.id))))fail('Combined IPsec and NAT/firewall needs the existing Quick Setup + VPN workbench with reviewed NAT exemptions.');
    const bind=(device,config,base)=>{const rows=labInterfaces(device.interfaces),wan=rows.find(p=>p.port===config.wan),lan=rows.find(p=>p.port===config.lan);if(!wan?.address||!lan?.address||wan===lan)fail('IPsec requires distinct addressed WAN and LAN interfaces on both peers.');return {...base,vendor:'ios',routerModel:LAB_MODELS.router,ip:wan.address.split('/')[0],wanPrefix:wan.address.split('/')[1],wan:wan.port,lan:lan.port,lanIp:lan.address.split('/')[0],local:lan.net.canonical,gateway:config.gateway,psk:config.psk};};
    const c=structuredClone(DEFAULTS);c.protocol='ikev1';c.bindInterfaces=false;c.a=bind(d,data,c.a);c.b=bind(peer,ps.data,c.b);c.a.remote=c.b.local;c.b.remote=c.a.local;const r=generateVpn(c);if(r.errors.length)fail(r.errors.join(' '));lines.push('!',r.a);continue;
   }
   if(s.id==='eigrp'&&data.mode!=='basic')fail('Packet Tracer workspace supports classic EIGRP only.');
   if(s.id==='fhrp'&&data.protocol!=='hsrp')fail('Packet Tracer workspace supports HSRP; VRRP needs a verified image.');
   const r=LAB_EXTRA[s.id]?extraGenerate(s.id,data):generateFeature(s.id,data);if(r.errors.length)fail(s.id+': '+r.errors.join(' '));if(r.scripts.length!==1)fail(s.id+': template spans multiple devices; use the dedicated workbench.');lines.push('!',r.scripts[0].code);
  }
  const verify=new Set(['show ip interface brief','show running-config']);if(d.kind!=='switch')verify.add('show ip route');for(const s of services){const extra=s.id==='lab_vpn'?['show crypto isakmp sa','show crypto ipsec sa']:LAB_EXTRA[s.id]?extraGenerate(s.id,{...labDefaults(s.id),...s.data}).verify.split('\n'):s.id==='ospf3'?['show ipv6 ospf neighbor','show ipv6 route']:null;for(const command of extra||VERIFY[s.id]||['show running-config'])verify.add(command);}
  scripts.push({name:d.name,kind:d.kind,model,code:terminalText(lines.join('\n'),{vendor:'ios',model,role:d.kind==='switch'?'switch':'router'}),verify:[...verify].join('\n')});
  summary.push(`${d.name} · ${model} · ${ports.map(p=>p.port+(p.address?' '+p.address:'')+(p.peer?' ↔ '+p.peer:'')).join('; ')} · services: ${services.map(s=>LAB_SERVICES[s.id]).join(', ')||'interface addressing only'}.`);
 }catch(e){errors.push((d.name||'Device')+': '+e.message);}}
 // Atomic output: an incomplete device must never disappear from a supposedly complete lab export.
 return {errors,scripts:errors.length?[]:scripts,summary:errors.length?[]:[...(task?[`Task reviewed by user: ${String(task).slice(0,12000)}`]:[]),...summary]};
}
