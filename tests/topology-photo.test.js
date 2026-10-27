import assert from 'node:assert/strict';
import {normalizePhotoPort,parseOcrTsv,inferPhotoOffice,generatePhotoOffice,parsePhotoAddress,mergePhotoOcrLines} from '../static/vpn/topology-photo-model.js';
import {photoWorkerOptions,preparePhotoPixels,normalizePhotoWirePixels} from '../static/vpn/topology-photo-ocr.js';
import {findDiagramWires} from '../static/vpn/topology-photo-lines.js';
const line=(text,x,y,w=50,h=14)=>({text,x0:x,y0:y,x1:x+w,y1:y+h,confidence:95});
const lines=[line('R-Tbilisi',77,100),line('SW-1',80,280),line('Win',85,460),line('ISP-01',595,95),line('e1/0',145,63,30),line('e1/2',85,133,30),line('e0/0',85,213,30),line('e0/1',85,323,30),line('e0',85,393,30),line('192.168.73.2 /24',220,25,130),line('192.168.1.1 /24',0,135,80)];
const data=new Uint8ClampedArray(720*500*4);data.fill(255);
for(const [x1,y1,x2,y2]of [[125,70,595,70],[100,115,100,245],[100,295,100,425]])for(let i=0;i<=Math.max(x2-x1,y2-y1);i++){const x=x1+(x2-x1?i:0),y=y1+(y2-y1?i:0),offset=(y*720+x)*4;data[offset]=0;data[offset+1]=105;data[offset+2]=183;}
const wires=findDiagramWires({data,width:720,height:500});assert.ok(wires.length>=3);
const extracted=inferPhotoOffice(lines,wires,720,500),m=extracted.model;
assert.equal(extracted.links.length,3);assert.equal(m.routerName,'R-Tbilisi');assert.equal(m.switchName,'SW-1');assert.equal(m.wanPort,'Ethernet1/0');assert.equal(m.lanPort,'Ethernet1/2');assert.equal(m.uplink,'Ethernet0/0');assert.equal(m.access,'Ethernet0/1');assert.equal(m.wanIp,'192.168.73.2');assert.equal(m.wanPrefix,'24');assert.equal(m.lanIp,'192.168.1.1');assert.equal(m.gateway,'');assert.equal(m.hostIp,'');
assert.equal(normalizePhotoPort('Gi0/1'),'GigabitEthernet0/1');assert.equal(normalizePhotoPort('e1I0'),'Ethernet1/0');assert.equal(normalizePhotoPort('e1/0;reload'),'');
const tsv='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t20\t40\t50\t20\t95\te1/0\n';const parsed=parseOcrTsv(tsv,2);assert.equal(parsed[0].x0,10);assert.equal(parsed[0].text,'e1/0');
assert.ok(generatePhotoOffice(m).errors.length,'Missing gateway blocks routing rather than guessing');
const valid={...m,gateway:'192.168.73.1',hostIp:'192.168.1.10',hostOs:'windows',hostAdapter:'Ethernet'},r=generatePhotoOffice(valid);assert.deepEqual(r.errors,[]);assert.equal(r.scripts.length,3);
assert.match(r.scripts[0].code,/interface Ethernet1\/0\n description TO_ISP\n ip address 192\.168\.73\.2 255\.255\.255\.0/);assert.match(r.scripts[0].code,/interface Ethernet1\/2/);assert.match(r.scripts[0].code,/list NAT interface Ethernet1\/0 overload/);assert.match(r.scripts[0].code,/0\.0\.0\.0 0\.0\.0\.0 192\.168\.73\.1/);assert.match(r.scripts[1].code,/interface Ethernet0\/0/);assert.match(r.scripts[1].code,/interface Ethernet0\/1/);assert.doesNotMatch(r.scripts[1].code,/ip nat|ip address/);assert.match(r.scripts[2].code,/netsh interface ipv4 set address name="Ethernet"/);
for(const [key,value]of [['routerName','R1\nreload'],['switchName','SW;reload'],['wanPort','e1/0\nreload'],['wanPort','e1/2'],['wanIp','192.168.1.2'],['gateway','192.168.73.2'],['gateway','10.0.0.1'],['wanPrefix','0'],['wanPrefix','31'],['hostIp','192.168.1.1'],['hostAdapter','Ethernet" & whoami'],['vlan','1002'],['vlan','1\nreload'],['ntp','129.250.35.251\nreload']]){const bad=generatePhotoOffice({...valid,[key]:value});assert.ok(bad.errors.length,key);assert.equal(bad.scripts.length,0);}
const noRoute=generatePhotoOffice({...valid,route:false,gateway:'',nat:false,dhcp:false,hostIp:''});assert.deepEqual(noRoute.errors,[]);assert.equal(noRoute.scripts.length,2);assert.doesNotMatch(noRoute.scripts[0].code,/ip route|ip nat|ip dhcp/);
const linux=generatePhotoOffice({...valid,hostOs:'linux',hostAdapter:'eth0'});assert.match(linux.scripts[2].code,/sudo ip address replace 192\.168\.1\.10\/24 dev eth0/);
const unknown=inferPhotoOffice([],[],100,100);assert.equal(unknown.model.wanPort,'');assert.equal(unknown.model.gateway,'');assert.ok(unknown.notes.length);
console.log('Topology photo: OCR geometry, wire pairing, port normalization, /24 masks, unknown fields, device separation, host OS, optional services and atomic injection validation passed.');

