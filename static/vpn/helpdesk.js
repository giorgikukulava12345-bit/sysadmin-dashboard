import {cidr, ipv4} from './address.js';
import {mountPlanner} from './planner-ui.js';

const MAX_FILE = 32 * 1024 * 1024;
const dotted = value => [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.');
const wireColors = {
  green: ['Green', '#15803d'], orange: ['Orange', '#f97316'],
  blue: ['Blue', '#2563eb'], brown: ['Brown', '#92400e'],
};
const wiring = {
  A: ['green', 'green', 'orange', 'blue', 'blue', 'orange', 'brown', 'brown'],
  B: ['orange', 'orange', 'green', 'blue', 'blue', 'green', 'brown', 'brown'],
};

function inspectCidr(input, member) {
  const value = input.trim();
  const net = value.split('/').length === 2 ? cidr(value) : null;
  if (!net) throw Error('Enter an IPv4 address and prefix, such as 192.168.10.34/24.');
  const size = net.end - net.network + 1;
  const first = net.network + (size > 2 ? 1 : 0);
  const last = net.end - (size > 2 ? 1 : 0);
  const lines = [
    `Network: ${net.canonical}`, `Mask: ${net.mask}`, `Wildcard: ${net.wildcard}`,
    `Broadcast: ${size > 2 ? dotted(net.end) : 'None'}`,
    `Usable range: ${dotted(first)} – ${dotted(last)}`,
    `Total addresses: ${size}`, `Usable addresses: ${last - first + 1}`,
  ];
  if (size === 2) lines.push('/31 assumes a point-to-point link (RFC 3021).');
  if (member.trim()) {
    const ip = ipv4(member.trim());
    if (ip === null) throw Error('Enter a valid IPv4 address in the membership field.');
    lines.push(`Membership: ${ip >= net.network && ip <= net.end ? 'Inside subnet' : 'Outside subnet'}`);
  }
  return lines.join('\n');
}

function transformText(input, format, operation) {
  try {
    if (format === 'url') {
      return operation === 'encode'
        ? encodeURIComponent(input).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase())
        : decodeURIComponent(input);
    }
    if (operation === 'encode') {
      const bytes = new TextEncoder().encode(input);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    }
    const binary = atob(input);
    return new TextDecoder('utf-8', {fatal: true, ignoreBOM: true})
      .decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
  } catch {
    throw Error(format === 'url' ? 'Invalid URL component encoding.' : 'Enter valid Base64 representing UTF-8 text.');
  }
}

