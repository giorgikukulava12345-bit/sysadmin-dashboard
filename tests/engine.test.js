import { PORTS } from '../static/vpn/platforms.js';
import { FEATURES, featureDefaults, featureFields, generateFeature, boundValues, remoteDefaults, generateRemoteVpn } from '../static/vpn/features.js';
import { validateWan } from '../static/vpn/interfaces.js';
import { composeDevice } from '../static/vpn/compose.js';
import { createLab as createInitialLab, labScripts } from '../static/vpn/lab.js';
import { DEFAULTS, VENDORS, PROTOCOLS, generate, cidr, ipv4, support } from '../static/vpn/engine.js';
import { TOOLS, defaultsFor, generateTool } from '../static/vpn/catalog.js';
import { planVlsm, vlsmTsv } from '../static/vpn/vlsm.js';
function createLab(){const lab=createInitialLab();Object.assign(lab.a,{ip:'203.0.113.10',gateway:'203.0.113.9'});Object.assign(lab.b,{ip:'198.51.100.22',gateway:'198.51.100.21',local:'10.20.0.0/24',lanIp:'10.20.0.1',switchIp:'10.20.0.2',hostIp:'10.20.0.10'});Object.assign(lab.a,{local:'10.10.0.0/24',lanIp:'10.10.0.1',switchIp:'10.10.0.2',hostIp:'10.10.0.10'});return lab;}
let passed = 0;
const results = [];
function test(name, fn) {
  try { fn(); passed++; results.push(`PASS ${name}`); }
  catch (error) { results.push(`FAIL ${name}: ${error.message}`); }
}
function assert(condition, message = 'Assertion failed') { if (!condition) throw new Error(message); }
function config() { const c = structuredClone(DEFAULTS);Object.assign(c.a,{ip:'203.0.113.10',gateway:'203.0.113.9',remote:'10.20.0.0/24'});Object.assign(c.b,{ip:'198.51.100.22',gateway:'198.51.100.21',local:'10.20.0.0/24',lanIp:'10.20.0.1'});Object.assign(c.a,{local:'10.10.0.0/24',lanIp:'10.10.0.1'});c.b.remote='10.10.0.0/24'; c.a.psk = c.b.psk = 'ExampleKey_0123456789'; return c; }
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
for (const vendor of Object.keys(VENDORS).filter(v=>v!=='juniper')) test(`Interface binding uses current addresses on ${vendor}`, () => {
  const c = config(); c.bindInterfaces = true; c.a.vendor = vendor;
  c.a.wan = vendor === 'paloalto' ? 'ethernet1/3' : vendor === 'asa' ? 'outside' : 'eth0';
  c.a.lan = vendor === 'paloalto' ? 'ethernet1/4' : vendor === 'asa' ? 'inside' : 'eth1';
  c.a.ip = '203.0.113.50'; c.a.gateway='203.0.113.49'; c.a.lanIp = '10.10.0.254';
  const r = generate(c); assert(!r.errors.length, r.errors.join('; '));
  assert(r.a.includes(c.a.ip)); assert(r.a.includes(c.a.lanIp));
  assert(r.a.includes(c.a.wan)); assert(r.a.includes(c.a.lan));
  if (vendor === 'asa') assert(r.a.includes(`interface ${c.a.wanPort}`));
  if (vendor === 'mikrotik') assert(r.a.includes('address=203.0.113.50/30 interface=eth0'));
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
  const c = config(); c.bindInterfaces = true; c.a.ip = '203.0.113.90'; c.a.gateway='203.0.113.89';
  const r = generate(c); assert(!r.errors.length); assert(r.a.includes('ip address 203.0.113.90 255.255.255.252'));
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
  const d={...defaultsFor('dhcp'),network:'192.168.10.0/24',gateway:'192.168.10.1'};d.exclusions='192.168.10.10 192.168.10.20';let r=generateTool('dhcp',d);assert(r.scripts[0].code.includes('excluded-address 192.168.10.1\n'));
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
  const d=defaultsFor('vlan');d.lastPort='24';assert(generateTool('vlan',d).scripts[0].code.includes('interface range GigabitEthernet0/2 - 24'));
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
for(const vendor of ['ios','mikrotik','fortinet','juniper','paloalto'])test(`Universal router binding: ${vendor}`,()=>{const lab=createLab();lab.a.vendor=vendor;const r=labScripts(lab);assert(!r.errors.length,r.errors.join(';'));assert(r.scripts.length===6);assert(r.scripts[0].code.includes(lab.a.ip)&&r.scripts[0].code.includes(lab.a.lanIp));});
test('Lab rejects collisions, malformed ports and invalid LAN hosts atomically',()=>{for(const patch of [{hostIp:'10.10.0.1'},{hostIp:'10.10.0.0'},{access:'eth0;reboot'},{vlan:'4095'},{wanPrefix:'40'}]){const lab=createLab();Object.assign(lab.a,patch);const r=labScripts(lab);assert(r.errors.length>0);assert(r.scripts.length===0);}});
test('Unsupported switch platforms never copy unrelated syntax',()=>{const lab=createLab();lab.a.switchVendor='paloalto';const r=labScripts(lab);assert(r.scripts[1].unsupported);assert(!r.scripts[1].code.includes('switchport'));});
test('All feature selectors include the enterprise registry and reject unsupported pairs',()=>{for(const [key,t]of Object.entries(TOOLS)){const f=t.fields.find(f=>f.key==='vendor');assert(Object.keys(f.options).length===5);const d=defaultsFor(key);d.vendor='paloalto';const r=generateTool(key,d);assert(r.errors.length>0&&r.scripts.length===0);}});
test('Junos IPsec uses mirrored selectors, policy and SRX zone context',()=>{const c=config();c.a.vendor='juniper';c.a.wan='ge-0/0/0';c.a.lan='ge-0/0/1';const r=generate(c);assert(!r.errors.length);assert(r.a.includes('traffic-selector NOC-TS local-ip 10.10.0.0/24'));assert(r.a.includes('gateway NOC-PEER version v2-only'));assert(r.a.includes('external-interface ge-0/0/0.0'));assert(r.a.includes('hmac-sha-256-128'));});
for(const[id,f]of Object.entries(FEATURES).filter(([id])=>id!=='vpn'))for(const vendor of f.vendors)test(`Feature grammar ${id}: ${vendor}`,()=>{
  const d=featureDefaults(id,vendor);for(const f of featureFields(id,vendor))if(f.type==='password')d[f.key]=f.key==='privSecret'?'PrivacyOnly_ChangeMe26':'ExampleOnly_ChangeMe26';if(id==='dmvpn')d.nhrpSecret='NocLab26';if(id==='remotevpn'){d.username='nocadmin';if(vendor==='mikrotik')d.server='edge-vpn.example.org';}if(id==='hardening')d.secret=d.enableSecret='ExampleOnly_0123456789';
  if(id==='vlan'&&vendor!=='ios')d.interface=vendor==='juniper'?'ge-0/0/1':'ether2';
  if(id==='ospf'&&vendor==='juniper')d.ospfInterfaces='ge-0/0/1.0';
  if(id==='dhcp'&&vendor!=='ios')Object.assign(d,{network:'10.10.0.0/24',gateway:'10.10.0.1',interface:vendor==='fortinet'?'port2':'ether2'});
  const r=generateFeature(id,['remotevpn','relay','fhrp','wan_failover','internet_access'].includes(id)?boundValues(id,d,{...createLab().a,vendor,...(['wan_failover','internet_access'].includes(id)?{wan:PORTS[vendor][0],lan:PORTS[vendor][1]}:{})}):d);assert(!r.errors.length,r.errors.join(';'));assert(r.scripts.length>0&&!r.scripts.some(s=>/undefined|NaN|\[object Object\]/.test(s.code)));
});
test('Composition includes only enabled features',()=>{const lab=createLab(),values={nat:featureDefaults('nat','ios'),acl:featureDefaults('acl','ios')};const r=composeDevice({lab,side:'a',role:'router',selected:{nat:true,acl:false},values});assert(!r.errors.length);assert(r.code.includes('ip nat inside source list'));assert(!r.code.includes('NOC-ACL'));});
test('IOS NAT + VPN composes a real remote-prefix exemption',()=>{const lab=createLab(),c=config();c.a={...c.a,...lab.a};c.b={...c.b,...lab.b};const r=composeDevice({lab,side:'a',role:'router',selected:{nat:true,vpn:true},values:{nat:featureDefaults('nat','ios')},vpnConfig:c});assert(!r.errors.length,r.errors.join(';'));assert(r.code.includes('10 deny ip 10.10.0.0 0.0.0.255 10.20.0.0 0.0.0.255'));assert(!r.code.includes('ip access-list standard NOC-PAT'));});
test('VTI uses one NAT policy rather than duplicate PAT rules',()=>{const lab=createLab();lab.b.vendor='ios';const c=config();Object.assign(c.a,lab.a);Object.assign(c.b,lab.b);c.protocol='vti';const r=composeDevice({lab,side:'a',role:'router',selected:{nat:true,vpn:true},values:{nat:featureDefaults('nat','ios')},vpnConfig:c,vpnType:'vti'});assert(!r.errors.length,r.errors.join(';'));assert((r.code.match(/ip nat inside source list/g)||[]).length===1);});
test('Composition blocks invalid checked features atomically',()=>{const lab=createLab(),d=featureDefaults('static','ios');d.nextHop='1.2.3.4;reload';const r=composeDevice({lab,side:'a',role:'router',selected:{nat:true,static:true},values:{nat:featureDefaults('nat','ios'),static:d}});assert(r.errors.length>0&&!r.code);});
test('Trunk port and access-only port security cannot silently overwrite one another',()=>{const lab=createLab(),vlan=featureDefaults('vlan','ios');vlan.mode='trunk';const r=composeDevice({lab,side:'a',role:'switch',selected:{vlan:true,security:true},values:{vlan,security:featureDefaults('security','ios')}});assert(r.errors.some(e=>e.includes('access port'))&&!r.code);});
test('Complete bootstrap presets reject mixed feature composition',()=>{const lab=createLab();lab.a.vendor='mikrotik';const r=composeDevice({lab,side:'a',role:'router',selected:{bootstrap:true,nat:true},values:{bootstrap:featureDefaults('bootstrap','mikrotik'),nat:featureDefaults('nat','mikrotik')}});assert(r.errors.length&&!r.code);});
test('OpenVPN verifies the remote certificate and cannot inject CLI',()=>{const s=createLab().a;s.vendor='mikrotik';const d={...remoteDefaults('openvpn'),server:'edge-vpn.example.org',username:'nocadmin',password:'ExampleOnly_ChangeMe2026'};const r=generateRemoteVpn('openvpn',d,s);assert(!r.errors.length);assert(r.scripts[0].code.includes('verify-server-certificate=yes'));assert(r.scripts[0].code.includes('route-nopull=yes'));assert(generateRemoteVpn('openvpn',{...d,server:'vpn.example;reboot'},s).errors.length);assert(generateRemoteVpn('openvpn',{...d,password:'";reboot'},s).errors.length);});
test('SSL VPN is group-restricted and rejects overlap or unsupported platforms',()=>{const s=createLab().b,d=remoteDefaults('ssl'),r=generateRemoteVpn('ssl',d,s);assert(!r.errors.length);assert(r.scripts[0].code.includes('set groups "NOC-VPN-USERS"'));assert(r.scripts[0].code.includes('ssl-min-proto-ver tls1-2'));assert(generateRemoteVpn('ssl',{...d,pool:s.local},s).errors.length);assert(generateRemoteVpn('ssl',d,{...s,vendor:'ios'}).errors.length);});
test('Vendor capability gates do not produce another platform syntax',()=>{for(const id of ['nat','acl','dhcp','security']){const r=generateFeature(id,{...featureDefaults(id,'paloalto'),vendor:'paloalto'});assert(r.errors.length&&!r.scripts.length);}});
test('Juniper and FortiOS BGP start with deny-all route policies',()=>{for(const vendor of ['juniper','fortinet']){const r=generateFeature('bgp',featureDefaults('bgp',vendor));assert(!r.errors.length);assert(r.scripts[0].code.includes(vendor==='juniper'?'then reject':'set action deny'));}});
test('ISP gateway must be a usable connected next-hop',()=>{const lab=createLab();lab.a.gateway='203.0.114.1';const r=labScripts(lab);assert(r.errors.some(e=>e.includes('ISP gateway'))&&!r.scripts.length);});
test('Router-on-a-stick outputs stay on separate physical devices',()=>{const lab=createLab(),d=featureDefaults('enterprise','ios');const router=composeDevice({lab,side:'a',role:'router',selected:{enterprise:true},values:{enterprise:d}}),sw=composeDevice({lab,side:'a',role:'switch',linkedEnterprise:d});assert(!router.errors.length&&!sw.errors.length);assert(router.code.includes('encapsulation dot1Q')&&!router.code.includes('switchport mode trunk'));assert(sw.code.includes('switchport mode trunk')&&!sw.code.includes('encapsulation dot1Q'));});
test('PAN-OS per-route admin distance respects 10–240 boundaries',()=>{const d=featureDefaults('static','paloalto');for(const distance of ['1','9','241','255'])assert(generateFeature('static',{...d,distance}).errors.length);for(const distance of ['10','240'])assert(!generateFeature('static',{...d,distance}).errors.length);});

test('EIGRP named mode uses SHA256 and explicit interface summarization',()=>{const d={...featureDefaults('eigrp','ios'),mode:'advanced',authSecret:'ExampleAuth_ChangeMe26'};const r=generateFeature('eigrp',d);assert(!r.errors.length,r.errors.join(';'));assert(r.scripts[0].code.includes('authentication mode hmac-sha-256 0'));assert(r.scripts[0].code.includes('summary-address 10.10.0.0 255.255.0.0'));assert(generateFeature('eigrp',{...d,authSecret:'bad;reload'}).errors.length);});
test('IPv6 prefixes reject host bits, malformed compression and multicast next hops',()=>{const d=featureDefaults('static6','ios');for(const destination of ['2001:db8::1/64','2001:::1/64','2001:db8::/129','x::/64'])assert(generateFeature('static6',{...d,destination}).errors.length,destination);assert(generateFeature('static6',{...d,nextHop:'ff02::1'}).errors.length);assert(!generateFeature('static6',{...d,destination:'::/0'}).errors.length);});
test('PAgP and HSRP are explicit Cisco-only protocol choices',()=>{for(const vendor of ['mikrotik','juniper']){assert(generateFeature('etherchannel',{...featureDefaults('etherchannel',vendor),protocol:'pagp'}).errors.length);const lab=createLab();const d=boundValues('fhrp',{...featureDefaults('fhrp',vendor),protocol:'hsrp'},{...lab.a,vendor});assert(generateFeature('fhrp',d).errors.length);}});
test('MST validates region mapping and bridge-priority increments',()=>{for(const vendor of ['ios','mikrotik','juniper']){const d={...featureDefaults('stp',vendor),mode:'mst'};assert(!generateFeature('stp',d).errors.length);assert(generateFeature('stp',{...d,priority:'123'}).errors.length);assert(generateFeature('stp',{...d,vlans:'10,10'}).errors.length);}});
test('RouterOS static and dynamic NAT preserve the requested mode',()=>{const d=featureDefaults('nat','mikrotik');d.network='10.10.0.0/24';Object.assign(d,{publicHost:'203.0.113.30',poolStart:'203.0.113.100',poolEnd:'203.0.113.110'});const stat=generateFeature('nat',{...d,natMode:'static'}),dyn=generateFeature('nat',{...d,natMode:'dynamic'});assert(!stat.errors.length&&!dyn.errors.length);assert(stat.scripts[0].code.includes('chain=dstnat'));assert(dyn.scripts[0].code.includes('to-addresses=203.0.113.100-203.0.113.110'));assert(!dyn.scripts[0].code.includes('action=masquerade'));});
test('SNMPv3 requires distinct auth/privacy secrets on all supported vendors',()=>{for(const vendor of ['ios','mikrotik','fortinet','juniper']){const d={...featureDefaults('snmp3',vendor),authSecret:'ExampleAuth_ChangeMe26',privSecret:'ExampleAuth_ChangeMe26'};assert(generateFeature('snmp3',d).errors.length);const r=generateFeature('snmp3',{...d,privSecret:'ExamplePriv_ChangeMe26'});assert(!r.errors.length);assert(!r.scripts[0].code.includes('write-access=yes'));}});
test('QoS validates DSCP and UDP boundaries on every supported vendor',()=>{for(const vendor of ['ios','mikrotik','juniper']){const d=featureDefaults('qos',vendor);assert(!generateFeature('qos',{...d,dscp:'0'}).errors.length);assert(!generateFeature('qos',{...d,dscp:'63'}).errors.length);assert(generateFeature('qos',{...d,dscp:'64'}).errors.length);assert(generateFeature('qos',{...d,udpPort:'0'}).errors.length);}});
test('New CLI inputs reject identifiers with command delimiters',()=>{for(const [id,key,value]of [['ntp_syslog','ntp','129.250.35.251;reload'],['etherchannel','members','Gi0/1,Gi0/2;reload'],['pvlan','hostPort','Gi0/1\nend'],['relay','server','0.0.0.0']])assert(generateFeature(id,{...featureDefaults(id,'ios'),[key]:value}).errors.length);});
test('Unsupported features block an otherwise valid multi-feature device atomically',()=>{const lab=createLab();lab.a.vendor='paloalto';const r=composeDevice({lab,side:'a',role:'router',selected:{ntp_syslog:true,eigrp:true},values:{ntp_syslog:featureDefaults('ntp_syslog','paloalto'),eigrp:featureDefaults('eigrp','paloalto')}});assert(r.errors.length&&!r.code);});
test('DHCP Server and Relay cannot be generated on the same client interface',()=>{const lab=createLab(),relay=featureDefaults('relay','ios');relay.interface=lab.a.lan;const r=composeDevice({lab,side:'a',role:'router',selected:{dhcp:true,relay:true},values:{dhcp:featureDefaults('dhcp','ios'),relay}});assert(r.errors.some(e=>e.includes('same LAN interface'))&&!r.code);});
test('Advanced and Basic OSPFv2 do not create conflicting process templates',()=>{const lab=createLab();const r=composeDevice({lab,side:'a',role:'router',selected:{ospf:true,ospf_advanced:true},values:{ospf:featureDefaults('ospf','ios'),ospf_advanced:{...featureDefaults('ospf_advanced','ios'),authSecret:'ExampleAuth_ChangeMe26'}}});assert(r.errors.some(e=>e.includes('either Basic'))&&!r.code);});
test('Non-PAT NAT and VPN cannot silently replace a static NAT selection',()=>{const lab=createLab(),c=config();const r=composeDevice({lab,side:'a',role:'router',selected:{nat:true,vpn:true},values:{nat:{...featureDefaults('nat','ios'),natMode:'static'}},vpnConfig:c});assert(r.errors.some(e=>e.includes('interface PAT'))&&!r.code);});
test('FHRP rejects an already assigned LAN host address',()=>{const lab=createLab(),d=featureDefaults('fhrp','ios');d.virtualIp=lab.a.hostIp;const r=composeDevice({lab,side:'a',role:'router',selected:{fhrp:true},values:{fhrp:d}});assert(r.errors.length&&!r.code);});

test('IOS IGP redistribution includes source process and EIGRP seed metrics',()=>{const d={...featureDefaults('redistribution','ios'),source:'ospf',sourceProcess:'10',target:'eigrp',process:'100'};const r=generateFeature('redistribution',d);assert(!r.errors.length,r.errors.join(';'));assert(r.scripts[0].code.includes('redistribute ospf 10 metric 100000 10 255 1 1500 route-map NOC-REDIST'));assert(r.scripts[0].code.includes('permit 10.10.0.0/24'));assert(generateFeature('redistribution',{...d,source:'eigrp',sourceProcess:'100'}).errors.length);});
test('Junos redistribution preserves the selected protocol',()=>{const d={...featureDefaults('redistribution','juniper'),source:'bgp',target:'ospf'};const r=generateFeature('redistribution',d);assert(!r.errors.length);assert(r.scripts[0].code.includes('from protocol bgp'));assert(!r.scripts[0].code.includes('from protocol static'));});

test('DMVPN overlay protects mGRE with an existing IPsec profile',()=>{const d={...featureDefaults('dmvpn','ios'),nhrpSecret:'NocLab26'};const r=generateFeature('dmvpn',d);assert(!r.errors.length,r.errors.join(';'));assert(r.scripts[0].code.includes('tunnel protection ipsec profile DMVPN-IPSEC'));assert(r.scripts[0].code.includes('ip nhrp shortcut'));assert(!r.scripts[0].code.includes('0.0.0.0 0.0.0.0'));assert(generateFeature('dmvpn',{...d,address:'172.31.100.0/24'}).errors.length);assert(generateFeature('dmvpn',{...d,address:'172.31.100.2/32'}).errors.length);assert(generateFeature('dmvpn',{...d,nhrpSecret:'unsafe;reload'}).errors.length);});
test('DMVPN hub emits dynamic multicast mappings and redirect',()=>{const d={...featureDefaults('dmvpn','ios'),role:'hub',address:'172.31.100.1/24',nhrpSecret:'NocLab26'};const r=generateFeature('dmvpn',d);assert(!r.errors.length);assert(r.scripts[0].code.includes('ip nhrp map multicast dynamic'));assert(r.scripts[0].code.includes('ip nhrp redirect'));assert(!r.scripts[0].code.includes('ip nhrp nhs'));});
test('SPAN requires a distinct analyzer; RSPAN configures a remote VLAN',()=>{const d=featureDefaults('span','ios');assert(generateFeature('span',{...d,destination:d.source}).errors.length);const r=generateFeature('span',{...d,mode:'remote'});assert(!r.errors.length);assert(r.scripts[0].code.includes('remote-span'));assert(r.scripts[0].code.includes('destination remote vlan 900'));assert(generateFeature('span',{...d,vlan:'1002',mode:'remote'}).errors.length);});
test('PIM mapping only permits administratively scoped multicast groups',()=>{const d=featureDefaults('multicast','ios'),r=generateFeature('multicast',d);assert(!r.errors.length);assert(r.scripts[0].code.includes('ip pim sparse-mode'));assert(generateFeature('multicast',{...d,groups:'10.0.0.0/8'}).errors.length);assert(generateFeature('multicast',{...d,rp:'224.1.1.1'}).errors.length);});
test('Automation exposes only the selected secure API transport',()=>{const d=featureDefaults('automation','ios');let r=generateFeature('automation',d);assert(!r.errors.length&&r.scripts[0].code.includes('netconf-yang'));r=generateFeature('automation',{...d,api:'restconf'});assert(r.scripts[0].code.includes('ip http secure-server'));assert(!r.scripts[0].code.includes('ip http server\n'));assert(generateFeature('automation',{...d,api:'bad'}).errors.length);});
test('Advanced Cisco-only features reject unsupported vendor syntax',()=>{for(const id of ['bpduguard','span','glbp','multicast','automation','dmvpn'])for(const vendor of ['mikrotik','fortinet','juniper','paloalto']){const r=generateFeature(id,{...featureDefaults(id,vendor),vendor});assert(r.errors.length&&!r.scripts.length);}});
test('GLBP and HSRP cannot silently coexist in the lab',()=>{const lab=createLab(),r=composeDevice({lab,side:'a',role:'router',selected:{glbp:true,fhrp:true},values:{glbp:featureDefaults('glbp','ios'),fhrp:featureDefaults('fhrp','ios')}});assert(r.errors.some(e=>e.includes('one first-hop'))&&!r.code);});
test('BPDU Guard edge protection cannot target a selected trunk',()=>{const lab=createLab(),v=featureDefaults('vlan','ios'),r=composeDevice({lab,side:'a',role:'switch',selected:{bpduguard:true,vlan:true},values:{bpduguard:{...featureDefaults('bpduguard','ios'),interface:v.interface},vlan:{...v,mode:'trunk'}}});assert(r.errors.some(e=>e.includes('BPDU Guard'))&&!r.code);});


test('Port forwarding produces TCP/UDP static PAT with pre-NAT public ACL matches',()=>{for(const protocol of ['tcp','udp']){const d={...featureDefaults('portforward','ios'),protocol},r=generateFeature('portforward',d);assert(!r.errors.length,r.errors.join(';'));const c=r.scripts[0].code;assert(c.includes('ip nat inside source static '+protocol+' 10.10.0.10 443 interface GigabitEthernet1 8443'));assert(c.includes('permit '+protocol+' 198.51.100.0 0.0.0.255 host 203.0.113.10 eq 8443'));assert(!c.includes('ip access-group NOC-PORTFORWARD in'));assert(!c.includes('deny ip any any log'));}});
test('Port-forward rejects unsafe ports, gateway destinations and non-LAN servers',()=>{const d=featureDefaults('portforward','ios');for(const patch of [{externalPort:'0'},{internalPort:'65536'},{internalIp:'10.10.0.1'},{internalIp:'10.20.0.10'},{protocol:'icmp'},{allowedSource:'198.51.100.1/24'},{acl:'NOC;reload'},{externalPort:'80\nreload'}])assert(generateFeature('portforward',{...d,...patch}).errors.length,JSON.stringify(patch));});
test('Port-forward follows shared topology and attaches only on explicit selection',()=>{const lab=createLab();lab.a.ip='203.0.113.30';const d=boundValues('portforward',{...featureDefaults('portforward','ios'),attachAcl:true},lab.a),r=generateFeature('portforward',d);assert(!r.errors.length);assert(r.scripts[0].code.includes('host 203.0.113.30 eq 8443'));assert(r.scripts[0].code.includes('ip access-group NOC-PORTFORWARD in'));assert(r.scripts[0].code.includes('90 deny ip any any log'));});
test('Dedicated inbound port-forward policy cannot silently override combined router services',()=>{const lab=createLab(),r=composeDevice({lab,side:'a',role:'router',selected:{portforward:true,nat:true},values:{portforward:{...featureDefaults('portforward','ios'),attachAcl:true},nat:featureDefaults('nat','ios')}});assert(r.errors.some(e=>e.includes('standalone restricted'))&&!r.code);});
test('Port-forward plus interface PAT composes a valid reviewed starter',()=>{const lab=createLab(),r=composeDevice({lab,side:'a',role:'router',selected:{portforward:true,nat:true},values:{portforward:featureDefaults('portforward','ios'),nat:featureDefaults('nat','ios')}});assert(!r.errors.length,r.errors.join(';'));assert(r.code.includes('ip nat inside source static tcp'));assert(r.code.includes('overload'));});
test('Plain GRE validates MTU/MSS, endpoints and transit/remote separation',()=>{const d=featureDefaults('gre_tunnel','ios'),r=generateFeature('gre_tunnel',d);assert(!r.errors.length);assert(r.scripts[0].code.includes('tunnel mode gre ip'));assert(r.scripts[0].code.includes('ip route 10.20.0.0 255.255.255.0 Tunnel200'));for(const patch of [{peer:d.source},{mss:'1400',mtu:'1400'},{address:'172.16.200.0/30'},{remoteNetwork:'198.51.100.0/24'},{interface:'Tunnel0;reload'}])assert(generateFeature('gre_tunnel',{...d,...patch}).errors.length);});
test('IOS XE VXLAN uses EFP and router ingress replication rather than NX-OS grammar',()=>{const d=featureDefaults('vxlan','ios'),r=generateFeature('vxlan',d);assert(!r.errors.length);const c=r.scripts[0].code;assert(c.includes('ingress-replication 10.255.0.2'));assert(c.includes('member GigabitEthernet3 service-instance 100'));assert(c.includes('member vni 5000'));assert(!c.includes('feature nv overlay'));assert(!c.includes('peer-ip '));for(const patch of [{vni:'4095'},{peerVtep:d.localVtep},{platform:'nxos'},{accessInterface:'Loopback0'},{serviceInstance:'8001'}])assert(generateFeature('vxlan',{...d,...patch}).errors.length);});
test('VXLAN EFP cannot reuse the routed WAN/LAN port or local WAN address',()=>{const lab=createLab();for(const patch of [{accessInterface:lab.a.lan},{localVtep:lab.a.ip}]){const r=composeDevice({lab,side:'a',role:'router',selected:{vxlan:true},values:{vxlan:{...featureDefaults('vxlan','ios'),...patch}}});assert(r.errors.length&&!r.code);}});
test('BFD supports interface, OSPF and existing single-hop BGP clients',()=>{const d=featureDefaults('bfd','ios');for(const client of ['none','ospf','bgp']){const r=generateFeature('bfd',{...d,client});assert(!r.errors.length,r.errors.join(';'));assert(r.scripts[0].code.includes('bfd interval 300 min_rx 300 multiplier 3'));if(client==='ospf')assert(r.scripts[0].code.includes('ip ospf bfd'));if(client==='bgp')assert(r.scripts[0].code.includes('neighbor 203.0.113.1 fall-over bfd'));}assert(generateFeature('bfd',{...d,tx:'1'}).errors.length);assert(generateFeature('bfd',{...d,multiplier:'2'}).errors.length);});
test('IP SLA schedules a bounded probe and tracks reachability without replacing routes',()=>{const d=featureDefaults('ipsla','ios'),r=generateFeature('ipsla',d);assert(!r.errors.length);assert(r.scripts[0].code.includes('ip sla schedule 100 life forever start-time now'));assert(r.scripts[0].code.includes('track 100 ip sla 100 reachability'));assert(!r.scripts[0].code.includes('ip route 0.0.0.0'));assert(generateFeature('ipsla',{...d,timeout:'10000',frequency:'10'}).errors.length);assert(generateFeature('ipsla',{...d,track:'1001'}).errors.length);});
test('IS-IS validates NET and level; uses wide metrics and addressed-interface activation',()=>{const d=featureDefaults('isis','ios');for(const level of ['level-1','level-2-only','level-1-2']){const r=generateFeature('isis',{...d,level});assert(!r.errors.length);assert(r.scripts[0].code.includes('ip router isis NOC-ISIS'));assert(r.scripts[0].code.includes('metric-style wide'));}for(const patch of [{net:'49.0001.0000.0000.0000.00'},{net:'49.0001.bad.00'},{net:'49.0001.0000.0000.0001.01'},{process:'NOC\nreload'},{metric:'16777215'}])assert(generateFeature('isis',{...d,...patch}).errors.length);});
test('CoPP targets ICMP only and uRPF preserves the selected validation semantics',()=>{const d=featureDefaults('copp','ios'),r=generateFeature('copp',d);assert(!r.errors.length);assert(r.scripts[0].code.includes('permit icmp any any'));assert(!r.scripts[0].code.includes('\ncontrol-plane\n'));assert(generateFeature('copp',{...d,attachPolicy:true}).scripts[0].code.includes('service-policy input NOC-COPP'));assert(generateFeature('copp',{...d,rate:'0'}).errors.length);const u=featureDefaults('urpf','ios');assert(generateFeature('urpf',u).scripts[0].code.includes('reachable-via rx allow-default'));assert(generateFeature('urpf',{...u,mode:'any',allowDefault:false}).scripts[0].code.includes('reachable-via any\n'));assert(generateFeature('urpf',{...u,mode:'disable'}).errors.length);});
test('Every new Cisco feature rejects unsupported vendor pairs without output',()=>{for(const id of ['portforward','gre_tunnel','vxlan','bfd','ipsla','isis','copp','urpf'])for(const vendor of ['mikrotik','fortinet','juniper','paloalto']){const r=generateFeature(id,featureDefaults(id,vendor));assert(r.errors.length&&!r.scripts.length);}});

test('Initial LAN, gateway, switch and DNS defaults are coherent',()=>{const lab=createInitialLab();assert(lab.a.local==='192.168.1.0/24');assert(lab.a.lanIp==='192.168.1.1');assert(lab.a.switchIp==='192.168.1.254');assert(lab.a.hostIp==='192.168.1.10');assert(!labScripts(lab).errors.length);assert(DEFAULTS.a.local===lab.a.local&&DEFAULTS.a.lanIp===lab.a.lanIp&&DEFAULTS.b.remote===lab.a.local);for(const vendor of ['ios','mikrotik','fortinet'])assert(featureDefaults('dhcp',vendor).dns==='8.8.8.8');assert(defaultsFor('bootstrap').dns==='8.8.8.8');});
test('/30 WAN accepts either host orientation and coherent defaults',()=>{
  for(const [ip,gateway] of [['203.0.113.9','203.0.113.10'],['203.0.113.10','203.0.113.9'],['198.51.100.22','198.51.100.21']])assert(!validateWan({ip,gateway,wanPrefix:'30'}).length);
  const lab=createInitialLab();for(const side of ['a','b'])assert(!validateWan(lab[side]).length);
});
for(const patch of [{ip:'203.0.113.8'},{ip:'203.0.113.11'},{gateway:'203.0.113.8'},{gateway:'203.0.113.11'},{gateway:'203.0.113.10'},{gateway:'203.0.113.13'},{ip:'203.0.113.999'},{wanPrefix:'23'},{wanPrefix:'31'}])test('/30 WAN rejects '+JSON.stringify(patch),()=>{
 const lab=createInitialLab();Object.assign(lab.a,patch);assert(labScripts(lab).errors.length);assert(!labScripts(lab).scripts.length);
 const c=config();Object.assign(c.a,patch);assert(generate(c).errors.length);assert(generate(c).a==='');
});
test('/30 CLI renders the actual WAN mask without changing LAN masks',()=>{
 const lab=createInitialLab(),r=labScripts(lab);assert(r.scripts[0].code.includes('10.0.0.1 255.255.255.252'));assert(r.scripts[0].code.includes('192.168.1.1 255.255.255.0'));
});
for(const prefix of ['24','25','26','27','28','29','30'])test('WAN /'+prefix+' validates subnet boundaries and renders all router vendors',()=>{
 const ip='203.0.113.2',gateway='203.0.113.1',net=cidr(`${ip}/${prefix}`),text=n=>[24,16,8,0].map(b=>(n>>>b)&255).join('.');
 assert(!validateWan({ip,gateway,wanPrefix:prefix}).length);
 for(const patch of [{ip:text(net.network)},{ip:text(net.end)},{gateway:text(net.network)},{gateway:text(net.end)},{gateway:ip},{gateway:'203.0.114.1'}])assert(validateWan({ip,gateway,wanPrefix:prefix,...patch}).length,'Invalid '+JSON.stringify(patch)+' on /'+prefix);
 for(const vendor of ['ios','mikrotik','fortinet','juniper','paloalto']){
  const lab=createInitialLab();Object.assign(lab.a,{vendor,wan:PORTS[vendor][0],lan:PORTS[vendor][1],ip,gateway,wanPrefix:prefix});
  const base=labScripts(lab,{sides:['a']});assert(!base.errors.length,base.errors.join(';'));
  const expected=['ios','fortinet'].includes(vendor)?`${ip} ${net.mask}`:`${ip}/${prefix}`;assert(base.scripts[0].code.includes(expected),vendor+' base mask');
  Object.assign(lab.a,{officeVlans:true,vlan2Enabled:'on',vlan2Subnet:'172.16.19.0/24',vlan2Gateway:'172.16.19.1',vlan2SwitchIp:'172.16.19.254'});
  const office=composeDevice({lab,side:'a',role:'router',selected:{internet_access:true},values:{internet_access:featureDefaults('internet_access',vendor)}});assert(!office.errors.length,office.errors.join(';'));assert(office.code.includes(expected),vendor+' office mask');
 }
 const vpn=config();vpn.a.wanPrefix=prefix;const result=generate(vpn);assert(!result.errors.length,result.errors.join(';'));
});
test('SSH hardening accepts four-character text and numeric secrets',()=>{for(const value of ['abcd','1234','Lab1']){const r=generateTool('hardening',{...defaultsFor('hardening'),secret:value,enableSecret:value});assert(!r.errors.length,r.errors.join(';'));assert(r.scripts[0].code.includes('enable secret '+value));assert(r.scripts[0].code.includes('privilege 15 secret '+value));}});
test('SSH short-secret support preserves validation and injection protection',()=>{for(const value of ['', 'abc', '1234\nend', '1234;reload'])assert(generateTool('hardening',{...defaultsFor('hardening'),secret:value,enableSecret:'1234'}).errors.length);});
const failures = results.filter(s => s.startsWith('FAIL'));
const summary = `${passed}/${results.length} tests passed`;
if (typeof document !== 'undefined') {
  document.getElementById('results').textContent = summary + '\n\n' + results.join('\n');
  document.title = (failures.length ? 'FAIL ' : 'PASS ') + summary;
} else {
  console.log(summary); if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
}

