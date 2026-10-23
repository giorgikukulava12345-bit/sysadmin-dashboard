import { cidr } from '../address.js';

export default function asa(c, s, r) {
  const l = cidr(s.local), remote = cidr(s.remote);
  return `configure terminal
crypto ikev2 policy 100
 encryption aes${c.encryption === '128' ? '' : '-256'}
 integrity sha256
 group ${c.dh}
 prf sha256
 lifetime seconds ${c.lifetime1}
 exit
crypto ikev2 enable ${s.wan}
crypto ipsec ikev2 ipsec-proposal NOC-ESP
 protocol esp encryption aes${c.encryption === '128' ? '' : '-256'}
 protocol esp integrity sha-256
 exit
access-list NOC-CRYPTO extended permit ip ${l.ip} ${l.mask} ${remote.ip} ${remote.mask}
crypto map NOC-MAP 100 match address NOC-CRYPTO
crypto map NOC-MAP 100 set peer ${r.ip}
crypto map NOC-MAP 100 set ikev2 ipsec-proposal NOC-ESP
crypto map NOC-MAP 100 set pfs group${c.pfs}
crypto map NOC-MAP 100 set security-association lifetime seconds ${c.lifetime2}
crypto map NOC-MAP interface ${s.wan}
tunnel-group ${r.ip} type ipsec-l2l
tunnel-group ${r.ip} ipsec-attributes
 ikev2 remote-authentication pre-shared-key ${s.psk}
 ikev2 local-authentication pre-shared-key ${s.psk}
 exit
object network NOC-LOCAL
 subnet ${l.ip} ${l.mask}
 exit
object network NOC-REMOTE
 subnet ${remote.ip} ${remote.mask}
 exit
nat (${s.lan},${s.wan}) 1 source static NOC-LOCAL NOC-LOCAL destination static NOC-REMOTE NOC-REMOTE no-proxy-arp route-lookup
route ${s.wan} ${remote.ip} ${remote.mask} ${s.gateway} 1
end
! Verify: show crypto ikev2 sa; show crypto ipsec sa
! Review sysopt connection permit-vpn, vpn-filter and existing NAT ordering.`;
}
