import {cliProfile,legacyCiscoPair,supportsCiscoVti} from './cli-profile.js';
import {officeVtiAvailable,packetTracerPair,prepareOfficeVpnPair} from './office-vpn.js';
import {FORTIGATE_CATALOG} from './fortigate-models.js';
import {MIKROTIK_CATALOG} from './mikrotik-models.js';
import {selectSwitchModel,populateSwitchModels,renderSwitchModelInfo} from './switch-models.js';
import {CISCO_ROUTERS,selectRouterModel,populateRouterModels,renderRouterModelInfo,switchedLan,CATALOG_CHECKED_AT,CATALOG_LISTING} from './router-models.js';
import {terminalText,displayTerminalText} from './cli-export.js';
import { integrateConfiguration } from './config-integration.js';
import {analyzeConfiguration,additionsConfiguration,CONFIG_EXPORTS} from './configuration-analysis.js';
import { GATEWAY_PARTS, FEATURE_PARTS, gatewayParts } from './gateway-parts.js';
import { baselineFeatures, toggleFeature, vpnAvailable, suggestGateway } from './lab-policy.js';
import { mountSelectionMenu } from './selection-menu.js';
import {syncTopologyValues} from './topology-sync.js';
import { officeManagedFeatures, OFFICE_CARD_TITLES } from './preset-feedback.js';
import { maskSecrets } from './secret-mask.js';
import { hasSecondVlan } from './dual-vlan.js';
import { highlightCLI } from './terminal.js';
import { TOOLS } from './catalog.js';
import { PLATFORMS, PORTS } from './platforms.js';
import { FEATURES, CATEGORIES, forRole, VPN_TYPES, REMOTE_VPN_FIELDS, remoteDefaults, capable, featureDefaults, featureFields, boundValues } from './features.js';
import { composeDevice } from './compose.js';
import { createLab, labScripts, mountLab } from './lab.js';
import { mountDiagram } from './diagram.js';
import { mountPlanner } from './planner-ui.js';
import { WORKBENCH_CSS } from './workbench-style.js';
import { cidr, ipv4 } from './address.js';

