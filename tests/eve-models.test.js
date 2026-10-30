import assert from 'node:assert/strict';
import {EVE_MODELS,selectEveModel,validateEvePorts} from '../static/vpn/eve-models.js';
import {createLab} from '../static/vpn/lab.js';
import {composeDevice} from '../static/vpn/compose.js';
import {selectRouterModel,modelGenerationError,validateModelPorts} from '../static/vpn/router-models.js';
import {selectSwitchModel,validateSwitchPorts} from '../static/vpn/switch-models.js';
import {portOptions} from '../static/vpn/port-options.js';
assert.equal(EVE_MODELS.length,9);assert.equal(new Set(EVE_MODELS.map(r=>r.model)).size,9);
for(const row of EVE_MODELS){
 assert(row.label.endsWith('(EVE-NG)'));const lab=createLab(),peer=structuredClone(lab.b);lab.a[row.role==='router'?'vendor':'switchVendor']=row.vendor;
 (row.role==='router'?selectRouterModel:selectSwitchModel)(lab.a,row.model);assert.deepEqual(lab.b,peer);
 assert.equal(lab.a[row.role==='router'?'routerModel':'switchModel'],row.model);if(!row.cli_supported){assert(modelGenerationError(lab.a));const blocked=composeDevice({lab,side:'a',role:row.role,bindings:true});assert(blocked.errors.length);assert.equal(blocked.code,'');continue;}assert.deepEqual(validateEvePorts(lab.a,row.role),[]);
 assert.deepEqual((row.role==='router'?validateModelPorts:validateSwitchPorts)(lab.a),[]);if(row.role==='router')assert.equal(modelGenerationError(lab.a),'');
 const result=composeDevice({lab,side:'a',role:row.role,bindings:true});assert.deepEqual(result.errors,[],row.model);assert(result.code.includes(row.ports[0]));
 assert(portOptions(row.vendor,row.model,'wan',row.ports[1]).every(p=>p.value!==row.ports[1]));
 lab.a[row.role==='router'?'wan':'uplink']='port1\nend';assert(validateEvePorts(lab.a,row.role).length);
}
const s=createLab().a;assert.equal(selectEveModel(s,'missing'),false);
assert(EVE_MODELS.some(r=>r.model==='Paloalto-10.2.5 (EVE-NG)'));
console.log('EVE-NG: 9 screenshot profiles, device/vendor isolation, defaults, exports, editable ports and unsafe-name rejection passed.');

for(const version of ['6.49.19'])assert.deepEqual(EVE_MODELS.find(r=>r.model===`mikrotik-${version} (EVE-NG)`).ports,['ether1','ether2','ether3','ether4']);

assert.deepEqual(EVE_MODELS.filter(r=>r.vendor==='ios').map(r=>r.model),['Cisco IOS 1710 (Dynamips) (EVE-NG)','Cisco IOS 3725 (Dynamips) (EVE-NG)','Cisco IOS 7206VXR (Dynamips) (EVE-NG)','Cisco IOL (EVE-NG)','Cisco Firepower NGIPS 7 (EVE-NG)']);

// Image-specific syntax must follow the selected model, including direct exports.
import {cliProfile,profileCLI} from '../static/vpn/cli-profile.js';
import {DEFAULTS,generate} from '../static/vpn/engine.js';
import {featureDefaults} from '../static/vpn/features.js';
import {terminalText} from '../static/vpn/cli-export.js';
for(const name of ['Cisco IOS 1710 (Dynamips) (EVE-NG)','Cisco IOS 3725 (Dynamips) (EVE-NG)','Cisco IOS 7206VXR (Dynamips) (EVE-NG)']){
 const lab=createLab(),vpnConfig=structuredClone(DEFAULTS);
 for(const side of ['a','b']){lab[side].vendor='ios';selectRouterModel(lab[side],name);Object.assign(vpnConfig[side],lab[side],{remote:lab[side==='a'?'b':'a'].local,psk:'ImageFixture2026'});}
 const base={lab,role:'router',vpnConfig,vpnType:'ikev1',selected:{internet_access:true,vpn:true,ntp_syslog:true},values:{internet_access:{...featureDefaults('internet_access','ios'),standardOffice:true,officeVpn:true,parts:{firewall:false}},ntp_syslog:{ntp:'129.250.35.251'}}};
 for(const side of ['a','b']){const result=composeDevice({...base,side});assert.deepEqual(result.errors,[],name);const code=terminalText(result.code,{vendor:'ios',model:name});
 assert(code.includes('crypto isakmp policy 100'));assert(!code.includes('crypto ikev2'));assert(!code.includes('ip virtual-reassembly in'));assert(code.includes('ip virtual-reassembly'));assert(code.includes('hash sha\r\n'));assert(code.includes('esp-sha-hmac\r\n mode tunnel\r\n exit\r\n'));assert(code.includes('crypto map NOC-MAP'));assert(code.includes('hostname '+(side==='b'?'R2':'R1')));assert(!code.includes('algorithm-type scrypt'));assert(code.endsWith('\r\n'));
 const blocked=composeDevice({...base,side,vpnType:'ikev2'});assert(blocked.errors.length);assert.equal(blocked.code,'');}
 vpnConfig.protocol='ikev2';assert(generate(vpnConfig).errors.length);vpnConfig.protocol='ikev1';assert.equal(generate(vpnConfig).errors.length,0);
}
const ros=createLab();ros.a.vendor='mikrotik';selectRouterModel(ros.a,'mikrotik-6.49.19 (EVE-NG)');
const clock=composeDevice({lab:ros,side:'a',role:'router',selected:{ntp_syslog:true},values:{ntp_syslog:{ntp:'129.250.35.251'}}});assert.deepEqual(clock.errors,[]);assert(clock.code.includes('primary-ntp=129.250.35.251'));assert(!clock.code.includes('ntp client servers'));
const routing=composeDevice({lab:ros,side:'a',role:'router',selected:{ospf:true},values:{ospf:featureDefaults('ospf','mikrotik')}});assert(routing.errors.length);assert.equal(routing.code,'');
assert.equal(cliProfile({vendor:'mikrotik',routerModel:'mikrotik-7.23.7 (EVE-NG)'}).id,'ros7');
assert.equal(profileCLI('ip virtual-reassembly in',{vendor:'ios',routerModel:'Cisco ISR4331-SEC/K9'}),'ip virtual-reassembly in');
console.log('Image compatibility: three Dynamips profiles, IKEv1 modes, VFR syntax, both hostnames, atomic protocol blocking and RouterOS 6 NTP/version gates passed.');
