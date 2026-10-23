import { TOOLS, defaultsFor, generateTool, network, number, ip } from './catalog.js';
import { cidr, ipv4 } from './address.js';
import { PLATFORMS } from './platforms.js';

export const FEATURES = {
  nat:{title:'NAT / PAT',role:'router',tool:'nat',vendors:['ios','mikrotik']},
  acl:{title:'Access control lists',role:'router',tool:'acl',vendors:['ios']},
  static:{title:'Static routes',role:'router',tool:'static',vendors:Object.keys(PLATFORMS)},
  dhcp:{title:'DHCP server',role:'router',tool:'dhcp',vendors:['ios','mikrotik','fortinet']},
  ospf:{title:'OSPF',role:'router',tool:'routing',vendors:['ios','mikrotik','juniper','fortinet']},
  bgp:{title:'BGP',role:'router',tool:'routing',vendors:['ios','mikrotik','juniper','fortinet']},
  hardening:{title:'SSH / Device hardening',role:'router',tool:'hardening',vendors:['ios']},
  vpn:{title:'VPN',role:'router',vendors:Object.keys(PLATFORMS)},
  bootstrap:{title:'Initial setup (empty router)',role:'router',tool:'bootstrap',vendors:['mikrotik']},
  enterprise:{title:'Router-on-a-stick / VLAN gateways',role:'router',tool:'enterprise',vendors:['ios']},
  vlan:{title:'VLANs · Access / Trunk ports',role:'switch',tool:'vlan',vendors:['ios','juniper','mikrotik']},
  security:{title:'Port security',role:'switch',tool:'security',vendors:['ios']},
};
export const VPN_TYPES={ikev2:'IPsec · IKEv2',ikev1:'IPsec · IKEv1',vti:'VTI · Cisco IKEv1',gre:'GRE over IPsec',wireguard:'WireGuard',openvpn:'OpenVPN · RouterOS client',ssl:'SSL VPN · FortiOS 7.4 server'};
export const capable=(id,vendor)=>Boolean(FEATURES[id]?.vendors.includes(vendor));
export function featureDefaults(id,vendor){const d={...(FEATURES[id]?.tool?defaultsFor(FEATURES[id].tool):{}),vendor,...(['ospf','bgp'].includes(id)?{protocol:id}:{})};for(const f of featureFields(id,vendor))if(!Object.hasOwn(d,f.key))d[f.key]=f.value;if(id==='dhcp'&&vendor!=='ios')d.dns='1.1.1.1';return d;}
export function featureFields(id,vendor) {
  if(id==='vpn')return [];
  if(id==='dhcp'&&vendor!=='ios')return [{key:'poolStart',label:'DHCP pool start',value:'10.10.0.50',type:'text'},{key:'poolEnd',label:'DHCP pool end',value:'10.10.0.200',type:'text'},{key:'dns',label:'DNS server',value:'1.1.1.1',type:'text'},...(vendor==='fortinet'?[{key:'serverId',label:'Unused DHCP server ID',value:'9000',type:'number'}]:[])];
  const fields=TOOLS[FEATURES[id].tool].fields.filter(f=>!['vendor',...(['ospf','bgp'].includes(id)?['protocol']:[])].includes(f.key)&&!(id==='nat'&&vendor==='mikrotik'&&f.key==='acl')&&!(id==='static'&&vendor!=='ios'&&['permanent','interface'].includes(f.key))&&!(vendor==='juniper'&&id==='ospf'&&['process','networks'].includes(f.key))&&!(id==='vlan'&&vendor!=='ios'&&f.key==='lastPort'));
  if(vendor==='juniper'&&id==='ospf')fields.push({key:'ospfInterfaces',label:'OSPF logical interfaces (comma separated)',value:'ge-0/0/1.0',type:'text'});
  return fields;
}
const safeName=(v,label='Name')=>{if(!/^[A-Za-z][A-Za-z0-9._/-]{0,45}$/.test(v||''))throw Error(`${label}: invalid CLI identifier.`);return v;};
const unicast=(v,label)=>{ip(v,label);if(ipv4(v)===0||ipv4(v)>=3758096384||v.startsWith('127.'))throw Error(`${label}: use a unicast IPv4 address.`);return v;};
// Shared bindings are authoritative for address-dependent features.
export function boundValues(id,d,s){
  const result={...d,vendor:s.vendor};
  if(id==='nat')Object.assign(result,{network:s.local,inside:s.lan,outside:s.wan});
  if(id==='dhcp')Object.assign(result,{network:s.local,gateway:s.lanIp,interface:s.lan});
  if(id==='bootstrap')Object.assign(result,{wan:s.wan,wanAddress:`${s.ip}/${s.wanPrefix}`,gateway:s.gateway,lan:`${s.lanIp}/${s.local.split('/')[1]}`});
  return result;
}
export function generateFeature(id,data){
  try{
    if(!capable(id,data.vendor))throw Error(`${FEATURES[id]?.title||id} has no validated ${PLATFORMS[data.vendor]||'selected vendor'} template.`);
    if(id==='dhcp'&&data.vendor!=='ios'){
      const n=network(data.network);ip(data.gateway,'Gateway');ip(data.dns,'DNS');safeName(data.interface,'LAN interface');
      const start=ipv4(data.poolStart),end=ipv4(data.poolEnd),gw=ipv4(data.gateway);if(start===null||end===null||start> end||start<=n.network||end>=n.end||gw<=n.network||gw>=n.end||gw>=start&&gw<=end)throw Error('DHCP range must be inside LAN, ordered, and exclude the gateway.');
      let code;if(data.vendor==='mikrotik')code=`/ip pool add name=NOC-DHCP-POOL ranges=${data.poolStart}-${data.poolEnd}\n/ip dhcp-server add name=NOC-DHCP interface=${data.interface} address-pool=NOC-DHCP-POOL disabled=no\n/ip dhcp-server network add address=${n.canonical} gateway=${data.gateway} dns-server=${data.dns}\n# LAN interface must already have the gateway IP; review existing DHCP servers.`;
      else{number(data.serverId,1,4294967294,'DHCP server ID');code=`config system dhcp server\n edit ${data.serverId}\n  set interface "${data.interface}"\n  set default-gateway ${data.gateway}\n  set netmask ${n.mask}\n  set dns-service specify\n  set dns-server1 ${data.dns}\n  config ip-range\n   edit 1\n    set start-ip ${data.poolStart}\n    set end-ip ${data.poolEnd}\n   next\n  end\n next\nend`;}
      return{errors:[],scripts:[{title:`${PLATFORMS[data.vendor]} · DHCP`,code}]};
    }
    if(['ospf','bgp'].includes(id)&&data.vendor==='fortinet'){
      unicast(data.routerId,'Router ID');let code;
      if(id==='ospf'){
        ip(data.area,'Area ID');const start=number(data.process,1,65000,'Starting reserved network ID'),lines=String(data.networks).trim().split('\n');if(!lines.length||lines.length>32)throw Error('Use 1–32 network statements.');
        const nets=lines.map(line=>{const[a,w,...extra]=line.trim().split(/\s+/);if(extra.length||!w||ipv4(w)===null)throw Error('Use network and contiguous wildcard per line.');const prefix=32-Math.log2(ipv4(w)+1);if(!Number.isInteger(prefix))throw Error('Wildcard must be contiguous.');return network(`${a}/${prefix}`);});
        code=`config router ospf\n set router-id ${data.routerId}\n config area\n  edit ${data.area}\n  next\n end\n config network\n${nets.map((n,i)=>`  edit ${start+i}\n   set prefix ${n.ip} ${n.mask}\n   set area ${data.area}\n  next`).join('\n')}\n end\nend\n# Process ID is used as the first reserved network entry ID. Review existing entries.`;
      }else{
        const local=number(data.localAs,1,4294967294,'Local AS'),remote=number(data.remoteAs,1,4294967294,'Remote AS');unicast(data.neighbor,'Neighbor');if(data.neighbor===data.routerId)throw Error('Neighbor must differ from Router ID.');
        code=`config router route-map\n edit "NOC-BGP-REJECT"\n  config rule\n   edit 1\n    set action deny\n   next\n  end\n next\nend\nconfig router bgp\n set as ${local}\n set router-id ${data.routerId}\n config neighbor\n  edit "${data.neighbor}"\n   set remote-as ${remote}\n   set route-map-in "NOC-BGP-REJECT"\n   set route-map-out "NOC-BGP-REJECT"\n  next\n end\nend\n# Reject-all policy until approved prefix filters replace it.`;
      }return{errors:[],scripts:[{title:`FortiOS 7.4 · ${id.toUpperCase()}`,code}]};
    }
    if(['ospf','bgp'].includes(id)&&data.vendor==='juniper'){
      unicast(data.routerId,'Router ID');let commands=`set routing-options router-id ${data.routerId}\n`;
      if(id==='ospf'){
        ip(data.area,'Area ID');const interfaces=(data.ospfInterfaces||'').split(',').map(s=>s.trim());if(!interfaces.length||interfaces.length>32)throw Error('Enter 1–32 logical interfaces.');
        for(const name of interfaces){if(!/^(?:ge|xe|et)-\d+\/\d+\/\d+\.\d+$/.test(name))throw Error('Junos OSPF requires logical interfaces, e.g. ge-0/0/1.0.');commands+=`set protocols ospf area ${data.area} interface ${name}\n`;}
      }else{
        const local=number(data.localAs,1,4294967294,'Local AS'),remote=number(data.remoteAs,1,4294967294,'Remote AS');unicast(data.neighbor,'Neighbor');if(data.neighbor===data.routerId)throw Error('Neighbor must differ from Router ID.');
        commands+=`set routing-options autonomous-system ${local}\nset policy-options policy-statement NOC-BGP-IN then reject\nset policy-options policy-statement NOC-BGP-OUT then reject\nset protocols bgp group NOC-PEER type ${local===remote?'internal':'external'}\nset protocols bgp group NOC-PEER peer-as ${remote}\nset protocols bgp group NOC-PEER import NOC-BGP-IN\nset protocols bgp group NOC-PEER export NOC-BGP-OUT\nset protocols bgp group NOC-PEER neighbor ${data.neighbor}\n`;
      }
      return{errors:[],scripts:[{title:`Junos · ${id.toUpperCase()}`,code:`configure\n${commands}show | compare\nexit\n# Validate and commit separately. BGP filters reject all routes until reviewed.`}]};
    }
    if(id==='vlan'&&data.vendor!=='ios'){
      const vlan=number(data.vlan,1,4094,'VLAN');safeName(data.name,'VLAN name');safeName(data.interface,'Interface');if(!['access','trunk'].includes(data.mode))throw Error('Select access or trunk.');
      const ids=data.mode==='access'?[vlan]:String(data.allowed).split(',').map(v=>number(v.trim(),1,4094,'Allowed VLAN'));if(!ids.length||ids.length>64||new Set(ids).size!==ids.length)throw Error('Use 1–64 unique VLAN IDs.');
      let code;
      if(data.vendor==='juniper')code=`configure\nset vlans ${data.name} vlan-id ${vlan}\n${data.mode==='trunk'?ids.filter(id=>id!==vlan).map(id=>`set vlans NOC-VLAN-${id} vlan-id ${id}\n`).join(''):''}set interfaces ${data.interface} unit 0 family ethernet-switching interface-mode ${data.mode}\nset interfaces ${data.interface} unit 0 family ethernet-switching vlan members [ ${ids.map(id=>id===vlan?data.name:'NOC-VLAN-'+id).join(' ')} ]\nshow | compare\nexit\n# Junos EX ELS; review existing memberships and commit separately.`;
      else code=`# For a new dedicated bridge and unused physical port; preserve management access.\n/interface bridge add name=NOC-SW vlan-filtering=no protocol-mode=rstp\n/interface bridge port add bridge=NOC-SW interface=${data.interface} ${data.mode==='access'?`pvid=${vlan} frame-types=admit-only-untagged-and-priority-tagged`:'frame-types=admit-only-vlan-tagged'} ingress-filtering=yes\n/interface bridge vlan add bridge=NOC-SW vlan-ids=${ids.join(',')} ${data.mode==='access'?'untagged':'tagged'}=${data.interface}\n/interface bridge set NOC-SW vlan-filtering=yes`;
      return{errors:[],scripts:[{title:`${PLATFORMS[data.vendor]} · VLAN / Ports`,code}]};
    }
    if(id==='nat'&&data.vendor==='mikrotik'){
      const n=network(data.network);safeName(data.inside,'Inside interface');safeName(data.outside,'Outside interface');
      if(data.inside===data.outside)throw Error('Inside and outside interfaces must differ.');
      return{errors:[],scripts:[{title:'RouterOS v7 · PAT',code:`/ip firewall nat add chain=srcnat src-address=${n.canonical} out-interface=${data.outside} action=masquerade comment="NOC PAT"\n# Merge with existing NAT order; add IPsec bypass ahead of this rule when using IPsec.`}]};
    }
    if(id==='static'&&data.vendor!=='ios'){
      const mask=ipv4(data.mask);if(mask===null)throw Error('Invalid subnet mask.');
      const prefix=32-Math.log2(4294967296-mask);if(!Number.isInteger(prefix))throw Error('Subnet mask must be contiguous.');
      const n=network(`${data.destination}/${prefix}`);ip(data.nextHop,'Next hop');const h=ipv4(data.nextHop);if(h===0||h>=3758096384||data.nextHop.startsWith('127.'))throw Error('Next hop must be unicast.');
      const distance=data.distance?number(data.distance,1,255,'Distance'):null;
      if(data.permanent)throw Error('Permanent flag is IOS-specific.');
      let code;
      if(data.vendor==='mikrotik')code=`/ip route add dst-address=${n.canonical} gateway=${data.nextHop}${distance?' distance='+distance:''} comment="NOC static route"`;
      if(data.vendor==='juniper')code=`configure\nset routing-options static route ${n.canonical} next-hop ${data.nextHop}${distance?'\nset routing-options static route '+n.canonical+' preference '+distance:''}\nshow | compare\nexit`;
      if(data.vendor==='fortinet')code=`config router static\n edit 0\n  set dst ${n.ip} ${n.mask}\n  set gateway ${data.nextHop}\n${distance?'  set distance '+distance+'\n':''} next\nend`;
      if(data.vendor==='paloalto')code=`configure\nset network virtual-router default routing-table ip static-route NOC-STATIC destination ${n.canonical}\nset network virtual-router default routing-table ip static-route NOC-STATIC nexthop ip-address ${data.nextHop}\n${distance?'set network virtual-router default routing-table ip static-route NOC-STATIC admin-dist '+distance+'\n':''}exit\n# PAN-OS 11.x classic virtual router default; validate and commit separately.`;
      return{errors:[],scripts:[{title:`${PLATFORMS[data.vendor]} · Static route`,code}]};
    }
    return generateTool(FEATURES[id].tool,data);
  }catch(e){return{errors:[e.message],scripts:[]};}
}

