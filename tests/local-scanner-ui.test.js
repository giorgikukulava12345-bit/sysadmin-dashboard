import {mountLocalScanner} from '../static/vpn/local-scanner.js';
let passed=0,total=0;const failed=[];const check=(name,ok)=>{total++;if(ok)passed++;else failed.push(name);};
const root=document.createElement('section');document.body.append(root);const q=s=>root.querySelector(s),fire=(selector,value)=>{const el=q(selector);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
const calls=[],id='a'.repeat(24);let stopped=false,hold=false;
const result=status=>({apiVersion:1,agentVersion:'1.0.0',jobId:id,target:'192.168.1.1-2',total:2,completed:2,status,results:[{ip:'192.168.1.1',status:'up',name:'<img src=x onerror=alert(1)>',mac:'00:11:22:33:44:55',manufacturer:'=Example',latencyMs:1},{ip:'192.168.1.2',status:'no-response',name:'',mac:'',manufacturer:'',latencyMs:null}]});
async function fakeFetch(url,options){calls.push({url,options});if(url.endsWith('/v1/health'))return {ok:true,json:async()=>({apiVersion:1,maxHosts:1024})};if(url.endsWith('/stop')){stopped=true;return {ok:true,json:async()=>({status:'stopping'})};}if(options.method==='POST')return {ok:true,json:async()=>({jobId:id})};return {ok:true,json:async()=>result(stopped?'stopped':hold?'running':'completed')};}
async function waitFor(test){for(let i=0;i<100;i++){if(test())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Timed out waiting for local scanner UI');}
const cleanup=mountLocalScanner(root,{fetcher:fakeFetch,pollMs:10});
try{
 check('no agent request on mount',calls.length===0);check('agent script is downloadable',q('[download="noc_local_agent.py"]').getAttribute('href')==='/static/agent/noc_local_agent.py');
 check('scan requires an explicit agent connection',q('[data-scan-start]').disabled);
 fire('[data-agent-token]','a'.repeat(43));q('[data-agent-connect]').click();await waitFor(()=>!q('[data-scan-start]').disabled);
 check('connection is loopback-only with token in header',calls[0].url==='http://127.0.0.1:8765/v1/health'&&calls[0].options.headers.Authorization==='Bearer '+'a'.repeat(43)&&!calls[0].url.includes('aaaa'));
 check('token input clears after connection',q('[data-agent-token]').value==='');
 fire('[data-scan-target]','8.8.8.8');q('[data-scan-start]').click();check('invalid public target sends no scan request',calls.length===1);
 fire('[data-scan-target]','192.168.1.1-2');q('[data-scan-start]').click();await waitFor(()=>q('[data-scan-status]').textContent.startsWith('completed'));
 check('scan sends validated target in JSON',calls.some(c=>c.options.method==='POST'&&JSON.parse(c.options.body).target==='192.168.1.1-2'));
 check('result name renders as text without markup',!root.querySelector('img')&&q('[data-scan-rows]').textContent.includes('<img src=x'));
 check('two results and non-response status are visible',q('[data-scan-rows]').children.length===2&&q('[data-scan-rows]').textContent.includes('No response'));
 fire('[data-scan-filter]','192.168.1.1');check('filter narrows rendered results',q('[data-scan-rows]').children.length===1);fire('[data-scan-filter]','');
 fire('[data-comment="192.168.1.1"]','@note');
 const create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;let exported;
 try{URL.createObjectURL=blob=>{exported=blob;return 'blob:local-scanner-test';};HTMLAnchorElement.prototype.click=function(){};q('[data-scan-csv]').click();check('CSV keeps protected comments without manufacturer',/"'@note"/.test(await exported.text())&&!(await exported.text()).includes('Manufacturer')&&!(await exported.text()).includes('=Example'));}finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click;}
 hold=true;q('[data-scan-start]').click();await waitFor(()=>!q('[data-scan-stop]').disabled);q('[data-scan-stop]').click();await waitFor(()=>q('[data-scan-status]').textContent.startsWith('stopped'));check('Stop calls authenticated local endpoint',calls.some(c=>c.url.endsWith('/stop')));
 q('[data-agent-disconnect]').click();check('disconnect disables scanning',q('[data-scan-start]').disabled);
 const before=calls.length,file=new File([JSON.stringify(result('completed'))],'scan-results.json',{type:'application/json'});Object.defineProperty(q('[data-scan-import]'),'files',{configurable:true,value:[file]});q('[data-scan-import]').dispatchEvent(new Event('change'));await waitFor(()=>q('[data-scan-status]').textContent.startsWith('Imported'));
 check('JSON import starts no network requests',calls.length===before&&q('[data-scan-rows]').children.length===2);
 check('manufacturer column and lookup status are absent',!root.textContent.includes('Manufacturer')&&!q('[data-vendor-status]')&&q('thead').querySelectorAll('th').length===6);
 const exportCreate=URL.createObjectURL,exportClick=HTMLAnchorElement.prototype.click;let exportBlob;try{URL.createObjectURL=blob=>{exportBlob=blob;return 'blob:scan-test';};HTMLAnchorElement.prototype.click=function(){};q('[data-scan-json]').click();check('JSON export omits legacy manufacturer fields',!Object.hasOwn(JSON.parse(await exportBlob.text()).results[0],'manufacturer'));}finally{URL.createObjectURL=exportCreate;HTMLAnchorElement.prototype.click=exportClick;}
 check('all calls stayed on fixed loopback host',calls.every(c=>c.url.startsWith('http://127.0.0.1:8765/')));
}catch(error){check(error.message,false);}finally{cleanup();root.remove();}
document.getElementById('scanner-results').textContent=`${passed}/${total} local scanner UI checks passed${failed.length?'\nFAIL '+failed.join('\nFAIL '):''}`;
