import assert from 'node:assert/strict';
import {createLab} from '../static/vpn/lab.js';
import {PORTS} from '../static/vpn/platforms.js';
import {composeDevice} from '../static/vpn/compose.js';
import {featureDefaults} from '../static/vpn/features.js';
import {leaseRanges} from '../static/vpn/office-services.js';
import {analyzeConfig,networkFromMask} from '../static/vpn/config-analyzer.js';
let checks=0;const check=(v,m)=>{assert(v,m);checks++;};
for(const vendor of ['ios','mikrotik','fortinet','juniper','paloalto']){
 const lab=createLab();Object.assign(lab.a,{vendor,wan:PORTS[vendor][0],lan:PORTS[vendor][1],officeVlans:true,vlan2Enabled:'on',vlan2:'20',vlan2Subnet:'172.16.19.0/24',vlan2Gateway:'172.16.19.1',vlan2SwitchIp:'172.16.19.254'});
 const values={internet_access:featureDefaults('internet_access',vendor)};
 const result=composeDevice({lab,side:'a',role:'router',selected:{internet_access:true},values});
 check(!result.errors.length,vendor+': '+result.errors.join(';'));
 for(const value of ['192.168.1.1','172.16.19.1','8.8.8.8','1.1.1.1',lab.a.lan+'.10',lab.a.lan+'.20'])check(result.code.includes(value),vendor+' '+value);
 check(!/undefined|NaN/.test(result.code),'No unresolved values');
 const sw=composeDevice({lab,side:'a',role:'switch',bindings:true});check(!sw.errors.length,sw.errors.join(';'));check(sw.code.includes('allowed vlan 10,20')&&sw.code.includes('native vlan 1'),'Tagged trunk both VLANs');
 if(vendor==='ios'){
  for(const text of ['ip dhcp pool OFFICE-LAN-V10','ip dhcp pool OFFICE-LAN-V20','ip dhcp excluded-address 192.168.1.1','ip dhcp excluded-address 192.168.1.254','ip dhcp excluded-address 172.16.19.254','ip name-server 8.8.8.8 1.1.1.1','permit 172.16.19.0 0.0.0.255'])check(result.code.includes(text),text);
  check(!result.code.includes('dot1Q 10 native'),'Primary VLAN tagged consistently');
  const analysis=analyzeConfig(result.code,{complete:true});check(!analysis.findings.some(f=>f.severity==='error'),JSON.stringify(analysis.findings));
 }
 values.internet_access.dns1='9.9.9.9';values.internet_access.poolName='CUSTOM-OFFICE';const custom=composeDevice({lab,side:'a',role:'router',selected:{internet_access:true},values});check(!custom.errors.length&&custom.code.includes('9.9.9.9'),'Edited DNS binds');
 values.internet_access.dns1='8.8.8.8\nreload';const bad=composeDevice({lab,side:'a',role:'router',selected:{internet_access:true},values});check(bad.errors.length&&!bad.code,'Injection atomic failure');
}
assert.deepEqual(leaseRanges('192.168.1.0/24',['192.168.1.1','192.168.1.10','192.168.1.254']),[['192.168.1.2','192.168.1.9'],['192.168.1.11','192.168.1.253']]);checks++;
assert.throws(()=>leaseRanges('10.0.0.0/30',['10.0.0.1','10.0.0.2']));checks++;
check(networkFromMask('10.0.0.1','255.0.255.0')===null,'Noncontiguous mask');
const raw=`interface GigabitEthernet0/0
 ip address 203.0.113.10 255.255.255.252
!
interface GigabitEthernet0/1.10
 encapsulation dot1Q 10
 ip address 192.168.1.1 255.255.255.0
 ip nat inside
!
ip dhcp pool OFFICE
 network 192.168.1.0 255.255.255.0
 default-router 172.16.19.1
!
ip nat inside source list NAT interface GigabitEthernet0/0 overload
ip name-server 9.9.9.9
ip route 10.20.30.9 255.255.255.0 203.0.113.9
ip route 0.0.0.0 0.0.0.0 203.0.113.10`;
const a=analyzeConfig(raw,{complete:true});for(const id of ['gateway-subnet','pool-dns','pool-exclusions','nat-outside','nat-acl','route-network','self-route'])check(a.findings.some(f=>f.id===id),id);
check(a.commands.includes('dns-server 9.9.9.9')&&a.commands.includes('ip route 10.20.30.0'),'Observed values in corrections');
check(!a.commands.includes('vpn123'),'No invented secrets');
const snippet=analyzeConfig('interface FastEthernet0/1\n switchport access vlan 20');check(!snippet.findings.some(f=>f.id==='missing-vlan'),'Snippet preserves missing context');
check(analyzeConfig('interface FastEthernet0/1\n switchport access vlan 20',{complete:true}).findings.some(f=>f.id==='missing-vlan'),'Complete config VLAN check');
check(analyzeConfig('/ip address print').findings[0].id==='platform','Unsupported vendor transparent');
assert.throws(()=>analyzeConfig('x'.repeat(200001)));checks++;
console.log(`${checks} office multi-vendor / DHCP / DNS / analyzer checks passed.`);
