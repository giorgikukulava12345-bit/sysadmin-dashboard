import assert from 'node:assert/strict';
import {CISCO_SWITCHES,selectSwitchModel,validateSwitchPorts} from '../static/vpn/switch-models.js';
import {portOptions} from '../static/vpn/port-options.js';
import {createLab,labScripts} from '../static/vpn/lab.js';
for(const model of CISCO_SWITCHES){
 const lab=createLab(),peer=structuredClone(lab.b);selectSwitchModel(lab.a,model);
 assert.deepEqual(lab.b,peer);assert.equal(lab.a.access,'FastEthernet0/1');assert.equal(lab.a.uplink,'GigabitEthernet0/1');
 const ports=portOptions('ios',model,'access');assert.equal(ports.length,26);assert.equal(ports.filter(p=>p.value.startsWith('FastEthernet')).length,24);
 assert(!portOptions('ios',model,'access',lab.a.uplink).some(p=>p.value===lab.a.uplink));
 assert.deepEqual(validateSwitchPorts(lab.a),[]);
 const result=labScripts(lab,{sides:['a']});assert.deepEqual(result.errors,[]);assert(result.scripts[1].code.includes('interface FastEthernet0/1'));
 lab.a.access='GigabitEthernet0/24';assert(labScripts(lab,{sides:['a']}).errors.length);
 lab.a.access='FastEthernet0/1';lab.a.vlan2Enabled='on';assert.deepEqual(validateSwitchPorts(lab.a),[]);lab.a.vlan2Access='FastEthernet0/25';assert(validateSwitchPorts(lab.a).length);
 selectSwitchModel(lab.a,'');assert.equal(lab.a.switchModel,'');
}
console.log('Switch models: 2960 port counts, defaults, exclusion, side isolation, CLI and invalid physical ports passed.');
