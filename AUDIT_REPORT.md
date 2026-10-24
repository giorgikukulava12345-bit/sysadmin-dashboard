# Network Configuration Generator — End-to-End Audit

Audit date: 25 October 2026. Baseline: `ebdec317fa13e902e24c7bb9b793b042e6de89ce` in `giorgikukulava12345-bit/sysadmin-dashboard`.

## Outcome and scope

Confirmed defects were reproduced, fixed and covered by regression tests. Three findings are categorized as **Critical**: missing values could become literal CLI credentials/identifiers, Cisco commands could leak into a MikroTik configuration, and companion-switch secrets could bypass masking or remain in a stale generated snapshot. This severity describes configuration/data-display consequences; it is not a claim of remote code execution in the website.

The application is Flask/Jinja with browser ES modules, not React/Next.js. Configuration generation runs locally in the browser; Flask serves the application and file endpoints. Accordingly, the audit tested DOM lifecycle/state integrity rather than React hydration.

Reviewed the production JavaScript modules, all registered feature/vendor paths, IPsec/WireGuard vendor templates, Office Internet Gateway and failover composition, VLAN bindings, NAT, DHCP, routing, firewall composition, terminal masking, the analyzer, header and Flask routes. Automated checks establish the stated software behaviors. They do **not** certify acceptance by every firmware image or prove packet forwarding.

## Verification evidence

| Check | Verified result |
|---|---|
| JavaScript syntax and local assets | 38 production JavaScript modules parsed; 81 relative imports resolved; local page assets exist |
| Existing engine tests | 395/395 passed, including valid and intentionally rejected vendor/protocol combinations |
| Existing feature audit | 574 checks; 100 feature/vendor cases; 392 injection mutations |
| Expanded audit regressions | 583/583 passed; includes 442 missing-field mutations and 16 feature credential-mask checks |
| Internet / failover tests | 158 passed |
| Office VLAN / DHCP / DNS / analyzer tests | 85 passed |
| VPN masking | 30 supported vendor/protocol output checks plus credential-format/CLI-structure samples |
| Other Node checks | Second VLAN, header, English-only UI and GeoIP fallback/timeout checks passed |
| Browser lifecycle | 229/229 UI checks passed |
| Responsive layouts | Initial, preset and terminal states passed at 375, 768 and 1280px; no page-level horizontal overflow |
| Actual Flask integration | 12/12 tests passed with the patched pinned dependencies; all 38 production JavaScript assets served |
| Manual browser checks | Masked CLI structure visible; Reveal shows the test secrets; Clear secrets disables Copy; clock advances; one unframed flag remains; no console errors in the inspected Flask page |

The first targeted reproduction run failed all 17 initial cases against the baseline behavior. The broader missing-field run then exposed two additional OpenVPN coercion cases, which were also fixed. The exact command output is supplied in `audit-test-results.txt`; the full source changes are in `network-generator-audit.patch`.

## Critical — fixed

### C01. Missing values became valid-looking CLI identifiers or credentials

**Trigger:** Delete a required username/secret or a topology host interface from an input object. JavaScript regular expressions coerce `undefined` to the text `"undefined"`; several expressions accepted that text. OpenVPN server/username validation had the same problem.

**Impact:** Output could contain `username undefined`, a password literally named `undefined`, an invalid OpenVPN endpoint, or `dev undefined`. Ordinary form defaults hid this defect from happy-path tests.

**Precise fix:** `catalog.js` now checks `typeof value === 'string'` before validating identifiers, interfaces and SSH secrets. `features.js` applies the same guard to OpenVPN server/username values. `lab.js` validates interface types before interpolation. Missing data produces errors and no script. The previously requested four-character SSH secrets remain supported.

```js
requireValue(typeof value === 'string' && identifierPattern.test(value), message);
```

**Evidence:** Required-value regressions and the 442 missing-field mutations; successful outputs are checked for `undefined`, `NaN` and `[object Object]`.

### C02. Two-VLAN MikroTik PAT received Cisco commands and omitted backup coverage

**Trigger:** Apply the multi-VLAN Office preset, clear the bundle, then select standalone MikroTik NAT/PAT. The generic second-VLAN append emitted `configure terminal`, `ip access-list` and `ip nat inside`. With WAN failover selected, the second network was omitted from the added PAT rules.

**Impact:** Wrong-vendor CLI or no internet translation for VLAN 20, particularly after WAN failover.

