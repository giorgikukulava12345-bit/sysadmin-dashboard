import fs from 'node:fs';
import path from 'node:path';
const folder='data/mikrotik-source';
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;|&#160;/g,' ');
const plain=s=>decode(s.replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
const index=JSON.parse(fs.readFileSync(path.join(folder,'index.json'),'utf8').replace(/^\uFEFF/,''));
const rows=[];
for(const entry of index){
 const slug=entry.url.split('/').pop(),file=path.join(folder,slug+'.html');if(!fs.existsSync(file))throw Error('Missing official page '+slug);
 const html=fs.readFileSync(file,'utf8'),spec={};
 for(const match of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)){
  const spans=[...match[1].matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/g)].map(m=>plain(m[1]));
  if(spans.length===2&&spans[0]&&spans[1])spec[spans[0]]=spans[1];
 }
 const title=plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]||html.match(/<title>(.*?)<\/title>/)?.[1]||slug).replace(/^MikroTik\s*[·|-]\s*/,'');
 // Legacy generations predating the requested 2015 window are not added.
 if(/^(?:RB2011|RB1100(?:AH|AHx2|AHx2-LM|Hx2)$|RB1200$|RB250GS$|RB750(?:G|GL|UP)$|RB751|RB951|CCR1016|CCR1036|CRS(?:109|125|210|212|226)|CCR1009-8G)/.test(title)&&title!=='CCR1009-8G-1S-PC')continue;
 if(['cAP','mAP','PowerBox'].includes(title))continue;
 const desc=decode(html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/)?.[1]||'');
 const number=pattern=>Object.entries(spec).filter(([key])=>pattern.test(key)).reduce((n,[,v])=>n+(parseInt(v)||0),0);
 const groups=[['ether','100 Mbps',number(/^10\/100 Ethernet ports$/)],['ether','1 Gbps',number(/^10\/100\/1000 Ethernet ports$/)],['ether','2.5 Gbps',number(/^(?:Number of )?2\.5G Ethernet ports$/)],['ether','5 Gbps',number(/^(?:Number of )?5G Ethernet ports$/)],['ether','10 Gbps',number(/^(?:Number of )?10G Ethernet ports$/)],['sfp','1 Gbps',number(/^SFP ports$/)],['sfp-sfpplus','10 Gbps',number(/^SFP\+ ports$/)],['sfp28-','25 Gbps',number(/^(?:Number of )?SFP28 ports$/)],['qsfpplus','40 Gbps',number(/^QSFP\+ ports$/)],['qsfp28','100 Gbps',number(/^(?:Number of )?(?:100G )?QSFP28 ports$/)]].filter(g=>g[2]);
 const type=entry.group==='switches'?'switch':'router';
 const os=spec['Operating System']||spec['Operating system']||'';
 if(!os)continue; // Exclude antennas, cables, modems and other accessories listed in product groups.
 for(const key of ['Hardware','Software','Distributors','Support','Training','About'])delete spec[key];
 for(const [prefix,speed,pattern]of [['ether','10 Gbps',/^Number of 1G\/2.5G\/5G\/10G Ethernet ports$/],['sfp28-','25 Gbps',/^Number of 25G SFP28 ports$/],['qsfpplus','40 Gbps',/^Number of 40G QSFP\+ ports$/],['sfp56-','50 Gbps',/^Number of 50G SFP56 ports$/],['qsfp56','200 Gbps',/^Number of 200G QSFP56 ports$/],['qsfpdd','400 Gbps',/^Number of 400G QSFP56-DD ports$/]]){const count=number(pattern);if(count)groups.push([prefix,speed,count]);}
 for(const [prefix,speed,pattern]of [['Combo RJ-45 / SFP','1 Gbps',/^Ethernet Combo ports$/],['Combo RJ-45 / SFP+','10 Gbps',/^Number of Combo 10G Ethernet\/ SFP\+ ports$/]]){const count=number(pattern);if(count)groups.push([prefix,speed,count]);}
 const sfp=groups.find(g=>g[0]==='sfp');if(sfp&&/2\.5G supported/.test(spec['SFP ports']||''))sfp[1]='2.5 Gbps';
 const eth=groups.filter(g=>g[0]==='ether');
 let offset=1;
 // Product manuals identify ether1 as the multigigabit port on these families.
 if(/RB5009|C53UiG\+5HPaxD2HPaxD/.test(spec['Product code']||''))eth.sort((a,b)=>parseFloat(b[1])-parseFloat(a[1]));
 const inventory=groups.flatMap(([prefix,speed,count])=>Array.from({length:count},(_,i)=>({value:prefix==='ether'?'ether'+(offset++):prefix+(i+1),speed,type:prefix==='ether'?'RJ-45':prefix,label:(prefix==='ether'?'ether'+(offset-1):prefix+(i+1))+' · '+speed})));
 // Preserve the verified ordering for mixed-speed Ethernet products.
 if(eth.length>1&&/RB5009|C53UiG\+5HPaxD2HPaxD/.test(spec['Product code']||'')){
  const ethernet=eth.flatMap(([,speed,count])=>Array.from({length:count},()=>speed));
  inventory.filter(p=>p.type==='RJ-45').forEach((p,i)=>{p.speed=ethernet[i];p.label=p.value+' · '+p.speed;});
 }
 const reason=/coming soon/i.test(desc)?'Announced product; verify availability and factory interface names before configuration.':!/RouterOS/i.test(os)?'This model uses '+(os||'an unverified operating system')+'; RouterOS CLI is unavailable.':inventory.length<2?'Fewer than two verified wired ports; wireless/LTE WAN requires a device-specific design.':groups.some(g=>g[0].startsWith('qsfp')||g[0]==='sfp56-')?'High-speed breakout/interface naming requires verification on the device.':eth.length>1&&!/RB5009|C53UiG\+5HPaxD2HPaxD/.test(spec['Product code']||'')?'Mixed-speed Ethernet interface numbering requires verification on the device.':number(/Combo/i)>0?'Combo port sharing requires verification on the device.':'';
 if(reason)inventory.forEach((port,i)=>{port.label=port.type+' '+(i+1)+' · '+port.speed+' · hardware inventory';port.value='HardwarePort'+(i+1);});
 rows.push({model:'MikroTik '+title,product_code:spec['Product code']||'',series:type==='switch'?'MikroTik switches':entry.group==='indoor-wireless'?'MikroTik indoor wireless':entry.group==='lte-5g-products'?'MikroTik LTE / 5G':'MikroTik Ethernet routers',device_type:type,form_factor:spec.Dimensions||'See official product page',wan_ports:groups.map(([,speed,count])=>count+' × '+speed),lan_ports:groups.map(([,speed,count])=>count+' × '+speed),expansion_slots:Object.entries(spec).filter(([k])=>/M\.2|MiniPCI|miniPCI|SIM slot|microSD/i.test(k)).map(([k,v])=>k+': '+v),console_usb:Object.entries(spec).filter(([k])=>/Serial|USB|Console/i.test(k)).map(([k,v])=>k+': '+v),features:[os,...Object.entries(spec).filter(([k,v])=>/IPsec|PoE|Wireless.*standard/i.test(k)&&v!=='No').map(([k,v])=>k+': '+v)],os,source_url:entry.url,checked_at:'2026-10-28',availability:/coming soon/i.test(desc)?'announced':entry.status==='a'?'archived':'current',description:desc,release_year:null,period_note:'2015–present product coverage. The official catalog does not publish launch dates for every model; no launch year is inferred.',port_note:reason||'Factory-default wired interface names. Ports can be assigned to WAN or LAN. Renamed interfaces require Custom / other model.',cli_supported:!reason,ports:inventory,specifications:spec});
}
const unique=[...new Map(rows.map(r=>[r.model,r])).values()].sort((a,b)=>a.model.localeCompare(b.model));
fs.writeFileSync('data/mikrotik-models.json',JSON.stringify(unique)+'\n');
fs.writeFileSync('static/vpn/mikrotik-catalog.js','// Generated from official MikroTik product specifications. Run scripts/build-mikrotik-catalog.mjs.\nexport const MIKROTIK_CATALOG='+JSON.stringify(unique.map(({specifications,description,...r})=>r))+';\n');
console.log(JSON.stringify({models:unique.length,router:unique.filter(r=>r.device_type==='router').length,switch:unique.filter(r=>r.device_type==='switch').length,cli:unique.filter(r=>r.cli_supported).length,unparsed:unique.filter(r=>!r.ports.length).map(r=>r.model)},null,2));
