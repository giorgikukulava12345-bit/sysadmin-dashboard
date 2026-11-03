import {LAB_SERVICES,LAB_ROUTER_MODELS,LAB_MODELS,labFields,labDefaults} from './packet-lab-model.js';
export const LOCAL_AI_URL='http://localhost:8767';
export const LOCAL_AI_MODELS=['qwen3-vl:4b','qwen3-vl:2b','qwen3-vl:8b'];
export function aiCatalog(){return JSON.stringify({models:LAB_ROUTER_MODELS,kinds:LAB_MODELS,services:Object.fromEntries(Object.keys(LAB_SERVICES).map(id=>[id,{title:LAB_SERVICES[id],fields:labFields(id).map(f=>({key:f.key,type:f.type||'text',...(f.options?{options:f.options}:{})}))}]))});}
export function reviewedAiDraft(plan){
 if(!plan||typeof plan!=='object'||!Array.isArray(plan.devices)||!plan.devices.length||plan.devices.length>32)throw Error('AI returned no complete device list. Try a clearer screenshot.');
 const text=(v,max=12000)=>typeof v==='string'?v.slice(0,max):'';
 if(JSON.stringify(plan).length>250000)throw Error('AI draft is too large. Split the lab into smaller tasks.');
 if(!Array.isArray(plan.uncertainties)||plan.uncertainties.some(x=>typeof x!=='string'))throw Error('AI response omitted uncertainty reporting. Retry the analysis.');
 const devices=plan.devices.map(d=>{
  if(!d||!Object.hasOwn(LAB_MODELS,d.kind)||typeof d.name!=='string'||typeof d.interfaces!=='string'||!Array.isArray(d.services)||d.services.length>32)throw Error('AI returned an invalid device. No partial draft was imported.');
  const services=d.services.map(s=>{if(!s||!Object.hasOwn(LAB_SERVICES,s.id)||!s.data||typeof s.data!=='object'||Array.isArray(s.data))throw Error('AI requested an unsupported service. No partial draft imported.');const fields=labFields(s.id),data={...labDefaults(s.id)};
   // Missing AI fields must not silently become unrelated sample values.
   for(const f of fields)data[f.key]=f.type==='checkbox'?false:'';
   for(const f of fields)if(Object.hasOwn(s.data,f.key)){const v=s.data[f.key];if(f.type==='checkbox'){if(typeof v!=='boolean')throw Error('AI returned an invalid checkbox value.');data[f.key]=v;}else if(typeof v==='string'||typeof v==='number')data[f.key]=String(v).slice(0,12000);else if(v!==null)throw Error('AI returned an invalid service field.');}
   return {id:s.id,data};});
  return {name:text(d.name,63),kind:d.kind,model:text(d.model,100),interfaces:text(d.interfaces),gateway:text(d.gateway,50),dns:text(d.dns,50),aiDraft:true,serialInstalled:false,services};
 });
 return {devices,summary:text(plan.summary),uncertainties:plan.uncertainties.map(x=>text(x,1000)).slice(0,64)};
}
export function imageViews(image){
 if(!image?.naturalWidth||!image.naturalHeight)throw Error('Upload a topology/task image first.');const views=[];
 const view=(x,y,w,h,max)=>{const scale=Math.min(1,max/Math.max(w,h)),canvas=document.createElement('canvas');canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,x,y,w,h,0,0,canvas.width,canvas.height);views.push(canvas.toDataURL('image/jpeg',.92).split(',')[1]);canvas.width=canvas.height=1;};
 const w=image.naturalWidth,h=image.naturalHeight;view(0,0,w,h,2400);
 // Long lab sheets need readable detail, not just a shrunken whole-page thumbnail.
 if(h>1800&&h>w*1.2){const step=Math.ceil(h/4);for(let y=0;y<h&&views.length<5;y+=step)view(0,Math.max(0,y-80),w,Math.min(step+160,h-Math.max(0,y-80)),2000);}
 if(views.reduce((n,x)=>n+x.length,0)>10*1024*1024)throw Error('Image views exceed 10 MB. Crop the original image and retry.');return views;
}
async function response(r){let body;try{body=await r.json();}catch{throw Error('Local AI returned an invalid response.');}if(!r.ok)throw Error(body.error||'Local AI request failed.');return body;}
export async function localAiHealth(token,signal){if(!token.trim())throw Error('Paste the session token from the local AI helper.');return response(await fetch(LOCAL_AI_URL+'/health',{headers:{Authorization:'Bearer '+token.trim()},signal,cache:'no-store',credentials:'omit'}));}
export async function analyzeLocalImage({image,task,ocr,token,model,signal}){
 if(!LOCAL_AI_MODELS.includes(model))throw Error('Select an installed local vision model.');if(!token.trim())throw Error('Paste the local AI helper session token.');
 const r=await fetch(LOCAL_AI_URL+'/analyze',{method:'POST',headers:{Authorization:'Bearer '+token.trim(),'Content-Type':'application/json'},body:JSON.stringify({model,images:imageViews(image),task,ocr,catalog:aiCatalog()}),signal,cache:'no-store',credentials:'omit'});return reviewedAiDraft((await response(r)).plan);
}
