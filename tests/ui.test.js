import {FEATURES} from '../static/vpn/features.js';
﻿import { mountVpn } from '../static/vpn/ui.js';
let total=0,passed=0;const failures=[];
function check(name,ok){total++;if(ok)passed++;else failures.push(name);}
const fixture=document.createElement('section'),root=document.createElement('div');fixture.append(root);document.body.append(fixture);
let cleanup=mountVpn(root);const q=s=>fixture.querySelector(s),input=(s,value,event='input')=>{const el=q(s);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event(event,{bubbles:true}));},toggle=(id,value)=>input(`[data-feature="${id}"]`,value,'change'),submit=()=>q('[data-generate]').click();
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
check('playbook has five failure scenarios and vendors',q('[data-scenario]').options.length===5&&q('[data-diagnostic-vendor]').options.length===5);
for(const vendor of ['ios','mikrotik','fortinet','juniper','paloalto'])for(const scenario of ['ipsec','bgp','ospf','vlan','interface']){input('[data-diagnostic-vendor]',vendor,'change');input('[data-scenario]',scenario,'change');check('playbook '+vendor+' / '+scenario+' renders diagnostics',q('[data-diagnostics]').textContent.length>40&&q('[data-cause]').textContent.length>40);}
input('[data-diagnostic-vendor]','ios','change');input('[data-scenario]','ipsec','change');check('debug includes explicit stop command',q('[data-debug]').textContent.includes('undebug all'));
toggle('static',true);submit();check('CLI syntax highlighting retains address content',q('[data-code] .cli-address')?.textContent==='192.168.20.0');toggle('static',false);

check('no parameter forms until checked',!q('[data-feature-panel]'));
check('prominent Submit present',q('[data-generate]').textContent==='Submit / Generate Configuration');
check('nothing copied before submit',q('[data-copy-config]').disabled);
toggle('nat',true);check('only selected parameters shown',!!q('[data-feature-panel="nat"]')&&!q('[data-feature-panel="acl"]'));check('checking does not generate CLI',q('[data-copy-config]').disabled);submit();check('submit generates PAT',q('[data-code]').textContent.includes('ip nat inside source list'));

const submittedNat=q('[data-code]').textContent;root.querySelector('#vpn-reveal').dispatchEvent(new Event('change',{bubbles:true}));check('unchanged VPN broadcasts do not discard submitted NAT',q('[data-code]').textContent===submittedNat&&!q('[data-copy-config]').disabled);
const originalVendors=FEATURES.nat.vendors;FEATURES.nat.vendors=null;submit();check('unexpected generation errors become visible and never leave draft text',q('[data-generation-status]').dataset.state==='error'&&q('[data-errors]').textContent.includes('Generation failed')&&!q('[data-code]').textContent.includes('Draft changed'));FEATURES.nat.vendors=originalVendors;submit();check('generation recovers after an error',!q('[data-copy-config]').disabled);

input('[data-feature-panel="nat"] [name="natMode"]','static');check('changing parameters invalidates previous CLI',q('[data-copy-config]').disabled&&!q('[data-code]').textContent.includes('ip nat inside source list'));submit();check('static NAT submits',q('[data-code]').textContent.includes('ip nat inside source static'));
input('[data-feature-panel="nat"] [name="natMode"]','dynamic');submit();check('dynamic pool submits without overload',q('[data-code]').textContent.includes('ip nat pool NOC-POOL')&&!q('[data-code]').textContent.includes('overload'));
toggle('nat',false);submit();check('unchecking removes generated feature',q('[data-copy-config]').disabled);

