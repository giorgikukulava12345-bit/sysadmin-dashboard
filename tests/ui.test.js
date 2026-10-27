import {FEATURES,capable} from '../static/vpn/features.js';
﻿import { mountVpn } from '../static/vpn/ui.js';
let total=0,passed=0;const failures=[];
function check(name,ok){total++;if(ok)passed++;else failures.push(name);}
const fixture=document.createElement('section'),root=document.createElement('div');fixture.append(root);document.body.append(fixture);
let cleanup=mountVpn(root);const q=s=>fixture.querySelector(s),input=(s,value,event='input')=>{const el=q(s);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event(event,{bubbles:true}));if(s==='[data-vendor]')disableBaseline();},toggle=(id,value)=>{input(`[data-feature="${id}"]`,value,'change');if(id==='ntp_syslog'&&value){input('[data-feature-panel=ntp_syslog] [name=ntp]','192.0.2.123');}},submit=()=>q('[data-generate]').click();
function disableBaseline(){for(const id of ['hardening','ntp_syslog'])if(q(`[data-feature="${id}"]`)?.checked)toggle(id,false);}
function completeBaseline(){for(const id of ['hardening','ntp_syslog']){const box=q(`[data-feature="${id}"]`);if(box&&!box.disabled&&!box.checked)toggle(id,true);}for(const [key,value]of Object.entries({secret:'FixtureSecret_2026',enableSecret:'FixtureEnable_2026',ntp:'198.18.0.123'})){const field=q(`[data-settings] [name="${key}"]`);if(field)input(`[data-settings] [name="${key}"]`,value);}}
// Existing composition regressions explicitly add optional features after the minimal preset.
function officePreset(){
 const wan=q('[data-feature=wan_failover]')?.checked, saved=wan?Object.fromEntries([...fixture.querySelectorAll('[data-feature-panel=wan_failover] [name]')].map(el=>[el.name,el.value])):{};
 q('[data-office-preset]').click();completeBaseline();toggle('zbfw',true);
 if(wan){toggle('wan_failover',true);for(const [key,value]of Object.entries(saved))if(q('[data-feature-panel=wan_failover] [name="'+key+'"]'))input('[data-feature-panel=wan_failover] [name="'+key+'"]',value);}
 q('[data-role=switch]').click();input('[data-include-bindings]',true,'change');q('[data-role=router]').click();submit();
}
check('all feature selections start empty',![...fixture.querySelectorAll('[data-feature]')].some(el=>el.checked));
toggle('ntp_syslog',true);
check('NTP has no Syslog collector field',!q('[data-feature-panel=ntp_syslog] [name=syslog]')&&q('[data-feature-panel=ntp_syslog] summary').textContent==='NTP');
input('[data-feature-panel=ntp_syslog] [name=ntp]','129.250.35.251');toggle('ntp_syslog',false);
q('[data-office-preset]').click();
check('minimal preset has exactly the requested six chips',[...fixture.querySelectorAll('[data-remove-preset]')].map(el=>el.dataset.removePreset).sort().join(',')==='dhcp,dns,interfaces,nat,ntp_syslog,route');
check('minimal preset generates immediately without SSH credentials',!q('[data-copy-config]').disabled&&!q('[data-feature=hardening]').checked&&!q('[data-feature=zbfw]').checked&&!q('[data-feature-panel=hardening]'));
check('minimal preset excludes optional security and switch output',!q('[data-code]').textContent.includes('SSH_NEW')&&!q('[data-code]').textContent.includes('zone security')&&q('[data-office-companion]').hidden&&!q('[data-feature-panel=internet_access] [name=managementSources]').getClientRects().length);
check('minimal preset keeps NTP and Georgia timezone',q('[data-code]').textContent.includes('ntp server 129.250.35.251')&&q('[data-code]').textContent.includes('clock timezone GET 4 0'));
toggle('wan_failover',true);q('[data-office-preset]').click();check('minimal preset clears prior Dual ISP and IP SLA',!q('[data-feature=wan_failover]').checked&&!q('[data-feature=ipsla]').checked);
cleanup();root.replaceChildren();cleanup=mountVpn(root);
check('advanced routing collapsed by default',!q('.noc-advanced-routing').open);
disableBaseline();
input('[data-side="a"][name="ip"]','203.0.113.14');check('/30 peer autofill follows previously suggested gateway',q('[data-side="a"][name="gateway"]').value==='203.0.113.13');input('[data-side="a"][name="gateway"]','203.0.113.9');input('[data-side="a"][name="ip"]','203.0.113.10');check('explicit gateway is preserved',q('[data-side="a"][name="gateway"]').value==='203.0.113.9');
q('[data-node="a.host"]').click();check('node click focuses host form',q('[data-lab-device="a-host"]').contains(document.activeElement));q('[data-role="router"]').click();
toggle('fhrp',true);toggle('glbp',true);check('GLBP clears HSRP/VRRP',!q('[data-feature=fhrp]').checked&&q('[data-feature=glbp]').checked);toggle('fhrp',true);check('HSRP/VRRP clears GLBP',!q('[data-feature=glbp]').checked);toggle('fhrp',false);
toggle('wan_failover',true);check('Cisco failover selects IP SLA',q('[data-feature=ipsla]').checked);submit();check('default route uses generated SLA tracking',q('[data-code]').textContent.includes('1 track 100')&&q('[data-code]').textContent.includes('track 100 ip sla 100 reachability'));check('Download enabled only for valid generated snapshot',!q('[data-download-config]').disabled);toggle('wan_failover',false);check('disabling failover releases linked SLA',!q('[data-feature=ipsla]').checked&&q('[data-download-config]').disabled);
check('address editor is a permanent section',q('[data-addresses]').tagName==='SECTION'&&!q('[data-addresses]>summary'));
check('address fields visible immediately',q('[data-side="a"][name="lanIp"]').getClientRects().length>0);
check('default LAN CIDR is prefilled',q('[aria-label="Side A LAN network CIDR"]').value==='192.168.1.0/24');
check('default router LAN IPv4 is prefilled',q('[aria-label="Side A Router LAN IPv4"]').value==='192.168.1.1');
check('default switch management IPv4 is prefilled',q('[aria-label="Side A Switch management IPv4"]').value==='192.168.1.254');
toggle('dhcp',true);check('DNS is prefilled',q('[data-feature-panel="dhcp"] [name="dns"]').value==='8.8.8.8');submit();check('default DHCP generates with reserved switch IP',q('[data-code]').textContent.includes('dns-server 8.8.8.8')&&q('[data-code]').textContent.includes('ip dhcp excluded-address 192.168.1.254'));toggle('dhcp',false);
check('vendor-first selector has five vendors',q('[data-vendor]').options.length===5);
check('router has six categorized sections',fixture.querySelectorAll('[data-category]').length===6);

