import { VENDORS, PROTOCOLS } from './engine.js';

export function topologyMarkup() {
  const device = side => `<button type="button" data-edit-side="${side}" class="vpn-device" aria-label="Configure Side ${side.toUpperCase()} interfaces">
    <span class="vpn-node-heading"><span class="vpn-led" data-topo="${side}-led"></span>SIDE ${side.toUpperCase()} DEVICE <span aria-hidden="true">↗</span></span>
    <strong data-topo="${side}-vendor"></strong>
    <span class="vpn-port-label">WAN / PUBLIC</span><span class="vpn-binding" data-topo="${side}-wan"></span>
    <span class="vpn-port-label">LAN / PRIVATE</span><span class="vpn-binding" data-topo="${side}-lan"></span>
    <span class="vpn-node-footer" data-topo="${side}-subnet"></span><span class="vpn-edit-label">EDIT INTERFACES &amp; ADDRESSES</span>
  </button>`;
  const transit = side => `<div class="vpn-transit" aria-label="Side ${side.toUpperCase()} WAN transit"><span class="vpn-transit-label" data-topo="${side}-port"></span><div class="vpn-wire"><span></span></div><span class="vpn-transit-ip" data-topo="${side}-ip"></span></div>`;
  return `<style>
    .vpn-topology{border:1px solid #233150;border-radius:10px;padding:20px;margin-bottom:22px;background-color:#080f1d;background-image:radial-gradient(#233150 1px,transparent 1px);background-size:18px 18px;font-family:'JetBrains Mono',monospace}
    .vpn-topology-header{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:10px;color:#94a3b8;margin-bottom:20px;letter-spacing:.08em}
    .vpn-topology-header strong{color:#67e8f9}.vpn-topology-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(60px,.38fr) minmax(145px,.65fr) minmax(60px,.38fr) minmax(0,1fr);align-items:center}
    .vpn-device{min-width:0;text-align:left;background:linear-gradient(145deg,#111e33,#0b1220);border:1px solid #2c4361;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:7px;color:#cbd5e1;transition:border-color .2s,box-shadow .2s}
    .vpn-device:hover{border-color:#22d3ee;box-shadow:0 0 20px #22d3ee15}.vpn-device:focus-visible{outline:2px solid #22d3ee;outline-offset:4px}.vpn-device strong{font-size:13px;color:#f1f5f9;overflow-wrap:anywhere;min-height:36px}.vpn-node-heading{font-size:10px;color:#67e8f9;display:flex;align-items:center;gap:8px}
    .vpn-led{width:7px;height:7px;background:#fbbf24;box-shadow:0 0 9px #fbbf2466;display:inline-block;border-radius:50%;flex-shrink:0}.vpn-led[data-valid="true"]{background:#34d399;box-shadow:0 0 10px #34d39977}
    .vpn-port-label{font-size:9px;color:#64748b;letter-spacing:.1em;margin-top:7px}.vpn-binding{font-size:11px;color:#a5f3fc;overflow-wrap:anywhere}.vpn-node-footer{border-top:1px solid #233150;padding-top:10px;margin-top:5px;font-size:10px;color:#94a3b8;overflow-wrap:anywhere}.vpn-edit-label{font-size:8px;color:#64748b;margin-top:4px}
    .vpn-cloud{text-align:center;padding:12px 6px;color:#67e8f9;min-width:0}.vpn-cloud svg{width:100%;max-width:125px;height:80px;margin:auto;filter:drop-shadow(0 0 9px #22d3ee44)}.vpn-cloud strong{display:block;font-size:12px;color:#e2e8f0}.vpn-cloud small{font-size:9px;color:#94a3b8;display:block;margin-top:7px}.vpn-transit{min-width:0;text-align:center}.vpn-transit-label,.vpn-transit-ip{font-size:9px;display:block;color:#94a3b8;overflow-wrap:anywhere;padding:5px}.vpn-transit-ip{color:#67e8f9}.vpn-wire{height:2px;background:linear-gradient(90deg,#155e75,#22d3ee,#155e75);box-shadow:0 0 8px #22d3ee44;position:relative}.vpn-wire:before,.vpn-wire:after{content:'';position:absolute;top:-3px;width:8px;height:8px;border-radius:50%;background:#22d3ee}.vpn-wire:before{left:0}.vpn-wire:after{right:0}
    .vpn-path{margin-top:20px;border-top:1px dashed #2c4361;padding-top:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:10px;color:#94a3b8}.vpn-path code{color:#a5f3fc;overflow-wrap:anywhere}.vpn-path small{color:#64748b;font-size:9px}.vpn-topology-note{font-size:10px;color:#94a3b8;margin-top:12px}
    @media(max-width:850px){.vpn-topology-grid{grid-template-columns:1fr}.vpn-device strong{min-height:0}.vpn-device{width:100%}.vpn-transit{display:flex;align-items:center;justify-content:center;gap:14px;min-height:65px}.vpn-wire{height:55px;width:2px;flex-shrink:0}.vpn-wire:before,.vpn-wire:after{left:-3px;top:auto}.vpn-wire:before{top:0}.vpn-wire:after{bottom:0}.vpn-transit-label,.vpn-transit-ip{max-width:40%}.vpn-cloud svg{height:65px}.vpn-topology{padding:14px}}
    @media(prefers-reduced-motion:reduce){.vpn-device{transition:none}}
  </style>
  <section class="vpn-topology" aria-label="Interactive VPN network topology">
    <div class="vpn-topology-header"><strong>NETWORK TOPOLOGY // WAN UNDERLAY</strong><span data-topo="status" role="status" aria-live="polite"></span></div>
    <div class="vpn-topology-grid">${device('a')}${transit('a')}
      <div class="vpn-cloud" aria-label="Central ISP and public Internet cloud">
        <svg viewBox="0 0 130 80" aria-hidden="true" fill="none"><path d="M30 65C3 65 0 33 24 27C29 2 65 0 76 20C101 8 126 29 115 48C133 66 105 73 93 65Z" stroke="#22d3ee" stroke-width="1.5" fill="#0b2234"/><path d="M40 41h50M65 27v28M48 30l34 23M48 53l34-23" stroke="#155e75"/><circle cx="65" cy="41" r="7" stroke="#67e8f9"/><circle cx="40" cy="41" r="3" fill="#22d3ee"/><circle cx="90" cy="41" r="3" fill="#22d3ee"/></svg>
        <strong>ISP / PUBLIC INTERNET</strong><small>WAN TRANSIT FABRIC</small><small data-topo="protocol"></small>
      </div>${transit('b')}${device('b')}</div>
    <div class="vpn-path"><span>PUBLIC PATH</span><code data-topo="path"></code><small>Solid lines = physical WAN underlay · VPN = logical overlay</small></div>
    <p class="vpn-topology-note" data-topo="note"></p>
  </section>`;
}