assert.deepEqual(parsePhotoAddress('WAN 192.168.73.2 / 24'),{ip:'192.168.73.2',prefix:'24'});
assert.deepEqual(parsePhotoAddress('192 . 168 . 1 . 1 255.255.255.0'),{ip:'192.168.1.1',prefix:'24'});
assert.deepEqual(parsePhotoAddress('192.168.73.2/255.255.255.0'),{ip:'192.168.73.2',prefix:'24'});
for(const value of ['192.168.1.1 255.0.255.0','192.168.O.1/24','999.1.1.1/24','192.168.1.1/32','192.168.1.1/245'])assert.equal(parsePhotoAddress(value),null,value);
const merged=mergePhotoOcrLines([{...line('R-Thilisi',50,70),confidence:40}],[{...line('R-Tbilisi',50,70),confidence:95}], [line('R-Tbilisi',250,70)]);
assert.equal(merged.length,2,'Repeated OCR passes deduplicate the same location, not distinct devices');assert.equal(merged[0].text,'R-Tbilisi');assert.deepEqual(merged[0].alternatives,['R-Thilisi']);
const dark={data:new Uint8ClampedArray([0,0,0,255,255,255,255,255])};preparePhotoPixels(dark);assert.equal(dark.data[0],255);assert.equal(dark.data[4],0,'Dark background becomes white');
const gray={data:new Uint8ClampedArray([170,170,170,255,245,245,245,255])};preparePhotoPixels(gray,'gray');assert.ok(gray.data[0]>0&&gray.data[0]<255);assert.equal(gray.data[4],255);
const faint={data:new Uint8ClampedArray([140,140,140,255,230,230,230,255])};preparePhotoPixels(faint,'stretch');assert.equal(faint.data[0],0);assert.equal(faint.data[4],255,'Local contrast stretching separates faint glyphs from the background');
assert.match(photoWorkerOptions().langPath,/best_int$/,'Use the browser-compatible best integer model');assert.equal(photoWorkerOptions().gzip,true);
console.log('Photo enhancements: dotted masks, ambiguous text rejection, spatial pass deduplication, dark/gray preprocessing and pinned browser model passed.');

const faintWire={data:new Uint8ClampedArray([130,170,220,255,245,245,245,255])};normalizePhotoWirePixels(faintWire);assert.equal(faintWire.data[0],0);assert.equal(faintWire.data[4],255);assert.ok(faintWire.data[2]-faintWire.data[0]>55);