const passwordLength = {min: 8, max: 128, initial: 24};
const passwordSets = [
  ['Uppercase', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
  ['Lowercase', 'abcdefghijklmnopqrstuvwxyz'],
  ['Numbers', '0123456789'],
  ['Symbols', '!@#$%^&*()-_=+[]{}:;,.?'],
];

function randomPassword(length, sets) {
  const alphabet = sets.join('');
  const limit = 256 - (256 % alphabet.length);
  const bytes = new Uint8Array(length);
  // Reject extra byte values and candidates missing a selected character type.
  for (;;) {
    let candidate = '';
    while (candidate.length < length) {
      for (const byte of crypto.getRandomValues(bytes)) {
        if (byte >= limit) continue;
        candidate += alphabet[byte % alphabet.length];
        if (candidate.length === length) break;
      }
    }
    if (sets.every(set => [...candidate].some(char => set.includes(char)))) return candidate;
  }
}

function mountPassword(panel, options) {
  const form = panel.querySelector('form');
  const length = form.elements.lengthRange;
  const count = form.querySelector('[data-password-count]');
  const checks = [...form.querySelectorAll('input[type=checkbox]')];
  const result = form.querySelector('[data-password-result]');
  const meter = form.querySelector('meter');
  const strength = form.querySelector('[data-password-strength]');
  const copy = form.querySelector('[data-password-copy]');
  const status = form.querySelector('[role=status]');
  let revision = 0;
  const selectedSets = () => passwordSets.filter((_, i) => checks[i].checked).map(([, chars]) => chars);

  function generate() {
    revision++;
    status.textContent = '';
    copy.textContent = 'Copy password';
    const size = Number(length.value);
    const sets = selectedSets();
    count.textContent = size;
    // This is an estimate based on the length and available characters.
    const bits = size * Math.log2(sets.join('').length);
    const level = bits < 45 ? 1 : bits < 70 ? 2 : bits < 100 ? 3 : 4;
    try {
      result.textContent = randomPassword(size, sets);
      meter.value = level;
      strength.textContent = ['Weak', 'Fair', 'Strong', 'Very strong'][level - 1];
      form.dataset.strength = level;
      copy.disabled = false;
    } catch {
      result.textContent = 'Password unavailable';
      meter.value = 0;
      strength.textContent = 'Unavailable';
      delete form.dataset.strength;
      copy.disabled = true;
      status.textContent = 'Secure password generation is unavailable in this browser.';
    }
  }

  panel.addEventListener('toggle', () => {
    if (panel.open) generate();
    else {
      revision++;
      result.textContent = '';
      status.textContent = '';
      copy.disabled = true;
    }
  }, options);
  form.addEventListener('submit', event => {
    event.preventDefault();
    generate();
  }, options);
  length.addEventListener('input', generate, options);
  for (const check of checks) check.addEventListener('change', () => {
    if (!selectedSets().length) {
      check.checked = true;
      status.textContent = 'Keep at least one character type selected.';
      return;
    }
    generate();
  }, options);
  copy.addEventListener('click', async () => {
    const version = revision;
    try {
      await navigator.clipboard.writeText(result.textContent);
      if (version !== revision || options.signal.aborted) return;
      copy.textContent = 'Copied!';
      status.textContent = 'Password copied.';
    } catch {
      if (version !== revision || options.signal.aborted) return;
      status.textContent = 'Clipboard unavailable. Select and copy the password manually.';
      result.focus();
    }
  }, options);
}

async function sha256(input) {
  if (!crypto.subtle) throw Error('SHA-256 calculation requires HTTPS.');
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  return Array.from(bytes, byte => byte.toString(16).padStart(2,'0')).join('');
}

function formatJson(input, compact) {
  try { JSON.parse(input); }
  catch { throw Error('Invalid JSON. Check quotes, commas, and matching brackets.'); }
  // Format the original tokens so numbers, escape sequences and duplicate keys retain their spelling.
  const tokens = input.match(/"(?:[^"\\]|\\[\s\S])*"|[^\s\[\]{}:,"]+|[\[\]{}:,]/g);
  if (compact) return tokens.join('');
  let depth = 0;
  const indent = () => '\n' + '  '.repeat(depth);
  return tokens.map((token, index) => {
    const previous = tokens[index - 1], next = tokens[index + 1];
    if (token === '{' || token === '[') {
      if (++depth > 64) throw Error('Formatting supports up to 64 nesting levels.');
      return token + (next === '}' || next === ']' ? '' : indent());
    }
    if (token === '}' || token === ']') {
      depth--;
      return (previous === '{' || previous === '[' ? '' : indent()) + token;
    }
    return token === ',' ? ',' + indent() : token === ':' ? ': ' : token;
  }).join('');
}

function diagnosticCommands(target, port, type) {
  const host = target.trim();
  const hostname = host.replace(/\.$/, '');
  if (ipv4(host) === null && (
    !hostname || hostname.length > 253 || /^[\d.]+$/.test(hostname) ||
    !hostname.split('.').every(label => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))
  )) throw Error('Enter a hostname or IPv4 address.');
  if (!/^\d{1,5}$/.test(port) || +port < 1 || +port > 65535) throw Error('Enter a TCP port from 1 to 65535.');
  if (!['A','AAAA','CNAME','MX','TXT','NS','PTR'].includes(type)) throw Error('Select a DNS record type.');
  const dnsTarget = type === 'PTR' && ipv4(host) !== null ? host.split('.').reverse().join('.') + '.in-addr.arpa' : host;
  return [
    '# Windows PowerShell', `Resolve-DnsName -Name '${dnsTarget}' -Type ${type} -DnsOnly`,
    `Test-NetConnection -ComputerName '${host}' -Port ${+port}`, '',
    '# Linux / macOS (requires dig and nc)', `dig ${dnsTarget} ${type}`, `nc -vz ${host} ${+port}`,
  ].join('\n');
}

