import { FEATURES, forRole, boundValues, capable, generateFeature, generateRemoteVpn } from './features.js';
import { labScripts } from './lab.js';
import { generate as generateVpn } from './engine.js';
import { cidr } from './address.js';

/** No DOM dependencies. Each output belongs to one physical device. */
export function composeDevice({lab,side,role,selected={},values={},bindings=false,vpnConfig,vpnType='ikev2',remote={},linkedEnterprise=null}){
  const errors=[],blocks=[],site=lab[side],vendor=role==='switch'?site.switchVendor:site.vendor;
  const address=labScripts(lab);
  const ids=Object.keys(selected).filter(id=>selected[id]).sort((a,b)=>(a==='aaa'?1:0)-(b==='aaa'?1:0));
  if(role==='switch'&&linkedEnterprise){
    if(vendor!=='ios'||ids.length||bindings)return{errors:['The linked router-on-a-stick switch preset requires Cisco and no additional switch features/bindings.'],code:'',empty:false};
    const r=generateFeature('enterprise',{...linkedEnterprise,vendor:'ios'});
    return{errors:r.errors,code:r.errors.length?'':r.scripts[1].code,empty:false};
  }
  if(!ids.length&&!bindings)return{errors:[],code:'',empty:true};
  if(address.errors.length)return{errors:address.errors,code:'',empty:false};
  if(role==='host')return{errors:[],code:address.scripts[side==='a'?2:5].code,empty:false};
  if(ids.includes('portforward')){
    const d=values.portforward||{};
    if(d.attachAcl&&ids.length>1)errors.push('A dedicated inbound port-forward ACL is a standalone restricted policy. Leave attachment unchecked and merge its permit with the existing WAN ACL when combining features.');
    if(ids.includes('nat')&&d.acl===values.nat?.acl)errors.push('Port-forward and source NAT ACL names must differ.');
    if(ids.includes('acl')&&d.acl===values.acl?.name)errors.push('Port-forward and traffic-filter ACL names must differ.');
    if(ids.includes('nat')&&values.nat?.natMode&&values.nat.natMode!=='overload')errors.push('Combine port forwarding with PAT / Overload, or design full static/dynamic NAT precedence separately.');
  }
  if(ids.includes('vxlan')){
    const access=values.vxlan?.accessInterface;
    if([site.wan,site.lan].includes(access))errors.push('VXLAN EFP access must use a dedicated physical port, separate from the routed WAN/LAN topology ports.');
    if([site.ip,site.lanIp,site.hostIp,site.switchIp].includes(values.vxlan?.localVtep))errors.push('VTEP Loopback must use an unused /32, not an address already assigned in the topology.');
  }
  if(ids.includes('gre_tunnel')){
    const d=values.gre_tunnel||{},local=cidr(site.local),remote=cidr(d.remoteNetwork),tunnel=cidr(d.address);
    if(local&&remote&&local.network<=remote.end&&local.end>=remote.network)errors.push('GRE remote LAN must not overlap the local LAN.');
    if(local&&tunnel&&local.network<=tunnel.end&&local.end>=tunnel.network)errors.push('GRE transit subnet must not overlap the local LAN.');
  }
  if(ids.includes('bootstrap')&&(ids.length>1||bindings))errors.push('Initial setup is a complete empty-router preset. Disable other features and interface bindings.');
  if(ids.includes('enterprise')&&(ids.length>1||bindings))errors.push('Router-on-a-stick is a complete router/switch preset. Disable other features and interface bindings.');
  if(role==='switch'&&ids.includes('vlan')&&ids.includes('security')&&values.vlan?.mode==='trunk')errors.push('Port security in this lab requires an access port. Disable port security or select Access mode.');
  if(ids.includes('nat')&&ids.includes('acl')&&values.nat?.acl===values.acl?.name)errors.push('Translation ACL and traffic-filter ACL must use different names.');
  if(ids.includes('glbp')&&ids.includes('fhrp'))errors.push('Use one first-hop redundancy protocol per interface; GLBP and HSRP/VRRP cannot be combined here.');
  if(ids.includes('bpduguard')&&ids.includes('vlan')&&values.bpduguard?.interface===values.vlan?.interface&&values.vlan?.mode==='trunk')errors.push('BPDU Guard edge template must not be applied to a trunk port.');
  if(ids.includes('span')&&values.span?.mode==='local'){const analyzer=values.span.destination;for(const id of ['vlan','security','bpduguard'])if(ids.includes(id)&&values[id]?.interface===analyzer)errors.push('A SPAN analyzer destination must be dedicated; remove access, security or BPDU settings on that port.');}
  if(ids.includes('dmvpn')&&['vpn','zbfw','nat'].some(id=>ids.includes(id)))errors.push('Generate the DMVPN overlay separately; NAT exemptions and firewall zones require an explicit hub/spoke design.');
  if(ids.includes('fhrp')||ids.includes('glbp')){const n=cidr(site.local),vip=(values.fhrp||values.glbp)?.virtualIp;const number=typeof vip==='string'?vip.split('.').reduce((a,v)=>a*256+Number(v),0):NaN;if(!n||!Number.isFinite(number)||number<=n.network||number>=n.end||[site.lanIp,site.switchIp,site.hostIp].includes(vip))errors.push('FHRP virtual IP must be an unused usable host in the local LAN.');}
  if(ids.includes('ospf')&&ids.includes('ospf_advanced'))errors.push('Use either Basic OSPFv2 or Advanced OSPFv2; the advanced template already includes the process configuration.');
  if(ids.includes('dhcp')&&ids.includes('relay')&&values.relay?.interface===site.lan)errors.push('Do not configure DHCP Server and Relay on the same LAN interface.');
  if(ids.includes('zbfw')&&ids.includes('vpn'))errors.push('This ZBFW template needs a separately designed VPN zone policy; generate ZBFW and VPN separately.');
  if(ids.includes('hardening')&&ids.includes('aaa')&&values.hardening?.username===values.aaa?.localUser&&values.hardening?.secret!==values.aaa?.localSecret)errors.push('SSH and AAA fallback use the same username with different secrets. Use matching credentials or separate usernames.');
  if(ids.includes('nat')&&ids.includes('vpn')&&values.nat?.natMode&&values.nat.natMode!=='overload')errors.push('Automatic VPN NAT exemption supports interface PAT only. Use Overload or design Static/Dynamic NAT exemptions separately.');
  if(ids.includes('pvlan'))for(const key of ['vlan','security'])if(ids.includes(key)&&[values.pvlan?.hostPort,values.pvlan?.promiscuousPort].includes(values[key]?.interface))errors.push('Private-VLAN ports cannot also use ordinary access/trunk or Port Security templates.');
  if(ids.includes('etherchannel'))for(const key of ['vlan','security'])if(ids.includes(key)&&String(values.etherchannel?.members).split(',').map(s=>s.trim()).includes(values[key]?.interface))errors.push('Configure VLAN/Port Security on the bundle, not an individual EtherChannel member.');
  if(bindings){const script=address.scripts[(side==='a'?0:3)+(role==='switch'?1:0)];if(script.unsupported)errors.push('No base switch template for this platform.');else blocks.push({title:'BASE INTERFACE / IP BINDINGS',code:script.code});}
  const vtiOwnNat=ids.includes('vpn')&&vpnType==='vti';
  for(const id of ids){
    if(!FEATURES[id]||!forRole(FEATURES[id],role)||!capable(id,vendor)){errors.push(`${FEATURES[id]?.title||id}: no validated ${vendor} template for this device. Uncheck it or choose a supported vendor.`);continue;}
    if(id==='vpn'){
      const result=['openvpn','ssl'].includes(vpnType)?generateRemoteVpn(vpnType,remote,site):vpnConfig?generateVpn({...vpnConfig,bindInterfaces:false}):{errors:['Complete the VPN settings.']};
      if(result.errors.length)errors.push(...result.errors.map(e=>'VPN: '+e));
      else blocks.push({title:'VPN',code:result.scripts?result.scripts[0].code:result[side]});
      continue;
    }
    if(id==='nat'&&vtiOwnNat)continue; // VTI already emits its NAT ACL and bindings.
    const data=boundValues(id,values[id]||{}, {...site,vendor,role});
    let result=generateFeature(id,data);
    if(id==='nat'&&vendor==='ios'&&ids.includes('vpn')&&!['openvpn','ssl','wireguard'].includes(vpnType)&&!result.errors.length){
      const local=cidr(site.local),remote=cidr(lab[side==='a'?'b':'a'].local),name=data.acl;
      result={errors:[],scripts:[{code:`configure terminal\n! Dedicated extended NAT ACL: merge existing device NAT policy before applying.\nip access-list extended ${name}\n 10 deny ip ${local.ip} ${local.wildcard} ${remote.ip} ${remote.wildcard}\n 20 permit ip ${local.ip} ${local.wildcard} any\n exit\ninterface ${site.lan}\n ip nat inside\n exit\ninterface ${site.wan}\n ip nat outside\n exit\nip nat inside source list ${name} interface ${site.wan} overload\nend`}]};
    }
    if(result.errors.length)errors.push(...result.errors.map(e=>`${FEATURES[id].title}: ${e}`));
    else for(const script of id==='enterprise'?result.scripts.slice(0,1):result.scripts)blocks.push({title:script.title||FEATURES[id].title,code:script.code});
  }
  if(errors.length)return{errors:[...new Set(errors)],code:'',empty:false};
  // Do not concatenate configuration modes blindly: each fragment exits its own mode.
  const comment=vendor==='ios'?'!':'#';
  return{errors:[],code:blocks.map(b=>`${comment} === ${b.title} ===\n${b.code.trim()}`).join('\n\n')+'\n',empty:false};
}
