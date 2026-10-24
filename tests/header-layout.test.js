import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../templates/index.html',import.meta.url),'utf8');
const header=html.slice(html.indexOf('<header'),html.indexOf('</header>'));
for(const id of ['geo-ip-display','geo-isp']){
 assert(header.includes(`id="${id}"`),`${id} belongs to navigation`);
 assert.equal(html.split(`id="${id}"`).length-1,1,'Metric IDs must remain unique');
}
assert(!/geo-location|geo-city-|<dt>Location<\/dt>/.test(header),'Location block and editor removed');
assert(header.includes('w-11 h-11')&&header.includes('Georgian flag logo'),'Enlarged flag logo replaces monitor');
const status=header.slice(header.indexOf('class="noc-nav-status'));assert(status.includes('id="header-georgia-flag"'),'Flag belongs to clock/status area');assert.equal(header.split('aria-label="Georgia flag"').length-1,1,'One static Georgian flag');
assert(!/ws-host|ws-port|ws-btn|ws-result|probePortWS|PORT_MESSAGES|new WebSocket/.test(html));
assert(!html.includes('noc-command-grid'),'No obsolete four-column card');
assert(!html.includes('aria-labelledby="title-net-info"'),'No duplicated Network Information panel');
assert(html.includes('/static/vpn/header-network.css'));
assert(html.includes("{% include 'vpn/configurator.html' %}"));
console.log('Header layout checks passed: two unique header metrics and flag beside clock; Port Checker, old panel and handlers removed.');
