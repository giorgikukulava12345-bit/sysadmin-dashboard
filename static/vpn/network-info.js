import { ipv4 } from './address.js';

const text=value=>typeof value==='string'?value.trim().slice(0,160):'';
export function validPublicIp(value){
  const ip=text(value);
  if(ipv4(ip)!==null)return ip;
  if(!/^[0-9a-f:]+$/i.test(ip)||!ip.includes(':'))return '';
  try{return new URL(`https://[${ip}]/`).hostname.slice(1,-1);}catch{return '';}
}
export function normalizeNetworkInfo(data,provider){
  if(!data||typeof data!=='object'||data.error||data.success===false)return null;
  const ip=validPublicIp(data.ip);if(!ip)return null;
  const code=text(data.country_code||data.country).toUpperCase();
  let country='';
  if(/^[A-Z]{2}$/.test(code))try{const name=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'}).of(code);if(name && code!=='ZZ')country=name;}catch{}
  if(!country){const name=text(data.country_name||(text(data.country).length>2?data.country:''));if(/^[A-Za-z][A-Za-z .()'-]{2,79}$/.test(name))country=name;}
  const isp=text(data.org)||text(data.connection?.isp)||text(data.connection?.org)||text(data.isp);
  // A city field is not evidence of city accuracy; never display ISP-hub cities.
  return {ip,isp:isp.replace(/^AS\d+\s+/,''),country,provider};
}
async function requestJson(url,fetchImpl,timeoutMs){
  const controller=new AbortController();let timer;
  try{return await Promise.race([
    (async()=>{const response=await fetchImpl(url,{signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('Provider unavailable');return response.json();})(),
    new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Provider timed out'));},timeoutMs);})
  ]);}finally{clearTimeout(timer);}
}
export async function loadNetworkInfo({fetchImpl=fetch,timeoutMs=3500,onUpdate=()=>{}}={}){
  let result={ip:'',isp:'',country:'',provider:''};
  const merge=(data,provider)=>{const candidate=normalizeNetworkInfo(data,provider);if(!candidate||result.ip&&result.ip!==candidate.ip)return;result={ip:result.ip||candidate.ip,isp:result.isp||candidate.isp,country:result.country||candidate.country,provider:result.provider||candidate.provider};onUpdate({...result});};
  try{merge(await requestJson('https://ipapi.co/json/',fetchImpl,timeoutMs),'ipapi.co');}catch{}
  if(!result.ip||!result.isp||!result.country){
    const endpoint=`https://ipwho.is/${result.ip?encodeURIComponent(result.ip):''}?lang=en`;
    try{merge(await requestJson(endpoint,fetchImpl,timeoutMs),'ipwho.is');}catch{}
  }
  if(!result.ip)try{merge(await requestJson('https://api.ipify.org?format=json',fetchImpl,timeoutMs),'ipify.org');}catch{}
  return result;
}
export function renderNetworkInfo(root,result){
  if(!root)return;
  const values={'geo-ip-display':result.ip||'Unavailable','geo-isp':result.isp||'Unavailable','geo-location':result.country||'Location unavailable'};
  for(const[id,value]of Object.entries(values)){const el=root.querySelector('#'+id);if(!el)continue;el.textContent=value;el.title=id==='geo-location'?'Country-level IP estimate. City data may identify ISP infrastructure rather than your actual location.':value;}
}
