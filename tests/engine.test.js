import { DEFAULTS, VENDORS, PROTOCOLS, generate, cidr, ipv4, support } from '../static/vpn/engine.js';
import { TOOLS, defaultsFor, generateTool } from '../static/vpn/catalog.js';
import { planVlsm, vlsmTsv } from '../static/vpn/vlsm.js';
let passed = 0;
const results = [];
function test(name, fn) {
  try { fn(); passed++; results.push(`PASS ${name}`); }
  catch (error) { results.push(`FAIL ${name}: ${error.message}`); }
}
function assert(condition, message = 'Assertion failed') { if (!condition) throw new Error(message); }
function config() { const c = structuredClone(DEFAULTS); c.a.psk = c.b.psk = 'ExampleKey_0123456789'; return c; }
function blocked(c, text) {
  const r = generate(c); assert(r.errors.some(e => e.includes(text)), JSON.stringify(r.errors));
  assert(r.a === '' && r.b === '', 'Invalid configuration exposed output');
}
test('IPv4 strict parsing and subnet masks', () => {
  assert(ipv4('255.255.255.255') === 4294967295);
  for (const ip of ['1.2.3.256','01.2.3.4','1.2.3','1.2.3.4\n','-1.2.3.4']) assert(ipv4(ip) === null, ip);
  assert(cidr('10.1.2.9/24').canonical === '10.1.2.0/24');
  assert(cidr('10.1.2.0/24').wildcard === '0.0.0.255');
  assert(cidr('0.0.0.0/0').mask === '0.0.0.0');
  assert(cidr('1.2.3.4/32').mask === '255.255.255.255');
});
for (const protocol of Object.keys(PROTOCOLS)) for (const a of Object.keys(VENDORS)) for (const b of Object.keys(VENDORS)) {
  test(`${protocol}: ${a} ↔ ${b}`, () => {
    const c = config(); c.protocol = protocol; c.a.vendor = a; c.b.vendor = b;
    c.a.privateKey = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=';
    c.a.publicKey = 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=';
    c.b.privateKey = btoa(String.fromCharCode(...Array(32).fill(3)));
    c.b.publicKey = btoa(String.fromCharCode(...Array(32).fill(4)));
    if (protocol === 'wireguard') c.a.psk = c.b.psk = '';
    const r = generate(c), unsupported = support(a, protocol) || support(b, protocol);
    if (unsupported) { assert(r.errors.length > 0); assert(!r.a && !r.b); return; }
    assert(!r.errors.length, r.errors.join('; '));
    assert(r.a.includes(c.b.ip) && r.b.includes(c.a.ip), 'Peer address not mirrored');
    assert(!/undefined|NaN|\[object Object\]/.test(r.a + r.b));
    if (protocol !== 'wireguard') assert(r.a.includes(c.a.psk) && r.b.includes(c.b.psk));
    else assert(r.a.includes(c.b.publicKey) && r.b.includes(c.a.publicKey), 'Wrong WG peer key');
    if (protocol === 'gre') assert(r.a.includes(c.a.tunnel) && r.b.includes(c.b.tunnel));
  });
}
test('Mismatched selectors block both scripts', () => { const c = config(); c.b.remote = '10.30.0.0/24'; blocked(c, 'mirror'); });
test('Mismatched secrets block both scripts', () => { const c = config(); c.b.psk += 'x'; blocked(c, 'same pre-shared key'); });
test('Overlapping networks are blocked', () => { const c = config(); c.a.remote = c.b.local = '10.10.0.0/25'; blocked(c, 'overlap'); });
test('Host bits in selectors are blocked', () => { const c = config(); c.a.local = c.b.remote = '10.10.0.1/24'; blocked(c, 'canonical'); });
test('CLI injection cannot reach output', () => {
  for (const payload of ['x\nend\nreload','foo"; reboot','$(reboot)','abc?def', '<script>alert(1)</script>']) {
    const c = config(); c.a.psk = c.b.psk = payload.padEnd(16, 'x'); blocked(c, 'CLI-safe');
  }
  const c = config(); c.a.wan = 'Gi1\nshutdown'; blocked(c, 'invalid wan');
});
test('Invalid algorithms and lifetime never generate CLI', () => {
  for (const [key, value] of [['protocol','openvpn'],['dh','2'],['hash','1'],['encryption','512'],['lifetime1','1'],['lifetime2','3600;end']]) {
    const c = config(); c[key] = value; assert(generate(c).errors.length > 0);
  }
});
test('DH19 and AES128 platform vocabulary', () => {
  const c = config(); c.a.vendor = 'asa'; c.encryption = '128'; c.dh = c.pfs = '19';
  const r = generate(c); assert(!r.errors.length);
  assert(r.a.includes('encryption aes\n')); assert(!r.a.includes('aes-128')); assert(r.a.includes('set pfs group19'));
  assert(r.b.includes('set proposal aes128-sha256')); assert(r.b.includes('set dhgrp 19'));
});
test('GRE enforces shared /30 with unique hosts', () => {
  for (const tunnel of ['169.254.100.0','169.254.100.3','169.254.101.2','169.254.100.1']) {
    const c = config(); c.protocol = 'gre'; c.b.tunnel = tunnel; assert(generate(c).errors.length > 0, tunnel);
  }
});
test('GRE transport selectors are public /32 and protocol47', () => {
  const c = config(); c.protocol = 'gre'; c.a.vendor = 'mikrotik';
  const r = generate(c); assert(!r.errors.length);
  assert(r.a.includes(`src-address=${c.a.ip}/32 dst-address=${c.b.ip}/32 protocol=gre tunnel=no`));
  assert(r.b.includes('set protocol 47\n  set encapsulation transport-mode'));
});
test('Blank secrets cannot produce scripts', () => blocked(structuredClone(DEFAULTS), 'PSK'));
test('Endpoint equality and invalid public addresses are blocked', () => {
  const c = config(); c.a.ip = c.b.ip; blocked(c, 'must differ');
  for (const ip of ['0.1.2.3','127.0.0.1','224.0.0.1','256.1.1.1']) { const c = config(); c.a.ip = ip; blocked(c, 'unicast'); }
});
test('PAN-OS seconds lifetime bound', () => { const c = config(); c.a.vendor = 'paloalto'; c.lifetime1 = '86400'; blocked(c, '65535'); });
test('PAN-OS AES128 retains explicit key size', () => {
  const c = config(); c.a.vendor = 'paloalto'; c.encryption = '128';
  const r = generate(c); assert(!r.errors.length); assert(r.a.includes('encryption aes-128-cbc'));
  assert(!r.a.includes('encryption aes-cbc'));
});
test('WireGuard ignores inactive IPsec fields', () => {
  const c = config(); c.protocol = 'wireguard'; c.a.vendor = c.b.vendor = 'mikrotik';
  c.a.psk = c.b.psk = ''; c.lifetime1 = ''; c.encryption = ''; c.a.wan = '';
  for (const [index, side] of ['a','b'].entries()) {
    c[side].privateKey = btoa(String.fromCharCode(...Array(32).fill(index + 1)));
    c[side].publicKey = btoa(String.fromCharCode(...Array(32).fill(index + 3)));
  }
  assert(!generate(c).errors.length);
  c.b.port = '65536'; blocked(c, 'UDP port');
  c.b.port = '51820'; c.a.psk = c.b.psk = 'invalid'; blocked(c, 'base64');
  c.a.psk = c.b.psk = ''; c.a.privateKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; blocked(c, 'nonzero');
});
for (const vendor of Object.keys(VENDORS)) test(`Interface binding uses current addresses on ${vendor}`, () => {
  const c = config(); c.bindInterfaces = true; c.a.vendor = vendor;
  c.a.wan = vendor === 'paloalto' ? 'ethernet1/3' : vendor === 'asa' ? 'outside' : 'eth0';
  c.a.lan = vendor === 'paloalto' ? 'ethernet1/4' : vendor === 'asa' ? 'inside' : 'eth1';
  c.a.ip = '203.0.113.50'; c.a.lanIp = '10.10.0.254';
  const r = generate(c); assert(!r.errors.length, r.errors.join('; '));
  assert(r.a.includes(c.a.ip)); assert(r.a.includes(c.a.lanIp));
  assert(r.a.includes(c.a.wan)); assert(r.a.includes(c.a.lan));
  if (vendor === 'asa') assert(r.a.includes(`interface ${c.a.wanPort}`));
  if (vendor === 'mikrotik') assert(r.a.includes('address=203.0.113.50/24 interface=eth0'));
  if (vendor === 'paloalto') assert(r.a.includes('ethernet ethernet1/4 layer3 ip 10.10.0.254/24'));
});
test('Interface binding is opt-in and unsafe assignments block output', () => {
  const c = config(); assert(!generate(c).a.includes('ip address 203.0.113.10'));
  c.bindInterfaces = true; c.a.lanIp = '10.99.0.1'; blocked(c, 'inside the local subnet');
  c.a.lanIp = '10.10.0.1'; c.a.wanPrefix = '33'; blocked(c, 'WAN prefix');
  c.a.wanPrefix = '24'; c.a.lan = c.a.wan; blocked(c, 'different interfaces');
  c.a.lan = 'Gi2'; c.a.lanIp = '10.10.0.1\nreload'; blocked(c, 'LAN interface IP');
});
test('Public IP edits reach the opposite peer and bound interface', () => {
  const c = config(); c.bindInterfaces = true; c.a.ip = '203.0.113.90';
  const r = generate(c); assert(!r.errors.length); assert(r.a.includes('ip address 203.0.113.90 255.255.255.0'));
  assert(r.b.includes('set remote-gw 203.0.113.90')); assert(!r.b.includes('203.0.113.10'));
});
test('VTI is routed, optimized and uses complete dynamic wildcards',()=>{
  const c=config();c.protocol='vti';c.b.vendor='ios';c.a.local=c.b.remote='10.10.0.0/23';
  const r=generate(c);assert(!r.errors.length,r.errors.join('; '));
  for(const text of ['crypto isakmp policy 1','crypto ipsec profile IPSEC-PROFILE-VTI','interface Tunnel0','ip mtu 1400','ip tcp adjust-mss 1360','tunnel mode ipsec ipv4','no ip access-list extended NAT','deny ip 10.10.0.0 0.0.1.255 10.20.0.0 0.0.0.255'])assert(r.a.includes(text),text);
  assert(r.b.includes('ip route 10.10.0.0 255.255.254.0 Tunnel0'));assert(!r.a.includes('crypto map'));
  c.vtiLegacy=true;const legacy=generate(c);assert(legacy.a.includes(' group 2'));assert(legacy.a.includes('esp-sha-hmac'));assert(!legacy.a.includes('group 14'));
});
for(const key of Object.keys(TOOLS))test(`Default ${key} template generates usable CLI`,()=>{
  const d=defaultsFor(key);if(key==='hardening')d.secret=d.enableSecret='DemoSecret_0123456789';
  const r=generateTool(key,d);assert(!r.errors.length,r.errors.join('; '));assert(r.scripts.length>0);for(const s of r.scripts)assert(s.code&&!/undefined|NaN|\[object Object\]/.test(s.code));
});
test('Bootstrap static WAN, DHCP scope and firewall ordering',()=>{
  const d=defaultsFor('bootstrap');d.wanMode='static';const r=generateTool('bootstrap',d);assert(!r.errors.length);const code=r.scripts[0].code;
  assert(code.includes('/ip address add address=203.0.113.2/30 interface=ether1'));assert(code.includes('dst-address=0.0.0.0/0 gateway=203.0.113.1'));assert(code.indexOf('chain=NOC-IN connection-state=established')<code.indexOf('chain=NOC-IN action=drop'));
  d.poolStart='192.168.88.1';assert(generateTool('bootstrap',d).errors.length);d.poolStart='192.168.88.10';d.ports='ether1';assert(generateTool('bootstrap',d).errors.length);
});
test('Enterprise VLANs produce both router and switch configurations',()=>{
  const r=generateTool('enterprise',defaultsFor('enterprise'));assert(r.scripts.length===2);assert(r.scripts[0].code.includes('encapsulation dot1Q 20'));assert(r.scripts[1].code.includes('switchport trunk allowed vlan 10,20'));
  const d=defaultsFor('enterprise');d.vlans='10,HR,192.168.10.1/24,Gi0/2\n10,IT,192.168.20.1/24,Gi0/3';assert(generateTool('enterprise',d).errors.length);
});
test('Routing uses vendor-specific OSPF and BGP grammars',()=>{
  const d=defaultsFor('routing');d.vendor='mikrotik';let r=generateTool('routing',d);assert(r.scripts[0].code.includes('networks=10.0.0.0/30'));
  d.networks='10.0.0.0 0.0.5.0';assert(generateTool('routing',d).errors.length);
  d.protocol='bgp';r=generateTool('routing',d);assert(r.scripts[0].code.includes('/routing bgp instance add'));assert(r.scripts[0].code.includes('local.role=ebgp'));
  d.rosVersion='classic';r=generateTool('routing',d);assert(!r.scripts[0].code.includes('/routing bgp instance add'));assert(r.scripts[0].code.includes('as=65001 router-id=1.1.1.1'));
  d.remoteAs=d.localAs;assert(generateTool('routing',d).scripts[0].code.includes('local.role=ibgp'));
});
test('Standard ACL has no protocol/destination, TCP ACL handles source and destination ports',()=>{
  const d=defaultsFor('acl');d.type='standard';let r=generateTool('acl',d);assert(r.scripts[0].code.includes('10 permit 192.168.10.0 0.0.0.255'));assert(!r.scripts[0].code.includes(' tcp '));
  d.type='extended';d.sourcePort='1024';assert(generateTool('acl',d).scripts[0].code.includes('0.0.0.255 eq 1024 any eq 443'));
  d.destPort='65536';assert(generateTool('acl',d).errors.length);
});
test('DHCP merges exclusions, excludes gateway and rejects exhausted pools',()=>{
  const d=defaultsFor('dhcp');d.exclusions='192.168.10.10 192.168.10.20';let r=generateTool('dhcp',d);assert(r.scripts[0].code.includes('excluded-address 192.168.10.1\n'));
  d.exclusions='192.168.10.1 192.168.10.254';assert(generateTool('dhcp',d).errors.length);
});
test('Static routes support interface, next-hop, distance, permanent and mask validation',()=>{
  const d=defaultsFor('static');d.interface='GigabitEthernet0/1';d.distance='200';d.permanent=true;assert(generateTool('static',d).scripts[0].code.includes('GigabitEthernet0/1 10.0.0.2 200 permanent'));
  d.mask='255.0.255.0';assert(generateTool('static',d).errors.length);d.mask='255.255.255.0';d.destination='192.168.20.1';assert(generateTool('static',d).errors.length);
});
test('Invalid CLI strings and enums never reach output',()=>{
  for(const key of ['nat','security','vlan']){const d=defaultsFor(key);const field=key==='nat'?'inside':'interface';d[field]='Gi0/1\nreload';const r=generateTool(key,d);assert(r.errors.length&&r.scripts.length===0);}
  const d=defaultsFor('security');d.violation='reload';assert(generateTool('security',d).errors.length);
  const h=defaultsFor('hardening');h.secret=h.enableSecret='abc\nusername backdoor'.padEnd(20,'x');assert(generateTool('hardening',h).errors.length);
});
test('VLAN ranges and trunk allow lists validate',()=>{
  const d=defaultsFor('vlan');d.lastPort='24';assert(generateTool('vlan',d).scripts[0].code.includes('interface range FastEthernet0/1 - 24'));
  d.mode='trunk';d.allowed='10,10';assert(generateTool('vlan',d).errors.length);
});
test('VLSM allocates largest first, computes masks and never overlaps',()=>{
  const r=planVlsm('192.168.10.0/24',[{name:'Small',hosts:10},{name:'Large',hosts:50},{name:'Medium',hosts:25}]);assert(!r.errors.length);assert(r.rows[0].name==='Large');assert(r.rows[0].network==='192.168.10.0/26');assert(r.rows[0].broadcast==='192.168.10.63');assert(r.rows[1].network==='192.168.10.64/27');assert(r.rows[2].network==='192.168.10.96/28');assert(r.unused===144);assert(vlsmTsv(r.rows).includes('255.255.255.192'));
});
test('VLSM failures are atomic and handle IPv4 boundaries',()=>{
  assert(planVlsm('192.168.10.0/24',[{name:'Too big',hosts:255}]).rows.length===0);
  assert(planVlsm('192.168.10.1/24',[{name:'IT',hosts:10}]).errors.length);
  assert(planVlsm('10.0.0.0/24',[{name:'IT',hosts:10},{name:'it',hosts:5}]).errors.length);
  const r=planVlsm('255.255.255.252/30',[{name:'Edge',hosts:1}]);assert(r.rows[0].broadcast==='255.255.255.255');assert(r.rows[0].first==='255.255.255.253');
});
const failures = results.filter(s => s.startsWith('FAIL'));
const summary = `${passed}/${results.length} tests passed`;
if (typeof document !== 'undefined') {
  document.getElementById('results').textContent = summary + '\n\n' + results.join('\n');
  document.title = (failures.length ? 'FAIL ' : 'PASS ') + summary;
} else {
  console.log(summary); if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
}
