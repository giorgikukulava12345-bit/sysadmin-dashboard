import { cidr } from '../address.js';

export default function fortinet(c, s, r) {
  const legacy=Boolean(c.legacyIos),encryption=legacy?'256':c.encryption,hash=legacy?'sha1':'sha256',dh=legacy?'5':c.dh,pfs=legacy?'5':c.pfs;
  const gre = c.protocol === 'gre', l = cidr(s.local), remote = cidr(s.remote), iface = gre ? 'NOC-GRE' : 'NOC-VPN';
  return `${legacy?'# Classic IOS interoperability: IKEv1 / AES-256 / SHA-1 / DH5 / PFS5.\n':''}config vpn ipsec phase1-interface
 edit "NOC-VPN"
  set type static
  set interface "${s.wan}"
  set authmethod psk
  set peertype any
  set ike-version ${c.protocol === 'ikev1' ? '1' : '2'}
${c.protocol==='ikev1'?'  set mode main\n':''}
  set local-gw ${s.ip}
  set remote-gw ${r.ip}
  set proposal aes${encryption}-${hash}
  set dhgrp ${dh}
  set keylife ${c.lifetime1}
  set nattraversal enable
  set dpd on-idle
  set psksecret "${s.psk}"
 next
end
config vpn ipsec phase2-interface
 edit "NOC-P2"
  set phase1name "NOC-VPN"
  set proposal aes${encryption}-${hash}
  set pfs enable
  set dhgrp ${pfs}
  set keylifeseconds ${c.lifetime2}
  set src-subnet ${gre ? s.ip + ' 255.255.255.255' : l.ip + ' ' + l.mask}
  set dst-subnet ${gre ? r.ip + ' 255.255.255.255' : remote.ip + ' ' + remote.mask}
${gre ? `  set protocol 47
  set encapsulation transport-mode
` : ''}  set auto-negotiate enable
 next
end
${gre ? `config system gre-tunnel
 edit "NOC-GRE"
  set interface "NOC-VPN"
  set local-gw ${s.ip}
  set remote-gw ${r.ip}
 next
end
config system interface
 edit "NOC-GRE"
  set ip ${s.tunnel} 255.255.255.255
  set remote-ip ${r.tunnel} 255.255.255.252
  set mtu-override enable
  set mtu 1400
 next
end
` : ``}config firewall address
 edit "NOC-LOCAL"
  set subnet ${l.ip} ${l.mask}
 next
 edit "NOC-REMOTE"
  set subnet ${remote.ip} ${remote.mask}
 next
end
config router static
 edit 0
  set dst ${remote.ip} ${remote.mask}
  set device "${iface}"
${gre ? `  set gateway ${r.tunnel}
` : ''} next
 edit 0
  set dst ${remote.ip} ${remote.mask}
  set blackhole enable
  set distance 254
 next
end
config firewall policy
 edit 0
  set name "NOC-outbound"
  set srcintf "${s.lan}"
  set dstintf "${iface}"
  set srcaddr "NOC-LOCAL"
  set dstaddr "NOC-REMOTE"
  set action accept
  set schedule "always"
  set service "ALL"
  set nat disable
  set logtraffic all
 next
 edit 0
  set name "NOC-inbound"
  set srcintf "${iface}"
  set dstintf "${s.lan}"
  set srcaddr "NOC-REMOTE"
  set dstaddr "NOC-LOCAL"
  set action accept
  set schedule "always"
  set service "ALL"
  set nat disable
  set logtraffic all
 next
end
# Verify: diagnose vpn ike gateway list; diagnose vpn tunnel list
# Review policy ordering and narrow services to application requirements.`;
}