**Precise fix:** `compose.js` dispatches the secondary fragment by vendor. Cisco receives IOS ACL/bindings; RouterOS receives a `srcnat` masquerade rule for the second subnet on each selected WAN.

```text
/ip firewall nat add chain=srcnat src-address=172.16.19.0/24 out-interface=ether1 action=masquerade
```

The subnet and interface in actual output come from the shared model. Tests require both VLANs on both RouterOS WANs and reject IOS command lines in RouterOS output.

### C03. Companion-switch secrets bypassed masking and cache invalidation

**Trigger:** Apply Office setup, select SNMPv3 on its companion switch, enter authentication/privacy secrets, return to the router and generate. The companion terminal rendered its raw script even when Reveal secrets was off. The router snapshot key also omitted companion feature values, so clearing switch-only secrets could leave an old generated snapshot copyable.

**Impact:** Local plaintext exposure against the user's masking choice, and stale credentials in generated/copyable output after Clear secrets. No network transmission of those secrets was demonstrated.

**Precise fix:** `workbench.js` masks the companion through `maskSecrets()`, includes companion credentials when deciding whether to show the shared Reveal control, and includes companion selections/values in the submission signature. Invalidating or clearing a snapshot drops the companion object and removes its rendered code. The switch Copy button explicitly states that the full copied script includes secrets, matching the main terminal's contract.

**Evidence:** Four browser checks reproduce companion-only secrets, default masking, explicit reveal and clear/invalidation. The final lifecycle suite passes 229/229.

## Warning — fixed

| ID | Confirmed issue and consequence | Precise correction |
|---|---|---|
| W01 | The standalone second DHCP scope reused the primary range/interface and server object IDs. MikroTik/FortiGate generation failed range validation; duplicate object names/IDs would also collide. | `compose.js` derives a usable secondary range excluding its gateway/SVI, binds the tagged secondary interface, creates a distinct name and increments the FortiGate server ID. `features.js` exposes a validated MikroTik server name. DNS and lease selections are retained; overflow fails atomically. |
| W02 | Junos QoS/VRRP could emit `set interfaces ge-0/0/1.10 unit 0`, and VLAN 20 VRRP was checked against VLAN 10 addressing. | `enterprise.js` splits physical interface and unit. `lanBinding()` in `features.js` selects the target VLAN's subnet/address/reservations; composition validates the virtual IP against that subnet. Example hierarchy: `set interfaces ge-0/0/1 unit 10 family inet filter input NOC-MARK`. |
| W03 | The analyzer treated reopened interfaces/pools as different objects. Analyzing the application's own multi-fragment output falsely reported a missing NAT outside binding; reopened DHCP pools lost earlier context. Unindented snippets also lost context after their first command. | `config-analyzer.js` merges interfaces/pools/ACLs by identifier and retains recognized subcommand context. Regression tests analyze generated Office output and reopened/unindented snippets. |
| W04 | Analyzer route repairs copied an unvalidated route tail; invalid DHCP DNS values were ignored; NAT coverage ignored earlier denies and expanded standard ACL numbers. | Validate supported route-tail grammar before constructing repairs; withhold unsupported repairs. Validate DHCP DNS. Evaluate standard ACLs in first-match order over the usable subnet and recognize standard ranges 1–99 and 1300–1999. Unsupported wildcard/ACL grammar explicitly requires manual review. Stop overlap processing when the documented finding cap is reached. |
| W05 | Multicast/loopback LANs could pass shared topology validation. Self-route and DHCP Server/Relay conflict checks did not account for the secondary VLAN. | `unicastNetwork()` rejects unsuitable LAN space in primary/secondary validation. `compose.js` includes secondary assigned addresses in self-route checks and rejects Server + Relay on either generated LAN interface. |
| W06 | A malformed composition object or internal generator exception could escape the pure composition API. The UI had a catch, but other callers did not have the same atomic contract. | `composeDevice()` now wraps a checked implementation, validates site/device context and returns `Generation failed...`, empty code and an error list. The UI's existing error status remains consistent and recovers after correction. |
| W07 | Next-hop-only floating defaults could recursively resolve a failed WAN's next hop through another route; administrative distance alone does not guarantee link failover. | Cisco Dual ISP now reserves two editable tracking IDs and tracks each WAN's line protocol. Primary/backup next-hop-only routes reference their corresponding track. IDs are bounded and collisions with the selected IP SLA track are rejected. No outgoing interface was reintroduced into the route command. |
| W08 | The removed Port Checker UI left an unauthenticated server TCP-check endpoint active. It rejected private destinations, so this was not a demonstrated private-address SSRF bypass, but it remained unnecessary server-side network functionality. | Removed `/api/portcheck` and its socket/DNS implementation. A Flask test requires HTTP 404 and verifies that no socket can be opened through the retired endpoint. |
| W09 | Backend startup created an optional repository directory; listing failed if it was absent. A Windows cross-drive download path could raise `ValueError` in `commonpath`, resulting in HTTP 500. | Removed the unnecessary startup write; an absent files directory returns an empty JSON list. Cross-drive/common-path failures are treated as outside the allowed directory. Traversal, cross-drive and missing-file tests return 403/404 rather than 500. |
| W10 | `npm test` only ran the original engine suite. Framework/transitive versions also lacked a reviewed, reproducible patched baseline. | `tests/run-all.js` runs all 11 Node suites, including syntax/import and boundary checks. `requirements.txt` pins the seven tested runtime packages, including Flask 3.1.3 and Werkzeug 3.1.9. Browser and Python suites remain explicit separate checks. |

