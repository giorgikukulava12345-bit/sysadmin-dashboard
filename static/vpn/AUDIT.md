# Configuration generator review — 24 October 2026

The application is Flask/Jinja with browser ES modules. React adapters share the same generators. This review preserves that architecture and the always-visible addressing editor.

## Findings and resolutions

| Priority | Verified issue | Resolution |
| --- | --- | --- |
| High | Public TCP API accepted internal, loopback and link-local destinations, including metadata-service addresses. | Resolve once, require a global unicast IPv4 destination, and connect to that exact validated address. Reject booleans, fractional and invalid ports. |
| High | Unauthenticated upload and large bandwidth-test endpoints remained after their UI was removed. | Remove those unused endpoints; retain read-only repository listing/downloads. Limit incoming request bodies to 64 KiB. Disable Flask development debug mode. |
| High | Cisco VTI ignored the selected Phase 2 PFS group. | Emit the selected PFS group in the IPsec profile. |
| High | DHCP reservations could become stale after editing the topology. | Cisco exclusions incorporate the current management and static host IPs at submission; MikroTik/FortiGate reject pools containing those addresses. The second-VLAN pool remains independent. |
| Medium | Junos/PAN-OS VPN interface units and VPN zones were fixed values. | Add validated security-zone and logical-unit inputs; Junos also accepts the actual WAN zone. Reject zone collisions and malformed units. |
| Medium | PAN-OS IPv4 and IPv6 static routes always targeted `default` and a fixed route name. | Add validated virtual-router and route-name inputs and use them consistently throughout CLI output. |
| Medium | Static NAT could target the switch management IP or consume router/ISP addresses. | Validate current topology reservations; exclude WAN endpoints from dynamic public pools and reject local self-referential static-route next hops. |
| Medium | MikroTik static inbound NAT matched every ingress interface. | Scope destination NAT to the submitted WAN interface. Firewall policy and provider routing remain separate explicit prerequisites. |
| Medium | Network discovery substituted an invented IP, ISP and location on failure. | Show unavailable states and leave the target blank. Never manufacture live telemetry. |
| Medium | Troubleshooting included fixed-address configuration-changing repair examples. | Remove those examples; retain vendor diagnostics, bounded debug, root-cause analysis and remediation guidance. |
| Medium | OpenVPN endpoint and public NAT mappings were prefilled examples. | Require actual external values. Existing editable LAN/WAN lab defaults remain visible and explicitly identified as examples. |
| Medium | A broad Cisco IOS XE 17.x label implied crypto-map compatibility with later releases. | Narrow the crypto-map template target to IOS XE 17.6–17.9 and include a firmware limitation in generated output. Later releases require an appropriate route-based design. |
| Low | Several visible controls had no effect on their vendor output. | Hide RouterOS VLAN-name/STP/RSTP VLAN/bond-trunk/snooping-VLAN controls and Junos process controls where inapplicable. RouterOS VLAN generation now has an actual bridge-name input. Topology-owned port-forward values use the existing binding summary. |
| Low | Hidden six-device terminal DOM was rebuilt on every topology edit. | Add a typed `showDeviceOutputs` mount option; the workbench disables that duplicate DOM while retaining standalone lab outputs. |
| Low | Browser port checks could strip `www.`, accept invalid ports, or remain busy after a synchronous WebSocket error. | Preserve the hostname, validate hostname/IPv4 and port inputs, handle restricted ports and synchronous failures, and restore the button state. |

## Added networking controls

DHCP lease duration is explicit in minutes. IOS renders days/hours/minutes, RouterOS minutes, and FortiOS seconds. FortiOS uses a conservative 5-minute to 10-day range for the targeted template; IOS/RouterOS accept 2 minutes to 30 days. Blank or invalid submitted values are rejected. PAN-OS route contexts and Junos/PAN-OS VPN contexts are explicit form values.

The shared WAN validator rejects 0/8, loopback and multicast/reserved sources, duplicate router WAN addresses, invalid /30 hosts and off-link gateways. Cisco reserved VLANs 1002–1005 are rejected in the topology. Duplicate gateway messages were removed from the lab validator.

## Audit coverage and verification

- Reviewed the vendor IPsec builders for Cisco IOS/ASA, RouterOS, FortiOS, Junos SRX and PAN-OS, plus WireGuard/VTI, shared interfaces, feature catalog, enterprise/security templates, composition, topology, workbench and Flask routes.
- Existing engine matrix: **383/383** checks pass. This includes supported/unsupported vendor-protocol combinations, routing/NAT/security grammar assertions and atomic failure checks.
- New audit suite: **516 checks**, including **90 supported feature/vendor fixtures** and **344 active-field CLI-injection mutations**. Custom-endpoint VPN sweeps verify submitted addresses and secrets are propagated rather than substituted.
- Browser lifecycle and submission workflows: **148/148** checks pass, including explicit external NAT/OpenVPN inputs, configurable lease duration and PAN-OS route context.
- Focused second-VLAN tests and the English-only source audit pass.
- Five Python standard-library tests cover API validation helpers and removed routes; backend Python syntax is checked. These are not a full Flask integration run.

Commands: `node tests/engine.test.js`, `node tests/audit.test.js`, `node tests/second-vlan.test.js`, `node tests/english-only.test.js`; from the repository root, `python -m unittest discover -s tests -p test_network_validation.py`. Browser harness: `/tests/index.html` in a local static preview.

## Limits and deployment review

This is a configuration generator, not a device management system. No appliance CLI interpreter, EVE-NG image, complete Next.js build or hardware interoperability suite was available in this workspace. Text-generation tests do not establish that every firmware/model accepts every command.

`NOC-*` names are deliberate reserved configuration-object names, not hidden address placeholders. Defaults are editable lab values. Multiple snippets are not an idempotent merge engine: review existing object names, policy order, provider-routed public mappings, VRFs/virtual routers, interface capability, certificates, routing reachability and management-plane policy. BGP starter filters intentionally reject routes until approved policy is supplied. Unsupported vendor/features continue to fail explicitly rather than emitting another vendor's syntax. MTU, timers and protocol defaults remain documented template defaults where the UI offers no override.

## Vendor references used

- [Cisco IOS DHCP lease command](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/ipaddr/command/ipaddr-cr-book/ipaddr-l1.html)
- [Cisco IOS XE IPsec and crypto-map release limitations](https://www.cisco.com/c/en/us/td/docs/routers/ios-xe/security-vpn/security-vpn/m_sec-cfg-vpn-ipsec-0.html)
- [MikroTik destination NAT interface scoping](https://help.mikrotik.com/docs/spaces/RKB/pages/154042388/Port%2Bforwarding)
- [FortiOS DHCP lease-time reference](https://docs.fortinet.com/document/fortigate/7.6.1/cli-reference/121865377/config-system-dhcp-server)
- [PAN-OS static routes and virtual-router context](https://docs.paloaltonetworks.com/ngfw/networking/static-routes/configure-a-static-route)
- [Junos route-based VPN interfaces and security zones](https://www.juniper.net/documentation/us/en/software/junos/vpn-ipsec/topics/topic-map/security-route-based-ipsec-vpns.html)
