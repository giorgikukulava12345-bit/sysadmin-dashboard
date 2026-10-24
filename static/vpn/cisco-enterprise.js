import { cidr, ipv4 } from './address.js';

const f=(key,label,value,type='text',options,when)=>({key,label,value,type,options,when});
const def=(title,category,fields,note)=>({title,role:'router',category,vendors:['ios'],fields:()=>fields,note});
export const CISCO_FEATURES={
  portforward:def('Port Forwarding · NAT Port Redirection','security',[
    f('protocol','Transport protocol','tcp','select',{tcp:'TCP',udp:'UDP'}),f('externalPort','External port','8443','number'),f('internalIp','Internal server IPv4','10.10.0.10'),f('internalPort','Internal server port','443','number'),f('allowedSource','Allowed external source (CIDR)','198.51.100.0/24'),f('acl','Dedicated WAN ACL name','NOC-PORTFORWARD'),f('attachAcl','Attach as a new dedicated WAN inbound ACL',false,'checkbox'),
  ],'Uses the topology WAN address and inside/outside interfaces. The WAN ACL matches the public address/external port BEFORE IOS inside NAT. By default the permit is generated for merging into your existing WAN ACL. Explicit attachment replaces the interface inbound ACL and denies all other inbound IP traffic; it is not a complete stateful firewall.'),
  gre_tunnel:def('GRE Tunnels · Generic Routing Encapsulation','tunneling',[
    f('interface','Dedicated tunnel interface','Tunnel200'),f('source','Local tunnel source IPv4','203.0.113.10'),f('peer','Remote public IPv4','198.51.100.20'),f('address','Tunnel host IPv4 / prefix','172.16.200.1/30'),f('remoteNetwork','Remote LAN (CIDR)','10.20.0.0/24'),f('mtu','Tunnel IP MTU','1400','number'),f('mss','TCP MSS','1360','number'),
  ],'Plain IPv4 GRE is NOT encrypted. Requires reachable endpoints and IP protocol 47 through the underlay. This creates a routed tunnel and remote LAN route; select GRE over IPsec in Site-to-Site VPN when encryption is required.'),
  vxlan:def('VXLAN · IOS XE EFP / Bridge Domain','tunneling',[
    f('platform','VXLAN template platform','iosxe-efp','select',{'iosxe-efp':'IOS XE router · static VXLAN with EFP / bridge-domain'}),f('loopback','Dedicated VTEP Loopback number','100','number'),f('localVtep','Local VTEP IPv4','10.255.0.1'),f('peerVtep','Remote VTEP IPv4','10.255.0.2'),f('vni','VXLAN Network Identifier (VNI)','5000','number'),f('accessInterface','Dedicated access EFP physical interface','GigabitEthernet3'),f('serviceInstance','Unused Ethernet service instance','100','number'),f('vlan','Access 802.1Q tag','100','number'),f('bridgeDomain','Bridge domain ID','100','number'),
  ],'Platform-specific IOS XE router static VXLAN/EFP template, not NX-OS or Catalyst EVPN. Verify image/hardware support before use. Requires routed VTEP /32 reachability, UDP 4789 and an underlay MTU allowing VXLAN overhead. Uses a dedicated Layer 2 EFP port; do not reuse a routed LAN/WAN or switchport. No EVPN control plane is generated.'),
  bfd:def('BFD · Bidirectional Forwarding Detection','performance',[
    f('interface','BFD-enabled routed interface','GigabitEthernet1'),f('tx','Minimum transmit interval (ms)','300','number'),f('rx','Minimum receive interval (ms)','300','number'),f('multiplier','Detection multiplier','3','number'),f('client','Routing client integration','none','select',{none:'Interface timers · existing client configured separately',ospf:'Existing OSPF interface',bgp:'Existing single-hop BGP neighbor'}),f('as','Existing local BGP AS','65001','number',null,d=>d.client==='bgp'),f('neighbor','Existing single-hop BGP neighbor IPv4','203.0.113.1','text',null,d=>d.client==='bgp'),
  ],'Both peers must support compatible timers. Interface timers alone do not start a BFD session; an existing routing client must register. The BGP option adds fall-over to an existing directly connected neighbor, not a multihop session. Hardware minimum intervals vary.'),
  ipsla:def('IP SLA · ICMP Echo & Reachability Tracking','performance',[
    f('operation','Unused IP SLA operation ID','100','number'),f('track','Unused tracking object ID','100','number'),f('target','ICMP destination IPv4','203.0.113.1'),f('sourceInterface','Probe source interface','GigabitEthernet1'),f('frequency','Probe frequency (seconds)','10','number'),f('timeout','Probe timeout (milliseconds)','1000','number'),
  ],'Creates and schedules an ICMP echo probe plus a reachability tracking object. Use unused IDs or stop/review an existing scheduled operation before editing. Destination must allow ICMP; no default route is silently replaced. Attach the tracking object to a reviewed failover route separately.'),
  isis:def('IS-IS · Integrated IPv4 Routing','routing',[
    f('process','IS-IS process tag','NOC-ISIS'),f('net','Private NET (49.area.system-id.00)','49.0001.0000.0000.0001.00'),f('level','Routing level','level-2-only','select',{'level-1':'Level 1','level-2-only':'Level 2 only','level-1-2':'Level 1 + Level 2'}),f('interface','Existing routed adjacency interface','GigabitEthernet2'),f('metric','Wide interface metric','10','number'),f('pointToPoint','Point-to-point adjacency type',true,'checkbox'),
  ],'Integrated IPv4 IS-IS with wide metrics on an already addressed routed interface. Each router needs a unique six-byte system ID. Match area/level, network type and MTU with the peer. No authentication or route redistribution is added automatically.'),
  copp:def('CoPP · Control Plane Policing','hardening',[
    f('rate','ICMP control-plane policer rate (bits/s)','64000','number'),f('burst','Policer burst (bytes)','8000','number'),f('attachPolicy','Attach reviewed policy to the control plane',false,'checkbox'),
  ],'IOS/XE router MQC template policing ICMP traffic destined to the control plane only. Other classes remain at platform defaults. By default creates an unattached policy for review. Attaching can replace an existing control-plane policy; do not replace Catalyst system CPP policies with this router template.'),
  urpf:def('uRPF · Unicast Reverse Path Forwarding','hardening',[
    f('interface','Validated ingress routed interface','GigabitEthernet1'),f('mode','Source validation mode','rx','select',{rx:'Strict · reverse path must use ingress interface',any:'Loose · source must exist in forwarding table'}),f('allowDefault','Allow the default route for source validation',true,'checkbox'),
  ],'Requires CEF and a correct IPv4 forwarding table. Strict mode can drop valid traffic on asymmetric paths; use an intentional design. The allow-default option permits sources reachable only through the default route. This is interface source validation, not a substitute for a complete firewall policy.'),
};
const identifier=(x,label)=>{if(!/^[A-Za-z][A-Za-z0-9._/-]{0,45}$/.test(x||''))throw Error(label+': invalid CLI identifier.');return x;};
const integer=(x,min,max,label)=>{if(!/^\d+$/.test(String(x))||+x<min||+x>max)throw Error(`${label}: use ${min}–${max}.`);return +x;};
const unicast=(x,label)=>{const n=ipv4(x);if(n===null||n<16777216||n>=0xe0000000||x.startsWith('127.')||x.startsWith('169.254.'))throw Error(label+': use a unicast IPv4 address.');return x;};
const network=(x,label)=>{const n=cidr(x);if(!n||n.canonical!==x)throw Error(label+': use a canonical IPv4 network/prefix.');return n;};
const choice=(x,options,label)=>{if(!options.includes(x))throw Error(label+': unsupported option.');return x;};
const boolean=(x,label)=>{if(typeof x!=='boolean')throw Error(label+': use a checkbox value.');return x;};
const host=(x,label)=>{const n=cidr(x),address=x?.split('/')[0],prefix=Number(x?.split('/')[1]);unicast(address,label);if(!n||prefix<8||prefix>30||ipv4(address)<=n.network||ipv4(address)>=n.end)throw Error(label+': use a usable host in a /8–/30 subnet.');return {...n,address};};
const comment=text=>{const lines=[''];for(const word of text.split(/\s+/)){const i=lines.length-1;if(lines[i].length+word.length+1>84)lines.push(word);else lines[i]+=(lines[i]?' ':'')+word;}return lines.map(line=>'! '+line).join('\n');};

