/** Highlights only text nodes; configuration content is never interpreted as HTML. */
export function highlightCLI(code){
  const text=code.textContent||'',fragment=document.createDocumentFragment();
  const tokens=/(^\s*[!#].*$|^\s*\/\/.*$|\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?|\b(?:configure|terminal|interface|router|set|show|debug|ip|ipv6|crypto|end|exit|permit|deny|vlan|commit|no|add)\b)/gm;
  let index=0;for(const match of text.matchAll(tokens)){fragment.append(document.createTextNode(text.slice(index,match.index)));const span=document.createElement('span');span.className=/^\s*[!#]|^\s*\/\//.test(match[0])?'cli-comment':/^\d/.test(match[0])?'cli-address':'cli-keyword';span.textContent=match[0];fragment.append(span);index=match.index+match[0].length;}fragment.append(document.createTextNode(text.slice(index)));code.replaceChildren(fragment);
}
