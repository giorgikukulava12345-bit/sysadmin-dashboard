import {cidr} from './address.js';
import {interfaceConfig} from './interfaces.js';
import {officeConfig} from './internet.js';
import {gatewayParts} from './gateway-parts.js';
import {leaseRanges} from './office-services.js';
import {generateFeature} from './features.js';
const text=n=>[24,16,8,0].map(b=>(n>>>b)&255).join('.');
export function generateMikrotikOffice({site,side,selected,values}){
 try{
  const d={...site,...values.internet_access,vendor:'mikrotik',routerOnly:true},parts=gatewayParts(d),n=cidr(site.local);
  const hostname=values.hardening?.hostname||(side==='b'?'R2':'R1');if(!/^[A-Za-z][A-Za-z0-9-]{0,62}$/.test(hostname))throw Error('Enter a valid router hostname.');
  const sections=[`/system identity set name=${hostname}`,'/system clock set time-zone-name=Asia/Tbilisi',interfaceConfig(site),officeConfig({...d,parts:{...parts,dhcp:false}})];
  if(parts.dhcp){
   const count=String(d.staticReserve??'100');if(!/^\d+$/.test(count)||+count>254)throw Error('Reserved addresses must be 0 to 254.');
   const reserved=[site.lanIp,...Array.from({length:Math.min(+count,n.end-n.network-1)},(_,i)=>text(n.network+i+1))];
   const ranges=leaseRanges(site.local,reserved),pool=d.poolName??'OFFICE-LAN';if(!/^[A-Za-z][A-Za-z0-9_-]{0,30}$/.test(pool))throw Error('Enter a valid DHCP pool name.');
   sections.push(`/ip pool add name=${pool} ranges=${ranges.map(p=>p.join('-')).join(',')}\n/ip dhcp-server add name=${pool} interface=${site.lan} address-pool=${pool} lease-time=1d disabled=no\n/ip dhcp-server network add address=${site.local} gateway=${site.lanIp}${parts.dns?` dns-server=${d.dns1??'8.8.8.8'},${d.dns2??'1.1.1.1'}`:''}`);
  }
  for(const id of ['ntp_syslog','hardening'])if(selected[id]){const result=generateFeature(id,{...values[id],vendor:'mikrotik'});if(result.errors.length)throw Error(result.errors.join(' '));sections.push(...result.scripts.map(s=>s.code));}
  return {errors:[],code:sections.join('\n')+'\n',empty:false};
 }catch(error){return {errors:['MikroTik Office VPN: '+error.message],code:'',empty:false};}
}
