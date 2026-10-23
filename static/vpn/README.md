# Network Engineering Command Center

34 categorized CCNA/CCNP features. Choose a vendor/device, check features, edit only their parameters, then Submit / Generate Configuration. Any draft change invalidates the previous snapshot; Copy Config is disabled until resubmitted. Syntax coloring never interprets CLI as HTML. Secrets stay in memory and require explicit reveal.

## Platform and integration

The existing live repository is Flask/Jinja with browser ES modules, not Next.js. The dashboard overlay updates that application in place. The React package provides an App Router client boundary plus optional controlled components, sharing the same validation and generator modules. No React migration is required for the deployed site.

## Topology

Standard tasks show one selected site (Host ↔ Switch ↔ Router ↔ ISP). Site A or B can be selected independently. A Site-to-Site VPN, DMVPN or Remote Access VPN selection makes the dual-site preview visible. Public/LAN interfaces, gateway, host and management addresses share the existing topology model. The diagram is configuration state, not live telemetry; DMVPN is not an automatic two-node mesh orchestrator.

## Feature support

All checkboxes remain interactive across five vendors. Unsupported vendor/feature combinations block the entire selected-device output with an explanation; no partial or substitute vendor syntax is emitted. These are reviewed lab starters, not claims of universal firmware/hardware compatibility.

| Feature | Cisco IOS/XE | MikroTik | FortiGate | Juniper | Palo Alto |
|---|---|---|---|---|---|
| NAT / PAT · Static, Dynamic, Overload | Template | Template | No template | No template | No template |
| Standard & Extended ACLs | Template | No template | No template | No template | No template |
| Static Routing · IPv4 | Template | Template | Template | Template | Template |
| DHCP server | Template | Template | Template | No template | No template |
| OSPFv2 · Basic | Template | Template | Template | Template | No template |
| BGP · eBGP / iBGP | Template | Template | Template | Template | No template |
| SSH & Device Hardening | Template | No template | No template | No template | No template |
| Site-to-Site VPN | Template | Template | Template | Template | Template |
| VLAN & 802.1Q Trunking | Template | Template | No template | Template | No template |
| Port security | Template | No template | No template | No template | No template |
| Remote Access / SSL VPN | No template | Template | Template | No template | No template |
| STP Edge Protection · BPDU Guard | Template | No template | No template | No template | No template |
| SPAN / RSPAN · Traffic Mirroring | Template | No template | No template | No template | No template |
| GLBP · Gateway Load Balancing | Template | No template | No template | No template | No template |
| Multicast · PIM Sparse Mode | Template | No template | No template | No template | No template |
| Network Automation · NETCONF / RESTCONF | Template | No template | No template | No template | No template |
| Advanced VPN · DMVPN Phase 3 | Template | No template | No template | No template | No template |
| STP / RSTP / MST | Template | Template | No template | Template | No template |
| EtherChannel · LACP / PAgP | Template | Template | No template | Template | No template |
| DHCP Snooping | Template | Template | No template | No template | No template |
| Private VLANs | Template | No template | No template | No template | No template |
| Static Routing · IPv6 | Template | Template | Template | Template | Template |
| OSPFv3 · IPv6 | Template | Template | Template | Template | No template |
| OSPFv2 · Multi-area, authentication & summaries | Template | No template | No template | No template | No template |
| EIGRP · Basic / Advanced | Template | No template | No template | No template | No template |
| Route Redistribution | Template | No template | No template | Template | No template |
| Policy-Based Routing (PBR) | Template | No template | Template | No template | No template |
| AAA · RADIUS / TACACS+ | Template | Template | No template | No template | No template |
| Zone-Based Firewall (ZBFW) | Template | No template | No template | No template | No template |
| HSRP / VRRP | Template | Template | Template | Template | No template |
| DHCP Relay | Template | Template | Template | Template | Template |
| NTP & Syslog | Template | Template | Template | Template | Template |
| SNMPv3 Monitoring | Template | Template | Template | Template | No template |
| QoS · Classification & Marking | Template | Template | No template | Template | No template |

Protocol-specific restrictions still apply (for example Cisco VTI, RouterOS WireGuard, PAgP and GLBP). OSPFv3 adjacency templates do not include advanced authentication/summarization.

## New advanced template assumptions

- BPDU Guard: dedicated host-facing access port only; never a switch uplink.
- SPAN/RSPAN: Catalyst IOS/XE-style sessions (1–66, platform-dependent capacity). RSPAN configures the source switch only and requires the same remote-span VLAN carried to a separately configured destination. Analyzer ports must be dedicated.
- GLBP: existing supported routed LAN interface and same-L2 peer. HSRP/VRRP and GLBP cannot be selected together.
- PIM sparse mode: existing RP and unicast reachability; static RP mapping limited to a 239.0.0.0/8 subprefix. Configure all intended routed hops separately.
- NETCONF/RESTCONF: existing authorized AAA users, management filtering and approved HTTPS certificate. No new credentials or wildcard access ACLs are generated. APIs are not enabled on real devices by this application.
- DMVPN Phase 3: overlay-only hub or spoke with an existing audited IPsec profile and IKE peer authentication. Dedicated Tunnel interface, NHRP authentication, MTU/MSS and IPsec protection are included. Underlay reachability, overlay routing and peer PKI are prerequisites. No wildcard PSKs or unencrypted fallback. Cannot mix this starter with NAT/ZBFW/other VPN templates without designing the policies separately.

## Troubleshooting

Five scenarios × five vendors: IPsec tunnel down, BGP stuck, OSPF adjacency, VLAN trunk loss, interface errors/CPU. Each shows three investigation steps, diagnostic CLI, likely causes, remediation guidance and platform-specific illustrative commands. PAN-OS repairs that depend on existing peer groups/profiles are described rather than invented. Cisco, RouterOS, Junos and FortiOS examples use clearly named lab objects. Junos examples stop at commit check; no commit/reset/clear is automated. Optional IKE debug includes stop commands. Commands are never executed or sent to an appliance.

## Validation

350/350 engine checks passed in Node and Chromium; 98/98 browser UI checks passed. React TSX syntax transpilation is a separate check, not a Next.js production build or complete type check. No appliance CLI was executed.

## Primary references

- [Cisco IOS XE DMVPN](https://www.cisco.com/c/en/us/td/docs/routers/ios-xe/security-vpn/security-vpn/m_sec-conn-dmvpn-dmvpn-0.html)
- [Catalyst SPAN/RSPAN](https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9300/software/release/17-14/configuration_guide/nmgmt/b_1714_nmgmt_9300_cg/configuring_span_and_rspan.html)
- [Cisco IOS XE RESTCONF](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/prog/configuration/1718/b-1718-programmability-cg/restconf_protocol.html)
- [RouterOS BGP CLI](https://manual.mikrotik.com/docs/cli-reference/routing/bgp/connection/)
