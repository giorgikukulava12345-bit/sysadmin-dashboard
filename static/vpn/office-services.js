import { gatewayParts } from './gateway-parts.js';
import {cidr,ipv4} from './address.js';
const text=n=>[24,16,8,0].map(b=>(n>>>b)&255).join('.');
export function officeNetworks(d){
  return [{id:d.vlan,network:d.local,gateway:d.lanIp,reserved:[d.lanIp,d.switchIp,d.hostIp],port:d.lan},...(d.vlan2Enabled==='on'?[{id:d.vlan2,network:d.vlan2Subnet,gateway:d.vlan2Gateway,reserved:[d.vlan2Gateway,d.vlan2SwitchIp],port:`${d.physicalLan}.${d.vlan2}`}]:[])];
}
/** Split ranges around actual static assignments, without enumerating host addresses. */
export function leaseRanges(network,reserved){
  const n=cidr(network);if(!n||n.canonical!==network||n.end-n.network<3)throw Error('DHCP requires a canonical subnet with usable client addresses.');
  const excluded=[...new Set(reserved.filter(Boolean).map(ipv4))].sort((a,b)=>a-b);
  if(excluded.some(ip=>ip===null||ip<=n.network||ip>=n.end))throw Error('Reserved DHCP addresses must be usable hosts in their LAN subnet.');
  let start=n.network+1;const ranges=[];for(const ip of excluded){if(start<ip)ranges.push([text(start),text(ip-1)]);start=ip+1;}if(start<n.end)ranges.push([text(start),text(n.end-1)]);
  if(!ranges.length)throw Error('No DHCP lease addresses remain after excluding static assignments.');return ranges;
}
export function officeServices(d){
  const parts=gatewayParts(d),dnsOn=parts.dns;const dns=[d.dns1??'8.8.8.8',d.dns2??'1.1.1.1'];
  if(dnsOn&&dns.some(v=>ipv4(v)===null||ipv4(v)<16777216||(ipv4(v)>>>24)===127||ipv4(v)>=0xe0000000))throw Error('DNS servers must be valid unicast IPv4 addresses.');
  const resolver=!dnsOn?'':d.vendor==='ios'?`ip name-server ${dns.join(' ')}`:d.vendor==='mikrotik'?`/ip dns set servers=${dns.join(',')} allow-remote-requests=no`:d.vendor==='fortinet'?`config system dns\n set primary ${dns[0]}\n set secondary ${dns[1]}\nend`:d.vendor==='juniper'?dns.map(ip=>`set system name-server ${ip}`).join('\n'):`set deviceconfig system dns-setting servers primary ${dns[0]}\nset deviceconfig system dns-setting servers secondary ${dns[1]}`;
  if(!parts.dhcp)return resolver;
  const base=d.poolName??'OFFICE-LAN';if(!/^[A-Za-z][A-Za-z0-9_-]{0,30}$/.test(base))throw Error('DHCP pool name must be a CLI-safe identifier (maximum 31 characters).');
  const rows=officeNetworks(d).map(row=>({...row,n:cidr(row.network),ranges:leaseRanges(row.network,row.reserved),name:base+(d.vlan2Enabled==='on'?`-V${row.id}`:'')}));
  if(d.vendor==='ios')return `${resolver}\nservice dhcp\n`+rows.map(r=>`${[...new Set(r.reserved.filter(Boolean))].map(ip=>`ip dhcp excluded-address ${ip}`).join('\n')}\nip dhcp pool ${r.name}\n network ${r.n.ip} ${r.n.mask}\n default-router ${r.gateway}${dnsOn?`\n dns-server ${dns.join(' ')}`:''}\n exit`).join('\n');
  if(d.vendor==='mikrotik')return `${resolver}\n`+rows.map(r=>`/ip pool add name=${r.name} ranges=${r.ranges.map(p=>p.join('-')).join(',')}\n/ip dhcp-server add name=${r.name} interface=${r.port} address-pool=${r.name} lease-time=1d disabled=no\n/ip dhcp-server network add address=${r.network} gateway=${r.gateway}${dnsOn?` dns-server=${dns.join(',')}`:''}`).join('\n');
  if(d.vendor==='fortinet'){
    const id=String(d.dhcpId??'9000');if(!/^\d+$/.test(id)||+id<1||+id+rows.length>4294967295)throw Error('DHCP server ID must be an available positive integer.');
    return `${resolver}\nconfig system dhcp server\n`+rows.map((r,i)=>` edit ${+id+i}\n  set status enable\n  set interface "${r.port}"\n  set default-gateway ${r.gateway}\n  set netmask ${r.n.mask}\n${dnsOn?`  set dns-service specify\n  set dns-server1 ${dns[0]}\n  set dns-server2 ${dns[1]}\n`:'  set dns-service default\n'}  config ip-range\n${r.ranges.map((p,j)=>`   edit ${j+1}\n    set start-ip ${p[0]}\n    set end-ip ${p[1]}\n   next`).join('\n')}\n  end\n next`).join('\n')+'\nend';
  }
  if(d.vendor==='juniper')return resolver+'\n'+rows.map(r=>`set system services dhcp-local-server group ${base} interface ${r.port}${d.officeVlans?'':'.0'}\nset security zones security-zone ${d.trustZone} interfaces ${r.port}${d.officeVlans?'':'.0'} host-inbound-traffic system-services dhcp\nset access address-assignment pool ${r.name} family inet network ${r.network}\n${r.ranges.map((p,j)=>`set access address-assignment pool ${r.name} family inet range CLIENTS${j+1} low ${p[0]}\nset access address-assignment pool ${r.name} family inet range CLIENTS${j+1} high ${p[1]}`).join('\n')}\nset access address-assignment pool ${r.name} family inet dhcp-attributes router ${r.gateway}${dnsOn?`\nset access address-assignment pool ${r.name} family inet dhcp-attributes name-server [ ${dns.join(' ')} ]`:''}`).join('\n');
  if(d.vendor==='paloalto')return `${resolver}\n`+rows.map(r=>`set network dhcp interface ${r.port} server mode enabled\nset network dhcp interface ${r.port} server ip-pool [ ${r.ranges.map(p=>p.join('-')).join(' ')} ]\nset network dhcp interface ${r.port} server option gateway ${r.gateway}\nset network dhcp interface ${r.port} server option subnet-mask ${r.n.mask}${dnsOn?`\nset network dhcp interface ${r.port} server option dns primary ${dns[0]}\nset network dhcp interface ${r.port} server option dns secondary ${dns[1]}`:''}`).join('\n');
  throw Error('No DHCP/DNS template for the selected platform.');
}
