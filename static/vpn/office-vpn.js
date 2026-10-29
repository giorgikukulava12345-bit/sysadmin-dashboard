import {cidr} from './address.js';
import {generate as generateVpn} from './engine.js';
import {generateStandardOffice} from './standard-office.js';
import {gatewayParts} from './gateway-parts.js';
import {modelGenerationError,selectRouterModel} from './router-models.js';
import {PORTS} from './platforms.js';

export const packetTracerPair=lab=>['a','b'].every(side=>lab[side].routerModel?.endsWith('(Packet Tracer)'));

/** A Cisco preset prepares its peer instead of requiring a hidden remote-site edit first. */
export function prepareOfficeVpnPair(lab,sourceSide){
  const source=lab?.[sourceSide];
  if(source?.vendor!=='ios')return false;
  for(const side of ['a','b']){
    const peer=lab[side];
    if(side===sourceSide)continue;
    if(peer.vendor!=='ios'){
      peer.vendor='ios';peer.routerModel='';[peer.wan,peer.lan]=PORTS.ios;
      if(source.routerModel)selectRouterModel(peer,source.routerModel);
    }else if(!peer.routerModel&&source.routerModel){
      selectRouterModel(peer,source.routerModel);
    }
  }
  return true;
}

/** A single owner for office PAT and the protected LAN-to-LAN IPsec selectors. */
export function generateOfficeVpn({lab,side,selected,values,vpnConfig,vpnType}){
  const fail=message=>({errors:['Quick Setup + VPN: '+message],code:'',empty:false});
  if(!['a','b'].includes(side)||!lab?.a||!lab?.b)return fail('Select both router sites.');
  if(['a','b'].some(key=>lab[key].vendor!=='ios'))return fail('Select Cisco on both router sites. Other vendor combinations are not supported by this preset.');
  for(const key of ['a','b']){
    const site=lab[key],blocked=modelGenerationError(site);
    if(blocked)return fail('Side '+key.toUpperCase()+': '+blocked);
    if(site.vlan2Enabled==='on')return fail('This preset supports one LAN per site.');
  }
  const pt=packetTracerPair(lab);
  if(['a','b'].some(key=>Boolean(lab[key].routerModel?.endsWith('(Packet Tracer)')))!==pt)return fail('Use Packet Tracer profiles on both sides, or use hardware/EVE-NG profiles on both sides.');
  if(!['ikev1','ikev2'].includes(vpnType)||pt&&vpnType!=='ikev1')return fail(pt?'Packet Tracer uses the explicitly labelled IKEv1 lab profile.':'Choose IPsec IKEv1 or IKEv2; GRE, VTI and remote-access VPNs need separate designs.');
  const parts=gatewayParts(values.internet_access);
  if(!parts.interfaces||!parts.nat||!parts.route||parts.firewall)return fail('Keep Router interfaces, NAT / PAT and IPv4 default route enabled. Stateful firewall is not part of this VPN preset.');
  const extra=Object.keys(selected).filter(id=>selected[id]&&!['internet_access','vpn','ntp_syslog','hardening'].includes(id));
  if(extra.length)return fail('Remove overlapping features: '+extra.join(', ')+'.');
  if(!vpnConfig)return fail('Enter the same pre-shared key on both sides in the VPN form.');
  for(const key of ['a','b']){
    const site=lab[key],config=vpnConfig[key],peer=lab[key==='a'?'b':'a'];
    if(!config||['vendor','ip','wan','lan','wanPrefix','gateway','local','lanIp'].some(field=>config[field]!==site[field])||config.remote!==peer.local)return fail('VPN addressing must match the shared topology on both sides.');
  }
  const config={...vpnConfig,protocol:vpnType,bindInterfaces:false};
  // PT has an explicit fixed lab suite, independent of the modern advanced form.
  if(pt)Object.assign(config,{encryption:'256',hash:'256',dh:'14',pfs:'14',lifetime1:'28800',lifetime2:'3600'});
  const vpn=generateVpn(config);
  if(vpn.errors.length)return fail(vpn.errors.join(' '));
  const site=lab[side],peer=lab[side==='a'?'b':'a'];
  const office=generateStandardOffice({site,selected:{...selected,vpn:false},values,natExemptNetwork:peer.local,packetTracer:pt});
  if(office.errors.length)return office;
  const tunnel=pt?packetTracerIpsec(site,peer,config[side].psk):vpn[side].replace('! Merge NAT exemption into the existing NAT ACL before any translation permits.','! Office VPN NAT exemption is included above.');
  return {errors:[],empty:false,code:office.code+'\n'+tunnel+'\n'};
}

function packetTracerIpsec(site,peer,key){
  const local=cidr(site.local),remote=cidr(peer.local);
  return `! Packet Tracer lab only: IKEv1 / AES-256 / SHA-1 / DH5 / PFS5.
! This legacy suite is not the hardware production default.
configure terminal
crypto isakmp policy 100
 encryption aes 256
 hash sha
 authentication pre-share
 group 5
 lifetime 28800
 exit
crypto isakmp key ${key} address ${peer.ip}
crypto ipsec transform-set NOC-ESP esp-aes 256 esp-sha-hmac
 exit
ip access-list extended NOC-CRYPTO
 permit ip ${local.ip} ${local.wildcard} ${remote.ip} ${remote.wildcard}
 exit
crypto map NOC-MAP 100 ipsec-isakmp
 set peer ${peer.ip}
 set transform-set NOC-ESP
 set pfs group5
 match address NOC-CRYPTO
 exit
interface ${site.wan}
 crypto map NOC-MAP
 exit
ip route ${remote.ip} ${remote.mask} ${site.gateway}
end
! Verify the security license and supported IPsec commands in your Packet Tracer image.
! Verify: show crypto isakmp sa; show crypto ipsec sa`;
}
