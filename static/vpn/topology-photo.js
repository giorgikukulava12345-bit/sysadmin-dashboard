import {parseOcrTsv,inferPhotoOffice,generatePhotoOffice,normalizePhotoPort} from './topology-photo-model.js';
import {findDiagramWires,findPortRegions} from './topology-photo-lines.js';

let libraryPromise;
function ocrLibrary(){
  if(window.Tesseract?.createWorker)return Promise.resolve(window.Tesseract);
  if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';script.async=true;
    script.onload=()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(Error('OCR library did not initialize.'));
    script.onerror=()=>{script.remove();libraryPromise=null;reject(Error('Could not download the free OCR engine. Check your connection and retry, or fill the review fields manually.'));};document.head.append(script);
  });return libraryPromise;
}
const FIELDS=[
  ['routerName','Router name'],['wanPort','Router → ISP port'],['wanIp','WAN IPv4'],['wanPrefix','WAN prefix length'],['gateway','ISP gateway (enter if not visible)'],
  ['lanPort','Router → Switch port'],['lanIp','Router LAN IPv4'],['lanPrefix','LAN prefix length'],['switchName','Switch name'],['uplink','Switch → Router port'],['access','Switch → Host port'],['vlan','Untagged access VLAN (verify)'],
  ['hostName','Host name (optional)'],['hostPort','Host port label (from diagram)'],['hostIp','Static host IPv4 (optional)'],['hostAdapter','Actual OS adapter name'],['dns','DNS server'],['ntp','NTP server']
];
const CSS=`.photo-import{margin:18px 0;border:1px solid #234652;border-radius:12px;background:#080e17;padding:16px}.photo-import summary{color:#67e8f9;cursor:pointer;font-weight:700}.photo-import .photo-copy{color:#94a3b8;font-size:12px;line-height:1.7}.photo-import .photo-drop{display:block;border:1px dashed #22d3ee88;padding:20px;border-radius:10px;background:#0b1c29;cursor:pointer}.photo-import .photo-drop:focus-within{outline:2px solid #22d3ee}.photo-import input,.photo-import select{box-sizing:border-box;width:100%;background:#080b12;border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:9px;font:12px ui-monospace,monospace}.photo-import input[type=file]{margin-top:10px}.photo-import input[type=checkbox]{width:auto;margin-right:7px}.photo-import .photo-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;margin-top:15px}.photo-import .photo-image{position:relative;align-self:start}.photo-import img{display:block;width:100%;height:auto;max-height:650px;object-fit:contain;border-radius:8px;background:#fff}.photo-import svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.photo-import .photo-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.photo-import label{display:block;font-size:11px;color:#cbd5e1}.photo-import .photo-fields input,.photo-import .photo-fields select{margin-top:5px}.photo-import .photo-status{color:#67e8f9;font-size:12px;white-space:pre-line;margin:12px 0}.photo-import .photo-status[data-error=true]{color:#fbbf24}.photo-import .photo-notes{color:#fbbf24;font-size:12px;line-height:1.7;padding-left:20px}.photo-import .photo-connections{font:12px/1.9 ui-monospace,monospace;color:#a5f3fc;white-space:pre-wrap;overflow-wrap:anywhere}.photo-import .photo-services{display:flex;flex-wrap:wrap;gap:15px;margin:14px 0}.photo-import pre{background:#05080d;border:1px solid #253247;border-radius:8px;overflow:auto;max-height:550px;padding:15px;white-space:pre;font:12px/1.8 ui-monospace,monospace;color:#b4f1e6}.photo-import .photo-actions{display:flex;flex-wrap:wrap;gap:9px;margin:12px 0}.photo-import .photo-result select{max-width:420px}.photo-import .photo-ocr-text{white-space:pre-wrap;font-size:11px;max-height:220px;overflow:auto}.photo-import [hidden]{display:none!important}@media(max-width:900px){.photo-import .photo-layout{grid-template-columns:1fr}.photo-import .photo-fields{grid-template-columns:1fr}}`;

