import {suggestLabDevices, labDefaults} from './packet-lab-model.js';

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
    if (!owner || owner.kind === 'host') continue;
    const match = line.match(route);
    if (match) {
      const [,destination,mask,nextHop,distance=''] = match;
      owner.services.push({id:'static', data:{...labDefaults('static'),destination,mask,nextHop,distance}});
      continue;
    }
    const network = line.match(subnet)?.[0];
    const intf = line.match(port);
    if (intf && network) {
      const name = fullPort[intf[1].toLowerCase()] + intf[2];
      owner.interfaces += (owner.interfaces ? '\n' : '') + name + ',' + network;
      continue;
    }
    if (/\bDHCP\b/i.test(line) && network) {
      const ips = line.slice(line.indexOf(network) + network.length).match(address) || [];
      const [gateway, ...excluded] = ips;
      if (!gateway || excluded.length > 2) {
        notes.push(owner.name + ': review DHCP gateway and exclusions.');
        continue;
      }
      owner.services.push({id:'dhcp',data:{name:'LAN-' + (owner.services.length + 1),network,gateway,dns:'',exclusions:excluded.join(' ')}});
    }
  }
  if (!devices.length) notes.push('Include names such as R-1, Switch0 and PC0 in the assignment.');
  for (const d of devices) {
    if (d.kind === 'switch' && !d.interfaces) notes.push(d.name + ': no switch ports specified; only the hostname will be configured. Connect the PC and router to the intended switch ports.');
    if (d.kind === 'router' && !d.interfaces) notes.push(d.name + ': add the required interface addresses.');
  }
  notes.push('Automatic reading covers named devices, IPv4 interfaces, DHCP pools and clients, and explicit IOS ip route commands. Add any other requirements in the device forms.');
  return {devices,notes};
}
