import {cidr,ipv4,unicastNetwork} from './address.js';
import {segmentDistance} from './topology-photo-lines.js';

export function normalizePhotoPort(value){
  const text=String(value||'').trim().replace(/^[([]|[)\]]$/g,'').replace(/(\d)[Il](?=\d)/g,'$1/');
  const m=text.match(/^(ethernet|eth|e|gigabitethernet|gig|gi|g|fastethernet|fast|fa|f|tengigabitethernet|te)(\d+(?:\/\d+){0,3})$/i);
  if(!m)return '';
  const prefix=/^(gig|gi$|g$)/i.test(m[1])?'GigabitEthernet':/^(fast|fa$|f$)/i.test(m[1])?'FastEthernet':/^(ten|te$)/i.test(m[1])?'TenGigabitEthernet':'Ethernet';
  return prefix+m[2];
}
export function parseOcrTsv(tsv,scale=1){
  const groups=new Map();
  for(const row of String(tsv||'').split('\n').slice(1)){
    const c=row.split('\t');if(c.length<12||c[0]!=='5'||!c.slice(11).join('\t').trim())continue;
    const x=+c[6]/scale,y=+c[7]/scale,w=+c[8]/scale,h=+c[9]/scale;
    if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)continue;
    const key=c.slice(1,5).join('/'),word={text:c.slice(11).join('\t').trim(),confidence:+c[10],x0:x,y0:y,x1:x+w,y1:y+h};
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(word);
  }
  return [...groups.values()].map(words=>({text:words.map(w=>w.text).join(' '),confidence:words.reduce((a,w)=>a+w.confidence,0)/words.length,x0:Math.min(...words.map(w=>w.x0)),y0:Math.min(...words.map(w=>w.y0)),x1:Math.max(...words.map(w=>w.x1)),y1:Math.max(...words.map(w=>w.y1)),words}));
}
const center=b=>({x:(b.x0+b.x1)/2,y:(b.y0+b.y1)/2});
const nearest=(point,items,position=center)=>items.map(item=>({item,d:Math.hypot(point.x-position(item).x,point.y-position(item).y)})).sort((a,b)=>a.d-b.d)[0];
const safeLabel=text=>text.replace(/^[^A-Za-z0-9]+/,'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40);
const kindOf=text=>/^(isp|internet|cloud)(?:[-_\d]|$)/i.test(text)?'isp':/^(sw|switch)(?:[-_\d]|$)/i.test(text)?'switch':/^(r|router)(?:[-_\d]|$)/i.test(text)?'router':/^(win|windows|pc|host|linux|ubuntu)(?:[-_\d]|$)/i.test(text)?'host':null;
const captionOf=text=>text.match(/(?:router[-_\w]*|r[-_][\w-]+|sw[-_][\w-]+|switch[-_\w]*|isp[-_\w]*|\b(?:win|windows|pc|host|linux|ubuntu)[-_\w]*)/i)?.[0]||text;

/** Accept observed CIDR or a contiguous dotted mask; never repair ambiguous digits. */
export function parsePhotoAddress(text){
  const compact=String(text||'').replace(/\s*\.\s*/g,'.');
  const match=compact.match(/\b((?:\d{1,3}\.){3}\d{1,3})\s*(?:\/\s*(\d{1,2})(?![\d.])|(?:\/|\s+(?:mask\s+)?)\s*((?:\d{1,3}\.){3}\d{1,3}))\b/i);
  if(!match||ipv4(match[1])===null)return null;
  let prefix=match[2];
  if(match[3]){const mask=ipv4(match[3]);if(mask===null)return null;prefix=Array.from({length:30},(_,i)=>i+1).find(n=>cidr(`1.0.0.1/${n}`).mask===match[3]);}
  return +prefix>=1&&+prefix<=30?{ip:match[1],prefix:String(+prefix)}:null;
}

/** Merge repeated OCR passes by position, preserving conflicting readings for review. */
export function mergePhotoOcrLines(...passes){
  const merged=[];
  const type=l=>parsePhotoAddress(l.text)?'ip':normalizePhotoPort(l.text)?'port':kindOf(safeLabel(captionOf(l.text)))?'device':'text';
  for(const line of passes.flat()){
    const item={...line,words:line.words?.map(w=>({...w})),alternatives:[...(line.alternatives||[])]};
    const index=merged.findIndex(old=>{
      if(type(old)!==type(item))return false;
      const overlap=Math.max(0,Math.min(old.x1,item.x1)-Math.max(old.x0,item.x0))*Math.max(0,Math.min(old.y1,item.y1)-Math.max(old.y0,item.y0));
      const area=Math.min((old.x1-old.x0)*(old.y1-old.y0),(item.x1-item.x0)*(item.y1-item.y0));
      return area>0&&overlap/area>.55;
    });
    if(index<0){merged.push(item);continue;}
    const old=merged[index],winner=item.confidence>old.confidence?item:old,other=winner===item?old:item;
    winner.alternatives=[...new Set([...old.alternatives,...item.alternatives,...(winner.text!==other.text?[other.text]:[])])].filter(t=>t!==winner.text);
    merged[index]=winner;
  }
  return merged;
}

/** Spatial OCR + detected wires produce suggestions, never trusted configuration. */
export function inferPhotoOffice(lines,wires,width,height){
  const nodes=[],ports=[],addresses=[];
  for(const line of lines){
    const ip=parsePhotoAddress(line.text);
    if(ip){addresses.push({...line,...ip,...center(line)});continue;}
    const portWords=line.words?.length?line.words:[line];
    for(const word of portWords){const name=normalizePhotoPort(word.text);if(name)ports.push({...word,name,...center(word)});}
    if(portWords.some(w=>normalizePhotoPort(w.text)))continue;
    const caption=captionOf(line.text);
    const name=safeLabel(caption),kind=kindOf(name);
    if(kind){const c=center(line);nodes.push({...line,name,kind,x:c.x,y:Math.max(0,line.y0-Math.max(12,(line.y1-line.y0)*1.8))});}
  }
  // Keep each observed caption distinct; duplicate device classes need explicit selection.
  const links=[];let inferredUpstream=false;
  if(!nodes.some(n=>n.kind==='isp'))for(const wire of wires){
    const a={x:wire.x1,y:wire.y1},b={x:wire.x2,y:wire.y2},na=nearest(a,nodes,n=>n),nb=nearest(b,nodes,n=>n);
    if(!na||!nb)continue;const start=na.item.kind==='router'&&na.d<90&&nb.d>100?b:nb.item.kind==='router'&&nb.d<90&&na.d>100?a:null;
    if(start){nodes.push({name:'Upstream-unread',kind:'isp',confidence:0,x:start.x,y:start.y,x0:start.x,y0:start.y,x1:start.x,y1:start.y});inferredUpstream=true;break;}
  }
  for(const wire of wires){
    const a=nearest({x:wire.x1,y:wire.y1},nodes,n=>n),b=nearest({x:wire.x2,y:wire.y2},nodes,n=>n);
    if(!a||!b||a.item===b.item||Math.max(a.d,b.d)>Math.max(90,Math.min(width,height)*.18))continue;
    const key=[a.item.name,b.item.name].sort().join('|');if(links.some(l=>l.key===key))continue;
    links.push({key,a:a.item,b:b.item,wire,ports:[]});
  }
  for(const port of ports){
    const node=nearest(port,nodes,n=>n);if(!node||node.d>Math.min(width,height)*.35)continue;port.node=node.item;
    const candidates=links.filter(l=>l.a===port.node||l.b===port.node).map(link=>({link,d:segmentDistance(port,link.wire)})).sort((a,b)=>a.d-b.d);
    if(candidates[0]&&candidates[0].d<Math.max(35,Math.min(width,height)*.05)){port.link=candidates[0].link;port.link.ports.push(port);}
  }
  const routers=nodes.filter(n=>n.kind==='router'),switches=nodes.filter(n=>n.kind==='switch'),hosts=nodes.filter(n=>n.kind==='host');
  const router=routers[0],sw=switches[0],host=hosts[0],notes=[];
  if(inferredUpstream)notes.push('An unlabeled upstream endpoint was inferred from a router wire. Verify that this is the ISP link.');
  if(routers.length!==1||switches.length!==1||hosts.length>1)notes.push('Automatic office mapping supports one router, one switch and at most one host. Select/correct the device and port fields below for this office segment.');
  const portFor=(node,peerKind)=>{const link=links.find(l=>(l.a===node&&l.b.kind===peerKind)||(l.b===node&&l.a.kind===peerKind));return link?.ports.filter(p=>p.node===node).sort((a,b)=>b.confidence-a.confidence)[0];};
  const wan=router&&portFor(router,'isp'),lan=router&&portFor(router,'switch'),up=sw&&portFor(sw,'router'),access=sw&&portFor(sw,'host');
  const addressFor=port=>port&&nearest(port,addresses,a=>a)?.item;
  const wanAddress=addressFor(wan),lanAddress=addressFor(lan);
  if(!wan||!lan||!up||!access)notes.push('Some connection labels could not be paired with a wire. Fill the missing ports by comparing the photo.');
  if(wanAddress&&lanAddress&&wanAddress===lanAddress)notes.push('The same IP label is near both router ports. Verify both assignments.');
  notes.push('ISP gateway, management addresses and host IPs are never guessed. Complete missing fields before generating.');
  if(ports.some(p=>p.confidence<65)||nodes.some(n=>n.confidence<65))notes.push('Some text has low OCR confidence. Verify every caption and port against the image.');
  if(lines.some(l=>l.alternatives?.length))notes.push('OCR passes disagreed on some text. Alternative readings are listed under Recognized text; compare them with the full-size image.');
  const model={routerName:router?.name||'',wanPort:wan?.name||'',wanIp:wanAddress?.ip||'',wanPrefix:wanAddress?.prefix||'',gateway:'',lanPort:lan?.name||'',lanIp:lanAddress?.ip||'',lanPrefix:lanAddress?.prefix||'',switchName:sw?.name||'',uplink:up?.name||'',access:access?.name||'',vlan:'1',hostName:host?.name||'',hostPort:host&&ports.find(p=>p.node===host)?.name||'',hostIp:'',hostAdapter:host&&/win/i.test(host.name)?'Ethernet':'eth0',hostOs:host&&/win/i.test(host.name)?'windows':'linux',dns:'8.8.8.8',ntp:'129.250.35.251',dhcp:true,nat:true,route:true};
  return {model,notes,nodes,ports,links,addresses};
}
function hostAddress(ip,prefix,label){
  const n=cidr(`${ip}/${prefix}`),value=ipv4(ip);
  if(!/^([1-9]|[12]\d|30)$/.test(String(prefix))||!unicastNetwork(n)||value<=n.network||value>=n.end)throw Error(`${label}: enter a usable unicast IPv4 host with prefix /1–/30.`);
  return n;
}
export function generatePhotoOffice(d){
  try{
    const name=(v,label)=>{if(!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(v||''))throw Error(`${label}: use a CLI-safe device name.`);return v;};
    name(d.routerName,'Router name');name(d.switchName,'Switch name');
    const wan=hostAddress(d.wanIp,d.wanPrefix,'WAN'),lan=hostAddress(d.lanIp,d.lanPrefix,'LAN');
    if(wan.network<=lan.end&&lan.network<=wan.end)throw Error('WAN and LAN networks must not overlap.');
    const physical=value=>{const p=normalizePhotoPort(value);if(!p||!p.includes('/'))throw Error('Enter a physical router/switch port, for example e1/0 or GigabitEthernet0/1.');return p;};
    const wanPort=physical(d.wanPort),lanPort=physical(d.lanPort),uplink=physical(d.uplink),access=physical(d.access);
    if(wanPort===lanPort||uplink===access)throw Error('Each link on the same device requires a different physical port.');
    if(!/^\d+$/.test(String(d.vlan))||+d.vlan<1||+d.vlan>4094||(+d.vlan>=1002&&+d.vlan<=1005))throw Error('Access VLAN must be 1–4094, excluding reserved VLANs 1002–1005.');
    const gateway=ipv4(d.gateway);if(d.route&&(gateway===null||gateway<=wan.network||gateway>=wan.end||gateway===ipv4(d.wanIp)))throw Error('Enter the real ISP gateway: a different usable host in the WAN subnet.');
    for(const key of ['dns','ntp']){const ip=ipv4(d[key]);if(ip===null||ip<16777216||(ip>>>24)===127||ip>=0xe0000000)throw Error(`${key.toUpperCase()}: enter a unicast IPv4 address.`);}
    const host=d.hostIp?hostAddress(d.hostIp,d.lanPrefix,'Host'):null;
    if(host&&(host.network!==lan.network||d.hostIp===d.lanIp))throw Error('Host IP must be a different usable address in the LAN subnet.');
    const router=[`hostname ${d.routerName}`,'ip cef','no ip domain lookup','ip domain name cisco.com',`ntp server ${d.ntp} prefer`];
    if(d.dhcp){
      if(lan.end-lan.network-1-(d.hostIp?2:1)<1)throw Error('No DHCP addresses remain after the gateway and static host reservations.');
      router.push('service dhcp',`ip dhcp excluded-address ${d.lanIp}`,...(d.hostIp?[`ip dhcp excluded-address ${d.hostIp}`]:[]),`ip dhcp pool USERS\n network ${lan.ip} ${lan.mask}\n default-router ${d.lanIp}\n dns-server ${d.dns}\n exit`);
    }
    router.push(`interface ${wanPort}\n description TO_ISP\n ip address ${d.wanIp} ${wan.mask}${d.nat?'\n ip nat outside':''}\n ip virtual-reassembly in\n no shutdown\n exit`,`interface ${lanPort}\n description TO_${d.switchName}_${uplink.replaceAll('/','_')}\n ip address ${d.lanIp} ${lan.mask}${d.nat?'\n ip nat inside':''}\n ip virtual-reassembly in\n no shutdown\n exit`);
    if(d.nat)router.push(`ip access-list extended NAT\n permit ip ${lan.ip} ${lan.wildcard} any\n exit\nip nat inside source list NAT interface ${wanPort} overload`);
    if(d.route)router.push(`ip route 0.0.0.0 0.0.0.0 ${d.gateway}`);
    const sw=[`hostname ${d.switchName}`,...(+d.vlan!==1?[`vlan ${+d.vlan}\n name USERS\n exit`]:[]),`interface ${uplink}\n description TO_${d.routerName}_${lanPort.replaceAll('/','_')}\n switchport mode access\n switchport access vlan ${+d.vlan}\n no shutdown\n exit`,`interface ${access}\n description TO_${d.hostName?name(d.hostName,'Host name'):'HOST'}\n switchport mode access\n switchport access vlan ${+d.vlan}\n spanning-tree portfast\n spanning-tree bpduguard enable\n no shutdown\n exit`];
    const scripts=[{title:d.routerName+' · Cisco IOS router',code:'configure terminal\n'+router.join('\n')+'\nend\n'},{title:d.switchName+' · Cisco Layer 2 switch',code:'configure terminal\n'+sw.join('\n')+'\nend\n'}];
    if(d.hostIp){
      if(!['windows','linux'].includes(d.hostOs))throw Error('Choose Windows or Linux for the host.');
      if(!/^[A-Za-z][A-Za-z0-9 _-]{0,35}$/.test(d.hostAdapter||''))throw Error('Host adapter: use a CLI-safe adapter name.');
      scripts.push({title:(d.hostName||'Host')+' · '+d.hostOs,code:d.hostOs==='windows'?`netsh interface ipv4 set address name="${d.hostAdapter}" static ${d.hostIp} ${lan.mask} ${d.lanIp}\nnetsh interface ipv4 set dnsservers name="${d.hostAdapter}" static ${d.dns} primary\n`:`sudo ip link set dev ${d.hostAdapter} up\nsudo ip address replace ${d.hostIp}/${d.lanPrefix} dev ${d.hostAdapter}\nsudo ip route replace default via ${d.lanIp} dev ${d.hostAdapter}\n`});
    }
    return {errors:[],scripts};
  }catch(error){return {errors:[error.message],scripts:[]};}
}
