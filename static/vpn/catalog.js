import { PLATFORMS } from './platforms.js';
import { validateWan } from './interfaces.js';
import { cidr, ipv4, unicastNetwork } from './address.js';
export const ipText = n => [24,16,8,0].map(b => (n >>> b) & 255).join('.');
export function sshAllowedSources(value='') {
 const lines=String(value).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(lines.length>64)throw Error('SSH allowed sources: use at most 64 IPv4 hosts or networks.');
 const sources=new Map();for(const line of lines){const normalized=line.includes('/')?line:line+'/32',n=cidr(normalized);if(!n||n.canonical!==normalized||!unicastNetwork(n))throw Error('SSH allowed sources: use canonical unicast IPv4 CIDRs or individual hosts, one per line.');sources.set(n.canonical,n);}return [...sources.values()];
}
const field = (key, label, value = '', type = 'text', options, when) => ({key,label,value,type,options,when});
const select = (key,label,value,options,when) => field(key,label,value,'select',options,when);
const ciscoIf = 'GigabitEthernet0/0';
export const TOOLS = {
  bootstrap: { title:'MikroTik Initial Setup', note:'RouterOS v7 IPv4 baseline for an empty configuration. Creates named bridge/DHCP/firewall objects; does not reset the device. Review existing rules and configure IPv6 separately if enabled.', fields:[
    field('wan','WAN interface','ether1'),select('wanMode','ISP addressing','dhcp',{dhcp:'DHCP client',static:'Static IP'}),
    field('wanAddress','WAN host / prefix','203.0.113.2/30','text',null,d=>d.wanMode==='static'),field('gateway','ISP gateway','203.0.113.1','text',null,d=>d.wanMode==='static'),
    field('bridge','LAN bridge name','bridge-lan'),field('ports','LAN ports (comma separated)','ether2,ether3,ether4'),field('lan','LAN gateway / prefix','192.168.88.1/24'),
    field('poolStart','DHCP pool start','192.168.88.10'),field('poolEnd','DHCP pool end','192.168.88.200'),field('dns','DNS servers (comma separated)','8.8.8.8') ]},
  enterprise: { title:'Cisco Router/Switch VLAN Setup', note:'Router-on-a-stick plus a Layer 2 switch. Assumes routed WAN, available physical ports and no overlapping VLAN networks. Review existing trunks, NAT rules and management access.', fields:[
    field('wan','Router WAN interface','GigabitEthernet0/1'),field('wanAddress','WAN host / prefix','203.0.113.2/30'),field('gateway','ISP gateway','203.0.113.1'),field('trunk','Router trunk interface',ciscoIf),
    field('uplink','Switch uplink to router','GigabitEthernet0/1'),field('vlans','One VLAN per line: ID,Name,Gateway/prefix,Switch access port','10,OFFICE,192.168.1.1/24,GigabitEthernet0/2\n20,STAFF,172.16.19.1/24,GigabitEthernet0/3','textarea'),
    field('mgmtVlan','Management VLAN ID','10','number'),field('mgmtIp','Switch management IP','192.168.1.254') ]},
  routing: { title:'Dynamic Routing · OSPF / BGP', note:'Session/adjacency templates; configure interface addressing and reachability first. BGP installs explicit reject-all input/output policies until you replace them with approved prefix filters. OSPF enables adjacency on matching interfaces.', fields:[
    select('protocol','Routing protocol','ospf',{ospf:'OSPFv2',bgp:'BGP IPv4'}),select('vendor','Vendor','ios',{ios:'Cisco IOS XE',mikrotik:'MikroTik RouterOS v7'}),
    select('rosVersion','RouterOS BGP version','modern',{modern:'7.20+ (explicit instance)',classic:'7.12–7.19 (connection AS)'},d=>d.vendor==='mikrotik'&&d.protocol==='bgp'),field('routerId','Router ID','1.1.1.1'),
    field('process','OSPF Process ID / instance suffix','1','number',null,d=>d.protocol==='ospf'),field('area','OSPF Area ID (dotted decimal)','0.0.0.0','text',null,d=>d.protocol==='ospf'),
    field('networks','Network and wildcard, one per line','10.10.0.0 0.0.0.255\n10.0.0.0 0.0.0.3','textarea',null,d=>d.protocol==='ospf'),
    field('localAs','Local AS','65001','number',null,d=>d.protocol==='bgp'),field('neighbor','Neighbor IPv4','192.0.2.2','text',null,d=>d.protocol==='bgp'),field('remoteAs','Remote AS','65002','number',null,d=>d.protocol==='bgp') ]},
  acl: {title:'Cisco ACL Generator',note:'Creates a named ACL. An implicit deny follows your entry. Apply it to the intended interface/direction separately.',fields:[
    select('type','ACL type','extended',{standard:'Standard',extended:'Extended'}),field('name','ACL name','NOC-ACL'),select('action','Action','permit',{permit:'Permit',deny:'Deny'}),
    select('protocol','Protocol','tcp',{ip:'IP',tcp:'TCP',udp:'UDP',icmp:'ICMP'},d=>d.type==='extended'),field('source','Source IPv4 or any','192.168.10.0'),field('sourceWildcard','Source wildcard','0.0.0.255'),
    field('destination','Destination IPv4 or any','any','text',null,d=>d.type==='extended'),field('destinationWildcard','Destination wildcard','0.0.0.0','text',null,d=>d.type==='extended'),
    field('sourcePort','Source port (optional)','', 'number',null,d=>d.type==='extended'&&['tcp','udp'].includes(d.protocol)),field('destPort','Destination port (optional)','443','number',null,d=>d.type==='extended'&&['tcp','udp'].includes(d.protocol))]},
  nat: {title:'Cisco NAT / PAT',note:'Uses a dedicated named ACL. WAN addressing, default route and return connectivity must already exist. Merge with existing NAT policy before applying.',fields:[field('network','Inside network (CIDR)','192.168.10.0/24'),field('acl','Translation ACL name','NOC-PAT'),field('inside','Inside interface',ciscoIf),field('outside','Public outside interface','GigabitEthernet0/1')]},
  dhcp: {title:'Cisco Router DHCP Server',note:'Creates an IPv4 pool. The default router is automatically excluded. Verify this is the only intended DHCP server for this subnet.',fields:[field('name','Pool name','NOC-LAN'),field('network','Network (CIDR)','192.168.1.0/24'),field('gateway','Default router','192.168.1.1'),field('dns','DNS servers (comma separated)','8.8.8.8'),field('exclusions','Excluded IP ranges, one per line','192.168.1.1 192.168.1.20\n192.168.1.254','textarea')]},
  security: {title:'Switch Port Security',note:'For an access port. Sticky learning records MAC addresses; save the reviewed configuration to retain learned entries.',fields:[field('interface','Switch interface','GigabitEthernet0/2'),field('vlan','Access VLAN ID','10','number'),field('maximum','Maximum MAC addresses','2','number'),select('violation','Violation mode','shutdown',{shutdown:'Shutdown',restrict:'Restrict',protect:'Protect'}),field('sticky','Enable sticky MAC learning',true,'checkbox')]},
  hardening: {title:'Device Hardening & SSH',note:'Passwords accept basic words or digits of at least 4 characters; no mixed-case or symbol requirement. Assumes local privileged console access. RSA generation may prompt if keys already exist. SSH sources create a source ACL and restrict all VTY lines; enter your management host or canonical network, one per line. Blank standalone sources add no source ACL; the Office preset retains its LAN defaults when blank. Secrets appear in copied commands; nothing is saved or applied automatically.',fields:[field('hostname','Hostname','NOC-R1'),field('domain','Domain name','noc.example'),field('username','Local administrator','nocadmin'),field('secret','Local user secret','','password'),field('enableSecret','Enable secret','','password'),field('sshSources','SSH allowed source IPv4 hosts / CIDRs (one per line)','','textarea'),select('rsa','RSA key size','2048',{'2048':'2048 bits','3072':'3072 bits','4096':'4096 bits'})]},
  static: {title:'Static Route Generator',note:'Supply a next hop, exit interface, or both. On multiaccess links a next hop is normally preferable. Distance 255 keeps the route out of the routing table.',fields:[field('destination','Destination network','192.168.20.0'),field('mask','Subnet mask','255.255.255.0'),field('nextHop','Next-hop IPv4 (optional)','10.0.0.2'),field('interface','Exit interface (optional)',''),field('distance','Administrative distance (optional)','','number'),field('permanent','Permanent route',false,'checkbox')]},
  vlan: {title:'VLAN & Switch Port',note:'Layer 2 switch template. Trunks retain the platform native VLAN unless configured separately. Access mode enables PortFast/BPDU guard for an endpoint-facing port.',fields:[field('vlan','VLAN ID','10','number'),field('name','VLAN name','HR'),field('interface','First interface','GigabitEthernet0/2'),field('lastPort','Last port number for range (optional)','','number'),select('mode','Port mode','access',{access:'Access',trunk:'Trunk'}),field('allowed','Allowed VLAN IDs (comma separated)','10,20','text',null,d=>d.mode==='trunk')]},
};

