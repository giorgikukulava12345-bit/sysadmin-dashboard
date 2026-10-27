/** Preserve command order and mode boundaries; normalize only transport line endings. */
export function terminalText(code,{vendor,role='router'}={}){
  const text=String(code||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').replace(/^\n+|\n+$/g,'');
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
