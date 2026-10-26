import { CISCO_FEATURES, generateCiscoFeature } from './cisco-enterprise.js';
import { ADVANCED_FEATURES, generateAdvanced } from './advanced.js';
import { ipv4, cidr } from './address.js';
import { network, number } from './catalog.js';
import { PORTS } from './platforms.js';

const ALL=['ios','mikrotik','fortinet','juniper','paloalto'];
const f=(key,label,value='',type='text',options,when)=>({key,label,value,type,options,when});
const s=(key,label,value,options,when)=>f(key,label,value,'select',options,when);
const p=(key,label)=>f(key,label,'','password');
const iface=(vendor,index=1)=>PORTS[vendor]?.[index]||'GigabitEthernet0/1';
const logical=x=>/\.\d+$/.test(x)?x:x+'.0';
const junosPort=x=>{const m=x.match(/^(.*)\.(\d+)$/);return m?m[1]+' unit '+m[2]:x+' unit 0';};
const ifaceField=vendor=>f('interface','Target interface',iface(vendor));
const protocol=(d,v)=>{if(!v.includes(d))throw Error('Invalid protocol or mode.');return d;};
const name=(v,label='Identifier')=>{if(!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(v||''))throw Error(`${label}: use a letter followed by up to 31 letters, digits, _ or -.`);return v;};
const port=v=>{if(!/^[A-Za-z][A-Za-z0-9./_-]{0,45}$/.test(v||''))throw Error('Invalid interface name.');return v;};
const ip=v=>{const n=ipv4(v);if(n===null||n===0||n>=3758096384||v.startsWith('127.'))throw Error('Use a unicast IPv4 address.');return v;};
const secret=(v,max=64)=>{if(!new RegExp(`^[A-Za-z][A-Za-z0-9_@%+=:,.\\-]{15,${max-1}}$`).test(v||''))throw Error(`Secret: use 16–${max} CLI-safe characters, starting with a letter.`);return v;};
const vlans=v=>{const ids=String(v).split(',').map(x=>number(x.trim(),1,4094,'VLAN'));if(!ids.length||ids.length>64||new Set(ids).size!==ids.length)throw Error('Use 1–64 unique comma-separated VLAN IDs.');return ids.join(',');};
const ios=code=>`configure terminal\n${code}\nend`;
const junos=code=>`configure\n${code}\nshow | compare\nexit\n# Validate the candidate and commit separately.`;
const result=(title,code)=>({errors:[],scripts:[{title,code}]});
const def=(title,role,category,vendors,fields,note,roles)=>({title,role,category,vendors,fields,note,roles});

