import {suggestLabDevices, labDefaults} from './packet-lab-model.js';
import {cidr as parseCidr} from './address.js';

const ip = '\\d{1,3}(?:\\.\\d{1,3}){3}';
const cidr = ip + '/\\d{1,2}';
const address = new RegExp('\\b' + ip + '\\b', 'g');
const subnet = new RegExp('\\b' + cidr + '\\b');
const route = new RegExp('\\bip route\\s+(' + ip + ')\\s+(' + ip + ')\\s+(' + ip + ')(?:\\s+(\\d{1,3})\\b)?', 'i');
const port = /\b(GigabitEthernet|Gig|Gi|FastEthernet|Fa|Ethernet|Eth|Serial|Se)(\d+(?:\/\d+){1,3})\b/i;
const fullPort = {gigabitethernet:'GigabitEthernet',gig:'GigabitEthernet',gi:'GigabitEthernet',fastethernet:'FastEthernet',fa:'FastEthernet',ethernet:'Ethernet',eth:'Ethernet',serial:'Serial',se:'Serial'};

export function parseLabTask(text) {
  const devices = suggestLabDevices(text);
  const notes = [];
  const byName = new Map(devices.map(d => [d.name.toLowerCase(), d]));
  const interfaces = new Map(devices.map(d => [d, new Map()]));
  const find = name => byName.get(name?.toLowerCase());
  const setPort = (device, label, ipAddress = '') => {
    if (!device || device.kind === 'host') return;
    const match = label.match(port);
    if (!match) return;
    const name = fullPort[match[1].toLowerCase()] + match[2];
    const ports = interfaces.get(device);
    const previous = ports.get(name);
    if (previous && ipAddress && previous !== ipAddress) {
      notes.push(device.name + ': conflicting addresses for ' + name + '.');
      return;
    }
    ports.set(name, ipAddress || previous || '');
  };
  let owner;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[\x60*]/g, '').trim();
    if (/^\d+[.)]\s/.test(line)) owner = undefined;
    const heading = line.match(/^[-–•]?\s*([\w-]+)(?:-[^\s:]+)?:/u);
    if (heading) {
      const name = heading[1].toLowerCase();
      const device = devices.find(d => name === d.name.toLowerCase() || name.startsWith(d.name.toLowerCase() + '-'));
      if (device) owner = device;
    }
    if (/\bDHCP\b/i.test(line)) {
      for (const d of suggestLabDevices(line).filter(d => d.kind === 'host')) {
        const host = devices.find(x => x.name === d.name);
        if (host) host.dhcpClient = true;
      }
    }
    const compactLink = line.match(/^(?:-\s*)?([\w-]+)([^()]*)\s+connected to\s+([\w-]+)([^()]*)$/i);
    if (compactLink && find(compactLink[1]) && find(compactLink[3])) {
      for (const [name, details] of [[compactLink[1], compactLink[2]], [compactLink[3], compactLink[4]]]) {
        setPort(find(name), details, details.match(subnet)?.[0]);
      }
      continue;
    }
    const link = line.match(/^(?:-\s*)?(?:Router\s+)?([\w-]+)\s+connected to\s+(?:Router\s+)?([\w-]+)[^(]*\(([^()]+)\s+to\s+([^()]+)\)/i);
    if (link && find(link[1]) && find(link[2])) {
      const prefix = line.match(subnet)?.[0].split('/')[1];
      const assigned = new Map([...line.matchAll(new RegExp('([\\w-]+)\\s+IP:\\s*(' + ip + ')', 'gi'))].map(m => [m[1].toLowerCase(), m[2]]));
      for (const [deviceName, label] of [[link[1], link[3]], [link[2], link[4]]]) {
        const hostIp = assigned.get(deviceName.toLowerCase());
        setPort(find(deviceName), label, hostIp && prefix ? hostIp + '/' + prefix : '');
      }
      continue;
    }
    const named = line.match(/^(?:-\s*)?(?:Configure\s+)?([\w-]+)\s+/i);
    const staticOwner = line.match(/\bstatic routing on\s+([\w-]+)/i);
    const explicitOwner = find(staticOwner?.[1] || named?.[1]);
    if (explicitOwner) owner = explicitOwner;
    if (!owner || owner.kind === 'host') continue;
    const spokenRoute = staticOwner && line.match(new RegExp('(' + cidr + ')\\b.*\\bvia\\b.*?\\b(' + ip + ')', 'i'));
    const match = line.match(route);
    if (match) {
      const [,destination,mask,nextHop,distance=''] = match;
      owner.services.push({id:'static', data:{...labDefaults('static'),destination,mask,nextHop,distance}});
      continue;
    }
    if (spokenRoute) {
      const network = parseCidr(spokenRoute[1]);
      if (network) owner.services.push({id:'static',data:{...labDefaults('static'),destination:network.ip,mask:network.mask,nextHop:spokenRoute[2]}});
      continue;
    }
    const network = line.match(subnet)?.[0];
    const intf = line.match(port);
    if (intf && network) {
      setPort(owner, intf[0], network);
      continue;
    }
    if (/\bDHCP\b/i.test(line) && network) {
      const ips = line.slice(line.indexOf(network) + network.length).match(address) || [];
      const explicitGateway = line.match(new RegExp('default gateway(?:\\s+to|\\s*:)?\\s*(' + ip + ')', 'i'))?.[1];
      const gateway = explicitGateway || ips[0];
      const excluded = explicitGateway && ips.at(-1) === gateway && ips.length > 2 ? ips.slice(0,-1) : ips.slice(1);
      if (!gateway || excluded.length > 2) {
        notes.push(owner.name + ': review DHCP gateway and exclusions.');
        continue;
      }
      owner.services.push({id:'dhcp',data:{name:'LAN-' + (owner.services.length + 1),network,gateway,dns:'',exclusions:excluded.join(' ')}});
    }
  }
  if (!devices.length) notes.push('Include names such as R-1, Switch0 and PC0 in the assignment.');
  for (const d of devices) {
    d.interfaces = [...interfaces.get(d)].map(([name, value]) => name + ',' + value).join('\n');
    if (d.kind === 'switch' && !d.interfaces) notes.push(d.name + ': no switch ports specified; only the hostname will be configured. Connect the PC and router to the intended switch ports.');
    if (d.kind === 'router' && !d.interfaces) notes.push(d.name + ': add the required interface addresses.');
  }
  notes.push('Review imported links, IPv4 addresses, DHCP settings and static routes before generating configurations.');
  return {devices,notes};
}