for(const[id,expected]of Object.entries({portforward:'ip nat inside source static tcp',gre_tunnel:'tunnel mode gre ip',vxlan:'bridge-domain 100',bfd:'bfd interval',ipsla:'ip sla schedule',isis:'ip router isis',copp:'policy-map NOC-COPP',urpf:'ip verify unicast source reachable-via'})){
  toggle(id,true);submit();check('Submit renders '+id+' CLI',q('[data-code]').textContent.includes(expected)&&!q('[data-copy-config]').disabled);q('[data-clear-output]').click();check('Clear invalidates '+id+' output but preserves selection',q('[data-copy-config]').disabled&&q('[data-feature="'+id+'"]').checked&&q('[data-code]').textContent.includes('Output cleared'));submit();check('resubmit after Clear renders '+id, q('[data-code]').textContent.includes(expected));toggle(id,false);
}
toggle('portforward',true);input('[data-feature-panel="portforward"] [name="internalPort"]','8080');q('[data-feature-panel="portforward"] [name="internalPort"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));check('Enter submits feature inputs to the output panel',q('[data-code]').textContent.includes('192.168.1.10 8080 interface'));input('[data-feature-panel="portforward"] [name="externalPort"]','0');submit();check('invalid ports show validation instead of draft placeholder',q('[data-errors]').textContent.includes('External port')&&!q('[data-code]').textContent.includes('Draft changed'));toggle('portforward',false);submit();check('empty Submit has an explicit empty state',q('[data-generation-status]').dataset.state==='empty'&&q('[data-copy-config]').disabled);

toggle('ntp_syslog',true);submit();check('infrastructure CLI emitted',q('[data-code]').textContent.includes('ntp server 192.0.2.123'));
input('[data-side]','b','change');check('context change invalidates old output',q('[data-copy-config]').disabled);input('[data-side]','a','change');check('selection persists per device',q('[data-feature="ntp_syslog"]').checked);
for(const vendor of ['ios','mikrotik','fortinet','juniper','paloalto']){
 input('[data-vendor]',vendor,'change');check(vendor+' all router checkboxes enabled',[...fixture.querySelectorAll('[data-feature]')].every(el=>!el.disabled));
 toggle('static6',true);submit();check(vendor+' IPv6 static CLI',!q('[data-copy-config]').disabled&&q('[data-code]').textContent.includes('2001:db8:20::/64'));toggle('static6',false);
 toggle('ntp_syslog',true);submit();check(vendor+' NTP/syslog CLI',!q('[data-copy-config]').disabled);toggle('ntp_syslog',false);
 toggle('eigrp',true);check(vendor+' EIGRP checkbox interactive',q('[data-feature="eigrp"]').checked);submit();check(vendor+' supported or explicit rejection',vendor==='ios'?!q('[data-copy-config]').disabled:q('[data-copy-config]').disabled&&q('[data-errors]').textContent.includes('no validated'));toggle('eigrp',false);
}
input('[data-vendor]','ios','change');q('[data-role="switch"]').click();check('switch has L2 category',!!q('[data-category="switching"]'));for(const id of ['vlan','stp','etherchannel','security','snooping','pvlan'])check('switch includes '+id,!!q(`[data-feature="${id}"]`));
toggle('stp',true);input('[data-feature-panel="stp"] [name="mode"]','mst');submit();check('MST configuration generated',q('[data-code]').textContent.includes('spanning-tree mst configuration'));toggle('stp',false);
toggle('etherchannel',true);input('[data-feature-panel="etherchannel"] [name="protocol"]','pagp');submit();check('Cisco PAgP desirable mode',q('[data-code]').textContent.includes('mode desirable'));toggle('etherchannel',false);
toggle('pvlan',true);submit();check('PVLAN host/promiscuous generated',q('[data-code]').textContent.includes('private-vlan promiscuous'));toggle('pvlan',false);
input('[data-vendor]','paloalto','change');check('all unsupported L2 options remain interactive',[...fixture.querySelectorAll('[data-feature]')].every(el=>!el.disabled));toggle('pvlan',true);submit();check('unsupported selection produces zero partial CLI',q('[data-copy-config]').disabled&&!q('[data-code]').textContent.includes('private-vlan promiscuous'));toggle('pvlan',false);
q('[data-role="router"]').click();input('[data-vendor]','ios','change');toggle('ospf_advanced',true);input('[data-feature-panel="ospf_advanced"] [name="authSecret"]','ExampleAuth_ChangeMe2026');submit();check('secret output concealed',q('[data-code]').textContent.includes('Reveal'));input('[data-reveal]',true,'change');check('reveal does not invalidate submit',!q('[data-copy-config]').disabled&&q('[data-code]').textContent.includes('hmac-sha-256'));q('[data-clear-secrets]').click();check('clear invalidates secret configuration',q('[data-copy-config]').disabled&&q('[data-feature-panel="ospf_advanced"] [name="authSecret"]').value==='');
toggle('ospf_advanced',false);toggle('vpn',true);q('[data-action="key"]').click();submit();check('site-to-site VPN still generates',!q('[data-copy-config]').disabled);check('VPN menu limited to site-to-site families',q('[aria-label="VPN technology"]').options.length===5);toggle('vpn',false);
input('[data-vendor]','mikrotik','change');toggle('remotevpn',true);input('[data-feature-panel="remotevpn"] [name="username"]','nocadmin');input('[data-feature-panel="remotevpn"] [name="password"]','ExampleOnly_ChangeMe26');submit();check('dedicated remote-access feature generates',!q('[data-copy-config]').disabled);
q('[data-role="host"]').click();submit();check('host generation uses same Submit flow',q('[data-code]').textContent.includes('ip route replace default'));
cleanup();check('cleanup restores original mount host',!q('.noc-composer')&&root.parentElement===fixture);cleanup=mountVpn(root);check('remount creates one workbench',fixture.querySelectorAll('.noc-composer').length===1);cleanup();fixture.remove();
document.getElementById('ui-results').textContent=`${passed}/${total} UI checks passed${failures.length?'\nFAIL '+failures.join('\nFAIL '):''}`;
