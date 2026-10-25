import { ipv4 } from './address.js';
import { capable } from './features.js';

export function suggestGateway(value){
  const ip=ipv4(value);if(ip===null)return '';
  const offset=ip%4;if(offset!==1&&offset!==2)return '';
  const peer=ip+(offset===1?1:-1);return [24,16,8,0].map(n=>(peer>>>n)&255).join('.');
}
export const baselineFeatures=vendor=>Object.fromEntries(['hardening','ntp_syslog'].filter(id=>capable(id,vendor)).map(id=>[id,true]));
export function toggleFeature(selected,id,enabled,vendor){
  const next={...selected,[id]:enabled};
  if(enabled&&id==='glbp')next.fhrp=false;
  if(enabled&&id==='fhrp')next.glbp=false;
  if(enabled&&id==='dhcp')next.relay=false;
  if(enabled&&id==='relay'){next.dhcp=false;next.internet_access=false;}
  if(id==='wan_failover'&&vendor==='ios')next.ipsla=enabled;
  if(id==='ipsla'&&!enabled&&vendor==='ios')next.wan_failover=false;
  return next;
}
export function vpnAvailable(type,a,b){
  if(type==='vti')return a==='ios'&&b==='ios';
  if(type==='wireguard')return a==='mikrotik'&&b==='mikrotik';
  if(type==='gre')return [a,b].every(v=>['ios','mikrotik','fortinet'].includes(v));
  if(type==='ikev1')return a!=='asa'&&b!=='asa';
  return type==='ikev2';
}
