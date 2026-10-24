import {cidr} from './address.js';
/** Follow shared-context defaults while preserving explicitly different feature values. */
export function syncTopologyValues(bag,previous,next,role){
  const routed=s=>s.vlan2Enabled==='on'?`${s.lan}.${s.vlan}`:s.lan;
  const logical=s=>s.vlan2Enabled==='on'?routed(s):`${s.lan}.0`;
  const before=cidr(previous.local),after=cidr(next.local);
  for(const[id,d]of Object.entries(bag)){
    const ports=role==='router'?new Map([[previous.lan,routed(next)],[routed(previous),routed(next)],[previous.wan,next.wan]]):new Map([[previous.access,next.access],['Vlan'+previous.vlan,'Vlan'+next.vlan]]);
    for(const key of ['interface','inside','outside','sourceInterface'])if(ports.has(d[key]))d[key]=ports.get(d[key]);
    if(d.routerId===previous.lanIp)d.routerId=next.lanIp;
    if(d.network===previous.local)d.network=next.local;
    if(id==='qos'&&d.source===previous.local)d.source=next.local;
    if(id==='gre_tunnel'&&d.source===previous.ip)d.source=next.ip;
    if(id==='ospf'){
      if(before&&after&&d.networks===`${before.ip} ${before.wildcard}`)d.networks=`${after.ip} ${after.wildcard}`;
      if(typeof d.ospfInterfaces==='string')d.ospfInterfaces=d.ospfInterfaces.split(',').map(p=>[logical(previous),previous.lan+'.0'].includes(p.trim())?logical(next):p.trim()).join(',');
    }
  }
}
