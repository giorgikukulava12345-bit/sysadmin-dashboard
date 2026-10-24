import { ipv4 } from './address.js';

const text=value=>typeof value==='string'?value.trim().slice(0,160):'';
export function normalizeCity(value){const city=text(value);return /^[A-Za-z][A-Za-z .()'-]{0,79}$/.test(city)&&!/^(unknown|undefined|null|none|n\/a|not available)$/i.test(city)?city:'';}
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
  const city=normalizeCity(data.city);
  return {ip,isp:isp.replace(/^AS\d+\s+/,''),country,countryCode:country&&/^[A-Z]{2}$/.test(code)&&code!=='ZZ'?code:'',city,provider};
}
async function requestJson(url,fetchImpl,timeoutMs){
  const controller=new AbortController();let timer;
  try{return await Promise.race([
    (async()=>{const response=await fetchImpl(url,{signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('Provider unavailable');return response.json();})(),
    new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Provider timed out'));},timeoutMs);})
  ]);}finally{clearTimeout(timer);}
}
export async function loadNetworkInfo({fetchImpl=fetch,timeoutMs=3500,onUpdate=()=>{}}={}){
  let result={ip:'',isp:'',country:'',countryCode:'',city:'',provider:''};
  const merge=(data,provider)=>{const candidate=normalizeNetworkInfo(data,provider);if(!candidate||result.ip&&result.ip!==candidate.ip||result.country&&candidate.country&&result.country!==candidate.country)return;result={ip:result.ip||candidate.ip,isp:result.isp||candidate.isp,country:result.country||candidate.country,countryCode:result.countryCode||candidate.countryCode,city:result.city||candidate.city,provider:result.provider||candidate.provider};onUpdate({...result});};
  try{merge(await requestJson('https://ipapi.co/json/',fetchImpl,timeoutMs),'ipapi.co');}catch{}
  if(!result.ip||!result.isp||!result.country||!result.city){
    const endpoint=`https://ipwho.is/${result.ip?encodeURIComponent(result.ip):''}?lang=en`;
    try{merge(await requestJson(endpoint,fetchImpl,timeoutMs),'ipwho.is');}catch{}
  }
  if(!result.ip)try{merge(await requestJson('https://api.ipify.org?format=json',fetchImpl,timeoutMs),'ipify.org');}catch{}
  return result;
}
export function renderNetworkInfo(root,result){
  if(!root)return;
  const location=result.country?(result.city&&result.city!==result.country?`${result.city}, ${result.country}`:result.country):'Location unavailable';
  const values={'geo-ip-display':result.ip||'Unavailable','geo-isp':result.isp||'Unavailable','geo-location':location};
  for(const[id,value]of Object.entries(values)){const el=root.querySelector('#'+id);if(!el)continue;el.textContent=value;el.title=id==='geo-location'?(result.customCity?'Custom city display saved in this browser. Country and ISP come from the IP lookup.':'IP-based location estimate. ISP registration and VPN routing can affect city accuracy.'):value;}
  const flag=root.querySelector('#geo-flag');if(flag)flag.hidden=!(result.countryCode==='GE'||result.country==='Georgia');
}
