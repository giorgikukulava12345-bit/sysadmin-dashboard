# Free reviewed Packet Tracer lab workspace

`packet-lab-ui.js` mounts a separate collapsed workspace before the lab. It does not restore the removed current-configuration analyzer or switch/host tabs in the existing router workbench.

Workflow: upload/paste an image, run local enhanced OCR, enter the full assignment, suggest device names, then explicitly enter each device's model, ports, addresses and required service parameters. Confirm review before generating. Every device gets separate plain-text configuration/instructions, copy/download and EXEC verification commands. Changing an input removes old results. Clear removes all in-tab lab data. Nothing is saved to storage or posted to a server.

OCR is Tesseract.js 7 with the existing pinned multi-pass recognition pipeline. Engine/language files download from jsDelivr; images remain in the tab. English OCR is used. This is **not a vision language model**: arbitrary prose, wire crossings, missing labels, Georgian OCR, and assignment intent are not automatically solved. Device-name suggestions never assign ports or IPs. Use original-resolution screenshots and manually verify every digit. No promise of error-free recognition or universal Packet Tracer CLI coverage is made.

Supported model port maps: 2911, 1941, 2811; Layer 2 2960; Layer 3 3560; PC/host manual Desktop setup. Serial ports require explicit installed-module confirmation. Routed IPv4, VLAN SVI and tagged subinterface addressing are supported; service forms reuse existing validators for switching, OSPF/EIGRP/BGP, IPv6 static/OSPFv3, ACL/NAT/DHCP, FHRP, SSH, NTP/SNMP and other listed templates. Added local forms cover IPv6 addressing, RIPv2, native VLAN trunks, console local login, syslog and serial HDLC/PPP/Frame Relay.

Reciprocal IPsec router entries use the existing validated Packet Tracer IKEv1 lab suite. Both peers and PSKs must match. IKEv2 is not offered for Packet Tracer. The combined NAT/firewall + IPsec case is deliberately blocked here and remains in Quick Setup + VPN, which owns NAT exemptions. No encryption downgrade is inferred from an image.

One malformed device blocks the entire lab export. Duplicate IPv4 addresses/hostnames, model port mismatches, missing interface references and incomplete VPN peers are blocked. The user must verify links, VLAN continuity, protocol adjacencies, existing configuration, image capabilities and task coverage. This workspace targets a clean lab; it does not merge running configurations or apply/save anything to devices.

Tests: `node tests/packet-lab.test.js`; browser fixture `tests/packet-lab.html`. Verification performed with local upload → real OCR → three-device review → generation → copy → input invalidation. Synthetic screenshot labels included an ambiguous switch caption, demonstrating why confirmation is required.
