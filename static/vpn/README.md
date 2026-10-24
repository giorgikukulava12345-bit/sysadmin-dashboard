# Cisco Workbench: Submit fix and enterprise templates

The deployed repository is Flask/Jinja plus browser-local ES modules. This update preserves that application and supplies a separate React/Next.js component package sharing the same generators.

## Confirmed Submit regression and fix

An unchanged VPN form broadcast caused onVpnState → renderOutput to discard a valid submitted configuration, even while configuring unrelated NAT. tests/submit-regression.html reproduces the failure with the previous workbench and passes with this version. The workbench now captures a per-device input snapshot, preserves a submitted result when that snapshot is unchanged, and invalidates it for real edits. Unexpected generation exceptions become visible errors rather than leaving the Draft placeholder. Enter in single-line inputs also submits; multiline fields retain Enter. Submit focuses and scrolls to output, with a line-count / validation status. Clear resets output/copy state without deleting the draft. No configuration is executed or sent to a router.

## Added Cisco IOS / IOS XE features

- Port Forwarding: TCP/UDP external port → internal LAN host/port, topology-bound WAN/public IP and interfaces, source-prefix restriction, named inbound ACL permit. WAN ACL matches the pre-NAT public address and external port. By default the ACL is not attached, so an existing WAN policy is not replaced. Explicit dedicated attachment adds a deny-all remainder and is limited to standalone generation; it is not a full stateful firewall. PAT can be combined when the permit is merged with a reviewed existing ACL. The internal server needs a return route via the NAT router; application/host firewalls and upstream routing must permit it.
- Plain GRE: dedicated Tunnel interface, source/destination, transit addressing, MTU/MSS and remote route. Unencrypted; use the existing GRE-over-IPsec workflow when encryption is needed.
- VXLAN: platform-specific IOS XE router static VXLAN + EFP/bridge-domain template. Dedicated VTEP loopback, static ingress replication, VLAN tag/EFP and bridge-domain/VNI mapping. Not NX-OS or Catalyst EVPN syntax; verify image and hardware support. Underlay VTEP /32 reachability, UDP 4789 and adequate MTU must exist. EFP ports cannot reuse the routed topology LAN/WAN.
- BFD: interface timers, optional existing OSPF interface or single-hop BGP neighbor integration. Timers alone do not start a session; both peers/client registration and hardware timer support are prerequisites.
- IP SLA: scheduled ICMP echo plus reachability tracking. Existing unused IDs required; does not silently replace default routes.
- IS-IS: private 49-area NET, unique nonzero system ID, L1/L2/L1-2, wide metrics and interface activation. Existing addressing and compatible peer required; no authentication or redistribution implied.
- CoPP: ICMP CPU-traffic MQC policy. Unattached by default; explicit attachment requires merging/reviewing existing control-plane policy. Not a replacement for Catalyst system CPP.
- uRPF: CEF + strict/loose source validation with explicit allow-default. Strict mode requires symmetric routing; allow-default behavior is intentional.

Existing VLAN/trunking, STP/RSTP/MST, EtherChannel LACP/PAgP remain under Switch Configuration. All feature checkboxes remain interactive across the five vendors; these new templates are Cisco-only and unsupported vendor combinations produce a clear error with no partial CLI.

## UI

Seven categories across router/switch contexts; responsive 1 / 2 / 3-column feature-card grid (mobile / md / lg), slate borders, cyan selection, native checkbox checkmarks, focus-visible rings and tooltip/helper notes. Terminal retains safe syntax coloring, Copy success feedback and a new Clear action. The unified four-column command bar and troubleshooting playbooks are retained.

## Capability matrix

| Feature | Cisco | MikroTik | FortiGate | Juniper | Palo Alto |
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
| Port Forwarding · NAT Port Redirection | Template | No template | No template | No template | No template |
| GRE Tunnels · Generic Routing Encapsulation | Template | No template | No template | No template | No template |
| VXLAN · IOS XE EFP / Bridge Domain | Template | No template | No template | No template | No template |
| BFD · Bidirectional Forwarding Detection | Template | No template | No template | No template | No template |
| IP SLA · ICMP Echo & Reachability Tracking | Template | No template | No template | No template | No template |
| IS-IS · Integrated IPv4 Routing | Template | No template | No template | No template | No template |
| CoPP · Control Plane Policing | Template | No template | No template | No template | No template |
| uRPF · Unicast Reverse Path Forwarding | Template | No template | No template | No template | No template |
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