const styles = `
.helpdesk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}
.helpdesk-grid details{min-width:0;margin:0}
.helpdesk-grid form{display:grid;gap:10px;margin-top:12px}
.helpdesk-grid textarea{box-sizing:border-box;width:100%;max-width:100%;resize:vertical;background:#090b12;color:#d8e5f3;border:1px solid #334155;border-radius:8px;padding:10px;font:12px/1.5 monospace}
.helpdesk-output{min-width:0;white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto;background:#090b12;color:#a7f3d0;padding:10px;border-radius:8px}
.helpdesk-grid [role=status]{min-height:1em}
.helpdesk-grid .noc-field input,.helpdesk-grid .noc-field select{min-width:0;max-width:100%}
.helpdesk-grid .helpdesk-password{grid-column:1/-1;border:1px solid #28566a;border-radius:12px;padding:0 14px;background:#10202b}
.helpdesk-grid .helpdesk-password>summary{min-height:44px;padding:12px 0;font-size:1.125rem;font-weight:750;color:#a5f3fc}
.helpdesk-password .password-panel{gap:12px;margin:0 0 14px;padding:clamp(12px,3vw,26px);border-radius:10px;background:#f4f7f8;color:#101e29;color-scheme:light}
.password-result-row{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #8b9ba5;border-radius:10px;background:#fff}
.password-result{flex:1 1 14rem;min-width:0;min-height:1.4em;margin:0;color:#101e29;font:700 clamp(1rem,3vw,1.45rem)/1.4 'JetBrains Mono',monospace;white-space:pre-wrap;overflow-wrap:anywhere;user-select:all}
.password-actions{display:flex;flex-wrap:wrap;gap:8px}
.helpdesk-password .password-actions button{min-height:44px;padding:8px 14px;border:1px solid #8598a3;border-radius:8px;background:#fff;color:#193847;font-family:inherit;font-size:.9rem;font-weight:700;line-height:1.2;white-space:nowrap;cursor:pointer}
.helpdesk-password .password-actions button:hover{background:#e6f3f7}
.helpdesk-password .password-actions [data-password-copy]{border-color:#b60d3e;background:#b60d3e;color:#fff}
.helpdesk-password .password-actions [data-password-copy]:hover{background:#970d36}
.password-panel :focus-visible,.helpdesk-password>summary:focus-visible{outline:3px solid #1686a3;outline-offset:3px}
.password-rating{display:flex;align-items:center;gap:12px;font-size:.875rem;font-weight:700;--rating:#40546a;color:var(--rating)}
.password-panel[data-strength="1"] .password-rating{--rating:#a6253c}
.password-panel[data-strength="2"] .password-rating{--rating:#985112}
.password-panel[data-strength="3"] .password-rating{--rating:#176b65}
.password-panel[data-strength="4"] .password-rating{--rating:#16633a}
.password-rating meter{flex:1;min-width:0;width:100%;height:.75rem;appearance:none;background:#d6dfe2;border-radius:99px;overflow:hidden}
.password-rating meter::-webkit-meter-bar{background:#d6dfe2;border:0}
.password-rating meter::-webkit-meter-optimum-value{background:var(--rating);border-radius:99px}
.password-rating meter::-moz-meter-bar{background:var(--rating);border-radius:99px}
.password-controls{display:grid;gap:14px;margin:0;padding:16px;border-radius:10px;background:#e0efe6}
.password-length{display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;font-weight:700}
.password-length output{display:inline-block;min-width:2.6em;padding:3px 6px;border-radius:6px;background:#fff;text-align:center;font-variant-numeric:tabular-nums}
.password-length input[type=range]{flex:1 1 180px;min-width:0;height:32px;margin:0;padding:0;border:0;background:transparent;accent-color:#126450;cursor:pointer}
.password-characters{min-inline-size:0;margin:0;padding:0;border:0}
.password-characters legend{padding:0;font-weight:700}
.password-checks{display:flex;flex-wrap:wrap;gap:0 18px}
.password-checks label{display:flex;align-items:center;gap:7px;min-height:44px;color:#101e29;cursor:pointer}
.password-checks input[type=checkbox]{width:19px;height:19px;margin:0;accent-color:#126450}
.password-panel [role=status]{margin:0;color:#244456;font-size:.875rem}
.password-panel [role=status]:empty{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
@media(max-width:580px){.password-result-row{align-items:stretch;flex-direction:column}.password-result{flex:auto}.password-actions button{flex:1}.password-length input[type=range]{flex-basis:100%}}
.helpdesk-wires{list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.helpdesk-wires li{display:grid;grid-template-columns:1rem 1rem 1fr;align-items:center;gap:6px;font-size:.76rem;overflow-wrap:anywhere}
.helpdesk-wires i{display:block;width:1rem;height:.8rem;border:1px solid #ffffff55;border-radius:2px}
.helpdesk-hub h3{margin-top:18px}
.helpdesk-command{margin:12px 0;padding:8px 0;border-top:1px solid #334155}
.helpdesk-steps{display:grid;gap:10px;padding-inline-start:1.4rem;list-style:decimal}
@media(max-width:860px){.helpdesk-grid{grid-template-columns:minmax(0,1fr)}}
`;