Cisco link-tracked routing now has this structure, using actual inputs and editable unused IDs:

```text
track 900 interface GigabitEthernet1 line-protocol
 exit
track 901 interface GigabitEthernet0/2 line-protocol
 exit
ip route 0.0.0.0 0.0.0.0 203.0.113.9 1 track 900
ip route 0.0.0.0 0.0.0.0 203.0.113.13 5 track 901
```

Flask's [published advisory](https://github.com/pallets/flask/security/advisories/GHSA-68rp-wp8r-4726) affects releases before 3.1.3 under specific session/cache conditions. This application does not currently use Flask sessions; no session disclosure was demonstrated. The dependency change removes that outdated baseline rather than claiming an observed exploit. The tested Werkzeug pin includes the [Windows path-handling security fix](https://github.com/pallets/werkzeug/security/advisories/GHSA-g6x2-hccm-hh4m).

## UI/UX — fixed

| ID | Trigger and observed problem | Precise correction |
|---|---|---|
| U01 | After a router vendor reset, switch cards could still appear “Included in Office preset” although the router bundle was no longer selected. | Managed switch highlights now require the active router Internet Gateway selection as well as preset/binding state. |
| U02 | An invalid hidden Side B could block an unrelated Side A tool, and vice versa. | `labScripts()` and interface validation accept explicit sides. Single-site composition validates/renders the selected site; paired VPN/GRE retains both sides. Output indexing follows the generated set; the topology editor uses the same scope. |
| U03 | A switch submission could make the router preset banner say “Configuration ready.” Remote-access client/server selection also unnecessarily showed a dual-site topology. | Ready status now belongs to a submitted, valid router output. Remote-access-only configuration uses a single-site preview. |
| U04 | The clock markup retained a fabricated fixed date/time, and styles for the removed right-hand flag remained unused. | The initial clock says “Synchronizing...” until the live clock renders. Removed unused flag styles; the single unframed left flag remains. |
| U05 | Editing a shared port after selecting a routing feature left its contextual default on the old interface. | New `syncTopologyValues()` follows contextual interface, router-ID and default network values through topology/VPN edits while preserving explicitly different feature values. Junos OSPF defaults follow the tagged unit. Browser tests change the LAN port and inspect both the form and generated CLI. |

## Behaviors verified without a new defect

- Terminal highlighting uses text nodes; pasted configuration/markup is not interpreted as HTML.
- Secret masking changes credential arguments rather than replacing the entire configuration. Reveal and Clear behavior passed tests on the actual Flask page. Copy deliberately includes secrets, as its UI states.
- Office presets check their managed cards and generate router/switch output for separate physical devices. DHCP exclusions, per-VLAN DNS and WAN bindings use current inputs.
- Unsupported feature/vendor/protocol combinations fail with explanations rather than substituting another vendor's CLI. All five enterprise vendors remain selectable; this does not mean every feature has a template on every platform.
- The single left Georgian flag, public IP/ISP metrics and live time fit the checked viewports. Removed location/Port Checker/stream widgets did not reappear.
- GeoIP primary/fallback/outage/timeout behavior passed mocked tests. No city was fabricated or forced to Tbilisi.

## Remaining limits and required device validation

