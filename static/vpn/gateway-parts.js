export const GATEWAY_PARTS={route:'IPv4 default route',nat:'Interface NAT / PAT',firewall:'Stateful outbound firewall',interfaces:'Router interfaces',dhcp:'DHCP pools / gateway + management exclusions',dns:'DNS / resolver + client options'};
export const FEATURE_PARTS={static:'route',nat:'nat',zbfw:'firewall',dhcp:'dhcp'};
export function gatewayParts(data={}){return Object.fromEntries(Object.keys(GATEWAY_PARTS).map(key=>[key,data.parts?.[key]!==false]));}