export const ENTERPRISE_FEATURES={
  ...ADVANCED_FEATURES,
  ...CISCO_FEATURES,
  stp:def('STP / RSTP / MST','switch','switching',['ios','mikrotik','juniper'],v=>[s('mode','Spanning-tree mode','rstp',{stp:'STP / PVST+',rstp:'RSTP / Rapid PVST+',mst:'MST'}),f('vlans','VLAN IDs','10,20'),f('priority','Bridge priority (multiple of 4096)','32768','number'),f('bridge','Existing RouterOS bridge','NOC-SW','text',null,()=>v==='mikrotik'),f('region','MST region name','NOC-REGION','text',null,d=>d.mode==='mst'),f('revision','MST revision','1','number',null,d=>d.mode==='mst')],'Global bridge settings. MST peers must use the same region name, revision and VLAN mapping. Review existing STP before applying.'),
  etherchannel:def('EtherChannel · LACP / PAgP','switch','switching',['ios','mikrotik','juniper'],v=>[s('protocol','Aggregation protocol','lacp',{lacp:'LACP · active',pagp:'PAgP · desirable (Cisco only)'}),f('members','Member interfaces (comma separated)',v==='ios'?'GigabitEthernet0/2,GigabitEthernet0/3':v==='juniper'?'ge-0/0/2,ge-0/0/3':'ether3,ether4'),f('group','Bundle number','1','number'),f('vlans','Trunk VLAN IDs','10,20')],'Members must be unused, compatible physical ports. Junos ae capacity must already be provisioned. RouterOS creates a bond; attach it to the intended bridge/VLAN design separately.'),
  snooping:def('DHCP Snooping','switch','switching',['ios','mikrotik'],v=>[f('vlans','Protected VLAN IDs','10,20'),f('uplink','Trusted server-facing interface',iface(v,0)),f('access','Untrusted client interface',v==='ios'?'GigabitEthernet0/2':'ether2'),f('rate','Client DHCP rate (packets/s)','15','number',null,()=>v==='ios'),f('bridge','Existing RouterOS bridge','NOC-SW','text',null,()=>v==='mikrotik')],'Trust only the actual DHCP server/uplink. RouterOS bridge hardware offload support varies by model; ensure these ports are in the named bridge.'),
  pvlan:def('Private VLANs','switch','switching',['ios'],()=>[f('primary','Primary VLAN','100','number'),f('secondary','Isolated secondary VLAN','101','number'),f('hostPort','Isolated host port','GigabitEthernet0/2'),f('promiscuousPort','Promiscuous gateway port','GigabitEthernet0/1')],'Cisco switches with PVLAN support and VTP transparent/off operation. This template uses isolated secondary VLANs; do not reuse these ports for ordinary access/trunk or Port Security templates.'),
  static6:def('Static Routing · IPv6','router','routing',ALL,v=>[f('destination','Destination IPv6 prefix','2001:db8:20::/64'),f('nextHop','IPv6 next hop','2001:db8:1::2'),ifaceField(v),f('distance','Administrative distance / preference','10','number')],'IPv6 addressing and next-hop reachability must exist. PAN-OS targets the classic default virtual router; this does not enable IPv6 security policy.'),
  ospf3:def('OSPFv3 · IPv6','router','routing',['ios','mikrotik','fortinet','juniper'],v=>[f('process','Process / instance ID','100','number'),f('routerId','Router ID','1.1.1.1'),f('area','Area ID','0.0.0.0'),ifaceField(v),f('prefix','RouterOS IPv6 network','2001:db8:10::/64','text',null,()=>v==='mikrotik')],'IPv6 must be configured first. Junos uses interface unit 0. This template creates adjacency only; OSPFv3 IPsec/authentication must be designed separately.'),
  ospf_advanced:def('OSPFv2 · Multi-area, authentication & summaries','router','routing',['ios'],()=>[f('process','OSPF Process ID','100','number'),f('routerId','Router ID','1.1.1.1'),f('statements','Network, wildcard, area — one per line','10.10.0.0 0.0.0.255 0.0.0.0\n10.30.0.0 0.0.0.255 0.0.0.1','textarea'),f('summaryArea','ABR summary area','0.0.0.1'),f('summary','ABR summary prefix','10.30.0.0/16'),s('auth','Interface authentication','sha256',{sha256:'HMAC-SHA256 key chain',none:'None'}),f('interface','Authenticated OSPF interface','GigabitEthernet0/1'),p('authSecret','OSPF shared authentication secret')],'Complete IOS XE OSPFv2 template; use instead of the basic OSPFv2 checkbox. Summary applies only when this router is an ABR; authentication must match the adjacent router.'),
  eigrp:def('EIGRP · Basic / Advanced','router','routing',['ios'],()=>[s('mode','EIGRP template','basic',{basic:'Classic IPv4',advanced:'Named mode · SHA256 / summary'}),f('as','EIGRP AS','100','number'),f('routerId','Router ID','1.1.1.1'),f('network','Local network (CIDR)','10.10.0.0/24'),f('interface','Adjacency interface','GigabitEthernet0/1'),f('variance','Variance','1','number'),f('summary','Interface summary prefix','10.10.0.0/16','text',null,d=>d.mode==='advanced'),p('authSecret','Named-mode authentication secret')],'Other interfaces are passive. Named-mode authentication requires a matching peer secret. Summarize only prefixes reachable through this router.'),
  redistribution:def('Route Redistribution','router','routing',['ios','juniper'],v=>[s('source','Source protocol','static',(v==='ios'?{static:'Static',connected:'Connected',ospf:'OSPF',eigrp:'EIGRP',bgp:'BGP'}:{static:'Static',connected:'Connected',ospf:'OSPF',bgp:'BGP'})),f('sourceProcess','Source process / AS','10','number',null,d=>v==='ios'&&['ospf','eigrp','bgp'].includes(d.source)),s('target','Target protocol','ospf',v==='ios'?{ospf:'OSPF',bgp:'BGP',eigrp:'EIGRP'}:{ospf:'OSPF',bgp:'BGP'}),f('process','Target OSPF process / BGP AS','100','number'),f('prefix','Approved prefix (exact match)','10.10.0.0/24'),f('metric','OSPF metric','20','number',null,d=>d.target==='ospf'),f('bandwidth','EIGRP seed bandwidth (kbps)','100000','number',null,d=>d.target==='eigrp'),f('delay','EIGRP seed delay (tens of microseconds)','10','number',null,d=>d.target==='eigrp'),f('group','Existing Junos BGP group','NOC-PEER','text',null,d=>v==='juniper'&&d.target==='bgp')],'Exact-prefix allow policy with an implicit/explicit reject for other routes. IOS supports OSPF/EIGRP/BGP sources and OSPF/EIGRP/BGP targets. Review existing export policies, route tags and loop prevention; never redistribute all routes blindly.'),
  pbr:def('Policy-Based Routing (PBR)','router','routing',['ios','fortinet'],v=>[ifaceField(v),f('source','Source network (CIDR)','10.10.0.0/24'),f('destination','Destination network (CIDR)','192.0.2.0/24'),f('nextHop','Policy next hop','203.0.113.1'),f('outside','FortiOS output interface',iface(v,0),'text',null,()=>v==='fortinet')],'Applies a forwarding policy on the ingress interface. Ensure the next hop is reachable; review existing PBR order and exclusions for control traffic.'),
  aaa:def('AAA · RADIUS / TACACS+','router','security',['ios','mikrotik'],()=>[s('protocol','AAA protocol','radius',{radius:'RADIUS',tacacs:'TACACS+ (Cisco)'}),f('server','AAA server IPv4','192.0.2.50'),p('aaaSecret','AAA shared secret'),f('localUser','Cisco fallback administrator','nocadmin'),p('localSecret','Cisco fallback administrator secret')],'Cisco configures a named VTY login method with local fallback; console authentication is untouched. RouterOS RADIUS login retains existing local accounts and uses read-only default privileges. Test fallback before remote access changes.'),
  zbfw:def('Zone-Based Firewall (ZBFW)','router','security',['ios'],v=>[f('inside','Inside interface',iface(v)),f('outside','Outside interface',iface(v,0))],'Stateful TCP/UDP/ICMP inspection from LAN to WAN; unsolicited inbound traffic is not permitted. Existing zone membership, self-zone traffic and VPN exceptions require review.'),
  fhrp:def('HSRP / VRRP','router','infrastructure',['ios','mikrotik','fortinet','juniper'],v=>[s('protocol','First-hop protocol',v==='ios'?'hsrp':'vrrp',{hsrp:'HSRP · Cisco',vrrp:'VRRPv2'}),ifaceField(v),f('group','Group / VRID','10','number'),f('virtualIp','Virtual gateway IPv4','10.10.0.254'),f('priority','Priority','110','number'),f('preempt','Enable preemption',true,'checkbox')],'Requires another router on the SAME Layer 2 subnet. Side A and Side B of this routed lab are not an FHRP pair. Set client gateways to the virtual IP only after both peers are configured.'),
  relay:def('DHCP Relay','router','infrastructure',ALL,v=>[ifaceField(v),f('server','DHCP server IPv4','192.0.2.50')],'Use instead of a local DHCP server on the same client interface. Server needs a route back to the client subnet. Review existing relay settings; PAN-OS interface must already be Layer 3, in a virtual router and zone.'),
  ntp_syslog:def('NTP','router','infrastructure',ALL,()=>[f('ntp','NTP server IPv4','129.250.35.251')],'Requires routed reachability to the NTP server. This template uses unauthenticated NTP.', ['router','switch']),
  snmp3:def('SNMPv3 Monitoring','router','infrastructure',['ios','mikrotik','fortinet','juniper'],()=>[f('username','SNMPv3 username','nocmonitor'),f('manager','Monitoring station IPv4','192.0.2.50'),p('authSecret','SNMPv3 authentication secret'),p('privSecret','SNMPv3 privacy secret')],'Read-only authPriv profile with SHA authentication and AES128 privacy for interoperability. Junos requires an existing unique engine ID. Apply management-plane filtering; FortiOS interface access is not silently widened.', ['router','switch']),
  qos:def('QoS · Classification & Marking','router','infrastructure',['ios','mikrotik','juniper'],v=>[ifaceField(v),f('source','Classification source prefix','10.10.0.0/24'),f('udpPort','Classified UDP destination port','5060','number'),f('dscp','Marked DSCP (0–63)','46','number')],'Classifies source/UDP destination port and marks DSCP on a routed ingress interface. Does not guarantee bandwidth, shape or queue. Merge with existing service policies/mangle/filter rules before attaching.'),
};

