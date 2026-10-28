const MAX_HOSTS=1024;
const ipNumber=value=>{
  if(typeof value!=='string'||!/^\d+\.\d+\.\d+\.\d+$/.test(value))return null;
  const parts=value.split('.');if(parts.some(p=>+p>255||String(+p)!==p))return null;
  return parts.reduce((n,p)=>n*256+ +p,0);
};
const ipText=n=>[24,16,8,0].map(shift=>(n>>>shift)&255).join('.');
const privateBlock=n=>n>=0x0a000000&&n<=0x0affffff?1:n>=0xac100000&&n<=0xac1fffff?2:n>=0xc0a80000&&n<=0xc0a8ffff?3:0;
export function scanTarget(value){
  const target=String(value||'').trim();let start,end,normalized=target;
  if(!target||target.length>80)throw Error('Enter a private IPv4 host, CIDR or start-end range.');
  if(target.includes('-')){
    const parts=target.split('-');if(parts.length!==2)throw Error('Use one start-end range.');
    if(/^\d+$/.test(parts[1]))parts[1]=parts[0].slice(0,parts[0].lastIndexOf('.')+1)+parts[1];
    start=ipNumber(parts[0]);end=ipNumber(parts[1]);
  }else{
    const parts=target.split('/');if(parts.length>2)throw Error('Use IPv4 or IPv4/prefix.');
    const ip=ipNumber(parts[0]),prefix=parts.length===1?32:/^(?:[0-9]|[12][0-9]|3[0-2])$/.test(parts[1])?+parts[1]:NaN;
    if(ip===null||!Number.isInteger(prefix))throw Error('Enter a valid IPv4 address and prefix.');
    const size=2**(32-prefix),network=Math.floor(ip/size)*size;start=network+(prefix<31?1:0);end=network+size-1-(prefix<31?1:0);normalized=parts.length===1?target:`${ipText(network)}/${prefix}`;
  }
  if(start===null||end===null||end<start||end-start+1>MAX_HOSTS)throw Error(`Scan between 1 and ${MAX_HOSTS} addresses per run.`);
  if(!privateBlock(start)||privateBlock(start)!==privateBlock(end))throw Error('Use a private LAN range: 10/8, 172.16/12 or 192.168/16.');
  return {target:normalized,total:end-start+1};
}
export function scanSnapshot(value){
  if(!value||value.apiVersion!==1||!Array.isArray(value.results)||value.results.length>MAX_HOSTS||!Number.isInteger(value.total)||value.total<1||value.total>MAX_HOSTS||value.completed!==value.results.length||value.completed>value.total||!['running','stopping','completed','stopped','error'].includes(value.status))throw Error('Invalid or incompatible scan-results JSON.');
  const seen=new Set(),text=(v,max)=>typeof v==='string'?v.slice(0,max):'';
  const results=value.results.map(row=>{
    const ip=ipNumber(row?.ip);if(ip===null||!privateBlock(ip)||seen.has(ip)||!['up','no-response'].includes(row.status))throw Error('Invalid scan result address or status.');seen.add(ip);
    const mac=text(row.mac,17);if(mac&&!/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac))throw Error('Invalid result MAC address.');
    return {ip:row.ip,status:row.status,name:text(row.name,253),mac:mac.toUpperCase(),manufacturer:text(row.manufacturer,160),latencyMs:Number.isFinite(row.latencyMs)&&row.latencyMs>=0&&row.latencyMs<=60000?row.latencyMs:null,comment:text(row.comment,250)};
  }).sort((a,b)=>ipNumber(a.ip)-ipNumber(b.ip));
  return {apiVersion:1,agentVersion:text(value.agentVersion,30),jobId:text(value.jobId,24),target:text(value.target,80),status:value.status,total:value.total,completed:value.completed,error:text(value.error,240),results};
}
export function scanCSV(rows){
  const safe=value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  return [['Status','Name','IP','Manufacturer','MAC','Latency (ms)','Comments'],...rows.map(r=>[r.status==='up'?'Responded':'No response',r.name,r.ip,r.manufacturer,r.mac,r.latencyMs,r.comment])].map(row=>row.map(safe).join(',')).join('\r\n')+'\r\n';
}

