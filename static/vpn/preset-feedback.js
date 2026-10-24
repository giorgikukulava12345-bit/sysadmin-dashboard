/** Included cards describe the commands owned by the composite preset, not extra generators. */
export function officeManagedFeatures(vendor,role,active){
  if(!active)return [];
  if(role==='router')return ['static','nat','zbfw','dhcp'];
  if(role==='switch')return vendor==='ios'?['vlan','bpduguard']:vendor==='juniper'?['vlan']:[];
  return [];
}
export const OFFICE_CARD_TITLES={dhcp:'DHCP Server / Reserved Management IPs',static:'Static Routing · IPv4',nat:'NAT / PAT · Interface Overload',zbfw:'Stateful Firewall · Internet Gateway',vlan:'VLAN & Access Ports',bpduguard:'BPDU Guard · Access Ports'};
