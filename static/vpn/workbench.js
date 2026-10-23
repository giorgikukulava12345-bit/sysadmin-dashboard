import { TOOLS, defaultsFor, generateTool } from './catalog.js';
import { planVlsm, vlsmTsv } from './vlsm.js';
import { mountMonitor } from './monitor.js';

const CSS=`.noc-shell,.noc-monitor{font-family:'JetBrains Mono',ui-monospace,monospace;color:#cbd5e1}.noc-shell [hidden],.noc-monitor [hidden]{display:none!important}.noc-panel{border:1px solid #233150;background:linear-gradient(145deg,#0e192b,#080f1c);padding:20px;border-radius:10px;margin:20px 0}.noc-heading{display:flex;justify-content:space-between;align-items:start;gap:14px;flex-wrap:wrap;margin-bottom:18px}.noc-heading h3{font-size:15px;color:#e2e8f0;margin:0 0 8px}.noc-heading p,.noc-note{font-size:11px;color:#94a3b8;line-height:1.65}.noc-heading p{margin:0}.noc-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:16px}.noc-field{display:flex;flex-direction:column;gap:7px;min-width:0;font-size:11px;color:#94a3b8}.noc-field:has(textarea){grid-column:1/-1}.noc-shell input:not([type=checkbox]),.noc-shell select,.noc-shell textarea{width:100%;background:#070c17;border:1px solid #293951;border-radius:5px;padding:10px;color:#e2e8f0;font:12px 'JetBrains Mono',monospace;box-sizing:border-box}.noc-shell textarea{min-height:100px;resize:vertical}.noc-shell input:focus,.noc-shell select:focus,.noc-shell textarea:focus{outline:2px solid #22d3ee;outline-offset:2px}.noc-shell input[type=checkbox],.noc-monitor input{accent-color:#22d3ee}.noc-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0;font-size:11px}.noc-shell button,.noc-monitor button{background:#22d3ee14;border:1px solid #22d3ee66;color:#67e8f9;border-radius:5px;padding:9px 13px;font:11px 'JetBrains Mono',monospace;cursor:pointer}.noc-shell button:focus-visible,.noc-monitor button:focus-visible{outline:2px solid #22d3ee;outline-offset:3px}.noc-shell button:disabled{opacity:.4;cursor:not-allowed}.noc-errors{font-size:12px;color:#fcd34d;line-height:1.7;margin:18px 0;white-space:pre-wrap}.noc-success{color:#6ee7b7}.noc-terminals{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:16px}.noc-terminal{min-width:0;border:1px solid #233150;border-radius:8px;overflow:hidden}.noc-terminal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;background:#111d30;font-size:12px}.noc-terminal pre{margin:0;padding:18px;background:#060d18;color:#a7f3d0;font:12px/1.8 'JetBrains Mono',monospace;overflow:auto;max-height:540px;min-height:180px}.noc-badge{font-size:10px;color:#67e8f9;border:1px solid #22d3ee44;padding:6px 9px;border-radius:4px}.noc-table-wrap{overflow:auto}.noc-shell table{width:100%;border-collapse:collapse;font-size:11px;white-space:nowrap}.noc-shell th,.noc-shell td{text-align:left;border-bottom:1px solid #233150;padding:12px;color:#cbd5e1}.noc-shell th{color:#67e8f9;background:#111d30}.noc-department{display:grid;grid-template-columns:minmax(100px,1fr) minmax(80px,.5fr) auto;gap:10px;align-items:end;margin-bottom:12px}.noc-log{height:260px;overflow:auto;background:#050b13;border:1px solid #233150;border-radius:6px;padding:14px;font:11px/1.9 'JetBrains Mono',monospace;overflow-wrap:anywhere}.noc-event{padding:3px 0;border-bottom:1px solid #142033}.noc-event-info{color:#67e8f9}.noc-event-warning{color:#fcd34d}.noc-event-critical,.noc-event-error{color:#f87171}@media(max-width:500px){.noc-panel{padding:14px}.noc-department{grid-template-columns:1fr 85px}.noc-department button{grid-column:1/-1}.noc-terminal-head{flex-wrap:wrap}}`;

