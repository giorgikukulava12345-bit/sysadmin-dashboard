import { hasSecondVlan, validateSecondVlan, dualVlanRouterConfig, dualVlanSwitchConfig } from './dual-vlan.js';
import { PLATFORMS, PORTS } from './platforms.js';
import { cidr, ipv4 } from './address.js';
import { interfaceConfig, validateInterfaces } from './interfaces.js';

export const createLab = () => Object.fromEntries(['a','b'].map((side,i)=>[side,{
  vendor:i?'fortinet':'ios',ip:i?'198.51.100.20':'203.0.113.10',wanPrefix:'24',wan:i?'port1':'GigabitEthernet0/0',lan:i?'port2':'GigabitEthernet0/1',
  local:i?'10.20.0.0/24':'192.168.1.0/24',lanIp:i?'10.20.0.1':'192.168.1.1',gateway:i?'198.51.100.1':'203.0.113.1',
  vlan2Enabled:'off',vlan2:'20',vlan2Subnet:i?'192.168.30.0/24':'192.168.20.0/24',vlan2Gateway:i?'192.168.30.1':'192.168.20.1',vlan2SwitchIp:i?'192.168.30.254':'192.168.20.254',vlan2Access:'FastEthernet0/2',
  switchVendor:'ios',uplink:'GigabitEthernet0/1',access:'FastEthernet0/1',switchIp:i?'10.20.0.2':'192.168.1.254',vlan:'10',hostIf:'eth0',hostIp:i?'10.20.0.10':'192.168.1.10',
}]));
const nameOK = v => /^[A-Za-z][A-Za-z0-9._/-]{0,45}$/.test(v);
export function labScripts(lab) {
  const errors=validateInterfaces({bindInterfaces:true,...lab}),scripts=[];
  for(const side of ['a','b']) {
    const s=lab[side],label=`Side ${side.toUpperCase()}`,n=cidr(s.local);
    errors.push(...validateSecondVlan(s,lab[side==='a'?'b':'a']).map(e=>`${label}: ${e}`));
    if(!Object.hasOwn(PLATFORMS,s.vendor))errors.push(`${label}: choose a router vendor.`);
    if(ipv4(s.ip)===null)errors.push(`${label}: invalid WAN IP.`);
    const wan=cidr(`${s.ip}/${s.wanPrefix}`),gw=ipv4(s.gateway);
    if(!wan||gw===null||gw<wan.network||gw>wan.end||s.gateway===s.ip||+s.wanPrefix<31&&[wan.network,wan.end].includes(gw))errors.push(`${label}: ISP gateway must be a different usable host in the WAN subnet.`);
    if(!n||n.canonical!==s.local)errors.push(`${label}: enter a canonical LAN CIDR.`);
    if(!/^\d+$/.test(s.vlan)||+s.vlan<1||+s.vlan>4094)errors.push(`${label}: VLAN must be 1–4094.`);
    for(const key of ['uplink','access','hostIf'])if(!nameOK(s[key]))errors.push(`${label}: invalid ${key} interface.`);
    if(s.uplink===s.access)errors.push(`${label}: switch uplink and host port must differ.`);
    for(const key of ['switchIp','hostIp']) {const v=ipv4(s[key]);if(!n||v===null||v<=n.network||v>=n.end)errors.push(`${label}: ${key} must be a usable LAN host.`);}
    if(new Set([s.switchIp,s.hostIp,s.lanIp]).size!==3)errors.push(`${label}: router, switch and host IPs must differ.`);
    if(!Object.hasOwn(PLATFORMS,s.switchVendor))errors.push(`${label}: choose a switch vendor.`);
  }
  if(errors.length)return{errors:[...new Set(errors)],scripts:[]};
  for(const side of ['a','b']) {
    const s=lab[side],label=`Side ${side.toUpperCase()}`,prefix=s.local.split('/')[1],n=cidr(s.local);
    scripts.push({title:`${label} Router · ${PLATFORMS[s.vendor]} · Interface bindings`,code:hasSecondVlan(s)?dualVlanRouterConfig(s):interfaceConfig(s)});
    let code;
    if(s.switchVendor==='ios')code=`configure terminal\nvlan ${s.vlan}\n name NOC-LAN\n exit\ninterface ${s.uplink}\n switchport mode access\n switchport access vlan ${s.vlan}\n no shutdown\n exit\ninterface ${s.access}\n switchport mode access\n switchport access vlan ${s.vlan}\n spanning-tree portfast\n spanning-tree bpduguard enable\n no shutdown\n exit\ninterface Vlan${s.vlan}\n ip address ${s.switchIp} ${n.mask}\n no shutdown\n exit\nip default-gateway ${s.lanIp}\nend`;
    if(hasSecondVlan(s))code=dualVlanSwitchConfig(s);
    if(s.switchVendor==='mikrotik')code=`/interface bridge add name=noc-lan protocol-mode=rstp\n/interface bridge port add bridge=noc-lan interface=${s.uplink}\n/interface bridge port add bridge=noc-lan interface=${s.access} edge=yes bpdu-guard=yes\n/ip address add address=${s.switchIp}/${prefix} interface=noc-lan\n# Flat untagged LAN; VLAN ID is used only by VLAN-aware switch templates.`;
    if(s.switchVendor==='juniper')code=`configure\nset vlans NOC-LAN vlan-id ${s.vlan}\nset interfaces ${s.uplink} unit 0 family ethernet-switching interface-mode access\nset interfaces ${s.uplink} unit 0 family ethernet-switching vlan members NOC-LAN\nset interfaces ${s.access} unit 0 family ethernet-switching interface-mode access\nset interfaces ${s.access} unit 0 family ethernet-switching vlan members NOC-LAN\nset interfaces irb unit ${s.vlan} family inet address ${s.switchIp}/${prefix}\nset vlans NOC-LAN l3-interface irb.${s.vlan}\nexit`;
    scripts.push({title:`${label} Switch · ${PLATFORMS[s.switchVendor]}`,code:code||`# No Layer 2 switch template for ${PLATFORMS[s.switchVendor]} in this lab.\n# Select Cisco, MikroTik or Juniper for switch configuration.`,unsupported:!code});
    scripts.push({title:`${label} Computer · Linux host`,code:`sudo ip link set dev ${s.hostIf} up\nsudo ip address replace ${s.hostIp}/${prefix} dev ${s.hostIf}\nsudo ip route replace default via ${s.lanIp} dev ${s.hostIf}`});
  }
  return{errors:[],scripts};
}

