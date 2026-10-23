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
mode.value='vpn';mode.dispatchEvent(new Event('change'));q('[data-stream-toggle]').click();check('monitor pause',q('[data-monitor-state]').textContent==='PAUSED');q('[data-stream-clear]').click();check('monitor clear',q('[data-stream-log]').children.length===0);q('[data-stream-toggle]').click();check('monitor resume',q('[data-monitor-state]').textContent==='STREAMING');
await new Promise(resolve=>setTimeout(resolve,2700));check('monitor emits after resume',q('[data-stream-log]').children.length>0);
cleanup();check('cleanup removes workspace and monitor',!fixture.querySelector('.noc-shell')&&!fixture.querySelector('.noc-monitor'));
const cleanup2=mountVpn(root);check('remount does not duplicate workspace',fixture.querySelectorAll('.noc-shell').length===1&&fixture.querySelectorAll('.noc-monitor').length===1);cleanup2();
const cleanup3=mountVpn(root,{workbench:false});check('React VPN mode omits duplicated workbench and monitor',!fixture.querySelector('.noc-shell')&&!fixture.querySelector('.noc-monitor')&&Boolean(root.querySelector('#vpn-form')));cleanup3();fixture.remove();
output.textContent=`${passed}/${total} UI checks passed${failures.length?'\nFAIL '+failures.join('\nFAIL '):''}`;
