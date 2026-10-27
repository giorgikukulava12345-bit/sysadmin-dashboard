// Interface suggestions are examples, not hardware discovery or OS conversion.
const range=(prefix,start=0,count=8)=>Array.from({length:count},(_,i)=>prefix+(start+i));
const cisco=[['GigabitEthernet','1 Gbps','Gi'],['FastEthernet','10/100 Mbps','Fa'],['TenGigabitEthernet','10 Gbps','Te'],['TwentyFiveGigE','25 Gbps','Twe'],['FortyGigabitEthernet','40 Gbps','Fo'],['HundredGigE','100 Gbps','Hu'],['Ethernet','Lab Ethernet','Et']];
export function portOptions(vendor){
  if(vendor==='ios')return cisco.flatMap(([prefix,speed,alias])=>[...range(prefix+'0/'),...range(prefix+'0/0/',0,4),prefix+'1',prefix+'2'].map(value=>({value,label:`${value} · ${speed} (${value.replace(prefix,alias)})`})));
  const rows=vendor==='juniper'?[['ge-0/0/','1 Gbps'],['fe-0/0/','100 Mbps'],['xe-0/0/','10 Gbps'],['et-0/0/','25/40/100G · model dependent']]:vendor==='mikrotik'?[['ether','Copper Ethernet',1],['sfp','SFP · model dependent',1],['sfp-sfpplus','SFP+',1],['sfpplus','SFP+ · renamed/legacy',1],['qsfp','QSFP · model dependent',1],['qsfp28-','QSFP28 · model dependent',1],['qsfpplus1-','QSFP+ channel',1],['qsfp28-1-','QSFP28 channel',1]]:vendor==='fortinet'?[['port','Physical port',1],['wan','WAN-labelled port',1],['sfp','SFP · model dependent',1],['slot1/port','Chassis · model dependent',1]]:vendor==='paloalto'?[['ethernet1/','Physical port',1]]:[];
  const options=rows.flatMap(([prefix,speed,start=0])=>range(prefix,start,vendor==='mikrotik'&&prefix.includes('1-')?4:8).map(value=>({value,label:`${value} · ${speed}`})));
  if(vendor==='paloalto')for(const port of [1,2])for(const tag of [10,20,100])options.push({value:`ethernet1/${port}.${tag}`,label:`ethernet1/${port}.${tag} · VLAN tag ${tag}`});
  return options;
}
export function normalizePort(vendor,value){
  if(vendor!=='ios')return value;
  const m=/^(Fa|Gi|Te|Twe|Fo|Hu|Et)(\d+(?:\/\d+)*(?:\.\d+)?)$/i.exec(value||'');
  if(!m)return value;
  const names={fa:'FastEthernet',gi:'GigabitEthernet',te:'TenGigabitEthernet',twe:'TwentyFiveGigE',fo:'FortyGigabitEthernet',hu:'HundredGigE',et:'Ethernet'};
  return names[m[1].toLowerCase()]+m[2];
}
export const isCiscoPhysical=value=>/^(?:FastEthernet|GigabitEthernet|TenGigabitEthernet|TwentyFiveGigE|FortyGigabitEthernet|HundredGigE|Ethernet)\d+(?:\/\d+)*$/.test(value||'');
