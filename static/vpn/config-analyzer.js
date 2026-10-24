import {cidr,ipv4} from './address.js';
const dotted=n=>[24,16,8,0].map(b=>(n>>>b)&255).join('.');
export function networkFromMask(ip,mask){
  const m=ipv4(mask);if(ipv4(ip)===null||m===null)return null;
  const bits=m.toString(2).padStart(32,'0');if(!/^1*0*$/.test(bits))return null;
  return cidr(`${ip}/${bits.indexOf('0')<0?32:bits.indexOf('0')}`);
}
const unicast=ip=>{const n=ipv4(ip);return n!==null&&n>=0x01000000&&n<0xe0000000&&(n>>>24)!==127;};
function routeTail(value){
  const tokens=value.trim().split(/\s+/),rest=[...tokens];
  const physical=/^(?:Gi(?:gabitEthernet)?|Fa(?:stEthernet)?|Te(?:nGigabitEthernet)?|Ethernet|Tunnel|Loopback|Port-channel|Null|Vlan|Serial|Dialer|BDI)\d+(?:[/.:-]\d+)*$/i;
  if(physical.test(rest[0]||''))rest.shift();
  else if(!unicast(rest[0]))return '';
  if(unicast(rest[0]))rest.shift();
  if(/^\d+$/.test(rest[0]||'')&&+rest[0]>=1&&+rest[0]<=255)rest.shift();
  if(rest[0]==='track'&&/^\d+$/.test(rest[1]||'')&&+rest[1]>=1&&+rest[1]<=1000)rest.splice(0,2);
  if(rest[0]==='permanent')rest.shift();
  return rest.length?'':tokens.join(' ');
}
/** Evaluate standard ACL first-match order over the entire usable subnet, not just endpoints. */
function coversSubnet(entries,n){
  let pending=[[n.network+1,n.end-1]],denied=false;
  for(const line of entries){
    const m=line.match(/^(permit|deny) (any|host \S+|\S+(?: \S+)?)(?: log)?$/);if(!m)return null;
    let lo=0,hi=0xffffffff;
    if(m[2]!=='any'){
      const [first,second]=m[2].split(' '),host=first==='host',address=ipv4(host?second:first),wild=host?0:ipv4(second||'0.0.0.0');
      if(address===null||wild===null||!Number.isInteger(Math.log2(wild+1)))return null;
      lo=Math.floor(address/(wild+1))*(wild+1);hi=lo+wild;
    }
    const remaining=[];
    for(const [a,b]of pending){const start=Math.max(a,lo),end=Math.min(b,hi);if(start>end){remaining.push([a,b]);continue;}if(m[1]==='deny')denied=true;if(a<start)remaining.push([a,start-1]);if(end<b)remaining.push([end+1,b]);}
    pending=remaining;if(!pending.length)break;
  }
  return !denied&&!pending.length;
}
/** Evidence-based IOS checks, not a firmware parser or a reachability test. */
export function analyzeConfig(source,{complete=false}={}){
  if(typeof source!=='string'||!source.trim())throw Error('Paste a running configuration or CLI snippet first.');
  if(source.length>200000||source.split('\n').length>5000)throw Error('Use at most 200,000 characters / 5,000 lines per analysis.');
  const findings=[],interfaces=[],pools=[],routes=[],nat=[],acls=new Map(),vlans=new Set(),globalDns=[];
  const add=(id,severity,line,title,detail,steps,repair='')=>{if(findings.length<200)findings.push({id,severity,line,title,detail,steps,repair});};
  if(/^\s*(?:set (?:interfaces|network|system|security)|config (?:system|router|firewall|vpn)|\/(?:ip|interface|routing|system)\b)/m.test(source))return {findings:[{id:'platform',severity:'info',line:0,title:'Platform outside this analyzer',detail:'Deep configuration analysis currently supports Cisco IOS / IOS XE. Use the vendor-specific diagnostic playbooks below for RouterOS, FortiOS, Junos or PAN-OS.',steps:['Select the matching vendor in the diagnostic playbook.'],repair:''}],commands:'',interfaces:0,pools:0};
  let context=null;
  const lines=source.replace(/\r/g,'').split('\n');
  for(let i=0;i<lines.length;i++){
    const raw=lines[i],s=raw.trim(),line=i+1;let m;
    if(!s)continue;if(s==='!'){context=null;continue;}
    if((m=s.match(/^interface ([A-Za-z][A-Za-z0-9./:-]{0,60})$/))){context=interfaces.find(p=>p.name===m[1]);if(!context){context={kind:'interface',name:m[1],line};interfaces.push(context);}continue;}
    if((m=s.match(/^ip dhcp pool ([\w.-]+)$/))){context=pools.find(p=>p.name===m[1]);if(!context){context={kind:'pool',name:m[1],line};pools.push(context);}continue;}
    if((m=s.match(/^ip access-list (standard|extended) ([\w.-]+)$/))){context=acls.get(m[2])||{kind:'acl',name:m[2],type:m[1],entries:[],line};acls.set(m[2],context);continue;}
    if((m=s.match(/^access-list (\d+) (.+)$/))){const num=+m[1],standard=num>=1&&num<=99||num>=1300&&num<=1999;const a=acls.get(m[1])||{name:m[1],type:standard?'standard':'extended',entries:[],line};a.entries.push(m[2]);acls.set(m[1],a);context=null;continue;}
    if((m=s.match(/^vlan (\d+)$/))){vlans.add(m[1]);context={kind:'vlan'};continue;}
    if(s==='exit'||s==='end'){context=null;continue;}
    if((m=s.match(/^ip name-server (.+)$/))){globalDns.push(...m[1].split(/\s+/).filter(x=>ipv4(x)!==null));context=null;continue;}
    if((m=s.match(/^ip route (\S+) (\S+) (.+)$/))){routes.push({ip:m[1],mask:m[2],next:m[3],line});context=null;continue;}
    if((m=s.match(/^ip nat inside source (list|route-map) (\S+) interface (\S+) overload$/))){nat.push({kind:m[1],acl:m[2],port:m[3],line});context=null;continue;}
    if(context?.kind==='interface'){
      if((m=s.match(/^ip address (\S+) (\S+)(?: secondary)?$/))){context.ip=m[1];context.mask=m[2];context.addressLine=line;}
      if(s==='ip nat inside')context.inside=true;if(s==='ip nat outside')context.outside=true;
      if(s==='shutdown')context.shutdown=true;if(s==='no shutdown')context.shutdown=false;
      if((m=s.match(/^encapsulation dot1Q (\d+)/i)))context.tag=m[1];
      if((m=s.match(/^switchport access vlan (\d+)$/)))context.access=m[1];
    }
    if(context?.kind==='pool'){
      if((m=s.match(/^network (\S+) (\S+)$/))){context.ip=m[1];context.mask=m[2];}
      if((m=s.match(/^default-router (.+)$/)))context.gateways=m[1].split(/\s+/);
      if((m=s.match(/^dns-server (.+)$/)))context.dns=m[1].split(/\s+/);
    }
    if(context?.kind==='acl'&&/^(?:\d+ )?(?:permit|deny) /.test(s))context.entries.push(s.replace(/^\d+ /,''));
    if(/^ip (?:adress|rote|name-sever)\b/.test(s))add('typo','warning',line,'Possible IOS command typo','A recognized command keyword appears misspelled.',['Compare against ip address, ip route or ip name-server; confirm the intended command in device help.']);
    if(!/^\s/.test(raw)&&!/^(?:ip (?:address|nat (?:inside|outside)$)|network |default-router |dns-server |description |(?:no )?shutdown$|encapsulation |switchport |(?:\d+ )?(?:permit|deny) )/.test(s))context=null;
  }
  const valid=[];
  for(const p of interfaces){
    if(p.ip){const n=networkFromMask(p.ip,p.mask);p.n=n;
      if(!n)add('interface-ip','error',p.addressLine,'Invalid interface address or subnet mask',`${p.name}: address must be IPv4 and mask must be contiguous.`,['Check assigned addressing and correct the interface address/mask.']);
      else{const v=ipv4(p.ip),prefix=+n.canonical.split('/')[1];valid.push(p);if(prefix<=30&&(v===n.network||v===n.end))add('host-address','error',p.addressLine,'Network or broadcast assigned to an interface',`${p.name}: ${p.ip} is not a usable host in ${n.canonical}.`,['Choose an assigned usable host address; do not guess the replacement.']);}
    }
    if(p.inside&&p.outside)add('nat-role','error',p.line,'Conflicting NAT interface roles',`${p.name} is marked both inside and outside.`,['Confirm the LAN/WAN boundary and remove the incorrect role.']);
    if(p.shutdown&&(p.ip||p.tag))add('shutdown','warning',p.line,'Configured interface is administratively down',`${p.name} has addressing or VLAN encapsulation but is shut down.`,['Run show interfaces '+p.name+'.','Confirm this is intentional before enabling the link.']);
    if(complete&&p.access&&!vlans.has(p.access))add('missing-vlan','warning',p.line,'Access VLAN not present in the supplied configuration',`${p.name} uses VLAN ${p.access}. VLANs may instead be learned through VTP.`,['Check show vlan brief and VTP mode.','Create the VLAN locally only if this switch owns VLAN provisioning.'],`configure terminal\nvlan ${p.access}\n exit\nend`);
  }
  overlapPairs: for(let i=0;i<valid.length;i++)for(let j=i+1;j<valid.length;j++){if(findings.length>=200)break overlapPairs;const a=valid[i],b=valid[j];if(a.n.network<=b.n.end&&b.n.network<=a.n.end)add('overlap','warning',b.line,'Overlapping connected interface networks',`${a.name} (${a.n.canonical}) overlaps ${b.name} (${b.n.canonical}).`,['Check VRF membership and secondary addressing.','In the same VRF, use distinct routed subnets or the intended bridge design.']);}
  for(const r of routes){const tail=routeTail(r.next);if(!tail)add('route-tail','warning',r.line,'Route next-hop or options require manual validation','The route tail is invalid or outside the supported basic IOS route grammar. No corrected command is constructed from it.',['Validate the next-hop/interface and any advanced route options with IOS context help.']);const n=networkFromMask(r.ip,r.mask);if(!n)add('route-mask','error',r.line,'Invalid static route destination/mask','Static routes require a valid IPv4 destination and contiguous subnet mask.',['Verify the intended prefix in the routing design.']);else if(r.ip!==n.ip)add('route-network','error',r.line,'Static route is not network-aligned',`${r.ip} with mask ${r.mask} belongs to ${n.canonical}.`,['Confirm this is the intended destination network.','Remove the invalid statement if present and install the aligned prefix.'],tail&&!valid.some(p=>r.next.split(/\s+/).includes(p.ip))?`configure terminal\nip route ${n.ip} ${r.mask} ${tail}\nend`:'');
    const next=r.next.split(/\s+/).find(x=>ipv4(x)!==null);if(next&&valid.some(p=>p.ip===next))add('self-route','error',r.line,'Static route points to this device',`Next hop ${next} is assigned to a local interface.`,['Find the actual adjacent router with show arp and show ip route.','Replace the next hop with the assigned peer address.']);
    else if(next&&complete&&!valid.some(p=>ipv4(next)>=p.n.network&&ipv4(next)<=p.n.end))add('recursive-route','info',r.line,'Next hop requires recursive resolution',`${next} is outside the parsed connected networks.`,['Run show ip route '+next+'.','Confirm a learned or recursive route resolves to a live egress interface.']);
  }
  const exclusions=[];for(const [i,s]of lines.entries()){const m=s.trim().match(/^ip dhcp excluded-address (\S+)(?: (\S+))?$/);if(m){const a=ipv4(m[1]),b=ipv4(m[2]||m[1]);if(a===null||b===null||a>b)add('exclusion','error',i+1,'Invalid DHCP exclusion range','Exclusion endpoints must be ordered IPv4 addresses.',['Correct the start and end addresses.']);else exclusions.push([a,b]);}}
  for(const pool of pools){const n=networkFromMask(pool.ip,pool.mask);if(!n){add('pool-network','error',pool.line,'DHCP pool network missing or invalid',`${pool.name} needs a network and contiguous subnet mask.`,['Confirm the LAN prefix before adding the pool network statement.']);continue;}
    if(pool.ip!==n.ip)add('pool-alignment','error',pool.line,'DHCP network is not aligned',`${pool.name} should reference ${n.canonical}.`,['Use the network address for the pool.'],`configure terminal\nip dhcp pool ${pool.name}\n network ${n.ip} ${pool.mask}\n exit\nend`);
    if(!pool.gateways?.length){const gateway=valid.filter(p=>p.n.canonical===n.canonical);add('pool-gateway','warning',pool.line,'DHCP default router missing',`${pool.name}: clients may receive addresses without a default route.`,['Confirm the intended gateway, including any HSRP/VRRP virtual IP.'],gateway.length===1?`configure terminal\nip dhcp pool ${pool.name}\n default-router ${gateway[0].ip}\n exit\nend`:'');}
    for(const g of pool.gateways||[])if(ipv4(g)===null||ipv4(g)<=n.network||ipv4(g)>=n.end)add('gateway-subnet','error',pool.line,'DHCP gateway outside usable pool subnet',`${pool.name}: ${g} is not a usable host in ${n.canonical}.`,['Compare the pool default-router against the actual LAN gateway.']);
    if(!pool.dns?.length)add('pool-dns','warning',pool.line,'DHCP DNS option missing',`${pool.name} does not advertise DNS servers.`,['Confirm approved resolvers and add the dns-server option.'],globalDns.length?`configure terminal\nip dhcp pool ${pool.name}\n dns-server ${globalDns.join(' ')}\n exit\nend`:'');
    if(pool.dns?.some(ip=>!unicast(ip)))add('pool-dns-invalid','error',pool.line,'DHCP DNS option contains an invalid resolver',`${pool.name}: DNS servers must be unicast IPv4 addresses.`,['Verify the approved resolver addresses and replace the invalid DHCP DNS option.']);
    const reserved=[...new Set([...valid.filter(p=>p.n.canonical===n.canonical).map(p=>p.ip),...(pool.gateways||[]).filter(g=>ipv4(g)>n.network&&ipv4(g)<n.end)])].filter(ip=>!exclusions.some(([a,b])=>ipv4(ip)>=a&&ipv4(ip)<=b));
    if(reserved.length)add('pool-exclusions','warning',pool.line,'Gateway or local management address can be leased',`${pool.name}: ${reserved.join(', ')} are not explicitly excluded in the supplied configuration. Other devices' management addresses cannot be inferred.`,['Check existing bindings and conflicts.','Exclude the known static addresses.'],`configure terminal\n${reserved.map(ip=>'ip dhcp excluded-address '+ip).join('\n')}\nend`);
  }
  for(const rule of nat){if(!interfaces.find(p=>p.name===rule.port)?.outside)add('nat-outside','warning',rule.line,'PAT egress missing outside binding',`${rule.port} has no parsed ip nat outside statement.`,['Confirm the WAN interface and existing NAT design.'],complete&&interfaces.some(p=>p.name===rule.port)?`configure terminal\ninterface ${rule.port}\n ip nat outside\n exit\nend`:'');
    if(rule.kind==='list'&&!acls.has(rule.acl))add('nat-acl','warning',rule.line,'NAT references an ACL not found in the input',`ACL ${rule.acl} is referenced by PAT.`,['Run show access-lists '+rule.acl+'.','Define permits for the actual LAN prefixes; translation ACLs do not replace firewall policy.']);
    if(rule.kind==='route-map'&&!new RegExp('^route-map '+rule.acl.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' permit','m').test(source))add('nat-map','warning',rule.line,'NAT route-map definition missing',`${rule.acl} is referenced but no permit clause was found.`,['Inspect show route-map and the referenced ACL/interface matches.']);
    if(rule.kind==='list'&&acls.get(rule.acl)?.type==='standard')for(const p of valid.filter(p=>p.inside)){
      const covered=coversSubnet(acls.get(rule.acl).entries,p.n);
      if(covered!==true)add('nat-coverage',covered===null?'info':'warning',rule.line,'Inside subnet not fully covered by NAT permits',`${p.n.canonical} on ${p.name}: ${covered===null?'unsupported ACL syntax needs manual review':'first-match ACL evaluation leaves denied or unmatched addresses'} in standard ACL ${rule.acl}.`,['Run show access-lists '+rule.acl+' and show ip nat translations.','If internet translation is intended, merge the required subnet permit before any matching deny.']);
    }
  }
  if(nat.length&&!interfaces.some(p=>p.inside))add('nat-inside','warning',nat[0].line,'No NAT inside interface found','PAT rules exist but the parsed configuration has no inside interface.',['Identify the actual routed LAN interfaces and confirm ip nat inside on each.']);
  if(complete&&nat.length&&!routes.some(r=>r.ip==='0.0.0.0'&&r.mask==='0.0.0.0'))add('default-route','info',0,'No static default route found','A dynamic routing protocol or DHCP client may supply the default route.',['Run show ip route 0.0.0.0.','If no default exists, configure one using the assigned ISP next hop.']);
  if(!findings.length)add('no-findings','info',0,'No issues detected by the implemented checks','This does not establish syntax validity, hardware support, policy correctness or end-to-end connectivity.',['Validate the candidate on the target platform.','Check routes, NAT counters, DHCP leases and client connectivity.']);
  if(findings.length===200)findings.push({id:'limit',severity:'info',line:0,title:'Finding limit reached',detail:'Only the first 200 findings are displayed. Analyze a smaller configuration section for additional detail.',steps:['Split the configuration by device or feature.'],repair:''});
  return {findings,commands:findings.filter(f=>f.repair).map(f=>`! ${f.title}\n${f.repair}`).join('\n\n'),interfaces:interfaces.length,pools:pools.length};
}