## Validation

372/372 Node and Chromium generator tests; 133/133 Chromium UI checks. The dedicated Submit regression was observed failing against the previous workbench and passing against the fix. React source is syntax-transpiled separately, not a production Next.js build or complete typecheck. No appliance CLI has been executed.

## Primary references

- [Cisco NAT configuration](https://www.cisco.com/c/en/us/support/docs/ip/network-address-translation-nat/13772-12.html)
- [Cisco NAT order of operations](https://www.cisco.com/c/en/us/support/docs/ip/network-address-translation-nat/6209-5.html)
- [IOS XE router VXLAN / EFP](https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/application-services/b-application-services/vxlan.html)
- [BFD configuration](https://www.cisco.com/c/en/us/td/docs/routers/ios-xe/ip-routing/b-ip-routing/m_irb-bi-fwd-det-0.html)
- [IP SLA ICMP echo](https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/ip-addressing/b-ip-addressing/m_sla_icmp_echo.html)
- [IS-IS IOS XE model](https://netascode.cisco.com/docs/data_models/iosxe/device/isis/)
- [IOS XE CoPP](https://www.cisco.com/c/en/us/td/docs/routers/ios-xe/quality-of-service/quality-of-service/m_qos-plcshp-ctrl-pln-plc-0.html)
- [uRPF command reference](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/security/d1/sec-d1-cr-book/sec-cr-i3.html)

## Initial local-site defaults

LAN 192.168.1.0/24; router LAN 192.168.1.1; switch management 192.168.1.254; host 192.168.1.10; DNS 8.8.8.8. The remote site retains a distinct subnet for valid site-to-site configurations. The VPN model and topology share the new local subnet. Cisco DHCP excludes the switch address; dynamic pools end before it. Local static NAT and port-forward forms take their server defaults from the host node.

## Optional second VLAN (Cisco IOS)

Open Configure second VLAN / Switch addressing, enable Second VLAN mode, and edit VLAN ID, canonical CIDR, router gateway, separate switch management SVI and access port. Defaults: VLAN20, 192.168.20.0/24, gateway192.168.20.1, SVI192.168.20.254, FastEthernet0/2. Primary VLAN10 remains native on both ends; VLAN20 is tagged. The router physical LAN port becomes a trunk with two gateway subinterfaces. Both networks are directly connected. The switch uses two management SVIs, not duplicate gateway addresses. This template assumes an L2 switch; it does not disable existing routing automatically. Use a dot1q-capable IOS router and switch.

Submit Router and Switch separately; base bindings are automatic in this mode. PAT and DHCP selections include both subnets. Feature routing policies remain explicitly configured; VPN/firewall overlay combinations are rejected pending a complete two-subnet policy design. Unsupported vendors, overlapping subnets, duplicate VLANs/IPs and conflicting ports fail atomically. The default single-VLAN workflow is unchanged while disabled.

Tests: node tests/engine.test.js; node tests/second-vlan.test.js; browser tests/index.html.

## Obsidian UI and strict /30 WAN

WAN prefixes are fixed to30. SideA uses203.0.113.10 with gateway203.0.113.9 (network203.0.113.8/30); SideB uses198.51.100.22 with gateway198.51.100.21 (network198.51.100.20/30). Either host orientation is valid. Router and ISP must be distinct usable hosts; network/broadcast, mismatched prefixes and off-link gateways block all CLI. Static WAN deployment presets follow the same rule. DHCP-client presets receive addressing from the ISP at runtime.

The obsidian theme includes frosted gradient cards, cyan active states, violet ambient lighting, Inter UI typography, JetBrains Mono technical fields, responsive grids, hover lifts, terminal-entry fade and emerald animated clipboard success. All animations honor prefers-reduced-motion. CSS is included in the workbench style for React adapters and loaded globally by the Flask dashboard template.

Validation:383 engine checks,142 browser UI checks and focused second-VLAN regression suite. Tested as generated text and browser behavior; no hardware/device configuration execution or complete Next.js build is claimed.