export function enterpriseFields(id,vendor){let fields=(ENTERPRISE_FEATURES[id]?.fields(vendor)||[]).map(field=>field.key==='authSecret'&&id==='eigrp'?{...field,when:d=>d.mode==='advanced'}:field.key==='authSecret'&&id==='ospf_advanced'?{...field,when:d=>d.auth==='sha256'}:['localUser','localSecret'].includes(field.key)&&id==='aaa'?{...field,when:()=>vendor==='ios'}:field);fields=fields.map(field=>{if((id==='etherchannel'||id==='snooping')&&vendor==='mikrotik'&&field.key==='vlans')return {...field,when:()=>false};if(id==='stp'&&vendor!=='ios'&&field.key==='vlans')return {...field,when:d=>d.mode==='mst'};if(vendor==='juniper'&&['ospf3','redistribution'].includes(id)&&field.key==='process')return {...field,when:()=>false};return field;});if(id==='static6'&&vendor==='paloalto')fields.push(f('virtualRouter','Existing virtual router','default'),f('routeName','Static IPv6 route name','NOC-STATIC6'));return fields;}
export function enterpriseDefaults(id,vendor){return{vendor,...Object.fromEntries(enterpriseFields(id,vendor).map(x=>[x.key,x.value])),...(id==='portforward'?{publicIp:'203.0.113.10',inside:'GigabitEthernet2',outside:'GigabitEthernet1',localNetwork:'10.10.0.0/24',lanIp:'10.10.0.1'}:{})};}

export function ipv6(value){
  if(typeof value!=='string'||!value.includes(':')||!/^[0-9A-Fa-f:]+$/.test(value)||value.includes(':::'))throw Error('Use an IPv6 address without a zone identifier.');
  const parts=value.split('::');if(parts.length>2)throw Error('Invalid IPv6 compression.');
  const left=parts[0]?parts[0].split(':'):[],right=parts.length===2&&parts[1]?parts[1].split(':'):[];
  const count=left.length+right.length;if(parts.length===1&&count!==8||parts.length===2&&count>=8||[...left,...right].some(x=>!/^[0-9a-fA-F]{1,4}$/.test(x)))throw Error('Invalid IPv6 address.');
  return [...left,...Array(parts.length===2?8-count:0).fill('0'),...right].reduce((n,x)=>(n<<16n)+BigInt(parseInt(x,16)),0n);
}
function prefix6(value){const[a,p,...extra]=String(value).split('/');if(extra.length||!/^\d+$/.test(p||''))throw Error('Use an IPv6 prefix.');const bits=number(p,0,128,'IPv6 prefix'),n=ipv6(a),host=128n-BigInt(bits);if(n>>host<<host!==n)throw Error('IPv6 prefix contains host bits.');return value;}
function next6(value){const n=ipv6(value);if(n<=1n||(n>>120n)===255n)throw Error('Use a unicast IPv6 next hop.');return value;}
const area=value=>{if(ipv4(value)===null)throw Error('Area must be dotted decimal.');return value;};
const listPorts=value=>{const a=String(value).split(',').map(x=>port(x.trim()));if(a.length<2||a.length>8||new Set(a).size!==a.length)throw Error('Use 2–8 distinct member interfaces.');return a;};

