/** Find long straight diagram wires; ignore short icon/text strokes. No DOM or network. */
export function findDiagramWires({data,width,height},textBoxes=[]){
  if(!data||width<1||height<1||width*height>6000000)return [];
  const step=Math.max(1,Math.ceil(Math.sqrt(width*height/650000))),points=[],dark=[];
  const excluded=(x,y)=>textBoxes.some(b=>x>=b.x0-3&&x<=b.x1+3&&y>=b.y0-3&&y<=b.y1+3);
  for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){
    const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b);
    if(excluded(x,y))continue;
    if(max-min>55&&max>65&&min<180)points.push({x,y});
    else if(max<95)dark.push({x,y});
  }
  let remaining=points.length>100?points:dark;
  if(remaining.length>8000)remaining=remaining.filter((_,i)=>i%Math.ceil(remaining.length/8000)===0);
  const wires=[],gap=Math.max(24,Math.min(width,height)*.045),minSpan=Math.max(50,Math.min(width,height)*.07),tolerance=Math.max(2,step*1.6);
  let seed=74591;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let pass=0;pass<16&&remaining.length>20;pass++){
    let best=null;
    for(let attempt=0;attempt<240;attempt++){
      const a=remaining[Math.floor(random()*remaining.length)],b=remaining[Math.floor(random()*remaining.length)],length=Math.hypot(b.x-a.x,b.y-a.y);
      if(length<minSpan)continue;
      const ux=(b.x-a.x)/length,uy=(b.y-a.y)/length,near=[];
      for(const p of remaining)if(Math.abs((p.x-a.x)*uy-(p.y-a.y)*ux)<=tolerance)near.push({p,t:(p.x-a.x)*ux+(p.y-a.y)*uy});
      near.sort((p,q)=>p.t-q.t);let first=0;
      for(let i=0;i<=near.length;i++)if(i===near.length||(i>0&&near[i].t-near[i-1].t>gap)){
        if(i-first>8){const span=near[i-1].t-near[first].t,score=span*Math.min(1,(i-first)*step/span);
          if(span>=minSpan&&(!best||score>best.score))best={a,b,ux,uy,start:near[first].t,end:near[i-1].t,score};}
        first=i;
      }
    }
    if(!best)break;
    const {a,ux,uy,start,end}=best;
    wires.push({x1:a.x+ux*start,y1:a.y+uy*start,x2:a.x+ux*end,y2:a.y+uy*end});
    remaining=remaining.filter(p=>{const t=(p.x-a.x)*ux+(p.y-a.y)*uy;return t<start-4||t>end+4||Math.abs((p.x-a.x)*uy-(p.y-a.y)*ux)>tolerance*2;});
  }
  return wires;
}

export function segmentDistance(p,line){
  const dx=line.x2-line.x1,dy=line.y2-line.y1,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((p.x-line.x1)*dx+(p.y-line.y1)*dy)/length)):0;
  return Math.hypot(p.x-line.x1-t*dx,p.y-line.y1-t*dy);
}

/** Port capsules add colored/black strokes perpendicular to a thin wire. */
export function findPortRegions({data,width,height},wires){
  const regions=[],unit=Math.max(1,Math.min(width,height)/900);
  const ink=(x,y)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=width||y>=height)return false;const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];return Math.max(r,g,b)-Math.min(r,g,b)>55&&Math.max(r,g,b)>65&&Math.min(r,g,b)<180;};
  for(const wire of wires){
    const length=Math.hypot(wire.x2-wire.x1,wire.y2-wire.y1),ux=(wire.x2-wire.x1)/length,uy=(wire.y2-wire.y1)/length,hits=[];
    for(let t=18*unit;t<length-18*unit;t+=unit*2){const x=wire.x1+ux*t,y=wire.y1+uy*t;let count=0;for(let off=4*unit;off<=12*unit;off+=unit){if(ink(x-uy*off,y+ux*off))count++;if(ink(x+uy*off,y-ux*off))count++;}if(count>=2)hits.push(t);}
    let first=0;for(let i=1;i<=hits.length;i++)if(i===hits.length||hits[i]-hits[i-1]>10*unit){
      if(i-first>=2){const t=(hits[first]+hits[i-1])/2,x=wire.x1+ux*t,y=wire.y1+uy*t;if(!regions.some(r=>Math.hypot(r.x-x,r.y-y)<24*unit))regions.push({x,y,x0:Math.max(0,x-25*unit),y0:Math.max(0,y-15*unit),x1:Math.min(width,x+25*unit),y1:Math.min(height,y+15*unit)});}
      first=i;
    }
  }
  return regions.slice(0,30);
}
