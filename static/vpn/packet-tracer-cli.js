/** Conservative syntax for Packet Tracer profiles; hardware IOS output stays intact. */
export function packetTracerCLI(code){
 code = String(code).replace(/\r\n?/g,'\n').split('\n').flatMap(line=>{
  const command=line.trim(),indent=line.slice(0,line.length-line.trimStart().length);
  if(/^ip virtual-reassembly(?:\s|$)/.test(command))return [];
  if(/^service timestamps (log|debug) datetime\b/.test(command))return indent+command.replace(/\s+(localtime|show-timezone)\b/g,'');
  if(/^ntp server\s+/.test(command))return line.replace(/\s+prefer\s*$/,'');
  if(/^ip name-server\s+/.test(command)){const addresses=command.slice('ip name-server '.length).trim().split(/\s+/);return [indent+'ip name-server '+addresses[0],...(addresses.length>1?[indent+'! Packet Tracer resolver uses one DNS address here; keeping primary '+addresses[0]+'.']:[])];}
  if(/^dns-server\s+/.test(command)){
   const addresses=command.slice('dns-server '.length).trim().split(/\s+/);
   return [indent+'dns-server '+addresses[0],...(addresses.length>1?[indent+'! Packet Tracer DHCP supports one DNS address here; using '+addresses[0]+'.']:[])];
  }
  if(/^lease\s+\d/.test(command))return indent+'! Packet Tracer: custom DHCP lease omitted; simulator default applies.';
  return line;
 }).join('\n');
 // Keep the generated dual-WAN sections in a single configuration session.
 if(code.includes('! === Dual ISP / WAN Failover ===')){
  code=code.replace(/^end[ \t]*\n((?:[ \t]*(?:!.*)?\n)*)configure terminal[ \t]*\n/gm,'$1');
  code=code.replace(/^((?:[ \t]*(?:!.*)?\n)*)configure terminal\b/,'$1enable\nconfigure terminal');
 }
 return code;
}
