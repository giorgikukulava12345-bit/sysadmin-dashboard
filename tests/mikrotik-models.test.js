import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MIKROTIK_CATALOG,mikrotikModel} from '../static/vpn/mikrotik-models.js';
import {selectRouterModel,validateModelPorts,modelGenerationError} from '../static/vpn/router-models.js';
import {selectSwitchModel,validateSwitchPorts} from '../static/vpn/switch-models.js';
import {portOptions} from '../static/vpn/port-options.js';
import {createLab} from '../static/vpn/lab.js';
import {composeDevice} from '../static/vpn/compose.js';
const source=JSON.parse(fs.readFileSync(new URL('../data/mikrotik-models.json',import.meta.url)));
assert.equal(MIKROTIK_CATALOG.length,source.length);assert(MIKROTIK_CATALOG.length>=150);
assert.equal(new Set(MIKROTIK_CATALOG.map(r=>r.model)).size,source.length);
for(const row of MIKROTIK_CATALOG){
 assert(row.source_url.startsWith('https://mikrotik.com/product/'));
 for(const key of ['model','series','form_factor'])assert.equal(typeof row[key],'string');
 for(const key of ['wan_ports','lan_ports','expansion_slots','console_usb','features'])assert(Array.isArray(row[key]));
 assert.equal(new Set(row.ports.map(p=>p.value)).size,row.ports.length,row.model);
 const lab=createLab(),peer=structuredClone(lab.b),role=row.device_type;
 lab.a[role==='router'?'vendor':'switchVendor']='mikrotik';
 (role==='router'?selectRouterModel:selectSwitchModel)(lab.a,row.model);assert.deepEqual(lab.b,peer);
 const output=composeDevice({lab,side:'a',role,bindings:true});
 if(!row.cli_supported){assert(output.errors.length,row.model);continue;}
 assert.deepEqual((role==='router'?validateModelPorts:validateSwitchPorts)(lab.a),[],row.model);
 assert.deepEqual(output.errors,[],row.model);assert(output.code.includes('/'),row.model);
 const key=role==='router'?'wan':'uplink',exclude=lab.a[key];
 assert(!portOptions('mikrotik',row.model,role==='router'?'lan':'access',exclude).some(p=>p.value===exclude));
 lab.a[key]='ether999';assert((role==='router'?validateModelPorts:validateSwitchPorts)(lab.a).length,row.model);
}
assert.equal(mikrotikModel('MikroTik RB5009UG+S+IN').ports[0].speed,'2.5 Gbps');
assert.equal(mikrotikModel('MikroTik hEX S (2025)').ports.at(-1).speed,'2.5 Gbps');
assert.equal(mikrotikModel('MikroTik CCR2116-12G-4S+').ports.length,17);
assert.equal(mikrotikModel('MikroTik CCR2004-1G-12S+2XS').ports.length,15);
assert.equal(mikrotikModel('MikroTik CRS326-24G-2S+RM').ports.length,26);
assert(!mikrotikModel('MikroTik CSS326-24G-2S+RM').cli_supported);
assert(!MIKROTIK_CATALOG.some(r=>r.model==='MikroTik RB1200'));
assert.equal(modelGenerationError({...createLab().a,vendor:'mikrotik',routerModel:''}),'');
console.log('MikroTik: official-source schema, unique ports, defaults, side isolation, all CLI profiles, inventory-only gates and exact model port counts passed.');
