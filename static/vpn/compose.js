import { FEATURES, boundValues, capable, generateFeature, generateRemoteVpn } from './features.js';
import { labScripts } from './lab.js';
import { generate as generateVpn } from './engine.js';
import { cidr } from './address.js';

/** No DOM dependencies. Each output belongs to one physical device. */
export function composeDevice({lab,side,role,selected={},values={},bindings=false,vpnConfig,vpnType='ikev2',remote={},linkedEnterprise=null}){
  const errors=[],blocks=[],site=lab[side],vendor=role==='switch'?site.switchVendor:site.vendor;
  const address=labScripts(lab);
  const ids=Object.keys(selected).filter(id=>selected[id]);
  if(role==='switch'&&linkedEnterprise){
    if(vendor!=='ios'||ids.length||bindings)return{errors:['The linked router-on-a-stick switch preset requires Cisco and no additional switch features/bindings.'],code:'',empty:false};
    const r=generateFeature('enterprise',{...linkedEnterprise,vendor:'ios'});
    return{errors:r.errors,code:r.errors.length?'':r.scripts[1].code,empty:false};
  }
  if(!ids.length&&!bindings)return{errors:[],code:'',empty:true};
  if(address.errors.length)return{errors:address.errors,code:'',empty:false};
  if(role==='host')return{errors:[],code:address.scripts[side==='a'?2:5].code,empty:false};
  if(ids.includes('bootstrap')&&(ids.length>1||bindings))errors.push('Initial setup is a complete empty-router preset. Disable other features and interface bindings.');
  if(ids.includes('enterprise')&&(ids.length>1||bindings))errors.push('Router-on-a-stick is a complete router/switch preset. Disable other features and interface bindings.');
  if(role==='switch'&&ids.includes('vlan')&&ids.includes('security')&&values.vlan?.mode==='trunk')errors.push('Port security in this lab requires an access port. Disable port security or select Access mode.');
  if(ids.includes('nat')&&ids.includes('acl')&&values.nat?.acl===values.acl?.name)errors.push('Translation ACL and traffic-filter ACL must use different names.');
  if(bindings){const script=address.scripts[(side==='a'?0:3)+(role==='switch'?1:0)];if(script.unsupported)errors.push('No base switch template for this platform.');else blocks.push({title:'BASE INTERFACE / IP BINDINGS',code:script.code});}
  const vtiOwnNat=ids.includes('vpn')&&vpnType==='vti';
  for(const id of ids){
    if(!FEATURES[id]||FEATURES[id].role!==role||!capable(id,vendor)){errors.push(`${FEATURES[id]?.title||id}: unavailable for this device/vendor.`);continue;}
    if(id==='vpn'){
      const result=['openvpn','ssl'].includes(vpnType)?generateRemoteVpn(vpnType,remote,site):vpnConfig?generateVpn({...vpnConfig,bindInterfaces:false}):{errors:['Complete the VPN settings.']};
      if(result.errors.length)errors.push(...result.errors.map(e=>'VPN: '+e));
      else blocks.push({title:'VPN',code:result.scripts?result.scripts[0].code:result[side]});
      continue;
    }
    if(id==='nat'&&vtiOwnNat)continue; // VTI already emits its NAT ACL and bindings.
    const data=boundValues(id,values[id]||{}, {...site,vendor});
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