export const REMOTE_VPN_FIELDS={
  openvpn:[{key:'server',label:'Server DNS name / IPv4',value:'vpn.example.net'},{key:'port',label:'Server TCP port',value:'1194',type:'number'},{key:'certificate',label:'Existing client certificate name',value:'NOC-CLIENT'},{key:'username',label:'VPN username',value:''},{key:'password',label:'VPN password',value:'',type:'password'}],
  ssl:[{key:'certificate',label:'Existing signed server certificate',value:'NOC-SERVER'},{key:'group',label:'Existing authenticated VPN group',value:'NOC-VPN-USERS'},{key:'port',label:'Listen TCP port (avoid management port)',value:'10443',type:'number'},{key:'pool',label:'Remote client pool (CIDR)',value:'10.250.0.0/24'},{key:'policyId',label:'Unused firewall policy ID',value:'9000',type:'number'},{key:'ruleId',label:'Unused SSL authentication-rule ID',value:'9000',type:'number'}],
};
export const remoteDefaults=type=>Object.fromEntries((REMOTE_VPN_FIELDS[type]||[]).map(f=>[f.key,f.value]));
export function generateRemoteVpn(type,d,s){
  try{
    if(type==='openvpn'){
      if(s.vendor!=='mikrotik')throw Error('OpenVPN client template requires RouterOS 7.12+.');
      if(!/^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(d.server)||/\.\.|^\d+\.\d+\.\d+\.\d+$/.test(d.server)&&ipv4(d.server)===null)throw Error('Use a valid server DNS name or IPv4.');
      safeName(d.certificate,'Certificate');if(!/^[A-Za-z0-9_@.-]{1,27}$/.test(d.username))throw Error('Username: use 1–27 CLI-safe characters.');
      if(!/^[A-Za-z0-9_@%+=:,.-]{16,100}$/.test(d.password))throw Error('VPN password: use 16–100 CLI-safe characters.');number(d.port,1,65535,'Port');
      return{errors:[],scripts:[{title:'RouterOS 7.12+ · OpenVPN client',code:`# Import the trusted CA and client certificate/private key first.\n# Server must offer AES256-CBC/SHA256 and a certificate matching connect-to.\n/interface ovpn-client add name=NOC-OVPN connect-to=${d.server} port=${d.port} protocol=tcp mode=ip user="${d.username}" password="${d.password}" certificate=${d.certificate} verify-server-certificate=yes tls-version=only-1.2 auth=sha256 cipher=aes256-cbc add-default-route=no route-nopull=yes disabled=no\n# Add only approved remote-prefix routes through NOC-OVPN after reachability validation.`}]};
    }
    if(type!=='ssl'||s.vendor!=='fortinet')throw Error('SSL VPN server template requires a FortiGate model/release supporting FortiOS 7.4 tunnel mode.');
    safeName(d.certificate,'Certificate');safeName(d.group,'Group');safeName(s.wan,'WAN');safeName(s.lan,'LAN');number(d.port,1,65535,'Port');number(d.policyId,1,4294967294,'Policy ID');number(d.ruleId,1,4294967294,'Authentication-rule ID');
    const pool=network(d.pool),lan=network(s.local);if(pool.end-pool.network<3||pool.network<=lan.end&&pool.end>=lan.network)throw Error('Client pool must have usable hosts and must not overlap LAN.');
    const wan=cidr(`${s.ip}/${s.wanPrefix}`);if(wan&&pool.network<=wan.end&&pool.end>=wan.network)throw Error('Client pool must not overlap WAN.');
    const text=n=>[24,16,8,0].map(b=>(n>>>b)&255).join('.');
    return{errors:[],scripts:[{title:'FortiOS 7.4 · SSL VPN server',code:`# Requires existing trusted signed server certificate and authenticated user group.\n# Reserve NOC-SSL-* objects, policy ${d.policyId} and auth rule ${d.ruleId}; merge existing SSL settings.\nconfig firewall address\n edit "NOC-SSL-POOL"\n  set type iprange\n  set start-ip ${text(pool.network+1)}\n  set end-ip ${text(pool.end-1)}\n next\n edit "NOC-SSL-LAN"\n  set subnet ${lan.ip} ${lan.mask}\n next\nend\nconfig vpn ssl web portal\n edit "NOC-SSL-PORTAL"\n  set tunnel-mode enable\n  set web-mode disable\n  set ip-pools "NOC-SSL-POOL"\n  set split-tunneling enable\n  set split-tunneling-routing-address "NOC-SSL-LAN"\n next\nend\nconfig vpn ssl settings\n set servercert "${d.certificate}"\n set ssl-min-proto-ver tls1-2\n set port ${d.port}\n set source-interface "${s.wan}"\n set source-address "all"\n set tunnel-ip-pools "NOC-SSL-POOL"\n config authentication-rule\n  edit ${d.ruleId}\n   set groups "${d.group}"\n   set portal "NOC-SSL-PORTAL"\n  next\n end\nend\nconfig firewall policy\n edit ${d.policyId}\n  set name "NOC-SSL-LAN"\n  set srcintf "ssl.root"\n  set dstintf "${s.lan}"\n  set srcaddr "NOC-SSL-POOL"\n  set dstaddr "NOC-SSL-LAN"\n  set action accept\n  set schedule "always"\n  set service "ALL"\n  set groups "${d.group}"\n  set nat disable\n next\nend\n# Review existing portal mappings, MFA and management-port conflicts before applying.`}]};
  }catch(e){return{errors:[e.message],scripts:[]};}
}
