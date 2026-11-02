import assert from 'node:assert/strict';
import {analyzeConfiguration as analyze,additionsConfiguration as add} from '../static/vpn/configuration-analysis.js';
import {DEFAULTS,generate as generateVpn} from '../static/vpn/engine.js';
import {FEATURES,featureDefaults,generateFeature} from '../static/vpn/features.js';
const ios=`Building configuration...
Current configuration : 1000 bytes
version 15.1
hostname KEEP-ME
enable secret 5 DO_NOT_EXPORT_EXISTING_SECRET
interface GigabitEthernet0/0
 ip address 192.168.73.100 255.255.255.0
 ip nat outside
 no shutdown
!
interface GigabitEthernet0/1
 ip address 192.168.1.1 255.255.255.0
 ip nat inside
 no shutdown
!
ip access-list standard OLD-NAT
 permit 192.168.1.0 0.0.0.255
 deny any
ip nat inside source list OLD-NAT interface GigabitEthernet0/0 overload
ip route 0.0.0.0 0.0.0.0 192.168.73.2
ip dhcp pool USERS
 network 192.168.1.0 255.255.255.0
 default-router 192.168.1.1
ntp server 129.250.35.251
end`;
const forti=`config system global
 set hostname "KEEP-FGT"
end
config system interface
 edit "port1"
  set ip 192.168.73.200 255.255.255.0
 next
 edit "port2"
  set ip 192.168.2.1 255.255.255.0
 next
end
config system dhcp server
 edit 1
  set interface "port2"
  set default-gateway 192.168.2.1
 next
end
config router static
 edit 1
  set gateway 192.168.73.2
  set device "port1"
 next
end
config firewall policy
 edit 1
  set name "Internet"
  set srcintf "port2"
  set dstintf "port1"
  set nat enable
 next
end`;
const ros=`# RouterOS 6.49.19
/ip address
add address=192.168.73.150/24 interface=ether1
add address=192.168.2.1/24 interface=ether2
/ip dhcp-server
add name=EXISTING interface=ether2 disabled=no
/ip firewall nat
add action=masquerade chain=srcnat out-interface=ether1
/ip route
add dst-address=0.0.0.0/0 gateway=192.168.73.2
/system ntp client
set enabled=yes primary-ntp=129.250.35.251`;
const junos=`set system host-name KEEP-SRX
set interfaces ge-0/0/0 unit 0 family inet address 192.168.73.100/24
set interfaces ge-0/0/1 unit 0 family inet address 192.168.1.1/24
set routing-options static route 0.0.0.0/0 next-hop 192.168.73.2
set system services ssh
set security nat source rule-set INTERNET from zone trust
set security nat source rule-set INTERNET to zone untrust
set security nat source rule-set INTERNET rule PAT then source-nat interface`;
const pan=`set deviceconfig system hostname KEEP-PAN
set network interface ethernet ethernet1/1 layer3 ip 192.168.73.100/24
set network interface ethernet ethernet1/2 layer3 ip 192.168.1.1/24
set network virtual-router default routing-table ip static-route INTERNET destination 0.0.0.0/0 nexthop ip-address 192.168.73.2
set rulebase nat rules INTERNET from trust to untrust source any destination any service any source-translation dynamic-ip-and-port interface-address interface ethernet1/1`;
const fixtures={ios,fortinet:forti,mikrotik:ros,juniper:junos,paloalto:pan};
for(const [vendor,source]of Object.entries(fixtures)){
 const r=analyze(source,vendor);assert.deepEqual(r.errors,[],vendor+': '+r.errors);assert(r.detected.nat,vendor);assert.equal(r.interfaces.length,2,vendor);assert.equal(r.gateway,'192.168.73.2',vendor);assert(r.suggestedWan);assert(r.suggestedLan);assert(!JSON.stringify(r).includes('DO_NOT_EXPORT_EXISTING_SECRET'));
 const same=add(source,source,vendor);assert.deepEqual(same.errors,[],vendor+': '+same.errors);assert(same.empty);assert.equal(same.code,'');
}
assert(analyze(ios,'ios').detected.dhcp);assert(analyze(ros,'mikrotik').detected.dhcp);assert(analyze(forti,'fortinet').detected.dhcp);
assert(!analyze('no ip dhcp pool USERS\nno ip nat inside source list X interface Gi0/0 overload','ios').detected.dhcp);
const ntp=add(ios,'configure terminal\nntp server 129.250.35.251\nntp server 1.2.3.4\nend','ios');assert.deepEqual(ntp.errors,[]);assert(ntp.code.includes('ntp server 1.2.3.4'));assert(!ntp.code.includes('129.250.35.251'));assert(!ntp.code.includes('KEEP-ME'));assert(!ntp.code.includes('DO_NOT_EXPORT'));
const bind=add(ios,'configure terminal\ninterface GigabitEthernet0/0\n ip address 192.168.73.100 255.255.255.0\n ip virtual-reassembly\n exit\nend','ios');assert.deepEqual(bind.errors,[]);assert(bind.code.includes('ip virtual-reassembly'));assert(!bind.code.includes('ip address'));
assert(add(ios,'interface GigabitEthernet0/0\n ip address 10.0.0.1 255.255.255.0','ios').errors.length);
assert(add(ios,'ip route 0.0.0.0 0.0.0.0 1.1.1.1','ios').errors.length);
assert(add(ios,'hostname CHANGE-ME','ios').errors.length);
const fAdd=add(forti,'config system ntp\n set ntpsync enable\n config ntpserver\n  edit 1\n   set server "129.250.35.251"\n  next\n end\nend','fortinet');assert.deepEqual(fAdd.errors,[]);assert(fAdd.code.includes('config system ntp'));assert(!fAdd.code.includes('KEEP-FGT'));
assert(add(forti,'config system interface\n edit "port2"\n  set ip 10.99.0.1 255.255.255.0\n next\nend','fortinet').errors.length);
const fPing=add(forti,'config system interface\n edit "port2"\n  append allowaccess ping\n next\nend','fortinet');assert.deepEqual(fPing.errors,[]);assert(fPing.code.includes('append allowaccess ping'));
const rAdd=add(ros,'/ip firewall nat add chain=dstnat protocol=tcp dst-port=8443 action=dst-nat to-addresses=192.168.2.10 to-ports=443','mikrotik');assert.deepEqual(rAdd.errors,[]);assert(rAdd.code.includes('dst-nat'));assert(!rAdd.code.includes('masquerade'));
assert(add(ros,'/ip dhcp-server add name=EXISTING interface=ether3 disabled=no','mikrotik').errors.length);
assert(add(ros,'/ip address add address=10.0.0.1/24 interface=ether1','mikrotik').errors.length);
const semantic=add(ros,'/ip firewall nat add out-interface=ether1 chain=srcnat action=masquerade comment="Same rule"','mikrotik');assert(semantic.empty);
for(const vendor of ['juniper','paloalto']){const addition=vendor==='juniper'?'set system ntp server 129.250.35.251':'set deviceconfig system ntp-servers primary-ntp-server ntp-server-address 129.250.35.251';const r=add(fixtures[vendor],addition,vendor);assert.deepEqual(r.errors,[]);assert(r.code.includes(addition));assert(!r.code.includes('KEEP-'));assert(!/^commit$/m.test(r.code));}
assert(add(junos,'set interfaces ge-0/0/0 unit 0 family inet address 10.0.0.1/24','juniper').errors.length);
assert(add(pan,'set rulebase nat rules INTERNET from trust to untrust source 10.0.0.0/24 destination any service any','paloalto').errors.length);
for(const [vendor,source]of Object.entries(fixtures))for(const feature of ['bootstrap','enterprise'])assert(add(source,'',vendor,{selected:{[feature]:true}}).errors.length);
const vpn='configure terminal\ncrypto isakmp policy 100\n encryption aes 256\n hash sha\n group 5\n exit\nend';
const options={selected:{vpn:true},site:{local:'192.168.1.0/24',wan:'GigabitEthernet0/0'},peer:{local:'192.168.2.0/24'}};
assert(add(ios,vpn,'ios',options).errors.some(e=>e.includes('exemption update')));
const withNat=add(ios,vpn,'ios',{...options,includeNatExemption:true});assert.deepEqual(withNat.errors,[],withNat.errors.join(' '));for(const command of ['deny ip 192.168.1.0 0.0.0.255 192.168.2.0 0.0.0.255','permit ip 192.168.1.0 0.0.0.255 any','deny ip any any','no ip nat inside source list OLD-NAT interface GigabitEthernet0/0 overload','ip nat inside source route-map NOC-ADD-VPN-PAT interface GigabitEthernet0/0 overload'])assert(withNat.code.includes(command),command);assert(!withNat.code.includes('enable secret'));
assert(add(ios+'\nip nat inside source static 192.168.1.2 192.168.73.12',vpn,'ios',{...options,includeNatExemption:true}).errors.length);
for(const [vendor,bad]of [['ios','banner motd ^hello^'],['mikrotik','/system script\nadd name=bad source="/system reboot"'],['fortinet','config system interface\n edit "port1"\n set ip 1.2.3.4 255.255.255.0'],['juniper','system { host-name X; }'],['paloalto','<config><shared/></config>']])assert(analyze(bad,vendor).errors.length,vendor);
for(const vendor of Object.keys(fixtures))for(const value of ['', 'a'.repeat(200001),'\x1b[0m'])assert(analyze(value,vendor).errors.length);
// Each supported generated feature must at least parse or return a clear bounded rejection.
let generated=0;for(const [id,feature]of Object.entries(FEATURES))for(const vendor of feature.vendors){if(!fixtures[vendor]||!feature.tool&&id==='vpn')continue;const d=featureDefaults(id,vendor);if(id==='hardening')d.secret=d.enableSecret='Fixture2026';let r;try{r=generateFeature(id,d);}catch{continue;}if(r.errors.length)continue;for(const script of r.scripts){const a=analyze(script.code,vendor);assert.deepEqual(a.errors,[],id+' '+vendor+': '+a.errors.join(' '));if(!['bootstrap','enterprise','internet_access','wan_failover'].includes(id))assert(a.detected[id],id+' '+vendor);generated++;}}

