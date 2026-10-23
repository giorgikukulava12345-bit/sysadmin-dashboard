export default function paloalto(c, s, r) {
  const version = c.protocol === 'ikev1' ? 'ikev1' : 'ikev2';
  return `configure
set network ike crypto-profiles ike-crypto-profiles NOC-IKE encryption aes-${c.encryption}-cbc
set network ike crypto-profiles ike-crypto-profiles NOC-IKE hash sha256
set network ike crypto-profiles ike-crypto-profiles NOC-IKE dh-group group${c.dh}
set network ike crypto-profiles ike-crypto-profiles NOC-IKE lifetime seconds ${c.lifetime1}
set network ike crypto-profiles ipsec-crypto-profiles NOC-ESP esp encryption aes-${c.encryption}-cbc
set network ike crypto-profiles ipsec-crypto-profiles NOC-ESP esp authentication sha256
set network ike crypto-profiles ipsec-crypto-profiles NOC-ESP dh-group group${c.pfs}
set network ike crypto-profiles ipsec-crypto-profiles NOC-ESP lifetime seconds ${c.lifetime2}
set network ike gateway NOC-GW authentication pre-shared-key key ${s.psk}
set network ike gateway NOC-GW local-address interface ${s.wan}
set network ike gateway NOC-GW local-address ip ${s.ip}
set network ike gateway NOC-GW peer-address ip ${r.ip}
set network ike gateway NOC-GW local-id type ipaddr id ${s.ip}
set network ike gateway NOC-GW peer-id type ipaddr id ${r.ip}
set network ike gateway NOC-GW protocol version ${version}
set network ike gateway NOC-GW protocol ${version} ike-crypto-profile NOC-IKE
${version === 'ikev1' ? `set network ike gateway NOC-GW protocol ikev1 exchange-mode main
` : ''}set network ike gateway NOC-GW protocol-common nat-traversal enable yes
set network interface tunnel units tunnel.100
set zone NOC-VPN network layer3 tunnel.100
set network virtual-router ${s.vr} interface tunnel.100
set network tunnel ipsec NOC-VPN tunnel-interface tunnel.100
set network tunnel ipsec NOC-VPN auto-key ike-gateway NOC-GW
set network tunnel ipsec NOC-VPN auto-key ipsec-crypto-profile NOC-ESP
set network tunnel ipsec NOC-VPN auto-key proxy-id LAN local ${s.local}
set network tunnel ipsec NOC-VPN auto-key proxy-id LAN remote ${s.remote}
set network tunnel ipsec NOC-VPN auto-key proxy-id LAN protocol any
set network virtual-router ${s.vr} routing-table ip static-route NOC-REMOTE destination ${s.remote}
set network virtual-router ${s.vr} routing-table ip static-route NOC-REMOTE interface tunnel.100
set rulebase security rules NOC-outbound from ${s.zone} to NOC-VPN source ${s.local} destination ${s.remote} application any service any action allow log-end yes
set rulebase security rules NOC-inbound from NOC-VPN to ${s.zone} source ${s.remote} destination ${s.local} application any service any action allow log-end yes
set rulebase nat rules NOC-no-NAT from ${s.zone} to NOC-VPN source ${s.local} destination ${s.remote} service any
move rulebase nat rules NOC-no-NAT top
# Validate the candidate with validate full, inspect the diff, then commit.
# Verify in operational mode: show vpn ike-sa; show vpn ipsec-sa
# Classic virtual-router template; Advanced Routing Engine requires a different routing hierarchy.`;
}
