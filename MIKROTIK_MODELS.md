# MikroTik model catalog

Checked against official MikroTik pages on 2026-10-28: 161 models (119 router/wireless/LTE devices, 42 switches), with 90 profiles offering wired RouterOS CLI mappings. Categories: Ethernet routers, indoor wireless, LTE/5G, switches. Current and archived products are included; legacy generations predating the requested 2015 window and accessories are excluded. This is not an inventory of every MikroTik radio, OEM board or accessory.

Each record has the product code, physical port counts/speeds, operating system, management/expansion specifications, official source URL, availability and checked date. Launch dates are left null when not verified; catalog status is not treated as a launch date. Announced products are marked explicitly and do not generate CLI.

The model selector follows the vendor and router/switch role in both the main controls and topology editor. Factory port names populate automatically. Excluded peer ports cannot be chosen from the suggestions. Invalid model ports block configuration output. The generator targets RouterOS 7: a product's hardware support does not guarantee every template works on every installed software version.

SwOS-only devices, single-wired-port wireless/LTE products, combo interfaces, unverified mixed-speed mappings, and high-speed breakout platforms expose hardware inventory and an explanation rather than fabricated CLI interface names. Select Custom / other model only after verifying the target OS and exact interfaces. Wireless and LTE uplinks are not guessed.

Quick Setup preserves the selected MikroTik switch and generates a separate companion bridge configuration. Router and switch commands must be applied to their respective physical devices.

## Sources and rebuilding

- [Official products](https://mikrotik.com/products)
- [Ethernet routers](https://mikrotik.com/products/group/ethernet-routers)
- [Switches](https://mikrotik.com/products/group/switches)
- [Indoor wireless](https://mikrotik.com/products/group/indoor-wireless)
- [LTE/5G](https://mikrotik.com/products/group/lte-5g-products)
- [Official historical newsletters](https://help.mikrotik.com/docs/spaces/ROS/blog/2020/08/01/166068245/Older%2BNewsletters)

Run `pwsh scripts/fetch-mikrotik.ps1` and then `node scripts/build-mikrotik-catalog.mjs`. The downloaded HTML cache stays local; extracted specifications are in `data/mikrotik-models.json`, and the browser uses the generated `static/vpn/mikrotik-catalog.js`.

Run `node tests/run-all.js` for all 21 suites. `tests/mikrotik-ui.html` is a browser regression fixture for model search, automatic defaults, source links, standalone switch output, Quick Setup companion output and SwOS blocking.