check('standard topology is single-site by default',q('[data-diagram]').dataset.multi==='false');
check('single-site hides remote physical nodes',q('[data-node="b.router"]').hidden);
toggle('vpn',true);check('VPN selection enables dual-site topology',q('[data-diagram]').dataset.multi==='true'&&!q('[data-node="b.router"]').hidden);toggle('vpn',false);check('unchecking VPN restores single-site topology',q('[data-diagram]').dataset.multi==='false');
input('[data-side]','b','change');check('single-site can show site B alone',q('[data-node="a.router"]').hidden&&!q('[data-node="b.router"]').hidden);input('[data-side]','a','change');
for(const id of ['dmvpn','automation','multicast','glbp'])check('expanded '+id+' checkbox present and interactive',!!q('[data-feature="'+id+'"]')&&!q('[data-feature="'+id+'"]').disabled);
check('simplified workbench omits troubleshooting playbooks',!q('[data-playbook]')&&!q('[data-scenario]'));
check('simplified workbench omits debug and diagnostic controls',!q('[data-debug-panel]')&&!q('[data-copy-diagnostics]'));
check('simplified workbench omits running configuration analyzer',!q('[data-analyzer-input]')&&!q('[data-analyze]'));

toggle('static',true);submit();check('CLI syntax highlighting retains address content',q('[data-code] .cli-address')?.textContent==='192.168.20.0');toggle('static',false);

check('no parameter forms until checked',!q('[data-feature-panel]'));
check('prominent Submit present',q('[data-generate]').textContent==='Submit / Generate Configuration');
check('nothing copied before submit',q('[data-copy-config]').disabled);
toggle('nat',true);check('only selected parameters shown',!!q('[data-feature-panel="nat"]')&&!q('[data-feature-panel="acl"]'));check('checking does not generate CLI',q('[data-copy-config]').disabled);submit();check('submit generates PAT',q('[data-code]').textContent.includes('ip nat inside source list'));

const submittedNat=q('[data-code]').textContent;root.querySelector('#vpn-reveal').dispatchEvent(new Event('change',{bubbles:true}));check('unchanged VPN broadcasts do not discard submitted NAT',q('[data-code]').textContent===submittedNat&&!q('[data-copy-config]').disabled);
const originalVendors=FEATURES.nat.vendors;FEATURES.nat.vendors=null;submit();check('unexpected generation errors become visible and never leave draft text',q('[data-generation-status]').dataset.state==='error'&&q('[data-errors]').textContent.includes('Generation failed')&&!q('[data-code]').textContent.includes('Draft changed'));FEATURES.nat.vendors=originalVendors;submit();check('generation recovers after an error',!q('[data-copy-config]').disabled);