const STYLE=`.local-scanner .scan-grid{display:grid;grid-template-columns:2fr 1fr 2fr;gap:12px}.local-scanner label{display:flex;flex-direction:column;gap:6px;color:#94a3b8;font-size:12px}.local-scanner input,.local-scanner select{min-width:0;width:100%;box-sizing:border-box;background:#09090b;border:1px solid #273744;border-radius:9px;color:#e2e8f0;padding:11px;font:12px ui-monospace,monospace}.local-scanner button,.local-scanner .scan-download{display:inline-block;cursor:pointer;border:1px solid #22d3ee66;border-radius:9px;background:#0b3544;color:#a5f3fc;padding:10px 13px;font-size:12px;text-decoration:none}.local-scanner button:disabled{opacity:.45;cursor:default}.local-scanner .scan-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:12px 0}.local-scanner .scan-actions label{flex-direction:row;align-items:center}.local-scanner .scan-actions input[type=checkbox]{width:auto}.local-scanner .scan-table-wrap{overflow:auto;max-height:440px;border:1px solid #243342;border-radius:10px}.local-scanner table{width:100%;min-width:820px;border-collapse:collapse;font-size:12px}.local-scanner th,.local-scanner td{text-align:left;padding:11px;border-bottom:1px solid #1e293b;overflow-wrap:anywhere;max-width:250px}.local-scanner th{position:sticky;top:0;background:#11151d;color:#94a3b8;z-index:1}.local-scanner td[data-up=true]{color:#34d399}.local-scanner progress{width:100%;height:9px;accent-color:#22d3ee}.local-scanner .scan-status{color:#67e8f9;white-space:pre-wrap}.local-scanner .scan-command{display:block;padding:10px;background:#09090b;color:#e2e8f0;overflow:auto}.local-scanner input:focus,.local-scanner select:focus,.local-scanner button:focus-visible{outline:2px solid #22d3ee}.local-scanner .scan-note{color:#94a3b8;font-size:12px;line-height:1.7}.local-scanner .scan-empty{color:#94a3b8;text-align:center}@media(max-width:720px){.local-scanner .scan-grid{grid-template-columns:1fr}}`;

