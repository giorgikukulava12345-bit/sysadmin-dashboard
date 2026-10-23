import { mountVpn } from '../static/vpn/ui.js';
const output=document.getElementById('ui-results');
let passed=0,total=0;const failures=[];
function check(name,ok){total++;if(ok)passed++;else failures.push(name);}
const fixture=document.createElement('section');fixture.id='vpn-configurator';const root=document.createElement('div');fixture.append(root);document.body.append(fixture);
const cleanup=mountVpn(root),q=s=>fixture.querySelector(s);
const mode=q('[data-config-mode]');
for(const option of mode.options){mode.value=option.value;mode.dispatchEvent(new Event('change'));check(option.value+' panel visibility',option.value==='vpn'?!root.hidden:root.hidden);if(!['vpn','vlsm','hardening'].includes(option.value))check(option.value+' default output',q('[data-tool-output]').children.length>0);}
mode.value='hardening';mode.dispatchEvent(new Event('change'));check('blank secrets block generation',q('[data-tool-output]').children.length===0);
mode.value='enterprise';mode.dispatchEvent(new Event('change'));check('router and switch outputs',q('[data-tool-output]').children.length===2);
mode.value='vlsm';mode.dispatchEvent(new Event('change'));check('VLSM initial rows',q('[data-vlsm-output]').children.length===3);q('[data-vlsm-base]').value='192.168.10.0/30';q('[data-vlsm-base]').dispatchEvent(new Event('input'));check('VLSM clears stale allocation',q('[data-vlsm-output]').children.length===0);
for(const option of mode.options){mode.value=option.value;mode.dispatchEvent(new Event('change'));check(option.value+' universal canvas',!!q('.lab-canvas')&&!q('.lab-canvas').hidden);}
check('six device outputs',q('.lab-output').children.length===6);
const host=q('[data-side="a"][name="hostIp"]');host.value='10.10.0.25';host.dispatchEvent(new Event('input',{bubbles:true}));check('host IP bound to CLI',q('.lab-output').textContent.includes('10.10.0.25/24'));
host.value='10.10.0.1';host.dispatchEvent(new Event('input',{bubbles:true}));check('duplicate IP clears stale scripts',q('.lab-output').children.length===0);host.value='10.10.0.25';host.dispatchEvent(new Event('input',{bubbles:true}));
mode.value='vpn';mode.dispatchEvent(new Event('change'));const wan=q('[data-side="a"][name="wan"]');wan.value='GigabitEthernet0/7';wan.dispatchEvent(new Event('input',{bubbles:true}));check('topology edits VPN physical interface',q('[name="a.wan"]').value==='GigabitEthernet0/7');
const vpnIp=q('[name="a.ip"]');vpnIp.value='203.0.113.30';vpnIp.dispatchEvent(new Event('input',{bubbles:true}));check('VPN edits topology WAN IP',q('[data-side="a"][name="ip"]').value==='203.0.113.30');
mode.value='acl';mode.dispatchEvent(new Event('change'));const vendor=q('[data-tool-form] [name="vendor"]');check('five enterprise vendors',vendor.options.length===5);vendor.value='juniper';vendor.dispatchEvent(new Event('input',{bubbles:true}));check('unsupported feature does not emit Cisco',q('[data-tool-output]').children.length===0);
cleanup();check('cleanup removes workspace',!fixture.querySelector('.noc-shell'));
const cleanup2=mountVpn(root);check('remount creates one canvas',fixture.querySelectorAll('.lab-canvas').length===1);cleanup2();
const cleanup3=mountVpn(root,{workbench:false});check('standalone VPN omits workbench',!fixture.querySelector('.noc-shell')&&Boolean(root.querySelector('#vpn-form')));cleanup3();fixture.remove();
output.textContent=`${passed}/${total} UI checks passed${failures.length?'\nFAIL '+failures.join('\nFAIL '):''}`;