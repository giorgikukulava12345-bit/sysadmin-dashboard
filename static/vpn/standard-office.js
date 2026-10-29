import {isCiscoPhysical} from './port-options.js';
import {cidr, ipv4, unicastNetwork} from './address.js';
import {generateTool} from './catalog.js';
import {gatewayParts} from './gateway-parts.js';
import {officeConfig, validateInternet} from './internet.js';

const ipText=n=>[24,16,8,0].map(b=>(n>>>b)&255).join('.');
const identifier=(value,label)=>{
  if(!/^[A-Za-z][A-Za-z0-9_-]{0,30}$/.test(value||''))throw Error(`${label}: use a letter followed by up to 30 letters, digits, _ or -.`);
  return value;
};
const integer=(value,min,max,label)=>{
  if(!/^-?\d+$/.test(String(value))||+value<min||+value>max)throw Error(`${label}: use an integer from ${min} to ${max}.`);
  return Number(value);
};
const unicast=(value,label)=>{
  const n=ipv4(value);
  if(n===null||n<16777216||(n>>>24)===127||n>=0xe0000000)throw Error(`${label}: enter a unicast IPv4 address.`);
  return value;
};

/** Atomic, ordered IOS output for the Quick Setup preset. No stored/default credentials. */
export function generateStandardOffice({site,selected,values}){
  try{return {errors:[],code:build(site,selected,values),empty:false};}
  catch(error){return {errors:[`Standard Office: ${error.message}`],code:'',empty:false};}
}