export function generateCiscoFeature(id,d){
  try{
    if(d.vendor!=='ios'||!CISCO_FEATURES[id])throw Error('This template requires Cisco IOS / IOS XE.');
    let code='',verify='';
    if(id==='portforward'){
      const protocol=choice(d.protocol,['tcp','udp'],'Transport'),external=integer(d.externalPort,1,65535,'External port'),internal=integer(d.internalPort,1,65535,'Internal port');
      unicast(d.internalIp,'Internal server');unicast(d.publicIp,'WAN IPv4');identifier(d.inside,'Inside interface');identifier(d.outside,'Outside interface');identifier(d.acl,'WAN ACL');boolean(d.attachAcl,'Attach ACL');if(d.inside===d.outside)throw Error('Inside and outside interfaces must differ.');const lan=network(d.localNetwork,'LAN network');if(ipv4(d.internalIp)<=lan.network||ipv4(d.internalIp)>=lan.end||d.internalIp===d.lanIp)throw Error('Internal server must be a usable LAN host, not the router gateway.');const source=network(d.allowedSource,'Allowed source');if(source.network>=0xe0000000||source.end>=0xe0000000&&source.canonical!=='0.0.0.0/0')throw Error('Allowed source must be a unicast prefix.');const match=source.canonical==='0.0.0.0/0'?'any':source.ip+' '+source.wildcard;
      code=`ip nat inside source static ${protocol} ${d.internalIp} ${internal} interface ${d.outside} ${external}\nip access-list extended ${d.acl}\n 10 permit ${protocol} ${match} host ${d.publicIp} eq ${external}\n${d.attachAcl?' 90 deny ip any any log\n':''} exit\ninterface ${d.inside}\n ip nat inside\n exit\ninterface ${d.outside}\n ip nat outside\n${d.attachAcl?` ip access-group ${d.acl} in\n`:''} exit\n${d.attachAcl?'! Dedicated inbound ACL attached: other inbound IP traffic is denied.':'! ACL NOT attached. Merge the permit into the existing WAN inbound ACL before its deny rules.'}`;
      verify='show ip nat translations\nshow ip nat statistics\nshow access-lists '+d.acl;
    }
    if(id==='gre_tunnel'){
      identifier(d.interface,'Tunnel');if(!/^Tunnel\d+$/.test(d.interface))throw Error('Use a dedicated Tunnel interface.');unicast(d.source,'Source');unicast(d.peer,'Peer');if(d.source===d.peer)throw Error('GRE endpoints must differ.');const tunnel=host(d.address,'Tunnel address'),remote=network(d.remoteNetwork,'Remote network');if(remote.network>=0xe0000000||remote.end>=0xe0000000)throw Error('Remote LAN must be unicast.');const mtu=integer(d.mtu,576,1476,'GRE MTU'),mss=integer(d.mss,536,1436,'TCP MSS');if(mss>mtu-40)throw Error('TCP MSS must not exceed tunnel MTU minus 40.');if([d.source,d.peer].some(ip=>ipv4(ip)>=remote.network&&ipv4(ip)<=remote.end))throw Error('Remote LAN route must not capture a GRE underlay endpoint.');if(remote.network<=tunnel.end&&remote.end>=tunnel.network)throw Error('GRE transit and remote LAN must not overlap.');
      code=`interface ${d.interface}\n ip address ${tunnel.address} ${tunnel.mask}\n ip mtu ${mtu}\n ip tcp adjust-mss ${mss}\n tunnel source ${d.source}\n tunnel destination ${d.peer}\n tunnel mode gre ip\n no shutdown\n exit\nip route ${remote.ip} ${remote.mask} ${d.interface}\n! GRE provides encapsulation only; this tunnel is not encrypted.`;verify='show interfaces '+d.interface+'\nshow ip route '+remote.ip;
    }
    if(id==='vxlan'){
      choice(d.platform,['iosxe-efp'],'VXLAN platform');const loop=integer(d.loopback,0,16383,'Loopback'),vni=integer(d.vni,4096,16777215,'VNI'),instance=integer(d.serviceInstance,1,8000,'EFP service instance'),vlan=integer(d.vlan,1,4094,'VLAN'),bd=integer(d.bridgeDomain,1,4096,'Bridge domain');unicast(d.localVtep,'Local VTEP');unicast(d.peerVtep,'Remote VTEP');identifier(d.accessInterface,'Access interface');if(d.localVtep===d.peerVtep)throw Error('VTEPs must differ.');if(!/^(GigabitEthernet|TenGigabitEthernet|Ethernet)\d+(?:\/\d+)*$/.test(d.accessInterface))throw Error('Use a dedicated physical Ethernet EFP port.');
      code=`interface Loopback${loop}\n ip address ${d.localVtep} 255.255.255.255\n exit\ninterface nve1\n source-interface Loopback${loop}\n member vni ${vni}\n  ingress-replication ${d.peerVtep}\n  exit\n no shutdown\n exit\ninterface ${d.accessInterface}\n service instance ${instance} ethernet\n  encapsulation dot1q ${vlan}\n  rewrite ingress tag pop 1 symmetric\n  exit\n no shutdown\n exit\nbridge-domain ${bd}\n member ${d.accessInterface} service-instance ${instance}\n member vni ${vni}\n exit\n! IOS XE router EFP syntax; verify platform support and VTEP underlay reachability.`;verify='show nve interface nve1\nshow nve peers\nshow bridge-domain '+bd;
    }
    if(id==='bfd'){
      identifier(d.interface,'Interface');const tx=integer(d.tx,50,9999,'BFD transmit'),rx=integer(d.rx,50,9999,'BFD receive'),mult=integer(d.multiplier,3,50,'Detection multiplier');choice(d.client,['none','ospf','bgp'],'BFD client');code=`interface ${d.interface}\n bfd interval ${tx} min_rx ${rx} multiplier ${mult}\n exit`;
      if(d.client==='ospf')code+=`
interface ${d.interface}
 ip ospf bfd
 exit`;
      if(d.client==='bgp'){integer(d.as,1,4294967295,'BGP AS');unicast(d.neighbor,'BGP peer');code+=`\nrouter bgp ${d.as}\n neighbor ${d.neighbor} fall-over bfd\n exit`;}else if(d.client==='none')code+='\n! Timers only: enable BFD in an existing routing client on BOTH peers.';verify='show bfd neighbors details';
    }
    if(id==='ipsla'){
      const op=integer(d.operation,1,65535,'Operation ID'),track=integer(d.track,1,1000,'Track ID'),frequency=integer(d.frequency,1,604800,'Frequency'),timeout=integer(d.timeout,1,604800000,'Timeout');unicast(d.target,'Probe destination');identifier(d.sourceInterface,'Source interface');if(timeout>=frequency*1000)throw Error('Probe timeout must be shorter than the frequency.');code=`ip sla ${op}\n icmp-echo ${d.target} source-interface ${d.sourceInterface}\n timeout ${timeout}\n frequency ${frequency}\n exit\nip sla schedule ${op} life forever start-time now\ntrack ${track} ip sla ${op} reachability\n exit`;verify=`show ip sla statistics ${op}\nshow track ${track}`;
    }
    if(id==='isis'){
      identifier(d.process,'IS-IS process');identifier(d.interface,'IS-IS interface');if(!/^49\.[A-Fa-f0-9]{4}(?:\.[A-Fa-f0-9]{4}){3}\.00$/.test(d.net||'')||/^0{4}\.0{4}\.0{4}$/.test(String(d.net).split('.').slice(2,5).join('.')))throw Error('Use a private NET: 49.area.system.system.system.00 with a nonzero unique system ID.');choice(d.level,['level-1','level-2-only','level-1-2'],'IS-IS level');const metric=integer(d.metric,1,16777214,'IS-IS metric');boolean(d.pointToPoint,'Point-to-point');
      code=`router isis ${d.process}\n net ${d.net}\n is-type ${d.level}\n metric-style wide\n log-adjacency-changes\n exit\ninterface ${d.interface}\n ip router isis ${d.process}\n${d.pointToPoint?' isis network point-to-point\n':''}${d.level==='level-1-2'?'':` isis circuit-type ${d.level}\n`} isis metric ${metric}\n exit`;verify='show isis neighbors\nshow isis database\nshow ip route isis';
    }
    if(id==='copp'){
      const rate=integer(d.rate,8000,2000000000,'Policer rate'),burst=integer(d.burst,1500,2000000000,'Burst');boolean(d.attachPolicy,'Attach policy');code=`ip access-list extended NOC-COPP-ICMP\n permit icmp any any\n exit\nclass-map match-all NOC-COPP-ICMP\n match access-group name NOC-COPP-ICMP\n exit\npolicy-map NOC-COPP\n class NOC-COPP-ICMP\n  police ${rate} ${burst} conform-action transmit exceed-action drop\n  exit\n exit\n${d.attachPolicy?'control-plane\n service-policy input NOC-COPP\n exit':'! Policy NOT attached. Merge with the existing control-plane policy before activation.'}`;verify='show policy-map NOC-COPP\nshow policy-map control-plane';
    }
    if(id==='urpf'){
      identifier(d.interface,'Ingress interface');choice(d.mode,['rx','any'],'uRPF mode');boolean(d.allowDefault,'Allow default');code=`ip cef\ninterface ${d.interface}\n ip verify unicast source reachable-via ${d.mode}${d.allowDefault?' allow-default':''}\n exit`;verify='show ip interface '+d.interface+'\nshow ip cef';
    }
    if(!code)throw Error('No Cisco template for this feature.');
    return{errors:[],scripts:[{title:CISCO_FEATURES[id].title,code:`${comment(CISCO_FEATURES[id].note)}\nconfigure terminal\n${code}\nend\n! Verification (EXEC mode):\n${verify.split('\n').map(x=>'! '+x).join('\n')}`}]};
  }catch(error){return{errors:[error.message],scripts:[]};}
}
