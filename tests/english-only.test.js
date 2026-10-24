import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
const root=fileURLToPath(new URL('../',import.meta.url));
const georgian=/[\u10a0-\u10ff\u1c90-\u1cbf\u2d00-\u2d2f]/u;
let count=0;
async function scan(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())await scan(file);else if(/\.(html|js|css|py|tsx|ts)$/.test(file)){assert(!georgian.test(await readFile(file,'utf8')),`${file} contains Georgian text`);count++;}}}
await scan(path.join(root,'templates'));await scan(path.join(root,'static'));
const backend=await readFile(path.join(root,'app.py'),'utf8');assert(!georgian.test(backend));
const html=await readFile(path.join(root,'templates/index.html'),'utf8');
assert.match(html,/<html lang="en">/);assert(!/ws-host|ws-port|ws-btn|probePortWS|PORT_MESSAGES/.test(html),'Port Checker is removed');assert.doesNotMatch(html,/currentLang|setLanguage|lang-ka|lang-en/);
for(const text of ['Network Information','Public IP Address','ISP / Provider','Location','Checking...'])assert(html.includes(text),text);
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())new vm.Script(match[1]);
console.log(`English-only audit passed: ${count} frontend files, backend comments, document language, labels, notifications and inline script syntax.`);
