# Internet gateway and Dual ISP

The existing application uses Flask/Jinja and browser ES modules. `internet.js` contains pure generators; the feature registry, composer and workbench connect them to the existing dashboard. No framework migration or device connection is required.

## Use

1. Choose the router vendor and edit the shared topology addresses and physical ports.
2. Click **Quick Setup: Standard Office / Internet Gateway** near the top of Router Configuration. This replaces the selected site's router/switch feature choices with an Internet Gateway bundle and base bindings, then generates separate router and switch terminals. Existing topology addresses and an enabled Dual ISP configuration are preserved. Unsupported switch vendors are replaced with Cisco; Cisco, RouterOS and Junos switch templates remain available.
3. For redundancy, check **Dual ISP / WAN Failover**, enter a dedicated WAN2 interface, usable /30 host, the other /30 host as ISP gateway, and a backup preference (default 5). Submit again. The topology path also shows WAN2.
4. Copy the router and switch scripts separately. The preset includes default routing, interface PAT, stateful outbound policy, and switch management addressing/gateway. Static host addressing remains in the topology; DHCP is an additional selectable feature.

The Internet Gateway bundle owns default routing, NAT and firewall rules. Individual NAT/ACL/ZBFW and VPN templates cannot be combined blindly with it. Both WANs receive translation/security policy. Cisco uses egress-interface route maps so PAT follows the chosen uplink. Existing standalone Cisco/RouterOS PAT also gains WAN2 translation when Dual ISP is checked. Two-VLAN office routing is supported by the existing Cisco router/switch template.

## Route selection and limits

| Platform | Primary / backup |
| --- | --- |
| Cisco IOS XE | Fully specified interface + gateway routes, distances 1 / 5 |
| Junos SRX | Static next hop preference 1, qualified next hop preference 5 |
| RouterOS v7 | Gateway scoped to WAN interface, distances 1 / 5, check-gateway=ping |
| FortiOS 7.4 | Interface-bound static routes, distances 1 / 5; editable unused route/policy IDs |
| PAN-OS 11 classic virtual router | Interface-bound routes, metrics 1 / 5; editable virtual router and security zones |

Backup preferences are configurable. Floating routes react to local link loss; they do **not** prove end-to-end Internet reachability. RouterOS additionally checks the directly connected ISP gateway, which must answer ICMP. Failures beyond a responsive gateway require a separately designed IP SLA / RPM / Performance SLA / path-monitor configuration. Existing NAT sessions may reset on failover or failback as the public address changes.

Templates target IPv4 office/lab deployment and generate commands only. Firmware/hardware capabilities, existing routes/zone membership, object IDs, rule order, management access, IPv6 policy and licensed security profiles require device-specific review. Scripts append/merge named objects; they do not purge existing configurations. Junos/PAN-OS candidate configuration requires a separate validation/commit. Configuration tests do not replace a hardware or EVE-NG failover test.

## Validation

WAN2 must use a distinct physical interface and a separate non-overlapping /30, with router and gateway occupying its two distinct usable host addresses. The generator rejects command injection, invalid preferences, duplicate FortiOS route IDs, inconsistent PAN-OS virtual routers, overlapping default-route ownership, unsupported template combinations and address collisions before emitting CLI.

Run `node tests/internet.test.js`, `node tests/engine.test.js`, `node tests/audit.test.js`, `node tests/second-vlan.test.js`, and `node tests/english-only.test.js`. Open `tests/index.html` through an HTTP server for UI lifecycle checks, including one-click setup for all five vendors.

## Vendor references

- [Cisco multi-ISP NAT route maps](https://www.cisco.com/c/en/us/support/docs/ip/network-address-translation-nat/100658-ios-nat-load-balancing-2isp.html)
- [Cisco floating routes](https://www.cisco.com/c/en/us/support/docs/dial-access/floating-static-route/118263-technote-nexthop-00.html)
- [Junos qualified next-hop preferences](https://www.juniper.net/documentation/us/en/software/junos/static-routing/topics/topic-map/static-route-prefer-qualified-next-hop.html)
- [RouterOS gateway checking](https://manual.mikrotik.com/docs/user-guides/routing-and-networking-protocols/routing-decision/)
- [Fortinet inactive route behavior](https://community.fortinet.com/fortigate-3/technical-tip-how-to-identify-inactive-routes-in-the-routing-table-99133)
- [PAN-OS static route metrics](https://knowledgebase.paloaltonetworks.com/KCSArticleDetail?id=kA10g000000Clz2CAC&lang=en_US)
- [PAN-OS NAT CLI](https://knowledgebase.paloaltonetworks.com/KCSArticleDetail?id=kA10g000000ClEqCAK&lang=en_US)

## Cisco Standard Office Quick Setup

The Quick Setup button uses a complete, ordered IOS configuration: global services and timezone/NTP, USERS and IT DHCP pools, local AAA/SSH, interfaces, extended NAT ACLs and interface PAT, stateful firewall policy, and the ISP default route. The normal standalone Internet Gateway feature retains its existing behavior.

SVI mode creates gateway interfaces Vlan10 and Vlan20 and a trunk on the selected physical LAN switch port. It requires a router with integrated Layer 2 switch ports and an IOS image supporting the generated NAT, ZBFW and type 9 scrypt commands. Choose router-on-a-stick mode for a routed Ethernet LAN port; that mode uses tagged dot1Q subinterfaces instead. The companion Cisco Layer 2 switch configuration remains a separate device output.

All addresses, VLAN IDs and physical interfaces use the current topology. Pool names, DNS, the reserved address count, extra management source CIDRs/hosts, and timezone are editable in the Internet Gateway form. By default, DHCP excludes the first 49 usable addresses of each LAN plus all configured gateway, switch and static-host assignments. Generation blocks exhausted scopes and invalid inputs without emitting partial commands.

Enter administrator and enable secrets in the existing SSH settings; the preset never creates default credentials. IOS hashes these inputs with scrypt when applied. The preview masks them; Copy and Download include the entered values. SSH_NEW allows the local LANs and any explicitly supplied additional sources, then denies other SSH. Both VTY ranges 0–4 and 5–15 use local AAA and SSH only. The NTP server is editable in NTP settings, defaults to 129.250.35.251, and does not configure a Syslog collector.

The preset owns the complete Cisco device configuration. Generate additional protocol/AAA/VPN features separately, and design egress-aware translation before using Dual ISP. Existing component toggles still remove individual routing, NAT, firewall, interface addressing, DHCP or DNS components.

Validation: `node tests/run-all.js` includes `standard-office.test.js`. `tests/index.html` also checks preset activation, SVI/router-on-a-stick switching, SSH source input and timezone changes in the browser. No physical IOS device validation is implied.

