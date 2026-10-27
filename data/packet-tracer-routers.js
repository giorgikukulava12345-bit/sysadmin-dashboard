// Packet Tracer palette names from the user's reference and Cisco's simulator help.
// Module-dependent interfaces are entered explicitly; no serial card is assumed installed.
const source='https://tutorials.ptnetacad.net/help/default/devicesAndModules_routers.htm';
const ports=(prefix,count,speed='1 Gbps',start=0,switched=false)=>Array.from({length:count},(_,i)=>({value:prefix+(start+i),speed,type:'RJ-45',switched}));
const definitions=[
 {name:'4331',wan:ports('GigabitEthernet0/0/',3),slots:['2 x NIM; additional modules depend on simulator version']},
 {name:'4321',wan:ports('GigabitEthernet0/0/',2),slots:['2 x NIM; additional modules depend on simulator version']},
 {name:'1941',wan:ports('GigabitEthernet0/',2),slots:['2 x WIC / HWIC','Internal services module']},
 {name:'2901',wan:ports('GigabitEthernet0/',2),slots:['4 x EHWIC','Internal services module']},
 {name:'2911',wan:ports('GigabitEthernet0/',3),slots:['4 x EHWIC','Internal services module']},
 {name:'819IOX',wan:ports('GigabitEthernet',1),lan:ports('FastEthernet',4,'100 Mbps',0,true),slots:['Fixed Ethernet ports; cellular / IOx support depends on simulator']},
 {name:'819HGW',wan:ports('GigabitEthernet',1),lan:ports('FastEthernet',4,'100 Mbps',0,true),slots:['Fixed Ethernet ports; cellular / wireless support depends on simulator']},
 {name:'829',wan:ports('GigabitEthernet',1),lan:ports('GigabitEthernet',4,'1 Gbps',1,true),slots:['SFP option on WAN; wireless / cellular interfaces depend on simulator']},
 {name:'1240',wan:ports('GigabitEthernet2/',2,'1 Gbps',1),lan:ports('FastEthernet2/',4,'100 Mbps',3,true),slots:['CGR1240 expansion slots; installed modules vary']},
 {name:'PT-Router',wan:[],slots:['10 x Packet Tracer router module slots'],manual:true},
 {name:'PT-Empty',wan:[],slots:['10 x initially empty Packet Tracer router module slots'],manual:true},
 {name:'1841',wan:ports('FastEthernet0/',2,'100 Mbps'),slots:['2 x HWIC','1 x AIM']},
 {name:'2620XM',wan:ports('FastEthernet0/',1,'100 Mbps'),slots:['1 x network module','2 x WIC','1 x AIM'],manual:true},
 {name:'2621XM',wan:ports('FastEthernet0/',2,'100 Mbps'),slots:['1 x network module','2 x WIC','1 x AIM']},
 {name:'2811',wan:ports('FastEthernet0/',2,'100 Mbps'),slots:['1 x enhanced network module','4 x HWIC','2 x AIM']}
];
export const PACKET_TRACER_MODELS=definitions.map(d=>{
 const model=(d.name.startsWith('PT-')?'':'Cisco ')+d.name+' (Packet Tracer)';
 const lan=d.lan||d.wan;
 const descriptions=rows=>rows.map(p=>p.value+' · '+p.speed+(p.switched?' switched':' routed'));
 return {model,series:'Packet Tracer',form_factor:'Packet Tracer simulated router',
  wan_ports:d.wan.length?descriptions(d.wan):['Module-dependent; inspect installed Packet Tracer modules'],
  lan_ports:lan.length?descriptions(lan):['Module-dependent; no Ethernet interface assumed installed'],
  expansion_slots:d.slots,console_usb:['Simulated console / CLI tab','Physical USB management is not assumed'],
  features:['Packet Tracer simulation','IPv4 addressing','Selected IOS routing features; simulator support varies']};
});
export const PACKET_TRACER_PROFILES=Object.fromEntries(definitions.map((d,i)=>[PACKET_TRACER_MODELS[i].model,{
 os:'Packet Tracer IOS simulation',simulator:'Packet Tracer',cli_supported:true,manual_ports:Boolean(d.manual),requires_modules:Boolean(d.manual),
 source_url:source,checked_at:'2026-10-27',groups:[],
 port_note:'Packet Tracer simulator profile. Ethernet port names follow the modeled chassis. '+(d.manual?'Install the required modules in Packet Tracer, then enter the exact Ethernet / Serial interface names shown by show ip interface brief. A WAN/LAN pair needs two distinct installed interfaces. ':'Optional serial / switch modules are not assumed installed. ')+'Available IOS commands depend on Packet Tracer version; this is not a complete IOS image.'
}]));
export const PACKET_TRACER_PORTS=Object.fromEntries(definitions.map((d,i)=>[PACKET_TRACER_MODELS[i].model,{wan:d.wan,lan:d.lan||d.wan}]));
