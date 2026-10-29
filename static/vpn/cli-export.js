import {profileCLI} from './cli-profile.js';
import {packetTracerCLI} from './packet-tracer-cli.js';
/** Preserve mode boundaries and apply the selected simulator's syntax before export. */
export function terminalText(code,{vendor,role='router',model=''}={}){
  const compatible=vendor==='ios'&&role!=='host'&&model.endsWith('(Packet Tracer)')?packetTracerCLI(code||''):profileCLI(code||'',{vendor,routerModel:model});
  const text=compatible.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').replace(/^\n+|\n+$/g,'');
  if(!text)return '';
  if(vendor!=='ios'||role==='host')return text+'\n';
  // An IOS comment is a printable guard before the first real command. No hidden control keys,
  // automatic enable password, terminal settings, save commands or mode rewrites are injected.
  const guarded=text.startsWith('!\n')||text==='!'?text:'!\n'+text;
  return guarded.replace(/\n/g,'\r\n')+'\r\n';
}

export function displayTerminalText(code,context){
  return terminalText(code,context).replace(/\r\n/g,'\n');
}

