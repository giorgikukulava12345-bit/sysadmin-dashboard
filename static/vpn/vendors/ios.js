import {cliProfile} from '../cli-profile.js';
import { cidr } from '../address.js';

export default function ios(c, s, r) {
  const legacy=Boolean(c.legacyIos),encryption=legacy?'256':c.encryption,dh=legacy?'5':c.dh,pfs=legacy?'5':c.pfs;
  const l = cidr(s.local), remote = cidr(s.remote), gre = c.protocol === 'gre', v2 = c.protocol !== 'ikev1';
  const p1 = v2 ? `crypto ikev2 proposal NOC-IKE
 encryption aes-cbc-${encryption}
 integrity sha256
 prf sha256
 group ${dh}
 exit
crypto ikev2 policy NOC-IKE
 proposal NOC-IKE
 exit
crypto ikev2 keyring NOC-KEY
 peer REMOTE
  address ${r.ip}
  pre-shared-key ${s.psk}
  exit
 exit
crypto ikev2 profile NOC-IKE
 match identity remote address ${r.ip} 255.255.255.255
 identity local address ${s.ip}
 authentication remote pre-share
 authentication local pre-share
 keyring local NOC-KEY
 lifetime ${c.lifetime1}
 dpd 10 3 periodic
 no config-exchange request
 exit` : `crypto isakmp policy 100
 encryption aes ${encryption}
 hash ${legacy?'sha':'sha256'}
 authentication pre-share
 group ${dh}
 lifetime ${c.lifetime1}
 exit
crypto isakmp key ${s.psk} address ${r.ip}`;
  return `${legacy?'! Classic IOS lab compatibility: IKEv1 / AES-256 / SHA-1 / DH5 / PFS5.\n':''}configure terminal
${p1}
crypto ipsec transform-set NOC-ESP esp-aes ${encryption} ${legacy?'esp-sha-hmac':'esp-sha256-hmac'}
${cliProfile(s).id==='packet-tracer'?'':` mode ${gre ? 'transport' : 'tunnel'}\n exit\n`} 
ip access-list extended NOC-CRYPTO
 ${gre ? `permit gre host ${s.ip} host ${r.ip}` : `permit ip ${l.ip} ${l.wildcard} ${remote.ip} ${remote.wildcard}`}
 exit
crypto map NOC-MAP 100 ipsec-isakmp
 set peer ${r.ip}
 set transform-set NOC-ESP
 set pfs group${pfs}
 set security-association lifetime seconds ${c.lifetime2}
${v2 ? ` set ikev2-profile NOC-IKE
` : ''} match address NOC-CRYPTO
 exit
interface ${s.wan}
 crypto map NOC-MAP
 exit
${gre ? `interface Tunnel100
 ip address ${s.tunnel} 255.255.255.252
 ip mtu 1400
 ip tcp adjust-mss 1360
 tunnel source ${s.ip}
 tunnel destination ${r.ip}
 tunnel mode gre ip
 exit
ip route ${remote.ip} ${remote.mask} ${r.tunnel}` : `ip route ${remote.ip} ${remote.mask} ${s.gateway}`}
end
! ${legacy?'Classic IOS IPsec image required.':'Policy-based crypto map target: IOS XE 17.6–17.9; verify firmware support.'}
! Merge NAT exemption into the existing NAT ACL before any translation permits.
! Preserve WAN reachability to ${r.ip} outside the tunnel.
! Verify: show crypto ${v2 ? 'ikev2 sa' : 'isakmp sa'}; show crypto ipsec sa`;
}
