import assert from 'node:assert/strict';
import {maskSecrets} from '../static/vpn/secret-mask.js';
import {DEFAULTS,generate,support} from '../static/vpn/engine.js';
const secret='ExampleKey_0123456789';
let checked=0;
for(const vendor of ['ios','asa','mikrotik','fortinet','juniper','paloalto'])for(const protocol of ['ikev1','ikev2','gre','vti']){
 if(support(vendor,protocol))continue;
 const c=structuredClone(DEFAULTS);c.protocol=protocol;c.a.vendor=c.b.vendor=vendor;c.a.psk=c.b.psk=secret;
 const result=generate(c);assert.deepEqual(result.errors,[],vendor+' '+protocol);
 for(const side of ['a','b']){
  const code=result[side],masked=maskSecrets(code);
  assert(code.includes(secret));assert(!masked.includes(secret),vendor+' '+protocol+' leaked PSK');
  assert(masked.includes('***'));assert.equal(masked.split('\n').length,code.split('\n').length);checked++;
 }
}
const samples=[
 'username admin privilege 15 secret exit', 'enable secret 1234',
 ' key-string ExampleAuth_0123456789', ' key ExampleAAA_0123456789',
 ' ip nhrp authentication abcd',
 ' authentication mode hmac-sha-256 0 ExampleAuth_0123456789',
 'snmp-server user monitor GROUP v3 auth sha ExampleAuth_0123456789 priv aes 128 ExamplePriv_0123456789',
 '/snmp community add authentication-password="ExampleAuth_0123456789" encryption-password="ExamplePriv_0123456789"',
 'set auth-pwd "ExampleAuth_0123456789"',
 'set snmp v3 usm local-engine user monitor privacy-aes128 privacy-password "ExamplePriv_0123456789"',
 '/interface wireguard add private-key="Abcd+/0123456789="',
 '/interface wireguard peers add public-key="KeepPublicKey=" preshared-key="Abcd+/0123456789="',
 '/interface ovpn-client add user=admin password="Abcd_0123456789"'
];
for(const sample of samples){assert(maskSecrets(sample).includes('***'),sample);assert(!/Example|Abcd|\babcd\b|\b1234\b/.test(maskSecrets(sample)),sample);}
const structure='configure terminal\ninterface GigabitEthernet1\n ip address 203.0.113.10 255.255.255.252\n exit\nkey chain AUTH\n key 1\n  key-string exit\n exit\nend';
assert.equal(maskSecrets(structure),structure.replace('key-string exit','key-string ***'));
assert(maskSecrets(samples[11]).includes('public-key="KeepPublicKey="'));
assert.equal(maskSecrets(''), '');
console.log(`Secret masking passed: ${checked} vendor/protocol outputs, credential syntax and unchanged CLI structure.`);
