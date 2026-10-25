import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const suites=['static-analysis','engine','audit','end-to-end-audit','internet','office-analyzer','secret-mask','second-vlan','header-layout','english-only','network-info','lab-polish','preset-chips'];let failed=0;
for(const suite of suites){const result=spawnSync(process.execPath,[`tests/${suite}.test.js`],{cwd:root,stdio:'inherit'});if(result.status!==0)failed++;}
console.log(`${suites.length-failed}/${suites.length} Node suites passed. Run tests/index.html for browser UI checks and python -m unittest discover -s tests for Flask checks.`);if(failed)process.exitCode=1;