const command = (text, note) => `
  <div class="helpdesk-command"><p class="noc-muted">${note}</p>
    <pre class="helpdesk-output"><code>${text}</code></pre>
    <button type="button" data-copy-windows>Copy command</button>
    <p class="noc-note" role="status"></p>
  </div>`;

const windowsTools = `
    <h3>Windows Repair &amp; Diagnostics</h3>
    <div class="helpdesk-grid">
      <details class="noc-feature-settings"><summary>System files &amp; disk</summary>
        <p class="noc-muted">Open Windows Terminal or Command Prompt as administrator. For suspected system file corruption, run DISM first and wait for it to complete successfully before running SFC.</p>
        ${command('DISM.exe /Online /Cleanup-Image /RestoreHealth','Repair the Windows component store. DISM may use Windows Update for repair files.')}
        ${command('sfc /scannow','Scan protected system files and repair them using the component store.')}
        ${command('chkdsk C: /scan','Start with an online scan of the NTFS system volume. Adjust the drive letter if needed.')}
        ${command('chkdsk C: /f','Use if the scan reports errors that need repair. Save work and back up important files first. Windows may schedule the repair for the next restart.')}
        <p><a href="https://support.microsoft.com/en-gb/windows/deployment/updates-lifecycle/troubleshoot-problems-updating-windows" target="_blank" rel="noopener noreferrer">Microsoft system repair</a> · <a href="https://learn.microsoft.com/windows-server/administration/windows-commands/chkdsk" target="_blank" rel="noopener noreferrer">CHKDSK reference</a></p>
      </details>
      <details class="noc-feature-settings"><summary>Network recovery</summary>
        <p class="noc-muted">Run commands individually in an administrator terminal. Retest the original symptom after each step.</p>
        ${command('ipconfig /flushdns','Clear cached DNS answers when a record has changed or the client has cached a failed lookup.')}
        ${command('netsh winsock reset','Reset the Winsock catalog when applications still fail to connect and a socket provider issue is suspected. Restart afterward.')}
        ${command('netsh int ip reset resetlog.txt','Reset TCP/IP as a later recovery step. Record static IP, gateway, and DNS settings first. Use a local console because remote access can drop. Restart afterward and reapply settings if needed.')}
        <p><a href="https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netsh-winsock" target="_blank" rel="noopener noreferrer">Winsock reference</a> · <a href="https://learn.microsoft.com/en-us/troubleshoot/windows-server/networking/reset-tcp-ip-net-shell" target="_blank" rel="noopener noreferrer">TCP/IP reset reference</a></p>
      </details>
      <details class="noc-feature-settings"><summary>Temporary files &amp; cache</summary>
        <p class="noc-muted">Start in Settings → System → Storage → Temporary files. Review the categories, especially Downloads and Recycle Bin, before removing anything. Storage Sense can automate routine cleanup.</p>
        ${command('%temp%','Paste into Win + R to inspect your user temp folder. Close the affected app first and skip files Windows reports as in use.')}
        ${command('%windir%\\Temp','Paste into Win + R to inspect the system temp folder. Prefer Storage settings for cleanup.')}
        <p class="noc-muted"><strong>Prefetch:</strong> Windows manages this cache to speed up app startup. Leave it in place during routine cleanup.</p>
        <a href="https://support.microsoft.com/en-us/windows/experience/storage-filemanagement/manage-drive-space-with-storage-sense" target="_blank" rel="noopener noreferrer">Microsoft Storage Sense guide</a>
      </details>
    </div>
    <h3>PC Performance &amp; Slowdown Guide</h3>
    <div class="helpdesk-grid">
      <details class="noc-feature-settings"><summary>Triage a slow Windows PC</summary>
        <ol class="helpdesk-steps">
          <li><strong>Reproduce and measure.</strong> Open Task Manager with <kbd>Ctrl + Shift + Esc</kbd>. In Processes, sort by CPU, Memory and Disk while the slowdown occurs. Note the top process and whether the spike persists.</li>
          <li><strong>CPU stays high.</strong> Identify the busy app or service. Check for updates, scanning or sync activity, then retest when it completes. Close only a known app after saving its work.</li>
          <li><strong>Memory stays high.</strong> Check Available and Committed in Performance → Memory. Reduce tabs or workloads, then compare again. Keep the Windows pagefile system managed and leave space on the system drive for it to grow.</li>
          <li><strong>Disk stays at 100% active time.</strong> Open Resource Monitor (<code>resmon.exe</code>) and inspect the Disk tab for the process and response time. Check free space on C: and use Storage settings. If I/O errors recur, back up data and check drive health with the vendor utility.</li>
          <li><strong>Startup is slow.</strong> In Task Manager → Startup apps, disable one nonessential item at a time. Keep security and device management agents enabled. Restart and compare.</li>
          <li><strong>Performance drops as the PC heats up.</strong> Compare CPU clock speed and temperature during the same workload using the device vendor utility. Falling clocks alongside rising temperatures may indicate thermal throttling. Check vents, fans and airflow.</li>
          <li><strong>Verify the improvement.</strong> Repeat the original workload and record before/after resource use and elapsed time. Escalate recurring disk errors, crashes or thermal shutdowns.</li>
        </ol>
        <a href="https://support.microsoft.com/en-gb/windows/experience/performance-optimization/tips-to-improve-pc-performance-in-windows" target="_blank" rel="noopener noreferrer">Microsoft Windows performance guide</a>
      </details>
    </div>
`;