export function enterpriseGenerate(id,d){
  try{
    const v=d.vendor,feature=ENTERPRISE_FEATURES[id];if(!feature?.vendors.includes(v))throw Error(`No ${id} template for the selected vendor. Select another feature/vendor; no unrelated CLI is emitted.`);
    if(CISCO_FEATURES[id])return generateCiscoFeature(id,d);
    if(ADVANCED_FEATURES[id])return generateAdvanced(id,d);
    let code='';
    if(id==='stp'){
      const mode=protocol(d.mode,['stp','rstp','mst']),ids=vlans(d.vlans),priority=number(d.priority,0,61440,'Priority');if(priority%4096)throw Error('Bridge priority must be a multiple of 4096.');
      if(mode==='mst'){name(d.region,'MST region');number(d.revision,0,65535,'MST revision');}
      if(v==='ios')code=ios(mode==='mst'?`spanning-tree mode mst\nspanning-tree mst configuration\n name ${d.region}\n revision ${d.revision}\n instance 1 vlan ${ids}\n exit\nspanning-tree mst 1 priority ${priority}`:`spanning-tree mode ${mode==='stp'?'pvst':'rapid-pvst'}\nspanning-tree vlan ${ids} priority ${priority}`);
      if(v==='mikrotik'){name(d.bridge,'Bridge');code=`/interface bridge set [find name="${d.bridge}"] protocol-mode=${mode==='mst'?'mstp':mode} priority=${priority}${mode==='mst'?` region-name=${d.region} region-revision=${d.revision}\n/interface bridge msti add bridge=${d.bridge} identifier=1 vlan-mapping=${ids} priority=${priority}`:''}`;}
      if(v==='juniper'){if(mode==='stp')throw Error('Use RSTP or MSTP on this Junos ELS template.');const token=priority===0?'0':priority/1024+'k';code=junos(mode==='mst'?`set protocols mstp configuration-name ${d.region}\nset protocols mstp revision-level ${d.revision}\nset protocols mstp msti 1 vlan [ ${ids.replaceAll(',',' ')} ]\nset protocols mstp msti 1 bridge-priority ${token}\nset protocols mstp interface all`:`set protocols rstp bridge-priority ${token}\nset protocols rstp interface all`);}
    }
    if(id==='etherchannel'){
      const members=listPorts(d.members),group=number(d.group,1,v==='juniper'?127:64,'Bundle number'),ids=vlans(d.vlans);protocol(d.protocol,['lacp','pagp']);if(d.protocol==='pagp'&&v!=='ios')throw Error('PAgP is Cisco-specific. Select LACP for this vendor.');
      if(v==='ios')code=ios(`${members.map(i=>`interface ${i}\n switchport mode trunk\n switchport trunk allowed vlan ${ids}\n channel-group ${group} mode ${d.protocol==='lacp'?'active':'desirable'}\n exit`).join('\n')}\ninterface Port-channel${group}\n switchport mode trunk\n switchport trunk allowed vlan ${ids}\n no shutdown\n exit`);
      if(v==='mikrotik')code=`/interface bonding add name=NOC-BOND-${group} mode=802.3ad slaves=${members.join(',')} lacp-rate=1sec\n# Attach NOC-BOND-${group} to the intended bridge/VLAN configuration; do not bridge the individual member ports.`;
      if(v==='juniper')code=junos(`${members.map(i=>`set interfaces ${i} ether-options 802.3ad ae${group}`).join('\n')}\nset interfaces ae${group} aggregated-ether-options lacp active\nset interfaces ae${group} unit 0 family ethernet-switching interface-mode trunk\n${ids.split(',').map(x=>`set vlans NOC-VLAN-${x} vlan-id ${x}`).join('\n')}\nset interfaces ae${group} unit 0 family ethernet-switching vlan members [ ${ids.split(',').map(x=>'NOC-VLAN-'+x).join(' ')} ]`);
    }
    if(id==='snooping'){
      const ids=vlans(d.vlans);port(d.uplink);port(d.access);if(d.uplink===d.access)throw Error('Trusted uplink and untrusted client port must differ.');
      if(v==='ios'){number(d.rate,1,2048,'DHCP rate');code=ios(`ip dhcp snooping\nip dhcp snooping vlan ${ids}\ninterface ${d.uplink}\n ip dhcp snooping trust\n exit\ninterface ${d.access}\n no ip dhcp snooping trust\n ip dhcp snooping limit rate ${d.rate}\n exit`);}
      else{name(d.bridge);code=`/interface bridge set [find name="${d.bridge}"] dhcp-snooping=yes\n/interface bridge port set [find bridge="${d.bridge}" interface="${d.uplink}"] trusted=yes\n/interface bridge port set [find bridge="${d.bridge}" interface="${d.access}"] trusted=no`;}
    }
    if(id==='pvlan'){
      const primary=number(d.primary,2,4094,'Primary VLAN'),secondary=number(d.secondary,2,4094,'Secondary VLAN');port(d.hostPort);port(d.promiscuousPort);if(primary===secondary||d.hostPort===d.promiscuousPort)throw Error('Primary/secondary VLANs and host/promiscuous ports must differ.');
      code=ios(`vtp mode transparent\nvlan ${secondary}\n private-vlan isolated\n exit\nvlan ${primary}\n private-vlan primary\n private-vlan association ${secondary}\n exit\ninterface ${d.hostPort}\n switchport mode private-vlan host\n switchport private-vlan host-association ${primary} ${secondary}\n exit\ninterface ${d.promiscuousPort}\n switchport mode private-vlan promiscuous\n switchport private-vlan mapping ${primary} ${secondary}\n exit`);
    }
    if(id==='static6'){
      prefix6(d.destination);next6(d.nextHop);port(d.interface);const distance=number(d.distance,v==='paloalto'?10:1,v==='paloalto'?240:255,'Distance');
      if(v==='ios')code=ios(`ipv6 unicast-routing\nipv6 route ${d.destination} ${d.interface} ${d.nextHop} ${distance}`);
      if(v==='mikrotik')code=`/ipv6 route add dst-address=${d.destination} gateway=${d.nextHop}%${d.interface} distance=${distance} comment="NOC IPv6 static"`;
      if(v==='fortinet')code=`config router static6\n edit 0\n  set dst ${d.destination}\n  set gateway ${d.nextHop}\n  set device "${d.interface}"\n  set distance ${distance}\n next\nend`;
      if(v==='juniper')code=junos(`set routing-options rib inet6.0 static route ${d.destination} qualified-next-hop ${d.nextHop} interface ${logical(d.interface)}\nset routing-options rib inet6.0 static route ${d.destination} preference ${distance}`);
      if(v==='paloalto'){name(d.virtualRouter??'default','Virtual router');name(d.routeName??'NOC-STATIC6','Route name');}
      if(v==='paloalto')code=`configure\nset network virtual-router ${d.virtualRouter??'default'} routing-table ipv6 static-route ${d.routeName??'NOC-STATIC6'} destination ${d.destination}\nset network virtual-router ${d.virtualRouter??'default'} routing-table ipv6 static-route ${d.routeName??'NOC-STATIC6'} interface ${d.interface}\nset network virtual-router ${d.virtualRouter??'default'} routing-table ipv6 static-route ${d.routeName??'NOC-STATIC6'} nexthop ipv6-address ${d.nextHop}\nset network virtual-router ${d.virtualRouter??'default'} routing-table ipv6 static-route ${d.routeName??'NOC-STATIC6'} admin-dist ${distance}\nexit`;
    }
    if(id==='ospf3'){
      const process=number(d.process,1,65535,'Process ID');ip(d.routerId);area(d.area);port(d.interface);
      if(v==='ios')code=ios(`ipv6 unicast-routing\nipv6 router ospf ${process}\n router-id ${d.routerId}\n exit\ninterface ${d.interface}\n ipv6 ospf ${process} area ${d.area}\n exit`);
      if(v==='mikrotik'){prefix6(d.prefix);code=`/routing ospf instance add name=NOC-OSPF3-${process} version=3 router-id=${d.routerId}\n/routing ospf area add name=NOC-AREA3-${process} instance=NOC-OSPF3-${process} area-id=${d.area}\n/routing ospf interface-template add interfaces=${d.interface} networks=${d.prefix} area=NOC-AREA3-${process}`;}
      if(v==='juniper')code=junos(`set routing-options router-id ${d.routerId}\nset protocols ospf3 area ${d.area} interface ${logical(d.interface)}`);
      if(v==='fortinet')code=`config router ospf6\n set router-id ${d.routerId}\n config area\n  edit ${d.area}\n  next\n end\n config ospf6-interface\n  edit "NOC-OSPF3-${process}"\n   set interface "${d.interface}"\n   set area ${d.area}\n  next\n end\nend`;
    }
    if(id==='ospf_advanced'){
      const process=number(d.process,1,65535,'OSPF Process ID');ip(d.routerId);area(d.summaryArea);const summary=network(d.summary);protocol(d.auth,['none','sha256']);port(d.interface);
      const lines=String(d.statements).trim().split('\n');if(!lines.length||lines.length>32)throw Error('Use 1–32 OSPF statements.');const commands=lines.map(line=>{const[a,w,ar,...extra]=line.trim().split(/\s+/);const wildcard=ipv4(w);if(extra.length||wildcard===null)throw Error('Each OSPF line requires network wildcard area.');const prefix=32-Math.log2(wildcard+1);if(!Number.isInteger(prefix))throw Error('Use a contiguous OSPF wildcard.');network(`${a}/${prefix}`);area(ar);return` network ${a} ${w} area ${ar}`;});
      if(d.auth==='sha256')secret(d.authSecret);
      code=ios(`${d.auth==='sha256'?`key chain NOC-OSPF-AUTH\n key 1\n  key-string ${d.authSecret}\n  cryptographic-algorithm hmac-sha-256\n  exit\n exit\n`:''}router ospf ${process}\n router-id ${d.routerId}\n${commands.join('\n')}\n area ${d.summaryArea} range ${summary.ip} ${summary.mask}\n exit\n${d.auth==='sha256'?`interface ${d.interface}\n ip ospf authentication key-chain NOC-OSPF-AUTH\n exit`:''}`);
    }
    if(id==='eigrp'){
      protocol(d.mode,['basic','advanced']);const as=number(d.as,1,65535,'EIGRP AS'),variance=number(d.variance,1,128,'Variance'),n=network(d.network);ip(d.routerId);port(d.interface);
      if(d.mode==='basic')code=ios(`router eigrp ${as}\n eigrp router-id ${d.routerId}\n network ${n.ip} ${n.wildcard}\n passive-interface default\n no passive-interface ${d.interface}\n variance ${variance}\n no auto-summary\n exit`);
      else{secret(d.authSecret,32);const sum=network(d.summary);code=ios(`router eigrp NOC-EIGRP\n address-family ipv4 unicast autonomous-system ${as}\n  eigrp router-id ${d.routerId}\n  network ${n.ip} ${n.wildcard}\n  af-interface default\n   passive-interface\n  exit-af-interface\n  af-interface ${d.interface}\n   no passive-interface\n   authentication mode hmac-sha-256 0 ${d.authSecret}\n   summary-address ${sum.ip} ${sum.mask}\n  exit-af-interface\n  topology base\n   variance ${variance}\n  exit-af-topology\n exit-address-family\n exit`);}
    }
    if(id==='redistribution'){
      protocol(d.source,v==='ios'?['static','connected','ospf','eigrp','bgp']:['static','connected','ospf','bgp']);protocol(d.target,v==='ios'?['ospf','bgp','eigrp']:['ospf','bgp']);const process=number(d.process,1,d.target==='bgp'?4294967294:65535,'Target process / AS'),n=network(d.prefix);if(d.target==='ospf')number(d.metric,1,16777214,'OSPF metric');
      const sourceProcess=v==='ios'&&['ospf','eigrp','bgp'].includes(d.source)?number(d.sourceProcess,1,d.source==='bgp'?4294967294:65535,'Source process / AS'):null;
      if(d.source===d.target&&(v==='juniper'||sourceProcess===process))throw Error('Source and target must be different routing processes.');
      if(d.target==='eigrp'){number(d.bandwidth,1,4294967295,'Seed bandwidth');number(d.delay,1,4294967295,'Seed delay');}
      const source=d.source+(sourceProcess?' '+sourceProcess:'');
      if(v==='ios')code=ios(`ip prefix-list NOC-REDIST seq 10 permit ${n.canonical}\nroute-map NOC-REDIST permit 10\n match ip address prefix-list NOC-REDIST\n exit\nrouter ${d.target} ${process}\n${d.target==='bgp'?` address-family ipv4 unicast\n  redistribute ${source} route-map NOC-REDIST\n exit-address-family`:d.target==='eigrp'?` redistribute ${source} metric ${d.bandwidth} ${d.delay} 255 1 1500 route-map NOC-REDIST`:` redistribute ${source} subnets metric ${d.metric} metric-type 2 route-map NOC-REDIST`}\n exit`);
      if(v==='juniper'){if(d.target==='bgp')name(d.group);code=junos(`set policy-options policy-statement NOC-REDIST term APPROVED from protocol ${d.source==='connected'?'direct':d.source}\nset policy-options policy-statement NOC-REDIST term APPROVED from route-filter ${n.canonical} exact\n${d.target==='ospf'?`set policy-options policy-statement NOC-REDIST term APPROVED then metric ${d.metric}\n`:''}set policy-options policy-statement NOC-REDIST term APPROVED then accept\nset policy-options policy-statement NOC-REDIST term DEFAULT then reject\nset protocols ${d.target==='bgp'?`bgp group ${d.group}`:'ospf'} export NOC-REDIST`);}
    }
    if(id==='pbr'){
      port(d.interface);ip(d.nextHop);const src=network(d.source),dst=network(d.destination);
      if(v==='ios')code=ios(`ip access-list extended NOC-PBR\n permit ip ${src.ip} ${src.wildcard} ${dst.ip} ${dst.wildcard}\n exit\nroute-map NOC-PBR permit 10\n match ip address NOC-PBR\n set ip next-hop ${d.nextHop}\n exit\ninterface ${d.interface}\n ip policy route-map NOC-PBR\n exit`);
      else{port(d.outside);code=`config router policy\n edit 0\n  set input-device "${d.interface}"\n  set src "${src.ip}/${src.mask}"\n  set dst "${dst.ip}/${dst.mask}"\n  set gateway ${d.nextHop}\n  set output-device "${d.outside}"\n next\nend`;}
    }
    if(id==='aaa'){
      protocol(d.protocol,['radius','tacacs']);ip(d.server);secret(d.aaaSecret);
      if(v==='mikrotik'){if(d.protocol!=='radius')throw Error('RouterOS login uses RADIUS; this template does not implement TACACS+.');code=`/radius add service=login address=${d.server} secret="${d.aaaSecret}" authentication-port=1812 accounting-port=1813\n/user aaa set use-radius=yes default-group=read\n# Preserve a tested local administrator; server attributes determine remote privileges.`;}
      else{name(d.localUser,'Fallback username');secret(d.localSecret);const radius=d.protocol==='radius';code=ios(`username ${d.localUser} privilege 15 secret ${d.localSecret}\naaa new-model\n${radius?`radius server NOC-AAA\n address ipv4 ${d.server} auth-port 1812 acct-port 1813`:`tacacs server NOC-AAA\n address ipv4 ${d.server}`}\n key ${d.aaaSecret}\n exit\naaa group server ${radius?'radius':'tacacs+'} NOC-AAA-GROUP\n server name NOC-AAA\n exit\naaa authentication login NOC-LOGIN group NOC-AAA-GROUP local\nline vty 0 4\n login authentication NOC-LOGIN\n transport input ssh\n exit`);}
    }
    if(id==='zbfw'){
      port(d.inside);port(d.outside);if(d.inside===d.outside)throw Error('Inside/outside interfaces must differ.');
      code=ios(`zone security NOC-TRUST\nzone security NOC-UNTRUST\nclass-map type inspect match-any NOC-STATEFUL\n match protocol tcp\n match protocol udp\n match protocol icmp\n exit\npolicy-map type inspect NOC-INSPECT\n class type inspect NOC-STATEFUL\n  inspect\n exit\n class class-default\n  drop\n exit\n exit\nzone-pair security NOC-LAN-WAN source NOC-TRUST destination NOC-UNTRUST\n service-policy type inspect NOC-INSPECT\n exit\ninterface ${d.inside}\n zone-member security NOC-TRUST\n exit\ninterface ${d.outside}\n zone-member security NOC-UNTRUST\n exit`);
    }
    if(id==='fhrp'){
      protocol(d.protocol,['hsrp','vrrp']);if(d.protocol==='hsrp'&&v!=='ios')throw Error('HSRP is Cisco-specific; select VRRP.');port(d.interface);ip(d.virtualIp);const group=number(d.group,1,255,'Group / VRID'),priority=number(d.priority,1,254,'Priority');
      if(v==='ios')code=ios(`interface ${d.interface}\n${d.protocol==='hsrp'?` standby version 2\n standby ${group} ip ${d.virtualIp}\n standby ${group} priority ${priority}\n${d.preempt?` standby ${group} preempt\n`:` no standby ${group} preempt\n`}`:` vrrp ${group} ip ${d.virtualIp}\n vrrp ${group} priority ${priority}\n${d.preempt?` vrrp ${group} preempt\n`:` no vrrp ${group} preempt\n`}`} exit`);
      if(v==='mikrotik')code=`/interface vrrp add name=NOC-VRRP interface=${d.interface} vrid=${group} priority=${priority} version=2 preemption-mode=${d.preempt?'yes':'no'}\n/ip address add address=${d.virtualIp}/32 interface=NOC-VRRP`;
      if(v==='fortinet')code=`config system interface\n edit "${d.interface}"\n  config vrrp\n   edit ${group}\n    set vrip ${d.virtualIp}\n    set priority ${priority}\n    set preempt ${d.preempt?'enable':'disable'}\n   next\n  end\n next\nend`;
      if(v==='juniper'){ip(d.localIp);const n=network(d.localNetwork);if(ipv4(d.virtualIp)<=n.network||ipv4(d.virtualIp)>=n.end||d.virtualIp===d.localIp)throw Error('Virtual IP must be a different usable host in the LAN.');code=junos(`set interfaces ${junosPort(d.interface)} family inet address ${d.localIp}/${d.localNetwork.split('/')[1]} vrrp-group ${group} virtual-address ${d.virtualIp}\nset interfaces ${junosPort(d.interface)} family inet address ${d.localIp}/${d.localNetwork.split('/')[1]} vrrp-group ${group} priority ${priority}\nset interfaces ${junosPort(d.interface)} family inet address ${d.localIp}/${d.localNetwork.split('/')[1]} vrrp-group ${group} ${d.preempt?'preempt':'no-preempt'}`);}
    }
    if(id==='relay'){
      port(d.interface);ip(d.server);
      if(v==='ios')code=ios(`interface ${d.interface}\n ip helper-address ${d.server}\n exit`);
      if(v==='mikrotik'){ip(d.localIp);code=`/ip dhcp-relay add name=NOC-RELAY-${d.interface.replace(/[^A-Za-z0-9_-]/g,'_')} interface=${d.interface} dhcp-server=${d.server} local-address=${d.localIp} disabled=no`;}
      if(v==='fortinet')code=`config system interface\n edit "${d.interface}"\n  set dhcp-relay-service enable\n  set dhcp-relay-ip ${d.server}\n next\nend`;
      if(v==='juniper')code=junos(`set forwarding-options dhcp-relay server-group NOC-DHCP ${d.server}\nset forwarding-options dhcp-relay group NOC-RELAY active-server-group NOC-DHCP\nset forwarding-options dhcp-relay group NOC-RELAY interface ${logical(d.interface)}`);
      if(v==='paloalto')code=`configure\nset network dhcp interface ${d.interface} relay ip enabled yes\nset network dhcp interface ${d.interface} relay ip server ${d.server}\nexit`;
    }
    if(id==='ntp_syslog'){
      try{ip(d.ntp);}catch{throw Error('NTP server: enter a unicast IPv4 address.');}
      if(v==='ios')code=ios(`ntp server ${d.ntp} prefer`);
      if(v==='mikrotik')code=`/system ntp client set enabled=yes\n/system ntp client servers add address=${d.ntp}`;
      if(v==='fortinet')code=`config system ntp\n set ntpsync enable\n set type custom\n config ntpserver\n  edit 1\n   set server "${d.ntp}"\n  next\n end\nend`;
      if(v==='juniper')code=junos(`set system ntp server ${d.ntp} prefer`);
      if(v==='paloalto')code=`configure\nset deviceconfig system ntp-servers primary-ntp-server ntp-server-address ${d.ntp}\nexit`;
    }
    if(id==='snmp3'){
      name(d.username,'SNMP username');ip(d.manager);secret(d.authSecret);secret(d.privSecret);if(d.authSecret===d.privSecret)throw Error('Use different SNMP authentication and privacy secrets.');
      if(v==='ios')code=ios(`ip access-list standard NOC-SNMP-MANAGER\n permit host ${d.manager}\n exit\nsnmp-server view NOC-READ iso included\nsnmp-server group NOC-MONITOR v3 priv read NOC-READ access NOC-SNMP-MANAGER\nsnmp-server user ${d.username} NOC-MONITOR v3 auth sha ${d.authSecret} priv aes 128 ${d.privSecret}`);
      if(v==='mikrotik')code=`/snmp community add name=${d.username} addresses=${d.manager}/32 security=private authentication-protocol=SHA1 authentication-password="${d.authSecret}" encryption-protocol=AES encryption-password="${d.privSecret}" read-access=yes write-access=no\n/snmp set enabled=yes\n# Review/disable any pre-existing v1/v2c communities separately.`;
      if(v==='fortinet')code=`config system snmp sysinfo\n set status enable\nend\nconfig system snmp user\n edit "${d.username}"\n  set status enable\n  set security-level auth-priv\n  set auth-proto sha\n  set auth-pwd "${d.authSecret}"\n  set priv-proto aes\n  set priv-pwd "${d.privSecret}"\n  set notify-hosts ${d.manager}\n  set queries enable\n  set trap-status disable\n next\nend\n# Restrict management access to ${d.manager}; notify-hosts is NOT a query-source ACL. Enable SNMP on the intended management interface separately.`;
      if(v==='juniper')code=junos(`set snmp view NOC-READ oid .1 include\nset snmp v3 usm local-engine user ${d.username} authentication-sha authentication-password "${d.authSecret}"\nset snmp v3 usm local-engine user ${d.username} privacy-aes128 privacy-password "${d.privSecret}"\nset snmp v3 vacm security-to-group security-model usm security-name ${d.username} group NOC-MONITOR\nset snmp v3 vacm access group NOC-MONITOR default-context-prefix security-model usm security-level privacy context-match exact\nset snmp v3 vacm access group NOC-MONITOR default-context-prefix security-model usm security-level privacy read-view NOC-READ\n# Existing unique engine ID required; restrict management-plane UDP/161 to ${d.manager}.`);
    }
    if(id==='qos'){
      port(d.interface);const n=network(d.source),udp=number(d.udpPort,1,65535,'UDP destination port'),dscp=number(d.dscp,0,63,'DSCP');
      if(v==='ios')code=ios(`ip access-list extended NOC-QOS\n permit udp ${n.ip} ${n.wildcard} any eq ${udp}\n exit\nclass-map match-all NOC-CLASS\n match access-group name NOC-QOS\n exit\npolicy-map NOC-MARK\n class NOC-CLASS\n  set dscp ${dscp}\n exit\n exit\ninterface ${d.interface}\n service-policy input NOC-MARK\n exit`);
      if(v==='mikrotik')code=`/ip firewall mangle add chain=forward in-interface=${d.interface} src-address=${n.canonical} protocol=udp dst-port=${udp} action=change-dscp new-dscp=${dscp} passthrough=yes comment="NOC classification marking"\n# Place before FastTrack/other terminal actions as appropriate.`;
      if(v==='juniper')code=junos(`set firewall family inet filter NOC-MARK term CLASSIFY from source-address ${n.canonical}\nset firewall family inet filter NOC-MARK term CLASSIFY from protocol udp\nset firewall family inet filter NOC-MARK term CLASSIFY from destination-port ${udp}\nset firewall family inet filter NOC-MARK term CLASSIFY then dscp ${dscp}\nset firewall family inet filter NOC-MARK term CLASSIFY then accept\nset firewall family inet filter NOC-MARK term DEFAULT then accept\nset interfaces ${junosPort(d.interface)} family inet filter input NOC-MARK`);
    }
    if(!code)throw Error('No generator for this feature/vendor.');
    return result(feature.title,code);
  }catch(e){return{errors:[e.message],scripts:[]};}
}