export function updateTopology(root, state, errors) {
  const text = (key, value) => { root.querySelector(`[data-topo="${key}"]`).textContent = value; };
  for (const side of ['a','b']) {
    const s = state[side];
    text(`${side}-vendor`, VENDORS[s.vendor] || 'Select a platform');
    text(`${side}-wan`, `${s.vendor === 'asa' ? s.wanPort + ' / ' : ''}${s.wan} · ${s.ip}${state.bindInterfaces ? '/' + s.wanPrefix : ''}`);
    text(`${side}-lan`, `${s.lan} · ${s.lanIp || 'Set LAN interface IP'}`);
    text(`${side}-subnet`, `LAN NETWORK ${s.local}`);
    text(`${side}-port`, s.wan || 'WAN interface');
    text(`${side}-ip`, s.ip || 'Public IPv4');
    root.querySelector(`[data-topo="${side}-led"]`).dataset.valid = String(!errors.length);
  }
  text('path', `${state.a.ip || 'Side A WAN'} → ISP / Internet → ${state.b.ip || 'Side B WAN'}`);
  text('protocol', PROTOCOLS[state.protocol] || 'Select VPN type');
  text('status', errors.length ? '● INPUTS INCOMPLETE' : '● CONFIGURATION READY');
  text('note', `Logical topology preview; no live connectivity probes. ${state.bindInterfaces ? 'WAN/LAN IP assignments are included in both CLI outputs.' : 'Existing interface addressing is assumed. Enable interface binding below to include IP assignments in CLI.'}`);
}
