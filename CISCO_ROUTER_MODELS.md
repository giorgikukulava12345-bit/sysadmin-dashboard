# Cisco router catalog

The router model picker follows Device vendor and is stored independently for Side A and Side B. It is available only for Cisco routers. The topology editor exposes the same model selection. Switch and host interface suggestions remain independent.

Machine-readable catalog: [static/vpn/cisco-routers.json](static/vpn/cisco-routers.json). Each record contains exactly model, series, form_factor, wan_ports, lan_ports, expansion_slots, console_usb and features. Runtime data and JSON consistency are checked by tests/router-models.test.js.

The catalog uses exact product identifiers: C1101-4P and C1111-4P cover the requested ISR 1100 four-port options; “1100-4G” does not identify a unique SKU. C8200-1N4T is represented by C8200-1N-4T. The requested C8300-2N2S-4T example is represented by C8300-2N2S-4T2X, including its two 10-Gbps interfaces.

Onboard ports only are suggested. Combo RJ-45/SFP connectors share one logical interface. Optional modules are not assumed installed; select Custom / other model for module-specific interface names. Routed ports on ISR 4000 and Catalyst platforms can serve WAN or LAN, with the currently selected opposite port excluded. C921/C1101/C1111 LAN switchports require VLAN interfaces for IP addressing; composed router CLI creates their physical VLAN binding and places Layer 3 commands on the SVI.

Features describe platform capabilities, subject to software release and licensing. ISR 4321/4331 are legacy platforms retained for existing installations; inclusion is not a claim that every listed platform is currently sold. No appliance execution testing was performed.

## Cisco references

- [ISR 900 data sheet](https://www.cisco.com/c/en/us/products/collateral/routers/900-series-integrated-services-routers-isr/datasheet-c78-741615.html)
- [ISR 1000 ordering guide](https://www.cisco.com/c/en/us/products/collateral/routers/1000-series-integrated-services-routers-isr/1kseries-integrated-services-routers-guide.html)
- [ISR 1000 hardware guide](https://www.cisco.com/c/en/us/td/docs/routers/access/1100/hardware/installation/guide/b-cisco-1100-series-hig/isr1k-hig-overview.html)
- [ISR 4000 data sheet](https://www.cisco.com/c/en/us/products/collateral/routers/4000-series-integrated-services-routers-isr/data_sheet-c78-732542.html)
- [Catalyst 8200/8300 ordering guide](https://www.cisco.com/c/en/us/products/collateral/routers/catalyst-8300-series-edge-platforms/cat-8300-8200-series-edge-plat-og.html)
- [Catalyst 8300 hardware guide](https://www.cisco.com/c/en/us/td/docs/routers/cloud_edge/c8300/hardware_installation/b-catalyst-8300-series-edge-platforms-hig/m-overview.html)
