import assert from 'node:assert/strict';
import {createLab} from '../static/vpn/lab.js';
import {composeDevice} from '../static/vpn/compose.js';
import {featureDefaults} from '../static/vpn/features.js';
import {maskSecrets} from '../static/vpn/secret-mask.js';
import {analyzeConfig} from '../static/vpn/config-analyzer.js';

function fixture(){
  const lab=createLab();
  Object.assign(lab.a,{officeVlans:true,vlan2Enabled:'on',vlan2Subnet:'172.16.19.0/24',vlan2Gateway:'172.16.19.1',vlan2SwitchIp:'172.16.19.254'});
  return {lab,side:'a',role:'router',selected:{internet_access:true,hardening:true,ntp_syslog:true},values:{
    internet_access:{...featureDefaults('internet_access','ios'),standardOffice:true},
    hardening:{...featureDefaults('hardening','ios'),hostname:'R1',domain:'cisco.com',secret:'OfficeUserFixture2026',enableSecret:'OfficeEnableFixture2026'},
    ntp_syslog:{ntp:'129.6.15.28',syslog:''}
  }};
}
const good=input=>{const r=composeDevice(input);assert.deepEqual(r.errors,[]);assert.ok(r.code&&!r.empty);assert.doesNotMatch(r.code,/undefined|NaN|\[object Object\]|<WAN|<Gateway/);return r.code;};
const bad=input=>{const r=composeDevice(input);assert.ok(r.errors.length);assert.equal(r.code,'');};
const base=fixture(),code=good(base);
for(const line of ['hostname R1','ip cef','no ip domain lookup','ip domain name cisco.com','clock timezone UTC 0 0','ntp server 129.6.15.28 prefer','ip dhcp pool USERS','ip dhcp pool IT','ip dhcp excluded-address 192.168.1.1 192.168.1.49','ip dhcp excluded-address 172.16.19.1 172.16.19.49','ip dhcp excluded-address 192.168.1.254','ip dhcp excluded-address 172.16.19.254','default-router 192.168.1.1','default-router 172.16.19.1','dns-server 8.8.8.8 1.1.1.1','username nocadmin privilege 15 algorithm-type scrypt secret OfficeUserFixture2026','ip access-list extended SSH_NEW','permit tcp 192.168.1.0 0.0.0.255 any eq 22','permit tcp 172.16.19.0 0.0.0.255 any eq 22','deny tcp any any eq 22 log','ip access-list extended NAT','permit ip 192.168.1.0 0.0.0.255 any','ip access-list extended NAT112','permit ip 172.16.19.0 0.0.0.255 any','ip nat inside source list NAT interface GigabitEthernet0/0 overload','ip nat inside source list NAT112 interface GigabitEthernet0/0 overload','ip route 0.0.0.0 0.0.0.0 203.0.113.9'])assert.ok(code.includes(line),line);
assert.equal((code.match(/^configure terminal$/gm)||[]).length,1);
assert.equal((code.match(/^end$/gm)||[]).length,1);
const order=['hostname R1','ip dhcp pool USERS','ip access-list extended SSH_NEW','description WAN_TO_ISP','ip access-list extended NAT','ip route 0.0.0.0'];
for(let i=1;i<order.length;i++)assert.ok(code.indexOf(order[i])>code.indexOf(order[i-1]),'Section ordering');
for(const range of ['0 4','5 15'])assert.match(code,new RegExp(`line vty ${range}\\n access-class SSH_NEW in\\n login authentication OFFICE-LOCAL\\n authorization exec OFFICE-LOCAL\\n transport input ssh`));
for(const mode of ['svi','subinterfaces']){
  const input=fixture();input.values.internet_access.iosLanMode=mode;const cli=good(input);
  const prefix=mode==='svi'?'Vlan':'GigabitEthernet0/1.';
  for(const id of ['10','20']){
    assert.match(cli,new RegExp(`interface ${prefix.replaceAll('.','\\.')}${id}\\n description [^\\n]+\\n${mode==='subinterfaces'?` encapsulation dot1Q ${id}\\n`:''} ip address [^\\n]+\\n ip nat inside\\n ip virtual-reassembly in\\n no shutdown`));
    assert.ok(cli.includes(`interface ${prefix}${id}\n zone-member security NOC-OFFICE-LAN`));
  }
  assert.ok(!analyzeConfig(cli,{complete:true}).findings.some(f=>f.severity==='error'));
  if(mode==='svi'){assert.ok(cli.includes('switchport trunk allowed vlan 10,20'));assert.doesNotMatch(cli,/interface GigabitEthernet0\/1\./);}
  else {assert.doesNotMatch(cli,/switchport |interface Vlan/);assert.ok(cli.includes('encapsulation dot1Q 10'));}
}
assert.ok(!maskSecrets(code).includes('OfficeUserFixture2026')&&!maskSecrets(code).includes('OfficeEnableFixture2026'));
for(const [key,value] of [['iosLanMode','svi\nreload'],['timezoneName','UTC\nreload'],['timezoneHours','24'],['timezoneMinutes','60'],['usersPool','USERS\nreload'],['itPool','USERS'],['managementSources','0.0.0.0/0'],['managementSources','10.3.0.1/24'],['managementSources','10.3.0.1\nreload'],['staticReserve','254'],['dns1','8.8.8.8\nreload']]){
  const input=fixture();input.values.internet_access[key]=value;bad(input);
}
for(const path of ['ntp','syslog']){const input=fixture();input.values.ntp_syslog[path]='129.6.15.28\nreload';bad(input);}
{const input=fixture();input.values.hardening.secret='';bad(input);}
{const input=fixture();input.selected.ospf=true;input.values.ospf=featureDefaults('ospf','ios');bad(input);}
{const input=fixture();input.values.internet_access.managementSources='10.50.0.0/24\n10.60.0.5';input.values.internet_access.timezoneName='GET';input.values.internet_access.timezoneHours='4';const cli=good(input);assert.ok(cli.includes('permit tcp 10.50.0.0 0.0.0.255 any eq 22')&&cli.includes('permit tcp 10.60.0.5 0.0.0.0 any eq 22')&&cli.includes('clock timezone GET 4 0'));}
{const input=fixture();Object.assign(input.lab.a,{ip:'198.51.100.6',gateway:'198.51.100.5',local:'10.40.0.0/24',lanIp:'10.40.0.1',switchIp:'10.40.0.254',hostIp:'10.40.0.10',vlan:'30',vlan2:'40',wan:'GigabitEthernet8',lan:'GigabitEthernet0'});const cli=good(input);assert.ok(cli.includes('interface Vlan30')&&cli.includes('interface Vlan40')&&cli.includes('default-router 10.40.0.1')&&cli.includes('permit ip 10.40.0.0 0.0.0.255 any')&&cli.includes('list NAT112 interface GigabitEthernet8 overload')&&cli.includes('0.0.0.0 0.0.0.0 198.51.100.5'));assert.doesNotMatch(cli,/192\.168\.1\.|203\.0\.113\./);}
for(const [key,regex] of [['nat',/ip nat /],['route',/ip route 0\.0\.0\.0/],['dhcp',/ip dhcp /],['dns',/ip name-server| dns-server /],['firewall',/zone-member|zone security|policy-map/],['interfaces',/ ip address |switchport |encapsulation dot1Q/]]){
  const input=fixture();input.values.internet_access.parts={[key]:false};assert.doesNotMatch(good(input),regex);
}
for(const mode of ['svi','subinterfaces']){const input=fixture();input.lab.a.vlan2Enabled='off';input.lab.a.officeVlans=false;input.values.internet_access.iosLanMode=mode;const cli=good(input);assert.doesNotMatch(cli,/172\.16\.19\.|Vlan20|NAT112/);if(mode==='svi')assert.ok(cli.includes('switchport access vlan 10'));else assert.doesNotMatch(cli,/encapsulation dot1Q/);}
const sw=composeDevice({...base,role:'switch',selected:{},values:{},bindings:true});assert.deepEqual(sw.errors,[]);assert.ok(sw.code.includes('switchport trunk native vlan 1')&&sw.code.includes('allowed vlan 10,20'));assert.doesNotMatch(sw.code,/ip nat |SSH_NEW/);
console.log('Standard Office: complete ordered IOS output, both LAN modes, VTY ranges, static exclusions, per-VLAN PAT, topology edits, masking, component toggles and atomic validation passed.');
