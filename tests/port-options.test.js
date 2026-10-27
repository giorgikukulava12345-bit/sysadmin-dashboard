import assert from 'node:assert/strict';
import {portOptions,normalizePort,isCiscoPhysical} from '../static/vpn/port-options.js';
import {createLab} from '../static/vpn/lab.js';
import {composeDevice} from '../static/vpn/compose.js';
import {featureDefaults} from '../static/vpn/features.js';
import {PORTS} from '../static/vpn/platforms.js';
import {panAddress} from '../static/vpn/interfaces.js';
for(const vendor of ['ios','juniper','mikrotik','fortinet','paloalto']){
 const rows=portOptions(vendor);assert.ok(rows.length>10);assert.equal(new Set(rows.map(r=>r.value)).size,rows.length);
 for(const port of PORTS[vendor])assert.ok(rows.some(row=>row.value===port),vendor+' default');
 for(const row of rows)assert.match(row.value,/^[A-Za-z][A-Za-z0-9./-]+$/);
}
for(const prefix of ['FastEthernet','GigabitEthernet','TenGigabitEthernet','TwentyFiveGigE','FortyGigabitEthernet','HundredGigE','Ethernet']){
 const lab=createLab();lab.a.wan=prefix+'0/0';lab.a.lan=prefix+'0/1';
 const r=composeDevice({lab,side:'a',role:'router',selected:{internet_access:true},values:{internet_access:{...featureDefaults('internet_access','ios'),standardOffice:true,parts:{firewall:false}}}});
 assert.deepEqual(r.errors,[]);assert.ok(r.code.includes('interface '+lab.a.lan)&&r.code.includes('list NAT interface '+lab.a.wan+' overload'));
 assert.ok(isCiscoPhysical(lab.a.lan));
}
for(const [short,full]of [['Fa','FastEthernet'],['Gi','GigabitEthernet'],['Te','TenGigabitEthernet'],['Twe','TwentyFiveGigE'],['Fo','FortyGigabitEthernet'],['Hu','HundredGigE']])assert.equal(normalizePort('ios',short+'0/1'),full+'0/1');
assert.equal(normalizePort('juniper','ge-1/2/3'),'ge-1/2/3');assert.equal(normalizePort('ios','Gi0/1\nreload'),'Gi0/1\nreload');
assert.equal(isCiscoPhysical('HundredGigE0/1.10'),false);
assert.equal(panAddress('ethernet1/1.10','192.0.2.1/24'),'set network interface ethernet ethernet1/1 layer3 units ethernet1/1.10 tag 10\nset network interface ethernet ethernet1/1 layer3 units ethernet1/1.10 ip 192.0.2.1/24');
assert.throws(()=>panAddress('ethernet1/1.4095','192.0.2.1/24'));
{const lab=createLab();Object.assign(lab.a,{vendor:'paloalto',wan:'ethernet1/1',lan:'ethernet1/2.10'});const r=composeDevice({lab,side:'a',role:'router',selected:{internet_access:true},values:{internet_access:{...featureDefaults('internet_access','paloalto'),parts:{firewall:false}}}});assert.deepEqual(r.errors,[]);assert.ok(r.code.includes('layer3 units ethernet1/2.10 tag 10')&&r.code.includes('network layer3 [ ethernet1/2.10 ]'));assert.ok(!r.code.includes('ethernet ethernet1/2.10 layer3'));}
console.log('Port options: five vendors, defaults, Cisco speeds/aliases, unchanged custom ports and tagged PAN-OS units passed.');
