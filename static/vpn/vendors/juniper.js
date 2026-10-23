// Junos SRX route-based IPsec. Review existing zones/NAT and commit separately.
export default function juniper(c,s,r){
  return `configure
# Junos SRX: assumes WAN zone untrust and no source NAT toward noc-vpn.
# Reserve st0.10 and NOC-* objects; inspect existing configuration before commit.
set security ike proposal NOC-IKE authentication-method pre-shared-keys
set security ike proposal NOC-IKE dh-group group${c.dh}
set security ike proposal NOC-IKE authentication-algorithm sha-256
set security ike proposal NOC-IKE encryption-algorithm aes-${c.encryption}-cbc
set security ike proposal NOC-IKE lifetime-seconds ${c.lifetime1}
${c.protocol==='ikev1'?'set security ike policy NOC-POL mode main\n':''}set security ike policy NOC-POL proposals NOC-IKE
set security ike policy NOC-POL pre-shared-key ascii-text "${s.psk}"
set security ike gateway NOC-PEER ike-policy NOC-POL
set security ike gateway NOC-PEER address ${r.ip}
set security ike gateway NOC-PEER external-interface ${s.wan}.0
set security ike gateway NOC-PEER local-address ${s.ip}
set security ike gateway NOC-PEER version ${c.protocol==='ikev1'?'v1-only':'v2-only'}
set security ipsec proposal NOC-ESP protocol esp
set security ipsec proposal NOC-ESP authentication-algorithm hmac-sha-256-128
set security ipsec proposal NOC-ESP encryption-algorithm aes-${c.encryption}-cbc
set security ipsec proposal NOC-ESP lifetime-seconds ${c.lifetime2}
set security ipsec policy NOC-IPSEC proposals NOC-ESP
set security ipsec policy NOC-IPSEC perfect-forward-secrecy keys group${c.pfs}
set interfaces st0 unit 10 family inet
set security ipsec vpn NOC-VPN bind-interface st0.10
set security ipsec vpn NOC-VPN ike gateway NOC-PEER
set security ipsec vpn NOC-VPN ike ipsec-policy NOC-IPSEC
set security ipsec vpn NOC-VPN traffic-selector NOC-TS local-ip ${s.local}
set security ipsec vpn NOC-VPN traffic-selector NOC-TS remote-ip ${s.remote}
set security ipsec vpn NOC-VPN establish-tunnels immediately
set routing-options static route ${s.remote} next-hop st0.10
set security zones security-zone untrust interfaces ${s.wan}.0 host-inbound-traffic system-services ike
set security zones security-zone noc-lan interfaces ${s.lan}.0
set security zones security-zone noc-vpn interfaces st0.10
set security address-book global address NOC-LOCAL ${s.local}
set security address-book global address NOC-REMOTE ${s.remote}
set security policies from-zone noc-lan to-zone noc-vpn policy NOC-OUT match source-address NOC-LOCAL
set security policies from-zone noc-lan to-zone noc-vpn policy NOC-OUT match destination-address NOC-REMOTE
set security policies from-zone noc-lan to-zone noc-vpn policy NOC-OUT match application any
set security policies from-zone noc-lan to-zone noc-vpn policy NOC-OUT then permit
set security policies from-zone noc-vpn to-zone noc-lan policy NOC-IN match source-address NOC-REMOTE
set security policies from-zone noc-vpn to-zone noc-lan policy NOC-IN match destination-address NOC-LOCAL
set security policies from-zone noc-vpn to-zone noc-lan policy NOC-IN match application any
set security policies from-zone noc-vpn to-zone noc-lan policy NOC-IN then permit
show | compare
# Review zone membership, WAN routing and NAT exclusions, then commit confirmed.
exit
`;
}
