import {cidr, ipv4} from './address.js';

export function officeVpnTraffic(site,peer,localSecond,remoteSecond){
  const local=[site.local,localSecond].filter(Boolean).map(cidr);
  const remote=[peer.local,remoteSecond].filter(Boolean).map(cidr);
  const wan=cidr(site.ip+'/'+site.wanPrefix),peerIp=ipv4(peer.ip);
  const nextHop=remoteSecond&&wan&&peerIp>wan.network&&peerIp<wan.end?peer.ip:site.gateway;
  return {
    selectors:local.flatMap(l=>remote.map(r=>` permit ip ${l.ip} ${l.wildcard} ${r.ip} ${r.wildcard}`)).join('\n'),
    routes:remote.map(r=>`ip route ${r.ip} ${r.mask} ${nextHop}`).join('\n')
  };
}
