import assert from 'node:assert/strict';
import {EVE_MODELS,selectEveModel,validateEvePorts} from '../static/vpn/eve-models.js';
import {createLab} from '../static/vpn/lab.js';
import {composeDevice} from '../static/vpn/compose.js';
import {selectRouterModel,modelGenerationError,validateModelPorts} from '../static/vpn/router-models.js';
import {selectSwitchModel,validateSwitchPorts} from '../static/vpn/switch-models.js';
import {portOptions} from '../static/vpn/port-options.js';
assert.equal(EVE_MODELS.length,10);assert.equal(new Set(EVE_MODELS.map(r=>r.model)).size,10);
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
console.log('EVE-NG: 10 screenshot profiles, device/vendor isolation, defaults, exports, editable ports and unsafe-name rejection passed.');

for(const version of ['6.49.19','7.23.7'])assert.deepEqual(EVE_MODELS.find(r=>r.model===`mikrotik-${version} (EVE-NG)`).ports,['ether1','ether2','ether3','ether4']);

assert.deepEqual(EVE_MODELS.filter(r=>r.vendor==='ios').map(r=>r.model),['Cisco IOS 1710 (Dynamips) (EVE-NG)','Cisco IOS 3725 (Dynamips) (EVE-NG)','Cisco IOS 7206VXR (Dynamips) (EVE-NG)','Cisco IOL (EVE-NG)','Cisco Firepower NGIPS 7 (EVE-NG)']);
