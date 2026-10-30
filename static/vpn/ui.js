import {cliProfile} from './cli-profile.js';
import { WAN_PREFIXES } from './interfaces.js';
import { mountSelectionMenu } from './selection-menu.js';
import { vpnAvailable } from './lab-policy.js';
import { maskSecrets } from './secret-mask.js';
import { DEFAULTS, VENDORS, PROTOCOLS, generate } from './engine.js';
import { PORTS } from './platforms.js';
import { mountWorkbench } from './workbench.js';

export function mountVpn(root, mountOptions = {}) {
const controller = new AbortController();
const state = structuredClone(DEFAULTS);
const inputClass = 'w-full bg-base-950 border border-base-border rounded px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400';
const buttonClass = 'border border-cyan-glow/40 text-cyan-glow bg-cyan-glow/10 hover:bg-cyan-glow/20 rounded px-3 py-2 font-mono text-xs transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400';
const options = values => Object.entries(values).map(([value, name]) => `<option value="${value}">${name}</option>`).join('');
function field(side, name, label, type = 'text', hint = '') {
  const id = `vpn-${side}-${name}`;
  const input = `<input id="${id}" name="${side}.${name}" type="${type}" class="${inputClass}" style="min-width:0" autocomplete="off" spellcheck="false" ${hint ? `aria-describedby="${id}-hint"` : ''}>`;
  const control = name === 'psk' ? `<div style="display:flex;gap:8px">${input}<button type="button" data-reveal-psk="${side}" aria-controls="${id}" aria-pressed="false" aria-label="Show Side ${side.toUpperCase()} pre-shared key" class="${buttonClass}" style="flex-shrink:0">Show</button></div>` : input;
  return `<div class="block space-y-1"><label for="${id}" class="text-xs text-slate-400">${label}</label>${control}${hint ? `<span id="${id}-hint" class="block text-[11px] text-slate-500">${hint}</span>` : ''}</div>`;
}
function site(side) {
  return `<fieldset class="border border-base-border rounded-lg p-4 bg-base-950/40 min-w-0"><legend class="font-mono text-sm text-cyan-glow px-2">SIDE ${side.toUpperCase()} / ${side === 'a' ? 'LOCAL SITE' : 'REMOTE SITE'}</legend>
    <p data-profile-note class="text-xs text-slate-400 mb-3"></p>
    <label class="block mb-4 text-xs text-slate-400" for="vpn-${side}-vendor">Platform<select id="vpn-${side}-vendor" name="${side}.vendor" class="${inputClass} mt-1">${options(VENDORS)}</select></label>
    <div class="grid sm:grid-cols-2 gap-4">
      ${field(side, 'ip', 'Public IPv4')}${field(side, 'local', 'Local subnet (CIDR)')}${field(side, 'remote', 'Remote subnet (CIDR)')}
      ${field(side, 'psk', 'Pre-shared key', 'password', 'IPsec: at least 4 CLI-safe characters; words or digits accepted. WireGuard: optional base64 key.')}
    </div>
    <div data-wg class="grid sm:grid-cols-2 gap-4 mt-4" hidden>${field(side, 'privateKey', 'WireGuard private key', 'password')}${field(side, 'publicKey', 'This side’s public key')}${field(side, 'port', 'Listen UDP port', 'number')}</div>
    <div data-overlay class="mt-4" hidden>${field(side, 'tunnel', 'Tunnel IPv4 (host in a shared /30)')}</div>
    <details class="mt-4" id="vpn-${side}-interfaces"><summary class="cursor-pointer text-xs font-mono text-slate-400">Interface &amp; routing context</summary>
      <div class="grid sm:grid-cols-2 gap-4 mt-3">${field(side, 'wan', 'WAN interface / ASA nameif')}${field(side, 'lan', 'LAN interface / ASA nameif')}
      <label>WAN prefix<select name="${side}.wanPrefix" aria-label="${side.toUpperCase()} WAN prefix">${options(Object.fromEntries(WAN_PREFIXES.map(p=>[p,`/${p}`])))}</select></label>${field(side, 'lanIp', 'LAN interface IPv4', 'text', 'A usable host inside this side’s local subnet.')}
      <div data-asa>${field(side, 'wanPort', 'ASA physical WAN port')}${field(side, 'lanPort', 'ASA physical LAN port')}</div>
      <div data-gateway>${field(side, 'gateway', 'ISP gateway (same WAN subnet)')}</div>
      <div data-security-zone>${field(side, 'zone', 'Existing LAN security zone')}${field(side, 'vpnZone', 'VPN security zone')}${field(side, 'vpnUnit', 'VPN logical interface unit', 'number')}</div><div data-junos>${field(side, 'wanZone', 'Existing WAN security zone (Junos)')}</div><div data-pan>${field(side, 'vr', 'Virtual router (PAN-OS)')}</div></div>
    </details>
  </fieldset>`;
}
function advanced(name, label, values) {
  return `<label class="block text-xs text-slate-400" for="vpn-${name}">${label}<select id="vpn-${name}" name="${name}" class="${inputClass} mt-1">${options(values)}</select></label>`;
}
root.innerHTML = `<form id="vpn-form" novalidate>
  <div data-vpn-kind class="grid md:grid-cols-3 gap-4 mb-5 items-end">
    <label for="vpn-protocol" class="text-xs text-slate-400">VPN type<select id="vpn-protocol" name="protocol" class="${inputClass} mt-1">${options(PROTOCOLS)}</select></label>
    <p class="md:col-span-2 text-xs text-slate-500">IPv4 · Static public endpoints · Single LAN per side · Review target firmware in the knowledge base</p>
  </div>

  <label data-vti class="flex items-start gap-3 mb-4 text-xs text-amber-200" hidden><input name="vtiLegacy" type="checkbox" class="accent-cyan-400"><span>Legacy VTI lab profile: DH2 / SHA1<span class="block text-slate-500 mt-1">Off: use the selected AES/DH settings with SHA256. On: reproduce the reference template's DH2/SHA1 suite. PFS is not configured by this VTI profile. Both peers use Tunnel0 and a rebuilt ACL NAT.</span></span></label>
  <label data-vpn-binding class="flex items-start gap-3 mb-5 text-sm text-slate-300"><input id="vpn-bindInterfaces" name="bindInterfaces" type="checkbox" class="accent-cyan-400 mt-1"><span>Include physical interface IP assignments in CLI<span class="block text-xs text-slate-500 mt-1">Enabling this adds WAN/LAN address commands and, on ASA, nameif/security-level assignments. Existing interface configuration may be changed. Internet routing, zones and VLANs must already be configured.</span></span></label>
  <div class="grid lg:grid-cols-2 gap-4">${site('a')}${site('b')}</div>
  <div class="flex flex-wrap gap-2 mt-4">
    <button type="button" data-action="mirror" class="${buttonClass}">Mirror subnets from A</button>
    <button type="button" data-action="key" class="${buttonClass}">Generate shared PSK</button>
    <button type="button" data-action="clear" class="${buttonClass}">Clear secrets</button>
  </div>
  <details id="vpn-advanced" class="mt-5 border border-base-border rounded p-4">
    <summary class="font-mono text-xs text-slate-300 cursor-pointer">Advanced / Phase 1 &amp; Phase 2</summary>
    <p class="text-xs text-slate-500 mt-3">Both phases use the selected AES-CBC key size and SHA-256. Phase 2 uses ESP tunnel mode, or transport mode for GRE.</p>
    <div class="grid sm:grid-cols-2 xl:grid-cols-6 gap-4 mt-4">
      ${advanced('encryption', 'Encryption · both phases', {'256':'AES-256-CBC','128':'AES-128-CBC'})}
      ${advanced('hash', 'Integrity / IKEv2 PRF', {'256':'SHA-256'})}
      ${advanced('dh', 'Phase 1 DH group', {'14':'14 · MODP 2048','19':'19 · ECP 256'})}
      ${advanced('pfs', 'Phase 2 PFS group', {'14':'14 · MODP 2048','19':'19 · ECP 256'})}
      <label class="text-xs text-slate-400" for="vpn-lifetime1">Phase 1 lifetime (s)<input id="vpn-lifetime1" name="lifetime1" type="number" min="300" max="86400" class="${inputClass} mt-1"></label>
      <label class="text-xs text-slate-400" for="vpn-lifetime2">Phase 2 lifetime (s)<input id="vpn-lifetime2" name="lifetime2" type="number" min="300" max="86400" class="${inputClass} mt-1"></label>
    </div>
  </details>
  <p id="vpn-wg-note" class="mt-4 text-xs text-cyan-glow" hidden>WireGuard uses ChaCha20-Poly1305 and Curve25519. IPsec phase controls are inactive. Enter key pairs generated on the routers.</p>
</form>
<div id="vpn-validation" class="my-5 rounded border border-amber-400/30 bg-amber-400/5 p-4 text-xs text-amber-200" role="status" aria-live="polite" aria-atomic="true"></div>
<div data-vpn-output class="flex flex-wrap items-center justify-between gap-3 mb-3"><p class="text-xs font-mono text-slate-400">CONFIGURATION OUTPUT / LIVE PREVIEW</p><label class="text-xs text-slate-400 flex items-center gap-2"><input id="vpn-reveal" type="checkbox" class="accent-cyan-400">Reveal secrets</label></div>
<div data-vpn-output class="grid xl:grid-cols-2 gap-4">${['a','b'].map(side => `<section class="min-w-0 border border-base-border bg-base-950 rounded-lg overflow-hidden" aria-label="Side ${side.toUpperCase()} configuration"><div class="bg-base-800/60 border-b border-base-border p-3 flex items-center justify-between gap-3"><h3 id="vpn-heading-${side}" class="text-xs font-mono text-slate-300">SIDE ${side.toUpperCase()}</h3><button type="button" class="${buttonClass}" data-copy="${side}" disabled>Copy Config ${side.toUpperCase()}</button></div><pre class="p-4 text-xs leading-6 font-mono text-emerald-200 overflow-auto max-h-[36rem] min-h-[14rem]" tabindex="0" aria-label="Generated CLI side ${side.toUpperCase()}"><code id="vpn-output-${side}"></code></pre></section>`).join('')}</div>
<p data-vpn-output id="vpn-clipboard-status" class="mt-3 text-xs text-slate-400" role="status" aria-live="polite"></p>
<p class="text-[11px] text-slate-500 mt-3">Generation stays in your browser. No apply/save commands run automatically. Review existing crypto maps, names, routing and policies before using these templates.</p>`;

const form = root.querySelector('form');
let result;
function syncInputs() {
  for (const el of form.elements) {
    if (!el.name) continue;
    const [side, name] = el.name.split('.');
    if (el.type === 'checkbox') el.checked = Boolean(state[side]);
    else el.value = name ? state[side][name] : state[side];
  }
}
function render() {
  const wg = state.protocol === 'wireguard', overlay = wg || ['gre','vti'].includes(state.protocol);
  root.querySelector('[data-vti]').hidden = state.protocol !== 'vti';
  root.querySelectorAll('[data-wg]').forEach(el => { el.hidden = !wg; });
  root.querySelectorAll('[data-overlay]').forEach(el => { el.hidden = !overlay; });
  root.querySelector('#vpn-advanced').hidden = wg || ['a','b'].some(side=>cliProfile(state[side]).legacy);
  root.querySelector('#vpn-wg-note').hidden = !wg;
  for (const side of ['a', 'b']) {
    const fs = root.querySelector(`#vpn-${side}-vendor`).closest('fieldset');
    fs.querySelector('[data-profile-note]').textContent=cliProfile(state[side]).label+(state[side].vendor==='mikrotik'?' - match the installed version from /system resource print. An EVE-NG image label does not change the running RouterOS version.':'');
    const fortiPlatform=fs.querySelector('option[value=fortinet]');if(fortiPlatform)fortiPlatform.textContent=state[side].vendor==='fortinet'?cliProfile(state[side]).label:VENDORS.fortinet;
    const platform=fs.querySelector('select[name=\"'+side+'.vendor\"] option[value=ios]');if(platform)platform.textContent=state[side].vendor==='ios'?cliProfile(state[side]).label:VENDORS.ios;
    fs.querySelector('[data-security-zone]').hidden=!['juniper','paloalto'].includes(state[side].vendor)||wg;
    fs.querySelector('[data-junos]').hidden=state[side].vendor!=='juniper'||wg;
    fs.querySelector('[data-pan]').hidden = state[side].vendor !== 'paloalto' || wg;
    fs.querySelector('[data-gateway]').hidden = false;
    fs.querySelector('[data-asa]').hidden = state[side].vendor !== 'asa';
  }
  if(mountOptions.workbench!==false){for(const el of root.querySelectorAll('select')){if(el.name==='protocol')for(const option of el.options)option.disabled=!vpnAvailable(option.value,state.a.vendor,state.b.vendor)||(['a','b'].some(side=>cliProfile(state[side]).legacy)&&option.value!=='ikev1');mountSelectionMenu(el,controller.signal)();}}
  result = generate(state);
  root.dispatchEvent(new CustomEvent('vpn-state',{detail:structuredClone(state)}));
  const notice = root.querySelector('#vpn-validation');
  notice.className = result.errors.length
    ? 'my-5 rounded border border-amber-400/30 bg-amber-400/5 p-4 text-xs text-amber-200'
    : 'my-5 rounded border border-emerald-400/30 bg-emerald-400/5 p-4 text-xs text-emerald-200';
  notice.replaceChildren();
  if (result.errors.length) {
    const title = document.createElement('p'); title.textContent = 'Resolve these items to generate both configurations:'; notice.append(title);
    const ul = document.createElement('ul'); ul.className = 'list-disc pl-5 mt-2 space-y-1';
    result.errors.forEach(message => { const li = document.createElement('li'); li.textContent = message; ul.append(li); }); notice.append(ul);
  } else notice.textContent = 'Configuration inputs match. Review the platform assumptions and existing device configuration before deployment.';
  const reveal = root.querySelector('#vpn-reveal').checked;
  for (const side of ['a','b']) {
    root.querySelector(`#vpn-heading-${side}`).textContent = `SIDE ${side.toUpperCase()} // ${VENDORS[state[side].vendor]}`;
    root.querySelector(`#vpn-output-${side}`).textContent = result.errors.length ? '// Waiting for valid inputs…' : reveal ? result[side] : maskSecrets(result[side]);
    root.querySelector(`[data-copy="${side}"]`).disabled = result.errors.length > 0;
  }
}
function revealPsk(side, reveal) {
  root.querySelector(`#vpn-${side}-psk`).type = reveal ? 'text' : 'password';
  const button = root.querySelector(`[data-reveal-psk="${side}"]`);
  button.textContent = reveal ? 'Hide' : 'Show';
  button.setAttribute('aria-pressed', String(reveal));
  button.setAttribute('aria-label', `${reveal ? 'Hide' : 'Show'} Side ${side.toUpperCase()} pre-shared key`);
}
const interfaceDefaults = PORTS;
form.addEventListener('input', event => {
  const el = event.target;
  if (!el.name) return;
  const [side, name] = el.name.split('.');
  if (name) state[side][name] = el.value; else state[side] = el.type === 'checkbox' ? el.checked : el.value;
  if (name === 'vendor') {
    [state[side].wan, state[side].lan] = interfaceDefaults[el.value]; syncInputs();
  }
  root.querySelector('#vpn-clipboard-status').textContent = '';
  render();
});
form.addEventListener('submit', event => event.preventDefault());
root.querySelector('#vpn-reveal').addEventListener('change', render);
root.addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.revealPsk) {
    const side = button.dataset.revealPsk;
    revealPsk(side, root.querySelector(`#vpn-${side}-psk`).type === 'password');
    return;
  }
  if (button.dataset.editSide) {
    const side = button.dataset.editSide;
    root.querySelector(`#vpn-${side}-interfaces`).open = true;
    root.querySelector(`#vpn-${side}-wan`).focus();
    return;
  }
  const action = button.dataset.action;
  const status = root.querySelector('#vpn-clipboard-status');
  if (action === 'mirror') { state.b.local = state.a.remote; state.b.remote = state.a.local; }
  if (action === 'clear') {
    for (const side of ['a','b']) for (const field of ['psk','privateKey','publicKey']) state[side][field] = '';
    root.querySelector('#vpn-reveal').checked = false;
    status.textContent = 'Secrets cleared from this page. Previously copied clipboard text is not erased.';
  }
  if (action === 'key') {
    if (!globalThis.crypto?.getRandomValues) { status.textContent = 'Secure randomness unavailable. Enter a key generated on your device.'; return; }
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const key = state.protocol === 'wireguard' ? btoa(String.fromCharCode(...bytes)) : Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
    state.a.psk = state.b.psk = key;
    status.textContent = 'A fresh shared PSK is set on both sides.';
  }
  if (action === 'clear' || action === 'key') for (const side of ['a','b']) revealPsk(side, false);
  if (action) { syncInputs(); render(); }
  if (button.dataset.copy) {
    const side = button.dataset.copy;
    if (result.errors.length) return;
    try { await navigator.clipboard.writeText(result[side]); status.textContent = `Side ${side.toUpperCase()} configuration copied, including secrets.`; }
    catch { status.textContent = 'Clipboard access failed. Reveal the configuration, select its text and copy manually.'; }
  }
}, {signal:controller.signal});
root.addEventListener('lab-edit',event=>{
  for(const side of ['a','b']){const patch=event.detail[side];for(const key of ['routerModel','vendor','ip','wanPrefix','wan','lan','local','lanIp','gateway'])state[side][key]=patch[key];}
  if(['a','b'].some(side=>cliProfile(state[side]).legacy)&&!['wireguard'].includes(state.protocol))state.protocol='ikev1';
  state.a.remote=state.b.local;state.b.remote=state.a.local;state.bindInterfaces=true;syncInputs();render();
},{signal:controller.signal});
syncInputs(); render();
const cleanupWorkbench = mountOptions.workbench === false ? () => {} : mountWorkbench(root);
render();
return () => {controller.abort();cleanupWorkbench();root.replaceChildren();};
}
if (typeof document !== 'undefined') {
  const autoRoot = document.getElementById('vpn-app');
  if (autoRoot) mountVpn(autoRoot);
}

