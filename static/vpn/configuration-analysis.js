import {cidr,ipv4} from './address.js';

export const CONFIG_EXPORTS={ios:'show running-config',mikrotik:'/export hide-sensitive',fortinet:'show full-configuration',juniper:'show configuration | display set | no-more',paloalto:'set cli config-output-format set; configure; show (run each command separately)'};
const vendors=Object.keys(CONFIG_EXPORTS),clean=s=>s.trim().replace(/\s+/g,' ');
const tokens=s=>s.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[[^\]]*\]|[^\s]+/g)||[];
const unquote=s=>s?.replace(/^(["'])(.*)\1$/,'$2');
const maskPrefix=mask=>{const n=ipv4(mask);if(n===null)return null;const bits=n.toString(2).padStart(32,'0');return /^1*0*$/.test(bits)?bits.indexOf('0')===-1?32:bits.indexOf('0'):null;};
const node=(text='',line=0)=>({text,line,children:[]});
const stop=/^(?:reload|write|copy|clear|debug|do |commit|execute|request |run |tclsh|event manager|macro name|\/system (?:script|scheduler)|\/tool fetch)\b/i;
function sourceLines(text){
 if(typeof text!=='string'||!text.trim())throw Error('Paste one complete device configuration.');
 if(text.length>200000)throw Error('Configuration is limited to 200,000 characters.');
 if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\x1b]/.test(text))throw Error('Remove terminal control characters before analysis.');
 const lines=text.replace(/\r/g,'').split('\n');if(lines.length>12000)throw Error('Configuration is limited to 12,000 lines.');return lines;
}
function parseIos(lines){
 const root=node(),stack=[{indent:-1,n:root}],nextLine=[];let followingLine;for(let j=lines.length-1;j>=0;j--){nextLine[j]=followingLine;if(lines[j].trim()&&!lines[j].trim().startsWith('!'))followingLine=lines[j];}
 for(let i=0;i<lines.length;i++){
  const raw=lines[i],s=raw.trim();if(!s||s.startsWith('!')||/^(?:Building configuration|Current configuration|version |Configuration register|Last configuration change|NVRAM config last updated|Using \d+|[\w.-]+[>#](?:show (?:run|running-config).*)?)$/.test(s))continue;
  if(/^(?:banner |crypto pki certificate|macro name|event manager|tclsh)/.test(s))throw Error('IOS multiline banners, certificates and executable blocks need a separate review. Paste a configuration without those blocks.');
  if(/^(?:configure terminal|conf t)$/.test(s)){stack.length=1;continue;}
  if(s==='end'){stack.length=1;continue;}
  if(/^exit(?:-address-family)?$/.test(s)){if(stack.length>1)stack.pop();continue;}
  if(/^(?:show |--More--|%)/.test(s))throw Error('Paste configuration commands only, without command output errors or pagination.');
  const indent=raw.search(/\S/);while(stack.length>1&&indent<=stack.at(-1).indent)stack.pop();
  const n=node(s,i+1);stack.at(-1).n.children.push(n);
  const following=nextLine[i];if(stack.length>64)throw Error('Configuration nesting is limited to 64 levels.');
  if(following&&following.search(/\S/)>indent&&!/^exit/.test(following.trim())||/^(?:class |ip sla |track |vrf definition |flow record |flow monitor |interface |router |ip (?:access-list |dhcp pool |vrf )|ipv6 (?:access-list |router )|line |route-map |crypto (?:map |isakmp policy |ikev2 |ipsec transform-set )|policy-map |class-map |control-plane|zone-pair |address-family |key chain |key \d|aaa group |vlan \d|spanning-tree mst configuration|service instance )/.test(s))stack.push({indent,n});
 }
 return root;
}
function parseForti(lines){
 const root=node(),stack=[root];
 for(let i=0;i<lines.length;i++){
  const s=lines[i].trim();if(!s||s.startsWith('#'))continue;
  if(s==='end'){if(!stack.at(-1).text.startsWith('config '))throw Error('FortiOS end/next nesting is incomplete.');stack.pop();continue;}
  if(s==='next'){if(!stack.at(-1).text.startsWith('edit '))throw Error('FortiOS next has no matching edit.');stack.pop();continue;}
  if(/^(config |edit )/.test(s)){const n=node(s,i+1);stack.at(-1).children.push(n);stack.push(n);if(stack.length>64)throw Error('Configuration nesting is limited to 64 levels.');continue;}
  if(!/^(?:set |unset |append |unselect )/.test(s)||stack.length<2)throw Error('Use FortiOS show configuration output with complete config/edit/next/end blocks.');
  if((s.match(/(?<!\\)"/g)||[]).length%2)throw Error('Multiline FortiOS values require a separate review.');
  stack.at(-1).children.push(node(s,i+1));
 }
 if(stack.length!==1)throw Error('FortiOS configuration is truncated: missing next/end.');return root;
}
function parseRos(lines){
 const root=node();let menu='',pending='';
 for(let i=0;i<lines.length;i++){
  let s=lines[i].trim();if(!s||s.startsWith('#'))continue;
  if(pending){s=pending+' '+s;pending='';}if(s.endsWith('\\')){pending=s.slice(0,-1);continue;}
  if(s.startsWith('/')){const m=s.match(/^(\/.*?)\s+(add|set|move|remove|enable|disable)\b(.*)$/);if(m){menu=m[1].replace(/\//g,' ').trim();s=m[2]+m[3];}else{menu=s.slice(1).replace(/\//g,' ').trim();continue;}}
  if(!menu||! /^(?:add|set|move|remove|enable|disable)\b/.test(s))throw Error('Use RouterOS /export output; terminal print tables and arbitrary scripts are not supported.');
  if(/[;{}]/.test(s.replace(/"(?:\\.|[^"\\])*"/g,'""'))||/\$|\[:|\b(?:on-event|script|source)=/.test(s))throw Error('RouterOS scripts and executable property values require separate review.');
  root.children.push(node('/'+menu+' '+s,i+1));
 }
 if(pending)throw Error('RouterOS export ends with an incomplete continued command.');return root;
}
function parseSet(lines,vendor){
 const root=node();
 for(let i=0;i<lines.length;i++){
  const s=lines[i].trim();if(!s||s.startsWith('#')||/^(?:configure|exit|quit|show \| compare)$/.test(s))continue;
  if(!s.startsWith('set ')&&!s.startsWith('move '))throw Error('Paste '+(vendor==='juniper'?'Junos display set':'PAN-OS set-format')+' configuration. Use the export command shown above the input.');
  if(/[;{}]|\$\(|`/.test(s))throw Error('Only complete set-format commands are supported.');root.children.push(node(s,i+1));
 }
 return root;
}
function coalesce(root){const out=node(),sections=new Map();for(const n of root.children){if(n.children.length&&n.text!=='edit 0'&&sections.has(n.text)){sections.get(n.text).children.push(...n.children);}else{out.children.push(n);if(n.children.length)sections.set(n.text,n);}}for(const n of out.children)if(n.children.length)n.children=coalesce(n).children;return out;}
function parse(text,vendor){if(!vendors.includes(vendor))throw Error('Choose a supported device vendor.');const lines=sourceLines(text),root=vendor==='ios'?parseIos(lines):vendor==='fortinet'?parseForti(lines):vendor==='mikrotik'?parseRos(lines):parseSet(lines,vendor);if(!root.children.length)throw Error('No configuration commands were found.');return coalesce(root);}
function flatten(root,path=[]){return root.children.flatMap(n=>n.children.length?flatten(n,[...path,n.text]):[{path,text:n.text,line:n.line,full:[...path,n.text].join(' ')}]);}

// Positive configuration evidence only. Presence does not prove runtime operation.
const RULES={
 interfaces:/\b(?:ip address \d+(?:\.\d+){3}|ip address add|set ip \d+(?:\.\d+){3}|family inet address|layer3 ip)\b/,
 dns:/\b(?:ip name-server|ip dns set|config system dns|system name-server|dns-setting servers)\b/,
 nat:/\b(?:ip nat inside source|firewall nat|security nat|rulebase nat rules|set nat enable)\b/,
 portforward:/\b(?:ip nat inside source static (?:tcp|udp)|action=dst-nat|config firewall vip|destination-nat|destination-translation)\b/,
 dhcp:/\b(?:ip dhcp pool|ip dhcp-server (?:add|network)|config system dhcp server|dhcp-local-server|dhcp server)\b/,
 relay:/\b(?:ip helper-address|ip dhcp-relay|config system dhcp|dhcp-relay|bootp helper|relay server|network dhcp interface.*relay ip)/,
 static:/\b(?:ip route |ip route add|config router static|routing-options static route|routing-table ip static-route)/,
 static6:/\b(?:ipv6 route|ipv6 route add|config router static6|rib inet6|routing-table ipv6 static-route)/,
 ospf:/\b(?:router ospf |routing ospf|config router ospf |protocols ospf |protocol ospf )/,
 ospf3:/\b(?:ipv6 router ospf|router ospfv3|routing ospf.*version=3|config router ospf6|protocols ospf3|protocol ospfv3)/,
 ospf_advanced:/\b(?:ip ospf authentication|area \S+ range|area \S+ authentication)/,
 bgp:/\b(?:router bgp |routing bgp |config router bgp |protocols bgp |protocol bgp )/,
 eigrp:/\brouter eigrp /,isis:/\b(?:router isis |protocols isis )/,
 redistribution:/\b(?:redistribute |redistribute-internal|redistribution-profile|protocols (?:ospf|bgp|isis) export)/,
 pbr:/\b(?:ip policy route-map|routing rule|firewall mangle.*mark-routing|config router policy|forwarding-options filter|rulebase pbf)/,
 hardening:/\b(?:ip ssh version|transport input ssh|ip service set.*ssh|allowaccess.*ssh|services ssh|service disable-ssh no)/,
 aaa:/\b(?:aaa new-model|aaa authentication|radius-server|tacacs server|\/radius |config user radius|config user tacacs|system radius-server|authentication-profile)/,
 vpn:/\b(?:crypto (?:map|isakmp|ikev2|ipsec)|ip ipsec|config vpn ipsec|security (?:ike|ipsec)|network (?:ike|tunnel ipsec)|interface wireguard)/,
 remotevpn:/\b(?:config vpn ssl|interface ovpn-client|remote-access|global-protect)/,
 dmvpn:/\b(?:ip nhrp|tunnel mode gre multipoint)/,
 gre_tunnel:/\b(?:tunnel mode gre|interface gre|config system gre-tunnel|interfaces gr-)/,
 vxlan:/\b(?:vxlan|encapsulation vxlan|vni \d+)/,
 acl:/\b(?:ip access-list|access-list \d+|firewall filter|config firewall policy|firewall family|rulebase security rules)/,
 zbfw:/\b(?:zone-pair security|zone-member security|config firewall policy|security policies|rulebase security rules)/,
 copp:/\b(?:control-plane|control-plane policing|policy-map NOC-COPP)/,urpf:/\b(?:ip verify unicast|rp-filter=(?:strict|loose)|rpf-check|rpf-check yes)/,
 ntp_syslog:/\b(?:ntp server|system ntp client|config system ntp|system ntp server|ntp-servers primary-ntp-server)/,
 snmp3:/\b(?:snmp-server (?:group|user)|snmp community.*security=|config system snmp user|snmp v3|snmp-setting access-setting version v3)/,
 qos:/\b(?:service-policy|policy-map|queue (?:simple|tree)|config firewall shaping|class-of-service|qos profile|action=change-dscp|then dscp)/,
 fhrp:/\b(?:standby \d+|vrrp|redundancy-group)/,glbp:/\bglbp \d+/,
 ipsla:/\b(?:ip sla \d+|netwatch|config system link-monitor|services rpm)/,
 bfd:/\bbfd\b/,multicast:/\b(?:ip multicast-routing|ip pim|routing pim|config router multicast|protocols pim|multicast-routing)/,
 automation:/\b(?:netconf-yang|restconf|services netconf|ip service.*api|rest-api)/,
 vlan:/\b(?:vlan \d+|encapsulation dot1[qQ]|switchport |interface vlan|config system interface.*set vlanid|interfaces.*vlan-id|set vlans |interface bridge vlan|pvid=)/,
 stp:/\b(?:spanning-tree|protocol-mode=(?:rstp|mstp)|protocols (?:rstp|mstp))/,etherchannel:/\b(?:channel-group|interface bonding|ether-options 802.3ad)/,
 security:/\bswitchport port-security/,snooping:/\b(?:ip dhcp snooping|dhcp-snooping=yes)/,bpduguard:/\b(?:bpduguard|bpdu-guard=yes)/,
 span:/\b(?:monitor session|port-mirroring|mirror-source)/,pvlan:/\bprivate-vlan/
};
const attrs=line=>Object.fromEntries([...line.matchAll(/([\w-]+)=("(?:\\.|[^"\\])*"|[^\s]+)/g)].map(m=>[m[1],unquote(m[2])]));
function inventory(root,vendor){
 const out=[],add=(id,address,mask)=>{let prefix=address?.split('/')[1];if(!prefix&&mask)prefix=maskPrefix(mask);const ip=address?.split('/')[0],n=cidr(ip+'/'+prefix);if(id&&n&&ipv4(ip)>0&&ipv4(ip)<0xe0000000&&!out.some(x=>x.id===id))out.push({id,ip,prefix:String(prefix),network:n.canonical});};
 if(vendor==='ios')for(const n of root.children)if(n.text.startsWith('interface '))for(const l of n.children){const m=l.text.match(/^ip address (\S+) (\S+)(?: secondary)?$/);if(m&&!l.text.endsWith(' secondary'))add(n.text.slice(10),m[1],m[2]);}
 if(vendor==='fortinet')for(const section of root.children.filter(n=>n.text==='config system interface'))for(const n of section.children){const l=n.children.find(x=>x.text.startsWith('set ip '));if(l){const t=tokens(l.text);add(unquote(n.text.slice(5)),t[2],t[3]);}}
 for(const l of flatten(root)){
  if(vendor==='mikrotik'&&l.text.startsWith('/ip address add ')){const a=attrs(l.text);add(a.interface,a.address);}
  if(vendor==='juniper'){const m=l.text.match(/^set interfaces (\S+) unit (\d+) family inet address (\S+)/);if(m)add(m[1]+(m[2]==='0'?'':'.'+m[2]),m[3]);}
  if(vendor==='paloalto'){const m=l.text.match(/^set network interface ethernet (\S+) layer3 ip (\S+)/);if(m)add(m[1],m[2]);}
 }
 return out;
}
export function analyzeConfiguration(text,vendor){
 try{
  const root=parse(text,vendor),leaves=flatten(root),detected={};
  for(const l of leaves){if(/^(?:no |unset |delete |deactivate )/.test(l.text)||/\bdisabled=yes\b/.test(l.text))continue;for(const [id,re]of Object.entries(RULES))if(re.test(l.full)){if(!detected[id])detected[id]={lines:[]};if(!detected[id].lines.includes(l.line)&&detected[id].lines.length<5)detected[id].lines.push(l.line);}}
  // Relay requires a relay command, not merely the FortiOS DHCP section.
  if(vendor==='fortinet'&&!leaves.some(l=>/dhcp-relay/.test(l.full)))delete detected.relay;
  const interfaces=inventory(root,vendor),warnings=['Detected = configured command evidence, not live health. Unrecognized commands are preserved on the device and are not replayed.'];
  const defaults=leaves.filter(l=>/^(?:ip route 0\.0\.0\.0 0\.0\.0\.0|\/ip route add.*dst-address=0\.0\.0\.0\/0|set routing-options static route 0\.0\.0\.0\/0)/.test(l.text));
  let gateway='';for(const l of defaults){const m=l.text.match(/(?:next-hop |gateway=|0\.0\.0\.0 0\.0\.0\.0 )(\d+\.\d+\.\d+\.\d+)/);if(m){gateway=m[1];break;}}
  if(vendor==='fortinet')for(const sec of root.children.filter(n=>n.text==='config router static'))for(const e of sec.children){if(!e.children.some(l=>/^set dst /.test(l.text)&&!/^set dst 0\.0\.0\.0 0\.0\.0\.0$/.test(l.text))){const m=e.children.find(l=>l.text.startsWith('set gateway '));if(m)gateway=m.text.slice(12);}}
  if(vendor==='paloalto')for(const l of leaves)if(/destination 0\.0\.0\.0\/0/.test(l.text)){const m=l.text.match(/nexthop ip-address (\S+)/);if(m)gateway=m[1];}
  const natWan=vendor==='ios'?root.children.filter(n=>n.text.startsWith('interface ')).find(n=>n.children.some(l=>l.text==='ip nat outside'))?.text.slice(10):vendor==='mikrotik'?leaves.map(l=>/\/ip firewall nat.*chain=srcnat/.test(l.text)?attrs(l.text)['out-interface']:null).find(Boolean):'';
  if(defaults.length>1)detected.wan_failover={lines:defaults.slice(0,5).map(l=>l.line)};
  const wan=interfaces.find(i=>i.id===natWan)||interfaces.find(i=>gateway&&cidr(i.ip+'/'+i.prefix).network<=ipv4(gateway)&&cidr(i.ip+'/'+i.prefix).end>=ipv4(gateway));
  const lan=interfaces.find(i=>i.id!==wan?.id&&!/^(?:Loopback|lo|Tunnel|st\.|tunnel\.)/.test(i.id));
  if(interfaces.length>2)warnings.push('Multiple interfaces detected: choose the actual WAN and LAN before applying topology suggestions.');
  const firmware=vendor==='ios'?text.match(/^version (\d+(?:\.\d+)+)/m)?.[1]:vendor==='mikrotik'?text.match(/RouterOS\s+(\d+(?:\.\d+)+)/i)?.[1]:vendor==='fortinet'?text.match(/(?:FortiOS|FortiGate[^\n]*?\bv|config-version=[^\n]*?-)(\d+(?:\.\d+)+)/i)?.[1]:undefined;
  return {errors:[],detected,interfaces,gateway,suggestedWan:wan?.id||'',suggestedLan:lan?.id||'',firmware:firmware||'',warnings,commands:leaves.length};
 }catch(error){return {errors:[error.message],detected:{},interfaces:[],gateway:'',warnings:[]};}
}

const canonical=n=>n.children.length?n.text+'\n'+n.children.map(canonical).join('\n'):clean(n.text);
function iosKey(s){
 const t=tokens(s),positive=s.replace(/^no /,'');
 if(/^ip nat (inside|outside)$/.test(positive))return positive;
 if(/^ip access-group /.test(s))return 'ip access-group '+t.at(-1);
 if(/^access-class /.test(s))return 'access-class '+t.at(-1);
 const m=positive.match(/^(?:ip address|ipv6 address|description|ip mtu|ip tcp adjust-mss|ip access-group \S+|crypto map|encapsulation|switchport mode|switchport access vlan|switchport trunk allowed vlan|tunnel source|tunnel destination|tunnel mode|tunnel protection|router-id|default-router|dns-server|network|lease|hostname|ip domain.name|enable (?:algorithm-type \S+ )?secret|ip ssh version|transport input|login|access-class \S+|shutdown)(?= |$)/);
 if(m)return m[0];if(/^username /.test(s))return t.slice(0,2).join(' ');
 if(/^ip route /.test(s))return t.slice(0,4).join(' ');
 if(/^crypto isakmp key /.test(s))return 'crypto isakmp key address '+t.at(-1);
 if(/^ip nat inside source static (?:tcp|udp) /.test(s))return 'portforward '+t[5]+' '+(t[8]==='interface'?t[9]+' '+t[10]:t[8]+' '+t[9]);
 return s;
}
function fortiKey(s){return /^(?:set|unset|append|unselect) /.test(s)?tokens(s).slice(1,2).join(' '):s;}
function diffTree(prior,next,vendor){
 const out=node(),old=new Map(prior.children.map(n=>[n.text,n]));
 for(const n of next.children){let before=old.get(n.text),copy={...n,children:[]};
  if(vendor==='fortinet'&&n.text==='edit 0'){
   const name=n.children.find(x=>x.text.startsWith('set name '));if(name){const matches=prior.children.filter(x=>x.children.some(y=>y.text===name.text));if(matches.length>1)throw Error('Ambiguous existing named FortiOS policy. Choose a unique policy name.');if(matches.length){before=matches[0];copy.text=before.text;}}
  }
  if(n.children.length){
   if(before&&!before.children.length&&vendor==='fortinet')throw Error('Existing section type conflicts with the selected feature.');
   if(vendor==='ios'&&/^ip access-list /.test(n.text)&&prior.children.some(x=>/^ip access-list /.test(x.text)&&tokens(x.text).at(-1)===tokens(n.text).at(-1)&&x.text!==n.text))throw Error('An existing ACL uses this name with a different type. Choose another name.');
   if(before&&vendor==='ios'&&/^(?:ip access-list |route-map |crypto |policy-map |class-map )/.test(n.text)&&canonical(before)!==canonical(n))throw Error('An existing ordered ACL, crypto or policy definition uses the generated name. Choose a new name or reconcile it first.');
   copy.children=diffTree(before||node(),n,vendor).children;if(copy.children.length)out.children.push(copy);continue;
  }
  if(before)continue;
  const key=vendor==='ios'?iosKey(n.text):fortiKey(n.text);
  if(vendor==='fortinet'&&n.text.startsWith('append ')){const values=tokens(n.text).slice(2),priorSet=prior.children.find(x=>x.text.startsWith('set '+key+' '));if(priorSet){const present=tokens(priorSet.text).slice(2);if(values.every(v=>present.includes(v)))continue;out.children.push(copy);continue;}}
  if(prior.children.some(x=>!x.children.length&&(vendor==='ios'?iosKey(x.text):fortiKey(x.text))===key))throw Error('A generated setting would change an existing value. Review the feature inputs; additions-only mode does not overwrite existing settings.');
  if(vendor==='ios'&&n.text.startsWith('no ')&&prior.children.some(x=>x.text===n.text.slice(3)))throw Error('The selected feature removes an existing command. Reconcile this change separately.');
  if(stop.test(n.text))throw Error('Operational or executable commands are not allowed in an additions script.');out.children.push(copy);
 }
 return out;
}
function renderTree(root,vendor,depth=0){return root.children.flatMap(n=>n.children.length?[(' '.repeat(depth))+n.text,...renderTree(n,vendor,depth+1),(' '.repeat(depth))+(vendor==='ios'?'exit':n.text.startsWith('edit ')?'next':'end')]:[(' '.repeat(depth))+n.text]);}
function rosIdentity(line){
 const m=line.match(/^(\/.*?) (add|set|move|remove|enable|disable)(?: |$)(.*)/),a=attrs(line);if(!m)return line;
 if(m[2]==='add'){
  if(a.name)return m[1]+' name='+a.name;
  if(m[1]==='/ip address')return m[1]+' interface='+a.interface+' address='+a.address;
  if(m[1].endsWith('dhcp-server network'))return m[1]+' address='+a.address;
  if(m[1]==='/ip firewall nat'&&a.chain==='dstnat')return m[1]+' '+[a.chain,a.protocol,a['dst-address'],a['dst-port'],a['in-interface']].join('|');
  if(a.comment)return m[1]+' comment='+a.comment;
  return clean(line);
 }
 return m[1]+' '+m[2]+' '+(m[3].startsWith('[')?m[3].slice(0,m[3].indexOf(']')+1):m[3].split(' ')[0]&&!m[3].split(' ')[0].includes('=')?m[3].split(' ')[0]:'global');
}
function semanticRos(line){const m=line.match(/^(\/.*?) (add|set)(?: |$)(.*)/);if(!m)return clean(line);const a=attrs(line);delete a.comment;if(a.disabled==='no')delete a.disabled;const target=m[2]==='set'?(m[3].startsWith('[')?m[3].slice(0,m[3].indexOf(']')+1):m[3].split(' ')[0]&&!m[3].split(' ')[0].includes('=')?m[3].split(' ')[0]:'global'):'';return m[1]+' '+m[2]+' '+target+' '+Object.entries(a).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join(' ');}
function diffRos(prior,next){
 const out=[],old=prior.children.map(n=>n.text);
 for(const n of next.children){const s=n.text;if(old.some(l=>semanticRos(l)===semanticRos(s)))continue;
  if(/^\/.* (?:remove|disable|enable)\b/.test(s))throw Error('RouterOS removal or enable/disable changes need a separate reviewed script.');
  const existing=old.find(l=>rosIdentity(l)===rosIdentity(s));if(existing)throw Error('RouterOS already has an object or setting with this name/selector. Choose another name or reconcile its values.');
  if(/^\/ip address add /.test(s)){const a=attrs(s);if(old.some(l=>l.startsWith('/ip address add ')&&attrs(l).interface===a.interface))throw Error('The selected interface already has an address. Confirm topology instead of adding another address.');}
  if(/^\/.* set /.test(s)&&/\[find/.test(s))throw Error('RouterOS selector-based updates require a separate review of the matching existing objects.');
  out.push(s);
 }
 return out;
}
function setKey(s,vendor){
 const t=tokens(s);if(vendor==='juniper'){
  const at=t.indexOf('address');if(t[1]==='interfaces'&&at>0)return t.slice(0,at).join(' ')+' address';
  const route=t.indexOf('route');if(t[1]==='routing-options'&&route>0)return t.slice(0,route+2).join(' ');
 }
 if(vendor==='paloalto'){
  const rules=t.indexOf('rules');if(rules>0)return t.slice(0,rules+2).join(' ')+' '+t[rules+2];
  const at=t.indexOf('static-route');if(at>0)return t.slice(0,at+3).join(' ');
 }
 return t.slice(0,-1).join(' ');
}
function diffSet(prior,next,vendor){
 const old=prior.children.map(n=>clean(n.text)),out=[];
 for(const n of next.children){const s=clean(n.text);if(old.includes(s))continue;
  if(s.startsWith('move ')){if(vendor!=='paloalto'||!/^move rulebase nat rules [A-Za-z][\w-]* top$/.test(s))throw Error('Ordered policy updates need separate review.');out.push(s);continue;}
  if(vendor==='paloalto'&&/^set rulebase (?:nat|security) rules /.test(s)&&old.some(l=>tokens(l).slice(0,5).join(' ')===tokens(s).slice(0,5).join(' ')))throw Error('An existing PAN-OS policy uses this rule name. Choose a new name or reconcile its fields first.');
  if(old.some(l=>setKey(l,vendor)===setKey(s,vendor)))throw Error('A generated set command changes an existing object property. Choose a new object name or reconcile the setting.');out.push(s);
 }
 return out;
}
function ciscoNatExemption(prior,site,peer,approved){
 const local=cidr(site.local),remote=cidr(peer.local);if(!local||!remote)throw Error('Confirm both protected LANs before adding VPN NAT exemption.');
 const deny=`deny ip ${local.ip} ${local.wildcard} ${remote.ip} ${remote.wildcard}`;
 const rules=prior.children.filter(n=>/^ip nat inside source /.test(n.text)&&!n.children.length);
 const pats=rules.filter(n=>/^ip nat inside source list \S+ interface \S+ overload$/.test(n.text));
 if(prior.children.some(n=>n.text==='ip access-list extended NOC-ADD-VPN-NAT'&&n.children[0]?.text===deny)&&rules.some(n=>n.text==='ip nat inside source route-map NOC-ADD-VPN-PAT interface '+site.wan+' overload'))return [];
 if(pats.length!==1||rules.length!==1)throw Error('Automatic VPN exemption supports one ACL-based Cisco interface PAT rule. Multiple/static/route-map NAT needs a separate reviewed exemption design.');
 const pat=pats[0].text,t=tokens(pat),name=t[5],wan=t[7];if(wan!==site.wan)throw Error('Existing PAT WAN differs from the selected WAN interface. Apply and verify the detected interface addresses first.');
 const standard=prior.children.find(n=>n.text==='ip access-list standard '+name),extended=prior.children.find(n=>n.text==='ip access-list extended '+name);
 const oldRules=(standard||extended)?.children.map(n=>n.text)||prior.children.filter(n=>n.text.startsWith('access-list '+name+' ')).map(n=>n.text.slice(('access-list '+name+' ').length));
 const isStandard=Boolean(standard)||(!extended&&/^\d+$/.test(name)&&(+name<=99||+name>=1300&&+name<=1999));
 if(!oldRules.length)throw Error('Referenced existing PAT ACL was not found in the pasted configuration. Paste the complete running configuration.');
 const preserved=oldRules.map(s=>s.replace(/^\d+ /,'')).filter(s=>!s.startsWith('remark '));
 if(extended&&preserved[0]===deny)return [];
 if(!approved)throw Error('This VPN needs NAT exemption. Review and enable the Cisco PAT exemption update option above; it replaces only the single detected PAT binding and preserves its ACL traffic rules.');
 if(prior.children.some(n=>/NOC-ADD-VPN-(?:NAT|PAT)/.test(n.text)))throw Error('The reserved VPN exemption names are already in use. Reconcile the existing definitions before proceeding.');
 const converted=preserved.map(s=>{if(!/^(permit|deny) /.test(s)||/\b(?:reflect|evaluate|dynamic|time-range)\b/.test(s))throw Error('The existing PAT ACL contains unsupported dynamic or scheduled entries. Review NAT exemption separately.');if(!isStandard)return s;const m=s.match(/^(permit|deny) (any|host \d+\.\d+\.\d+\.\d+|\d+\.\d+\.\d+\.\d+(?: \d+\.\d+\.\d+\.\d+)?)( log)?$/);if(!m)throw Error('The standard PAT ACL format cannot be converted without review.');let source=m[2];if(/^\d+(?:\.\d+){3}$/.test(source))source='host '+source;return m[1]+' ip '+source+' any'+(m[3]||'');});
 const pt=site.routerModel?.endsWith('(Packet Tracer)');
 return ['! Required VPN exemption: preserve existing PAT policy while excluding the peer LAN','ip access-list extended NOC-ADD-VPN-NAT',' '+deny,...converted.map(s=>' '+s),'exit',...(!pt?['route-map NOC-ADD-VPN-PAT permit 10',' match ip address NOC-ADD-VPN-NAT','exit']:[]),'no '+pat,'ip nat inside source '+(pt?'list NOC-ADD-VPN-NAT':'route-map NOC-ADD-VPN-PAT')+' interface '+wan+' overload'];
}
export function additionsConfiguration(existing,generated,vendor,{selected={},site={},peer={},includeNatExemption=false}={}){
 const fail=message=>({errors:['Existing configuration: '+message],code:'',empty:false});
 try{
  const prior=parse(existing,vendor),next=parse(generated,vendor),analysis=analyzeConfiguration(existing,vendor);
  if(vendor==='ios'&&analysis.firmware.startsWith('12.')&&/crypto ikev2|netconf-yang|restconf/.test(generated))throw Error('The pasted configuration reports IOS 12.x. Select its matching classic IOS image profile; IKEv2 / NETCONF / RESTCONF commands are not supplied for that profile.');
  if(vendor==='mikrotik'&&analysis.firmware.startsWith('6.')&&/\/system ntp client servers|\/interface wireguard|\/routing (?:bgp|ospf|table|rule|filter)/.test(generated))throw Error('The pasted export reports RouterOS 6. Select the RouterOS 6 image/profile before generating version-specific commands.');
  if(selected.bootstrap||selected.enterprise)throw Error('Empty-device setup presets cannot be added to an existing configuration. Choose individual services.');
  if(selected.internet_access&&['nat','dhcp','static','zbfw'].some(id=>analysis.detected[id]))throw Error('Existing gateway components were detected. Choose individual new services instead of applying a complete Internet Gateway preset over them.');
  const natPlan=selected.vpn&&analysis.detected.nat&&vendor==='ios'?ciscoNatExemption(prior,site,peer,includeNatExemption):[];
  if(selected.vpn&&vendor==='juniper'&&analysis.detected.nat){
   const old=flatten(prior).map(l=>l.text),fresh=flatten(next).map(l=>l.text),vpnZone=fresh.map(s=>s.match(/^set security zones security-zone (\S+) interfaces st\./)?.[1]).find(Boolean);
   const sets=[...new Set(old.map(s=>s.match(/^set security nat source rule-set (\S+)/)?.[1]).filter(Boolean))];
   if(!vpnZone||!sets.length||sets.some(name=>!old.some(s=>s.startsWith('set security nat source rule-set '+name+' to zone ')&&!s.endsWith(' '+vpnZone))))throw Error('Existing Junos NAT must explicitly exclude the new VPN zone. Review zone matching / NAT exemption before adding this tunnel.');
  }
  if(selected.dhcp&&analysis.detected.relay||selected.relay&&analysis.detected.dhcp)throw Error('Existing DHCP server/relay evidence conflicts with this addition. Confirm a separate target interface or reconcile the existing service.');
  if(selected.nat&&analysis.detected.nat)throw Error('NAT is already configured. Select VPN or port forwarding directly; a second independent NAT template could overlap the existing translation policy.');
  if(selected.dhcp&&analysis.detected.dhcp){
   if(vendor==='ios')for(const pool of next.children.filter(n=>n.text.startsWith('ip dhcp pool '))){const net=pool.children.find(n=>n.text.startsWith('network '));if(net&&prior.children.some(n=>n.text.startsWith('ip dhcp pool ')&&n.text!==pool.text&&n.children.some(l=>l.text===net.text)))throw Error('Another existing DHCP pool already serves this network. Use that pool name or select a different network.');}
   if(vendor==='mikrotik')for(const n of next.children.filter(n=>n.text.startsWith('/ip dhcp-server add '))){const a=attrs(n.text);if(prior.children.some(p=>p.text.startsWith('/ip dhcp-server add ')&&attrs(p.text).interface===a.interface&&attrs(p.text).name!==a.name))throw Error('Another RouterOS DHCP server already uses this interface.');}
   if(vendor==='fortinet'){const old=prior.children.find(n=>n.text==='config system dhcp server'),fresh=next.children.find(n=>n.text==='config system dhcp server');for(const n of fresh?.children||[]){const target=n.children.find(l=>l.text.startsWith('set interface '));if(target&&old?.children.some(p=>p.text!==n.text&&p.children.some(l=>l.text===target.text)))throw Error('Another FortiOS DHCP server ID already uses this interface.');}}
  }
  let lines;
  if(vendor==='ios'||vendor==='fortinet')lines=renderTree(diffTree(prior,next,vendor),vendor);
  else if(vendor==='mikrotik')lines=diffRos(prior,next);else lines=diffSet(prior,next,vendor);
  if(natPlan.length)lines=[...natPlan,...lines];
  const comment=vendor==='ios'?'!':'#';
  const warnings=[];if(analysis.detected.acl||analysis.detected.zbfw)warnings.push('Existing firewall / ACL order must allow the new traffic; no existing policy is moved or disabled.');
  if(!lines.length)return {errors:[],code:'',empty:true,warnings:['All selected commands already exist. No additions are required.']};
  const notes=[...new Set(generated.replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(s=>s.startsWith(comment)&&s.length>1))].filter(s=>!(selected.vpn&&vendor==='ios'&&analysis.detected.nat&&s.includes('Merge NAT exemption into the existing NAT ACL'))).slice(0,200);
  const code=[comment+' Additions only: existing configuration is not replayed',...warnings.map(w=>comment+' '+w),...notes,...(vendor==='ios'?['configure terminal']:['juniper','paloalto'].includes(vendor)?['configure']:[]),...lines,...(vendor==='ios'?['end']:['juniper','paloalto'].includes(vendor)?['# Validate and commit the candidate separately.']:[])].join('\n')+'\n';
  return {errors:[],code,empty:false,warnings};
 }catch(error){return fail(error.message);}
}
