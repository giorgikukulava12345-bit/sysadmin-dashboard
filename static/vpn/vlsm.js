import { network, number, ipText } from './catalog.js';
export function planVlsm(base, departments) {
  try {
    const parent=network(base);
    if(!departments.length||departments.length>32)throw new Error('Add 1–32 departments.');
    const labels=new Set();
    const requests=departments.map((d,index)=>{
      const name=String(d.name).trim();
      if(!name||name.length>48||/[\x00-\x1f\x7f]/.test(name))throw new Error('Department names must be 1–48 printable characters.');
      if(labels.has(name.toLowerCase()))throw new Error('Department names must be unique.');labels.add(name.toLowerCase());
      const hosts=number(d.hosts,1,4294967294,'Required hosts');
      const size=2**Math.max(2,Math.ceil(Math.log2(hosts+2)));
      return {name,hosts,size,index};
    }).sort((a,b)=>b.size-a.size||a.index-b.index);
    let cursor=parent.network;
    const rows=requests.map(r=>{
      const start=Math.ceil(cursor/r.size)*r.size,end=start+r.size-1;
      if(end>parent.end)throw new Error('Base network has insufficient address space. Enlarge it or reduce host counts.');
      const prefix=32-Math.log2(r.size);cursor=end+1;
      return {...r,network:`${ipText(start)}/${prefix}`,mask:ipText((4294967296-r.size)>>>0),first:ipText(start+1),last:ipText(end-1),broadcast:ipText(end),usable:r.size-2};
    });
    return {errors:[],rows,unused:parent.end-cursor+1};
  } catch(error){return {errors:[error.message],rows:[],unused:0};}
}
export function vlsmTsv(rows){return [['Department','Requested hosts','Network','Subnet mask','First usable','Last usable','Broadcast','Usable hosts'],...rows.map(r=>[r.name,r.hosts,r.network,r.mask,r.first,r.last,r.broadcast,r.usable])].map(row=>row.join('\t')).join('\n');}
