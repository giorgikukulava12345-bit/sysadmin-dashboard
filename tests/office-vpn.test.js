import {prepareOfficeVpnPair} from '../static/vpn/office-vpn.js';
import assert from 'node:assert/strict';
import {createLab} from '../static/vpn/lab.js';
import {DEFAULTS} from '../static/vpn/engine.js';
import {composeDevice} from '../static/vpn/compose.js';
import {selectRouterModel} from '../static/vpn/router-models.js';
import {featureDefaults} from '../static/vpn/features.js';
import {terminalText} from '../static/vpn/cli-export.js';
import {maskSecrets} from '../static/vpn/secret-mask.js';

function fixture(pt=false){
  const lab=createLab(),vpnConfig=structuredClone(DEFAULTS);
  for(const side of ['a','b']){
    lab[side].vendor='ios';lab[side].routerOnly=true;
    selectRouterModel(lab[side],pt?'Cisco 2911 (Packet Tracer)':'Cisco ISR4331-SEC/K9');
    Object.assign(vpnConfig[side],lab[side],{psk:'CombinedVpnFixture_2026'});
  }
  vpnConfig.a.remote=lab.b.local;vpnConfig.b.remote=lab.a.local;
  const vpnType=pt?'ikev1':'ikev2';vpnConfig.protocol=vpnType;
  return {lab,vpnConfig,vpnType,side:'a',role:'router',selected:{internet_access:true,vpn:true,ntp_syslog:true},values:{internet_access:{...featureDefaults('internet_access','ios'),standardOffice:true,officeVpn:true,parts:{firewall:false}},ntp_syslog:{ntp:'129.250.35.251'}}};
}
const good=input=>{const r=composeDevice(input);assert.deepEqual(r.errors,[],r.errors.join(' '));assert(r.code);return r.code;};
const bad=input=>{const r=composeDevice(input);assert(r.errors.length);assert.equal(r.code,'');return r.errors.join(' ');};
for(const pt of [false,true])for(const side of ['a','b']){
  const input=fixture(pt);input.side=side;
  const site=input.lab[side],peer=input.lab[side==='a'?'b':'a'],code=good(input);
  const local=site.local.split('/')[0],remote=peer.local.split('/')[0];
  const deny=`10 deny ip ${local} 0.0.0.255 ${remote} 0.0.0.255`;
  const permit=`20 permit ip ${local} 0.0.0.255 any`;
  assert(code.indexOf(deny)>=0&&code.indexOf(deny)<code.indexOf(permit));
  assert(code.includes(`permit ip ${local} 0.0.0.255 ${remote} 0.0.0.255`));
  assert(code.includes(`ip route ${remote} 255.255.255.0 ${site.gateway}`));
  assert.equal(code.match(/ip route 0\.0\.0\.0 0\.0\.0\.0 /g).length,1);
  assert(code.includes(`no ip nat inside source list NAT interface ${site.wan} overload`));
  assert(!code.includes(`\nip nat inside source list NAT interface ${site.wan} overload`));
  assert(code.includes(`interface ${site.wan}\n crypto map NOC-MAP`));
  assert(code.includes('ntp server 129.250.35.251'));
  assert(code.includes('ip dhcp excluded-address '+site.lanIp+' '+local.replace(/\.0$/,'.100')));
  assert(!code.includes('zone-member security'));
  assert(!maskSecrets(code).includes('CombinedVpnFixture_2026'));
  const exported=terminalText(code,{vendor:'ios',model:site.routerModel});
  assert(exported.endsWith('\r\n'));assert(!/(?<!\r)\n/.test(exported));
  if(pt){
    assert(code.includes('hash sha\n'));assert(code.includes('group 5\n'));assert(code.includes('set pfs group5'));
    assert(!code.includes('crypto ikev2'));assert(!code.includes('sha256'));
    assert(code.includes(`ip nat inside source list OFFICE-VPN-NAT interface ${site.wan} overload`));
  }else{
    assert(code.includes('crypto ikev2 proposal'));assert(code.includes('integrity sha256'));
    assert(code.includes(`ip nat inside source route-map OFFICE-VPN-PAT interface ${site.wan} overload`));
  }
}
{
  const input=fixture();input.vpnType='ikev1';assert(good(input).includes('hash sha256'));
  delete input.values.internet_access.officeVpn;assert(bad(input).includes('Quick Setup + VPN'));
}
for(const mutate of [
  x=>x.vpnConfig.a.psk='',x=>x.vpnConfig.b.psk='Different',x=>x.vpnConfig.a.psk='bad\nend',
  x=>x.vpnConfig.a.local='172.16.1.0/24',x=>x.vpnConfig.a.remote='172.16.2.0/24',
  x=>x.lab.b.vendor='fortinet',x=>x.lab.a.vlan2Enabled='on',x=>x.vpnType='gre',
  x=>x.values.internet_access.parts.firewall=true,x=>x.values.internet_access.parts.nat=false,
  x=>x.values.internet_access.parts.interfaces=false,x=>x.values.internet_access.parts.route=false,
  x=>x.selected.nat=true,x=>x.selected.wan_failover=true,
  x=>selectRouterModel(x.lab.b,'Cisco 2911 (Packet Tracer)'),
  x=>{x.lab.b.local=x.lab.a.local;x.vpnConfig.b.local=x.lab.a.local;x.vpnConfig.a.remote=x.lab.a.local;}
]){const input=fixture();mutate(input);bad(input);}
{
  const input=fixture(true);input.vpnType='ikev2';bad(input);
}
{
  const input=fixture();for(const side of ['a','b']){selectRouterModel(input.lab[side],'Cisco C921-4P');Object.assign(input.vpnConfig[side],input.lab[side]);}
  const code=good(input);assert(code.includes('interface Vlan10'));assert(code.includes('switchport access vlan 10'));
  assert(!code.includes('interface '+input.lab.a.lan+'\n ip address'));
}
{
  const input=fixture();input.selected.vpn=false;delete input.values.internet_access.officeVpn;
  const code=good(input);assert(!code.includes('crypto map'));assert(!code.includes('OFFICE-VPN-NAT'));
  assert(code.includes('ip nat inside source list NAT interface'));
}
console.log('Combined Office + VPN: paired hardware and Packet Tracer CLI, NAT exemption order, peer routes, owned PAT replacement, masking, atomic failures and unchanged ordinary preset passed.');