for (const [key,tool] of Object.entries(TOOLS)) {
  const existing=tool.fields.find(f=>f.key==='vendor');
  if(existing) existing.options=PLATFORMS;
  else tool.fields.unshift(select('vendor','Vendor',key==='bootstrap'?'mikrotik':'ios',PLATFORMS));
}

export const defaultsFor = key => Object.fromEntries(TOOLS[key].fields.map(f=>[f.key,f.value]));
function requireValue(ok,message){if(!ok)throw new Error(message);}
export function number(value,min,max,label){requireValue(/^\d+$/.test(String(value))&&Number(value)>=min&&Number(value)<=max,`${label}: use ${min}–${max}.`);return Number(value);}
function choose(value,values,label){requireValue(values.includes(value),`Invalid ${label}.`);return value;}
function name(value,label='Name'){requireValue(typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(value),`${label}: start with a letter; use letters, digits, _ or - (max 32).`);return value;}
function iface(value){requireValue(typeof value==='string'&&/^[A-Za-z][A-Za-z0-9./_-]{0,45}$/.test(value),'Invalid interface name.');return value;}
export function ip(value,label='IPv4'){requireValue(ipv4(value)!==null,`${label}: enter a valid IPv4 address.`);return value;}
function unicast(value,label){ip(value,label);const n=ipv4(value);requireValue(n>0&&n<3758096384&&value.split('.')[0]!=='127',`${label}: use a unicast address.`);return value;}
export function network(value){const n=cidr(value);requireValue(n&&n.canonical===value,'Enter a canonical IPv4 network, e.g. 192.168.10.0/24.');return n;}
export function hostCidr(value){const n=cidr(value);requireValue(n,'Enter a host address with prefix, e.g. 192.168.10.1/24.');const host=value.split('/')[0], v=ipv4(host);requireValue(v>n.network&&v<n.end,'Host address must be inside a subnet with usable network/broadcast boundaries.');return {...n,host,prefix:value.split('/')[1]};}
function inNet(host,n,label){ip(host,label);requireValue(ipv4(host)>n.network&&ipv4(host)<n.end,`${label} must be a usable address inside the network.`);}
function dnsList(value){const a=value.split(',').map(v=>v.trim());requireValue(a.length>=1&&a.length<=4,'Use 1–4 DNS servers.');return a.map(v=>unicast(v,'DNS server'));}
function list(value){return value.split(',').map(v=>v.trim()).filter(Boolean);}
function distinct(...values){requireValue(new Set(values).size===values.length,'Interfaces / names must be distinct.');}
function notOverlap(a,b){requireValue(a.network>b.end||b.network>a.end,'Networks must not overlap.');}
function aclAddress(value,wildcard){if(value==='any')return 'any';ip(value);ip(wildcard,'Wildcard');return wildcard==='0.0.0.0'?`host ${value}`:`${value} ${wildcard}`;}
function maskPrefix(mask){ip(mask,'Subnet mask');const inverted=4294967295-ipv4(mask);const prefix=32-Math.log2(inverted+1);requireValue(Number.isInteger(prefix),'Subnet mask must be contiguous.');return prefix;}
const wrap = text => `configure terminal\n${text}\nend`;
function bootstrap(d){
  if(d.wanMode==='static'){const errors=validateWan({ip:d.wanAddress.split('/')[0],wanPrefix:d.wanAddress.split('/')[1],gateway:d.gateway});requireValue(!errors.length,errors.join(' '));}
  iface(d.wan);name(d.bridge,'Bridge');const ports=list(d.ports);requireValue(ports.length>0&&ports.length<=32,'Use 1–32 LAN ports.');ports.forEach(iface);distinct(d.wan,d.bridge,...ports);
  const lan=hostCidr(d.lan),dns=dnsList(d.dns);inNet(d.poolStart,lan,'Pool start');inNet(d.poolEnd,lan,'Pool end');
  requireValue(ipv4(d.poolStart)<=ipv4(d.poolEnd),'Pool start must precede pool end.');requireValue(!(ipv4(lan.host)>=ipv4(d.poolStart)&&ipv4(lan.host)<=ipv4(d.poolEnd)),'DHCP pool must exclude the LAN gateway.');
  choose(d.wanMode,['dhcp','static'],'WAN mode');let wan;
  if(d.wanMode==='static'){wan=hostCidr(d.wanAddress);inNet(d.gateway,wan,'ISP gateway');requireValue(d.gateway!==wan.host,'ISP gateway must differ from local WAN IP.');notOverlap(wan,lan);}
  return [{title:'MikroTik RouterOS v7',code:`# Empty-router IPv4 baseline; do not reset or blindly append to a live config.
/interface bridge add name=${d.bridge} protocol-mode=rstp
${ports.map(p=>`/interface bridge port add bridge=${d.bridge} interface=${p}`).join('\n')}
/interface list add name=NOC-LAN
/interface list member add list=NOC-LAN interface=${d.bridge}
/ip address add address=${d.lan} interface=${d.bridge}
${d.wanMode==='dhcp'?`/ip dhcp-client add interface=${d.wan} add-default-route=yes use-peer-dns=no disabled=no`:`/ip address add address=${d.wanAddress} interface=${d.wan}\n/ip route add dst-address=0.0.0.0/0 gateway=${d.gateway}`}
/ip dns set servers=${dns.join(',')} allow-remote-requests=no
/ip pool add name=NOC-POOL ranges=${d.poolStart}-${d.poolEnd}
/ip dhcp-server add name=NOC-DHCP interface=${d.bridge} address-pool=NOC-POOL lease-time=8h disabled=no
/ip dhcp-server network add address=${lan.canonical} gateway=${lan.host} dns-server=${dns.join(',')}
/ip firewall nat add chain=srcnat src-address=${lan.canonical} out-interface=${d.wan} action=masquerade comment="NOC LAN PAT"
/ip firewall filter add chain=NOC-IN connection-state=established,related,untracked action=accept
/ip firewall filter add chain=NOC-IN connection-state=invalid action=drop
${d.wanMode==='dhcp'?`/ip firewall filter add chain=NOC-IN in-interface=${d.wan} protocol=udp src-port=67 dst-port=68 action=accept\n`:''}/ip firewall filter add chain=NOC-IN protocol=icmp action=accept
/ip firewall filter add chain=NOC-IN in-interface=${d.bridge} src-address=${lan.canonical} action=accept
/ip firewall filter add chain=NOC-IN action=drop
/ip firewall filter add chain=NOC-FWD connection-state=established,related,untracked action=accept
/ip firewall filter add chain=NOC-FWD connection-state=invalid action=drop
/ip firewall filter add chain=NOC-FWD in-interface=${d.bridge} out-interface=${d.wan} src-address=${lan.canonical} action=accept
/ip firewall filter add chain=NOC-FWD action=drop
/ip firewall filter add chain=input action=jump jump-target=NOC-IN comment="NOC input entry"
/ip firewall filter add chain=forward action=jump jump-target=NOC-FWD comment="NOC forward entry"
/ip firewall filter move [find comment="NOC input entry"] 0
/ip firewall filter move [find comment="NOC forward entry"] 0
/ip service set telnet disabled=yes
/ip service set ftp disabled=yes
/ip service set www disabled=yes
/ip service set api disabled=yes
/ip service set api-ssl disabled=yes
/ip service set ssh address=${lan.canonical}
/ip service set winbox address=${lan.canonical}
/tool mac-server set allowed-interface-list=NOC-LAN
/tool mac-server mac-winbox set allowed-interface-list=NOC-LAN
# Set a strong administrator password locally; review IPv6 before enabling it.`}];
}
function enterprise(d){
  const wanErrors=validateWan({ip:d.wanAddress.split('/')[0],wanPrefix:d.wanAddress.split('/')[1],gateway:d.gateway});requireValue(!wanErrors.length,wanErrors.join(' '));
  [d.wan,d.trunk,d.uplink].forEach(iface);distinct(d.wan,d.trunk);const wan=hostCidr(d.wanAddress);inNet(d.gateway,wan,'ISP gateway');requireValue(d.gateway!==wan.host,'ISP gateway must differ from WAN IP.');
  const lines=d.vlans.trim().split('\n');requireValue(lines.length>=1&&lines.length<=32,'Use 1–32 VLAN rows.');
  const rows=lines.map(line=>{const p=line.split(',').map(v=>v.trim());requireValue(p.length===4,'VLAN row format: ID,Name,Gateway/prefix,AccessPort.');return {id:number(p[0],2,4094,'VLAN ID'),name:name(p[1],'VLAN name'),net:hostCidr(p[2]),port:iface(p[3])};});
  distinct(...rows.map(r=>String(r.id)));distinct(d.uplink,...rows.map(r=>r.port));for(let i=0;i<rows.length;i++){notOverlap(wan,rows[i].net);for(let j=0;j<i;j++)notOverlap(rows[i].net,rows[j].net);}
  const m=rows.find(r=>r.id===number(d.mgmtVlan,2,4094,'Management VLAN'));requireValue(m,'Management VLAN must be in the VLAN list.');inNet(d.mgmtIp,m.net,'Management IP');requireValue(d.mgmtIp!==m.net.host,'Switch IP must differ from its router gateway.');
  const allowed=rows.map(r=>r.id).join(',');
  return [{title:'Cisco Router · ISP / Router-on-a-Stick',code:wrap(`interface ${d.wan}
 ip address ${wan.host} ${wan.mask}
 ip nat outside
 no shutdown
 exit
interface ${d.trunk}
 no ip address
 no shutdown
 exit
${rows.map(r=>`interface ${d.trunk}.${r.id}\n encapsulation dot1Q ${r.id}\n ip address ${r.net.host} ${r.net.mask}\n ip nat inside\n exit`).join('\n')}
ip access-list standard NOC-PAT
${rows.map(r=>` permit ${r.net.ip} ${r.net.wildcard}`).join('\n')}
 exit
ip nat inside source list NOC-PAT interface ${d.wan} overload
ip route 0.0.0.0 0.0.0.0 ${d.gateway}`)},
  {title:'Cisco Layer 2 Switch',code:wrap(`no ip routing
spanning-tree mode rapid-pvst
${rows.map(r=>`vlan ${r.id}\n name ${r.name}\n exit`).join('\n')}
interface ${d.uplink}
 description TRUNK_TO_ROUTER
 switchport mode trunk
 switchport trunk allowed vlan ${allowed}
 no shutdown
 exit
${rows.map(r=>`interface ${r.port}\n switchport mode access\n switchport access vlan ${r.id}\n spanning-tree portfast\n spanning-tree bpduguard enable\n no shutdown\n exit`).join('\n')}
interface Vlan${m.id}
 ip address ${d.mgmtIp} ${m.net.mask}
 no shutdown
 exit
ip default-gateway ${m.net.host}`)}];
}
function routing(d){
  choose(d.protocol,['ospf','bgp'],'routing protocol');choose(d.vendor,['ios','mikrotik'],'vendor');unicast(d.routerId,'Router ID');
  if(d.protocol==='ospf'){
    const process=number(d.process,1,65535,'OSPF Process ID');ip(d.area,'Area ID');
    const lines=d.networks.trim().split('\n');requireValue(lines.length>=1&&lines.length<=32,'Use 1–32 network statements.');
    const networks=lines.map(line=>{const [address,wildcard,...extra]=line.trim().split(/\s+/);requireValue(!extra.length&&wildcard,'Use one network and wildcard per line.');ip(address);ip(wildcard,'Wildcard');const bits=32-Math.log2(ipv4(wildcard)+1);requireValue(Number.isInteger(bits),'OSPF wildcard must be contiguous.');const n=network(`${address}/${bits}`);return {address,wildcard,...n};});
    return [{title:`${d.vendor==='ios'?'Cisco IOS':'RouterOS v7'} · OSPF`,code:d.vendor==='ios'?wrap(`router ospf ${process}\n router-id ${d.routerId}\n${networks.map(n=>` network ${n.address} ${n.wildcard} area ${d.area}`).join('\n')}\n exit`):`/routing ospf instance add name=NOC-OSPF-${process} version=2 router-id=${d.routerId}\n/routing ospf area add name=NOC-AREA-${process} instance=NOC-OSPF-${process} area-id=${d.area}\n${networks.map(n=>`/routing ospf interface-template add networks=${n.canonical} area=NOC-AREA-${process}`).join('\n')}`}];
  }
  const local=number(d.localAs,1,4294967294,'Local AS'),remote=number(d.remoteAs,1,4294967294,'Remote AS');unicast(d.neighbor,'Neighbor');requireValue(d.neighbor!==d.routerId,'Neighbor must differ from Router ID.');
  if(d.vendor==='ios')return[{title:'Cisco IOS · BGP session',code:wrap(`route-map NOC-BGP-IN deny 10\n exit\nroute-map NOC-BGP-OUT deny 10\n exit\nrouter bgp ${local}\n bgp router-id ${d.routerId}\n bgp log-neighbor-changes\n neighbor ${d.neighbor} remote-as ${remote}\n address-family ipv4 unicast\n  neighbor ${d.neighbor} activate\n  neighbor ${d.neighbor} route-map NOC-BGP-IN in\n  neighbor ${d.neighbor} route-map NOC-BGP-OUT out\n exit-address-family\n exit\n! Replace deny-all route maps with approved prefix policies before exchanging routes.`)}];
  choose(d.rosVersion,['modern','classic'],'RouterOS version');
  return[{title:`RouterOS ${d.rosVersion==='modern'?'7.20+':'7.12–7.19'} · BGP session`,code:`/routing filter rule add chain=NOC-BGP-IN rule="reject;"
/routing filter rule add chain=NOC-BGP-OUT rule="reject;"
${d.rosVersion==='modern'?`/routing bgp instance add name=NOC-BGP as=${local} router-id=${d.routerId}\n`:''}/routing bgp connection add name=NOC-PEER ${d.rosVersion==='modern'?'instance=NOC-BGP':`as=${local} router-id=${d.routerId}`} remote.address=${d.neighbor} remote.as=${remote} local.role=${local===remote?'ibgp':'ebgp'} routing-table=main input.filter=NOC-BGP-IN output.filter-chain=NOC-BGP-OUT
# Replace reject-all filters with approved prefix policies before exchanging routes.`}];
}
function acl(d){
  choose(d.type,['standard','extended'],'ACL type');name(d.name,'ACL name');choose(d.action,['permit','deny'],'action');
  const source=aclAddress(d.source,d.sourceWildcard);let rule=`${d.action} ${source}`;
  if(d.type==='extended'){choose(d.protocol,['ip','tcp','udp','icmp'],'protocol');const destination=aclAddress(d.destination,d.destinationWildcard),ports=['tcp','udp'].includes(d.protocol);const sp=ports&&d.sourcePort?` eq ${number(d.sourcePort,1,65535,'Source port')}`:'',dp=ports&&d.destPort?` eq ${number(d.destPort,1,65535,'Destination port')}`:'';rule=`${d.action} ${d.protocol} ${source}${sp} ${destination}${dp}`;}
  return[{title:'Cisco IOS · Named ACL',code:wrap(`ip access-list ${d.type} ${d.name}\n 10 ${rule}\n exit\n! Implicit deny follows; apply the ACL to the intended interface/direction.`)}];
}
function nat(d){const n=network(d.network);name(d.acl,'ACL');iface(d.inside);iface(d.outside);distinct(d.inside,d.outside);return[{title:'Cisco IOS · PAT',code:wrap(`ip access-list standard ${d.acl}\n permit ${n.ip} ${n.wildcard}\n exit\ninterface ${d.inside}\n ip nat inside\n exit\ninterface ${d.outside}\n ip nat outside\n exit\nip nat inside source list ${d.acl} interface ${d.outside} overload`)}];}
function dhcp(d){
  name(d.name,'DHCP pool');const n=network(d.network);inNet(d.gateway,n,'Default router');const dns=dnsList(d.dns),ranges=[];const lease=number(d.leaseMinutes??'1440',2,43200,'Lease duration');
  for(const line of d.exclusions.trim()?d.exclusions.trim().split('\n'):[]){const a=line.trim().split(/\s+/);requireValue(a.length<=2,'Each exclusion line accepts start and optional end.');const start=a[0],end=a[1]||start;inNet(start,n,'Excluded start');inNet(end,n,'Excluded end');requireValue(ipv4(start)<=ipv4(end),'Excluded start must precede end.');ranges.push([ipv4(start),ipv4(end)]);}
  if(!ranges.some(([s,e])=>ipv4(d.gateway)>=s&&ipv4(d.gateway)<=e))ranges.push([ipv4(d.gateway),ipv4(d.gateway)]);
  ranges.sort((a,b)=>a[0]-b[0]);const merged=[];for(const r of ranges){const last=merged[merged.length-1];if(last&&r[0]<=last[1]+1)last[1]=Math.max(last[1],r[1]);else merged.push([...r]);}
  requireValue(merged.reduce((sum,[s,e])=>sum+e-s+1,0)<n.end-n.network-1,'Exclusions consume every usable address.');
  return[{title:'Cisco IOS · DHCP',code:wrap(`service dhcp\n${merged.map(([s,e])=>`ip dhcp excluded-address ${ipText(s)}${s===e?'':' '+ipText(e)}`).join('\n')}\nip dhcp pool ${d.name}\n network ${n.ip} ${n.mask}\n default-router ${d.gateway}\n dns-server ${dns.join(' ')}\n lease ${Math.floor(lease/1440)} ${Math.floor(lease%1440/60)} ${lease%60}\n exit`)}];
}
function security(d){iface(d.interface);const vlan=number(d.vlan,1,4094,'VLAN'),max=number(d.maximum,1,1024,'Maximum MACs');choose(d.violation,['shutdown','restrict','protect'],'violation');return[{title:'Cisco switch · Port security',code:wrap(`interface ${d.interface}\n switchport mode access\n switchport access vlan ${vlan}\n switchport port-security\n switchport port-security maximum ${max}\n switchport port-security violation ${d.violation}\n${d.sticky?' switchport port-security mac-address sticky\n':''} exit`)}];}
function hardening(d){name(d.hostname,'Hostname');name(d.username,'Username');requireValue(/^(?=.{3,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(d.domain),'Use a valid domain name.');for(const value of [d.secret,d.enableSecret])requireValue(typeof value==='string'&&value.length>=4&&!/[;|<>]/.test(value)&&/^[\x21-\x7e]+$/.test(value)&&!/[\"'?\\]/.test(value),'Passwords need at least 4 characters. Simple words or digits are accepted; spaces, quotes, backslashes and CLI control characters are not.');choose(d.rsa,['2048','3072','4096'],'RSA size');const sources=sshAllowedSources(d.sshSources);const acl=sources.length?`ip access-list standard NOC-SSH\n${sources.map(n=>` permit ${n.ip} ${n.wildcard}`).join('\n')}\n deny any log\n exit\n`:'';return[{title:'Cisco IOS · SSH hardening',code:wrap(`hostname ${d.hostname}\nip domain-name ${d.domain}\nenable secret ${d.enableSecret}\nusername ${d.username} privilege 15 secret ${d.secret}\ncrypto key generate rsa general-keys modulus ${d.rsa}\nip ssh version 2\nip ssh time-out 60\nip ssh authentication-retries 3\n${acl}${['0 4','5 15'].map(range=>`line vty ${range}\n${sources.length?' access-class NOC-SSH in\n':''} login local\n transport input ssh\n exec-timeout 10 0\n exit`).join('\n')}`)}];}
function staticRoute(d){ip(d.destination,'Destination');const prefix=maskPrefix(d.mask);network(`${d.destination}/${prefix}`);requireValue(d.nextHop||d.interface,'Supply a next hop or exit interface.');if(d.nextHop)unicast(d.nextHop,'Next hop');if(d.interface)iface(d.interface);const defaultRoute=d.destination==='0.0.0.0'&&d.mask==='0.0.0.0';if(defaultRoute)requireValue(d.nextHop,'Default route requires a next-hop IPv4 address.');const distance=d.distance?` ${number(d.distance,1,255,'Administrative distance')}`:'';return[{title:'Cisco IOS · Static route',code:wrap(`ip route ${d.destination} ${d.mask}${d.interface&&!defaultRoute?' '+d.interface:''}${d.nextHop?' '+d.nextHop:''}${distance}${d.permanent?' permanent':''}`)}];}
function vlan(d){
  const id=number(d.vlan,1,4094,'VLAN');name(d.name,'VLAN name');iface(d.interface);choose(d.mode,['access','trunk'],'port mode');let target=`interface ${d.interface}`;
  if(d.lastPort){const m=d.interface.match(/^([A-Za-z][A-Za-z0-9./]*\/)(\d+)$/);requireValue(m,'Range requires a numbered physical interface.');const last=number(d.lastPort,Number(m[2]),48,'Last port');target=`interface range ${d.interface} - ${last}`;}
  const allowed=d.mode==='trunk'?list(d.allowed).map(v=>number(v,1,4094,'Allowed VLAN')):[];if(d.mode==='trunk')requireValue(allowed.length>0&&new Set(allowed).size===allowed.length,'Enter unique allowed VLAN IDs.');
  return[{title:'Cisco switch · VLAN / Ports',code:wrap(`vlan ${id}\n name ${d.name}\n exit\n${target}\n switchport mode ${d.mode}\n${d.mode==='access'?` switchport access vlan ${id}\n spanning-tree portfast\n spanning-tree bpduguard enable`:` switchport trunk allowed vlan ${allowed.join(',')}`}\n no shutdown\n exit`)}];
}
const generators={bootstrap,enterprise,routing,acl,nat,dhcp,security,hardening,static:staticRoute,vlan};
export function generateTool(key,data){try{requireValue(Object.hasOwn(generators,key),'Select a configuration type.');const supported=key==='routing'?['ios','mikrotik']:key==='bootstrap'?['mikrotik']:['ios'];requireValue(supported.includes(data.vendor),'Selected vendor is not supported by this feature template. Interface and host configurations remain available in the topology. No CLI is emitted for this feature.');return {errors:[],scripts:generators[key](data)};}catch(error){return {errors:[error.message],scripts:[]};}}
