import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));let modules=0,imports=0;
async function scan(dir){for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await scan(file);else if(file.endsWith('.js')){const source=await readFile(file,'utf8'),syntax=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(syntax.status,0,syntax.stderr);modules++;
 for(const m of source.matchAll(/\b(?:import|export)\s+(?:[^;\n]*?\s+from\s+)?['"](\.[^'"]+)['"]/g)){await access(path.resolve(path.dirname(file),m[1]));imports++;}
}}}
await scan(path.join(root,'static'));
const html=await readFile(path.join(root,'templates/index.html'),'utf8');for(const m of html.matchAll(/(?:src|href)="(\/static\/[^"?]+)(?:\?[^" ]*)?"/g))await access(path.join(root,m[1]));
console.log(`Static analysis passed: ${modules} JavaScript modules parsed; ${imports} relative imports resolved; local page assets exist.`);
