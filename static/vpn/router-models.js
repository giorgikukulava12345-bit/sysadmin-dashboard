// Catalog metadata is also available as a standalone JSON download.
export const CISCO_ROUTERS = [{"model":"Cisco C921-4P","series":"ISR 900","form_factor":"Desktop","wan_ports":["2 x 10/100/1000 RJ-45 routed Ethernet"],"lan_ports":["4 x 10/100/1000 RJ-45 managed switch"],"expansion_slots":["No modular NIM or service-module slots"],"console_usb":["RJ-45 console","USB 2.0 Type-A storage"],"features":["Stateful Firewall","IPsec VPN","NAT/PAT","VLANs","QoS"]},{"model":"Cisco C1111-4P","series":"ISR 1100","form_factor":"Desktop","wan_ports":["1 x Gigabit Ethernet RJ-45","1 x Gigabit Ethernet RJ-45/SFP combo (one active medium)"],"lan_ports":["4 x 10/100/1000 RJ-45 managed switch"],"expansion_slots":["1 x SFP receptacle shared with combo WAN port; no NIM slots"],"console_usb":["RJ-45 console","Micro-USB console","USB 3.0 Type-A storage"],"features":["SD-WAN capable (supported software/license)","Stateful Firewall","IPsec VPN","NAT/PAT","VLANs","QoS"]},{"model":"Cisco C1101-4P","series":"ISR 1100","form_factor":"Desktop","wan_ports":["1 x 10/100/1000 RJ-45 routed Ethernet"],"lan_ports":["4 x 10/100/1000 RJ-45 managed switch"],"expansion_slots":["No NIM or PIM slot on base C1101-4P"],"console_usb":["Micro-USB console","USB 3.0 Type-A storage"],"features":["SD-WAN capable (supported software/license)","Stateful Firewall","IPsec VPN","NAT/PAT","VLANs","QoS"]},{"model":"Cisco ISR 4321","series":"ISR 4000","form_factor":"1RU Rackmount","wan_ports":["2 x Gigabit Ethernet routed interfaces: 2 RJ-45, 1 shared SFP receptacle"],"lan_ports":["No integrated LAN switch; onboard routed interfaces can serve LAN"],"expansion_slots":["2 x NIM","1 x onboard ISC/PVDM4","1 x shared SFP receptacle"],"console_usb":["RJ-45 console","Mini-USB Type-B console","RJ-45 AUX","USB 2.0 Type-A storage"],"features":["SD-WAN capable (supported software/license)","Zone-Based Firewall","IPsec VPN","NAT/PAT","QoS"]},{"model":"Cisco ISR 4331","series":"ISR 4000","form_factor":"1RU Rackmount","wan_ports":["3 x Gigabit Ethernet routed interfaces: 2 RJ-45, 2 SFP receptacles; one RJ-45/SFP combo"],"lan_ports":["No integrated LAN switch; onboard routed interfaces can serve LAN"],"expansion_slots":["2 x NIM","1 x SM-X","1 x onboard ISC/PVDM4","2 x SFP receptacles (one shared)"],"console_usb":["RJ-45 console","Mini-USB Type-B console","RJ-45 AUX","USB 2.0 Type-A storage"],"features":["SD-WAN capable (supported software/license)","Zone-Based Firewall","IPsec VPN","NAT/PAT","QoS"]},{"model":"Cisco C8200-1N-4T","series":"Catalyst 8200","form_factor":"1RU Rackmount","wan_ports":["2 x 1 Gigabit Ethernet RJ-45","2 x 1 Gigabit Ethernet SFP"],"lan_ports":["No integrated LAN switch; routed ports can serve LAN; optional switch NIM"],"expansion_slots":["1 x NIM","1 x PIM","2 x SFP receptacles"],"console_usb":["RJ-45 console","USB 3.0 Type-A storage"],"features":["Cisco Catalyst SD-WAN","Zone-Based Firewall","IPsec VPN","NAT/PAT","QoS"]},{"model":"Cisco C8300-2N2S-4T2X","series":"Catalyst 8300","form_factor":"2RU Rackmount","wan_ports":["4 x 1 Gigabit Ethernet RJ-45","2 x 10 Gigabit Ethernet SFP+"],"lan_ports":["No integrated LAN switch; routed ports can serve LAN; optional NIM/SM switch modules"],"expansion_slots":["2 x NIM","2 x SM","1 x PIM","2 x SFP+ receptacles"],"console_usb":["RJ-45 console","Micro-USB console","USB 3.0 Type-A storage"],"features":["Cisco Catalyst SD-WAN","Zone-Based Firewall","IPsec VPN","NAT/PAT","QoS","Dual redundant power supplies"]}];
const range=(prefix,count,start=0,type='RJ-45',speed='1 Gbps',switched=false)=>Array.from({length:count},(_,i)=>({value:prefix+(i+start),type,speed,switched}));
const ge=(count)=>range('GigabitEthernet0/0/',count);
const lan=()=>range('GigabitEthernet0/1/',4,0,'RJ-45','1 Gbps',true);
export const ROUTER_PORTS={
  'Cisco C921-4P':{wan:range('GigabitEthernet',2,4),lan:range('GigabitEthernet',4,0,'RJ-45','1 Gbps',true)},
  'Cisco C1111-4P':{wan:[{...ge(2)[0],type:'RJ-45 / SFP combo'},ge(2)[1]],lan:lan()},
  'Cisco C1101-4P':{wan:ge(1),lan:lan()},
  'Cisco ISR 4321':{wan:[{...ge(2)[0],type:'RJ-45 / SFP combo'},ge(2)[1]],lan:ge(2)},
  'Cisco ISR 4331':{wan:[{...ge(3)[0],type:'RJ-45 / SFP combo'},ge(3)[1],{...ge(3)[2],type:'SFP'}],lan:ge(3)},
  'Cisco C8200-1N-4T':{wan:ge(4).map((p,i)=>({...p,type:i<2?'SFP':'RJ-45'})),lan:ge(4).map((p,i)=>({...p,type:i<2?'SFP':'RJ-45'}))},
  'Cisco C8300-2N2S-4T2X':{wan:[...ge(4),...range('TenGigabitEthernet0/0/',2,4,'SFP+','10 Gbps')],lan:[...ge(4),...range('TenGigabitEthernet0/0/',2,4,'SFP+','10 Gbps')]}
};
export const routerModel=name=>CISCO_ROUTERS.find(row=>row.model===name);
export function modelPortOptions(model,role,exclude=''){
  return (ROUTER_PORTS[model]?.[role]||[]).filter(p=>p.value!==exclude).map(p=>({...p,label:p.value+' · '+p.speed+' · '+p.type+(p.switched?' · LAN switchport':' · routed')}));
}
export function selectRouterModel(site,model){
  site.routerModel=ROUTER_PORTS[model]?model:'';
  if(site.vendor!=='ios'||!site.routerModel)return;
  const ports=ROUTER_PORTS[model];
  if(!ports.wan.some(p=>p.value===site.wan))site.wan=ports.wan.find(p=>p.type==='RJ-45')?.value||ports.wan[0].value;
  if(site.lan===site.wan||!ports.lan.some(p=>p.value===site.lan))site.lan=ports.lan.find(p=>p.value!==site.wan&&p.type==='RJ-45')?.value||ports.lan.find(p=>p.value!==site.wan).value;
}
export const switchedLan=site=>site.vendor==='ios'&&Boolean(ROUTER_PORTS[site.routerModel]?.lan.some(p=>p.value===site.lan&&p.switched));
export function validateModelPorts(site){
  if(site.vendor!=='ios'||!site.routerModel)return [];
  const ports=ROUTER_PORTS[site.routerModel];
  if(!ports)return ['Choose a supported Cisco router model.'];
  return ['wan','lan'].filter(role=>!ports[role].some(p=>p.value===site[role])).map(role=>'The '+role.toUpperCase()+' port does not belong to '+site.routerModel+'. Choose an onboard port or select Custom / other model for installed modules.');
}
// Integrated LAN ports are Layer 2. Move routed commands to VLAN interfaces,
// and emit the physical access/trunk binding separately.
export function modelLanConfig(site,code){
  if(!switchedLan(site)||!code)return code;
  const dual=site.vlan2Enabled==='on';
  const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const physical=escape(site.lan);
  const sub=new RegExp(physical+'\\.(\\d+)(?![\\d/])','g');
  let output=code.replace(sub,(_,id)=>'Vlan'+id);
  const base=new RegExp(physical+'(?![\\w/.])','g');
  output=output.replace(base,'Vlan'+site.vlan);
  let vlanInterface=false;
  output=output.split('\n').filter(line=>{
    if(/^interface /.test(line))vlanInterface=/^interface Vlan\d+\s*$/.test(line);
    return !(vlanInterface&&/^\s*encapsulation dot1Q /.test(line));
  }).join('\n');
  const binding='configure terminal\n'+[site.vlan,...(dual?[site.vlan2]:[])].map(id=>'vlan '+id+'\n exit\n').join('')+'interface '+site.lan+'\n'+(dual?' switchport mode trunk\n switchport trunk native vlan '+(site.officeVlans?'1':site.vlan)+'\n switchport trunk allowed vlan '+site.vlan+','+site.vlan2:' switchport mode access\n switchport access vlan '+site.vlan)+'\n no shutdown\n exit\nend\n';
  return binding+output;
}
