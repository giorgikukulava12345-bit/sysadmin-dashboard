# CCNA / CCNP Enterprise Configuration Workbench

The live application uses Flask/Jinja and browser-local ES modules. React/Next.js client components are supplied separately and reuse the same modules. The dashboard layout, topology and secrets-in-memory behavior are retained.

## Workflow

Choose a vendor, site and Router/Switch context. Feature checkboxes are grouped under Switching & Layer 2, Routing (IGP/EGP), Security/NAT/VPN, and High Availability/Infrastructure. Every checkbox is interactive, including unsupported vendor choices. Only checked features show parameters. Click **Submit / Generate Configuration** to validate and generate the selected physical device's script. Changing any input, context or selection invalidates the previous result and disables Copy Config until resubmitted. Secret reveal does not regenerate or invalidate an otherwise valid result.

All selected features must validate. Unsupported vendor/feature or protocol choices produce an explanation and no partial CLI. Platform-specific terms such as EIGRP, PAgP, HSRP, PVLAN or Cisco ZBFW are not relabeled as another vendor's syntax. The table describes implemented templates, not every capability of each vendor.

## Capability matrix

| Feature | Cisco IOS | MikroTik | FortiGate | Juniper | Palo Alto |
| --- | --- | --- | --- | --- | --- |
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

The site-to-site VPN matrix remains protocol-specific: Cisco VTI is IOS-to-IOS; WireGuard is RouterOS; GRE-over-IPsec is IOS/RouterOS/FortiOS. OpenVPN client and FortiOS 7.4 SSL VPN server now have a separate Remote Access / SSL VPN checkbox. Both require their existing PKI/server/group prerequisites.

## Scope and assumptions

- OSPFv2 has a basic multi-vendor template and a separate Cisco advanced template with multi-area network statements, ABR summaries and HMAC-SHA256. Use one OSPFv2 template at a time. OSPFv3 templates create IPv6 adjacencies; OSPFv3 IPsec/authentication and advanced per-vendor summarization are not implemented.
- Cisco EIGRP supports classic and named mode, variance, interface summary and named-mode HMAC-SHA256. Redistribution allows only an exact approved prefix; IOS sources include Static, Connected, OSPF, EIGRP and BGP, with seed metrics for EIGRP targets. BGP starter policies still reject all routes until approved export/import policies are supplied.
- NAT static/dynamic/interface PAT templates are IOS and RouterOS. Automatic site-to-site VPN NAT exemption composition is limited to PAT. The Cisco VTI template owns its NAT policy.
- LACP templates exist for IOS, RouterOS and Junos; PAgP is Cisco-only. RouterOS creates a bond for subsequent bridge attachment. Junos requires pre-provisioned ae capacity. MST peers must use matching region/revision/mapping. PVLAN template is Cisco isolated-secondary VLAN design and changes VTP to transparent.
- HSRP is Cisco-only; VRRP is IOS/RouterOS/FortiOS/Junos. It requires a second peer on the SAME subnet, not the other routed site in this diagram. Change client gateways to the VIP only after peer configuration is complete.
- DHCP Server and Relay cannot target the same LAN interface in one generated script. IPv6 static routes and relay/NTP/syslog have all-five-vendor templates. IPv6 interface addresses, security policy, zones and next-hop reachability must already exist.
- QoS classifies an IPv4 source and UDP destination port and marks DSCP on a routed ingress interface. It does not shape, queue, guarantee bandwidth or replace a full enterprise QoS design.
- SNMPv3 is read-only authPriv using interoperable SHA/AES128. Junos needs an existing unique engine ID. FortiOS notify-hosts does not restrict query sources; use management-plane filtering and enable interface SNMP access separately. No management access is silently widened by the generator.
- NTP/UDP syslog are lab baselines; restrict management reachability or design secure transport separately. AAA requires a tested existing/fallback administrator. Cisco VTY method has local fallback; RouterOS RADIUS defaults to read-only remote privileges.
- Junos targets SRX for VPN and EX ELS for switching; PAN-OS targets 11.x classic virtual-router hierarchy. Check model, release and licenses. Reserved NOC-* names and existing policy order must be reviewed. No appliance configuration is applied or committed automatically.

## Architecture and validation

- enterprise.js: isolated CCNP schemas, IPv6 validation and vendor renderers.
- features.js: central categorized registry, capability/role mapping and existing feature adapters.
- compose.js: per-device, all-or-nothing composition and cross-feature conflict validation.
- workbench.js / workbench-style.js: categorized selectors, draft/submitted state, forms, prominent Generate and single-device terminal.
- diagram.js / lab.js: shared topology and interface/address editor.
- ui.js / engine.js / vendors/: retained cross-vendor site-to-site VPN implementation.

336 Node/Chromium generator/validation checks and 61 browser UI checks passed. Four React TSX components were syntax-transpiled. A full Next.js build and appliance execution were not performed. Flask integration tests are provided; the backend was not changed.

## Reference documentation

- [Cisco OSPFv2 HMAC-SHA](https://www.cisco.com/c/en/us/td/docs/routers/ios-xe/ip-routing/b-ip-routing/m_iro-ospfv2-crypto-authen.html)
- [Cisco EIGRP HMAC-SHA256](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/iproute_eigrp/configuration/15-sy/ire-15-sy-book/ire-sha-256.pdf)
- [RouterOS spanning tree / MST](https://help.mikrotik.com/docs/spaces/ROS/pages/21725254/Spanning%2BTree%2BProtocol)
- [RouterOS VRRP](https://help.mikrotik.com/docs/spaces/ROS/pages/81362945/VRRP)
- [Junos SNMPv3](https://www.juniper.net/documentation/us/en/software/junos/network-mgmt/topics/topic-map/configure-snmpv3.html)
- [FortiOS SNMPv3](https://docs.fortinet.com/document/fortigate/7.4.0/administration-guide/457149/snmp-v3-users)
- [PAN-OS DHCP relay](https://docs.paloaltonetworks.com/ngfw/networking/dhcp/configure-an-interface-as-a-dhcp-relay-agent)
