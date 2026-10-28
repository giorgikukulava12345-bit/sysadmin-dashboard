// Resolve public IEEE assignments locally. No MAC address is sent for lookup.
let registryPromise;
export function validateManufacturerRegistry(value){
  if(value?.schemaVersion!==1||!value.entries||Array.isArray(value.entries)||typeof value.entries!=='object'||!/^\d{4}-\d{2}-\d{2}$/.test(value.updatedAt||''))throw Error('Invalid manufacturer registry.');
  const entries=Object.create(null),rows=Object.entries(value.entries);if(!rows.length||rows.length>200000)throw Error('Invalid manufacturer registry size.');
  for(const [prefix,name]of rows){if(!/^(?:[0-9A-F]{6}|[0-9A-F]{7}|[0-9A-F]{9})$/.test(prefix)||typeof name!=='string'||!name.trim()||name.length>160)throw Error('Invalid manufacturer assignment.');entries[prefix]=name;}
  return {schemaVersion:1,updatedAt:value.updatedAt,entries};
}
export function lookupManufacturer(mac,registry){
  const key=typeof mac==='string'?mac.replace(/[:-]/g,'').toUpperCase():'';
  if(!/^[0-9A-F]{12}$/.test(key)||/^0{12}$/.test(key)||(parseInt(key.slice(0,2),16)&3))return '';
  for(const length of [9,7,6]){const name=registry?.entries?.[key.slice(0,length)];if(typeof name==='string')return name;}
  return '';
}
export function loadManufacturerRegistry(){
  if(!registryPromise)registryPromise=(async()=>{
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
    try{const response=await fetch(new URL('./vendor-oui.json',import.meta.url),{signal:abort.signal,credentials:'omit'});if(!response.ok)throw Error('Manufacturer database download failed.');const text=await response.text();if(text.length>12000000)throw Error('Manufacturer database is too large.');return validateManufacturerRegistry(JSON.parse(text));}finally{clearTimeout(timer);}
  })().catch(error=>{registryPromise=null;throw error;});
  return registryPromise;
}