function build(s,selected,values){
  const d={...s,...values.internet_access,vendor:'ios'},parts=gatewayParts(d);
  const extra=Object.keys(selected).filter(id=>selected[id]&&!['internet_access','hardening','ntp_syslog'].includes(id));
  if(extra.length)throw Error('This complete Cisco Office preset owns interfaces, NAT and management. Generate additional features separately; Dual ISP needs egress-aware NAT design.');
  validateInternet(d);
  const mode=d.iosLanMode??'subinterfaces';
  if(!['svi','subinterfaces'].includes(mode))throw Error('Choose SVI or router-on-a-stick LAN mode.');
  if(!isCiscoPhysical(s.lan))throw Error('LAN binding must be a physical Cisco Ethernet interface.');
  const dual=s.vlan2Enabled==='on';
  const rows=[{id:s.vlan,network:s.local,gateway:s.lanIp,reserved:s.routerOnly?[s.lanIp]:[s.lanIp,s.switchIp,s.hostIp],name:d.usersPool??'USERS',description:'USERS'},...(dual?[{id:s.vlan2,network:s.vlan2Subnet,gateway:s.vlan2Gateway,reserved:[s.vlan2Gateway,s.vlan2SwitchIp],name:d.itPool??'IT',description:'IT_INTERNAL'}]:[])].map(r=>({...r,n:cidr(r.network),port:mode==='svi'?`Vlan${r.id}`:dual?`${s.lan}.${r.id}`:s.lan}));
  for(const r of rows){
    if(!r.n||r.n.canonical!==r.network||!unicastNetwork(r.n))throw Error('Office LANs require canonical unicast IPv4 networks.');
    identifier(r.name,'DHCP pool name');
  }
  if(new Set(rows.map(r=>r.name)).size!==rows.length)throw Error('USERS and IT DHCP pool names must differ.');
  const h=values.hardening||{},hostname=h.hostname||'R1',domain=h.domain||'cisco.com';
  if(!/^[A-Za-z][A-Za-z0-9-]{0,62}$/.test(hostname))throw Error('Hostname: use a valid IOS hostname.');
  if(!/^(?=.{3,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(domain))throw Error('Enter a valid domain name.');
  const timezone=identifier(d.timezoneName??'GET','Timezone name');
  const hours=integer(d.timezoneHours??'4',-23,23,'Timezone hours'),minutes=integer(d.timezoneMinutes??'0',0,59,'Timezone minutes');
  const sections=[`hostname ${hostname}\nip routing\nip cef\nno ip domain lookup\nip domain name ${domain}\nclock timezone ${timezone} ${hours} ${minutes}\nservice timestamps log datetime msec localtime show-timezone`];
  if(selected.ntp_syslog){
    const clock=values.ntp_syslog||{};
    sections[0]+=`\nntp server ${unicast(clock.ntp,'NTP server')} prefer`;
  }
  const dns=[d.dns1??'8.8.8.8',d.dns2??'1.1.1.1'].map(value=>parts.dns?unicast(value,'DNS server'):value);
  if(parts.dns)sections[0]+=`\nip name-server ${[...new Set(dns)].join(' ')}`;
  if(parts.dhcp){
    const reserve=integer(d.staticReserve??'100',0,254,'Reserved addresses at start of each subnet');
    const excluded=rows.map(r=>exclusions(r,reserve));
    sections.push('service dhcp\n'+excluded.flatMap(r=>r.commands).join('\n')+'\n'+rows.map(r=>`ip dhcp pool ${r.name}\n network ${r.n.ip} ${r.n.mask}\n default-router ${r.gateway}${parts.dns?`\n dns-server ${[...new Set(dns)].join(' ')}`:''}\n lease 7\n exit`).join('\n'));
  }
  if(selected.hardening){
    // Reuse the established credential and RSA validation, then emit scrypt commands.
    const checked=generateTool('hardening',{...h,vendor:'ios'});
    if(checked.errors.length)throw Error(checked.errors.join(' '));
    const sources=new Map(rows.map(r=>[r.n.canonical,r.n]));
    for(const line of String(d.managementSources??'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean)){
      const n=cidr(line.includes('/')?line:`${line}/32`);
      if(!n||n.canonical!==(line.includes('/')?line:`${line}/32`)||!unicastNetwork(n))throw Error('Additional SSH sources must be canonical unicast CIDRs or individual IPv4 hosts.');
      sources.set(n.canonical,n);
    }
    sections.push(`! IOS hashes entered secrets using type 9 scrypt. Requires supported IOS software.\nenable algorithm-type scrypt secret ${h.enableSecret}\nusername ${h.username} privilege 15 algorithm-type scrypt secret ${h.secret}\naaa new-model\naaa authentication login OFFICE-LOCAL local\naaa authorization exec OFFICE-LOCAL local\nip access-list extended SSH_NEW\n${[...sources.values()].map(n=>` permit tcp ${n.ip} ${n.wildcard} any eq 22`).join('\n')}\n deny tcp any any eq 22 log\n deny ip any any\n exit\ncrypto key generate rsa general-keys modulus ${h.rsa}\nip ssh version 2\nip ssh time-out 60\nip ssh authentication-retries 3\nno ip http server\nno ip http secure-server\n${['0 4','5 15'].map(range=>`line vty ${range}\n access-class SSH_NEW in\n login authentication OFFICE-LOCAL\n authorization exec OFFICE-LOCAL\n transport input ssh\n exec-timeout 10 0\n exit`).join('\n')}`);
  }
  if(parts.interfaces){
    const wan=cidr(`${s.ip}/${s.wanPrefix}`);
    let interfaces=`interface ${s.wan}\n description WAN_TO_ISP\n ip address ${s.ip} ${wan.mask}${parts.nat?'\n ip nat outside':''}\n ip virtual-reassembly in\n no shutdown\n exit\n`;
    if(mode==='svi')interfaces+=`! SVI mode requires a router with integrated Layer 2 switch ports.\n${rows.map(r=>`vlan ${r.id}\n name ${r.description}\n exit`).join('\n')}\ninterface ${s.lan}\n description LAN_TO_LAYER2_SWITCH\n${dual?` switchport mode trunk\n switchport trunk native vlan 1\n switchport trunk allowed vlan ${rows.map(r=>r.id).join(',')}`:` switchport mode access\n switchport access vlan ${s.vlan}`}\n no shutdown\n exit\n`;
    else if(dual)interfaces+=`interface ${s.lan}\n description DOT1Q_TRUNK_TO_LAYER2_SWITCH\n no ip address\n no shutdown\n exit\n`;
    interfaces+=rows.map(r=>`interface ${r.port}\n description ${r.description}_DEFAULT_GATEWAY${mode==='subinterfaces'&&dual?`\n encapsulation dot1Q ${r.id}`:''}\n ip address ${r.gateway} ${r.n.mask}${parts.nat?'\n ip nat inside':''}\n ip virtual-reassembly in\n no shutdown\n exit`).join('\n');
    sections.push(interfaces);
  }else if(parts.nat){
    sections.push([...rows.map(r=>`interface ${r.port}\n ip nat inside\n ip virtual-reassembly in\n exit`),`interface ${s.wan}\n ip nat outside\n ip virtual-reassembly in\n exit`].join('\n'));
  }
  if(parts.nat)sections.push(rows.map((r,i)=>`ip access-list extended ${i?'NAT112':'NAT'}\n permit ip ${r.n.ip} ${r.n.wildcard} any\n exit\nip nat inside source list ${i?'NAT112':'NAT'} interface ${s.wan} overload`).join('\n'));
  if(parts.firewall){
    // Keep the existing stateful policy, with its interface list bound to this mode.
    const firewall=officeConfig({...d,physicalLan:s.lan,standardOffice:true,iosLanMode:mode,parts:{interfaces:false,nat:false,route:false,firewall:true,dhcp:false,dns:false}});
    sections.push(firewall.trim().replace(/^configure terminal\n/,'').replace(/\nend$/,''));
  }
  if(parts.route)sections.push(`ip route 0.0.0.0 0.0.0.0 ${s.gateway}`);
  return `configure terminal\n${sections.join('\n!\n')}\nend\n`;
}

function exclusions(row,count){
  const n=row.n,intervals=count?[[n.network+1,Math.min(n.network+count,n.end-1)]]:[];
  for(const value of row.reserved.filter(Boolean)){
    const ip=ipv4(value);
    if(ip===null||ip<=n.network||ip>=n.end)throw Error('DHCP static reservations must be usable hosts in their LAN.');
    intervals.push([ip,ip]);
  }
  const merged=[];
  for(const range of intervals.sort((a,b)=>a[0]-b[0])){
    const previous=merged[merged.length-1];
    if(previous&&range[0]<=previous[1]+1)previous[1]=Math.max(previous[1],range[1]);
    else merged.push([...range]);
  }
  if(merged.reduce((sum,[a,b])=>sum+b-a+1,0)>=n.end-n.network-1)throw Error('No DHCP client addresses remain; reduce the reserved address count.');
  return {commands:merged.map(([a,b])=>`ip dhcp excluded-address ${ipText(a)}${a===b?'':' '+ipText(b)}`)};
}
