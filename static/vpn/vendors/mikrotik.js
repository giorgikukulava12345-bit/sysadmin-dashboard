export default function mikrotik(c, s, r) {
  const gre = c.protocol === 'gre', dh = n => n === '19' ? 'ecp256' : 'modp2048';
  return `/ip ipsec profile add name=NOC-IKE enc-algorithm=aes-${c.encryption} hash-algorithm=sha256 dh-group=${dh(c.dh)} lifetime=${c.lifetime1}s dpd-interval=10s dpd-maximum-failures=3
/ip ipsec peer add name=NOC-PEER address=${r.ip}/32 local-address=${s.ip} exchange-mode=${c.protocol === 'ikev1' ? 'main' : 'ike2'} profile=NOC-IKE
/ip ipsec identity add peer=NOC-PEER auth-method=pre-shared-key secret="${s.psk}" my-id=address:${s.ip} remote-id=address:${r.ip}
/ip ipsec proposal add name=NOC-ESP enc-algorithms=aes-${c.encryption}-cbc auth-algorithms=sha256 pfs-group=${dh(c.pfs)} lifetime=${c.lifetime2}s
/ip ipsec policy add peer=NOC-PEER src-address=${gre ? s.ip + '/32' : s.local} dst-address=${gre ? r.ip + '/32' : s.remote} protocol=${gre ? 'gre' : 'all'} tunnel=${gre ? 'no' : 'yes'} action=encrypt level=require proposal=NOC-ESP sa-src-address=${s.ip} sa-dst-address=${r.ip}
${gre ? `/interface gre add name=NOC-GRE local-address=${s.ip} remote-address=${r.ip} mtu=1400 allow-fast-path=no
/ip address add address=${s.tunnel}/30 interface=NOC-GRE
/ip route add dst-address=${s.remote} gateway=${r.tunnel}
` : ``}/ip firewall nat add chain=srcnat src-address=${s.local} dst-address=${s.remote} action=accept comment="NOC NAT exemption"
/ip firewall nat move [find comment="NOC NAT exemption"] 0
/ip firewall filter add chain=input action=accept src-address=${r.ip} dst-address=${s.ip} protocol=udp dst-port=500,4500 comment="NOC IKE"
/ip firewall filter add chain=input action=accept src-address=${r.ip} dst-address=${s.ip} protocol=ipsec-esp comment="NOC ESP"
${gre ? `/ip firewall filter add chain=input action=accept src-address=${r.ip} dst-address=${s.ip} protocol=gre ipsec-policy=in,ipsec comment="NOC protected GRE"
` : ''}/ip firewall filter add chain=forward action=accept src-address=${s.local} dst-address=${s.remote}${gre ? ' out-interface=NOC-GRE' : ' ipsec-policy=out,ipsec'} comment="NOC outbound"
/ip firewall filter add chain=forward action=accept src-address=${s.remote} dst-address=${s.local}${gre ? ' in-interface=NOC-GRE' : ' ipsec-policy=in,ipsec'} comment="NOC inbound"
/ip firewall filter move [find comment="NOC IKE"] 0
/ip firewall filter move [find comment="NOC ESP"] 0
${gre ? `/ip firewall filter move [find comment="NOC protected GRE"] 0
` : ''}/ip firewall filter move [find comment="NOC outbound"] 0
/ip firewall filter move [find comment="NOC inbound"] 0
# Verify: /ip ipsec active-peers print; /ip ipsec installed-sa print
# Existing routes must reach the remote LAN and peer WAN; bypass FastTrack for VPN traffic.`;
}