export function mountWorkbench(vpnRoot){
  const abort=new AbortController(),shell=document.createElement('div');shell.className='noc-composer';
  shell.innerHTML=`<style>${WORKBENCH_CSS}
.noc-composer[data-office-vpn-lab=true] #vpn-advanced{display:none!important}
.noc-composer button[data-site-ipsec-preset]{background:#32204f;border-color:#a78bfa;color:#f3e8ff}
.noc-composer button[data-site-ipsec-preset]:not(:disabled):hover,.noc-composer button[data-site-ipsec-preset][aria-pressed=true]{background:#6d28d9;color:#fff}
.noc-demo{margin:24px 0;padding:clamp(14px,3vw,24px);border:1px solid #67e8f933;border-radius:14px;background:#0a1c29}
.noc-demo h2{font-size:1.35rem;margin:.4rem 0}
.noc-demo-path{list-style:none;padding:0;margin:16px 0;display:grid;grid-template-columns:1fr .85fr 1fr;gap:8px}
.noc-demo-path li{min-width:0;display:grid;gap:4px;padding:12px;border:1px solid #67e8f92b;border-radius:8px;background:#102432;color:#e5eff7}
.noc-demo-path span{font-size:.78rem;color:#b3cad9;overflow-wrap:anywhere}
.noc-preset-groups{display:grid;gap:16px;margin:14px 0}
.noc-preset-groups h4{font-weight:700;margin:0 0 4px}
@media(max-width:640px){.noc-demo-path{grid-template-columns:1fr}}
.noc-composer [data-peer-output]{margin-top:24px}.noc-composer [data-output-panel][data-paired=true] .noc-terminal pre{min-height:180px;max-height:260px}</style>
    <section class="noc-card noc-selection"><div class="noc-eyebrow">NETWORK OPERATIONS / ENGINEERING</div><h1 class="noc-hero-title">Multi-Vendor Network Configuration Workbench</h1><p class="noc-hero-copy">I build tools and lab environments for multi-vendor network engineering, with a focus on branch connectivity, secure device management, and repeatable configuration workflows.</p><div class="noc-actions"><span class="noc-chip">Multi-vendor templates</span><span class="noc-chip">Input validation</span><span class="noc-chip">CLI preview</span></div><p class="noc-muted noc-selection-instructions">NetMaster Pro generates device-specific CLI for Cisco, MikroTik RouterOS, Fortinet FortiGate, Juniper Junos, and Palo Alto Networks PAN-OS. Available features depend on the selected platform.</p><section class="noc-demo" aria-labelledby="branch-demo-title">
      <div class="noc-eyebrow">FEATURED LAB</div>
      <h2 id="branch-demo-title">Two-Site Cisco Branch Lab</h2>
      <p class="noc-muted">Connect two segmented branches using IKEv2 IPsec. Generate separate router and switch configurations with 802.1Q trunks, DHCP scopes, and NAT exemptions.</p>
      <ol class="noc-demo-path" aria-label="Branch lab topology">
        <li><strong>Site A</strong><span>SW1 ↔ R1 · VLANs 10 / 20</span><span>192.168.10.0/24 · 192.168.20.0/24</span></li>
        <li><strong>Routed WAN transit</strong><span>IKEv2 IPsec between R1 and R2</span></li>
        <li><strong>Site B</strong><span>R2 ↔ SW2 · VLANs 30 / 40</span><span>192.168.30.0/24 · 192.168.40.0/24</span></li>
      </ol>
      <div class="noc-actions"><button type="button" class="noc-generate" data-branch-demo>Run lab and generate 4 configs</button></div>
      <p class="noc-muted">Loads sample topology and lab credentials into the workbench. Validation checks inputs and generated configurations. Device behavior is verified separately.</p>
      <p data-demo-status role="status" class="noc-output-state"></p>
    </section>
    <details class="noc-feature-settings"><summary>Certification scope</summary><p class="noc-muted">CCNA and CCNP Enterprise topics covered by the labs.</p></details>
    <div class="noc-controls"><div class="noc-field">1 · Device vendor<select data-vendor aria-label="Device vendor"></select></div><div class="noc-field" data-model-field><span data-model-label>2 · Router model</span><input data-model-search aria-label="Search Cisco router models" placeholder="Search model or series" autocomplete="off"><select data-router-model aria-label="Router model"><option value="">Custom / other model</option></select></div><div class="noc-field">3 · Site<select data-side aria-label="Site"><option value="a">Side A · Local site</option><option value="b">Side B · Remote site</option></select></div></div><p class="noc-muted" data-catalog-status></p><div class="noc-muted" data-model-summary hidden></div><div class="noc-actions noc-tabs" role="group" aria-label="Device configuration"><button type="button" data-role="router"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="9" rx="2"/><path d="M7 12h.01M11 12h.01M7 8V4m10 4V4M7 20h10"/></svg>Router Configuration</button></div><p class="noc-muted noc-selection-note">Vendor applies to the selected site/device. Changing it clears that device’s selected features.</p></section>
    <section class="noc-card"><div class="noc-topology-note"><h3>LAB TOPOLOGY</h3><span class="noc-chip">CONFIGURATION MODEL · NOT LIVE TELEMETRY</span></div><p class="noc-muted">Click a node to configure it. Ports, addresses and gateways share the same model.</p><div data-diagram></div><section data-addresses aria-label="Interfaces, IP addresses and gateways"><h3>Interfaces, IP addresses &amp; gateways</h3><div data-bindings></div></section></section>
    <section class="noc-card"><h3 data-section-title>Configuration Workbench</h3><div class="noc-preset-groups">
      <section><h4>Branch Connectivity</h4><p class="noc-muted">Configure VLAN segmentation, DHCP, NAT, and site-to-site IPsec.</p><div class="noc-actions"><button type="button" class="noc-generate" data-office-preset>Branch Internet Gateway</button><button type="button" class="noc-generate" data-subinterface-preset>VLANs, DHCP &amp; NAT</button><button type="button" class="noc-generate" data-office-vpn-preset>Branch Gateway + IPsec</button><button type="button" class="noc-generate" data-subinterface-vpn-preset>Segmented Branches + IPsec</button></div></section>
      <section><h4>Routing &amp; Resilience</h4><p class="noc-muted">Configure campus and edge routing or WAN failover.</p><div class="noc-actions"><button type="button" class="noc-generate" data-routing-preset="wan_failover">Dual-ISP Failover</button><button type="button" class="noc-generate" data-routing-preset="ospf_advanced">Campus OSPF</button><button type="button" class="noc-generate" data-routing-preset="bgp">Internet Edge BGP</button></div></section>
      <section><h4>Management Plane</h4><p class="noc-muted">Configure device access, monitoring, and management APIs.</p><div class="noc-feature-grid" data-management-features></div></section>
    </div>
    <details class="noc-feature-settings"><summary>Lab &amp; compatibility templates</summary><p class="noc-muted">IKEv1 is deprecated. Use IKEv2 for new deployments on supported platforms. <a href="https://www.rfc-editor.org/rfc/rfc9395.html" target="_blank" rel="noopener noreferrer">RFC 9395</a></p><div class="noc-actions" data-compatibility-actions><button type="button" data-site-ipsec-preset aria-pressed="false">Cisco VTI · IKEv1 Compatibility</button></div></details>
    <div class="noc-preset-banner" data-preset-banner role="status" aria-live="polite" hidden><strong data-preset-heading></strong><div class="noc-preset-components" data-preset-components></div><p data-preset-detail></p><div><button type="button" data-preset-view>View generated configuration</button></div></div><p class="noc-muted" data-capability-note></p><div class="noc-categories" data-features></div><details data-presets class="noc-feature-settings"><summary>Initial deployment presets</summary><p class="noc-muted">Complete setup templates: use one preset alone.</p><div class="noc-feature-grid" data-preset-features></div></details><div data-settings></div><div data-vpn-slot hidden></div><div class="noc-actions"><button type="button" class="noc-generate" data-generate>Validate &amp; Generate CLI</button><span class="noc-muted">Validate inputs, then preview or export CLI.</span></div><p class="noc-host-note" data-host-note hidden>Linux iproute2 host addressing. Edit its IP and interface in the shared topology editor; its default gateway is the site router’s LAN address.</p></section>
    <section class="noc-card" data-existing-panel hidden inert><h3>Current Configuration · Analyze &amp; Add Services</h3><p class="noc-muted">Select the actual device vendor/model first. Paste one complete device configuration, analyze it, then select new services below. Detected services are shown separately and are not selected for regeneration. Analysis deselects detected services and complete setup presets; entered form values are kept. Analysis stays in this browser; no upload or storage.</p><p class="noc-note" data-export-help></p><label><input type="checkbox" data-integrate> Use current configuration when generating</label><label class="noc-field">Output mode<select data-existing-mode aria-label="Existing configuration output mode"><option value="additions">New commands only · all vendors</option><option value="merge">Unified configuration · Cisco IOS only</option></select></label><label>Current running configuration / CLI snippet<textarea data-existing aria-label="Existing running configuration" rows="10" maxlength="200000" spellcheck="false" class="noc-config-input" style="width:100%;background:#09090b;color:#cbd5e1;font-family:monospace;padding:1rem;border:1px solid #334155;border-radius:12px"></textarea></label><div class="noc-actions"><button type="button" data-analyze-config>Analyze current configuration</button><button type="button" data-apply-config-topology disabled>Use selected interface addresses</button></div><p class="noc-note" data-analysis-status role="status" aria-live="polite"></p><div data-analysis-services class="noc-actions"></div><label data-existing-nat-review hidden><input type="checkbox" data-existing-nat-exemption> Include required Cisco VPN PAT exemption update. For a single ACL-based PAT binding, create a new exemption ACL preserving its traffic rules and replace that binding. Existing static, multiple and custom route-map NAT require separate review.</label><div data-analysis-bindings hidden><label class="noc-field">Existing WAN interface<select data-analysis-wan aria-label="Existing WAN interface"></select></label><label class="noc-field">Existing LAN interface<select data-analysis-lan aria-label="Existing LAN interface"></select></label><p class="noc-muted">Review both choices. Applying imports these IP addresses and a detected default gateway; it does not change the selected model or existing device.</p></div></section><section class="noc-card" data-output-panel><div class="noc-topology-note"><h3 data-output-heading>ROUTER CONFIGURATION</h3><button type="button" data-clear-secrets>Clear all secrets</button></div><div class="noc-actions"><label><input type="checkbox" data-include-bindings> Include base interface / management bindings</label><label data-reveal-label><input type="checkbox" data-reveal> Reveal secrets</label></div><p class="noc-output-state" role="status" aria-live="polite" data-generation-status></p><p class="noc-error" role="alert" data-errors></p><p class="noc-muted" data-paste-guide hidden>Cisco IOS: paste at an empty Router# prompt; Ctrl+U clears the current line. At Router&gt;, run enable first. Use Copy Config or Download Config for plain text with real secrets. After configure terminal, expect Router(config)#.</p><div class="noc-terminal"><div class="noc-terminal-head"><strong data-output-title></strong><div class="noc-terminal-actions"><button type="button" data-clear-output title="Clear the generated snapshot; keep selected features and form values">Clear</button><button type="button" data-download-config disabled title="Download the complete configuration, including secrets">Download Config</button><button type="button" data-copy-config title="Copy the complete configuration, including secrets" disabled>Copy Config</button></div></div><pre tabindex="0" aria-label="Selected device configuration"><code data-code></code></pre></div><p class="noc-note" role="status" data-copy-status></p><section data-switch-output hidden><div class="noc-terminal"><div class="noc-terminal-head"><strong data-switch-output-title></strong><div class="noc-terminal-actions"><button type="button" data-download-switch>Download Switch Config</button><button type="button" data-copy-switch>Copy Switch Config</button></div></div><pre tabindex="0" aria-label="Cisco switch configuration"><code data-switch-code></code></pre></div><p role="status" data-switch-status></p></section><section data-peer-output hidden><div class="noc-terminal"><div class="noc-terminal-head"><strong data-peer-output-title>SIDE B // Cisco ROUTER</strong><div class="noc-terminal-actions"><button type="button" data-download-peer disabled>Download Side B Config</button><button type="button" data-copy-peer disabled>Copy Side B Config</button></div></div><pre tabindex="0" aria-label="Side B router configuration"><code data-peer-code></code></pre></div><p class="noc-note" role="status" data-peer-copy-status></p></section><details data-windows-ping-help hidden><summary>Windows hosts · allow VPN ping</summary><p class="noc-muted">Run each command in PowerShell as Administrator on the corresponding Windows computer. Allows inbound ICMP echo only from the opposite site, without disabling Windows Firewall. These host commands are separate from the router Copy / Download configurations.</p><p>Side A Windows computer</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere" tabindex="0"><code data-windows-ping-a></code></pre><p>Side B Windows computer</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere" tabindex="0"><code data-windows-ping-b></code></pre></details><p class="noc-muted">Review interfaces, addressing, policy order, and platform requirements before applying. Validate and commit candidate changes separately on Junos and PAN-OS.</p></section>
<details class="noc-card"><summary>Planning utility · VLSM subnet planner</summary><div data-planner></div></details>`;
  vpnRoot.before(shell);vpnRoot.classList.add('noc-vpn');shell.querySelector('[data-vpn-slot]').append(vpnRoot);
  const find=s=>shell.querySelector(s),vendorInput=find('[data-vendor]'),settings=find('[data-settings]');
  const firstSwitchPanel=find('[data-switch-output]');
  const secondSwitchPanel=firstSwitchPanel.cloneNode(true);
  secondSwitchPanel.removeAttribute('data-switch-output');
  secondSwitchPanel.setAttribute('data-peer-switch-output','');
  find('[data-peer-output]').after(firstSwitchPanel,secondSwitchPanel);
  const switchPanels=[firstSwitchPanel,secondSwitchPanel].map((panel,index)=>{
    const wiring=document.createElement('p');
    wiring.className='noc-muted';
    panel.prepend(wiring);
    return {panel,index,wiring,find:selector=>panel.querySelector(selector)};
  });
  find('[data-features]').closest('.noc-card').before(find('[data-existing-panel]'));
  for(const[value,title]of Object.entries(PLATFORMS)){const o=document.createElement('option');o.value=value;o.textContent=title;vendorInput.append(o);}
  let demoKey=null,submittedKey='',outputCleared=false,officePreset={a:false,b:false},customOffice={a:false,b:false},companion=null,pairResults=null;
  let lab=createLab(),side='a',role='router',vpnConfig=null,vpnType='ikev2',result={errors:[],code:'',empty:true},disposed=false,syncing=false,submitted=false,generatedSecret=false;
  for(const site of Object.values(lab))site.routerOnly=true;
  const existingContexts={a:{router:{enabled:false,text:'',mode:'additions',report:null,analyzedVendor:''},switch:{enabled:false,text:'',mode:'additions',report:null,analyzedVendor:''},host:{enabled:false,text:'',mode:'additions',report:null,analyzedVendor:''}},b:{router:{enabled:false,text:'',mode:'additions',report:null,analyzedVendor:''},switch:{enabled:false,text:'',mode:'additions',report:null,analyzedVendor:''},host:{enabled:false,text:'',mode:'additions',report:null,analyzedVendor:''}}};
  const selection={a:{router:baselineFeatures(lab.a.vendor),switch:{}},b:{router:baselineFeatures(lab.b.vendor),switch:{}}},values={a:{router:{},switch:{}},b:{router:{},switch:{}}},binding={a:{router:false,switch:false},b:{router:false,switch:false}};
  const remote={a:{openvpn:remoteDefaults('openvpn'),ssl:remoteDefaults('ssl')},b:{openvpn:remoteDefaults('openvpn'),ssl:remoteDefaults('ssl')}};
  const modelInput=find('[data-router-model]');populateRouterModels(modelInput);
  const catalogStatus=find('[data-catalog-status]');catalogStatus.append(document.createTextNode(CISCO_ROUTERS.length+' models · Cisco official-source catalog · Checked '+CATALOG_CHECKED_AT+' · '));const catalogLink=document.createElement('a');catalogLink.href=CATALOG_LISTING;catalogLink.target='_blank';catalogLink.rel='noopener noreferrer';catalogLink.textContent='Cisco router directory ↗';catalogStatus.append(catalogLink);const ciscoCatalogStatus=catalogStatus.innerHTML;
  const selectionMenus=[vendorInput,modelInput,find('[data-side]')].map(input=>mountSelectionMenu(input,abort.signal));
  const chosenModel=()=>lab[side][role==='switch'?'switchModel':'routerModel']||'';
  const chosenVendor=()=>role==='switch'?lab[side].switchVendor:lab[side].vendor;
  const selected=()=>role==='host'?{}:selection[side][role];
  function dataFor(id,contextSide){const activeSide=contextSide??side,vendor=role==='switch'?lab[activeSide].switchVendor:lab[activeSide].vendor;const bag=values[activeSide][role];if(!bag[id]){const d=featureDefaults(id,vendor),s=lab[activeSide],n=cidr(s.local);if(id==='internet_access'&&values[activeSide].router.wan_failover?.virtualRouter)d.virtualRouter=values[activeSide].router.wan_failover.virtualRouter;if(id==='wan_failover'&&activeSide==='b'){d.ip2='192.0.2.6';d.gateway2='192.0.2.5';}if(id==='ospf'){d.networks=n?`${n.ip} ${n.wildcard}`:'';d.ospfInterfaces=`${s.lan}.${hasSecondVlan(s)?s.vlan:'0'}`;d.routerId=s.lanIp;}if(['bgp','ospf3','ospf_advanced','eigrp'].includes(id))d.routerId=s.lanIp;if(['relay','fhrp','glbp','qos','ospf3','ospf_advanced','eigrp','pbr','multicast'].includes(id))d.interface=s.lan;if(role==='switch'&&vendor==='ios'&&['fhrp','glbp'].includes(id))d.interface='Vlan'+s.vlan;if(id==='eigrp')d.network=s.local;if(['fhrp','glbp'].includes(id)&&n){let candidate=n.end-1;const text=v=>[24,16,8,0].map(b=>(v>>>b)&255).join('.');while([s.lanIp,s.switchIp,s.hostIp].includes(text(candidate))&&candidate>n.network+1)candidate--;d.virtualIp=text(candidate);}if(['vlan','security'].includes(id)){d.interface=s.access;d.vlan=s.vlan;}if(id==='static')d.nextHop=s.gateway;if(id==='bgp')d.neighbor=lab[activeSide==='a'?'b':'a'].lanIp;if(id==='portforward')d.internalIp=s.hostIp;if(id==='nat')d.insideHost=s.hostIp;if(id==='gre_tunnel'){d.source=s.ip;d.peer=lab[activeSide==='a'?'b':'a'].ip;d.remoteNetwork=lab[activeSide==='a'?'b':'a'].local;d.address=activeSide==='a'?'172.16.200.1/30':'172.16.200.2/30';}if(['bfd','urpf'].includes(id))d.interface=s.wan;if(id==='isis')d.interface=s.lan;if(id==='hardening'&&role==='router'){d.hostname=activeSide==='b'?'R2':'R1';d.sshSources=s.local;}if(id==='ntp_syslog')d.ntp='129.250.35.251';if(id==='ipsla'){d.sourceInterface=s.wan;d.target=s.gateway;}for(const f of featureFields(id,vendor))if(!Object.hasOwn(d,f.key))d[f.key]=f.value;if(id==='dhcp'&&vendor==='ios'&&n){const text=v=>[24,16,8,0].map(b=>(v>>>b)&255).join('.');d.exclusions=text(n.network+1)+' '+text(Math.min(n.end-1,n.network+20));}if(id==='dhcp'&&vendor!=='ios'&&n){const text=v=>[24,16,8,0].map(b=>(v>>>b)&255).join('.');d.poolStart=text(n.network+Math.min(50,Math.max(2,Math.floor((n.end-n.network)/4))));d.poolEnd=text(n.end-1);}bag[id]=d;}return bag[id];}
  const hasOfficePair=()=>['a','b'].some(key=>selection[key].router.vpn&&values[key].router.internet_access?.officeVpn);
  const subinterfaceVpnActive=()=>['a','b'].some(key=>Boolean(selection[key].router.vpn&&values[key].router.internet_access?.officeVpn&&values[key].router.internet_access.officeSubinterfaceVpn));
  function configureOfficePair(dual=subinterfaceVpnActive()){
    if(dual&&['a','b'].some(key=>lab[key].vendor!=='ios'))return;
    if(['a','b'].some(key=>!['ios','mikrotik','fortinet'].includes(lab[key].vendor)))return;
    for(const key of ['a','b']){
      const site=lab[key],clock=values[key].router.ntp_syslog,previous=values[key].router.internet_access||{};
      selection[key].router={internet_access:true,vpn:true,ntp_syslog:true};selection[key].switch={};
      values[key].router={internet_access:{...featureDefaults('internet_access',site.vendor),...previous,standardOffice:true,officeVpn:true,officeSubinterfaceVpn:dual,parts:{interfaces:true,nat:true,route:true,firewall:false,dhcp:true,dns:true}},ntp_syslog:{...featureDefaults('ntp_syslog',site.vendor),...(clock||{})}};
      values[key].switch={};binding[key].router=true;binding[key].switch=false;officePreset[key]=true;customOffice[key]=false;site.vlan2Enabled='off';site.officeVlans=false;site.officeSubinterfaces=false;
      if(dual)configureOfficeSubinterfaces(key);
    }
  }
  function topologyToVpn(){if(syncing)return;syncing=true;vpnRoot.dispatchEvent(new CustomEvent('lab-edit',{detail:lab}));syncing=false;}
  const multiSite=()=>['a','b'].some(s=>selection[s].router.vpn||selection[s].router.dmvpn||selection[s].router.gre_tunnel||selection[s].router.vxlan);
  const validationSides=()=>multiSite()?['a','b']:[side];
  function redraw(){shell.dataset.officeVpnLab=String(Boolean(selected().vpn&&values[side].router.internet_access?.officeVpn&&packetTracerPair(lab)));const multi=multiSite();shell.dataset.multi=String(multi);const shown=structuredClone(lab);for(const s of ['a','b'])if(selection[s].router.wan_failover)Object.assign(shown[s],{wan2Enabled:true,...values[s].router.wan_failover});diagram.update(shown,`${side}.${role}`,Boolean(labScripts(lab,{sides:validationSides(),routerOnly:true}).errors.length),multi,side);editor.set(lab);for(const site of find('[data-bindings]').querySelectorAll('.lab-sites>section'))site.hidden=!multi&&site.getAttribute('aria-label')!==`Side ${side.toUpperCase()} topology`;}
  const diagram=mountDiagram(find('[data-diagram]'),(s,r)=>{side=s;role=r;renderContext();const target=find(`[data-lab-device="${s}-${r}"]`);target?.scrollIntoView({block:'center',behavior:'smooth'});const input=target?.querySelector('button:not(:disabled),input:not([hidden])');input?.focus({preventScroll:true});},{routerOnly:true});
  const editor=mountLab(find('[data-bindings]'),{routerOnly:true,showDeviceOutputs:false,getSides:validationSides,onChange(next){const keepCombined=hasOfficePair();for(const s of ['a','b'])for(const r of ['router','switch'])if(lab[s][r==='router'?'vendor':'switchVendor']!==next[s][r==='router'?'vendor':'switchVendor']){selection[s][r]=r==='router'?baselineFeatures(next[s].vendor):{};values[s][r]={};binding[s][r]=false;}for(const site of ['a','b'])for(const device of ['router','switch'])syncTopologyValues(values[site][device],lab[site],next[site],device);lab=next;if(keepCombined)configureOfficePair();for(const s of ['a','b'])for(const key of ['vlan','security'])if(values[s].switch[key]){values[s].switch[key].interface=lab[s].access;values[s].switch[key].vlan=lab[s].vlan;}topologyToVpn();renderContext();}});
  const stopPlanner=mountPlanner(find('[data-planner]'));
  function onVpnState(e){const keepCombined=hasOfficePair();let changed=false;const suiteChanged=vpnConfig?.compatibility!==e.detail.compatibility;vpnConfig=e.detail;if(!['openvpn','ssl'].includes(vpnType))vpnType=e.detail.protocol;for(const s of ['a','b']){const previous={...lab[s]};if(lab[s].vendor!==e.detail[s].vendor){const vpn=selection[s].router.vpn;selection[s].router={vpn};values[s].router={};binding[s].router=false;changed=true;}for(const key of ['vendor','ip','local','lanIp','wan','lan','wanPrefix','gateway'])lab[s][key]=e.detail[s][key];for(const device of ['router','switch'])syncTopologyValues(values[s][device],previous,lab[s],device);}if(changed){if(keepCombined)configureOfficePair();renderContext();}else{if(suiteChanged)renderSettings();redraw();vendorInput.value=chosenVendor();selectionMenus.forEach(refresh=>refresh());renderOutput();}}
  vpnRoot.addEventListener('vpn-state',onVpnState,{signal:abort.signal});
  const gatewayData=()=>values[side].router.internet_access||(values[side].router.internet_access=featureDefaults('internet_access',lab[side].vendor));
  function setGatewayPart(key,enabled){
    const data=gatewayData();data.parts={...gatewayParts(data),[key]:enabled};customOffice[side]=true;
    if(FEATURE_PARTS.static===key)selection[side].router.static=false;
    if(key==='nat')selection[side].router.nat=false;
    if(key==='firewall')selection[side].router.zbfw=false;
    if(key==='dhcp')selection[side].router.dhcp=false;
    if(key==='route'&&!enabled){selection[side].router.wan_failover=false;selection[side].router.ipsla=false;}
    renderContext();
  }
  function removePresetChip(key){
    submitted=false;companion=null;result={errors:[],code:'',empty:true};
    customOffice[side]=true;gatewayData().parts=gatewayParts(gatewayData());
    if(Object.hasOwn(GATEWAY_PARTS,key)){setGatewayPart(key,false);return;}
    if(key==='switch'){officePreset[side]=false;binding[side].switch=false;selection[side].switch={};}
    else if(key==='vlans'){lab[side].vlan2Enabled='off';lab[side].officeVlans=false;lab[side].officeSubinterfaces=false;binding[side].switch=false;topologyToVpn();}
    else if(key==='wan_failover'||key==='ipsla'){selection[side].router.wan_failover=false;selection[side].router.ipsla=false;}
    else if(key==='vpn')selection.a.router.vpn=selection.b.router.vpn=false;
    else selection[side].router[key]=false;
    renderContext();
  }
  function paintPresetBanner(){
    find('[data-site-ipsec-preset]').setAttribute('aria-pressed',String(referenceVtiActive()));
    const active=Boolean(selection[side].router.internet_access),banner=find('[data-preset-banner]');
    const site=lab[side],router=selection[side].router,data=values[side].router.internet_access;
    const vpnActive=Boolean(active&&router.vpn&&data?.officeVpn);
    const subinterfacesActive=Boolean(active&&site.officeSubinterfaces&&site.vlan2Enabled==='on');
    const states=[
      [find('[data-office-preset]'),active&&officePreset[side]&&!customOffice[side]&&!vpnActive&&!subinterfacesActive],
      [find('[data-subinterface-preset]'),subinterfacesActive&&!vpnActive],
      [find('[data-subinterface-vpn-preset]'),subinterfacesActive&&vpnActive],
      [find('[data-office-vpn-preset]'),vpnActive&&!subinterfacesActive],
      ...Array.from(shell.querySelectorAll('[data-routing-preset]'),button=>[button,Boolean(router[button.dataset.routingPreset])])
    ];
    for(const [button,isActive] of states){
      const pressed=role==='router'&&isActive;
      button.setAttribute('aria-pressed',String(pressed));
      button.classList.toggle('noc-copied',pressed);
    }
    banner.hidden=!active;
    if(!active)return;
    const custom=customOffice[side],parts=gatewayParts(gatewayData());
    find('[data-preset-heading]').textContent=(custom?'Custom configuration':selected().vpn&&gatewayData().officeVpn?(subinterfacesActive?'Office Subinterfaces + VPN active':'Office Internet Gateway + VPN active'):subinterfacesActive?'Office Subinterfaces active':'Office Internet Gateway active')+(role==='router'&&submitted&&!result.errors.length&&!result.empty?' / Configuration ready':role==='router'&&submitted&&result.errors.length?' / Review required':' / Draft');
    const components=Object.entries(GATEWAY_PARTS).filter(([key])=>parts[key]);
    if(officePreset[side]&&binding[side].switch)components.push(['switch','Switch addressing & access ports']);
    if(selected().vpn&&gatewayData().officeVpn)components.push(['vpn','Site-to-site IPsec + NAT exemption']);
    if(hasSecondVlan(lab[side]))components.push(['vlans',`VLAN ${lab[side].vlan} + VLAN ${lab[side].vlan2}`]);
    for(const [key,label]of [['wan_failover','Dual ISP / WAN failover'],['ipsla','Linked IP SLA tracking'],['hardening','SSH / Hardening'],['ntp_syslog','NTP']])if(selection[side].router[key])components.push([key,label]);
    const chips=find('[data-preset-components]');chips.replaceChildren();for(const [key,title]of components){const button=document.createElement('button');button.type='button';button.dataset.removePreset=key;button.textContent=title;button.setAttribute('aria-label','Remove '+title);button.title='Remove '+title+' and customize this configuration';button.addEventListener('click',()=>{removePresetChip(key);find('[data-preset-components] button')?.focus({preventScroll:true});},{signal:abort.signal});chips.append(button);}
    find('[data-preset-view]').textContent=submitted&&result.errors.length?'Review validation messages':'View generated configuration';
    find('[data-preset-detail]').textContent=custom?'Preset mode is off. Click any chip to remove it, or toggle individual gateway components below. Shared addresses stay in the topology; only enabled components generate commands.':'Click any chip to remove that feature and switch to a custom configuration. Remaining features and entered values are preserved. Only selected components contribute commands.';
    if(selected().vpn&&gatewayData().officeVpn&&!submitted)find('[data-preset-detail]').textContent=subinterfacesActive?'Enter matching PSKs and generate. Both router and both switch configurations appear together, with the cable ports for each switch.':'Quick Setup + VPN is selected on both router sites. Enter matching PSKs below (or use Generate shared PSK), then generate both scripts together below.';
  }
  const existingContext=()=>existingContexts[side][role];
  function paintAnalysis(){
    const ctx=existingContext(),report=ctx.report,valid=report&&!report.errors.length&&ctx.analyzedVendor===chosenVendor();
    find('[data-export-help]').textContent='Recommended export for '+(PLATFORMS[chosenVendor()]||chosenVendor())+': '+(CONFIG_EXPORTS[chosenVendor()]||'Select a router vendor')+'. Junos and PAN-OS require set-format output.';
    find('[data-existing-mode]').value=ctx.mode||'additions';find('[data-existing-mode] option[value=merge]').disabled=chosenVendor()!=='ios';
    const status=find('[data-analysis-status]');status.textContent=!report?'Paste a configuration and click Analyze. Choose only the new services you want to add.':ctx.analyzedVendor!==chosenVendor()?'Vendor changed. Analyze this configuration again for the selected vendor.':report.errors.length?report.errors.join(' '):(report.firmware?'Firmware '+report.firmware+' · ':'')+report.commands+' commands analyzed · '+Object.keys(report.detected).length+' configured services found. Detection is not live telemetry. Only new commands are exported in additions mode.';
    find('[data-existing-nat-review]').hidden=!(valid&&chosenVendor()==='ios'&&report.detected.nat);find('[data-existing-nat-exemption]').checked=Boolean(ctx.includeNatExemption);
    const services=find('[data-analysis-services]');services.replaceChildren();if(valid){for(const [id,evidence]of Object.entries(report.detected)){const label=document.createElement('label');label.className='noc-chip';const input=document.createElement('input');input.type='checkbox';input.checked=true;input.disabled=true;const text=document.createElement('span');text.textContent=(FEATURES[id]?.title||{interfaces:'IPv4 interface bindings',dns:'DNS / resolver',firewall:'Firewall policy'}[id]||id)+' · already configured';label.title='Command evidence on line(s) '+evidence.lines.join(', ');label.append(input,text);services.append(label);}if(!services.children.length)services.textContent='No known service patterns found. Unknown commands remain on the device.';}
    find('[data-analysis-bindings]').hidden=!valid||!report.interfaces.length;find('[data-apply-config-topology]').disabled=!valid||report.interfaces.length<2||role!=='router';
    for(const kind of ['wan','lan']){const select=find('[data-analysis-'+kind+']'),previous=select.value;select.replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent='Select the actual '+kind.toUpperCase()+' interface';select.append(blank);if(valid)for(const item of report.interfaces){const option=document.createElement('option');option.value=item.id;option.textContent=item.id+' · '+item.ip+'/'+item.prefix;select.append(option);}select.value=valid&&report.interfaces.some(i=>i.id===previous)?previous:report?.[kind==='wan'?'suggestedWan':'suggestedLan']||'';}
    for(const input of shell.querySelectorAll('[data-feature]')){const label=input.closest('label');label.querySelector('[data-existing-badge]')?.remove();if(valid&&report.detected[input.dataset.feature]){const badge=document.createElement('small');badge.dataset.existingBadge='';badge.className='noc-preset-badge';badge.textContent='Already configured · select only to extend';label.append(badge);}}
  }
  function applyExisting(output,item,vendor){
    if(!item.integration.enabled||output.errors.length||output.empty)return output;
    if(item.integration.mode!=='additions')return integrateConfiguration(item.integration.text,output.code,vendor);
    if(!item.integration.report||item.integration.analyzedVendor!==vendor||item.integration.report.errors.length)return {errors:['Analyze the current configuration for this vendor before generating additions.'],code:'',empty:false};
    const target=item.side,peer=target==='a'?'b':'a';return additionsConfiguration(item.integration.text,output.code,vendor,{selected:item.selected,site:item.lab[target],peer:item.lab[peer],includeNatExemption:Boolean(item.integration.includeNatExemption)});
  }
  function clearOfficePreset(){selection[side].router.internet_access=false;officePreset[side]=false;binding[side].router=binding[side].switch=false;renderContext();}
  function switchExport(index){
    const key=pairResults?(index===0?'a':'b'):side;
    const output=pairResults?pairResults[key].switchOutput:index===0?companion:null;
    const site=lab[key];
    const context={vendor:'ios',role:'switch',model:site.switchModel};
    return {key,site,context,code:submitted&&!result.errors.length?output?.code:null};
  }
  function paintOutput(){
    if(!submitted||submittedKey!==demoKey)find('[data-demo-status]').textContent='';
    paintPresetBanner();
    const outputSide=pairResults?'a':side;find('[data-output-panel]').dataset.paired=String(Boolean(pairResults));
    find('[data-output-heading]').textContent=existingContext().enabled&&existingContext().mode==='additions'?'NEW CONFIGURATION COMMANDS':pairResults?'CONFIGURATION PREVIEW · SIDE A + SIDE B':role==='router'?'CONFIGURATION PREVIEW':role==='switch'?'SWITCH CONFIGURATION':'HOST CONFIGURATION';
    const vendor=pairResults?lab.a.vendor:chosenVendor(),outputModel=pairResults?lab.a.routerModel:chosenModel();find('[data-paste-guide]').hidden=vendor!=='ios'||role==='host'||!submitted||Boolean(result.errors.length||result.empty);find('[data-reveal-label]').hidden=!submitted||!generatedSecret;
    find('[data-errors]').textContent=submitted?result.errors.join('\n'):'';if(submitted&&!result.errors.length&&result.warnings?.length)find('[data-errors]').textContent=result.warnings.join('\n');
    find('[data-output-title]').textContent='SIDE '+outputSide.toUpperCase()+' // '+(role==='host'?'LINUX HOST':PLATFORMS[vendor]+' '+role.toUpperCase());
    find('[data-code]').textContent=!submitted?(outputCleared?'// Output cleared. Click Validate & Generate CLI to build CLI.':'// Draft changed. Click Validate & Generate CLI to validate and build CLI.'):result.errors.length?'// Validation failed. No partial configuration is emitted.':result.empty?'// Select at least one feature or include interface bindings.':displayTerminalText(find('[data-reveal]').checked?result.code:maskSecrets(result.code),{vendor,role,model:outputModel});
    find('[data-code]').parentElement.setAttribute('aria-label',pairResults?'Side A router configuration':'Selected device configuration');
    highlightCLI(find('[data-code]'));
    for(const {panel,index,wiring,find:findSwitch} of switchPanels){
      const {key,site,context,code}=switchExport(index);
      const label='Side '+key.toUpperCase()+' Switch';
      panel.hidden=!code;
      findSwitch('[data-switch-output-title]').textContent=label+' // '+(site.switchModel||'Cisco');
      findSwitch('[data-copy-switch]').textContent='Copy '+label+' Config';
      findSwitch('[data-download-switch]').textContent='Download '+label+' Config';
      findSwitch('[data-copy-switch]').disabled=findSwitch('[data-download-switch]').disabled=!code;
      wiring.textContent=code&&site.officeSubinterfaces
        ?`Router ${site.lan} ↔ switch ${site.uplink} (trunk) · VLAN ${site.vlan} clients → ${site.access} · VLAN ${site.vlan2} clients → ${site.vlan2Access}`
        :'';
      wiring.hidden=!wiring.textContent;
      const preview=findSwitch('[data-switch-code]');
      preview.parentElement.setAttribute('aria-label',label+' configuration');
      preview.textContent=code?displayTerminalText(code,context):'';
      findSwitch('[data-switch-status]').textContent='';
      if(code)highlightCLI(preview);
    }
    const peerReady=Boolean(submitted&&pairResults&&!result.errors.length);find('[data-peer-output-title]').textContent='SIDE B // '+(PLATFORMS[lab.b.vendor]||lab.b.vendor)+' ROUTER';find('[data-peer-output]').hidden=!peerReady;find('[data-copy-peer]').disabled=find('[data-download-peer]').disabled=!peerReady;find('[data-copy-peer]').textContent='Copy Side B Config';find('[data-peer-copy-status]').textContent='';find('[data-peer-code]').textContent=peerReady?displayTerminalText(find('[data-reveal]').checked?pairResults.b.code:maskSecrets(pairResults.b.code),{vendor:lab.b.vendor,role:'router',model:lab.b.routerModel}):'';if(peerReady)highlightCLI(find('[data-peer-code]'));
    find('[data-windows-ping-help]').hidden=!peerReady;
    for(const key of ['a','b'])find('[data-windows-ping-'+key+']').textContent=peerReady?`New-NetFirewallRule -DisplayName "NOC VPN Ping from Site ${key==='a'?'B':'A'}" -Direction Inbound -Protocol ICMPv4 -IcmpType 8 -RemoteAddress ${[lab[key==='a'?'b':'a'].local,...(subinterfaceVpnActive()?[lab[key==='a'?'b':'a'].vlan2Subnet]:[])].join(',')} -Action Allow -Profile Any`:'';
    find('[data-copy-config]').textContent=pairResults?'Copy Side A Config':'Copy Config';find('[data-download-config]').textContent=pairResults?'Download Side A Config':'Download Config';find('[data-copy-config]').classList.remove('noc-copied');
    find('[data-copy-config]').disabled=!submitted||Boolean(result.empty||result.errors.length||!result.code);
    find('[data-generation-status]').textContent=!submitted?'Awaiting submission':result.errors.length?'Validation failed · review the messages below':result.empty?(existingContext().enabled&&existingContext().mode==='additions'?'No new commands required':'No features selected'):pairResults?'Generated · Side A + Side B · ready to copy':`Generated · ${displayTerminalText(result.code,{vendor,role,model:outputModel}).trimEnd().split('\n').length} lines · ready to copy`;
    find('[data-generation-status]').dataset.state=!submitted?'draft':result.errors.length?'error':result.empty?'empty':'ready';
    find('[data-download-config]').disabled=!submitted||!result.code||Boolean(result.errors.length);const noBindings=role==='router'&&selected().internet_access&&gatewayData().parts?.interfaces===false;const automatic=role==='router'&&(selected().internet_access||selected().wan_failover);const checkbox=find('[data-include-bindings]');checkbox.checked=!noBindings&&(role==='host'||hasSecondVlan(lab[side])||automatic||binding[side][role]);checkbox.disabled=noBindings||role==='host'||hasSecondVlan(lab[side])||Boolean(automatic);
  }
  function inputSnapshot(targetSide=side){
    if(role==='router'&&selection[targetSide].router.wan_failover&&lab[targetSide].vendor==='ios'&&selection[targetSide].router.ipsla){const sla=dataFor('ipsla',targetSide);sla.target=lab[targetSide].gateway;sla.sourceInterface=lab[targetSide].wan;}const ids=role==='host'?{}:selection[targetSide][role],vendor=role==='switch'?lab[targetSide].switchVendor:lab[targetSide].vendor,data=Object.fromEntries(Object.keys(ids).filter(id=>ids[id]).map(id=>[id,{...dataFor(id,targetSide),vendor}]));
    return {integration:{...existingContexts[targetSide][role]},lab:structuredClone(lab),side:targetSide,role,selected:{...ids},values:data,bindings:role==='host'||hasSecondVlan(lab[targetSide])||binding[targetSide][role],vpnConfig:ids.vpn&&referenceVtiActive()?{...vpnConfig,referenceVti:true,a:{...vpnConfig.a,lanVlan:values.a.router.vpn.lanVlan},b:{...vpnConfig.b,lanVlan:values.b.router.vpn.lanVlan}}:ids.vpn?vpnConfig:null,vpnType:ids.vpn?vpnType:undefined,remote:ids.vpn?(remote[targetSide][vpnType]||{}):{},linkedEnterprise:selection[targetSide].router.enterprise?values[targetSide].router.enterprise:null,officeSwitch:role==='router'&&officePreset[targetSide]?structuredClone({selected:selection[targetSide].switch,values:values[targetSide].switch}):null};
  }
  const referenceVtiActive=()=>role==='router'&&vpnType==='vti'&&['a','b'].every(key=>selection[key].router.vpn&&values[key].router.vpn?.referenceVti);
  const pairedOffice=()=>role==='router'&&['a','b'].every(key=>selection[key].router.vpn&&selection[key].router.internet_access&&values[key].router.internet_access?.officeVpn);
  function renderOutput(generateNow=false){
    let snapshot,key,pairSnapshots;
    try{pairSnapshots=(pairedOffice()||referenceVtiActive())?{a:inputSnapshot('a'),b:inputSnapshot('b')}:null;snapshot=pairSnapshots?pairSnapshots.a:inputSnapshot();key=JSON.stringify(pairSnapshots||snapshot);}catch(error){snapshot=null;key='invalid-input';if(generateNow!==true){submitted=false;result={errors:[],code:'',empty:true};companion=null;pairResults=null;paintOutput();return;}}
    if(generateNow!==true){if(submitted&&submittedKey===key){paintOutput();return;}submitted=false;outputCleared=false;result={errors:[],code:'',empty:true};companion=null;pairResults=null;find('[data-copy-status]').textContent='';paintOutput();return;}
    try{
      if(!snapshot)throw Error('Configuration inputs could not be read. Reselect the feature and try again.');
      pairResults=null;companion=null;
      if(pairSnapshots){
        const outputs={},errors=[];
        for(const key of ['a','b']){
          const item=pairSnapshots[key];let output=composeDevice(item);
          if(item.integration.enabled&&!output.errors.length&&!output.empty)output=applyExisting(output,item,item.lab[key].vendor);
          if(item.lab[key].officeSubinterfaces&&!output.errors.length){
            const switchOutput=composeDevice({...item,role:'switch',selected:{},values:{},bindings:true,linkedEnterprise:null});
            if(switchOutput.errors.length)errors.push(...switchOutput.errors.map(message=>'Side '+key.toUpperCase()+' switch: '+message));
            output={...output,switchOutput};
          }
          outputs[key]=output;errors.push(...output.errors.map(message=>'Side '+key.toUpperCase()+': '+message));
        }
        if(errors.length)result={errors,code:'',empty:false};
        else{pairResults=outputs;result=outputs.a;}
      }else{
      result=composeDevice(snapshot);companion=null;if(officePreset[side]&&binding[side].switch&&role==='router'&&snapshot.selected.internet_access&&!result.errors.length){companion=composeDevice({...snapshot,role:'switch',selected:{...selection[side].switch},values:{...values[side].switch},bindings:true,linkedEnterprise:null});if(companion.errors.length)result={errors:companion.errors,code:'',empty:false};}
      if(snapshot.integration.enabled&&!result.errors.length&&!result.empty)result=applyExisting(result,snapshot,chosenVendor());
      }
      generatedSecret=Boolean(pairResults?.b.code&&maskSecrets(pairResults.b.code)!==pairResults.b.code)||Boolean(result.code&&maskSecrets(result.code)!==result.code)||Boolean(companion?.code&&maskSecrets(companion.code)!==companion.code)||Object.entries(snapshot.selected).some(([id,enabled])=>enabled&&(id==='vpn'||featureFields(id,chosenVendor()).some(f=>f.type==='password'&&(!f.when||f.when(snapshot.values[id]||{})))));
    }catch(error){pairResults=null;result={errors:['Generation failed: '+(error instanceof Error?error.message:'Unexpected configuration error.')],code:'',empty:false};generatedSecret=false;}
    find('[data-output-panel]').classList.remove('noc-output-enter');
    void find('[data-output-panel]').offsetWidth;
    find('[data-output-panel]').classList.add('noc-output-enter');
    submitted=true;submittedKey=key;outputCleared=false;find('[data-copy-status]').textContent='';paintOutput();
  }
  function submitConfiguration(){renderOutput(true);const panel=find('[data-output-panel]');panel.scrollIntoView({block:'start',behavior:'auto'});find('[data-code]').parentElement.focus({preventScroll:true});}
  function makeField(container,f,d,onInput){
    const label=document.createElement('label');label.className='noc-field';label.textContent=f.label;const input=document.createElement(f.type==='select'?'select':f.type==='textarea'?'textarea':'input');input.name=f.key;input.setAttribute('aria-label',f.label);input.autocomplete='off';input.spellcheck=false;
    if(f.type==='select')for(const[value,title]of Object.entries(f.options||{})){const o=document.createElement('option');o.value=value;o.textContent=title;input.append(o);}else if(f.type!=='textarea')input.type=f.type||'text';if(f.type==='checkbox')input.checked=Boolean(d[f.key]);else input.value=d[f.key]??f.value??'';if(f.type==='select'&&f.key==='type')for(const option of input.options)option.disabled=!vpnAvailable(option.value,lab.a.vendor,lab.b.vendor);if(f.type==='select'&&f.key==='remoteType')for(const option of input.options)option.disabled=option.value!==(chosenVendor()==='mikrotik'?'openvpn':'ssl');label.append(input);container.append(label);
    input.addEventListener('input',()=>{const previous=d[f.key];d[f.key]=input.type==='checkbox'?input.checked:input.value;if(f.key==='ip2'&&(!d.gateway2||d.gateway2===suggestGateway(previous))){d.gateway2=suggestGateway(d[f.key]);const gateway=container.querySelector('[name=gateway2]');if(gateway)gateway.value=d.gateway2;}onInput(f.key,d[f.key]);},{signal:abort.signal});if(f.type==='select')mountSelectionMenu(input,abort.signal);return label;
  }
  function renderSettings(){
    settings.replaceChildren();const vendor=chosenVendor();find('[data-vpn-slot]').hidden=role!=='router'||!selected().vpn||['openvpn','ssl'].includes(vpnType);if(role==='host')return;
    if(role==='router'&&vendor==='ios'&&selected().internet_access&&lab[side].officeSubinterfaces){
      const site=lab[side],panel=document.createElement('details');
      panel.open=true;
      panel.className='noc-feature-settings';
      panel.dataset.subinterfaceSettings='';
      const summary=document.createElement('summary');
      summary.textContent='Cisco switch and 802.1Q VLANs';
      const fields=document.createElement('div');
      fields.className='noc-fields';
      const wiring=document.createElement('p');
      wiring.className='noc-note';
      wiring.textContent='Match the switch trunk port to the cable from the router LAN interface. Match each access port to its client cable before generating.';
      panel.append(summary,wiring,fields);
      settings.append(panel);
      const modelLabel=document.createElement('label');
      modelLabel.className='noc-field';
      modelLabel.textContent='Cisco switch model';
      const model=document.createElement('select');
      model.setAttribute('aria-label','Cisco switch model');
      populateSwitchModels(model,'','ios');
      model.value=site.switchModel;
      modelLabel.append(model);
      fields.append(modelLabel);
      mountSelectionMenu(model,abort.signal);
      model.addEventListener('change',()=>{
        selectSwitchModel(site,model.value,{subinterfaces:true});
        renderSettings();
        renderOutput();
      },{signal:abort.signal});
      for(const [key,label] of [
        ['uplink','Switch trunk port to router'],['access','First VLAN access port'],
        ['vlan2Access','Second VLAN access port'],['switchIp','Switch management IPv4'],
        ['vlan','First VLAN ID'],['vlan2','Second VLAN ID'],
        ['vlan2Subnet','Second VLAN subnet (CIDR)'],['vlan2Gateway','Second VLAN router IP']
      ])makeField(fields,{key,label,type:'text'},site,()=>renderOutput());
    }
    for(const id of Object.keys(selected()).filter(id=>selected()[id])){
      const panel=document.createElement('details');panel.className='noc-feature-settings';panel.open=true;panel.dataset.featurePanel=id;const summary=document.createElement('summary');summary.textContent=FEATURES[id].title;panel.append(summary);settings.append(panel);const form=document.createElement('form');form.className='noc-fields';form.addEventListener('submit',e=>{e.preventDefault();submitConfiguration();},{signal:abort.signal});panel.append(form);form.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&e.target.matches('input:not([type=checkbox])')){e.preventDefault();submitConfiguration();}},{signal:abort.signal});
      if(id==='vpn'){
        makeField(form,{type:'select',key:'type',label:'VPN technology',options:Object.fromEntries(Object.entries(VPN_TYPES).filter(([key])=>values[side].router.internet_access?.officeVpn?((vpnConfig?.compatibility==='fortigate-eval-des'||legacyCiscoPair(lab))?(key==='ikev1'||key==='vti'&&!subinterfaceVpnActive()&&officeVtiAvailable(lab)):(['ikev1','ikev2'].includes(key)||key==='vti'&&!subinterfaceVpnActive()&&officeVtiAvailable(lab))):!['openvpn','ssl'].includes(key)))},{type:vpnType},(_,value)=>{vpnType=value;find('[data-reveal]').checked=false;if(!['openvpn','ssl'].includes(value)){selection.a.router.vpn=selection.b.router.vpn=true;const el=vpnRoot.querySelector('[name="protocol"]');el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}else selection[side==='a'?'b':'a'].router.vpn=false;renderSettings();renderOutput();});
        const note=document.createElement('p');note.className='noc-note';note.style.gridColumn='1/-1';note.textContent=referenceVtiActive()?'Cisco static VTI uses the reference IKEv1 suite (AES-256 / SHA-1 / DH2) without PFS. Enter a shared PSK and verify the WAN/LAN ports and addresses before generating.':values[side].router.internet_access?.officeVpn?(vpnConfig?.compatibility==='fortigate-eval-des'?'FortiGate Evaluation LAB ONLY: fixed IKEv1 / DES / SHA-1 / DH5 / PFS5 on both sides. DES is insecure; use only in an isolated lab.':packetTracerPair(lab)?'Packet Tracer lab only: fixed IKEv1, AES-256, SHA-1, DH5 / PFS5; not a production security suite. Enable the security license in the simulator if required. Enter the same PSK on both sites.':legacyCiscoPair(lab)?'Classic IOS lab compatibility: crypto map uses DH5/PFS5. Cisco 3725 VTI uses SHA-1 and DH2/PFS2. Verify support on your installed IOS image.':'Combined Cisco / MikroTik / FortiGate Internet + VPN: office PAT excludes the peer LAN before translating Internet traffic. Modern profiles default to IKEv2. Compatible Cisco pairs can also select static VTI (IKEv1). Generate both scripts together; review existing NAT and IPsec policies before applying.'):vpnType==='openvpn'?'RouterOS 7.12+ client only. Requires an existing server, trusted CA and imported client certificate/private key. Configure approved remote routes separately.':vpnType==='ssl'?'FortiOS 7.4 remote-access server only, on supported models. Requires an existing signed certificate and authenticated group. Review SSL mappings, reserved IDs and management-port conflicts.':'Site-to-site settings are shared across both routers. Choose the peer vendor through Side B and edit IPs/interfaces in the same topology model.';form.append(note);
        if(referenceVtiActive())for(const key of ['a','b']){
          const label=makeField(form,{key:'lanVlan',label:`Side ${key.toUpperCase()} LAN subinterface VLAN ID (optional)`,type:'text'},values[key].router.vpn,()=>renderOutput());
          label.querySelector('input').inputMode='numeric';
        }
        if(['openvpn','ssl'].includes(vpnType))for(const f of REMOTE_VPN_FIELDS[vpnType])makeField(form,f,remote[side][vpnType],()=>renderOutput());continue;
      }
      const d=dataFor(id),fields=featureFields(id,vendor),note=document.createElement('p');note.className='noc-note';note.textContent=['nat','dhcp','bootstrap'].includes(id)?`Topology binding: LAN ${lab[side].local}, gateway ${lab[side].lanIp}, WAN ${lab[side].wan}. Edit addressing through the topology.`:['vlan','security'].includes(id)?'Interface and VLAN edits also update the switch node. Keep access/trunk and port-security choices consistent.':['bootstrap','enterprise'].includes(id)?'Complete preset: use alone, without other features or base interface bindings.':'Only enabled features contribute commands to this device output.';note.textContent+=' '+(FEATURES[id].note||TOOLS[FEATURES[id].tool]?.note||'');panel.insertBefore(note,form);
      if(id==='ipsla'&&selected().wan_failover)note.textContent=`Linked primary-route tracking: probes ${lab[side].gateway} from ${lab[side].wan}. Gateway reachability does not prove end-to-end internet availability. Operation/track IDs must be unused.`;if(id==='wan_failover')note.textContent=`Primary WAN: ${lab[side].wan} ${lab[side].ip}/${lab[side].wanPrefix}, gateway ${lab[side].gateway}. Secondary addressing below must use a separate /30. `+(FEATURES[id].note||'');if(id==='internet_access')note.textContent=`Shared topology: LAN ${lab[side].local}, gateway ${lab[side].lanIp}, WAN ${lab[side].wan}. ${selected().wan_failover?'Default-route IDs and backup routing come from Dual ISP settings. ':''}`+(FEATURES[id].note||'');if(id==='internet_access'&&d.officeFailover&&selected().wan_failover)note.textContent='Office DHCP, DNS and NTP with tracked WAN failover and PAT on both WANs. Requires IOS support for IP SLA and route-map match interface.';else if(id==='internet_access'&&d.standardOffice&&vendor==='ios')note.textContent='Complete Cisco IOS Office preset: USERS DHCP, SSH_NEW on VTY 0–15, a LAN translation ACL and WAN PAT. SVI mode requires an integrated Layer 2 switch port; select routed Ethernet mode for a routed port. Type 9 secrets require scrypt-capable IOS. Enter your own administrator secrets. NTP is editable below.';if(id==='portforward')note.textContent=`Topology binding: WAN ${lab[side].ip} on ${lab[side].wan}, inside ${lab[side].lan}, server network ${lab[side].local}. `+(FEATURES[id].note||'');
      if(id==='vlan'&&hasSecondVlan(lab[side])){note.textContent='Both VLANs, native trunk, access ports and management SVIs are controlled by Interfaces, IP addresses & gateways → Switch. Base bindings are included automatically.';form.hidden=true;continue;}
      if(id==='nat'&&selected().vpn&&vpnType==='vti'){note.textContent='The Cisco VTI template already includes its own NAT exemption ACL and PAT bindings. No additional NAT rule is emitted.';form.hidden=true;continue;}const bound=id==='ipsla'&&selected().wan_failover?['target','sourceInterface']:id==='internet_access'&&selected().wan_failover?['routeId']:id==='nat'?['network','inside','outside']:id==='dhcp'?['network','gateway']:id==='portforward'?['publicIp','inside','outside','localNetwork','lanIp']:id==='bootstrap'?['wan','wanAddress','gateway','lan']:[],labels=[];
      if(id==='internet_access'&&customOffice[side]){const parts=gatewayParts(d);for(const [key,label]of Object.entries(GATEWAY_PARTS))makeField(form,{key,label,type:'checkbox'},parts,(_,enabled)=>setGatewayPart(key,enabled));summary.textContent='Custom Internet Gateway Components';}
      const visibility=()=>{const effective={...boundValues(id,d,{...lab[side],vendor}),sshEnabled:Boolean(selected().hardening)};for(const[f,label]of labels)label.hidden=Boolean(f.when&&!f.when(effective));};
      for(const f of fields.filter(f=>!bound.includes(f.key)&&!(id==='internet_access'&&((d.parts?.dhcp===false&&['poolName','dhcpId'].includes(f.key))||(d.parts?.dns===false&&['dns1','dns2'].includes(f.key)))))){const label=makeField(form,f,d,(key,value)=>{if(id==='remotevpn'&&key==='remoteType'){Object.assign(d,remoteDefaults(value));d.password='';renderSettings();renderOutput();return;}if(['vlan','security'].includes(id)&&['vlan','interface'].includes(key)){if(key==='vlan')lab[side].vlan=value;else lab[side].access=value;for(const other of ['vlan','security'])if(values[side].switch[other]){values[side].switch[other][key]=value;const el=settings.querySelector('[data-feature-panel='+other+'] [name='+key+']');if(el)el.value=value;}redraw();}if(id==='wan_failover')redraw();visibility();renderOutput();});labels.push([f,label]);}visibility();
    }
  }
  function renderContext(){
    for(const button of shell.querySelectorAll('[data-routing-preset]')){
      button.hidden=role!=='router';
      button.disabled=!capable(button.dataset.routingPreset,chosenVendor());
    }
    const subinterfaceButton=find('[data-subinterface-preset]');
    subinterfaceButton.hidden=role!=='router';
    subinterfaceButton.disabled=chosenVendor()!=='ios';
    const subinterfaceVpnButton=find('[data-subinterface-vpn-preset]');
    subinterfaceVpnButton.hidden=role!=='router';
    subinterfaceVpnButton.disabled=chosenVendor()!=='ios';
    subinterfaceVpnButton.title='Cisco pair: two VLANs per site with DHCP, Internet PAT and policy-based IPsec. Both switch configurations are shown after generation.';
    const siteIpsec=find('[data-site-ipsec-preset]');
    siteIpsec.hidden=role!=='router';
    siteIpsec.disabled=!supportsCiscoVti(lab[side])||switchedLan(lab[side]);
    siteIpsec.title=siteIpsec.disabled?'Select a Cisco IOS router with VTI support and a routed LAN port.':'Cisco IOS static VTI · IKEv1 · AES-256 / SHA-1 / DH2';
    const combinedButton=find('[data-office-vpn-preset]');combinedButton.hidden=role!=='router';combinedButton.disabled=!['ios','mikrotik','fortinet'].includes(chosenVendor());combinedButton.title=combinedButton.disabled?'Select Cisco, MikroTik or FortiGate for the active router.':'Preserve Cisco / MikroTik / FortiGate peers, IP addresses and PSKs; prepare an unset peer when needed.';const combinedActive=Boolean(selected().vpn&&values[side].router.internet_access?.officeVpn);combinedButton.setAttribute('aria-pressed',String(combinedActive));combinedButton.classList.toggle('noc-copied',combinedActive);
    const visibleModel=['router','switch'].includes(role)&&(['ios','mikrotik','fortinet'].includes(chosenVendor())||role==='router'&&['fortinet','paloalto'].includes(chosenVendor()));find('[data-model-label]').textContent='2 · '+(role==='switch'?'Switch':'Router')+' model';modelInput.setAttribute('aria-label',role==='switch'?'Switch model':'Router model');find('[data-model-search]').setAttribute('aria-label','Search '+(chosenVendor()==='paloalto'?'Palo Alto':chosenVendor()==='fortinet'?'FortiGate':chosenVendor()==='mikrotik'?'MikroTik':'Cisco')+' '+(role==='switch'?'switch':'router')+' models');find('[data-model-field]').hidden=!visibleModel;catalogStatus.hidden=!visibleModel||(role==='switch'&&chosenVendor()!=='mikrotik');if(chosenVendor()==='fortinet'){catalogStatus.textContent=FORTIGATE_CATALOG.length+' FortiGate models · Fortinet hardware catalog';}else if(chosenVendor()==='paloalto'){catalogStatus.textContent='PAN-OS EVE-NG lab profiles';}else if(chosenVendor()==='mikrotik'){catalogStatus.replaceChildren();catalogStatus.append(document.createTextNode(MIKROTIK_CATALOG.filter(r=>r.device_type===role).length+' MikroTik hardware models · Selected models from your list · '));const link=document.createElement('a');link.href='https://mikrotik.com/products';link.target='_blank';link.rel='noopener noreferrer';link.textContent='MikroTik product directory ↗';catalogStatus.append(link);}else catalogStatus.innerHTML=ciscoCatalogStatus;(role==='switch'?populateSwitchModels:populateRouterModels)(modelInput,'',chosenVendor());modelInput.value=lab[side][role==='switch'?'switchModel':'routerModel']||'';find('[data-model-search]').value='';(role==='switch'?renderSwitchModelInfo:renderRouterModelInfo)(find('[data-model-summary]'),visibleModel?modelInput.value:'');
    find('[data-integrate]').checked=existingContexts[side][role].enabled;find('[data-existing]').value=existingContexts[side][role].text;
    find('[data-side]').value=side;vendorInput.value=chosenVendor();vendorInput.disabled=role==='host';vendorInput.closest('.noc-field').hidden=role==='host';selectionMenus.forEach(refresh=>refresh());for(const b of shell.querySelectorAll('[data-role]'))b.setAttribute('aria-pressed',String(b.dataset.role===role));find('[data-section-title]').textContent=role==='host'?'Computer / Host':role==='router'?'Configuration Workbench':'Switch Configuration';find('[data-host-note]').hidden=role!=='host';find('[data-capability-note]').textContent=role==='host'?'Linux iproute2 host addressing.':`${PLATFORMS[chosenVendor()]} · Unsupported templates are disabled. Baseline security requires your credentials and management server addresses.`;
    const toggles=find('[data-features]'),presets=find('[data-preset-features]');toggles.replaceChildren();presets.replaceChildren();const management=find('[data-management-features]');management.replaceChildren();find('[data-compatibility-actions]').querySelector('[data-vti-shortcut]')?.remove();const grids={};if(role!=='host')for(const[key,title]of Object.entries(CATEGORIES)){const group=document.createElement('section');group.className='noc-category';group.dataset.category=key;const h=document.createElement('h4');h.textContent=title;const grid=document.createElement('div');grid.className='noc-feature-grid';group.append(h,grid);toggles.append(group);grids[key]=grid;if(key==='routing'){const advanced=document.createElement('details');advanced.className='noc-advanced-routing';const summary=document.createElement('summary');summary.textContent='Advanced Routing Options';const advancedGrid=document.createElement('div');advancedGrid.className='noc-feature-grid';advanced.append(summary,advancedGrid);group.append(advanced);grids.advanced=advancedGrid;}}find('[data-presets]').hidden=role!=='router';find('[data-office-preset]').hidden=role!=='router';if(role!=='host')for(const[id,f]of Object.entries(FEATURES).filter(([,f])=>forRole(f,role))){
      if(id==='remotevpn'){
        const shortcut=document.createElement('button');
        shortcut.type='button';
        shortcut.className='noc-feature-toggle';
        shortcut.textContent='Route-based Site-to-Site IPsec VPN';
        const unavailable=subinterfaceVpnActive()?'Subinterfaces + VPN uses policy-based IPsec on both sides.':lab.a.vendor!=='ios'||lab.b.vendor!=='ios'
          ?'Select Cisco on both sides.'
          :!officeVtiAvailable(lab)
            ?'VTI is unavailable for the selected lab image. For Packet Tracer use Site-to-Site VPN with IPsec IKEv1.'
            :['a','b'].some(key=>selection[key].router.internet_access)&&!pairedOffice()
              ?'Turn off Internet Gateway on both sides to configure VTI separately.'
              :'';
        shortcut.title=unavailable||'Static VTI with IKEv1. Use an IOS image with VTI support.';
        shortcut.disabled=Boolean(unavailable);
        shortcut.addEventListener('click',()=>{
          selection.a.router=toggleFeature(selection.a.router,'vpn',true,lab.a.vendor);
          selection.b.router=toggleFeature(selection.b.router,'vpn',true,lab.b.vendor);
          vpnType='vti';
          const protocol=vpnRoot.querySelector('[name="protocol"]');
          protocol.value='vti';
          protocol.dispatchEvent(new Event('input',{bubbles:true}));
          renderContext();
        },{signal:abort.signal});
        const card=document.createElement('div');
        card.append(shortcut);
        if(unavailable||legacyCiscoPair(lab)){
          const hint=document.createElement('p');
          hint.className='noc-note';
          hint.textContent=unavailable||'Cisco 3725 VTI lab: verify tunnel mode ipsec ipv4 on the installed IOS image. The generated suite uses SHA-1 and DH2/PFS2.';
          card.append(hint);
        }
        card.dataset.vtiShortcut='';
        find('[data-compatibility-actions]').append(card);
        continue;
      }
      const label=document.createElement('label');label.className='noc-feature-toggle';label.title=f.note||TOOLS[f.tool]?.note||f.title;const input=document.createElement('input');input.type='checkbox';input.dataset.feature=id;const part=role==='router'?FEATURE_PARTS[id]:undefined,component=Boolean(part&&selection[side].router.internet_access);const managed=(officeManagedFeatures(chosenVendor(),role,role==='router'?Boolean(selected().internet_access):Boolean(selection[side].router.internet_access)&&officePreset[side]&&binding[side].switch).includes(id)&&(!component||gatewayParts(gatewayData())[part]));input.checked=managed||Boolean(selected()[id]);input.disabled=!component&&!managed&&!capable(id,chosenVendor());label.dataset.unsupported=String(input.disabled);label.dataset.presetManaged=String(managed);const text=document.createElement('span');text.textContent=component?(id==='static'?'IPv4 default route':OFFICE_CARD_TITLES[id]):id==='internet_access'&&customOffice[side]?'Custom Gateway Components':managed?OFFICE_CARD_TITLES[id]:f.title;if(['hardening','ntp_syslog'].includes(id)&&input.checked){const badge=document.createElement('small');badge.className='noc-preset-badge';badge.textContent='Baseline management';text.append(badge);}if(id==='ipsla'&&selected().wan_failover&&chosenVendor()==='ios'){const badge=document.createElement('small');badge.className='noc-preset-badge';badge.textContent='Linked to WAN failover';text.append(badge);}if(managed){const badge=document.createElement('small');badge.className='noc-preset-badge';badge.textContent=customOffice[side]?'Custom gateway component':'Included in Office preset';text.append(badge);label.title='Toggle this gateway component independently. Shared topology inputs are preserved.';}if(!managed&&!capable(id,chosenVendor())){const small=document.createElement('small');small.textContent='Unavailable for this vendor';text.append(small);}label.append(input,text);(['hardening','aaa','snmp3','automation'].includes(id)?management:['bootstrap','enterprise'].includes(id)?presets:['bgp','multicast','isis','static6','ospf3','pbr','eigrp','redistribution','ospf_advanced'].includes(id)?grids.advanced:grids[f.category]).append(label);
      input.addEventListener('change',()=>{if(input.disabled)return;if(component){setGatewayPart(part,input.checked);return;}if(managed){clearOfficePreset();return;}if(role!=='host')selection[side][role]=toggleFeature(selected(),id,input.checked,chosenVendor());if(id==='wan_failover'&&chosenVendor()==='ios'&&input.checked){const sla=dataFor('ipsla');sla.target=lab[side].gateway;sla.sourceInterface=lab[side].wan;}if(id==='relay'&&input.checked&&officePreset[side]){clearOfficePreset();return;}if(['bootstrap','enterprise'].includes(id)&&input.checked){selection[side][role]={[id]:true};officePreset[side]=false;binding[side][role]=false;renderContext();return;}if(id==='internet_access'){if(!input.checked)officePreset[side]=false;renderContext();return;}if(['wan_failover','ipsla','fhrp','glbp','dhcp','relay'].includes(id)){renderContext();return;}if(id==='vpn'&&!['openvpn','ssl'].includes(vpnType))selection[side==='a'?'b':'a'].router.vpn=input.checked;find('[data-reveal]').checked=false;redraw();renderSettings();renderOutput();},{signal:abort.signal});
    }for(const grid of Object.values(grids))if(!grid.children.length&&(grid!==grids.routing||!grids.advanced?.children.length))grid.parentElement.remove();find('[data-reveal]').checked=false;redraw();renderSettings();renderOutput();paintAnalysis();
  }
  find('[data-model-search]').addEventListener('input',e=>{(role==='switch'?populateSwitchModels:populateRouterModels)(modelInput,e.target.value,chosenVendor());selectionMenus.forEach(refresh=>refresh());},{signal:abort.signal});
  modelInput.addEventListener('change',()=>{const previous={...lab[side]};(role==='switch'?selectSwitchModel:selectRouterModel)(lab[side],modelInput.value);if(role==='switch'&&modelInput.value)binding[side].switch=true;syncTopologyValues(values[side][role],previous,lab[side],role);topologyToVpn();renderContext();},{signal:abort.signal});
  vendorInput.addEventListener('change',()=>{const keepCombined=hasOfficePair();const vendor=vendorInput.value,s=lab[side];if(role==='router'){s.vendor=vendor;s.routerModel='';[s.wan,s.lan]=PORTS[vendor];}else{s.switchModel='';s.switchVendor=vendor;[s.uplink,s.access]=vendor==='ios'?['GigabitEthernet0/1','GigabitEthernet0/2']:PORTS[vendor];}selection[side][role]=role==='router'?baselineFeatures(vendor):{};values[side][role]={};binding[side][role]=false;if(keepCombined)configureOfficePair();topologyToVpn();renderContext();},{signal:abort.signal});
  for(const button of shell.querySelectorAll('[data-routing-preset]'))button.addEventListener('click',()=>{
    const id=button.dataset.routingPreset;
    const vendor=chosenVendor();
    if(role!=='router'||!capable(id,vendor))return;
    for(const key of ['a','b']){
      selection[key].router.vpn=false;
      if(values[key].router.internet_access)delete values[key].router.internet_access.officeVpn;
    }
    officePreset[side]=false;
    customOffice[side]=false;
    submitted=false;
    companion=null;
    selection[side].router={[id]:true};
    if(id==='wan_failover'&&vendor==='ios'){
      selection[side].router={internet_access:true,ntp_syslog:true,ipsla:true,wan_failover:true};
      values[side].router.internet_access={...dataFor('internet_access'),standardOffice:true,officeFailover:true,parts:{firewall:false}};
    }
    if(id==='wan_failover'&&vendor!=='ios'&&capable('internet_access',vendor)){
      selection[side].router.internet_access=true;
      dataFor('internet_access').parts={firewall:false};
    }
    binding[side].router=id==='wan_failover';
    renderContext();
    find('[data-feature-panel='+id+']')?.scrollIntoView({block:'start'});
  },{signal:abort.signal});
  find('[data-office-preset]').addEventListener('click',()=>{
    for(const key of ['a','b'])if(values[key].router.internet_access?.officeVpn){selection[key].router.vpn=false;delete values[key].router.internet_access.officeVpn;}
    const s=lab[side];role='router';officePreset[side]=true;customOffice[side]=false;
    const clock=values[side].router.ntp_syslog;selection[side].router={internet_access:true,ntp_syslog:true};selection[side].switch={};values[side].router={internet_access:{...featureDefaults('internet_access',s.vendor),parts:{firewall:false}},ntp_syslog:{...featureDefaults('ntp_syslog',s.vendor),...(clock||{})}};values[side].switch={};
    if(!['ios','mikrotik','juniper'].includes(s.switchVendor)){s.switchModel='';s.switchVendor='ios';s.uplink='GigabitEthernet0/1';s.access='GigabitEthernet0/2';}
    s.vlan2Enabled='off';s.officeVlans=false;s.officeSubinterfaces=false;
    if(s.vendor==='ios'){
      values[side].router.internet_access.standardOffice=true;
      const clock=dataFor('ntp_syslog');if(!clock.ntp)clock.ntp='129.250.35.251';
    }
    binding[side].router=true;binding[side].switch=false;topologyToVpn();renderContext();renderOutput(true);find('[data-preset-banner]').scrollIntoView({block:'start',behavior:'auto'});
  },{signal:abort.signal});
  function configureOfficeSubinterfaces(key){
    const site=lab[key];
    site.vlan2Enabled='on';
    site.officeVlans=true;
    site.officeSubinterfaces=true;
    const network=cidr(site.local),management=ipv4(site.switchIp);
    if(network&&network.end-network.network>=3&&(management===null||management<=network.network||management>=network.end||site.switchIp===site.lanIp)){
      const candidate=network.end-1-(ipv4(site.lanIp)===network.end-1?1:0);
      site.switchIp=[24,16,8,0].map(bit=>(candidate>>>bit)&255).join('.');
    }
    site.switchVendor='ios';
    if(!site.switchModel||!site.uplink)selectSwitchModel(site,site.routerModel?.endsWith('(Packet Tracer)')?'Cisco 2960-24TT (Packet Tracer)':site.routerModel?.endsWith('(EVE-NG)')?'Cisco IOL L2 (EVE-NG)':'Cisco Catalyst 2960-24TT-L',{subinterfaces:true});
    dataFor('internet_access',key).iosLanMode='subinterfaces';
    binding[key].switch=true;
  }
  find('[data-subinterface-preset]').addEventListener('click',()=>{
    if(role!=='router'||chosenVendor()!=='ios')return;
    find('[data-office-preset]').click();
    configureOfficeSubinterfaces(side);
    renderContext();
    find('[data-subinterface-settings]')?.scrollIntoView({block:'start'});
  },{signal:abort.signal});
  function selectOfficeVpn(dual){
    if(dual){
      if(role!=='router'||chosenVendor()!=='ios')return;
      const peer=lab[side==='a'?'b':'a'];
      if(peer.vendor!=='ios'){
        peer.vendor='ios';peer.routerModel='';[peer.wan,peer.lan]=PORTS.ios;
        peer.switchModel='';
      }
    }
    if(!prepareOfficeVpnPair(lab,side))return;
    if(dual){
      const defaults=createLab();
      for(const [key,primary,secondary] of [['a',10,20],['b',30,40]]){
        const site=lab[key],original=defaults[key];
        if(site.local===original.local&&site.lanIp===original.lanIp){
          site.local=`192.168.${primary}.0/24`;
          site.lanIp=`192.168.${primary}.1`;
        }
        if(site.vlan2Subnet===original.vlan2Subnet&&site.vlan2Gateway===original.vlan2Gateway){
          site.vlan2Subnet=`192.168.${secondary}.0/24`;
          site.vlan2Gateway=`192.168.${secondary}.1`;
        }
        if(site.vlan===original.vlan&&site.vlan2===original.vlan2){
          site.vlan=String(primary);
          site.vlan2=String(secondary);
        }
      }
    }
    role='router';submitted=false;companion=null;
    configureOfficePair(dual);
    topologyToVpn();
    vpnType=(vpnConfig?.compatibility==='fortigate-eval-des'||legacyCiscoPair(lab))?'ikev1':'ikev2';const protocol=vpnRoot.querySelector('[name=protocol]');protocol.value=vpnType;protocol.dispatchEvent(new Event('input',{bubbles:true}));
    renderContext();find('[data-preset-banner]').scrollIntoView({block:'start',behavior:'auto'});
  }
  find('[data-branch-demo]').addEventListener('click',()=>{
    const demoLab=createLab();
    for(const [key,primary,secondary,wan,peerGateway] of [
      ['a',10,20,'192.0.2.2','192.0.2.1'],
      ['b',30,40,'198.51.100.2','198.51.100.1']
    ]){
      const site=demoLab[key];
      Object.assign(site,{vendor:'ios',routerOnly:true,ip:wan,gateway:peerGateway,
        local:`192.168.${primary}.0/24`,lanIp:`192.168.${primary}.1`,
        vlan:String(primary),vlan2:String(secondary),
        vlan2Subnet:`192.168.${secondary}.0/24`,vlan2Gateway:`192.168.${secondary}.1`});
      selectRouterModel(site,'Cisco ISR4331-SEC/K9');
      values[key].router={};
      existingContexts[key].router.enabled=false;
    }
    lab=demoLab;
    side='a';
    selectOfficeVpn(true);
    vpnRoot.querySelector('[data-action="key"]').click();
    renderOutput(true);
    const ready=Boolean(pairResults?.a.switchOutput?.code&&pairResults?.b.switchOutput?.code&&!result.errors.length);
    demoKey=submittedKey;
    find('[data-demo-status]').textContent=ready?'Validation passed. R1, R2, SW1, and SW2 are ready to export.':result.errors.join(' ');
    const output=find('[data-output-panel]');
    output.scrollIntoView({block:'start',behavior:'auto'});
    find('[data-code]').parentElement.focus({preventScroll:true});
  },{signal:abort.signal});
  find('[data-office-vpn-preset]').addEventListener('click',()=>selectOfficeVpn(false),{signal:abort.signal});
  find('[data-site-ipsec-preset]').addEventListener('click',()=>{
    const active=lab[side],peer=lab[side==='a'?'b':'a'];
    if(!supportsCiscoVti(active)||switchedLan(active))return;
    if(!supportsCiscoVti(peer)||switchedLan(peer)){
      peer.vendor='ios';
      [peer.wan,peer.lan]=PORTS.ios;
      selectRouterModel(peer,active.routerModel||'');
    }
    const original=createLab();
    const firstActivation=!referenceVtiActive();
    for(const [key,wan,lan] of [['a','192.168.73.164',10],['b','192.168.73.187',50]]){
      const site=lab[key];
      if(firstActivation&&site.ip===original[key].ip&&site.wanPrefix===original[key].wanPrefix&&site.gateway===original[key].gateway){
        Object.assign(site,{ip:wan,wanPrefix:'24',gateway:'192.168.73.1'});
      }
      if(firstActivation&&site.local===original[key].local&&site.lanIp===original[key].lanIp){
        Object.assign(site,{local:`192.168.${lan}.0/24`,lanIp:`192.168.${lan}.1`});
      }
      Object.assign(site,{vlan2Enabled:'off',officeVlans:false,officeSubinterfaces:false});
      selection[key].router={vpn:true};
      values[key].router={vpn:{referenceVti:true,lanVlan:values[key].router.vpn?.lanVlan||''}};
      officePreset[key]=customOffice[key]=binding[key].router=binding[key].switch=false;
    }
    topologyToVpn();
    if(firstActivation)for(const [key,index] of [['a',1],['b',2]]){
      const field=vpnRoot.querySelector(`[name="${key}.tunnel"]`);
      if(field.value===`169.254.100.${index}`){
        field.value=`10.0.0.${index}`;
        field.dispatchEvent(new Event('input',{bubbles:true}));
      }
    }
    const protocol=vpnRoot.querySelector('[name="protocol"]');
    protocol.value='vti';
    protocol.dispatchEvent(new Event('input',{bubbles:true}));
    renderContext();
  },{signal:abort.signal});
  find('[data-subinterface-vpn-preset]').addEventListener('click',()=>selectOfficeVpn(true),{signal:abort.signal});
  find('[data-preset-view]').addEventListener('click',()=>find('[data-output-panel]').scrollIntoView({block:'start',behavior:'auto'}),{signal:abort.signal});
  find('[data-side]').addEventListener('change',e=>{side=e.target.value;renderContext();},{signal:abort.signal});for(const b of shell.querySelectorAll('[data-role]'))b.addEventListener('click',()=>{role=b.dataset.role;renderContext();},{signal:abort.signal});find('[data-include-bindings]').addEventListener('change',e=>{if(role!=='host')binding[side][role]=e.target.checked;renderOutput();},{signal:abort.signal});find('[data-reveal]').addEventListener('change',paintOutput,{signal:abort.signal});
  find('[data-download-config]').addEventListener('click',()=>{if(!submitted||!result.code||result.errors.length)return;const outputSide=pairResults?'a':side,vendor=lab[outputSide].vendor,model=lab[outputSide].routerModel;const url=URL.createObjectURL(new Blob([terminalText(result.code,{vendor,role,model})],{type:'text/plain;charset=utf-8',endings:'transparent'}));const link=document.createElement('a');link.href=url;link.download=`noc-${outputSide}-${role}-${vendor}.conf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);find('[data-copy-status]').textContent='Downloaded complete configuration, including secrets.';},{signal:abort.signal});
  find('[data-copy-config]').addEventListener('click',async()=>{if(!submitted||!result.code||result.errors.length)return;const outputSide=pairResults?'a':side,source=result.code,code=terminalText(source,{vendor:lab[outputSide].vendor,role,model:lab[outputSide].routerModel});try{await navigator.clipboard.writeText(code);if(!disposed&&submitted&&result.code===source){find('[data-copy-status]').textContent=chosenVendor()==='ios'&&role!=='host'?'Copied IOS CLI (CRLF), including secrets. Packet Tracer users: choose a model marked (Packet Tracer), then paste at an empty Router# prompt.':'Copied selected device configuration, including secrets.';find('[data-copy-config]').textContent='Copied successfully! ✓';find('[data-copy-config]').classList.add('noc-copied');}}catch{if(!disposed)find('[data-copy-status]').textContent='Clipboard unavailable. Reveal, select and copy the terminal text manually.';}},{signal:abort.signal});
  find('[data-copy-peer]').addEventListener('click',async()=>{
    if(!submitted||result.errors.length||!pairResults?.b.code)return;
    const source=pairResults.b.code,code=terminalText(source,{vendor:lab.b.vendor,role:'router',model:lab.b.routerModel});
    try{await navigator.clipboard.writeText(code);if(!disposed&&submitted&&pairResults?.b.code===source){find('[data-peer-copy-status]').textContent='Copied Side B configuration, including secrets.';find('[data-copy-peer]').textContent='Copied successfully! ✓';}}
    catch{if(!disposed)find('[data-peer-copy-status]').textContent='Clipboard unavailable. Reveal, select and copy the Side B terminal text.';}
  },{signal:abort.signal});
  for(const {index,find:findSwitch} of switchPanels){
    findSwitch('[data-copy-switch]').addEventListener('click',async()=>{
      const {key,context,code}=switchExport(index);
      if(!code)return;
      try{
        await navigator.clipboard.writeText(terminalText(code,context));
        if(!disposed&&switchExport(index).code===code&&switchExport(index).key===key){
          findSwitch('[data-switch-status]').textContent='Side '+key.toUpperCase()+' switch configuration copied.';
        }
      }catch{if(!disposed)findSwitch('[data-switch-status]').textContent='Clipboard unavailable. Use the switch download button.';}
    },{signal:abort.signal});
    findSwitch('[data-download-switch]').addEventListener('click',()=>{
      const {key,context,code}=switchExport(index);
      if(!code)return;
      const url=URL.createObjectURL(new Blob([terminalText(code,context)],{type:'text/plain;charset=utf-8'}));
      const link=document.createElement('a');
      link.href=url;
      link.download='noc-'+key+'-cisco-switch.conf';
      link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    },{signal:abort.signal});
  }
  find('[data-download-peer]').addEventListener('click',()=>{
    if(!submitted||result.errors.length||!pairResults?.b.code)return;
    const code=terminalText(pairResults.b.code,{vendor:lab.b.vendor,role:'router',model:lab.b.routerModel}),url=URL.createObjectURL(new Blob([code],{type:'text/plain;charset=utf-8',endings:'transparent'})),link=document.createElement('a');link.href=url;link.download='noc-b-router-'+lab.b.vendor+'.conf';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);find('[data-peer-copy-status]').textContent='Downloaded Side B configuration, including secrets.';
  },{signal:abort.signal});
  find('[data-clear-secrets]').addEventListener('click',()=>{for(const s of ['a','b'])for(const r of ['router','switch','host'])existingContexts[s][r].text='';find('[data-existing]').value='';for(const ctx of Object.values(existingContexts))for(const item of Object.values(ctx)){item.report=null;item.analyzedVendor='';}paintAnalysis();for(const s of ['a','b']){for(const r of ['router','switch'])for(const[id,d]of Object.entries(values[s][r]))for(const f of featureFields(id,d.vendor))if(f.type==='password')d[f.key]='';remote[s].openvpn.password='';}vpnRoot.querySelector('[data-action="clear"]').click();find('[data-reveal]').checked=false;renderSettings();renderOutput();find('[data-copy-status]').textContent='Secrets cleared from all device forms. Previous clipboard content is unchanged.';},{signal:abort.signal});
  find('[data-clear-output]').addEventListener('click',()=>{submitted=false;submittedKey='';outputCleared=true;pairResults=null;result={errors:[],code:'',empty:true};generatedSecret=false;companion=null;find('[data-copy-status]').textContent='';paintOutput();},{signal:abort.signal});
  find('[data-integrate]').addEventListener('change',e=>{existingContexts[side][role].enabled=e.target.checked;renderOutput();},{signal:abort.signal});
  find('[data-existing-nat-exemption]').addEventListener('change',e=>{existingContext().includeNatExemption=e.target.checked;renderOutput();},{signal:abort.signal});
  find('[data-existing-mode]').addEventListener('change',e=>{existingContext().mode=e.target.value;renderOutput();},{signal:abort.signal});
  find('[data-analyze-config]').addEventListener('click',()=>{const ctx=existingContext();ctx.report=analyzeConfiguration(ctx.text,chosenVendor());ctx.analyzedVendor=chosenVendor();ctx.mode='additions';ctx.enabled=true;if(!ctx.report.errors.length&&role==='router'){for(const id of [...Object.keys(ctx.report.detected),'internet_access','bootstrap','enterprise'])selection[side].router[id]=false;officePreset[side]=false;customOffice[side]=false;}find('[data-integrate]').checked=ctx.enabled;binding[side][role]=false;renderContext();},{signal:abort.signal});
  find('[data-apply-config-topology]').addEventListener('click',()=>{const report=existingContext().report;if(!report||report.errors.length)return;const wan=report.interfaces.find(i=>i.id===find('[data-analysis-wan]').value),lan=report.interfaces.find(i=>i.id===find('[data-analysis-lan]').value);if(!wan||!lan||wan.id===lan.id){find('[data-analysis-status]').textContent='Select two distinct WAN and LAN interfaces.';return;}const previous={...lab[side]};Object.assign(lab[side],{wan:wan.id,ip:wan.ip,wanPrefix:wan.prefix,lan:lan.id,lanIp:lan.ip,local:lan.network,...(report.gateway?{gateway:report.gateway}:{})});for(const device of ['router','switch'])syncTopologyValues(values[side][device],previous,lab[side],device);binding[side].router=false;topologyToVpn();renderContext();find('[data-analysis-status]').textContent+=' Interface suggestions applied; verify the ISP gateway and new service values.';},{signal:abort.signal});
  find('[data-existing]').addEventListener('input',e=>{const ctx=existingContext();ctx.text=e.target.value;ctx.report=null;paintAnalysis();renderOutput();},{signal:abort.signal});
  find('[data-generate]').addEventListener('click',submitConfiguration,{signal:abort.signal});
  renderContext();return()=>{disposed=true;abort.abort();stopPlanner();diagram.destroy();editor.destroy();shell.before(vpnRoot);vpnRoot.hidden=false;vpnRoot.classList.remove('noc-vpn');shell.remove();};
}



