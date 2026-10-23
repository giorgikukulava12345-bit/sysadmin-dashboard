# VPN Configurator

Integrated into the existing Flask/Tailwind dashboard in `sysadmin-dashboard`.
The existing backend and tools are preserved. The main template includes
`templates/vpn/configurator.html`; ES modules are served from `static/vpn/`.

The generator supports IKEv2 on IOS XE, ASA, RouterOS, FortiOS and PAN-OS;
IKEv1 on IOS XE, RouterOS, FortiOS and PAN-OS; GRE over IKEv2 IPsec on IOS XE,
RouterOS and FortiOS; and WireGuard on RouterOS 7. Unsupported combinations
block output with an explanation. ASA IKEv1 is blocked for this SHA-256 suite.

The form provides two-sided endpoint/network/key settings, advanced IPsec
parameters, interface/routing context, secure random PSKs, live validation,
two terminal previews, copy actions and a vendor-linked knowledge base.
Secrets are kept only in page memory and are concealed by default.

115 JavaScript checks passed in Chromium, including all 100 ordered
vendor/protocol choices (unsupported choices must refuse output). Run via
`npm test` with Node 22, or serve the repository root and open
`/tests/index.html`. Flask tests are included and can be run with
`python -m unittest discover -s tests`; they were not run in the authoring
environment because Python was unavailable.

Templates assume static public IPv4 addresses assigned locally, preconfigured
WAN/LAN interfaces, one non-overlapping LAN per site and reserved NOC-* names.
Review existing crypto maps, NAT exemptions, policy order and routes. IOS NAT
exemption must be merged with the device's existing NAT configuration.
PAN-OS uses the classic virtual-router hierarchy and requires manual candidate
validation/commit. WireGuard key-pair correspondence must be verified on the
routers. These templates have not been executed on network appliances.
