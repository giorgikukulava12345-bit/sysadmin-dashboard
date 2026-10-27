import {modelLanConfig,switchedLan,modelGenerationError} from './router-models.js';
import { hasSecondVlan, routedSite } from './dual-vlan.js';
import { FEATURES, forRole, boundValues, capable, generateFeature, generateRemoteVpn, lanBinding } from './features.js';
import { labScripts } from './lab.js';
import { generate as generateVpn } from './engine.js';
import { cidr } from './address.js';
import { iosInternetPat } from './internet.js';
import {leaseRanges} from './office-services.js';
import {generateStandardOffice} from './standard-office.js';

/** No DOM dependencies. Each output belongs to one physical device. */
export function composeDevice(input){
  try{const blocked=input.role==='router'&&modelGenerationError(input.lab?.[input.side]||{});if(blocked)return {errors:[blocked],code:'',empty:false};const result=composeChecked(input);if(input.role==='router'&&!result.errors.length&&result.code)result.code=modelLanConfig(input.lab[input.side],result.code);return result;}catch{return {errors:['Generation failed: invalid or incomplete device configuration. Review the topology and feature inputs.'],code:'',empty:false};}
}
function composeChecked({lab,side,role,selected={},values={},bindings=false,vpnConfig,vpnType='ikev2',remote={},linkedEnterprise=null}){
  if(!lab?.a||!lab?.b||!['a','b'].includes(side)||!['router','switch','host'].includes(role))throw Error('Invalid topology context.');
  const errors=[],blocks=[],site=lab[side],vendor=role==='switch'?site.switchVendor:site.vendor;
  const dual=hasSecondVlan(site);
  const customNoInterfaces=role==='router'&&selected.internet_access&&values.internet_access?.parts?.interfaces===false;bindings=customNoInterfaces?false:bindings||dual;
  const logical=routedSite(site);
  const ids=Object.keys(selected).filter(id=>selected[id]).sort((a,b)=>(a==='aaa'?1:0)-(b==='aaa'?1:0));
  const paired=ids.includes('vpn')||ids.includes('gre_tunnel');
  const address=labScripts(lab,{sides:paired?['a','b']:[side]});
  const baseIndex=paired&&side==='b'?3:0;
  if(role==='router'&&!customNoInterfaces&&ids.some(id=>['wan_failover','internet_access'].includes(id)))bindings=true;
  if(role==='switch'&&linkedEnterprise){
    if(vendor!=='ios'||ids.length||bindings)return{errors:['The linked router-on-a-stick switch preset requires Cisco and no additional switch features/bindings.'],code:'',empty:false};
    const r=generateFeature('enterprise',{...linkedEnterprise,vendor:'ios'});
    return{errors:r.errors,code:r.errors.length?'':r.scripts[1].code,empty:false};
  }
  if(!ids.length&&!bindings)return{errors:[],code:'',empty:true};
  if(address.errors.length)return{errors:address.errors,code:'',empty:false};
  if(role==='host')return{errors:[],code:address.scripts[baseIndex+2].code,empty:false};
  const failover=ids.includes('wan_failover'),office=ids.includes('internet_access');
  if(vendor==='ios'&&failover&&ids.includes('ipsla')&&[Number(values.wan_failover?.trackId??900),Number(values.wan_failover?.trackId??900)+1].includes(Number(values.ipsla?.track)))errors.push('Dual ISP and IP SLA must use distinct tracking object IDs.');
  if(office&&ids.some(id=>['nat','acl','zbfw','vpn','dmvpn','remotevpn','portforward','bootstrap','enterprise','dhcp','relay'].includes(id)))errors.push('Internet Gateway owns NAT and firewall policy. Uncheck overlapping NAT, ACL, VPN and complete setup templates, or use the office preset.');
  if((failover||office)&&ids.includes('static')&&values.static?.destination==='0.0.0.0'&&values.static?.mask==='0.0.0.0')errors.push('Internet Gateway / WAN Failover owns default routing. Remove the separate default static route.');
  if(failover&&ids.some(id=>['vpn','dmvpn','remotevpn','bootstrap','enterprise'].includes(id)))errors.push('Dual ISP needs a separately designed VPN/bootstrap underlay. Generate these templates separately.');
  if(vendor==='ios'&&failover&&((office&&values.internet_access?.parts?.nat!==false)||ids.includes('nat')))return {errors:['Cisco ACL-only NAT route-maps cannot distinguish two ISP egress paths. Disable Dual ISP for this PAT template, or design platform-supported egress-aware NAT separately.'],code:'',empty:false};
  if(failover&&ids.includes('nat')&&values.nat?.natMode&&values.nat.natMode!=='overload')errors.push('Automatic Dual ISP translation supports interface PAT / Overload only.');
  if(failover&&ids.includes('zbfw')&&(values.zbfw?.outside!==site.wan||values.zbfw?.inside!==logical.lan))errors.push('Dual ISP ZBFW must use the topology LAN and primary WAN interfaces.');
  if(failover&&office&&vendor==='paloalto'&&values.wan_failover?.virtualRouter!==values.internet_access?.virtualRouter)errors.push('Internet Gateway and WAN Failover must use the same virtual router.');
  if(ids.includes('nat')&&values.nat?.natMode==='static'&&[site.ip,site.gateway].includes(values.nat.publicHost))errors.push('Static NAT public mapping must not reuse the WAN router or ISP gateway address. Use a separately assigned public address.');
  if(ids.includes('nat')&&values.nat?.natMode==='dynamic'){const start=values.nat.poolStart?.split('.').reduce((a,v)=>a*256+Number(v),0),end=values.nat.poolEnd?.split('.').reduce((a,v)=>a*256+Number(v),0);for(const ip of [site.ip,site.gateway]){const n=ip.split('.').reduce((a,v)=>a*256+Number(v),0);if(n>=start&&n<=end)errors.push('Dynamic NAT pool must exclude WAN router and ISP gateway addresses.');}}
  if(ids.includes('static')&&[site.ip,site.lanIp,site.switchIp,site.hostIp,...(dual?[site.vlan2Gateway,site.vlan2SwitchIp]:[])].includes(values.static?.nextHop))errors.push('Static-route next hop must not be an address assigned to this site.');
  if(ids.includes('portforward')){
    const d=values.portforward||{};if(d.internalIp===site.switchIp)errors.push('Port-forward target must not be the switch management address.');
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
  if(ids.includes('fhrp')||ids.includes('glbp')){const d=values.fhrp||values.glbp,binding=lanBinding({...site,role},d?.interface),n=cidr(binding.network),vip=d?.virtualIp;const number=typeof vip==='string'?vip.split('.').reduce((a,v)=>a*256+Number(v),0):NaN;if(!n||!Number.isFinite(number)||number<=n.network||number>=n.end||binding.reserved.includes(vip))errors.push('FHRP virtual IP must be an unused usable host in the selected LAN interface subnet.');}
  if(ids.includes('ospf')&&ids.includes('ospf_advanced'))errors.push('Use either Basic OSPFv2 or Advanced OSPFv2; the advanced template already includes the process configuration.');
  if(ids.includes('dhcp')&&ids.includes('relay')&&[site.lan,logical.lan,...(dual?[site.lan+'.'+site.vlan2]:[])].includes(values.relay?.interface))errors.push('Do not configure DHCP Server and Relay on the same LAN interface.');
  if(ids.includes('zbfw')&&ids.includes('vpn'))errors.push('This ZBFW template needs a separately designed VPN zone policy; generate ZBFW and VPN separately.');
  if(ids.includes('hardening')&&ids.includes('aaa')&&values.hardening?.username===values.aaa?.localUser&&values.hardening?.secret!==values.aaa?.localSecret)errors.push('SSH and AAA fallback use the same username with different secrets. Use matching credentials or separate usernames.');
  if(ids.includes('nat')&&ids.includes('vpn')&&values.nat?.natMode&&values.nat.natMode!=='overload')errors.push('Automatic VPN NAT exemption supports interface PAT only. Use Overload or design Static/Dynamic NAT exemptions separately.');
  if(ids.includes('pvlan'))for(const key of ['vlan','security'])if(ids.includes(key)&&[values.pvlan?.hostPort,values.pvlan?.promiscuousPort].includes(values[key]?.interface))errors.push('Private-VLAN ports cannot also use ordinary access/trunk or Port Security templates.');
  if(ids.includes('etherchannel'))for(const key of ['vlan','security'])if(ids.includes(key)&&String(values.etherchannel?.members).split(',').map(s=>s.trim()).includes(values[key]?.interface))errors.push('Configure VLAN/Port Security on the bundle, not an individual EtherChannel member.');
  if(dual&&role==='switch'){
    const shared=[site.uplink,site.access,site.vlan2Access];
    if(ids.includes('pvlan'))errors.push('Private VLANs require a separate port design from the two-VLAN lab.');
    if(ids.includes('etherchannel')&&String(values.etherchannel?.members).split(',').some(p=>shared.includes(p.trim())))errors.push('EtherChannel members cannot reuse the routed-trunk or VLAN access ports.');
    if(ids.includes('span')&&shared.includes(values.span?.destination))errors.push('SPAN destination must not reuse a VLAN lab port.');
  }
  if(dual&&role==='router'&&ids.some(id=>['vpn','zbfw','dmvpn'].includes(id)))errors.push('Generate VPN/firewall overlays separately from the two-VLAN routed-trunk template; both subnets require an explicit policy design.');
  if(role==='router'&&vendor==='ios'&&office&&values.internet_access?.standardOffice){
    if(errors.length)return {errors:[...new Set(errors)],code:'',empty:false};
    return generateStandardOffice({site,selected,values:switchedLan(site)?{...values,internet_access:{...values.internet_access,iosLanMode:'subinterfaces'}}:values});
  }
  if(bindings){const script=address.scripts[baseIndex+(role==='switch'?1:0)];if(script.unsupported)errors.push('No base switch template for this platform.');else blocks.push({title:'BASE INTERFACE / IP BINDINGS',code:script.code});}
  const vtiOwnNat=ids.includes('vpn')&&vpnType==='vti';
  for(const id of ids){
    if(!FEATURES[id]||!forRole(FEATURES[id],role)||!capable(id,vendor)){errors.push(`${FEATURES[id]?.title||id}: no validated ${vendor} template for this device. Uncheck it or choose a supported vendor.`);continue;}
    if(id==='vpn'){
      const result=['openvpn','ssl'].includes(vpnType)?generateRemoteVpn(vpnType,remote,site):vpnConfig?generateVpn({...vpnConfig,bindInterfaces:false}):{errors:['Complete the VPN settings.']};
      if(result.errors.length)errors.push(...result.errors.map(e=>'VPN: '+e));
      else blocks.push({title:'VPN',code:result.scripts?result.scripts[0].code:result[side]});
      continue;
    }
    if(dual&&role==='switch'&&id==='vlan')continue; // Shared topology owns both VLANs and their ports.
    if(id==='nat'&&vtiOwnNat)continue; // VTI already emits its NAT ACL and bindings.
    let data=boundValues(id,values[id]||{}, {...logical,physicalLan:site.lan,vendor,role});
    if(id==='wan_failover'&&vendor==='ios'&&ids.includes('ipsla')){if(values.ipsla?.target!==site.gateway||values.ipsla?.sourceInterface!==site.wan)errors.push('Linked failover IP SLA must probe the primary ISP gateway from the primary WAN interface.');data.primarySlaTrack=values.ipsla?.track;}
    if(id==='internet_access'&&failover){const backup=values.wan_failover||{};data={...data,wan2:backup.wan2,ip2:backup.ip2,gateway2:backup.gateway2,backupDistance:backup.backupDistance,routeId:backup.routeId??data.routeId,backupRouteId:backup.backupRouteId};}
    for(const key of ['interface','inside'])if(dual&&role==='router'&&data[key]===site.lan)data[key]=logical.lan;
    let result=generateFeature(id,data);
    if(id==='zbfw'&&failover&&vendor==='ios'&&!result.errors.length)result.scripts.push({code:`configure terminal\ninterface ${values.wan_failover?.wan2}\n zone-member security NOC-UNTRUST\n exit\nend`});
    if(id==='nat'&&failover&&!result.errors.length){
      const backup=values.wan_failover||{};
      if(vendor==='ios')result={errors:[],scripts:[{code:`configure terminal\n${iosInternetPat({...logical,physicalLan:site.lan,wan2:backup.wan2},data.acl)}\nend`}]};
      if(vendor==='mikrotik')result.scripts.push({code:`/ip firewall nat add chain=srcnat src-address=${site.local} out-interface=${backup.wan2} action=masquerade comment="NOC backup WAN PAT"`});
    }
    if(dual&&role==='router'&&!result.errors.length&&id==='nat'&&(!data.natMode||data.natMode==='overload')){
      const n=cidr(site.vlan2Subnet);
      if(vendor==='ios')result.scripts.push({code:`configure terminal\nip access-list standard ${data.acl}\n permit ${n.ip} ${n.wildcard}\n exit\ninterface ${site.lan}.${site.vlan2}\n ip nat inside\n exit\nend`});
      if(vendor==='mikrotik')for(const port of [site.wan,...(failover?[values.wan_failover.wan2]:[])])result.scripts.push({code:`/ip firewall nat add chain=srcnat src-address=${n.canonical} out-interface=${port} action=masquerade comment="NOC second VLAN PAT"`});
    }
    if(dual&&role==='router'&&!result.errors.length&&id==='relay'&&[site.lan,logical.lan].includes(values.relay?.interface)){const extra=generateFeature('relay',{...data,interface:`${site.lan}.${site.vlan2}`,localIp:site.vlan2Gateway,localNetwork:site.vlan2Subnet,relayName:`NOC-RELAY-V${site.vlan2}`});if(extra.errors.length)result.errors.push(...extra.errors);else result.scripts.push(...extra.scripts);}
    if(dual&&role==='router'&&!result.errors.length&&id==='dhcp'){
      const ranges=leaseRanges(site.vlan2Subnet,[site.vlan2Gateway,site.vlan2SwitchIp]);
      const asNumber=ip=>ip.split('.').reduce((a,v)=>a*256+Number(v),0);
      const range=ranges.sort((a,b)=>(asNumber(b[1])-asNumber(b[0]))-(asNumber(a[1])-asNumber(a[0])))[0];
      const extra=generateFeature('dhcp',{...data,name:`${data.name||'NOC-DHCP'}-V${site.vlan2}`,interface:`${site.lan}.${site.vlan2}`,network:site.vlan2Subnet,gateway:site.vlan2Gateway,poolStart:range[0],poolEnd:range[1],serverId:String(Number(data.serverId)+1),exclusions:`${site.vlan2Gateway}\n${site.vlan2SwitchIp}`,reserved:[site.vlan2SwitchIp]});
      if(extra.errors.length)result.errors.push(...extra.errors);else result.scripts.push(...extra.scripts);
    }
    if(id==='nat'&&vendor==='ios'&&ids.includes('vpn')&&!['openvpn','ssl','wireguard'].includes(vpnType)&&!result.errors.length){
      const local=cidr(site.local),remote=cidr(lab[side==='a'?'b':'a'].local),name=data.acl;
      result={errors:[],scripts:[{code:`configure terminal\n! Dedicated extended NAT ACL: merge existing device NAT policy before applying.\nip access-list extended ${name}\n 10 deny ip ${local.ip} ${local.wildcard} ${remote.ip} ${remote.wildcard}\n 20 permit ip ${local.ip} ${local.wildcard} any\n exit\ninterface ${site.lan}\n ip nat inside\n exit\ninterface ${site.wan}\n ip nat outside\n exit\nip nat inside source list ${name} interface ${site.wan} overload\nend`}]};
    }
    if(result.errors.length)errors.push(...result.errors.map(e=>`${FEATURES[id].title}: ${e}`));
    else for(const script of id==='enterprise'?result.scripts.slice(0,1):result.scripts)blocks.push({title:script.title||FEATURES[id].title,code:script.code});
  }
  if(errors.length)return{errors:[...new Set(errors)],code:'',empty:false};if(!blocks.length)return{errors:[],code:'',empty:true};
  // Do not concatenate configuration modes blindly: each fragment exits its own mode.
  const comment=vendor==='ios'?'!':'#';
  return{errors:[],code:blocks.map(b=>role==='switch'?b.code.trim():`${comment} === ${b.title} ===\n${b.code.trim()}`).join('\n\n')+'\n',empty:false};
}


