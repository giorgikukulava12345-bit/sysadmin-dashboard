import assert from 'node:assert/strict';
import {suggestGateway,baselineFeatures,toggleFeature,vpnAvailable} from '../static/vpn/lab-policy.js';
import {createLab} from '../static/vpn/lab.js';
import {composeDevice} from '../static/vpn/compose.js';
import {featureDefaults} from '../static/vpn/features.js';
import {PORTS} from '../static/vpn/platforms.js';
assert.equal(suggestGateway('203.0.113.9'),'203.0.113.10');
assert.equal(suggestGateway('203.0.113.10'),'203.0.113.9');
for(const value of ['203.0.113.8','203.0.113.11','','invalid'])assert.equal(suggestGateway(value),'');
assert.equal(baselineFeatures('ios').hardening,true);assert.equal(baselineFeatures('paloalto').hardening,undefined);
assert.equal(toggleFeature({fhrp:true},'glbp',true,'ios').fhrp,false);
assert.equal(toggleFeature({glbp:true},'fhrp',true,'ios').glbp,false);
assert.equal(toggleFeature({dhcp:true},'relay',true,'ios').dhcp,false);assert.equal(toggleFeature({internet_access:true},'relay',true,'ios').internet_access,false);
assert.equal(toggleFeature({},'wan_failover',true,'ios').ipsla,true);
assert.equal(toggleFeature({},'wan_failover',true,'juniper').ipsla,undefined);
assert.equal(toggleFeature({wan_failover:true},'ipsla',false,'ios').wan_failover,false);
assert.equal(vpnAvailable('wireguard','ios','mikrotik'),false);assert.equal(vpnAvailable('vti','ios','ios'),true);
for(const vendor of Object.keys(PORTS).filter(v=>v!=='asa')){
  const lab=createLab();Object.assign(lab.a,{vendor,wan:PORTS[vendor][0],lan:PORTS[vendor][1],vlan2Enabled:'on',officeVlans:true,vlan2Subnet:'172.16.19.0/24',vlan2Gateway:'172.16.19.1',vlan2SwitchIp:'172.16.19.254'});
  const office=composeDevice({lab,side:'a',role:'router',selected:{internet_access:true},values:{internet_access:featureDefaults('internet_access',vendor)}});
  assert.deepEqual(office.errors,[],vendor);assert.ok(office.code.includes('172.16.19.'));assert.ok(!/undefined|NaN|\[object Object\]/.test(office.code));
  const relay=composeDevice({lab,side:'a',role:'router',selected:{relay:true},values:{relay:{...featureDefaults('relay',vendor),interface:lab.a.lan,server:'198.18.0.50'}}});
  assert.deepEqual(relay.errors,[],vendor);assert.ok(relay.code.includes(lab.a.lan+'.20'),vendor);
}
const lab=createLab(),sla={...featureDefaults('ipsla','ios'),sourceInterface:lab.a.wan,target:lab.a.gateway};
const failover=()=>composeDevice({lab,side:'a',role:'router',selected:{wan_failover:true,ipsla:true},values:{wan_failover:featureDefaults('wan_failover','ios'),ipsla:sla}});
let r=failover();assert.deepEqual(r.errors,[]);assert.ok(r.code.includes(`ip route 0.0.0.0 0.0.0.0 ${lab.a.gateway} 1 track ${sla.track}`));assert.ok(r.code.includes(`track ${sla.track} ip sla ${sla.operation} reachability`));
sla.track='900';r=failover();assert.ok(r.errors.length&&r.code==='');
console.log('Lab polish: /30 peer, baseline, exclusivity, vendor gates, five-vendor multi-VLAN/relay and linked SLA checks passed.');
