import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FEATURES,featureDefaults,featureFields,generateFeature,boundValues,remoteDefaults,generateRemoteVpn} from '../static/vpn/features.js';
import {createLab,labScripts} from '../static/vpn/lab.js';
import {composeDevice} from '../static/vpn/compose.js';
import {DEFAULTS,generate,support} from '../static/vpn/engine.js';
import {PORTS} from '../static/vpn/platforms.js';
let checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};
const build=(lab,id,data)=>composeDevice({lab,side:'a',role:'router',selected:{[id]:true},values:{[id]:data}});
for(const vendor of ['ios','mikrotik','fortinet']){
 const lab=createLab();lab.a.vendor=vendor;[lab.a.wan,lab.a.lan]=PORTS[vendor];
 const data=featureDefaults('dhcp',vendor);Object.assign(data,{poolStart:'192.168.1.50',poolEnd:'192.168.1.200',exclusions:'',leaseMinutes:'1950'});
 const r=build(lab,'dhcp',data);check(!r.errors.length,r.errors.join(';'));
 check(r.code.includes(vendor==='ios'?'lease 1 8 30':vendor==='mikrotik'?'lease-time=1950m':'set lease-time 117000'),'Lease must follow input');
 lab.a.switchIp='192.168.1.100';
 const changed=build(lab,'dhcp',data);
 check(vendor==='ios'?changed.code.includes('excluded-address 192.168.1.100'):changed.errors.some(e=>e.includes('reserved topology')),'DHCP must protect edited management IP');
 check(build(lab,'dhcp',{...data,leaseMinutes:''}).errors.length,'Empty lease must not silently fall back');
}
for(const vendor of ['ios','mikrotik']){
 const lab=createLab();lab.a.vendor=vendor;[lab.a.wan,lab.a.lan]=PORTS[vendor];const d={...featureDefaults('nat',vendor),natMode:'static',insideHost:lab.a.hostIp,publicHost:'198.18.12.25'};
 let r=build(lab,'nat',d);check(!r.errors.length,r.errors.join(';'));check(r.code.includes(lab.a.hostIp)&&r.code.includes(d.publicHost),'Static mapping must follow inputs');
 if(vendor==='mikrotik')check(r.code.includes('chain=dstnat in-interface='+lab.a.wan),'Inbound static NAT must be WAN-scoped');
 for(const patch of [{insideHost:lab.a.switchIp},{insideHost:lab.a.lanIp},{publicHost:lab.a.gateway},{publicHost:lab.a.ip},{publicHost:''}]){r=build(lab,'nat',{...d,...patch});check(r.errors.length&&r.code==='','Invalid NAT must be atomic');}
 const dynamic={...d,natMode:'dynamic',poolStart:lab.a.gateway,poolEnd:lab.a.ip,poolPrefix:'30'};check(build(lab,'nat',dynamic).errors.length,'NAT pool cannot consume WAN endpoints');
}
for(const id of ['static','static6']){
 const d={...featureDefaults(id,'paloalto'),virtualRouter:'CORP-VR',routeName:'BRANCH-APP'};
 const r=generateFeature(id,d);check(!r.errors.length,r.errors.join(';'));const code=r.scripts[0].code;
 check(code.includes('virtual-router CORP-VR')&&code.includes('static-route BRANCH-APP')&&!code.includes('virtual-router default'),'PAN-OS context follows inputs');
 for(const patch of [{virtualRouter:''},{routeName:'bad\nAUDIT-INJECT'}])check(generateFeature(id,{...d,...patch}).errors.length,'Unsafe/empty route context must fail');
}
const lab=createLab();check(build(lab,'static',{...featureDefaults('static','ios'),nextHop:lab.a.ip}).errors.length,'Reject self-referential next hop');
check(build(lab,'portforward',{...featureDefaults('portforward','ios'),internalIp:lab.a.switchIp}).errors.length,'Reject forwarding to management SVI');
for(const patch of [{vlan:'1003'},{ip:'127.0.0.1',gateway:'127.0.0.2'},{ip:'224.0.0.1',gateway:'224.0.0.2'},{ip:lab.b.ip,gateway:lab.b.gateway}]){const copy=structuredClone(lab);Object.assign(copy.a,patch);check(labScripts(copy).errors.length,'Reject reserved/duplicate topology values');}
const bridge=generateFeature('vlan',{...featureDefaults('vlan','mikrotik'),bridge:'OFFICE-BRIDGE',interface:'ether7'});check(!bridge.errors.length&&bridge.scripts[0].code.includes('bridge=OFFICE-BRIDGE')&&!bridge.scripts[0].code.includes('NOC-SW'),'Bridge name is no longer ignored');
check(generateRemoteVpn('openvpn',{...remoteDefaults('openvpn'),username:'nocadmin',password:'ExampleOnly_ChangeMe26'},{...lab.a,vendor:'mikrotik'}).errors.length,'OpenVPN needs an actual server');
// Custom-address sweep over every supported vendor/protocol pair.
for(const protocol of ['ikev1','ikev2','gre','vti'])for(const vendor of ['ios','mikrotik','fortinet','juniper','paloalto']){
 if(support(vendor,protocol))continue;const c=structuredClone(DEFAULTS);c.bindInterfaces=true;c.protocol=protocol;c.a.vendor=vendor;c.b.vendor='ios';
 [c.a.wan,c.a.lan]=PORTS[vendor];c.a.ip='198.18.0.1';c.a.gateway='198.18.0.2';c.b.ip='198.18.0.5';c.b.gateway='198.18.0.6';c.a.local=c.b.remote='172.21.7.0/26';c.b.local=c.a.remote='172.22.8.0/27';c.a.lanIp='172.21.7.1';c.b.lanIp='172.22.8.1';c.a.psk=c.b.psk='ActualFormKey_Changed26';
 const r=generate(c);check(!r.errors.length,r.errors.join(';'));check(r.a.includes(c.a.ip)&&r.a.includes(c.b.ip)&&r.a.includes(c.a.psk)&&!r.a.includes('203.0.113.10'),'VPN must use custom endpoints and PSK');
}
for(const vendor of ['juniper','paloalto']){
 const c=structuredClone(DEFAULTS);c.a.vendor=vendor;[c.a.wan,c.a.lan]=PORTS[vendor];c.a.psk=c.b.psk='ActualFormKey_Changed26';Object.assign(c.a,{zone:'OFFICE',wanZone:'EDGE',vpnZone:'BRANCH',vpnUnit:'212',vr:'CORE'});
 const r=generate(c);check(!r.errors.length,r.errors.join(';'));check(r.a.includes(vendor==='juniper'?'st0.212':'tunnel.212')&&r.a.includes('BRANCH')&&r.a.includes('OFFICE'),'VPN context follows form');
 c.a.vpnUnit='212\nend';check(generate(c).errors.length,'VPN unit injection must fail');
}
{const c=structuredClone(DEFAULTS);c.protocol='vti';c.b.vendor='ios';c.a.psk=c.b.psk='ActualFormKey_Changed26';c.pfs='19';check(generate(c).a.includes('set pfs group19'),'VTI must honor selected PFS group');}
// Every active text/number field of every supported feature is tested for CLI injection.
let pairs=0,mutations=0;
for(const[id,f]of Object.entries(FEATURES).filter(([id])=>id!=='vpn'))for(const vendor of f.vendors){
 let d=featureDefaults(id,vendor);for(const field of featureFields(id,vendor))if(field.type==='password')d[field.key]=field.key==='privSecret'?'PrivacyOnly_ChangeMe26':'ExampleOnly_ChangeMe26';
 if(id==='dmvpn')d.nhrpSecret='NocLab26';if(id==='remotevpn')Object.assign(d,{username:'nocadmin',server:'audit-vpn.example.org'});if(id==='hardening')d.secret=d.enableSecret='ExampleOnly_0123456789';if(id==='vlan'&&vendor!=='ios')d.interface=vendor==='juniper'?'ge-0/0/1':'ether2';
 if(id==='dhcp'&&vendor!=='ios')Object.assign(d,{network:'10.10.0.0/24',gateway:'10.10.0.1',interface:vendor==='fortinet'?'port2':'ether2'});
 if(['remotevpn','relay','fhrp'].includes(id))d=boundValues(id,d,{...lab.a,local:'10.10.0.0/24',lanIp:'10.10.0.1',vendor});
 const baseline=generateFeature(id,d);check(!baseline.errors.length,`${id}/${vendor}: ${baseline.errors}`);pairs++;
 for(const field of featureFields(id,vendor).filter(f=>!['select','checkbox'].includes(f.type)&&(!f.when||f.when(d)))){
  const r=generateFeature(id,{...d,[field.key]:String(d[field.key])+'\nAUDIT-INJECT'});check(r.errors.length?!r.scripts.length:r.scripts.every(s=>!s.code.includes('AUDIT-INJECT')),`${id}/${vendor}/${field.key}: CLI injection`);mutations++;
 }
}
const template=await readFile(new URL('../templates/index.html',import.meta.url),'utf8'),playbook=await readFile(new URL('../static/vpn/playbook.js',import.meta.url),'utf8');check(!template.includes('45.9.46.76')&&!template.includes('Georgianairlink LLC'),'No fabricated network discovery values');check(!playbook.includes('const repairs=')&&!playbook.includes('data-repair'),'No hardcoded mutation playbooks');
console.log(`${checks} audit checks passed; ${pairs} feature/vendor cases; ${mutations} input-injection mutations.`);
