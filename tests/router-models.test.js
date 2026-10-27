import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CISCO_ROUTERS,ROUTER_PORTS,selectRouterModel,modelPortOptions,validateModelPorts,switchedLan,modelLanConfig,modelProfile,modelGenerationError} from '../static/vpn/router-models.js';
import {portOptions} from '../static/vpn/port-options.js';
import {createLab} from '../static/vpn/lab.js';
import {composeDevice} from '../static/vpn/compose.js';
import {featureDefaults} from '../static/vpn/features.js';
const json=JSON.parse(readFileSync(new URL('../static/vpn/cisco-routers.json',import.meta.url)));
assert.deepEqual(json,CISCO_ROUTERS);
const keys=['model','series','form_factor','wan_ports','lan_ports','expansion_slots','console_usb','features'].sort();
for(const row of json){
  assert.deepEqual(Object.keys(row).sort(),keys);
  const lab=createLab(),previous={...lab.b};
  selectRouterModel(lab.a,row.model);
  assert.deepEqual(lab.b,previous);
  assert.equal(lab.a.routerModel,row.model);
  const profile=modelProfile(row.model),ports=ROUTER_PORTS[row.model];
  assert(/^https:\/\/(?:www\.)?(?:cisco\.com|documentation\.meraki\.com)\//.test(profile.source_url),row.model);
  if(ports.wan.length&&ports.lan.length){assert.notEqual(lab.a.wan,lab.a.lan);assert.deepEqual(validateModelPorts(lab.a),[]);}
  const available=portOptions('ios',row.model,'wan',lab.a.lan);
  assert(available.every(p=>p.value!==lab.a.lan));
  assert(available.every(p=>ROUTER_PORTS[row.model].wan.some(port=>port.value===p.value)));
  const result=composeDevice({lab,side:'a',role:'router',bindings:true});
  if(!profile.cli_supported){
    assert(modelGenerationError(lab.a));assert(result.errors.length>0);assert.equal(result.code,'');
    continue;
  }
  assert.deepEqual(result.errors,[],row.model);
  assert(result.code.includes('interface '+lab.a.wan));
  if(switchedLan(lab.a)){
    assert(result.code.includes('interface Vlan10'));
    assert(result.code.includes('switchport access vlan 10'));
    assert(!result.code.includes('interface '+lab.a.lan+'\n ip address'));
    lab.a.vlan2Enabled='on';
    const dual=composeDevice({lab,side:'a',role:'router',bindings:true});
    assert.deepEqual(dual.errors,[]);
    assert(dual.code.includes('interface Vlan20'));
    assert(dual.code.includes('switchport trunk allowed vlan 10,20'));
    assert(!dual.code.includes('encapsulation dot1Q'));
    lab.a.vlan2Enabled='off';
    const office=composeDevice({lab,side:'a',role:'router',selected:{internet_access:true},values:{internet_access:{...featureDefaults('internet_access','ios'),standardOffice:true,parts:{firewall:false}}}});
    assert.deepEqual(office.errors,[],row.model);
    assert(office.code.includes('interface Vlan10'));
    assert(!office.code.includes('interface Vlan0'));
  }
  lab.a.wan='HundredGigE99/99';
  assert(validateModelPorts(lab.a).length);
  assert(composeDevice({lab,side:'a',role:'router',bindings:true}).errors.length);
  selectRouterModel(lab.a,'');
  assert.deepEqual(validateModelPorts(lab.a),[]);
}
assert.equal(modelPortOptions('Cisco ISR 4321','wan').length,2);
assert.equal(modelPortOptions('Cisco ISR 4331','wan').length,3);
assert.equal(modelPortOptions('Cisco C8300-2N2S-4T2X','wan').filter(p=>p.speed==='10 Gbps').length,2);
const site=createLab().a;selectRouterModel(site,'Cisco C1101-4P');
assert(modelLanConfig(site,'interface GigabitEthernet9/0.100\n encapsulation dot1Q 100\n exit\n').includes('encapsulation dot1Q 100'));
console.log('Router models: catalog schema, port roles/counts, exclusions, side isolation, invalid bindings, routed CLI, integrated LAN SVI, dual VLAN and Office configuration passed.');