export function mountLocalScanner(root,{fetcher=(...args)=>fetch(...args),pollMs=1000}={}){
  const events=new AbortController();let active=true,token='',connected=false,jobId='',snapshot=null,timer=null,pending=null,busy=false,connectionEpoch=0;
  const comments=new Map();root.classList.add('local-scanner');
  root.innerHTML=`<style>${STYLE}</style><h3>LOCAL NETWORK SCANNER</h3><p class="scan-note">Discover devices from your own computer with a free local Python agent. Results stay between this browser and your agent; the website server does not receive them. Scan only networks you manage or have permission to assess.</p><details><summary>1 · Download and run the local agent</summary><p class="scan-note">Requires Python 3.10+ and the system ping command. Download the script, open a terminal in its folder and run:</p><code class="scan-command">py -3 noc_local_agent.py</code><div class="scan-actions"><a class="scan-download" href="/static/agent/noc_local_agent.py" download="noc_local_agent.py">Download Python agent</a><a class="scan-download" href="/static/agent/README.md" target="_blank" rel="noopener noreferrer">Agent instructions</a></div><p class="scan-note">macOS / Linux: use python3 noc_local_agent.py. Keep the terminal open and copy its session token below. Ctrl+C stops the agent.</p></details><div class="scan-grid"><label>2 · Agent session token<input data-agent-token type="password" autocomplete="off" spellcheck="false" placeholder="Paste the token from the agent terminal" maxlength="128"></label><label>Local agent port<input data-agent-port type="number" min="1024" max="65535" value="8765"></label><label>3 · IPv4 range / CIDR<input data-scan-target value="192.168.1.1-254" maxlength="80" spellcheck="false"></label></div><div class="scan-actions"><button type="button" data-agent-connect>Connect agent</button><button type="button" data-agent-disconnect disabled>Disconnect</button><button type="button" data-scan-start disabled>Start scan</button><button type="button" data-scan-stop disabled>Stop scan</button><label><input data-resolve-names type="checkbox"> Resolve hostnames (optional)</label></div><p role="status" aria-live="polite" class="scan-status" data-scan-status>Agent disconnected. No scan has started.</p><progress data-scan-progress value="0" max="1" aria-label="Scan progress"></progress><div class="scan-actions"><label>Filter results<input data-scan-filter type="search" placeholder="IP, name or MAC"></label><label>Show<select data-scan-show><option value="all">All results</option><option value="up">Responded</option><option value="no-response">No response</option></select></label><button type="button" data-scan-csv disabled>Export CSV</button><button type="button" data-scan-json disabled>Export JSON</button><label>Import agent JSON<input data-scan-import type="file" accept=".json,application/json"></label></div><div class="scan-table-wrap"><table><thead><tr><th>Status</th><th>Name</th><th>IP</th><th>Manufacturer</th><th>MAC address</th><th>Latency</th><th>Comments</th></tr></thead><tbody data-scan-rows></tbody></table></div><p class="scan-note">No response does not prove a device is offline: ICMP may be blocked. MAC addresses come from the local neighbor cache and may be unavailable across routers. Manufacturer requires an optional offline OUI CSV; unknown values stay blank. Comments are kept only in this page and exports.</p><details><summary>Connection help / JSON fallback</summary><p class="scan-note">The agent listens only on 127.0.0.1. If the browser requests local-network access, allow it only for this site. Check that the agent is running and the token/port match. If this browser blocks the connection, run the following from the agent folder, then import scan-results.json above:</p><code class="scan-command">py -3 noc_local_agent.py --once 192.168.1.0/24 --output scan-results.json</code></details>`;
  const q=selector=>root.querySelector(selector),status=text=>{if(active)q('[data-scan-status]').textContent=text;};
  const rows=()=>snapshot?snapshot.results.map(r=>({...r,comment:comments.get(r.ip)??r.comment??''})):[];
  const running=()=>Boolean(jobId&&snapshot&&['running','stopping'].includes(snapshot.status));
  function controls(){
    q('[data-agent-connect]').disabled=busy||connected;q('[data-agent-disconnect]').disabled=!connected;q('[data-scan-start]').disabled=!connected||busy||running();q('[data-scan-stop]').disabled=!connected||!running();
    q('[data-scan-target]').disabled=running();q('[data-resolve-names]').disabled=running();q('[data-agent-port]').disabled=connected||busy;
    q('[data-scan-csv]').disabled=!snapshot?.results.length;q('[data-scan-json]').disabled=!snapshot;q('[data-scan-import]').disabled=running();
  }
  function render(){
    controls();const body=q('[data-scan-rows]');if(body.contains(document.activeElement)&&document.activeElement.matches('[data-comment]'))return;
    body.replaceChildren();const search=q('[data-scan-filter]').value.toLowerCase(),show=q('[data-scan-show]').value;
    const visible=rows().filter(r=>(show==='all'||r.status===show)&&[r.ip,r.name,r.mac,r.manufacturer].some(v=>v.toLowerCase().includes(search)));
    for(const row of visible){const tr=document.createElement('tr');for(const value of [row.status==='up'?'Responded':'No response',row.name||'—',row.ip,row.manufacturer||'—',row.mac||'—',row.latencyMs===null?'—':row.latencyMs+' ms']){const td=document.createElement('td');td.textContent=value;tr.append(td);}tr.firstChild.dataset.up=String(row.status==='up');const td=document.createElement('td'),input=document.createElement('input');input.dataset.comment=row.ip;input.value=row.comment;input.maxLength=250;input.setAttribute('aria-label','Comment for '+row.ip);td.append(input);tr.append(td);body.append(tr);}
    if(!visible.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.className='scan-empty';td.textContent=snapshot?'No matching results.':'No scan results yet.';tr.append(td);body.append(tr);}
    q('[data-scan-progress]').max=snapshot?.total||1;q('[data-scan-progress]').value=snapshot?.completed||0;
  }
  function clearConnection(message){connectionEpoch++;clearTimeout(timer);pending?.abort();connected=false;busy=false;token='';jobId='';q('[data-agent-token]').value='';controls();if(message)status(message);}
  async function request(path,{method='GET',body,timeout=5000}={}){
    pending=new AbortController();const local=pending,timeoutId=setTimeout(()=>local.abort(),timeout);
    try{const response=await fetcher(`http://127.0.0.1:${+q('[data-agent-port]').value}${path}`,{method,mode:'cors',cache:'no-store',credentials:'omit',targetAddressSpace:'loopback',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:local.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Local agent request failed.');return data;}finally{clearTimeout(timeoutId);if(pending===local)pending=null;}
  }
  async function poll(epoch){
    try{const data=scanSnapshot(await request('/v1/scans/'+jobId));if(!active||epoch!==connectionEpoch)return;snapshot=data;render();const up=data.results.filter(r=>r.status==='up').length;status(`${data.status}: ${data.completed}/${data.total} checked · ${up} responded${data.error?' · '+data.error:''}`);if(running())timer=setTimeout(()=>poll(epoch),pollMs);}catch(error){if(active&&epoch===connectionEpoch)clearConnection('Connection lost: '+error.message+' Reconnect the agent. Existing results remain available.');}
  }
  q('[data-agent-connect]').addEventListener('click',async()=>{
    const candidate=q('[data-agent-token]').value.trim(),port=q('[data-agent-port]').value;if(!/^[A-Za-z0-9_-]{24,128}$/.test(candidate)||!/^\d+$/.test(port)||+port<1024||+port>65535){status('Enter the agent session token and a port from 1024 to 65535.');return;}
    busy=true;token=candidate;const epoch=++connectionEpoch;controls();status('Connecting to the local agent…');
    try{const data=await request('/v1/health');if(!active||epoch!==connectionEpoch)return;if(data.apiVersion!==1||data.maxHosts!==MAX_HOSTS)throw Error('Agent version is incompatible. Download the current script.');connected=true;q('[data-agent-token]').value='';status('Agent connected. Review the range, then press Start scan.');}catch(error){if(active&&epoch===connectionEpoch)clearConnection('Cannot connect: '+error.message+' Check the agent, token and browser local-network permission, or use JSON import.');}finally{if(active&&epoch===connectionEpoch){busy=false;controls();}}
  },{signal:events.signal});
  q('[data-agent-disconnect]').addEventListener('click',()=>clearConnection('Disconnected. To stop an active scan, press Ctrl+C in the agent terminal. Existing results remain available.'),{signal:events.signal});
  q('[data-scan-start]').addEventListener('click',async()=>{
    if(!connected||busy||running())return;let target;try{target=scanTarget(q('[data-scan-target]').value);}catch(error){status(error.message);return;}
    busy=true;controls();const epoch=connectionEpoch;status('Starting '+target.target+'…');
    try{const data=await request('/v1/scans',{method:'POST',body:{target:target.target,resolveNames:q('[data-resolve-names]').checked}});if(!active||epoch!==connectionEpoch)return;if(!/^[a-f0-9]{24}$/.test(data.jobId||''))throw Error('Invalid agent scan identifier.');jobId=data.jobId;comments.clear();snapshot={apiVersion:1,status:'running',results:[],total:target.total,completed:0,target:target.target};busy=false;render();await poll(epoch);}catch(error){if(active&&epoch===connectionEpoch){busy=false;controls();status('Scan could not start: '+error.message);}}
  },{signal:events.signal});
  q('[data-scan-stop]').addEventListener('click',async()=>{if(!running())return;const epoch=connectionEpoch;try{await request('/v1/scans/'+jobId+'/stop',{method:'POST',body:{}});if(active&&epoch===connectionEpoch)status('Stop requested. Waiting for current probes to finish…');}catch(error){if(active&&epoch===connectionEpoch)status('Could not stop: '+error.message);}}, {signal:events.signal});
  root.addEventListener('input',event=>{const el=event.target;if(el.dataset.comment)comments.set(el.dataset.comment,el.value);if(el===q('[data-scan-filter]'))render();},{signal:events.signal});q('[data-scan-show]').addEventListener('change',render,{signal:events.signal});
  function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  q('[data-scan-csv]').addEventListener('click',()=>{if(snapshot)download('network-scan.csv',scanCSV(rows()),'text/csv;charset=utf-8');},{signal:events.signal});
  q('[data-scan-json]').addEventListener('click',()=>{if(snapshot)download('scan-results.json',JSON.stringify({...snapshot,results:rows()},null,2),'application/json');},{signal:events.signal});
  q('[data-scan-import]').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file||running())return;if(file.size>2*1024*1024){status('Import a scan JSON file smaller than 2 MB.');return;}try{const data=scanSnapshot(JSON.parse(await file.text()));if(!active||running())return;clearTimeout(timer);jobId='';comments.clear();snapshot=data;render();status(`Imported ${data.results.length} results from ${file.name}. No network scan was started.`);}catch(error){if(active)status('Import failed: '+error.message);}event.target.value='';},{signal:events.signal});
  render();return()=>{active=false;connectionEpoch++;clearTimeout(timer);pending?.abort();token='';events.abort();root.replaceChildren();};
}
