import { cidr } from './address.js';

export function vtiConfig(c, s, peer) {
  const local = cidr(s.local), remote = cidr(s.remote), legacy = Boolean(c.vtiLegacy);
  return `configure terminal
! 1. Phase 1 (ISAKMP)
crypto isakmp policy 1
 encr aes ${c.encryption}
 hash ${legacy ? 'sha' : 'sha256'}
 authentication pre-share
 group ${legacy ? '2' : c.dh}
 lifetime ${c.lifetime1}
 exit
crypto isakmp key ${s.psk} address ${peer.ip}

! 2. Phase 2 (IPsec Transform-Set & Profile)
crypto ipsec transform-set TS-VTI esp-aes ${c.encryption} ${legacy ? 'esp-sha-hmac' : 'esp-sha256-hmac'}
 mode tunnel
 exit
crypto ipsec profile IPSEC-PROFILE-VTI
 set transform-set TS-VTI
 set security-association lifetime seconds ${c.lifetime2}
 exit

! 3. VTI Tunnel Interface Optimization (MTU/MSS)
interface Tunnel0
 ip address ${s.tunnel} 255.255.255.252
 ip mtu 1400
 ip tcp adjust-mss 1360
 tunnel source ${s.ip}
 tunnel destination ${peer.ip}
 tunnel mode ipsec ipv4
 tunnel protection ipsec profile IPSEC-PROFILE-VTI
 exit

! 4. Static Routing to Remote Network
ip route ${remote.ip} ${remote.mask} Tunnel0

! 5. NAT Exemption ACL
! Rebuilds the named NAT ACL; merge any other existing translation entries first.
no ip access-list extended NAT
ip access-list extended NAT
 deny ip ${local.ip} ${local.wildcard} ${remote.ip} ${remote.wildcard}
 permit ip ${local.ip} ${local.wildcard} any
 exit
! The NAT rule must reference ACL NAT for the exemption to take effect.
! If replacing an existing NAT rule, remove/merge that rule before using this line.
ip nat inside source list NAT interface ${s.wan} overload
interface ${s.wan}
 ip nat outside
 exit
interface ${s.lan}
 ip nat inside
 exit
end
! Verify: show crypto isakmp sa; show crypto ipsec sa; show interface Tunnel0
! ${legacy ? 'Legacy lab compatibility: DH2 / SHA1. Use the modern profile for new deployments.' : 'IKEv1 VTI with SHA256. Verify firmware and reserved Tunnel0/profile/ACL names.'}`;
}
