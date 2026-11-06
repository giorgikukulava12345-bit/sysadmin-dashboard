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

function randomPassword(length) {
  if (!/^\d+$/.test(length) || +length < 16 || +length > 128) throw Error('Choose a length from 16 to 128.');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return Array.from(crypto.getRandomValues(new Uint8Array(+length)), byte => alphabet[byte & 63]).join('');
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
.helpdesk-wires{list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.helpdesk-wires li{display:grid;grid-template-columns:1rem 1rem 1fr;align-items:center;gap:6px;font-size:.76rem;overflow-wrap:anywhere}
.helpdesk-wires i{display:block;width:1rem;height:.8rem;border:1px solid #ffffff55;border-radius:2px}
.helpdesk-hub h3{margin-top:18px}
@media(max-width:860px){.helpdesk-grid{grid-template-columns:minmax(0,1fr)}}
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
      <details class="noc-feature-settings"><summary>Password Generator</summary>
        <form data-tool="password" autocomplete="off"><label class="noc-field">Password length (16–128)<input type="number" name="length" min="16" max="128" value="24" required></label>${actions('Generate password')}</form>
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
      <details class="noc-feature-settings"><summary>SHA-256 File Checksum</summary>
        <p class="noc-muted">Compare a local file with the SHA-256 checksum published by its supplier. Supports files up to 32 MiB.</p>
        <form data-tool="checksum"><label class="noc-field">File<input type="file" name="file" required></label>
        <label class="noc-field">Expected SHA-256 (optional)<input name="expected" maxlength="64" placeholder="64 hexadecimal characters"></label>${actions('Calculate checksum')}</form>
      </details>
    </div>`;
  const stopPlanner = mountPlanner(root.querySelector('[data-planner]'));
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

  const handlers = {
    cidr: data => inspectCidr(data.get('network'), data.get('member')),
    codec: data => transformText(data.get('text'), data.get('format'), data.get('operation')),
    password: data => randomPassword(data.get('length')),
    diagnostics: data => diagnosticCommands(data.get('host'), data.get('port'), data.get('type')),
    json: data => ({text: formatJson(data.get('text'), data.get('format') === 'compact'), status: 'Valid JSON.'}),
    async checksum(data) {
      const file = data.get('file'), expected = data.get('expected').trim().toLowerCase();
      if (file.size > MAX_FILE) throw Error('Select a file no larger than 32 MiB.');
      if (expected && !/^[a-f0-9]{64}$/.test(expected)) throw Error('Expected SHA-256 must have 64 hexadecimal characters.');
      if (!crypto.subtle) throw Error('Checksum calculation requires HTTPS.');
      const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
      const text = Array.from(bytes, byte => byte.toString(16).padStart(2,'0')).join('');
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
