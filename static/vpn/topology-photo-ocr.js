import {parseOcrTsv,inferPhotoOffice,normalizePhotoPort,parsePhotoAddress,mergePhotoOcrLines} from './topology-photo-model.js';
import {findDiagramWires,findPortRegions} from './topology-photo-lines.js';

export function photoWorkerOptions(){
  return {
    workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
    corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',
    langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
    gzip:true,cachePath:'noc-photo-best-int-1.0.0'
  };
}

/** Keep gray text edges for the second pass; remove light screenshot grids in binary mode. */
export function preparePhotoPixels(pixels,mode='binary'){
  const {data}=pixels;let light=0,count=0;
  for(let i=0;i<data.length;i+=400){light+=(data[i]+data[i+1]+data[i+2])/3;count++;}
  const invert=count&&light/count<110;
  let low=30,high=220;
  if(mode==='stretch'){
    const histogram=new Uint32Array(256);for(let i=0;i<data.length;i+=4){let v=Math.round(.299*data[i]+.587*data[i+1]+.114*data[i+2]);if(invert)v=255-v;histogram[v]++;}
    const total=data.length/4;let sum=0;
    for(let i=0;i<256;i++){sum+=histogram[i];if(sum>=total*.02){low=i;break;}}
    sum=0;for(let i=255;i>=0;i--){sum+=histogram[i];if(sum>=total*.02){high=i;break;}}
    if(high-low<24){low=30;high=220;}
  }
  for(let i=0;i<data.length;i+=4){
    let value=.299*data[i]+.587*data[i+1]+.114*data[i+2];
    if(invert)value=255-value;
    value=mode==='binary'?(value<(invert?140:195)?0:255):Math.max(0,Math.min(255,(value-low)*255/(high-low)));
    data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  return pixels;
}

/** Preserve hue while restoring faint colored wire/capsule strokes to the detector's range. */
export function normalizePhotoWirePixels(pixels){
  const {data}=pixels;let low=255,high=0;
  for(let i=0;i<data.length;i+=4)for(let channel=0;channel<3;channel++){low=Math.min(low,data[i+channel]);high=Math.max(high,data[i+channel]);}
  if(high-low<24)return pixels;
  for(let i=0;i<data.length;i+=4)for(let channel=0;channel<3;channel++)data[i+channel]=(data[i+channel]-low)*255/(high-low);
  return pixels;
}

function canvasFor(image,region,zoom=1,padding=0,mode='original'){
  const x=Math.max(0,region.x0),y=Math.max(0,region.y0),w=Math.min(image.naturalWidth,region.x1)-x,h=Math.min(image.naturalHeight,region.y1)-y;
  if(w<3||h<3)return null;
  zoom=Math.min(zoom,Math.sqrt(5900000/(w*h)));
  const whole=region.x0===0&&region.y0===0&&region.x1===image.naturalWidth&&region.y1===image.naturalHeight;
  const canvas=document.createElement('canvas');canvas.width=(whole?Math.round(w*zoom):Math.ceil(w*zoom))+2*padding;canvas.height=(whole?Math.round(h*zoom):Math.ceil(h*zoom))+2*padding;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(image,x,y,w,h,padding,padding,whole?canvas.width-2*padding:w*zoom,whole?canvas.height-2*padding:h*zoom);
  if(mode!=='original')context.putImageData(preparePhotoPixels(context.getImageData(padding,padding,canvas.width-2*padding,canvas.height-2*padding),mode),padding,padding);
  return {canvas,x,y,zoom,padding};
}

/** A bounded series of local OCR jobs. Cancellation is checked before and after every job. */
export async function readPhotoTopology(image,worker,{enhanced=true,progress=()=>{},check=()=>{}}={}){
  const full={x0:0,y0:0,x1:image.naturalWidth,y1:image.naturalHeight};
  const recognize=async(region,psm,zoom=5,padding=0,mode='original',whitelist='')=>{
    check();const view=canvasFor(image,region,zoom,padding,mode);if(!view)return [];
    await worker.setParameters({tessedit_pageseg_mode:String(psm),tessedit_char_whitelist:whitelist,preserve_interword_spaces:'1'});
    const {data}=await worker.recognize(view.canvas,{}, {text:true,tsv:true});check();
    const {x,y,padding:pad,zoom:z}=view,offset=b=>({...b,x0:b.x0+x-pad/z,x1:b.x1+x-pad/z,y0:b.y0+y-pad/z,y1:b.y1+y-pad/z});
    return parseOcrTsv(data.tsv,z).map(l=>({...offset(l),words:l.words.map(offset)}));
  };
  const scale=Math.min(3,2600/Math.max(image.naturalWidth,image.naturalHeight),Math.sqrt(5800000/(image.naturalWidth*image.naturalHeight)));
  progress('Reading diagram text · contrast pass');
  let lines=await recognize(full,11,scale,0,'binary');
  const geometryLines=lines;
  if(enhanced){
    progress('Reading diagram text · grayscale pass');
    lines=mergePhotoOcrLines(lines,await recognize(full,11,scale,0,'gray'));
    // Downscaling large screenshots can erase tiny glyphs. Six overlapping native-detail tiles bound the work.
    if(Math.max(image.naturalWidth,image.naturalHeight)>1800){
      const cols=image.naturalWidth>=image.naturalHeight?3:2,rows=6/cols;
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        progress(`Reading small text · tile ${row*cols+col+1}/6`);
        const tile={x0:col*image.naturalWidth/cols-35,y0:row*image.naturalHeight/rows-35,x1:(col+1)*image.naturalWidth/cols+35,y1:(row+1)*image.naturalHeight/rows+35};
        lines=mergePhotoOcrLines(lines,await recognize(tile,11,2,10,'gray'));
      }
    }
  }
  progress('Pairing text with diagram wires');
  const wireScale=Math.min(1,Math.sqrt(5900000/(image.naturalWidth*image.naturalHeight))),view=canvasFor(image,full,wireScale),context=view.canvas.getContext('2d');
  const pixels=context.getImageData(0,0,view.canvas.width,view.canvas.height);
  if(enhanced)normalizePhotoWirePixels(pixels);
  // OCR sometimes calls a long wire one enormous word. Do not erase that wire as text.
  const boxes=geometryLines.flatMap(l=>l.words||[l]).filter(w=>/[a-z0-9]{2}/i.test(w.text)&&(w.x1-w.x0)/Math.max(1,w.y1-w.y0)<15).map(l=>({x0:l.x0*wireScale,y0:l.y0*wireScale,x1:l.x1*wireScale,y1:l.y1*wireScale}));
  const rawWires=findDiagramWires(pixels,boxes),wires=rawWires.map(l=>Object.fromEntries(Object.entries(l).map(([k,v])=>[k,v/wireScale])));
  const known=inferPhotoOffice(lines,[],image.naturalWidth,image.naturalHeight).nodes;
  for(const wire of wires.slice(0,8))for(const point of [{x:wire.x1,y:wire.y1},{x:wire.x2,y:wire.y2}]){
    check();if(known.length&&Math.min(...known.map(n=>Math.hypot(n.x-point.x,n.y-point.y)))>95)
      lines=mergePhotoOcrLines(lines,await recognize({x0:point.x-60,y0:point.y+5,x1:point.x+75,y1:point.y+70},11));
  }
  if(enhanced){
    const addresses=lines.filter(l=>parsePhotoAddress(l.text)).slice(0,12);
    for(let i=0;i<addresses.length;i++){
      progress(`Re-reading IP addresses · ${i+1}/${addresses.length}`);const a=addresses[i];
      const candidates=await recognize({x0:a.x0-8,y0:a.y0-5,x1:a.x1+8,y1:a.y1+5},7,4,20,'gray','0123456789./ ');
      lines=mergePhotoOcrLines(lines,candidates.filter(l=>parsePhotoAddress(l.text)));
    }
  }
  const regions=findPortRegions(pixels,rawWires).map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v/wireScale])));
  for(let i=0;i<regions.length;i++){
    progress(`Reading small port labels · ${i+1}/${regions.length}`);const r=regions[i];let accepted=[];
    const variants=[[25,8.4,0,'original',7],[12,7,30,'original',7],[17,8,30,'original',7],[25,9,30,'original',7]];
    if(enhanced)variants.push([12,7,30,'stretch',7],[17,8,30,'stretch',13],[18,9,30,'gray',7],[20,10,30,'binary',13]);
    for(const [halfWidth,halfHeight,padding,mode,psm] of variants){
      const candidates=await recognize({x0:r.x-halfWidth,y0:r.y-halfHeight,x1:r.x+halfWidth,y1:r.y+halfHeight},psm,5,padding,mode);
      accepted=candidates.filter(line=>{const token=line.text.replace(/[^A-Za-z0-9/]/g,''),name=normalizePhotoPort(token);if(!name||(!name.includes('/')&&!/^[A-Za-z]+\d$/.test(token)))return false;line.text=token;line.words=[{...line}];return true;});
      if(accepted.length)break;
    }
    lines=mergePhotoOcrLines(lines,accepted);
  }
  check();return {lines,wires};
}
