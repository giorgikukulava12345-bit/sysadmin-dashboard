import { officeNetworks, officeServices } from './office-services.js';
import { cidr, ipv4 } from './address.js';
import { validateWan } from './interfaces.js';

const vendors=['ios','mikrotik','fortinet','juniper','paloalto'];
export const INTERNET_FEATURES={
  wan_failover:{title:'Dual ISP / WAN Failover',role:'router',category:'performance',vendors,note:'IPv4 primary/backup routes. Local link loss triggers failover; RouterOS also checks gateway ICMP reachability. Upstream outages with link still up require separately designed SLA/path monitoring. NAT sessions can reset when the public IP changes.'},
  internet_access:{title:'Internet Gateway · Default Route, PAT & Stateful Firewall',role:'router',category:'security',vendors,note:'Standard IPv4 office starter: shared LAN/WAN bindings, default route, interface PAT and stateful outbound policy. Uses dedicated NOC objects; merge rule order and existing routes before deployment. No credentials, IPv6 policy or device-specific security profiles are invented.'}
};
const field=(key,label,value,type='text')=>({key,label,value,type});
const port2={ios:'GigabitEthernet0/2',mikrotik:'ether3',fortinet:'port3',juniper:'ge-0/0/2',paloalto:'ethernet1/3'};
export function internetFields(id,vendor){
  const fields=id==='wan_failover'?[
    field('wan2','WAN2 interface',port2[vendor]),field('ip2','WAN2 usable IPv4 (/30)','203.0.113.14'),
    field('gateway2','ISP gateway 2','203.0.113.13'),field('backupDistance',vendor==='paloalto'?'Backup route metric (primary = 1)':'Backup distance / preference (primary = 1)','5','number')
  ]:[];
  if(id==='wan_failover'&&vendor==='ios')fields.push(field('trackId','First unused WAN link track ID (also reserves ID + 1)','900','number'));
  if(id==='internet_access')fields.push(field('poolName','DHCP pool name prefix','OFFICE-LAN'),field('dns1','Primary DNS server','8.8.8.8'),field('dns2','Secondary DNS server','1.1.1.1'));
  if(id==='internet_access'&&vendor==='fortinet')fields.push(field('dhcpId','First DHCP server ID (unused)','9000','number'));
  if(vendor==='paloalto')fields.push(field('virtualRouter','Classic virtual router','default'));
  if(id==='internet_access'&&['juniper','paloalto'].includes(vendor))fields.push(field('trustZone','LAN security zone','NOC-TRUST'),field('untrustZone','WAN security zone','NOC-UNTRUST'));
  if(vendor==='fortinet'){
    fields.push(field('routeId','Primary static route ID (unused)','9000','number'));
    if(id==='wan_failover')fields.push(field('backupRouteId','Backup static route ID (unused)','9001','number'));
    if(id==='internet_access')fields.push(field('policyId','Internet firewall policy ID (unused)','9000','number'));
  }
  return fields;
}
export const internetDefaults=(id,vendor)=>Object.fromEntries(internetFields(id,vendor).map(f=>[f.key,f.value]));
const name=(v,label)=>{if(!/^[A-Za-z][A-Za-z0-9._/-]{0,45}$/.test(v||''))throw Error(`${label}: use a CLI-safe interface or object name.`);return v;};
const integer=(v,min,max,label)=>{if(!/^\d+$/.test(String(v))||+v<min||+v>max)throw Error(`${label}: use ${min}–${max}.`);return +v;};
const overlap=(a,b)=>a&&b&&a.network<=b.end&&b.network<=a.end;
export function validateInternet(d,backup=false){
  if(!vendors.includes(d.vendor))throw Error('Unsupported internet gateway vendor.');
  for(const key of ['wan','lan'])name(d[key],key);
  if(d.wan===d.lan)throw Error('WAN and LAN interfaces must differ.');
  const errors=validateWan(d);if(errors.length)throw Error(errors.join(' '));
  const lan=cidr(d.local);if(!lan||lan.canonical!==d.local)throw Error('Use a canonical LAN network CIDR.');
  const host=ipv4(d.lanIp);if(host===null||host<=lan.network||host>=lan.end)throw Error('LAN gateway must be a usable host in the LAN network.');
  if(overlap(lan,cidr(`${d.ip}/30`)))throw Error('WAN1 and LAN must not overlap.');
  if(d.vendor==='paloalto')name(d.virtualRouter,'Virtual router');
  if(d.vendor==='juniper'&&[d.wan,...(d.officeVlans?[]:[d.lan]),d.wan2].filter(Boolean).some(x=>/\.\d+$/.test(x)))throw Error('Junos requires physical interface names; unit 0 is generated.');
  if(d.vendor==='fortinet')integer(d.routeId,1,4294967294,'Primary route ID');
  if(backup){
    if(d.vendor==='ios')integer(d.trackId??'900',1,999,'First WAN track ID');
    name(d.wan2,'WAN2 interface');
    if([d.wan,d.lan,d.physicalLan].includes(d.wan2))throw Error('WAN2 must use a dedicated interface, distinct from WAN1 and LAN.');
    const errors2=validateWan({ip:d.ip2,gateway:d.gateway2,wanPrefix:'30'});if(errors2.length)throw Error('WAN2: '+errors2.join(' '));
    const net=cidr(`${d.ip2}/30`);
    if([cidr(`${d.ip}/30`),lan,d.vlan2Enabled==='on'?cidr(d.vlan2Subnet):null].some(n=>overlap(n,net)))throw Error('WAN2 /30 must not overlap WAN1 or either LAN VLAN.');
    integer(d.backupDistance||'5',2,d.vendor==='paloalto'?65535:254,'Backup route preference');
    if(d.vendor==='fortinet'&&integer(d.backupRouteId,1,4294967294,'Backup route ID')===+d.routeId)throw Error('Primary and backup route IDs must differ.');
  }
}
const wrap=(vendor,body)=>vendor==='ios'?`configure terminal\n${body}\nend\n`:['juniper','paloalto'].includes(vendor)?`configure\n${body}\nexit\n`:body+'\n';
export function internetRoutes(d,backup=false){
  validateInternet(d,backup);const distance=d.backupDistance||'5';
  const paths=[{port:d.wan,ip:d.ip,gateway:d.gateway,preference:1,id:d.routeId,label:'PRIMARY'},...(backup?[{port:d.wan2,ip:d.ip2,gateway:d.gateway2,preference:distance,id:d.backupRouteId,label:'BACKUP'}]:[])];
  if(d.vendor==='ios'){
    const start=Number(d.trackId??'900');
    const tracking=backup?paths.map((p,i)=>`track ${start+i} interface ${p.port} line-protocol\n exit`).join('\n')+'\n':'';
    return tracking+paths.map((p,i)=>`ip route 0.0.0.0 0.0.0.0 ${p.gateway} ${p.preference}${backup?' track '+(start+i):''}`).join('\n');
  }
  if(d.vendor==='mikrotik')return paths.map(p=>`/ip route add dst-address=0.0.0.0/0 gateway=${p.gateway}%${p.port} distance=${p.preference} check-gateway=ping comment="NOC-${p.label}"`).join('\n');
  if(d.vendor==='juniper')return `set routing-options static route 0.0.0.0/0 next-hop ${d.gateway}\nset routing-options static route 0.0.0.0/0 preference 1${backup?`\nset routing-options static route 0.0.0.0/0 qualified-next-hop ${d.gateway2} preference ${distance}`:''}`;
  if(d.vendor==='fortinet')return `config router static\n${paths.map(p=>` edit ${p.id}\n  set dst 0.0.0.0 0.0.0.0\n  set gateway ${p.gateway}\n  set device "${p.port}"\n  set distance ${p.preference}\n next`).join('\n')}\nend`;
  return `set network virtual-router ${d.virtualRouter} interface [ ${d.lan} ${paths.map(p=>p.port).join(' ')} ]\n`+paths.map(p=>`set network virtual-router ${d.virtualRouter} routing-table ip static-route NOC-${p.label} destination 0.0.0.0/0\nset network virtual-router ${d.virtualRouter} routing-table ip static-route NOC-${p.label} interface ${p.port}\nset network virtual-router ${d.virtualRouter} routing-table ip static-route NOC-${p.label} nexthop ip-address ${p.gateway}\nset network virtual-router ${d.virtualRouter} routing-table ip static-route NOC-${p.label} metric ${p.preference}`).join('\n');
}
export function failoverConfig(d){
  validateInternet(d,true);let binding;
  if(d.vendor==='ios')binding=`interface ${d.wan2}\n ip address ${d.ip2} 255.255.255.252\n no shutdown\n exit`;
  if(d.vendor==='mikrotik')binding=`/ip address add address=${d.ip2}/30 interface=${d.wan2} comment="NOC WAN2 binding"`;
  if(d.vendor==='juniper')binding=`set interfaces ${d.wan2} unit 0 family inet address ${d.ip2}/30`;
  if(d.vendor==='paloalto')binding=`set network interface ethernet ${d.wan2} layer3 ip ${d.ip2}/30`;
  if(d.vendor==='fortinet')binding=`config system interface\n edit "${d.wan2}"\n  set mode static\n  set ip ${d.ip2} 255.255.255.252\n  set status up\n next\nend`;
  return wrap(d.vendor,binding+'\n'+internetRoutes(d,true));
}
const subnets=d=>[d.local,...(d.vlan2Enabled==='on'?[d.vlan2Subnet]:[])];
const insidePorts=d=>d.vlan2Enabled==='on'?[`${d.physicalLan||d.lan}.${d.vlan}`,`${d.physicalLan||d.lan}.${d.vlan2}`]:[d.lan];
export function iosInternetPat(d,acl='NOC-INTERNET-NAT'){
  if(d.wan2)throw Error('Cisco ACL-only NAT route-maps cannot distinguish two ISP egress paths. Disable Dual ISP for this PAT template, or design platform-supported egress-aware NAT separately.');
  name(acl,'NAT ACL');const paths=[d.wan,...(d.wan2?[d.wan2]:[])];
  return `ip access-list standard ${acl}\n${subnets(d).map(n=>{const c=cidr(n);return ` permit ${c.ip} ${c.wildcard}`;}).join('\n')}\n exit\n${insidePorts(d).map(p=>`interface ${p}\n ip nat inside\n exit`).join('\n')}\n${paths.map((p,i)=>`interface ${p}\n ip nat outside\n exit\nroute-map NOC-INTERNET-ISP${i+1} permit 10\n match ip address ${acl}\n exit\nip nat inside source route-map NOC-INTERNET-ISP${i+1} interface ${p} overload`).join('\n')}`;
}
export function officeConfig(d){
  validateInternet(d,Boolean(d.wan2));
  const paths=[d.wan,...(d.wan2?[d.wan2]:[])],rows=officeNetworks(d),lanPorts=rows.map(r=>r.port),networks=rows.map(r=>r.network);let body='';
  if(['juniper','paloalto'].includes(d.vendor)){
    name(d.trustZone,'LAN zone');name(d.untrustZone,'WAN zone');if(d.trustZone===d.untrustZone)throw Error('LAN and WAN security zones must differ.');
  }
  if(d.vendor==='ios'){
    body=iosInternetPat(d)+`\nzone security NOC-OFFICE-LAN\nzone security NOC-OFFICE-WAN\nclass-map type inspect match-any NOC-OFFICE-TRAFFIC\n match protocol tcp\n match protocol udp\n match protocol icmp\n exit\npolicy-map type inspect NOC-OFFICE-INSPECT\n class type inspect NOC-OFFICE-TRAFFIC\n  inspect\n exit\n class class-default\n  drop\n exit\n exit\npolicy-map type inspect NOC-OFFICE-DROP\n class class-default\n  drop\n exit\n exit\nzone-pair security NOC-OFFICE-OUT source NOC-OFFICE-LAN destination NOC-OFFICE-WAN\n service-policy type inspect NOC-OFFICE-INSPECT\n exit\nzone-pair security NOC-OFFICE-SELF-OUT source self destination NOC-OFFICE-WAN\n service-policy type inspect NOC-OFFICE-INSPECT\n exit\nzone-pair security NOC-OFFICE-SELF-IN source NOC-OFFICE-WAN destination self\n service-policy type inspect NOC-OFFICE-DROP\n exit\n${insidePorts(d).map(p=>`interface ${p}\n zone-member security NOC-OFFICE-LAN\n exit`).join('\n')}\n${paths.map(p=>`interface ${p}\n zone-member security NOC-OFFICE-WAN\n exit`).join('\n')}`;
  }
  if(d.vendor==='mikrotik'){
    body=rows.flatMap(r=>paths.map(p=>`/ip firewall nat add chain=srcnat src-address=${r.network} out-interface=${p} action=masquerade comment="NOC office PAT"`)).join('\n')+
    '\n/ip firewall filter add chain=input connection-state=established,related action=accept\n/ip firewall filter add chain=input connection-state=invalid action=drop\n'+rows.map(r=>`/ip firewall filter add chain=input in-interface=${r.port} protocol=udp src-port=68 dst-port=67 action=accept comment="NOC DHCP discovery"\n/ip firewall filter add chain=input in-interface=${r.port} src-address=${r.network} action=accept comment="NOC LAN management"`).join('\n')+
    '\n/ip firewall filter add chain=input action=drop comment="NOC deny other router access"\n/ip firewall filter add chain=forward connection-state=established,related action=accept\n/ip firewall filter add chain=forward connection-state=invalid action=drop\n'+rows.flatMap(r=>paths.map(p=>`/ip firewall filter add chain=forward in-interface=${r.port} src-address=${r.network} out-interface=${p} action=accept comment="NOC LAN internet"`)).join('\n')+'\n/ip firewall filter add chain=forward action=drop comment="NOC deny unsolicited forwarding"';
  }
  if(d.vendor==='fortinet'){
    integer(d.policyId,1,4294967294,'Firewall policy ID');
    body=`config system interface\n${paths.map(p=>` edit "${p}"\n  unset allowaccess\n next`).join('\n')}\nend\nconfig firewall address\n${rows.map((r,i)=>{const n=cidr(r.network);return ` edit "NOC-OFFICE-LAN${i+1}"\n  set subnet ${n.ip} ${n.mask}\n next`;}).join('\n')}\nend\nconfig firewall policy\n edit ${d.policyId}\n  set name "NOC-OFFICE-INTERNET"\n  set srcintf ${lanPorts.map(p=>`"${p}"`).join(' ')}\n  set dstintf ${paths.map(p=>`"${p}"`).join(' ')}\n  set srcaddr ${rows.map((r,i)=>`"NOC-OFFICE-LAN${i+1}"`).join(' ')}\n  set dstaddr "all"\n  set action accept\n  set schedule "always"\n  set service "ALL"\n  set nat enable\n  set logtraffic all\n next\nend`;
  }
  if(d.vendor==='juniper'){
    body=rows.map(r=>`set security zones security-zone ${d.trustZone} interfaces ${r.port}${d.officeVlans?'':'.0'}`).join('\n')+'\n'+paths.map(p=>`set security zones security-zone ${d.untrustZone} interfaces ${p}.0`).join('\n')+
    `\nset security nat source rule-set NOC-OFFICE from zone ${d.trustZone}\nset security nat source rule-set NOC-OFFICE to zone ${d.untrustZone}\nset security nat source rule-set NOC-OFFICE rule INTERNET match source-address [ ${networks.join(' ')} ]\nset security nat source rule-set NOC-OFFICE rule INTERNET then source-nat interface\n`+
    rows.map((r,i)=>`set security address-book global address NOC-OFFICE-LAN${i+1} ${r.network}`).join('\n')+
    `\nset security policies from-zone ${d.trustZone} to-zone ${d.untrustZone} policy NOC-OFFICE-OUT match source-address [ ${rows.map((r,i)=>'NOC-OFFICE-LAN'+(i+1)).join(' ')} ]\nset security policies from-zone ${d.trustZone} to-zone ${d.untrustZone} policy NOC-OFFICE-OUT match destination-address any\nset security policies from-zone ${d.trustZone} to-zone ${d.untrustZone} policy NOC-OFFICE-OUT match application any\nset security policies from-zone ${d.trustZone} to-zone ${d.untrustZone} policy NOC-OFFICE-OUT then permit\nset security policies from-zone ${d.trustZone} to-zone ${d.untrustZone} policy NOC-OFFICE-OUT then log session-close`;
  }
  if(d.vendor==='paloalto'){
    body=`set network virtual-router ${d.virtualRouter} interface [ ${lanPorts.join(' ')} ${paths.join(' ')} ]\nset zone ${d.trustZone} network layer3 [ ${lanPorts.join(' ')} ]\nset zone ${d.untrustZone} network layer3 [ ${paths.join(' ')} ]\n`+
    paths.map((p,i)=>`set rulebase nat rules NOC-OFFICE-ISP${i+1} from ${d.trustZone} to ${d.untrustZone} source [ ${networks.join(' ')} ] destination any service any to-interface ${p}\nset rulebase nat rules NOC-OFFICE-ISP${i+1} source-translation dynamic-ip-and-port interface-address interface ${p}`).join('\n')+
    `\nset rulebase security rules NOC-OFFICE-OUT from ${d.trustZone} to ${d.untrustZone} source [ ${networks.join(' ')} ] destination any application any service application-default action allow log-end yes`;
  }
  body+='\n'+officeServices(d);
  if(!d.wan2)body+='\n'+internetRoutes(d,false);
  return wrap(d.vendor,body);
}
export function generateInternet(id,d){
  try{return{errors:[],scripts:[{title:INTERNET_FEATURES[id].title,code:id==='wan_failover'?failoverConfig(d):officeConfig(d)}]};}
  catch(e){return{errors:[e.message],scripts:[]};}
}