export function mountWorkbench(vpnRoot){
  const shell=document.createElement('div');shell.className='noc-shell';
  shell.innerHTML=`<style>${CSS}</style><div class="noc-panel"><div class="noc-heading"><div><h3>NETWORK CONFIGURATION WORKBENCH</h3><p>Vendor templates · CCNA tools · Browser-local generation</p></div><span class="noc-badge">12 CONFIGURATION MODES</span></div><label class="noc-field">Configuration type<select data-config-mode aria-label="Configuration type"><option value="vpn">Site-to-Site VPN</option>${Object.entries(TOOLS).map(([k,t])=>`<option value="${k}">${t.title}</option>`).join('')}<option value="vlsm">Advanced VLSM Planner</option></select></label></div><section class="noc-panel" data-config-tool hidden><div class="noc-heading"><div><h3 data-tool-title></h3><p data-tool-note></p></div><span class="noc-badge">LIVE GENERATION</span></div><form data-tool-form class="noc-fields" novalidate></form><div class="noc-actions"><label><input type="checkbox" data-tool-reveal> Reveal secrets in output</label><button type="button" data-tool-clear>Clear secrets</button></div><p class="noc-errors" role="status" aria-live="polite" data-tool-status></p><div class="noc-terminals" data-tool-output></div><p class="noc-note" role="status" data-copy-status></p></section><section class="noc-panel" data-vlsm hidden><div class="noc-heading"><div><h3>ADVANCED VLSM PLANNER</h3><p>Largest-first allocation · Traditional IPv4 subnets reserve network/broadcast addresses (minimum /30).</p></div></div><label class="noc-field">Base network<input data-vlsm-base value="192.168.10.0/24" aria-label="VLSM base network"></label><div data-vlsm-departments style="margin-top:18px"></div><div class="noc-actions"><button type="button" data-vlsm-add>Add department</button><button type="button" data-vlsm-copy>Copy table (TSV)</button></div><p class="noc-errors" role="status" aria-live="polite" data-vlsm-status></p><div class="noc-table-wrap"><table><thead><tr><th>Department</th><th>Hosts</th><th>Network</th><th>Subnet mask</th><th>Usable range</th><th>Broadcast</th><th>Capacity</th></tr></thead><tbody data-vlsm-output></tbody></table></div><p class="noc-note" role="status" data-vlsm-copy-status></p></section>`;
  vpnRoot.before(shell);
  const monitor=document.createElement('div');monitor.className='noc-monitor';vpnRoot.after(monitor);const stopMonitor=mountMonitor(monitor);
  const knowledge=vpnRoot.parentElement.querySelector(':scope > details');
  const mode=shell.querySelector('[data-config-mode]'),form=shell.querySelector('[data-tool-form]');
  const values=Object.fromEntries(Object.keys(TOOLS).map(k=>[k,defaultsFor(k)]));
  let result={errors:[],scripts:[]},disposed=false;
  const find=selector=>shell.querySelector(selector);
  function renderFields(){
    const tool=TOOLS[mode.value],d=values[mode.value];
    find('[data-tool-title]').textContent=tool.title;find('[data-tool-note]').textContent=tool.note;
    form.replaceChildren();
    for(const f of tool.fields){
      const label=document.createElement('label');label.className='noc-field';label.dataset.field=f.key;label.textContent=f.label;
      const input=document.createElement(f.type==='select'?'select':f.type==='textarea'?'textarea':'input');input.name=f.key;input.setAttribute('aria-label',f.label);input.autocomplete='off';input.spellcheck=false;
      if(f.type==='select')for(const [value,title] of Object.entries(f.options)){const option=document.createElement('option');option.value=value;option.textContent=title;input.append(option);}
      else if(f.type!=='textarea')input.type=f.type;
      if(f.type==='checkbox')input.checked=Boolean(d[f.key]);else input.value=d[f.key];label.append(input);form.append(label);
    }
    renderTool();
  }
  function renderTool(){
    const key=mode.value,tool=TOOLS[key],d=values[key];
    for(const f of tool.fields)form.querySelector(`[data-field="${f.key}"]`).hidden=Boolean(f.when&&!f.when(d));
    result=generateTool(key,d);
    const secret=tool.fields.some(f=>f.type==='password'),reveal=find('[data-tool-reveal]');
    reveal.closest('label').hidden=!secret;find('[data-tool-clear]').hidden=!secret;
    const status=find('[data-tool-status]');status.className=`noc-errors ${result.errors.length?'':'noc-success'}`;status.textContent=result.errors.length?result.errors.join('\n'):'Configuration ready. Review firmware and existing device settings before applying.';
    const output=find('[data-tool-output]');output.replaceChildren();
    for(const [index,script] of result.scripts.entries()){
      const section=document.createElement('section');section.className='noc-terminal';
      const head=document.createElement('div');head.className='noc-terminal-head';const title=document.createElement('strong');title.textContent=script.title;
      const button=document.createElement('button');button.type='button';button.dataset.copy=String(index);button.textContent='Copy Config';head.append(title,button);
      const pre=document.createElement('pre');pre.tabIndex=0;pre.setAttribute('aria-label',script.title+' configuration');const code=document.createElement('code');code.textContent=secret&&!reveal.checked?'// Ready. Reveal to inspect or Copy Config (includes secrets).':script.code;pre.append(code);section.append(head,pre);output.append(section);
    }
  }
  function switchMode(){const key=mode.value;vpnRoot.hidden=key!=='vpn';if(knowledge)knowledge.hidden=key!=='vpn';find('[data-config-tool]').hidden=key==='vpn'||key==='vlsm';find('[data-vlsm]').hidden=key!=='vlsm';find('[data-copy-status]').textContent='';find('[data-tool-reveal]').checked=false;if(TOOLS[key])renderFields();if(key==='vlsm')renderPlan();}
  mode.addEventListener('change',switchMode);
  form.addEventListener('submit',e=>e.preventDefault());
  form.addEventListener('input',e=>{const el=e.target;if(!el.name)return;values[mode.value][el.name]=el.type==='checkbox'?el.checked:el.value;find('[data-copy-status]').textContent='';renderTool();});
  find('[data-tool-reveal]').addEventListener('change',renderTool);
  find('[data-tool-clear]').addEventListener('click',()=>{for(const f of TOOLS[mode.value].fields)if(f.type==='password')values[mode.value][f.key]='';find('[data-tool-reveal]').checked=false;renderFields();find('[data-copy-status]').textContent='Secrets cleared from this tool; previous clipboard content is unchanged.';});
  async function copy(text,status){try{await navigator.clipboard.writeText(text);if(!disposed)status.textContent='Copied to clipboard.';}catch{if(!disposed)status.textContent='Clipboard unavailable. Select the output text and copy manually.';}}
  find('[data-tool-output]').addEventListener('click',e=>{const button=e.target.closest('button[data-copy]');if(button&&!result.errors.length)copy(result.scripts[Number(button.dataset.copy)].code,find('[data-copy-status]'));});

  let departments=[{name:'HR',hosts:'50'},{name:'IT',hosts:'25'},{name:'Guests',hosts:'10'}],plan;
  function renderDepartments(){
    const container=find('[data-vlsm-departments]');container.replaceChildren();
    departments.forEach((d,i)=>{const row=document.createElement('div');row.className='noc-department';
      for(const key of ['name','hosts']){const label=document.createElement('label');label.className='noc-field';label.textContent=key==='name'?'Department name':'Required hosts';const input=document.createElement('input');input.type=key==='hosts'?'number':'text';input.value=d[key];input.setAttribute('aria-label',`${key==='name'?'Department name':'Required hosts'} ${i+1}`);input.addEventListener('input',()=>{d[key]=input.value;renderPlan();});label.append(input);row.append(label);}
      const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label',`Remove department ${i+1}`);remove.addEventListener('click',()=>{departments.splice(i,1);renderDepartments();renderPlan();});row.append(remove);container.append(row);
    });find('[data-vlsm-add]').disabled=departments.length>=32;
  }
  function renderPlan(){
    plan=planVlsm(find('[data-vlsm-base]').value,departments);find('[data-vlsm-status]').textContent=plan.errors.length?plan.errors.join('\n'):`${plan.rows.length} optimized subnets · ${plan.unused} addresses unallocated`;
    find('[data-vlsm-copy]').disabled=Boolean(plan.errors.length);const body=find('[data-vlsm-output]');body.replaceChildren();
    for(const r of plan.rows){const tr=document.createElement('tr');for(const value of [r.name,r.hosts,r.network,r.mask,`${r.first} – ${r.last}`,r.broadcast,r.usable]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}body.append(tr);}
    find('[data-vlsm-copy-status]').textContent='';
  }
  find('[data-vlsm-base]').addEventListener('input',renderPlan);find('[data-vlsm-add]').addEventListener('click',()=>{if(departments.length>=32)return;departments.push({name:`Department ${departments.length+1}`,hosts:'10'});renderDepartments();renderPlan();});find('[data-vlsm-copy]').addEventListener('click',()=>{if(!plan.errors.length)copy(vlsmTsv(plan.rows),find('[data-vlsm-copy-status]'));});
  renderDepartments();renderPlan();switchMode();
  return()=>{disposed=true;stopMonitor();shell.remove();monitor.remove();vpnRoot.hidden=false;if(knowledge)knowledge.hidden=false;};
}
