# Vendor-first Network Configuration Workbench

The deployed application is Flask/Jinja + Tailwind CDN, not a Next.js repository. The same browser-local modules also power the separately supplied React client components.

## Flow

Choose a vendor and site/device. Router and Switch tabs have separate feature checkboxes; only enabled features create parameter forms. No features are preselected. Interface/management bindings are an explicit output option. Computer nodes generate Linux iproute2 commands.

The topology is a compact Computer ↔ Switch ↔ Router ↔ ISP ↔ Router ↔ Switch ↔ Computer diagram with physical ports, LAN/WAN addresses, VLAN IDs and gateway labels. Detailed address editing is collapsed by default. Device state is shared with bound NAT/DHCP parameters and two-sided VPN inputs. It models configuration, not packet forwarding or live status.

## Modules

- `platforms.js`: vendor and physical port registry.
- `features.js`: capability descriptors, field schemas, vendor feature generators and OpenVPN/SSL VPN templates.
- `compose.js`: pure per-device composition, validation, NAT/IPsec exemptions and conflicting-feature checks.
- `workbench.js`: progressive-disclosure device/feature UI and a single terminal output for the selected device.
- `diagram.js`: interactive compact topology.
- `lab.js`: shared address model, validation and collapsed interface editor.
- `planner-ui.js` / `vlsm.js`: optional VLSM planning utility.
- `ui.js` / `engine.js` / `vendors/`: shared site-to-site VPN form and existing validated generator paths.

Scripts retain their own configuration-mode boundaries. Commands for separate physical devices are never concatenated into one device output. Router-on-a-stick is an exclusive preset; select the linked Switch context to copy its separate script. Empty-router bootstrap is also exclusive. Presets have their own multi-VLAN/DHCP parameters; the compact overview models one untagged LAN per site.

## Template capabilities

| Feature | Cisco IOS | RouterOS v7 | FortiOS 7.4 | Junos | PAN-OS 11.x classic |
| --- | --- | --- | --- | --- | --- |
| Static routes | Yes | Yes | Yes | Yes | Yes |
| NAT/PAT | Yes | Yes | No template | No template | No template |
| ACL / SSH hardening | Yes | No template | No template | No template | No template |
| DHCP server | Yes | Yes | Yes | No template | No template |
| OSPF / BGP | Yes | Yes | Yes | Yes | No template |
| VLAN / Access / Trunk | Yes | Yes | No L2 template | EX ELS | No L2 template |
| Access-port Port Security | Yes | No template | No template | No template | No template |

Dimmed controls indicate missing templates, not necessarily missing vendor functionality. BGP templates start with reject-all route policies. Junos routing is in the default routing instance. FortiOS OSPF uses the process input as the first reserved network-entry ID. The Junos switch template targets EX ELS, while Junos VPN targets SRX.

VPN selector includes IPsec IKEv1/IKEv2, Cisco VTI, GRE over IPsec, WireGuard, OpenVPN and SSL VPN. Existing restrictions remain explicit: Cisco VTI is IOS-to-IOS; WireGuard is RouterOS; GRE is IOS/RouterOS/FortiOS. OpenVPN is a RouterOS 7.12+ TCP client to an existing server, with trusted CA/client certificate and server-certificate validation. SSL VPN is a FortiOS 7.4 remote-access server template for supported hardware/releases; it requires an existing signed certificate and authenticated user group. These are distinct remote-access/client workflows, not interchangeable site-to-site protocols. Review TLS/cipher compatibility, existing SSL settings, policy IDs, management ports and MFA before applying.

Secrets remain in page memory, concealed by default. Global Clear all secrets also clears forms for inactive devices; copied clipboard content is not erased. Scripts have not been executed on network appliances.

## Reference documentation

- [RouterOS OpenVPN](https://help.mikrotik.com/docs/spaces/ROS/pages/2031655/OpenVPN)
- [FortiOS 7.4 SSL VPN](https://docs2.fortinet.com/document/fortigate/7.4.0/administration-guide/766455/dual-stack-ipv4-and-ipv6-support-for-ssl-vpn)
- [FortiOS route maps](https://docs.fortinet.com/document/fortigate/7.4.4/administration-guide/535228/route-maps)
- [FortiOS OSPF](https://docs.fortinet.com/document/fortigate/7.4.5/administration-guide/358640/basic-ospf-example)
- [Junos static routing and OSPF/BGP](https://www.juniper.net/documentation/us/en/software/junos/static-routing/topics/topic-map/static-route-prefer-qualified-next-hop.html)

Tests: serve `/tests/index.html` for engine and browser UI checks. React TSX transpilation is a syntax check; a full Next.js build is not applicable to the deployed Flask app. Flask integration tests are provided separately.
