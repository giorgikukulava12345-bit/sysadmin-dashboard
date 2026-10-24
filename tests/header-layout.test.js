import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../templates/index.html',import.meta.url),'utf8');
const header=html.slice(html.indexOf('<header'),html.indexOf('</header>'));
for(const id of ['geo-ip-display','geo-isp','geo-location']){
 assert(header.includes(`id="${id}"`),`${id} belongs to navigation`);
 assert.equal(html.split(`id="${id}"`).length-1,1,'Metric IDs must remain unique');
}
assert(!/ws-host|ws-port|ws-btn|ws-result|probePortWS|PORT_MESSAGES|new WebSocket/.test(html));
assert(!html.includes('noc-command-grid'),'No obsolete four-column card');
assert(!html.includes('aria-labelledby="title-net-info"'),'No duplicated Network Information panel');
assert(html.includes('/static/vpn/header-network.css'));
assert(html.includes("{% include 'vpn/configurator.html' %}"));
console.log('Header layout checks passed: three unique header metrics; Port Checker, old panel and handlers removed.');
