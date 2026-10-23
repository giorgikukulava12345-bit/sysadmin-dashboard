# Network Engineering Lab

The deployed app uses Flask/Jinja and native ES modules. `templates/vpn/configurator.html` is included once in section 04, before the file repository (05). The previous core-tools section was removed.

- `ui.js`: VPN state, live validation and two terminal outputs; `mountVpn` returns cleanup.
- `workbench.js`: shared configuration selector and feature panels.
- `platforms.js`: enterprise vendor registry and physical-interface defaults.
- `lab.js`: persistent Router → Switch → Linux Host topology on both sides of the ISP cloud, inline device editing, validation, six per-device terminal outputs and clipboard actions. Router edits synchronize both ways with the VPN form. Other modes retain independent feature inputs; device addressing scripts remain available above them.
- `engine.js` and `vendors/`: VPN generators including Junos SRX IKEv1/IKEv2. Junos requires existing WAN routing and review of zone/NAT policy; scripts do not auto-commit.
- `catalog.js`: feature schemas and explicit capability gates. All vendor selectors list Cisco, MikroTik, FortiGate, Juniper and Palo Alto. Cisco-specific CCNA features remain Cisco templates; bootstrap remains RouterOS; OSPF/BGP supports IOS and RouterOS. Unsupported selections emit a visible explanation and zero feature commands.
- `vlsm.js`: largest-first subnet planning.

Topology router bindings support all five vendors. Switch configuration targets Cisco IOS, RouterOS (flat bridge) and Junos EX ELS. FortiGate/PAN-OS switch selections show an unsupported notice and disable copying rather than producing fabricated Layer 2 commands. Hosts use Linux iproute2.

No credentials are persisted or transmitted. Device scripts are generated locally and must be reviewed against the target device. The status lights represent input validity, not live network telemetry. Address edits clear invalid output atomically. Topology is a configuration model; it does not execute a packet-level simulation.

Run `/tests/index.html` through the app/static preview for engine and UI integration checks. React adapters and integration instructions are supplied separately. No Next.js build is applicable to this Flask repository.