// Default Side B is FortiGate: a single preset click must prepare the Cisco pair.
for(const pt of [false,true]){
  const lab=createLab();lab.a.vendor='ios';selectRouterModel(lab.a,pt?'Cisco 2911 (Packet Tracer)':'Cisco ISR4331-SEC/K9');
  const before=structuredClone(lab.b);lab.b.psk='KeepFixtureKey';
  assert(prepareOfficeVpnPair(lab,'a'));
  assert.equal(lab.b.vendor,'ios');assert.equal(lab.b.routerModel,lab.a.routerModel);
  for(const field of ['ip','local','lanIp','gateway','wanPrefix'])assert.equal(lab.b[field],before[field]);
  assert.equal(lab.b.psk,'KeepFixtureKey');assert.notEqual(lab.b.wan,lab.b.lan);
}
{
  const input=fixture();const before=structuredClone(input.lab.b);prepareOfficeVpnPair(input.lab,'a');assert.deepEqual(input.lab.b,before);
  input.lab.a.vendor='mikrotik';const snapshot=structuredClone(input.lab);assert.equal(prepareOfficeVpnPair(input.lab,'a'),false);assert.deepEqual(input.lab,snapshot);
}

// Packet Tracer defines transform-sets in global config (no transform submode).
// Reproduce its relevant mode transitions across the whole exported script.
for(const side of ['a','b']){
  const input=fixture(true);input.side=side;
  const text=terminalText(good(input),{vendor:'ios',model:input.lab[side].routerModel});
  let mode='exec';const reached=new Set();
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();if(!line||line.startsWith('!'))continue;
    if(line==='configure terminal'){assert.equal(mode,'exec');mode='config';continue;}
    if(line==='end'){assert.notEqual(mode,'exec');mode='exec';continue;}
    if(line==='exit'){assert.notEqual(mode,'exec','Unexpected exit logs out of EXEC');mode=mode==='config'?'exec':'config';continue;}
    assert.notEqual(mode,'exec','Configuration command escaped to EXEC: '+line);
    if(/^crypto ipsec transform-set /.test(line)){assert.equal(mode,'config');reached.add('transform');continue;}
    if(/^ip access-list extended NOC-CRYPTO/.test(line)){assert.equal(mode,'config');mode='acl';reached.add('acl');continue;}
    if(/^crypto map NOC-MAP 100 /.test(line)){assert.equal(mode,'config');mode='map';reached.add('map');continue;}
    if(/^ip route 192\.168\.1\.0|^ip route 10\.20\.0\.0/.test(line)){assert.equal(mode,'config');reached.add('peer-route');continue;}
    if(/^interface /.test(line)){assert.equal(mode,'config');mode='interface';continue;}
    if(line==='crypto map NOC-MAP'){assert.equal(mode,'interface');reached.add('wan-map');continue;}
    if(/^ip dhcp pool |^ip access-list extended |^crypto isakmp policy /.test(line)){assert.equal(mode,'config');mode='submode';}
  }
  assert.equal(mode,'exec');assert.deepEqual([...reached].sort(),['transform','acl','map','wan-map','peer-route'].sort());
}
