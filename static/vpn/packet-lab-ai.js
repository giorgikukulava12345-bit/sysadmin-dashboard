import {LAB_SERVICES,LAB_ROUTER_MODELS,LAB_MODELS,labFields,labDefaults} from './packet-lab-model.js';
export const LOCAL_AI_URL='http://localhost:8767';
export const LOCAL_AI_MODELS=['qwen3-vl:2b-instruct','qwen3-vl:4b-instruct','qwen3-vl:8b-instruct'];
export function aiCatalog(){return JSON.stringify({models:LAB_ROUTER_MODELS,kinds:LAB_MODELS,services:Object.fromEntries(Object.keys(LAB_SERVICES).map(id=>[id,{title:LAB_SERVICES[id],fields:labFields(id).map(f=>({key:f.key,type:f.type||'text',...(f.options?{options:f.options}:{})}))}]))});}
export function reviewedAiDraft(plan){
 if(!plan||typeof plan!=='object'||!Array.isArray(plan.devices)||!plan.devices.length||plan.devices.length>32)throw Error('AI returned no complete device list. Include the device names and requirements in the assignment.');
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
async function response(r){let body;try{body=await r.json();}catch{throw Error('Local AI returned an invalid response.');}if(!r.ok)throw Error(body.error||'Local AI request failed.');return body;}
export async function localAiHealth(token,signal){if(!token.trim())throw Error('Paste the session token from the local AI helper.');return response(await fetch(LOCAL_AI_URL+'/health',{headers:{Authorization:'Bearer '+token.trim()},signal,cache:'no-store',credentials:'omit'}));}
export async function analyzeLocalTask({task,token,model,signal}){
 if(!task.trim())throw Error("Enter the lab assignment.");
 if(!LOCAL_AI_MODELS.includes(model))throw Error('Select an installed local model.');if(!token.trim())throw Error('Paste the local AI helper session token.');
 const r=await fetch(LOCAL_AI_URL+'/analyze',{method:'POST',headers:{Authorization:'Bearer '+token.trim(),'Content-Type':'application/json'},body:JSON.stringify({model,task:task.trim(),catalog:aiCatalog()}),signal,cache:'no-store',credentials:'omit'});return reviewedAiDraft((await response(r)).plan);
}