const actions = label => `<div class="noc-actions"><button type="submit">${label}</button><button type="button" data-copy disabled>Copy result</button><button type="reset">Clear</button></div>
<pre class="helpdesk-output" tabindex="0" aria-label="Result" hidden></pre><p class="noc-note" role="status"></p>`;

export function mountHelpdesk(root) {
  const abort = new AbortController();
  const options = {signal: abort.signal};
  root.innerHTML = `<style>${styles}</style>
    <h2>Engineering &amp; Helpdesk Tools</h2>
    <p class="noc-muted">Tools process your inputs in the browser. Diagnostic commands run on the affected device when you execute them there.</p>
    <h3>Network &amp; Subnet Utilities</h3>
    <div class="helpdesk-grid">
      <details class="noc-feature-settings"><summary>VLSM Subnet Calculator</summary><div data-planner></div></details>
      <details class="noc-feature-settings"><summary>IPv4 / CIDR Inspector</summary>
        <form data-tool="cidr"><label class="noc-field">IPv4 address / prefix<input name="network" placeholder="192.168.10.34/24" maxlength="18" required></label>
        <label class="noc-field">Check address membership (optional)<input name="member" placeholder="192.168.10.100" maxlength="15"></label>${actions('Inspect subnet')}</form>
      </details>
    </div>
    <h3>IT Support &amp; Helpdesk</h3>
    <div class="helpdesk-grid">
      <details class="noc-feature-settings"><summary>RJ45 T568A / T568B Wiring</summary>
        <p class="noc-muted">Numbered pin guide. For a plug, hold the gold contacts toward you, latch away, and cable pointing down. Pin 1 is on the left. For a jack, follow its printed A/B termination guide.</p>
        <div data-wiring></div><p class="noc-note" data-wire-status></p>
        <a href="https://www.flukenetworks.com/knowledge-base/application-or-standards-articles-copper/differences-between-wiring-codes-t568a-vs" target="_blank" rel="noopener noreferrer">Fluke Networks pinout reference</a>
      </details>
      <details class="noc-feature-settings"><summary>Base64 / URL Encoder &amp; Decoder</summary>
        <form data-tool="codec"><label class="noc-field">Format<select name="format"><option value="base64">Base64 (UTF-8 text)</option><option value="url">URL component (percent encoding)</option></select></label>
        <label class="noc-field">Operation<select name="operation"><option value="encode">Encode</option><option value="decode">Decode</option></select></label>
        <label class="noc-field">Input text<textarea name="text" rows="4" maxlength="100000"></textarea></label>${actions('Convert')}</form>
      </details>
      <details class="noc-feature-settings"><summary>DNS &amp; TCP Troubleshooting Commands</summary>
        <p class="noc-muted">Prepare commands for Windows, Linux, or macOS. Run them from the client or network you need to troubleshoot.</p>
        <form data-tool="diagnostics"><label class="noc-field">Hostname or IPv4<input name="host" placeholder="example.com" maxlength="254" required></label>
        <label class="noc-field">TCP port<input name="port" type="number" min="1" max="65535" value="443" required></label>
        <label class="noc-field">DNS record type<select name="type">${['A','AAAA','CNAME','MX','TXT','NS','PTR'].map(type => `<option>${type}</option>`).join('')}</select></label>${actions('Build commands')}</form>
      </details>
      <details class="noc-feature-settings"><summary>JSON Validator &amp; Formatter</summary>
        <form data-tool="json"><label class="noc-field">JSON payload<textarea name="text" rows="5" maxlength="50000" required></textarea></label>
        <label class="noc-field">Output format<select name="format"><option value="pretty">Indented</option><option value="compact">Compact</option></select></label>${actions('Validate and format')}</form>
      </details>
      <details class="noc-feature-settings"><summary>SHA-256 Text Hash</summary>
        <form data-tool="text-hash"><label class="noc-field">Text (UTF-8)<textarea name="text" rows="4" maxlength="100000"></textarea></label>${actions('Generate SHA-256')}</form>
      </details>
      <details class="noc-feature-settings"><summary>SHA-256 File Checksum</summary>
        <p class="noc-muted">Compare a local file with the SHA-256 checksum published by its supplier. Supports files up to 32 MiB.</p>
        <form data-tool="checksum"><label class="noc-field">File<input type="file" name="file" required></label>
        <label class="noc-field">Expected SHA-256 (optional)<input name="expected" maxlength="64" placeholder="64 hexadecimal characters"></label>${actions('Calculate checksum')}</form>
      </details>
      <details class="noc-feature-settings helpdesk-password"><summary>Password Generator</summary>
        <form class="password-panel" autocomplete="off">
          <div class="password-result-row">
            <pre class="password-result" data-password-result tabindex="0" aria-label="Generated password"></pre>
            <div class="password-actions">
              <button type="submit">Regenerate</button>
              <button type="button" data-password-copy disabled>Copy password</button>
            </div>
          </div>
          <div class="password-rating">
            <meter min="0" max="4" value="0" aria-label="Estimated password strength"></meter>
            <span>Strength: <span data-password-strength></span></span>
          </div>
          <div class="password-controls">
            <label class="password-length">
              <span>Password length <output data-password-count>${passwordLength.initial}</output></span>
              <input name="lengthRange" type="range" min="${passwordLength.min}" max="${passwordLength.max}" value="${passwordLength.initial}" aria-label="Password length">
            </label>
            <fieldset class="password-characters">
              <legend>Character types</legend>
              <div class="password-checks">${passwordSets.map(([label]) => `<label><input type="checkbox" checked> ${label}</label>`).join('')}</div>
            </fieldset>
          </div>
          <p role="status"></p>
        </form>
      </details>
    </div>
    ${windowsTools}`;
  const stopPlanner = mountPlanner(root.querySelector('[data-planner]'));
  mountPassword(root.querySelector('.helpdesk-password'), options);
  const wireControls = [];
  for (const end of ['1','2']) {
    const label = document.createElement('label');
    label.className = 'noc-field';
    label.textContent = 'Cable end ' + end;
    const select = document.createElement('select');
    select.innerHTML = '<option value="A">T568A</option><option value="B" selected>T568B</option>';
    label.append(select);
    const pins = document.createElement('ol');
    pins.className = 'helpdesk-wires';
    pins.setAttribute('aria-label', 'Pin assignments for cable end ' + end);
    root.querySelector('[data-wiring]').append(label, pins);
    wireControls.push({select,pins});
  }
  function showPins() {
    for (const {select,pins} of wireControls) {
      pins.replaceChildren(...wiring[select.value].map((color, index) => {
        const [name,hex] = wireColors[color], striped = [0,2,4,6].includes(index);
        const pin = document.createElement('li');
        const number = document.createElement('span'), swatch = document.createElement('i');
        number.textContent = index + 1;
        swatch.style.background = striped ? `repeating-linear-gradient(135deg,#fff 0 3px,${hex} 3px 6px)` : hex;
        swatch.setAttribute('aria-hidden','true');
        pin.append(number, swatch, (striped ? 'White / ' : '') + name);
        return pin;
      }));
    }
    root.querySelector('[data-wire-status]').textContent = wireControls[0].select.value === wireControls[1].select.value
      ? 'Straight-through wiring (same scheme at both ends).'
      : 'A-to-B crossover wiring (pins 1/2 cross with 3/6).';
  }
  for (const {select} of wireControls) select.addEventListener('change', showPins, options);
  showPins();

  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy-windows]');
    if (!button) return;
    const block = button.closest('.helpdesk-command');
    let message = 'Copied.';
    try { await navigator.clipboard.writeText(block.querySelector('code').textContent); }
    catch { message = 'Clipboard unavailable. Select and copy the command manually.'; }
    if (!abort.signal.aborted) block.querySelector('[role=status]').textContent = message;
  }, options);

  const handlers = {
    cidr: data => inspectCidr(data.get('network'), data.get('member')),
    codec: data => transformText(data.get('text'), data.get('format'), data.get('operation')),
    diagnostics: data => diagnosticCommands(data.get('host'), data.get('port'), data.get('type')),
    json: data => ({text: formatJson(data.get('text'), data.get('format') === 'compact'), status: 'Valid JSON.'}),
    'text-hash': data => sha256(new TextEncoder().encode(data.get('text'))),
    async checksum(data) {
      const file = data.get('file'), expected = data.get('expected').trim().toLowerCase();
      if (file.size > MAX_FILE) throw Error('Select a file no larger than 32 MiB.');
      if (expected && !/^[a-f0-9]{64}$/.test(expected)) throw Error('Expected SHA-256 must have 64 hexadecimal characters.');
      const text = await sha256(await file.arrayBuffer());
      return {text, status: expected ? (text === expected ? 'Checksum matches.' : 'Checksum does not match.') : 'SHA-256 calculated.'};
    },
  };
  for (const form of root.querySelectorAll('[data-tool]')) {
    const output = form.querySelector('pre'), status = form.querySelector('[role=status]'), copy = form.querySelector('[data-copy]');
    let version = 0;
    function clear() {
      version++;
      output.hidden = true;
      output.textContent = '';
      status.textContent = '';
      copy.disabled = true;
    }
    form.addEventListener('input', clear, options);
    form.addEventListener('reset', clear, options);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      clear();
      const request = version;
      try {
        const result = await handlers[form.dataset.tool](new FormData(form));
        if (abort.signal.aborted || request !== version) return;
        output.textContent = typeof result === 'string' ? result : result.text;
        status.textContent = result.status || '';
        output.hidden = false;
        copy.disabled = false;
      } catch (error) {
        if (!abort.signal.aborted && request === version) status.textContent = error.message;
      }
    }, options);
    copy.addEventListener('click', async () => {
      const request = version;
      let message = 'Copied.';
      try { await navigator.clipboard.writeText(output.textContent); }
      catch { message = 'Clipboard unavailable. Select and copy the result manually.'; }
      if (!abort.signal.aborted && request === version) status.textContent = message;
    }, options);
  }
  return () => { abort.abort(); stopPlanner(); root.replaceChildren(); };
}
