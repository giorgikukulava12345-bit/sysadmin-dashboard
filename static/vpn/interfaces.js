import { cidr, ipv4 } from './address.js';

const validName = value => /^[A-Za-z][A-Za-z0-9._/-]{0,45}$/.test(value || '');
export function validateInterfaces(config) {
  if (!config.bindInterfaces) return [];
  const errors = [];
  for (const side of ['a', 'b']) {
    const s = config[side], label = `Side ${side.toUpperCase()}`;
    for (const field of ['wan', 'lan', ...(s.vendor === 'asa' ? ['wanPort', 'lanPort'] : [])]) {
      if (!validName(s[field])) errors.push(`${label}: enter a valid ${field} interface name.`);
    }
    if (s.wan === s.lan || (s.vendor === 'asa' && s.wanPort === s.lanPort)) errors.push(`${label}: WAN and LAN must use different interfaces.`);
    if (!/^(?:[1-9]|[12]\d|30|31)$/.test(s.wanPrefix || '')) errors.push(`${label}: WAN prefix must be 1–31.`);
    const wan = cidr(`${s.ip}/${s.wanPrefix}`), lan = cidr(s.local), host = ipv4(s.lanIp);
    if (!lan || host === null || host <= lan.network || host >= lan.end) errors.push(`${label}: LAN interface IP must be a usable host inside the local subnet.`);
    if (wan && +s.wanPrefix < 31 && [wan.network, wan.end].includes(ipv4(s.ip))) errors.push(`${label}: public IP is a network or broadcast address for this WAN prefix.`);
    if (wan && lan && wan.network <= lan.end && lan.network <= wan.end) errors.push(`${label}: WAN and LAN networks must not overlap.`);
    if (s.vendor === 'asa' && ['inside','outside'].includes(s.wan) && s.wan === s.lan) errors.push(`${label}: ASA nameifs must be distinct.`);
  }
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