const CSS=`.lab-canvas{margin:20px 0;padding:20px;border:1px solid #263853;border-radius:10px;background:#07111f;color:#cbd5e1;font:12px ui-monospace,monospace}.lab-canvas h3{color:#67e8f9;margin:0 0 10px}.lab-path{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;margin:20px 0}.lab-path span{overflow-wrap:anywhere;text-align:center;color:#67e8f9}.lab-cloud{border:1px solid #22d3ee77;border-radius:45%;padding:18px;box-shadow:0 0 20px #22d3ee17;color:#a5f3fc;text-align:center}.lab-sites{display:grid;grid-template-columns:1fr 1fr;gap:25px}.lab-device{border:1px solid #29415c;background:#0d1a2b;border-radius:8px;padding:14px;min-width:0}.lab-device h4{color:#e2e8f0;margin:0 0 12px}.lab-device h4:before{content:'●';color:#34d399;text-shadow:0 0 9px #34d399;margin-right:8px}.lab-canvas label{display:flex;flex-direction:column;gap:5px;font-size:10px;color:#94a3b8}.lab-canvas input,.lab-canvas select{width:100%;box-sizing:border-box;background:#050d18;border:1px solid #2b415d;border-radius:4px;padding:8px;color:#e2e8f0;font:11px ui-monospace,monospace}.lab-canvas input:focus,.lab-canvas select:focus{outline:2px solid #22d3ee}.lab-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.lab-wire{text-align:center;color:#67e8f9;padding:12px;overflow-wrap:anywhere}.lab-note{color:#94a3b8;font-size:11px;line-height:1.7}.lab-output{margin-top:16px}.lab-output summary{cursor:pointer;color:#67e8f9;padding:10px}.lab-output pre{background:#040a13;color:#a7f3d0;padding:14px;overflow:auto;max-height:320px;font:11px/1.8 ui-monospace,monospace}.lab-output button{border:1px solid #22d3ee77;color:#67e8f9;background:#103044;border-radius:4px;padding:8px;cursor:pointer}.lab-output button:disabled{opacity:.4}.lab-errors{color:#fcd34d;white-space:pre-line}.lab-canvas[data-invalid=true] h4:before{color:#fbbf24;text-shadow:0 0 9px #fbbf24}@media(max-width:720px){.lab-sites,.lab-grid{grid-template-columns:1fr}.lab-path{grid-template-columns:1fr}.lab-canvas{padding:12px}}`;
export function mountLab(root,{onChange=()=>{}}={}) {
  let state=createLab(),result,disposed=false;
  const controller=new AbortController();
  root.classList.add('lab-canvas');
  root.innerHTML=`<style>${CSS}</style><h3>UNIVERSAL NETWORK TOPOLOGY · EVE-NG STYLE</h3><p class="lab-note">Router → Switch → Computer on each site. Edit physical ports and IPs below; the six device outputs update immediately. This is a configuration model, not live connectivity. Feature commands appear separately below. In VPN mode router edits also update the VPN form.</p><div class="lab-path"><span data-path-a></span><div class="lab-cloud">☁ PUBLIC INTERNET / ISP<br><small>WAN transit · routed public path</small></div><span data-path-b></span></div><div class="lab-sites"></div><p role="status" class="lab-errors" data-lab-errors></p><div class="lab-output"></div><p role="status" class="lab-note" data-lab-feedback></p>`;
  const field=(side,key,label,select=false)=>{const l=document.createElement('label');l.textContent=label;const el=document.createElement(select?'select':'input');el.dataset.side=side;el.name=key;el.setAttribute('aria-label',`Side ${side.toUpperCase()} ${label}`);el.autocomplete='off';el.spellcheck=false;if(select)for(const [value,title]of Object.entries(select==='vlan2'?{off:'Disabled',on:'Enabled — routed trunk'}:PLATFORMS)){const o=document.createElement('option');o.value=value;o.textContent=title;el.append(o);}el.value=state[side][key];l.append(el);return l;};
  for(const side of ['a','b']){const site=document.createElement('section');site.setAttribute('aria-label',`Side ${side.toUpperCase()} topology`);for(const [title,fields]of[
    ['Router',[['vendor','Router vendor',true],['wan','Router WAN interface'],['ip','Public IPv4'],['wanPrefix','Public prefix'],['gateway','ISP gateway'],['lan','Router LAN interface'],['local','LAN network CIDR'],['lanIp','Router LAN IPv4']]],
    ['Switch',[['switchVendor','Switch vendor',true],['uplink','Switch router-facing interface'],['access','Switch host-facing interface'],['switchIp','Switch management IPv4'],['vlan','LAN VLAN ID'],['vlan2Enabled','Second VLAN mode','vlan2'],['vlan2','Second VLAN ID'],['vlan2Subnet','Second VLAN subnet (CIDR)'],['vlan2Gateway','Second VLAN router gateway IPv4'],['vlan2SwitchIp','Second VLAN switch SVI IPv4'],['vlan2Access','Second VLAN access interface']]],
    ['Computer / Host',[['hostIf','Host physical interface'],['hostIp','Host IPv4']]]]){const card=document.createElement('div');card.className='lab-device';card.dataset.labDevice=`${side}-${title==='Switch'?'switch':title==='Router'?'router':'host'}`;const h=document.createElement('h4');h.textContent=`SIDE ${side.toUpperCase()} // ${title}`;card.append(h);const grid=document.createElement('div');grid.className='lab-grid';for(const args of fields)grid.append(field(side,...args));card.append(grid);site.append(card);if(title!=='Computer / Host'){const wire=document.createElement('div');wire.className='lab-wire';wire.dataset.wire=`${side}-${title}`;site.append(wire);}}root.querySelector('.lab-sites').append(site);}
  function render(sync=false){
    if(sync)for(const el of root.querySelectorAll('[data-side]'))el.value=state[el.dataset.side][el.name];
    for(const el of root.querySelectorAll('[name^=vlan2]'))if(el.name!=='vlan2Enabled')el.closest('label').hidden=!hasSecondVlan(state[el.dataset.side]);
    result=labScripts(state);root.dataset.invalid=String(Boolean(result.errors.length));root.querySelector('[data-lab-errors]').textContent=result.errors.join('\n');
    for(const side of ['a','b']){const s=state[side];root.querySelector(`[data-path-${side}]`).textContent=`${s.wan} · ${s.ip}/${s.wanPrefix} ${side==='a'?'→ ISP':'← ISP'}`;root.querySelector(`[data-wire="${side}-Router"]`).textContent=`│ ${s.lan} ↔ ${s.uplink}${hasSecondVlan(s)?` · TRUNK VLAN ${s.vlan},${s.vlan2} · Gateway ${s.vlan2Gateway} · SVI ${s.vlan2SwitchIp}`:''} │`;root.querySelector(`[data-wire="${side}-Switch"]`).textContent=`│ ${s.access} ↔ ${s.hostIf} │`;}
    const out=root.querySelector('.lab-output');out.replaceChildren();
    result.scripts.forEach((script,i)=>{const d=document.createElement('details'),summary=document.createElement('summary');summary.textContent=script.title;const pre=document.createElement('pre');pre.tabIndex=0;pre.textContent=script.code;const b=document.createElement('button');b.type='button';b.textContent='Copy Config';b.dataset.labCopy=String(i);b.disabled=Boolean(script.unsupported);d.append(summary,b,pre);out.append(d);});
    root.querySelector('[data-lab-feedback]').textContent='';
  }
  root.addEventListener('input',e=>{const el=e.target;if(!el.dataset.side)return;const s=state[el.dataset.side];s[el.name]=el.value;if(el.name==='vendor')[s.wan,s.lan]=PORTS[el.value];if(el.name==='switchVendor'){const p=el.value==='ios'?['GigabitEthernet0/1','FastEthernet0/1']:PORTS[el.value];[s.uplink,s.access]=p;}render(el.name.endsWith('Vendor')||el.name==='vendor');onChange(structuredClone(state));},{signal:controller.signal});
  root.addEventListener('click',async e=>{const b=e.target.closest('[data-lab-copy]');if(!b||b.disabled)return;try{await navigator.clipboard.writeText(result.scripts[+b.dataset.labCopy].code);if(!disposed)root.querySelector('[data-lab-feedback]').textContent='Copied device configuration.';}catch{if(!disposed)root.querySelector('[data-lab-feedback]').textContent='Select the terminal text and copy manually.';}},{signal:controller.signal});
  render();
  return{set(next){for(const side of ['a','b'])if(next[side])state[side]={...state[side],...next[side]};render(true);},destroy(){disposed=true;controller.abort();root.replaceChildren();root.classList.remove('lab-canvas');}};
}
