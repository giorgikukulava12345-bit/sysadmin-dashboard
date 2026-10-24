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
