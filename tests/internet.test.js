import assert from 'node:assert/strict';
import {createLab} from '../static/vpn/lab.js';
import {PORTS} from '../static/vpn/platforms.js';
import {featureDefaults,generateFeature} from '../static/vpn/features.js';
import {composeDevice} from '../static/vpn/compose.js';
let checks=0;
const check=(value,message)=>{assert(value,message);checks++;};
function setup(vendor){const lab=createLab();Object.assign(lab.a,{vendor,wan:PORTS[vendor][0],lan:PORTS[vendor][1],ip:'198.18.40.10',gateway:'198.18.40.9',local:'172.22.4.0/24',lanIp:'172.22.4.1',switchIp:'172.22.4.254',hostIp:'172.22.4.10'});return lab;}
function build(lab,selected,values){return composeDevice({lab,side:'a',role:'router',selected,values});}
for(const vendor of Object.keys(PORTS).filter(v=>v!=='asa')){
 const lab=setup(vendor),office=featureDefaults('internet_access',vendor),wan={...featureDefaults('wan_failover',vendor),ip2:'198.18.41.6',gateway2:'198.18.41.5',backupDistance:'9'};
 const first=build(lab,{internet_access:true},{internet_access:office});
 check(!first.errors.length,first.errors.join(';'));check(first.code.includes(lab.a.gateway),'Custom ISP gateway used');check(first.code.includes(lab.a.lanIp),'Base LAN bindings automatic');check(first.code.includes('172.22.4.0'),'Actual LAN used by PAT/policy');check(!first.code.includes(wan.ip2),'Disabled WAN2 omitted');
 if(vendor==='ios'){
  check(first.code.includes(`ip route 0.0.0.0 0.0.0.0 ${lab.a.gateway} 1`),'Next-hop-only default');
  check(!first.code.includes('match interface'),'ACL-only NAT route map');
  check(first.code.includes(`match ip address NOC-INTERNET-NAT`)&&first.code.includes(`ip nat inside source route-map NOC-INTERNET-ISP1 interface ${lab.a.wan} overload`),'ACL and interface overload retained');
  const dual=build(lab,{internet_access:true,wan_failover:true},{internet_access:office,wan_failover:wan});check(dual.errors.length&&!dual.code&&dual.errors[0].includes('egress'),'Ambiguous dual-WAN PAT blocked');
  const routes=build(lab,{wan_failover:true},{wan_failover:wan});check(!routes.errors.length,routes.errors.join(';'));check(routes.code.includes(`ip route 0.0.0.0 0.0.0.0 ${wan.gateway2} 9`),'Floating route retains distance');
  continue;
 }
 const both=build(lab,{internet_access:true,wan_failover:true},{internet_access:office,wan_failover:wan});
 check(!both.errors.length,both.errors.join(';'));for(const value of [wan.ip2,wan.gateway2,wan.wan2,lab.a.ip,lab.a.gateway,lab.a.lanIp])check(both.code.includes(value),vendor+' missing '+value);
 check(!/undefined|NaN|\[object Object\]/.test(both.code),'No unresolved placeholders');
 const pure=build(lab,{wan_failover:true},{wan_failover:wan});check(!pure.errors.length,pure.errors.join(';'));check(pure.code.includes(wan.ip2),'Standalone WAN2 includes interface');
 if(vendor==='juniper')check(both.code.includes(`qualified-next-hop ${wan.gateway2} preference 9`));
 if(vendor==='mikrotik'){check(both.code.includes('check-gateway=ping'));check(both.code.includes(`out-interface=${wan.wan2} action=masquerade`));check(both.code.includes('connection-state=established,related'));}
 if(vendor==='fortinet'){check(both.code.includes('set distance 9'));check(both.code.includes(`set dstintf "${lab.a.wan}" "${wan.wan2}"`));check(both.code.includes('set nat enable'));}
 if(vendor==='paloalto'){check(both.code.includes('NOC-BACKUP metric 9'));check(both.code.includes(`to-interface ${wan.wan2}`));check(!both.code.includes('admin-dist 1\n'));}
 for(const bad of [{ip2:'198.18.41.4'},{ip2:'198.18.41.7'},{gateway2:wan.ip2},{gateway2:'198.18.42.1'},{wan2:lab.a.lan},{wan2:lab.a.wan},{ip2:lab.a.ip,gateway2:lab.a.gateway},{ip2:'172.22.4.6',gateway2:'172.22.4.5'},{backupDistance:'1'},{backupDistance:'0'},{wan2:'ether3;reload'},{gateway2:'198.18.41.5\nreload'}]){
  const result=build(lab,{internet_access:true,wan_failover:true},{internet_access:office,wan_failover:{...wan,...bad}});check(result.errors.length&&result.code==='',vendor+' must reject '+JSON.stringify(bad));
 }
 const blank=build(lab,{wan_failover:true},{wan_failover:{...wan,backupDistance:''}});check(!blank.errors.length,'Blank priority defaults to 5');
 const conflict=build(lab,{internet_access:true,nat:true},{internet_access:office,nat:featureDefaults('nat',vendor)});check(conflict.errors.length&&!conflict.code,'Overlapping translation blocked');
 const route=build(lab,{wan_failover:true,static:true},{wan_failover:wan,static:{...featureDefaults('static',vendor),destination:'0.0.0.0',mask:'0.0.0.0',nextHop:lab.a.gateway}});check(route.errors.length&&!route.code,'Duplicate default blocked');
 const sw=composeDevice({lab,side:'a',role:'switch',bindings:true});check(!sw.errors.length&&sw.code.includes(lab.a.switchIp)&&sw.code.includes(lab.a.lanIp),'Separate switch management script');check(!sw.code.includes('ip nat'),'Router NAT does not leak into switch script');
}
const lab=setup('ios');lab.a.vlan2Enabled='on';lab.a.vlan2Subnet='172.23.20.0/24';lab.a.vlan2Gateway='172.23.20.1';lab.a.vlan2SwitchIp='172.23.20.254';
const dual=build(lab,{internet_access:true},{internet_access:featureDefaults('internet_access','ios')});
check(!dual.errors.length,dual.errors.join(';'));check(dual.code.includes('permit 172.23.20.0 0.0.0.255'),'Second VLAN translated');check(dual.code.includes('interface '+lab.a.lan+'.20'),'Second routed VLAN protected');
for(const vendor of ['ios','mikrotik']){
 const lab=setup(vendor),r=build(lab,{nat:true,wan_failover:true},{nat:featureDefaults('nat',vendor),wan_failover:featureDefaults('wan_failover',vendor)});
 if(vendor==='ios')check(r.errors.length&&!r.code,'Standalone dual-WAN PAT rejected atomically');else {check(!r.errors.length,r.errors.join(';'));check(r.code.includes('NOC backup WAN PAT'),'RouterOS backup PAT preserved');}
}
const defaultStatic=generateFeature('static',{...featureDefaults('static','ios'),destination:'0.0.0.0',mask:'0.0.0.0',nextHop:'198.18.50.9',interface:'GigabitEthernet1',distance:'7'});
check(!defaultStatic.errors.length,defaultStatic.errors.join(';'));check(defaultStatic.scripts[0].code.includes('ip route 0.0.0.0 0.0.0.0 198.18.50.9 7'),'Standalone default omits interface');
const missingHop=generateFeature('static',{...featureDefaults('static','ios'),destination:'0.0.0.0',mask:'0.0.0.0',nextHop:'',interface:'GigabitEthernet1'});check(missingHop.errors.length&&!missingHop.scripts.length,'Default requires a next hop');
console.log(`${checks} internet / dual ISP checks passed.`);


const wide=setup('mikrotik');wide.a.wanPrefix='24';Object.assign(wide.a,{local:'198.18.40.128/25',lanIp:'198.18.40.129',switchIp:'198.18.40.254',hostIp:'198.18.40.130'});check(build(wide,{internet_access:true},{internet_access:featureDefaults('internet_access','mikrotik')}).errors.length,'Larger primary WAN overlap with LAN must be rejected');
const overlappingBackup=setup('mikrotik');overlappingBackup.a.wanPrefix='24';check(build(overlappingBackup,{wan_failover:true},{wan_failover:{...featureDefaults('wan_failover','mikrotik'),ip2:'198.18.40.134',gateway2:'198.18.40.133'}}).errors.length,'Backup /30 must not sit inside primary /24');