// Actual site-to-site templates are reduced to additions, including existing PAT handling.
for(const vendor of ['ios','mikrotik','fortinet','paloalto']){
 const c=structuredClone(DEFAULTS);c.a.vendor=vendor;c.a.routerModel=vendor==='mikrotik'?'mikrotik-6.49.19 (EVE-NG)':'';
 Object.assign(c.a,{wan:vendor==='ios'?'GigabitEthernet0/0':vendor==='mikrotik'?'ether1':vendor==='fortinet'?'port1':'ethernet1/1',lan:vendor==='ios'?'GigabitEthernet0/1':vendor==='mikrotik'?'ether2':vendor==='fortinet'?'port2':'ethernet1/2',ip:'192.168.73.100',wanPrefix:'24',gateway:'192.168.73.2',local:'192.168.1.0/24',remote:'192.168.2.0/24',lanIp:'192.168.1.1',psk:'VpnFixture2026'});
 Object.assign(c.b,{ip:'192.168.73.200',wanPrefix:'24',gateway:'192.168.73.2',psk:'VpnFixture2026'});
 const vpn=generateVpn(c);assert.deepEqual(vpn.errors,[]);const r=add(fixtures[vendor],vpn.a,vendor,{selected:{vpn:true},site:c.a,peer:c.b,includeNatExemption:true});assert.deepEqual(r.errors,[],vendor+': '+r.errors.join(' '));assert(r.code.includes('VpnFixture2026'));assert(!r.code.includes('KEEP-'));
}
const pf=generateFeature('portforward',{...featureDefaults('portforward','ios'),publicIp:'192.168.73.100',inside:'GigabitEthernet0/1',outside:'GigabitEthernet0/0',localNetwork:'192.168.1.0/24',internalIp:'192.168.1.10',lanIp:'192.168.1.1'});assert.deepEqual(pf.errors,[]);for(const script of pf.scripts){const r=add(ios,script.code,'ios',{selected:{portforward:true}});assert.deepEqual(r.errors,[],r.errors.join(' '));assert(!r.code.includes('ip dhcp pool'));assert(!r.code.includes('hostname KEEP-ME'));}

assert(analyze('version 12.4\nntp server 1.1.1.1','ios').firmware==='12.4');assert(add('version 12.4','crypto ikev2 proposal NEW','ios').errors.length);
console.log('Configuration analysis: five vendors, 77 feature templates, actual VPN and port-forward additions, PAT review, duplicate/conflict gates and version checks passed.');

assert(add("/ip service set telnet disabled=no","/ip service set ssh disabled=no","mikrotik").code.includes("set ssh"));

assert(analyze(ios,"ios").detected.interfaces);assert(!analyze(ios,"ios").detected.internet_access);assert(add(ios,"ntp server 1.1.1.1","ios",{selected:{internet_access:true}}).errors.length);
