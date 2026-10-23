import { DEFAULTS, VENDORS, PROTOCOLS, generate, cidr, ipv4, support } from '../static/vpn/engine.js';
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
const failures = results.filter(s => s.startsWith('FAIL'));
const summary = `${passed}/${results.length} tests passed`;
if (typeof document !== 'undefined') {
  document.getElementById('results').textContent = summary + '\n\n' + results.join('\n');
  document.title = (failures.length ? 'FAIL ' : 'PASS ') + summary;
} else {
  console.log(summary); if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
}
