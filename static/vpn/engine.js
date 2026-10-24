import juniper from './vendors/juniper.js';
import { ipv4, cidr } from './address.js';
export { ipv4, cidr } from './address.js';
import ios from './vendors/ios.js';
import asa from './vendors/asa.js';
import mikrotik from './vendors/mikrotik.js';
import fortinet from './vendors/fortinet.js';
import paloalto from './vendors/paloalto.js';
import wireguard from './vendors/wireguard.js';
import { validateInterfaces, interfaceConfig, validateWan } from './interfaces.js';
import { vtiConfig } from './vti.js';

export const VENDORS = {
  ios: 'Cisco IOS XE 17.x', asa: 'Cisco ASA 9.22+',
  juniper: 'Juniper Junos SRX', mikrotik: 'MikroTik RouterOS 7.x', fortinet: 'FortiGate FortiOS 7.4', paloalto: 'Palo Alto PAN-OS 11.x',
};
export const PROTOCOLS = { ikev2: 'IPsec · IKEv2', ikev1: 'IPsec · IKEv1', vti: 'Cisco VTI · IKEv1 (IOS ↔ IOS)', gre: 'GRE over IPsec · IKEv2', wireguard: 'WireGuard' };
export const DEFAULTS = {
  bindInterfaces: false,
  vtiLegacy: false,
  protocol: 'ikev2', encryption: '256', hash: '256', dh: '14', pfs: '14', lifetime1: '28800', lifetime2: '3600',
  a: { vendor: 'ios', ip: '203.0.113.10', local: '192.168.1.0/24', remote: '10.20.0.0/24', psk: '', wan: 'GigabitEthernet1', lan: 'GigabitEthernet2', wanPrefix:'30', lanIp:'192.168.1.1', wanPort:'GigabitEthernet0/0', lanPort:'GigabitEthernet0/1', gateway: '203.0.113.9', zone: 'trust', vr: 'default', tunnel: '169.254.100.1', port: '51820', privateKey: '', publicKey: '' },
  b: { vendor: 'fortinet', ip: '198.51.100.22', local: '10.20.0.0/24', remote: '192.168.1.0/24', psk: '', wan: 'port1', lan: 'port2', wanPrefix:'30', lanIp:'10.20.0.1', wanPort:'GigabitEthernet0/0', lanPort:'GigabitEthernet0/1', gateway: '198.51.100.21', zone: 'trust', vr: 'default', tunnel: '169.254.100.2', port: '51820', privateKey: '', publicKey: '' },
};
const overlaps = (a, b) => a.network <= b.end && b.network <= a.end;
export function support(vendor, protocol) {
  if(vendor === 'juniper' && !['ikev1','ikev2'].includes(protocol)) return 'Junos SRX supports IKEv1/IKEv2 templates here; choose IPsec for this vendor.';
  if (protocol === 'vti' && vendor !== 'ios') return 'This VTI template requires Cisco IOS on both sides (route-based any/any selectors). Existing cross-vendor IPsec modes remain available.';
  if (protocol === 'wireguard' && vendor !== 'mikrotik') return 'WireGuard generation is available for RouterOS 7 only. Use an external WireGuard gateway for this platform.';
  if (protocol === 'gre' && ['asa', 'paloalto'].includes(vendor)) return 'This generator does not provide a GRE-over-IPsec template for ASA or PAN-OS. Choose IOS XE, RouterOS, or FortiOS.';
  if (protocol === 'ikev1' && vendor === 'asa') return 'ASA IKEv1 does not support this generator’s SHA-256 ESP suite. Choose IKEv2; no silent downgrade to SHA-1.';
  return '';
}
const keyOK = k => /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/.test(k) && !/^A{43}=$/.test(k);
export function validate(c) {
  const errors = validateInterfaces(c);
  if (!Object.hasOwn(PROTOCOLS, c.protocol)) errors.push('Select a supported protocol.');
  if (c.protocol !== 'wireguard') {
  for (const [field, allowed] of Object.entries({ encryption: ['128','256'], hash: ['256'], dh: ['14','19'], pfs: ['14','19'] })) {
    if (!allowed.includes(c[field])) errors.push(`Invalid ${field}.`);
  }
  for (const field of ['lifetime1', 'lifetime2']) if (!/^\d+$/.test(c[field]) || +c[field] < 300 || +c[field] > 86400) errors.push(`${field}: use 300–86400 seconds.`);
  }
  for (const side of ['a', 'b']) {
    const s = c[side], label = `Side ${side.toUpperCase()}`;
    if (!Object.hasOwn(VENDORS, s.vendor)) errors.push(`${label}: select a vendor.`);
    errors.push(...validateWan(s).map(e=>`${label}: ${e}`));
    const unsupported = support(s.vendor, c.protocol); if (unsupported) errors.push(`${label}: ${unsupported}`);
    if (ipv4(s.ip) === null || +s.ip.split('.')[0] === 0 || +s.ip.split('.')[0] >= 224 || +s.ip.split('.')[0] === 127) errors.push(`${label}: enter a unicast public IPv4 address.`);
    for (const field of ['local', 'remote']) {
      const net = cidr(s[field]);
      if (!net || net.canonical !== s[field]) errors.push(`${label}: ${field} must be a canonical IPv4 network, e.g. 10.10.0.0/24.`);
    }
    const contextFields = c.protocol === 'wireguard' ? [] : s.vendor === 'paloalto' ? ['wan', 'zone', 'vr'] : ['wan', 'lan'];
    for (const field of contextFields) if (!/^[A-Za-z][A-Za-z0-9._/-]{0,45}$/.test(s[field])) errors.push(`${label}: invalid ${field} name.`);
    if (c.protocol !== 'wireguard' && ['ios','asa'].includes(s.vendor) && ipv4(s.gateway) === null) errors.push(`${label}: a valid WAN next-hop is required.`);
    if (c.protocol !== 'wireguard' && !/^[A-Za-z0-9_@%+=:,.-]{16,64}$/.test(s.psk)) errors.push(`${label}: PSK must be 16–64 CLI-safe characters (letters, digits, _ @ % + = : , . -).`);
    if (['gre','wireguard','vti'].includes(c.protocol)) {
      const n = ipv4(s.tunnel);
      if (n === null || n % 4 === 0 || n % 4 === 3) errors.push(`${label}: tunnel IP must be a usable /30 host.`);
    }
    if (c.protocol === 'wireguard') {
      if (!keyOK(s.privateKey) || !keyOK(s.publicKey)) errors.push(`${label}: supply valid nonzero 32-byte base64 private and public WireGuard keys.`);
      if (!/^\d+$/.test(s.port) || +s.port < 1 || +s.port > 65535) errors.push(`${label}: UDP port must be 1–65535.`);
      if (s.psk && !keyOK(s.psk)) errors.push(`${label}: optional WireGuard PSK must be a nonzero 32-byte base64 key.`);
    }
  }
  if (c.a.ip === c.b.ip) errors.push('The two public endpoints must differ.');
  if (c.a.local !== c.b.remote || c.b.local !== c.a.remote) errors.push('Traffic selectors must mirror: A local = B remote, A remote = B local.');
  const a = cidr(c.a.local), b = cidr(c.b.local);
  if (a && b && overlaps(a, b)) errors.push('Local networks overlap. Select distinct site networks.');
  if (c.a.psk !== c.b.psk) errors.push('Both sides must use the same pre-shared key.');
  if (['gre','wireguard','vti'].includes(c.protocol)) {
    const ta = cidr(`${c.a.tunnel}/30`), tb = cidr(`${c.b.tunnel}/30`);
    if (!ta || !tb || ta.network !== tb.network || c.a.tunnel === c.b.tunnel) errors.push('Tunnel endpoints must be distinct hosts in the same /30.');
    if (ta && ((a && overlaps(ta, a)) || (b && overlaps(ta, b)))) errors.push('Tunnel network overlaps a LAN network.');
  }
  if (c.protocol === 'wireguard' && c.a.publicKey === c.b.publicKey) errors.push('Each WireGuard side needs a distinct key pair.');
  if ((c.a.vendor === 'paloalto' || c.b.vendor === 'paloalto') && (+c.lifetime1 > 65535 || +c.lifetime2 > 65535)) errors.push('PAN-OS seconds lifetimes must be at most 65535.');
  return [...new Set(errors)];
}
export function generate(c) {
  const errors = validate(c);
  if (errors.length) return { errors, a: '', b: '' };
  const generators = { ios, asa, mikrotik, fortinet, paloalto, juniper };
  const render = (s, r) => (c.bindInterfaces ? interfaceConfig(s) : '') + (c.protocol === 'vti' ? vtiConfig(c, s, r) : c.protocol === 'wireguard' ? wireguard(c, s, r) : generators[s.vendor](c, s, r));
  return { errors: [], a: render(c.a, c.b), b: render(c.b, c.a) };
}
