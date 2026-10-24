import {cidr} from './address.js';
/** Tagged router-on-a-stick; companion switch remains a Cisco Layer 2 device. */
export function officeRouterVlans(s){
  const rows=[{id:s.vlan,ip:s.lanIp,net:cidr(s.local)},{id:s.vlan2,ip:s.vlan2Gateway,net:cidr(s.vlan2Subnet)}];
  if(s.vendor==='ios')return `configure terminal\nip routing\ninterface ${s.wan}\n ip address ${s.ip} 255.255.255.252\n no shutdown\n exit\ninterface ${s.lan}\n no ip address\n no shutdown\n exit\n${rows.map(r=>`interface ${s.lan}.${r.id}\n encapsulation dot1Q ${r.id}\n ip address ${r.ip} ${r.net.mask}\n exit`).join('\n')}\nend`;
  if(s.vendor==='mikrotik')return `/ip address add address=${s.ip}/30 interface=${s.wan}\n`+rows.map(r=>`/interface vlan add name=${s.lan}.${r.id} interface=${s.lan} vlan-id=${r.id}\n/ip address add address=${r.ip}/${r.net.canonical.split('/')[1]} interface=${s.lan}.${r.id}`).join('\n');
  if(s.vendor==='fortinet')return `config system interface\n edit "${s.wan}"\n  set mode static\n  set ip ${s.ip} 255.255.255.252\n next\n${rows.map(r=>` edit "${s.lan}.${r.id}"\n  set interface "${s.lan}"\n  set vlanid ${r.id}\n  set ip ${r.ip} ${r.net.mask}\n next`).join('\n')}\nend`;
  if(s.vendor==='juniper')return `configure\nset interfaces ${s.wan} unit 0 family inet address ${s.ip}/30\nset interfaces ${s.lan} vlan-tagging\n${rows.map(r=>`set interfaces ${s.lan} unit ${r.id} vlan-id ${r.id}\nset interfaces ${s.lan} unit ${r.id} family inet address ${r.ip}/${r.net.canonical.split('/')[1]}`).join('\n')}\nexit`;
  if(s.vendor==='paloalto')return `configure\nset network interface ethernet ${s.wan} layer3 ip ${s.ip}/30\n${rows.map(r=>`set network interface ethernet ${s.lan} layer3 units ${s.lan}.${r.id} tag ${r.id}\nset network interface ethernet ${s.lan} layer3 units ${s.lan}.${r.id} ip ${r.ip}/${r.net.canonical.split('/')[1]}`).join('\n')}\nexit`;
  throw Error('Unsupported routed VLAN platform.');
}
