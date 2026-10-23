export default function wireguard(c, s, r) {
  return `/interface wireguard add name=NOC-WG listen-port=${s.port} mtu=1420 private-key="${s.privateKey}"
/ip address add address=${s.tunnel}/30 interface=NOC-WG
/interface wireguard peers add interface=NOC-WG public-key="${r.publicKey}"${s.psk ? ` preshared-key="${s.psk}"` : ''} endpoint-address=${r.ip} endpoint-port=${r.port} allowed-address=${r.tunnel}/32,${s.remote} persistent-keepalive=25s
/ip route add dst-address=${s.remote} gateway=NOC-WG
/ip firewall nat add chain=srcnat src-address=${s.local} dst-address=${s.remote} action=accept comment="NOC NAT exemption"
/ip firewall nat move [find comment="NOC NAT exemption"] 0
/ip firewall filter add chain=input src-address=${r.ip} protocol=udp dst-port=${s.port} action=accept comment="NOC WG handshake"
/ip firewall filter add chain=forward in-interface=NOC-WG src-address=${s.remote} dst-address=${s.local} action=accept comment="NOC WG inbound"
/ip firewall filter add chain=forward out-interface=NOC-WG src-address=${s.local} dst-address=${s.remote} action=accept comment="NOC WG outbound"
/ip firewall filter move [find comment="NOC WG handshake"] 0
/ip firewall filter move [find comment="NOC WG inbound"] 0
/ip firewall filter move [find comment="NOC WG outbound"] 0
# Verify: /interface wireguard peers print detail
# Public key must correspond to the opposite side's private key; derive it on the router.
# ChaCha20-Poly1305 / Curve25519 are fixed by WireGuard; IPsec phase settings do not apply.`;
}