input('[data-feature-panel="nat"] [name="natMode"]','static');check('changing parameters invalidates previous CLI',q('[data-copy-config]').disabled&&!q('[data-code]').textContent.includes('ip nat inside source list'));input('[data-feature-panel="nat"] [name="publicHost"]','203.0.113.30');submit();check('static NAT submits',q('[data-code]').textContent.includes('ip nat inside source static'));
input('[data-feature-panel="nat"] [name="natMode"]','dynamic');input('[data-feature-panel="nat"] [name="poolStart"]','203.0.113.100');input('[data-feature-panel="nat"] [name="poolEnd"]','203.0.113.110');submit();check('dynamic pool submits without overload',q('[data-code]').textContent.includes('ip nat pool NOC-POOL')&&!q('[data-code]').textContent.includes('overload'));
toggle('nat',false);submit();check('unchecking removes generated feature',q('[data-copy-config]').disabled);

for(const[id,expected]of Object.entries({portforward:'ip nat inside source static tcp',gre_tunnel:'tunnel mode gre ip',vxlan:'bridge-domain 100',bfd:'bfd interval',ipsla:'ip sla schedule',isis:'ip router isis',copp:'policy-map NOC-COPP',urpf:'ip verify unicast source reachable-via'})){
  toggle(id,true);submit();check('Submit renders '+id+' CLI',q('[data-code]').textContent.includes(expected)&&!q('[data-copy-config]').disabled);q('[data-clear-output]').click();check('Clear invalidates '+id+' output but preserves selection',q('[data-copy-config]').disabled&&q('[data-feature="'+id+'"]').checked&&q('[data-code]').textContent.includes('Output cleared'));submit();check('resubmit after Clear renders '+id, q('[data-code]').textContent.includes(expected));toggle(id,false);
}
toggle('portforward',true);input('[data-feature-panel="portforward"] [name="internalPort"]','8080');q('[data-feature-panel="portforward"] [name="internalPort"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));check('Enter submits feature inputs to the output panel',q('[data-code]').textContent.includes('192.168.1.10 8080 interface'));input('[data-feature-panel="portforward"] [name="externalPort"]','0');submit();check('invalid ports show validation instead of draft placeholder',q('[data-errors]').textContent.includes('External port')&&!q('[data-code]').textContent.includes('Draft changed'));toggle('portforward',false);submit();check('empty Submit has an explicit empty state',q('[data-generation-status]').dataset.state==='empty'&&q('[data-copy-config]').disabled);

toggle('ntp_syslog',true);submit();check('infrastructure CLI emitted',q('[data-code]').textContent.includes('ntp server 192.0.2.123'));
input('[data-side]','b','change');check('context change invalidates old output',q('[data-copy-config]').disabled);input('[data-side]','a','change');check('selection persists per device',q('[data-feature="ntp_syslog"]').checked);
for(const vendor of ['ios','mikrotik','fortinet','juniper','paloalto']){
 input('[data-vendor]',vendor,'change');check(vendor+' capabilities reflected in disabled controls',[...fixture.querySelectorAll('[data-feature]')].every(el=>el.disabled===!capable(el.dataset.feature,vendor)));
 toggle('static6',true);submit();check(vendor+' IPv6 static CLI',!q('[data-copy-config]').disabled&&q('[data-code]').textContent.includes('2001:db8:20::/64'));toggle('static6',false);
 toggle('ntp_syslog',true);submit();check(vendor+' NTP CLI',!q('[data-copy-config]').disabled);toggle('ntp_syslog',false);
 toggle('eigrp',true);check(vendor+' EIGRP capability state',vendor==='ios'?q('[data-feature="eigrp"]').checked:q('[data-feature="eigrp"]').disabled);submit();check(vendor+' supported or empty unavailable output',vendor==='ios'?!q('[data-copy-config]').disabled:q('[data-copy-config]').disabled);toggle('eigrp',false);
}
input('[data-vendor]','ios','change');q('[data-role="switch"]').click();check('switch has L2 category',!!q('[data-category="switching"]'));for(const id of ['vlan','stp','etherchannel','security','snooping','pvlan'])check('switch includes '+id,!!q(`[data-feature="${id}"]`));
toggle('stp',true);input('[data-feature-panel="stp"] [name="mode"]','mst');submit();check('MST configuration generated',q('[data-code]').textContent.includes('spanning-tree mst configuration'));toggle('stp',false);
toggle('etherchannel',true);input('[data-feature-panel="etherchannel"] [name="protocol"]','pagp');submit();check('Cisco PAgP desirable mode',q('[data-code]').textContent.includes('mode desirable'));toggle('etherchannel',false);
toggle('pvlan',true);submit();check('PVLAN host/promiscuous generated',q('[data-code]').textContent.includes('private-vlan promiscuous'));toggle('pvlan',false);
input('[data-vendor]','paloalto','change');check('unsupported L2 options reflect vendor capability',[...fixture.querySelectorAll('[data-feature]')].every(el=>el.disabled===!capable(el.dataset.feature,'paloalto')));toggle('pvlan',true);submit();check('unsupported selection produces zero partial CLI',q('[data-copy-config]').disabled&&!q('[data-code]').textContent.includes('private-vlan promiscuous'));toggle('pvlan',false);
q('[data-role="router"]').click();input('[data-vendor]','ios','change');toggle('ospf_advanced',true);input('[data-feature-panel="ospf_advanced"] [name="authSecret"]','ExampleAuth_ChangeMe2026');submit();check('secret output retains CLI with masked value',q('[data-code]').textContent.includes('key-string ***')&&q('[data-code]').textContent.includes('router ospf')&&!q('[data-code]').textContent.includes('ExampleAuth_ChangeMe2026'));input('[data-reveal]',true,'change');check('reveal does not invalidate submit',!q('[data-copy-config]').disabled&&q('[data-code]').textContent.includes('ExampleAuth_ChangeMe2026'));input('[data-reveal]',false,'change');check('unchecking reveal masks only credentials',q('[data-code]').textContent.includes('key-string ***')&&q('[data-code]').textContent.includes('router ospf')&&!q('[data-code]').textContent.includes('ExampleAuth_ChangeMe2026'));q('[data-clear-secrets]').click();check('clear invalidates secret configuration',q('[data-copy-config]').disabled&&q('[data-feature-panel="ospf_advanced"] [name="authSecret"]').value==='');
toggle('ospf_advanced',false);toggle('vpn',true);q('[data-action="key"]').click();submit();check('site-to-site VPN still generates',!q('[data-copy-config]').disabled);check('VPN menu limited to site-to-site families',q('[aria-label="VPN technology"]').options.length===5);toggle('vpn',false);
input('[data-vendor]','mikrotik','change');toggle('remotevpn',true);input('[data-feature-panel="remotevpn"] [name="server"]','edge-vpn.example.org');input('[data-feature-panel="remotevpn"] [name="username"]','nocadmin');input('[data-feature-panel="remotevpn"] [name="password"]','ExampleOnly_ChangeMe26');submit();check('dedicated remote-access feature generates',!q('[data-copy-config]').disabled);
q('[data-role="host"]').click();submit();check('host generation uses same Submit flow',q('[data-code]').textContent.includes('ip route replace default'));
cleanup();check('cleanup restores original mount host',!q('.noc-composer')&&root.parentElement===fixture);cleanup=mountVpn(root);disableBaseline();check('remount creates one workbench',fixture.querySelectorAll('.noc-composer').length===1);check('WAN prefix offers /24 through /30 with /30 default',q('[data-side="a"][name="wanPrefix"]').value==='30'&&[...q('[data-side="a"][name="wanPrefix"]').options].map(o=>o.value).join(',')==='24,25,26,27,28,29,30');
q('[data-role="router"]').click();input('[data-include-bindings]',true,'change');submit();check('WAN30 produces usable interface CLI',q('[data-code]').textContent.includes('203.0.113.10 255.255.255.252'));
input('[data-side="a"][name="gateway"]','203.0.113.10');submit();check('same WAN and gateway blocks CLI',q('[data-copy-config]').disabled&&q('[data-errors]').textContent.includes('different usable host'));
input('[data-side="a"][name="gateway"]','203.0.113.9');submit();check('restoring valid30 pair recovers output',!q('[data-copy-config]').disabled);
for(const [prefix,mask]of [['24','255.255.255.0'],['25','255.255.255.128'],['26','255.255.255.192'],['27','255.255.255.224'],['28','255.255.255.240'],['29','255.255.255.248'],['30','255.255.255.252']]){
 input('[data-side="a"][name="wanPrefix"]',prefix);check('changing WAN prefix invalidates output '+prefix,q('[data-copy-config]').disabled);submit();check('WAN /'+prefix+' generates the selected mask',!q('[data-copy-config]').disabled&&q('[data-code]').textContent.includes('203.0.113.10 '+mask));
}
input('[data-side="a"][name="wanPrefix"]','24');input('[data-side="a"][name="ip"]','203.0.113.200');check('larger WAN preserves the assigned ISP gateway',q('[data-side="a"][name="gateway"]').value==='203.0.113.9');submit();check('WAN24 accepts usable addresses outside the old /30',!q('[data-copy-config]').disabled&&q('[data-code]').textContent.includes('203.0.113.200 255.255.255.0'));
input('[data-side="a"][name="ip"]','203.0.113.10');input('[data-side="a"][name="wanPrefix"]','30');submit();
check('secondary VLAN editor and shortcut are absent',!q('[name=vlan2Enabled]')&&!q('[name=vlan2Subnet]')&&!q('[data-edit-vlans]'));
check('primary LAN VLAN remains editable',q('[data-side="a"][name=vlan]').value==='10');

check('fixed-address repair examples removed',!q('[data-repair]'));
toggle('dhcp',true);input('[data-feature-panel="dhcp"] [name="leaseMinutes"]','1950');submit();check('DHCP lease UI reaches CLI',q('[data-code]').textContent.includes('lease 1 8 30'));toggle('dhcp',false);
input('[data-vendor]','paloalto','change');toggle('static',true);input('[data-feature-panel="static"] [name="virtualRouter"]','CORP-VR');input('[data-feature-panel="static"] [name="routeName"]','BRANCH-ROUTE');submit();check('PAN route context UI reaches CLI',q('[data-code]').textContent.includes('virtual-router CORP-VR')&&q('[data-code]').textContent.includes('static-route BRANCH-ROUTE'));

input('[data-vendor]','ios','change');toggle('wan_failover',true);officePreset();check('Cisco ACL-only dual-WAN PAT is rejected clearly',q('[data-errors]').textContent.includes('egress paths')&&q('[data-copy-config]').disabled);toggle('wan_failover',false);submit();check('Cisco office preset recovers without WAN2',!q('[data-copy-config]').disabled&&q('[data-code]').textContent.includes('ip dhcp pool USERS')&&!q('[data-code]').textContent.includes('ip dhcp pool IT'));
check('router output excludes switch VLAN and port commands',q('[data-feature-panel=internet_access] [name=iosLanMode]').closest('label').hidden&&!/switchport |^vlan |interface Vlan/m.test(q('[data-code]').textContent));
check('office timezone defaults to Georgia',q('[data-feature-panel=internet_access] [name=timezoneName]').value==='GET'&&q('[data-feature-panel=internet_access] [name=timezoneHours]').value==='4'&&q('[data-feature-panel=internet_access] [name=timezoneMinutes]').value==='0'&&q('[data-code]').textContent.includes('clock timezone GET 4 0'));
check('separate router and switch output headings',q('[data-output-heading]').textContent==='ROUTER CONFIGURATION'&&q('[data-office-companion] h3').textContent==='SWITCH CONFIGURATION');
check('switch output contains commands without generated section headings',q('[data-companion-code]').textContent.includes('switchport access vlan 10')&&!q('[data-companion-code]').textContent.includes('===')&&q('[data-companion-code]').textContent.split('\n').find(line=>line.trim()&&!line.trim().startsWith('!'))==='configure terminal');
check('Cisco Office includes SSH ACL on all VTY lines',q('[data-code]').textContent.includes('line vty 5 15')&&q('[data-code]').textContent.includes('access-class SSH_NEW in'));
submit();
check('Cisco Office routed mode uses a single untagged LAN',!q('[data-copy-config]').disabled&&!q('[data-code]').textContent.includes('encapsulation dot1Q')&&!q('[data-code]').textContent.includes('interface Vlan10')&&q('[data-code]').textContent.includes('ip access-list extended NAT')&&!q('[data-code]').textContent.includes('NAT112'));
input('[data-feature-panel=internet_access] [name=managementSources]','10.50.0.0/24');input('[data-feature-panel=internet_access] [name=timezoneName]','GET');input('[data-feature-panel=internet_access] [name=timezoneHours]','4');submit();
check('Cisco Office SSH sources and timezone are editable',q('[data-code]').textContent.includes('permit tcp 10.50.0.0 0.0.0.255 any eq 22')&&q('[data-code]').textContent.includes('clock timezone GET 4 0'));
for(const vendor of ['mikrotik','fortinet','juniper','paloalto']){
 input('[data-vendor]',vendor,'change');toggle('wan_failover',true);
 check(vendor+' WAN2 settings appear',!!q('[data-feature-panel="wan_failover"] [name="ip2"]'));
 input('[data-feature-panel="wan_failover"] [name="ip2"]','198.18.60.6');input('[data-feature-panel="wan_failover"] [name="gateway2"]','198.18.60.5');
 officePreset();
 check(vendor+' preset selects Internet Gateway',q('[data-feature="internet_access"]').checked);
 for(const id of ['static','nat','zbfw','dhcp'])check(vendor+' preset highlights '+id,q('[data-feature="'+id+'"]').checked&&q('[data-feature="'+id+'"]').closest('label').dataset.presetManaged==='true');
 check(vendor+' preset banner summarizes active components',!q('[data-preset-banner]').hidden&&q('[data-preset-components]').textContent.includes('Interface NAT / PAT')&&q('[data-preset-heading]').textContent.includes('Configuration ready'));
 check(vendor+' included cards do not duplicate routes',!q('[data-feature-panel="static"]')&&!q('[data-feature-panel="nat"]')); 
 check(vendor+' preset includes DHCP and DNS badges',q('[data-preset-components]').textContent.includes('DHCP')&&q('[data-preset-components]').textContent.includes('DNS'));
 check(vendor+' preset uses only the primary LAN VLAN',q('[data-code]').textContent.includes('192.168.1.1')&&!q('[data-code]').textContent.includes('172.16.19.')&&q('[data-code]').textContent.includes('1.1.1.1')&&q('[data-companion-code]').textContent.includes('switchport access vlan 10')&&!q('[data-companion-code]').textContent.includes('allowed vlan 10,20'));
 check(vendor+' preset preserves Dual ISP',q('[data-feature="wan_failover"]').checked);
 check(vendor+' preset immediately generates router CLI',!q('[data-copy-config]').disabled&&q('[data-code]').textContent.includes('198.18.60.6'));
 check(vendor+' interface bindings automatic',q('[data-include-bindings]').checked&&q('[data-include-bindings]').disabled);
 check(vendor+' switch script separate and visible',!q('[data-office-companion]').hidden&&q('[data-companion-code]').textContent.includes('ip default-gateway 192.168.1.1'));
 check(vendor+' topology shows secondary ISP',q('[data-wan-a]').textContent.includes('198.18.60.5'));
 toggle('wan_failover',false);submit();check(vendor+' unchecking WAN2 removes backup',!q('[data-code]').textContent.includes('198.18.60.6')&&!q('[data-wan-a]').textContent.includes('BACKUP'));
}
toggle('nat',false);check('unchecking included card customizes only that component',!q('[data-feature="nat"]').checked&&q('[data-feature="static"]').checked&&q('[data-preset-heading]').textContent.startsWith('Custom configuration'));
 toggle('internet_access',false);
cleanup();root.replaceChildren();cleanup=mountVpn(root);
officePreset();input('[data-vendor]','mikrotik','change');q('[data-role="switch"]').click();
check('switch included cards clear after router vendor reset',!q('[data-feature="vlan"]').checked&&q('[data-feature="vlan"]').closest('label').dataset.presetManaged==='false');
q('[data-role="router"]').click();input('[data-side]','b','change');input('[data-side="b"][name="ip"]','invalid');input('[data-side]','a','change');toggle('nat',true);submit();
check('invalid hidden peer does not block single-site output',!q('[data-copy-config]').disabled&&!q('[data-errors]').textContent.includes('Side B'));
input('[data-side]','b','change');input('[data-side="b"][name="ip"]','198.51.100.22');input('[data-side]','a','change');input('[data-vendor]','juniper','change');officePreset();toggle('nat',false);toggle('ospf',true);
check('Junos OSPF form uses primary logical interface',q('[data-feature-panel="ospf"] [name="ospfInterfaces"]').value.endsWith('.0'));submit();
check('Junos OSPF generates current interface',!q('[data-copy-config]').disabled&&q('[data-code]').textContent.includes('interface ge-0/0/1.0'));
input('[data-side="a"][name="lan"]','ge-0/0/3');check('topology port edit updates contextual OSPF form',q('[data-feature-panel="ospf"] [name="ospfInterfaces"]').value==='ge-0/0/3.0');submit();check('topology port edit reaches generated OSPF CLI',q('[data-code]').textContent.includes('interface ge-0/0/3.0')&&!q('[data-code]').textContent.includes('interface ge-0/0/1.0'));
cleanup();root.replaceChildren();cleanup=mountVpn(root);officePreset();q('[data-role="switch"]').click();toggle('snmp3',true);input('[data-feature-panel="snmp3"] [name="authSecret"]','AuditAuth_0123456789');input('[data-feature-panel="snmp3"] [name="privSecret"]','AuditPriv_0123456789');q('[data-role="router"]').click();submit();
check('companion switch credentials are masked by default',!q('[data-office-companion]').hidden&&!q('[data-companion-code]').textContent.includes('AuditAuth_0123456789')&&q('[data-companion-code]').textContent.includes('auth sha ***'));
check('companion-only secrets expose the shared reveal control',!q('[data-reveal-label]').hidden);input('[data-reveal]',true,'change');check('shared reveal control reveals companion credentials',q('[data-companion-code]').textContent.includes('AuditAuth_0123456789'));input('[data-reveal]',false,'change');q('[data-clear-secrets]').click();check('clearing companion secrets invalidates both outputs',q('[data-copy-config]').disabled&&q('[data-office-companion]').hidden);

cleanup();root.replaceChildren();cleanup=mountVpn(root);
for(const key of ['nat','route','hardening','ntp_syslog','dhcp','dns','interfaces','switch']){
 officePreset();const chip=q(`[data-remove-preset="${key}"]`);check(key+' preset chip is an accessible button',chip?.tagName==='BUTTON'&&chip.getAttribute('aria-label').startsWith('Remove '));chip.click();
 check(key+' chip exits preset mode',q('[data-preset-heading]').textContent.startsWith('Custom configuration'));
 check(key+' chip removal invalidates Copy and Download',q('[data-copy-config]').disabled&&q('[data-download-config]').disabled);
 check(key+' removed chip disappears',!q(`[data-remove-preset="${key}"]`));
 if(['nat','route','dhcp','hardening','ntp_syslog'].includes(key)){const id=key==='route'?'static':key;check(key+' checkbox reflects chip removal',!q(`[data-feature="${id}"]`).checked);}
 if(key!=='nat')check(key+' removal preserves NAT selection',q('[data-feature=nat]').checked);
 if(key!=='hardening')check(key+' removal preserves SSH selection',q('[data-feature=hardening]').checked);
 submit();check(key+' remaining configuration generates',!q('[data-copy-config]').disabled&&!q('[data-errors]').textContent);
 const cli=q('[data-code]').textContent;
 if(key==='nat')check('NAT chip removes NAT commands only',!cli.includes('ip nat inside source')&&cli.includes('ip route 0.0.0.0')&&cli.includes('ip dhcp pool'));
 if(key==='route')check('route chip removes default route only',!cli.includes('ip route 0.0.0.0')&&cli.includes('ip nat inside source'));
 if(key==='hardening')check('SSH chip removes credentials only',!cli.includes('username nocadmin')&&cli.includes('ip dhcp pool'));
 if(key==='dhcp')check('DHCP chip keeps DNS without lease pools',!cli.includes('ip dhcp pool')&&cli.includes('ip name-server'));
 if(key==='dns')check('DNS chip keeps DHCP without DNS configuration',cli.includes('ip dhcp pool')&&!cli.includes('ip name-server')&&!cli.includes(' dns-server '));
 if(key==='interfaces')check('interface chip disables base addressing',!q('[data-include-bindings]').checked&&!cli.includes('BASE INTERFACE / IP BINDINGS'));
 if(key==='switch')check('switch chip removes companion output',q('[data-office-companion]').hidden);
 if(key==='vlans')check('VLAN chip removes secondary subnet only',!cli.includes('172.16.19.')&&cli.includes('192.168.1.1'));
}
officePreset();q('[data-remove-preset=nat]').click();toggle('nat',true);check('custom component can be independently re-enabled',q('[data-feature=nat]').checked&&!!q('[data-remove-preset=nat]'));submit();check('re-enabled NAT appears in CLI',q('[data-code]').textContent.includes('ip nat inside source'));
cleanup();cleanup=mountVpn(root);disableBaseline();toggle('static',true);
input('[data-existing]','hostname EXISTING\ninterface Loopback10\n ip address 10.255.0.1 255.255.255.255\nusername operator secret test');
input('[data-integrate]',true,'change');submit();
check('integration renders preserved context with selected route: '+q('[data-errors]').textContent,!q('[data-copy-config]').disabled&&q('[data-code]').textContent.includes('hostname EXISTING')&&q('[data-code]').textContent.includes('ip route '));
check('integration masks pasted credentials',q('[data-code]').textContent.includes('secret ***')&&!q('[data-code]').textContent.includes('secret test'));
input('[data-existing]','hostname CHANGED');check('editing existing context invalidates generated output',q('[data-copy-config]').disabled);
input('[data-side]','b','change');check('existing context is isolated per site',q('[data-existing]').value==='');input('[data-side]','a','change');check('existing context returns with selected site',q('[data-existing]').value==='hostname CHANGED');
input('[data-existing]','ip route 192.168.20.0 255.255.255.0 203.0.113.1');submit();check('conflicting route blocks merged output',q('[data-copy-config]').disabled&&q('[data-errors]').textContent.includes('Conflicting'));
q('[data-clear-secrets]').click();check('clear secrets also clears pasted configuration',q('[data-existing]').value==='');
cleanup();root.replaceChildren();cleanup=mountVpn(root);
check('topology photo import is removed from the workbench',!q('[data-photo-import]')&&!q('[data-photo-panel]')&&!q('[data-photo-file]'));
officePreset();
check('IOS output explains the clean privileged prompt',!q('[data-paste-guide]').hidden&&q('[data-paste-guide]').textContent.includes('Ctrl+U')&&q('[data-paste-guide]').textContent.includes('Router#'));
check('IOS preview begins with the printable guard and configuration command',q('[data-code]').textContent.startsWith('!\nconfigure terminal\n'));
const exportClipboardDescriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard'),originalBlobUrl=URL.createObjectURL,originalAnchorClick=HTMLAnchorElement.prototype.click;
let exportedText='',downloadBlob=null;
try{
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{exportedText=text;}}});
 q('[data-copy-config]').click();await Promise.resolve();await Promise.resolve();
 check('Copy exports IOS commands with CRLF and a final Enter',exportedText.startsWith('!\r\nconfigure terminal\r\n')&&exportedText.endsWith('end\r\n')&&!exportedText.replaceAll('\r\n','').includes('\n'));
 check('Copy contains actual secrets while the preview stays masked',exportedText.includes('FixtureSecret_2026')&&!q('[data-code]').textContent.includes('FixtureSecret_2026'));
 const routerClipboard=exportedText;
 URL.createObjectURL=blob=>{downloadBlob=blob;return 'blob:export-fixture';};HTMLAnchorElement.prototype.click=function(){};
 q('[data-download-config]').click();check('Download and Copy produce the identical IOS payload',downloadBlob&&await downloadBlob.text()===routerClipboard);
 q('[data-copy-companion]').click();await Promise.resolve();await Promise.resolve();check('companion switch copy uses the same terminal format',exportedText.startsWith('!\r\n')&&exportedText.split('\r\n').find(line=>line.trim()&&!line.trim().startsWith('!'))==='configure terminal'&&exportedText.includes('switchport access vlan 10')&&!exportedText.includes('ip nat inside source'));
}finally{if(exportClipboardDescriptor)Object.defineProperty(navigator,'clipboard',exportClipboardDescriptor);else delete navigator.clipboard;URL.createObjectURL=originalBlobUrl;HTMLAnchorElement.prototype.click=originalAnchorClick;}
input('[data-vendor]','mikrotik','change');toggle('ntp_syslog',true);submit();check('IOS paste instructions and preamble do not leak into other vendors',q('[data-paste-guide]').hidden&&!q('[data-code]').textContent.startsWith('!\n'));
cleanup();root.replaceChildren();cleanup=mountVpn(root);
for(const [vendor,port]of [['ios','TwentyFiveGigE0/1'],['juniper','xe-0/0/1'],['mikrotik','sfp-sfpplus1'],['fortinet','slot1/port1'],['paloalto','ethernet1/2.10']]){
 input('[data-vendor]',vendor,'change');const picker=q('[data-port-side=a][data-port-picker=lan]');
 check(vendor+' has a vendor-specific LAN dropdown',[...picker.options].some(o=>o.value===port));
 input('[data-port-side=a][data-port-picker=lan]',port,'change');
 check(vendor+' dropdown updates topology interface',q('[data-side=a][name=lan]').value===port);
 input('[data-include-bindings]',true,'change');submit();check(vendor+' selected port reaches generated CLI',!q('[data-copy-config]').disabled&&q('[data-code]').textContent.includes(port));
}
input('[data-vendor]','juniper','change');check('vendor reset restores common physical port defaults',q('[data-side=a][name=wan]').value==='ge-0/0/0'&&q('[data-side=a][name=lan]').value==='ge-0/0/1');
input('[data-port-side=a][data-port-picker=lan]','__custom__','change');check('Custom reveals the exact-port input',!q('[data-side=a][name=lan]').hidden);input('[data-side=a][name=lan]','et-2/3/47');input('[data-include-bindings]',true,'change');submit();check('custom port survives generation',q('[data-code]').textContent.includes('et-2/3/47'));
input('[data-side=a][name=switchVendor]','mikrotik');check('switch vendor refreshes both port choices',q('[data-side=a][name=uplink]').value==='ether1'&&q('[data-side=a][name=access]').value==='ether2'&&[...q('[data-port-side=a][data-port-picker=uplink]').options].some(o=>o.value==='sfp1'));
input('[data-side]','b','change');check('port choices are isolated per site',q('[data-side=b][name=wan]').value==='port1');input('[data-side]','a','change');check('custom port preserved on site return',q('[data-side=a][name=lan]').value==='et-2/3/47');
cleanup();fixture.remove();
document.getElementById('ui-results').textContent=`${passed}/${total} UI checks passed${failures.length?'\nFAIL '+failures.join('\nFAIL '):''}`;

