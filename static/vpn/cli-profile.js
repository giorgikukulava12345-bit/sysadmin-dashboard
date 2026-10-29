/** Selected image families, not emulator names, determine command syntax. */
export function cliProfile(site={}) {
 const model=site.routerModel||'',vendor=site.vendor;
 if(vendor==='ios'){
  if(model.endsWith('(Packet Tracer)'))return {id:'packet-tracer',label:'Packet Tracer IOS · fixed IKEv1 lab suite',legacy:true};
  if(/Cisco IOS (1710|3725|7206VXR).*Dynamips/.test(model))return {id:'ios-classic',label:'Classic IOS 12.x · IKEv1 lab compatibility',legacy:true};
  return {id:'ios-modern',label:'IOS / IOS XE · image must support the selected features',legacy:false};
 }
 if(vendor==='mikrotik')return /mikrotik-6\./.test(model)?{id:'ros6',label:'RouterOS 6 · version-specific CLI'}:{id:'ros7',label:'RouterOS 7 · version-specific CLI'};
 if(vendor==='fortinet')return {id:/v6\.4/.test(model)?'fortios64':'fortios7',label:/v6\.4/.test(model)?'FortiOS 6.4':'FortiOS 7 · verify installed minor release'};
 return {id:vendor||'unknown',label:vendor==='paloalto'?'PAN-OS · candidate configuration; commit separately':vendor==='juniper'?'Junos · candidate configuration; commit separately':'Select a platform'};
}
export const legacyCiscoPair=lab=>['a','b'].some(side=>cliProfile(lab?.[side]).legacy);
export function profileCLI(code,site){
 const profile=cliProfile(site);let text=String(code);
 if(profile.id==='ios-classic')text=text.replace(/ip virtual-reassembly in\b/g,'ip virtual-reassembly').replace(/algorithm-type scrypt secret/g,'secret');
 if(profile.id==='ros6'){
  const addresses=[...text.matchAll(/^\/system ntp client servers add address=([^\s]+)\s*$/gm)].map(m=>m[1]);
  if(addresses.length)text=text.replace(/^\/system ntp client set enabled=yes\s*$/gm,'/system ntp client set enabled=yes primary-ntp='+addresses[0]+(addresses[1]?' secondary-ntp='+addresses[1]:'' )).replace(/^\/system ntp client servers add address=[^\s]+\s*$/gm,'');
 }
 return text;
}
export function profileErrors(site,{selected={},vpnType,code=''}={}){
 const p=cliProfile(site),errors=[];
 if(p.legacy&&selected.vpn&&vpnType!=='ikev1')errors.push(p.label+': choose IKEv1; IKEv2/GRE/VTI are not provided for this image profile.');
 if(p.id==='ios-classic'&&/crypto ikev2|algorithm-type scrypt|netconf-yang|restconf|l2vpn|vxlan/.test(code))errors.push(p.label+': selected commands require a newer IOS image.');
 if(p.id==='ros6'&&(/\/routing (?:bgp|ospf|filter|table|rule)\b|\/interface (?:wireguard|vxlan)\b|\/interface ovpn-client|\/ip vrf\b/.test(code)||['bgp','ospf','ospf_advanced','wireguard','vxlan','automation','bootstrap','remotevpn'].some(id=>selected[id])||['wireguard','openvpn'].includes(vpnType)))errors.push('RouterOS 6: this selected feature template requires RouterOS 7. Choose a RouterOS 7 image or remove the feature.');
 if(p.id==='fortios64'&&(vpnType==='ssl'||selected.remotevpn))errors.push('FortiOS 6.4: the supplied SSL VPN template targets 7.4; choose a matching template/image.');
 return errors;
}
