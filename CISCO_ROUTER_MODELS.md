# Cisco official-source router catalog

The catalog now contains 278 reviewed model records across enterprise, secure G2, industrial, service-provider, Meraki, virtual and cellular products. It is a checked snapshot, not a claim of every historical, regional or future Cisco ordering code. Source directory: https://www.cisco.com/c/en/us/products/routers/product-listing.html. Checked: 2026-10-27.

Every record has the original eight required fields. Provenance, operating system, hardware inventory and CLI support are separate in data/cisco-router-catalog-source.json, keeping the public JSON schema stable. Generate public JSON and the browser module with node scripts/build-router-catalog.mjs. The build rejects duplicate models, missing profiles and non-Cisco/Meraki source URLs.

The model selector supports search by model or series and groups results by series. Model specifications include a direct official source link, WAN/LAN inventory, expansion, console/USB and capabilities. Only installed base hardware is assumed. Regional cellular, Wi-Fi, optics, power and license variants must be checked against the linked document.

35 models have an Ethernet CLI mapping in this application. Other models are explicitly marked catalog and offer physical inventory rather than invented CLI names. CLI generation is blocked for those models, including peer topologies, so Meraki, IOS XR, virtual and module-dependent devices cannot silently receive IOS XE commands. This catalog expansion does not add new operating-system generators.

Modular chassis require an installed-card inventory and virtual appliances require a deployment NIC inventory. Empty port selectors for those models are intentional; no hypothetical line cards, breakout interfaces or virtual NICs are prepopulated.

The runtime does not scrape Cisco from visitors' browsers. Cisco blocked direct programmatic HTTP access during research. Official documents were read through the available browsing tool and their factual specifications were normalized into reviewed source data. Updates require rechecking official documents, updating source data, rebuilding and running the tests.

The router model picker follows Device vendor and is stored independently for Side A and Side B. It is available only for Cisco routers. The topology editor exposes the same model selection. Switch and host interface suggestions remain independent.

Machine-readable catalog: [static/vpn/cisco-routers.json](static/vpn/cisco-routers.json). Each record contains exactly model, series, form_factor, wan_ports, lan_ports, expansion_slots, console_usb and features. Runtime data and JSON consistency are checked by tests/router-models.test.js.

The catalog distinguishes ISR1100-4G/6G and ISR1100X SD-WAN platforms from C1101-4P/C1111-4P. C8200-1N4T is represented by C8200-1N-4T. The requested C8300-2N2S-4T example is represented by C8300-2N2S-4T2X, including its two 10-Gbps interfaces.

Onboard ports only are suggested. Combo RJ-45/SFP connectors share one logical interface. Optional modules are not assumed installed; select Custom / other model for module-specific interface names. Routed ports on ISR 4000 and Catalyst platforms can serve WAN or LAN, with the currently selected opposite port excluded. C921/C1101/C1111 LAN switchports require VLAN interfaces for IP addressing; composed router CLI creates their physical VLAN binding and places Layer 3 commands on the SVI.

Features describe platform capabilities, subject to software release and licensing. ISR 4321/4331 are legacy platforms retained for existing installations; inclusion is not a claim that every listed platform is currently sold. No appliance execution testing was performed.

## Cisco references

- [ISR 900 data sheet](https://www.cisco.com/c/en/us/products/collateral/routers/900-series-integrated-services-routers-isr/datasheet-c78-741615.html)
- [ISR 1000 ordering guide](https://www.cisco.com/c/en/us/products/collateral/routers/1000-series-integrated-services-routers-isr/1kseries-integrated-services-routers-guide.html)
- [ISR 1000 hardware guide](https://www.cisco.com/c/en/us/td/docs/routers/access/1100/hardware/installation/guide/b-cisco-1100-series-hig/isr1k-hig-overview.html)
- [ISR 4000 data sheet](https://www.cisco.com/c/en/us/products/collateral/routers/4000-series-integrated-services-routers-isr/data_sheet-c78-732542.html)
- [Catalyst 8200/8300 ordering guide](https://www.cisco.com/c/en/us/products/collateral/routers/catalyst-8300-series-edge-platforms/cat-8300-8200-series-edge-plat-og.html)
- [Catalyst 8300 hardware guide](https://www.cisco.com/c/en/us/td/docs/routers/cloud_edge/c8300/hardware_installation/b-catalyst-8300-series-edge-platforms-hig/m-overview.html)
