import {cidr} from './address.js';
import {gatewayParts} from './gateway-parts.js';
import {validateInternet,internetRoutes} from './internet.js';
import {officeServices,leaseRanges} from './office-services.js';
import {featureDefaults,generateFeature} from './features.js';
const text=n=>[24,16,8,0].map(b=>(n>>>b)&255).join('.');
const id=(value,label)=>{if(!/^\d+$/.test(String(value))||+value<1||+value>4294967294)throw Error(label+' must be a positive available ID.');return value;};
/** FortiGate policy NAT applies only to LAN -> WAN; VPN interface policies never NAT. */
export function generateFortigateOffice({site,side,selected,values}){
 try{
  const d={...featureDefaults('internet_access','fortinet'),...values.internet_access,...site,vendor:'fortinet',routerOnly:true},parts=gatewayParts(d);
  validateInternet(d);const wan=cidr(`${site.ip}/${site.wanPrefix}`),lan=cidr(site.local),hostname=values.hardening?.hostname||(side==='b'?'R2':'R1');
  if(!/^[A-Za-z][A-Za-z0-9-]{0,62}$/.test(hostname))throw Error('Enter a valid router hostname.');
  const sections=[`config system global\n set hostname "${hostname}"\nend`];
  if(parts.interfaces)sections.push(`config system interface\n edit "${site.wan}"\n  set status up\n  set mode static\n  set ip ${site.ip} ${wan.mask}\n next\n edit "${site.lan}"\n  set status up\n  set mode static\n  set ip ${site.lanIp} ${lan.mask}\n next\nend`);
  sections.push(officeServices({...d,parts:{...parts,dhcp:false}}));
  if(parts.dhcp){
   const count=String(d.staticReserve??'100');if(!/^\d+$/.test(count)||+count>254)throw Error('Reserved addresses must be 0 to 254.');
   const ranges=leaseRanges(site.local,[site.lanIp,...Array.from({length:Math.min(+count,lan.end-lan.network-1)},(_,i)=>text(lan.network+i+1))]);
   sections.push(`config system dhcp server\n edit ${id(d.dhcpId,'DHCP server ID')}\n  set status enable\n  set interface "${site.lan}"\n  set default-gateway ${site.lanIp}\n  set netmask ${lan.mask}\n${parts.dns?`  set dns-service specify\n  set dns-server1 ${d.dns1}\n  set dns-server2 ${d.dns2}\n`:'  set dns-service default\n'}  config ip-range\n${ranges.map((r,i)=>`   edit ${i+1}\n    set start-ip ${r[0]}\n    set end-ip ${r[1]}\n   next`).join('\n')}\n  end\n next\nend`);
  }
  if(parts.nat)sections.push(`config firewall address\n edit "NOC-OFFICE-LAN1"\n  set subnet ${lan.ip} ${lan.mask}\n next\nend\nconfig firewall policy\n edit ${id(d.policyId,'Internet policy ID')}\n  set name "NOC-OFFICE-INTERNET"\n  set status enable\n  set srcintf "${site.lan}"\n  set dstintf "${site.wan}"\n  set srcaddr "NOC-OFFICE-LAN1"\n  set dstaddr "all"\n  set action accept\n  set schedule "always"\n  set service "ALL"\n  set nat enable\n  set logtraffic all\n next\nend`);
  if(parts.route)sections.push(internetRoutes(d,false));
  for(const feature of ['ntp_syslog','hardening'])if(selected[feature]){const result=generateFeature(feature,{...values[feature],vendor:'fortinet'});if(result.errors.length)throw Error(result.errors.join(' '));sections.push(...result.scripts.map(s=>s.code));}
  return {errors:[],code:sections.filter(Boolean).join('\n')+'\n',empty:false};
 }catch(error){return {errors:['FortiGate Office VPN: '+error.message],code:'',empty:false};}
}
