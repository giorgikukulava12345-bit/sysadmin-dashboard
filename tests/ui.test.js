import { mountVpn } from '../static/vpn/ui.js';
let total=0,passed=0;const failures=[];
function check(name,ok){total++;if(ok)passed++;else failures.push(name);}
const fixture=document.createElement('section'),root=document.createElement('div');fixture.append(root);document.body.append(fixture);
let cleanup=mountVpn(root);const q=s=>fixture.querySelector(s),input=(s,value,event='input')=>{const el=q(s);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event(event,{bubbles:true}));},toggle=(id,value)=>input(`[data-feature="${id}"]`,value,'change'),submit=()=>q('[data-generate]').click();
check('vendor-first selector has five vendors',q('[data-vendor]').options.length===5);
check('router has three categorized sections',fixture.querySelectorAll('[data-category]').length===3);
check('no parameter forms until checked',!q('[data-feature-panel]'));
check('prominent Submit present',q('[data-generate]').textContent==='Submit / Generate Configuration');
check('nothing copied before submit',q('[data-copy-config]').disabled);
toggle('nat',true);check('only selected parameters shown',!!q('[data-feature-panel="nat"]')&&!q('[data-feature-panel="acl"]'));check('checking does not generate CLI',q('[data-copy-config]').disabled);submit();check('submit generates PAT',q('[data-code]').textContent.includes('ip nat inside source list'));
input('[data-feature-panel="nat"] [name="natMode"]','static');check('changing parameters invalidates previous CLI',q('[data-copy-config]').disabled&&!q('[data-code]').textContent.includes('ip nat inside source list'));submit();check('static NAT submits',q('[data-code]').textContent.includes('ip nat inside source static'));
input('[data-feature-panel="nat"] [name="natMode"]','dynamic');submit();check('dynamic pool submits without overload',q('[data-code]').textContent.includes('ip nat pool NOC-POOL')&&!q('[data-code]').textContent.includes('overload'));
toggle('nat',false);submit();check('unchecking removes generated feature',q('[data-copy-config]').disabled);
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
