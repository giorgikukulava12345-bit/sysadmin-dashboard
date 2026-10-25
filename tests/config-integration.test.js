import assert from 'node:assert/strict';
import {integrateConfiguration as merge} from '../static/vpn/config-integration.js';
import {DEFAULTS,generate} from '../static/vpn/engine.js';
const c=structuredClone(DEFAULTS);c.a.psk=c.b.psk='1234';assert.equal(generate(c).errors.length,0);
for(const side of ['a','b']){const d=structuredClone(c);d[side].psk='abc';assert(generate(d).errors.some(e=>e.includes('at least 4')));}
c.a.psk=c.b.psk='a'.repeat(100);assert.equal(generate(c).errors.length,0);
for(const psk of ['abc\nend','123;reload','abcd"','$(reboot)']){c.a.psk=c.b.psk=psk;assert(generate(c).errors.length);}
const base='hostname EXISTING\ninterface Loopback10\n ip address 10.255.0.1 255.255.255.255\n!\nrouter ospf 1\n router-id 10.255.0.1';
const added='configure terminal\ninterface Tunnel0\n ip address 169.254.1.1 255.255.255.252\n exit\nip route 10.20.0.0 255.255.255.0 Tunnel0\nend';
const compatible=merge('interface GigabitEthernet1\n ip address 203.0.113.10 255.255.255.252','interface GigabitEthernet1\n ip nat outside\n exit','ios');assert.equal(compatible.errors.length,0);assert(compatible.code.includes('ip nat outside'));
const r=merge(base,added,'ios');assert.deepEqual(r.errors,[]);for(const value of ['hostname EXISTING','interface Loopback10','router ospf 1','interface Tunnel0','ip route 10.20.0.0'])assert(r.code.includes(value));assert(!r.code.includes(' exit\nexit'));
assert(merge(base,'interface Loopback10\n ip address 1.1.1.1 255.255.255.255','ios').errors.length);
assert(merge('ip route 0.0.0.0 0.0.0.0 1.1.1.1','ip route 0.0.0.0 0.0.0.0 2.2.2.2','ios').errors.length);
assert.equal(merge(base,base,'ios').code.match(/hostname EXISTING/g).length,1);
for(const value of ['', 'banner motd ^hello^','crypto pki certificate chain TEST','show running-config','no interface Gi1',' ip address 1.1.1.1 255.255.255.0','a'.repeat(200001)])assert(merge(value,added,'ios').errors.length,value.slice(0,40));
for(const vendor of ['mikrotik','fortinet','juniper','paloalto'])assert(merge(base,added,vendor).errors.length);
console.log('Integration checks passed: PSK boundaries, injection, preservation, deduplication, nested exits, conflicts and unsupported contexts.');

const vpn=structuredClone(DEFAULTS);vpn.a.psk=vpn.b.psk='abcd';const vpnOutput=generate(vpn);assert.equal(vpnOutput.errors.length,0);assert.equal(merge('hostname EXISTING',vpnOutput.a,'ios').errors.length,0);
