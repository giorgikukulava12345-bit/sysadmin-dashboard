import assert from 'node:assert/strict';
import {defaultsFor,generateTool} from '../static/vpn/catalog.js';
import {featureDefaults} from '../static/vpn/features.js';
import {createLab} from '../static/vpn/lab.js';
import {composeDevice} from '../static/vpn/compose.js';
import {PORTS} from '../static/vpn/platforms.js';
for(const value of ['test','1234','abcd','word!','basic#$()','a'.repeat(100)]){
  const r=generateTool('hardening',{...defaultsFor('hardening'),secret:value,enableSecret:value});assert.deepEqual(r.errors,[],value);assert.ok(r.scripts[0].code.includes('enable secret '+value));
}
for(const value of ['',undefined,null,'abc','abcd\nend','abcd;reload','with space','abc?','abc"','abc\\']){
  const r=generateTool('hardening',{...defaultsFor('hardening'),secret:value,enableSecret:'1234'});assert.ok(r.errors.length&&r.scripts.length===0);
}
const nat={ios:/ip nat inside source/,mikrotik:/chain=srcnat/,fortinet:/set nat enable/,juniper:/set security nat source/,paloalto:/set rulebase nat/};
const route={ios:/ip route 0\.0\.0\.0/,mikrotik:/dst-address=0\.0\.0\.0\/0/,fortinet:/config router static/,juniper:/set routing-options static route 0\.0\.0\.0\/0/,paloalto:/static-route NOC-PRIMARY destination 0\.0\.0\.0\/0/};
const dns={ios:/ip name-server/,mikrotik:/\/ip dns set/,fortinet:/config system dns/,juniper:/set system name-server/,paloalto:/dns-setting servers/};
const dhcp={ios:/ip dhcp pool/,mikrotik:/\/ip dhcp-server add/,fortinet:/config system dhcp server/,juniper:/dhcp-local-server/,paloalto:/server mode enabled/};
for(const vendor of Object.keys(nat)){
  const lab=createLab();Object.assign(lab.a,{vendor,wan:PORTS[vendor][0],lan:PORTS[vendor][1],officeVlans:true,vlan2Enabled:'on',vlan2Subnet:'172.16.19.0/24',vlan2Gateway:'172.16.19.1',vlan2SwitchIp:'172.16.19.254'});
  const run=parts=>composeDevice({lab,side:'a',role:'router',selected:{internet_access:true},values:{internet_access:{...featureDefaults('internet_access',vendor),parts}}});
  for(const key of ['nat','route','dns','dhcp','interfaces']){
    const r=run({[key]:false});assert.deepEqual(r.errors,[],vendor+' / '+key);assert.ok(r.code&&!/undefined|NaN/.test(r.code));
    if(key==='nat')assert.doesNotMatch(r.code,nat[vendor]);else assert.match(r.code,nat[vendor]);
    if(key==='route')assert.doesNotMatch(r.code,route[vendor]);else assert.match(r.code,route[vendor]);
    if(key==='dns')assert.doesNotMatch(r.code,dns[vendor]);else assert.match(r.code,dns[vendor]);
    if(key==='dhcp')assert.doesNotMatch(r.code,dhcp[vendor]);else assert.match(r.code,dhcp[vendor]);
    if(key==='interfaces')assert.ok(!r.code.includes('BASE INTERFACE / IP BINDINGS'));
  }
  const withoutFirewall=run({firewall:false});
  if(vendor==='fortinet')assert.ok(withoutFirewall.errors.length&&withoutFirewall.code==='');else assert.deepEqual(withoutFirewall.errors,[]);
  const withoutBoth=run({firewall:false,nat:false});assert.deepEqual(withoutBoth.errors,[]);assert.doesNotMatch(withoutBoth.code,nat[vendor]);
  const empty=run({nat:false,route:false,firewall:false,interfaces:false,dhcp:false,dns:false});assert.ok(empty.empty&&empty.code==='');
  const minimal=run({dhcp:false,dns:false});assert.deepEqual(minimal.errors,[]);assert.doesNotMatch(minimal.code,dhcp[vendor]);assert.doesNotMatch(minimal.code,dns[vendor]);
}
console.log('Preset components: five-vendor independent route/NAT/DHCP/DNS/interface removal, firewall dependencies and simple SSH secrets passed.');
