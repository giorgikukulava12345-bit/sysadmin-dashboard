import { cidr, ipv4 } from './address.js';

export function validateWan(s) {
  const errors=[],ip=ipv4(s.ip),gateway=ipv4(s.gateway),n=cidr(`${s.ip}/30`);
  if(ip!==null&&(ip<16777216||(ip>>>24)===127||ip>=0xe0000000))errors.push('WAN IP must be unicast, outside 0/8, loopback and multicast/reserved space.');
  if(s.wanPrefix!=='30')errors.push('WAN prefix must be /30 (two usable hosts).');
  if(ip===null||!n||ip<=n.network||ip>=n.end)errors.push('WAN IP must be a usable /30 host, not the network or broadcast address.');
  if(!n||gateway===null||gateway<=n.network||gateway>=n.end||gateway===ip)errors.push('ISP gateway must be the other usable host in the same /30 subnet.');
  return errors;
}
const validName = value => /^[A-Za-z][A-Za-z0-9._/-]{0,45}$/.test(value || '');
export function validateInterfaces(config) {
  if (!config.bindInterfaces) return [];
  const errors = [];
  for (const side of ['a', 'b']) {
    const s = config[side], label = `Side ${side.toUpperCase()}`;
    for (const field of ['wan', 'lan', ...(s.vendor === 'asa' ? ['wanPort', 'lanPort'] : [])]) {
      if (!validName(s[field])) errors.push(`${label}: enter a valid ${field} interface name.`);
    }
    if(s.vendor==='juniper'&&[s.wan,s.lan].some(x=>/\.\d+$/.test(x)))errors.push(`${label}: base Junos bindings require physical interface names; unit 0 is configured explicitly.`);
    if (s.wan === s.lan || (s.vendor === 'asa' && s.wanPort === s.lanPort)) errors.push(`${label}: WAN and LAN must use different interfaces.`);
    errors.push(...validateWan(s).map(e=>`${label}: ${e}`));
    const wan = cidr(`${s.ip}/${s.wanPrefix}`), lan = cidr(s.local), host = ipv4(s.lanIp);
    if (!lan || host === null || host <= lan.network || host >= lan.end) errors.push(`${label}: LAN interface IP must be a usable host inside the local subnet.`);
    if (wan && +s.wanPrefix < 31 && [wan.network, wan.end].includes(ipv4(s.ip))) errors.push(`${label}: public IP is a network or broadcast address for this WAN prefix.`);
    if (wan && lan && wan.network <= lan.end && lan.network <= wan.end) errors.push(`${label}: WAN and LAN networks must not overlap.`);
    if (s.vendor === 'asa' && ['inside','outside'].includes(s.wan) && s.wan === s.lan) errors.push(`${label}: ASA nameifs must be distinct.`);
  }
  if(config.a.ip===config.b.ip)errors.push('The two router WAN addresses must differ.');
  return errors;
}

// Addressing is explicitly enabled by the user; never change existing interfaces silently.
export function interfaceConfig(s) {
  const wan = cidr(`${s.ip}/${s.wanPrefix}`), lan = cidr(s.local);
  switch (s.vendor) {
    case 'ios': return `configure terminal
interface ${s.wan}
 ip address ${s.ip} ${wan.mask}
 no shutdown
 exit
interface ${s.lan}
 ip address ${s.lanIp} ${lan.mask}
 no shutdown
 exit
end
`;
    case 'asa': return `configure terminal
interface ${s.wanPort}
 nameif ${s.wan}
 security-level 0
 ip address ${s.ip} ${wan.mask}
 no shutdown
 exit
interface ${s.lanPort}
 nameif ${s.lan}
 security-level 100
 ip address ${s.lanIp} ${lan.mask}
 no shutdown
 exit
end
`;
    case 'mikrotik': return `/ip address add address=${s.ip}/${s.wanPrefix} interface=${s.wan} comment="NOC WAN binding"
/ip address add address=${s.lanIp}/${s.local.split('/')[1]} interface=${s.lan} comment="NOC LAN binding"
`;
    case 'fortinet': return `config system interface
 edit "${s.wan}"
  set mode static
  set ip ${s.ip} ${wan.mask}
 next
 edit "${s.lan}"
  set mode static
  set ip ${s.lanIp} ${lan.mask}
 next
end
`;
    case 'paloalto': return `configure
set network interface ethernet ${s.wan} layer3 ip ${s.ip}/${s.wanPrefix}
set network interface ethernet ${s.lan} layer3 ip ${s.lanIp}/${s.local.split('/')[1]}
exit
`;
    case 'juniper': return `configure
set interfaces ${s.wan} unit 0 family inet address ${s.ip}/${s.wanPrefix}
set interfaces ${s.lan} unit 0 family inet address ${s.lanIp}/${s.local.split('/' )[1]}
exit
`;
    default: throw new Error('Unsupported interface platform');
  }
}
