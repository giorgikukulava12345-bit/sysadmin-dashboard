// One registry for every device/vendor selector. Capabilities are explicit.
export const PLATFORMS = {ios:'Cisco',mikrotik:'MikroTik',fortinet:'FortiGate',juniper:'Juniper',paloalto:'Palo Alto'};
export const PORTS = {ios:['GigabitEthernet0/0','GigabitEthernet0/1'],asa:['outside','inside'],mikrotik:['ether1','ether2'],fortinet:['port1','port2'],juniper:['ge-0/0/0','ge-0/0/1'],paloalto:['ethernet1/1','ethernet1/2']};


export const FORTIGATE_MODELS={generic:'Generic / Custom FortiGate','fg-30g':'FortiGate 30G (FG-30G)','fg-50g':'FortiGate 50G (FG-50G)','fg-70g':'FortiGate 70G (FG-70G)','fg-90g':'FortiGate 90G (FG-90G)','fg-120g':'FortiGate 120G (FG-120G)'};
