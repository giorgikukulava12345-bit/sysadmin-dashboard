# Interactive WAN topology

The browser-local configurator now renders Side A → ISP/Public Internet → Side B,
with responsive node cards, physical WAN links, public IP path, private LAN
addresses, protocol labels and input readiness indicators. These indicators
describe configuration readiness, not measured device or tunnel health.

Click a device card to focus its interface editor. All editors share the same
state as the topology and both CLI outputs; no separate topology settings are
stored. Values are rendered with textContent rather than interpolated HTML.

Enable **Include physical interface IP assignments in CLI** to prepend address
commands for IOS XE, ASA, RouterOS, FortiOS and PAN-OS. It defaults off to preserve
the existing assumption that WAN/LAN interfaces are already configured. Once
enabled, valid edits immediately regenerate both scripts. ASA exposes physical
ports separately from its WAN/LAN nameifs. WAN prefixes accept 1–31; LAN addresses
must be usable hosts within the site's local subnet. Existing names, WAN/LAN
zone membership, default routes, VLAN configuration and ISP reachability must be
reviewed on the target devices. PAN-OS requires physical ethernet interface names
for this binding template. Commands are not applied to devices automatically.

`topology.js` owns diagram presentation. `interfaces.js` owns address validation
and platform-specific interface commands. `engine.js` combines interface and VPN
configuration; `ui.js` owns shared form state. No React migration was introduced
because this repository uses Flask/Jinja and native ES modules.

168 engine checks and 32 UI/lifecycle checks passed in Chromium. Browser checks verified editing public and
private addresses, WAN interface changes, opposite-peer regeneration, topology
updates and click-to-edit focus. Python integration tests were extended to cover
the new module URLs but were not run in the authoring environment. The generated
interface commands have not been executed on appliances.

# Configuration workbench expansion
The Configuration type selector now includes MikroTik bootstrap, Cisco router/switch VLAN setup, dynamic OSPF/BGP, ACL, NAT/PAT, DHCP, port security, SSH hardening, static routes, VLAN ports and VLSM. The Syslog/SNMP widget is explicitly simulated and includes pause/resume, clear and a 150-event buffer. catalog.js contains pure generator schemas and validators; vlsm.js performs largest-first allocation; workbench.js mounts the shared UI; ui.js exports mountVpn for React adapters. Cisco VTI is an IOS-to-IOS IKEv1 mode with Tunnel0, MTU/MSS, static routing and rebuilt ACL NAT. SHA256/DH14 is the default; legacy DH2/SHA1 requires an explicit checkbox. NAT wildcards and subnet masks are computed from CIDR. No PFS is set by this profile. Review existing NAT rules before using the generated NAT binding. RouterOS BGP supports separate templates for 7.12-7.19 and 7.20+; both Cisco and RouterOS BGP start with reject-all route policies. Bootstrap assumes an empty IPv4 router configuration. The exported mount cleanup stops monitor timers and unregisters root events.