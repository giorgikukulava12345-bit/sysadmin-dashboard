/** Conservative syntax for Packet Tracer profiles; hardware IOS output stays intact. */
export function packetTracerCLI(code){
 return String(code).replace(/\r\n?/g,'\n').split('\n').flatMap(line=>{
  const command=line.trim(),indent=line.slice(0,line.length-line.trimStart().length);
  if(/^service timestamps (log|debug) datetime\b/.test(command))return indent+command.replace(/\s+(localtime|show-timezone)\b/g,'');
  if(/^ntp server\s+/.test(command))return line.replace(/\s+prefer\s*$/,'');
  if(/^ip name-server\s+/.test(command))return command.slice('ip name-server '.length).trim().split(/\s+/).map(address=>indent+'ip name-server '+address);
  if(/^dns-server\s+/.test(command)){
   const addresses=command.slice('dns-server '.length).trim().split(/\s+/);
   return [indent+'dns-server '+addresses[0],...(addresses.length>1?[indent+'! Packet Tracer DHCP supports one DNS address here; using '+addresses[0]+'.']:[])];
  }
  if(/^lease\s+\d/.test(command))return indent+'! Packet Tracer: custom DHCP lease omitted; simulator default applies.';
  return line;
 }).join('\n');
}
