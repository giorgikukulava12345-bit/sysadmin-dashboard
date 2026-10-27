const range=(prefix,count,start=0,type='RJ-45',speed='1 Gbps',switched=false)=>Array.from({length:count},(_,i)=>({value:prefix+(i+start),type,speed,switched}));
const ge=(count)=>range('GigabitEthernet0/0/',count);
const lan=()=>range('GigabitEthernet0/1/',4,0,'RJ-45','1 Gbps',true);
export const VERIFIED_ROUTER_PORTS={
  'Cisco C921-4P':{wan:range('GigabitEthernet',2,4),lan:range('GigabitEthernet',4,0,'RJ-45','1 Gbps',true)},
  'Cisco C1111-4P':{wan:[{...ge(2)[0],type:'RJ-45 / SFP combo'},ge(2)[1]],lan:lan()},
  'Cisco C1101-4P':{wan:ge(1),lan:lan()},
  'Cisco ISR 4321':{wan:[{...ge(2)[0],type:'RJ-45 / SFP combo'},ge(2)[1]],lan:ge(2)},
  'Cisco ISR 4331':{wan:[{...ge(3)[0],type:'RJ-45 / SFP combo'},ge(3)[1],{...ge(3)[2],type:'SFP'}],lan:ge(3)},
  'Cisco C8200-1N-4T':{wan:ge(4).map((p,i)=>({...p,type:i<2?'SFP':'RJ-45'})),lan:ge(4).map((p,i)=>({...p,type:i<2?'SFP':'RJ-45'}))},
  'Cisco C8300-2N2S-4T2X':{wan:[...ge(4),...range('TenGigabitEthernet0/0/',2,4,'SFP+','10 Gbps')],lan:[...ge(4),...range('TenGigabitEthernet0/0/',2,4,'SFP+','10 Gbps')]}
};