1. **No hardware/EVE-NG execution:** Image-specific command availability, existing object names/IDs, NAT/security policy order, VRFs, forwarding behavior and live failover still require a device lab and candidate validation/commit. No network-device commands were executed by this audit.
2. **Cisco dual-WAN PAT:** The requested ACL-only Cisco NAT route-map format cannot distinguish two identical LAN matches across WANs. That combination remains deliberately rejected; standalone dual-ISP routing is available. A separate platform-supported egress-aware NAT design is required to combine them.
3. **Upstream outages:** Cisco interface tracking detects local link loss; it does not detect an ISP outage while Ethernet stays up. RouterOS gateway ping checks only its gateway. End-to-end SLA/RPM/path monitoring requires an explicit monitored target and routing design. The UI explains this limit.
4. **Analyzer coverage:** This is a bounded IOS/IOS XE rule-based analyzer, not a full multi-vendor compiler or VRF-aware control-plane simulator. Advanced route-tail and noncontiguous wildcard cases require manual review. Corrections are proposals, not automatically applied changes.
5. **Testing boundary:** Browser checks were performed in the available Chromium-based browser and same-origin responsive frames. Other browsers, physical touch devices and externally hosted font/Tailwind/GeoIP availability were not certified. No full third-party vulnerability-database scan or Vercel account-policy audit is claimed.

## Reproduce the checks

```text
npm test
python -m pip install -r requirements.txt
python -m unittest discover -s tests -p "test_*.py" -v
```

For browser checks, serve the repository's test fixture with the page/template includes and static assets available, then open `tests/index.html`. `tests/responsive-audit.html?width=375` exercises the initial, preset and terminal states; repeat with 768 and 1280. The ordinary production Flask app intentionally does not expose a `/tests` route.

The supplied patch is against the verified baseline commit, and the source archive contains all changed implementation and test files. Candidate rollout and final live verification are recorded with the release artifacts.

## Source index

These links identify the corrected functions; the supplied unified patch contains every changed line.

| Source | Entry point |
|---|---|
| [static/vpn/catalog.js:47](https://github.com/giorgikukulava12345-bit/sysadmin-dashboard/blob/main/static/vpn/catalog.js#L47) | `function name` |
| [static/vpn/compose.js:10](https://github.com/giorgikukulava12345-bit/sysadmin-dashboard/blob/main/static/vpn/compose.js#L10) | `export function composeDevice` |
| [static/vpn/features.js:51](https://github.com/giorgikukulava12345-bit/sysadmin-dashboard/blob/main/static/vpn/features.js#L51) | `export function lanBinding` |
| [static/vpn/enterprise.js:13](https://github.com/giorgikukulava12345-bit/sysadmin-dashboard/blob/main/static/vpn/enterprise.js#L13) | `const junosPort=` |
| [static/vpn/config-analyzer.js:9](https://github.com/giorgikukulava12345-bit/sysadmin-dashboard/blob/main/static/vpn/config-analyzer.js#L9) | `function routeTail` |
| [static/vpn/internet.js:56](https://github.com/giorgikukulava12345-bit/sysadmin-dashboard/blob/main/static/vpn/internet.js#L56) | `export function internetRoutes` |
| [static/vpn/interfaces.js:12](https://github.com/giorgikukulava12345-bit/sysadmin-dashboard/blob/main/static/vpn/interfaces.js#L12) | `export function validateInterfaces` |
| [static/vpn/lab.js:13](https://github.com/giorgikukulava12345-bit/sysadmin-dashboard/blob/main/static/vpn/lab.js#L13) | `export function labScripts` |
| [static/vpn/topology-sync.js:3](https://github.com/giorgikukulava12345-bit/sysadmin-dashboard/blob/main/static/vpn/topology-sync.js#L3) | `export function syncTopologyValues` |
| [static/vpn/workbench.js:57](https://github.com/giorgikukulava12345-bit/sysadmin-dashboard/blob/main/static/vpn/workbench.js#L57) | `function paintOutput` |
| [app.py:40](https://github.com/giorgikukulava12345-bit/sysadmin-dashboard/blob/main/app.py#L40) | `def api_files` |
| [tests/end-to-end-audit.test.js:14](https://github.com/giorgikukulava12345-bit/sysadmin-dashboard/blob/main/tests/end-to-end-audit.test.js#L14) | `test('missing identifier` |
| [tests/run-all.js:4](https://github.com/giorgikukulava12345-bit/sysadmin-dashboard/blob/main/tests/run-all.js#L4) | `const suites=` |
