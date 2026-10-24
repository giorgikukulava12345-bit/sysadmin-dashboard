import { cidr, ipv4 } from './address.js';

export const hasSecondVlan=site=>site.vlan2Enabled==='on';
const physical=value=>/^(?:FastEthernet|GigabitEthernet|TenGigabitEthernet|Ethernet)\d+(?:\/\d+)*$/.test(value||'');
const validVlan=value=>/^\d+$/.test(String(value))&&+value>=1&&+value<=4094&&!(+value>=1002&&+value<=1005);
const overlap=(a,b)=>a&&b&&a.network<=b.end&&b.network<=a.end;
export function validateSecondVlan(site,peer){
  if(!hasSecondVlan(site))return [];
  const errors=[],n=cidr(site.vlan2Subnet),gateway=ipv4(site.vlan2Gateway),svi=ipv4(site.vlan2SwitchIp);
  if(site.vendor!=='ios'||site.switchVendor!=='ios')errors.push('Second VLAN routed-trunk mode requires a Cisco IOS router and Cisco IOS switch in this template.');
  if(!validVlan(site.vlan)||!validVlan(site.vlan2))errors.push('Both VLAN IDs must be 1–4094, excluding reserved VLANs 1002–1005.');
  if(+site.vlan===+site.vlan2)errors.push('Second VLAN ID must differ from the primary LAN VLAN.');
  if(!n||n.canonical!==site.vlan2Subnet||+site.vlan2Subnet.split('/')[1]>30||n.network<16777216||n.end>=0xe0000000)errors.push('Second VLAN subnet must be a canonical unicast IPv4 network with usable hosts (/1–/30).');
  for(const[label,address]of [['gateway',gateway],['switch SVI',svi]])if(!n||address===null||address<=n.network||address>=n.end)errors.push(`Second VLAN ${label} must be a usable host within its subnet.`);
  if(gateway===svi)errors.push('Second VLAN router gateway and switch SVI IP must differ.');
  for(const[label,other]of [['primary LAN',cidr(site.local)],['WAN',cidr(`${site.ip}/${site.wanPrefix}`)],['remote site LAN',cidr(peer?.local)],['remote second VLAN',hasSecondVlan(peer||{})?cidr(peer.vlan2Subnet):null]])if(overlap(n,other))errors.push(`Second VLAN subnet must not overlap the ${label}.`);
  if(![site.lan,site.uplink,site.access,site.vlan2Access].every(physical))errors.push('Routed-trunk mode needs physical IOS Ethernet LAN, uplink and access ports (no subinterface names).');
  if(new Set([site.uplink,site.access,site.vlan2Access]).size!==3)errors.push('Router-facing trunk and the two VLAN access ports must be distinct.');
  return errors;
}

/** The router owns gateway addresses; the switch SVIs are management endpoints. */
export function dualVlanRouterConfig(s){
  const wan=cidr(`${s.ip}/${s.wanPrefix}`),one=cidr(s.local),two=cidr(s.vlan2Subnet);
  return `configure terminal\n! Router-on-a-stick: primary VLAN is native on BOTH ends.\nip routing\ninterface ${s.wan}\n ip address ${s.ip} ${wan.mask}\n no shutdown\n exit\ninterface ${s.lan}\n no ip address\n no shutdown\n exit\ninterface ${s.lan}.${s.vlan}\n description NOC-PRIMARY-VLAN-${s.vlan}\n encapsulation dot1Q ${s.vlan} native\n ip address ${s.lanIp} ${one.mask}\n exit\ninterface ${s.lan}.${s.vlan2}\n description NOC-SECOND-VLAN-${s.vlan2}\n encapsulation dot1Q ${s.vlan2}\n ip address ${s.vlan2Gateway} ${two.mask}\n exit\n! Both VLAN networks are directly connected; no inter-VLAN static route is needed.\nend\n`;
}
export function dualVlanSwitchConfig(s){
  const one=cidr(s.local),two=cidr(s.vlan2Subnet);
  return `configure terminal\n! Layer 2 switch: SVIs are management IPs; router subinterfaces own the gateways.\nvlan ${s.vlan}\n name NOC-PRIMARY\n exit\nvlan ${s.vlan2}\n name NOC-SECOND\n exit\ninterface ${s.uplink}\n switchport mode trunk\n switchport trunk native vlan ${s.vlan}\n switchport trunk allowed vlan ${s.vlan},${s.vlan2}\n no shutdown\n exit\ninterface ${s.access}\n switchport mode access\n switchport access vlan ${s.vlan}\n spanning-tree portfast\n spanning-tree bpduguard enable\n no shutdown\n exit\ninterface ${s.vlan2Access}\n switchport mode access\n switchport access vlan ${s.vlan2}\n spanning-tree portfast\n spanning-tree bpduguard enable\n no shutdown\n exit\ninterface Vlan${s.vlan}\n ip address ${s.switchIp} ${one.mask}\n no shutdown\n exit\ninterface Vlan${s.vlan2}\n ip address ${s.vlan2SwitchIp} ${two.mask}\n no shutdown\n exit\nip default-gateway ${s.lanIp}\n! Existing ip routing must be disabled for L2 management default-gateway behavior.\nend\n`;
}
export const routedSite=s=>hasSecondVlan(s)?{...s,lan:`${s.lan}.${s.vlan}`}:{...s};
