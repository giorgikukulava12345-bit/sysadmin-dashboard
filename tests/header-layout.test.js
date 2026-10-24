import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../templates/index.html',import.meta.url),'utf8');
const header=html.slice(html.indexOf('<header'),html.indexOf('</header>'));
for(const id of ['geo-ip-display','geo-isp']){
 assert(header.includes(`id="${id}"`),`${id} belongs to navigation`);
 assert.equal(html.split(`id="${id}"`).length-1,1,'Metric IDs must remain unique');
}
assert(!/geo-location|geo-city-|<dt>Location<\/dt>/.test(header),'Location block and editor removed');
assert(header.includes('Georgian flag logo'),'Left flag remains');
assert(!header.includes('header-georgia-flag'),'Right flag removed');
const frame=header.slice(header.indexOf('<div class="flex items-center gap-2.5">'),header.indexOf('Georgian flag logo'));assert(!/border|shadow-|bg-cyan|w-11/.test(frame),'Left flag has no frame or glow box');
assert(!/ws-host|ws-port|ws-btn|ws-result|probePortWS|PORT_MESSAGES|new WebSocket/.test(html));
assert(!html.includes('noc-command-grid'),'No obsolete four-column card');
assert(!html.includes('aria-labelledby="title-net-info"'),'No duplicated Network Information panel');
assert(html.includes('/static/vpn/header-network.css'));
assert(html.includes("{% include 'vpn/configurator.html' %}"));
console.log('Header layout checks passed: two unique header metrics and unframed left flag; Port Checker, old panel and handlers removed.');