/** Free OCR stays in a worker. Only engine/language assets are fetched; no image upload. */
export function mountTopologyPhoto(root){
  const controller=new AbortController();let disposed=false,version=0,worker=null,imageUrl='',image=null,canvas=null,model=null,scripts=[];
  root.innerHTML=`<style>${CSS}</style><details class="photo-import" data-photo-panel><summary>Import topology image · Free local OCR</summary><p class="photo-copy">Read device captions, IP labels and straight connection lines from an EVE-NG / GNS3 style image. Review every link before generating Cisco IOS configurations for an office segment: one router, one Layer 2 switch and an optional host. Complex, crossed or unlabeled links need manual correction.</p><p class="photo-copy">No API key or paid service. The photo stays in this browser tab. The free OCR engine and English language data download on first analysis; internet access is needed for those assets.</p><label class="photo-drop">Drop a PNG, JPEG or WebP here, choose a file, or paste an image while this section is focused.<input type="file" data-photo-file accept="image/png,image/jpeg,image/webp" aria-label="Topology image"></label><div class="photo-actions"><button type="button" data-photo-analyze disabled>Analyze image locally</button><button type="button" data-photo-cancel disabled>Cancel analysis</button><button type="button" data-photo-manual>Enter ports manually</button><button type="button" data-photo-clear>Clear photo &amp; results</button></div><p data-photo-status class="photo-status" role="status" aria-live="polite"></p><div class="photo-layout" data-photo-layout hidden><div><div class="photo-image"><img data-photo-preview alt="Uploaded topology, kept in this browser"><svg data-photo-overlay aria-hidden="true"></svg></div><p class="photo-copy">Cyan boxes mark detected port labels. Dashed lines are wire suggestions, not confirmed connections.</p><ul class="photo-notes" data-photo-notes></ul><details><summary>Recognized text</summary><pre class="photo-ocr-text" data-photo-text></pre></details></div><div><h4>Review the office connections</h4><p class="photo-copy">Blank fields were not found in the photo. ISP gateways and host addresses are never guessed. Port abbreviations such as e1/0 are normalized to Ethernet1/0.</p><div class="photo-fields" data-photo-fields></div><div class="photo-services"><label>Host OS<select data-photo-os aria-label="Imported host OS"><option value="windows">Windows</option><option value="linux">Linux</option></select></label><label><input type="checkbox" data-photo-service="dhcp">DHCP</label><label><input type="checkbox" data-photo-service="nat">PAT / NAT</label><label><input type="checkbox" data-photo-service="route">ISP default route</label></div><div class="photo-connections" data-photo-connections></div><label><input type="checkbox" data-photo-reviewed>I checked the device names, ports, addresses and links against the image.</label><div class="photo-actions"><button type="button" data-photo-generate disabled>Generate from reviewed topology</button></div><p class="photo-copy">This photo workspace generates separate device scripts using the reviewed ports and subnet masks, including /24 WANs. It does not replace the sample lab below. Router management credentials are configured separately in the workbench.</p></div></div><section class="photo-result" data-photo-result hidden><h4>Imported topology · Device configurations</h4><select data-photo-device aria-label="Imported topology device"></select><div class="photo-actions"><button type="button" data-photo-copy>Copy device config</button><button type="button" data-photo-download>Download device config</button></div><pre tabindex="0" aria-label="Imported topology configuration"><code data-photo-code></code></pre></section></details>`;
  const q=s=>root.querySelector(s),status=(text,error=false)=>{if(disposed)return;q('[data-photo-status]').textContent=text;q('[data-photo-status]').dataset.error=String(error);};
  const listen=(el,event,fn)=>el.addEventListener(event,fn,{signal:controller.signal});
  const invalidate=()=>{scripts=[];q('[data-photo-result]').hidden=true;q('[data-photo-code]').textContent='';q('[data-photo-reviewed]').checked=false;q('[data-photo-generate]').disabled=true;};
  function updateConnections(){if(!model)return;q('[data-photo-connections]').textContent=`${model.routerName||'Router'} ${model.wanPort||'?'} ↔ ISP\n${model.routerName||'Router'} ${model.lanPort||'?'} ↔ ${model.switchName||'Switch'} ${model.uplink||'?'}\n${model.switchName||'Switch'} ${model.access||'?'} ↔ ${model.hostName||'Host'} ${model.hostPort||'?'}`;}
  function showReview(next,notes=[]){
    model=next;invalidate();q('[data-photo-layout]').hidden=false;q('.photo-image').hidden=!image;const form=q('[data-photo-fields]');form.replaceChildren();
    for(const [key,title]of FIELDS){const label=document.createElement('label');label.textContent=title;const input=document.createElement('input');input.type='text';input.autocomplete='off';input.spellcheck=false;input.name='photo.'+key;input.setAttribute('aria-label',title+' · imported topology');input.value=model[key]??'';input.maxLength=key.includes('Name')?40:64;listen(input,'input',()=>{model[key]=input.value;invalidate();updateConnections();});label.append(input);form.append(label);}
    q('[data-photo-os]').value=model.hostOs;for(const checkbox of root.querySelectorAll('[data-photo-service]'))checkbox.checked=model[checkbox.dataset.photoService];
    q('[data-photo-notes]').replaceChildren(...notes.map(note=>{const li=document.createElement('li');li.textContent=note;return li;}));updateConnections();
  }
  function clear(){version++;worker?.terminate();worker=null;image=null;canvas=null;model=null;invalidate();if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl='';q('[data-photo-preview]').removeAttribute('src');q('[data-photo-file]').value='';q('[data-photo-layout]').hidden=true;q('[data-photo-text]').textContent='';q('[data-photo-overlay]').replaceChildren();q('[data-photo-analyze]').disabled=true;q('[data-photo-cancel]').disabled=true;status('');}
  async function selectFile(file){
    clear();if(!file)return;const current=version;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){status('Use a PNG, JPEG or WebP image of at most 10 MiB.',true);return;}
    const url=URL.createObjectURL(file);imageUrl=url;const img=new Image();
    try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('The image could not be decoded.'));img.src=url;});
      if(current!==version||disposed)return;
      if(img.naturalWidth*img.naturalHeight>12000000||img.naturalWidth<80||img.naturalHeight<80)throw Error('Use an image between 80×80 and 12 million pixels. Crop to the office segment for best results.');
      image=img;q('[data-photo-preview]').src=url;q('.photo-image').hidden=false;q('[data-photo-layout]').hidden=false;q('[data-photo-fields]').replaceChildren();q('[data-photo-notes]').replaceChildren();q('[data-photo-text]').textContent='';q('[data-photo-connections]').textContent='Analyze the image to populate the review fields, or enter the ports manually.';q('[data-photo-analyze]').disabled=false;status(`${file.name} · ${img.naturalWidth}×${img.naturalHeight}. Ready for local analysis.`);
    }catch(error){if(current===version){clear();status(error.message,true);}}
  }
  function overlay(result,w,h){
    const svg=q('[data-photo-overlay]');svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    const add=(tag,attrs)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));svg.append(el);};
    for(const link of result.links)add('line',{x1:link.wire.x1,y1:link.wire.y1,x2:link.wire.x2,y2:link.wire.y2,stroke:'#f59e0b','stroke-width':3,'stroke-dasharray':'8 6'});
    for(const p of result.ports)add('rect',{x:p.x0-4,y:p.y0-3,width:p.x1-p.x0+8,height:p.y1-p.y0+6,fill:'none',stroke:'#06b6d4','stroke-width':2});
  }
  async function analyze(){
    if(!image||worker)return;const current=++version;invalidate();q('[data-photo-analyze]').disabled=true;q('[data-photo-cancel]').disabled=false;
    let activeWorker=null;const timeout=setTimeout(()=>{if(current===version){version++;worker?.terminate();worker=null;status('Local OCR timed out. Crop the image and retry, or enter the ports manually.',true);q('[data-photo-analyze]').disabled=!image;q('[data-photo-cancel]').disabled=true;}},120000);
    try{
      status('Loading the free local OCR engine…');const api=await ocrLibrary();if(current!==version||disposed)return;
      activeWorker=await api.createWorker('eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',logger:event=>{if(current===version&&event.status)status(`${event.status} · ${Math.round((event.progress||0)*100)}%`);}});
      if(current!==version||disposed){await activeWorker.terminate();return;}worker=activeWorker;
      const scale=Math.min(3,2600/Math.max(image.naturalWidth,image.naturalHeight),Math.sqrt(5900000/(image.naturalWidth*image.naturalHeight)));canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);let light=0;
      for(let i=0;i<pixels.data.length;i+=400)light+=(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3;const invert=light/(pixels.data.length/400)<110;
      for(let i=0;i<pixels.data.length;i+=4){const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2],l=.299*r+.587*g+.114*b;const value=invert?(l>115?0:255):(l<195?0:255);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);
      await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});
      const {data}=await worker.recognize(canvas,{}, {text:true,tsv:true});if(current!==version||disposed)return;
      const lines=parseOcrTsv(data.tsv,scale),scaledLines=lines.flatMap(l=>l.words).filter(w=>/[a-z0-9]{2}/i.test(w.text)).map(l=>({x0:l.x0*scale,y0:l.y0*scale,x1:l.x1*scale,y1:l.y1*scale}));status('Pairing the detected text with diagram wires…');
      const wireScale=Math.min(1,Math.sqrt(5900000/(image.naturalWidth*image.naturalHeight))),wireCanvas=document.createElement('canvas');wireCanvas.width=Math.floor(image.naturalWidth*wireScale);wireCanvas.height=Math.floor(image.naturalHeight*wireScale);const wireContext=wireCanvas.getContext('2d',{willReadFrequently:true});wireContext.drawImage(image,0,0,wireCanvas.width,wireCanvas.height);const originalPixels=wireContext.getImageData(0,0,wireCanvas.width,wireCanvas.height),rawWires=findDiagramWires(originalPixels,scaledLines.map(l=>Object.fromEntries(Object.entries(l).map(([k,v])=>[k,v/scale*wireScale]))));
      const wires=rawWires.map(l=>Object.fromEntries(Object.entries(l).map(([k,v])=>[k,v/wireScale])));
      const recognizeRegion=async(region,psm,padding=30)=>{
        const x=Math.max(0,region.x0),y=Math.max(0,region.y0),w=Math.min(image.naturalWidth-x,region.x1-x),h=Math.min(image.naturalHeight-y,region.y1-y);if(w<3||h<3)return [];
        const crop=document.createElement('canvas'),zoom=5;const margin=psm===7?padding:0;crop.width=Math.ceil(w*zoom)+margin*2;crop.height=Math.ceil(h*zoom)+margin*2;const context=crop.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,crop.width,crop.height);context.drawImage(image,x,y,w,h,margin,margin,w*zoom,h*zoom);
        await activeWorker.setParameters({tessedit_pageseg_mode:String(psm),tessedit_char_whitelist:''});const result=await activeWorker.recognize(crop,{}, {text:true,tsv:true});
        return parseOcrTsv(result.data.tsv,zoom).map(l=>({...l,x0:l.x0+x-margin/zoom,x1:l.x1+x-margin/zoom,y0:l.y0+y-margin/zoom,y1:l.y1+y-margin/zoom,words:l.words.map(word=>({...word,x0:word.x0+x-margin/zoom,x1:word.x1+x-margin/zoom,y0:word.y0+y-margin/zoom,y1:word.y1+y-margin/zoom}))}));
      };
      const known=inferPhotoOffice(lines,[],image.naturalWidth,image.naturalHeight).nodes;
      for(const wire of wires.slice(0,8))for(const point of [{x:wire.x1,y:wire.y1},{x:wire.x2,y:wire.y2}]){
        if(current!==version||disposed)return;
        if(known.length&&Math.min(...known.map(n=>Math.hypot(n.x-point.x,n.y-point.y)))>95)lines.push(...await recognizeRegion({x0:point.x-60,y0:point.y+5,x1:point.x+75,y1:point.y+70},11));
      }
      const regions=findPortRegions(originalPixels,rawWires).map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v/wireScale])));
      for(let i=0;i<regions.length;i++){
        if(current!==version||disposed)return;status(`Reading small port labels · ${i+1}/${regions.length}`);
        const r=regions[i];
        for(const [halfWidth,halfHeight,padding] of [[25,8.4,0],[12,7,30],[17,8,30],[25,9,30]]){
          const candidates=await recognizeRegion({...r,x0:r.x-halfWidth,x1:r.x+halfWidth,y0:r.y-halfHeight,y1:r.y+halfHeight},7,padding);
          const accepted=candidates.filter(line=>{const token=line.text.replace(/[^A-Za-z0-9/]/g,'');const name=normalizePhotoPort(token);if(!name||(!name.includes('/')&&!/^[A-Za-z]+\d$/.test(token)))return false;line.text=token;line.words=[{...line}];return true;});
          if(accepted.length){lines.push(...accepted);break;}
        }      }
      if(current!==version||disposed)return;
      const result=inferPhotoOffice(lines,wires,image.naturalWidth,image.naturalHeight);showReview(result.model,result.notes);q('[data-photo-text]').textContent=lines.map(l=>l.text).join('\n')||'No readable text found.';overlay(result,image.naturalWidth,image.naturalHeight);status(`Found ${result.nodes.length} device captions, ${result.ports.length} port labels and ${result.links.length} suggested connections. Review and complete the fields before generating.`);
    }catch(error){if(current===version&&!disposed)status('Local image analysis failed: '+error.message+' You can retry or enter the ports manually.',true);}
    finally{clearTimeout(timeout);if(activeWorker)await activeWorker.terminate().catch(()=>{});if(worker===activeWorker)worker=null;if(current===version&&!disposed){q('[data-photo-analyze]').disabled=!image;q('[data-photo-cancel]').disabled=true;}}
  }
  listen(q('[data-photo-file]'),'change',e=>selectFile(e.target.files[0]));
  const drop=q('.photo-drop');listen(drop,'dragover',e=>{e.preventDefault();});listen(drop,'drop',e=>{e.preventDefault();selectFile(e.dataTransfer.files[0]);});
  listen(root,'paste',e=>{const item=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'));if(item){e.preventDefault();selectFile(item.getAsFile());}});
  listen(q('[data-photo-analyze]'),'click',analyze);listen(q('[data-photo-clear]'),'click',clear);
  listen(q('[data-photo-cancel]'),'click',()=>{version++;worker?.terminate();worker=null;q('[data-photo-analyze]').disabled=!image;q('[data-photo-cancel]').disabled=true;status('Analysis cancelled. The selected photo is still available.');});
  listen(q('[data-photo-manual]'),'click',()=>{version++;worker?.terminate();worker=null;q('[data-photo-analyze]').disabled=!image;q('[data-photo-cancel]').disabled=true;const result=inferPhotoOffice([],[],1,1);showReview(result.model,['Enter the real device names, connections and IP addresses from the photo.']);status('Manual review mode. No addresses or port assignments were invented.');});
  listen(q('[data-photo-reviewed]'),'change',e=>{q('[data-photo-generate]').disabled=!model||!e.target.checked;});
  listen(q('[data-photo-os]'),'change',e=>{if(model){model.hostOs=e.target.value;invalidate();}});
  for(const checkbox of root.querySelectorAll('[data-photo-service]'))listen(checkbox,'change',()=>{if(model){model[checkbox.dataset.photoService]=checkbox.checked;invalidate();}});
  const paint=()=>{const script=scripts[+q('[data-photo-device]').value||0];q('[data-photo-code]').textContent=script?.code||'';};
  listen(q('[data-photo-generate]'),'click',()=>{
    if(!model||!q('[data-photo-reviewed]').checked)return;const result=generatePhotoOffice(model);scripts=result.scripts;
    if(result.errors.length){q('[data-photo-result]').hidden=true;status(result.errors.join('\n'),true);return;}
    const select=q('[data-photo-device]');select.replaceChildren(...scripts.map((script,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=script.title;return option;}));q('[data-photo-result]').hidden=false;paint();status(`Generated ${scripts.length} separate device scripts from the reviewed connections. No device was contacted.`);q('[data-photo-result]').scrollIntoView({block:'start',behavior:'auto'});
  });listen(q('[data-photo-device]'),'change',paint);
  listen(q('[data-photo-copy]'),'click',async()=>{const script=scripts[+q('[data-photo-device]').value||0];if(!script)return;try{await navigator.clipboard.writeText(script.code);status('Copied '+script.title);}catch{status('Clipboard unavailable. Select and copy the generated text.',true);}});
  listen(q('[data-photo-download]'),'click',()=>{const script=scripts[+q('[data-photo-device]').value||0];if(!script)return;const url=URL.createObjectURL(new Blob([script.code],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='imported-topology-device.conf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  return()=>{disposed=true;version++;controller.abort();worker?.terminate();if(imageUrl)URL.revokeObjectURL(imageUrl);root.replaceChildren();};
}
