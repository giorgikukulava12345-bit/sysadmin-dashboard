// User-supplied EVE-NG image labels. No images are downloaded or hosted.
const eth=Array.from({length:16},(_,i)=>'Ethernet'+Math.floor(i/4)+'/'+i%4);
const iosSource='https://www.eve-ng.net/index.php/documentation/supported-images/';
const make=(label,vendor,role,ports,note='')=>({model:label+' (EVE-NG)',label:label+' (EVE-NG)',vendor,role,ports,cli_supported:true,simulator:'EVE-NG',manual_ports:true,port_note:note||'EVE-NG interfaces depend on node adapters and modules. Edit the exact port names below; verify commands against the running image.',source_url:iosSource});
export const EVE_MODELS=[
 make('Cisco IOS 1710 (Dynamips)','ios','router',['FastEthernet0','Ethernet0']),
 make('Cisco IOS 3725 (Dynamips)','ios','router',['FastEthernet0/0','FastEthernet0/1','FastEthernet1/0','FastEthernet2/0']),
 make('Cisco IOS 7206VXR (Dynamips)','ios','router',['FastEthernet0/0','FastEthernet1/0','Ethernet1/0','Ethernet1/1','Ethernet1/2','Ethernet1/3']),
 make('Cisco IOL','ios','router',eth,'Cisco IOL image family from the supplied screenshot. This router profile uses example IOL Ethernet adapters; enter the exact names and verify that the running image is Layer 3 IOS.'),
 {...make('Cisco Firepower NGIPS 7','ios','router',[],'Firepower NGIPS is not Cisco IOS / IOS XE. This entry identifies the EVE-NG appliance only; the router CLI generator cannot configure NGIPS.'),cli_supported:false},
 ...['mikrotik-6.49.19','mikrotik-7.23.7'].map(name=>make(name,'mikrotik','router',Array.from({length:4},(_,i)=>'ether'+(i+1)),'Four Ethernet adapters as shown in the supplied EVE-NG node. Interface names remain editable. Match generated features to the installed RouterOS version; some features require RouterOS 7.')),
 make('fortinet-FGT-v6.4.6','fortinet','router',Array.from({length:8},(_,i)=>'port'+(i+1))),
 make('fortinet-FGT-v7.2.0-build1157','fortinet','router',Array.from({length:8},(_,i)=>'port'+(i+1))),
 make('Paloalto-10.2.5','paloalto','router',Array.from({length:8},(_,i)=>'ethernet1/'+(i+1)))
];
export const eveModel=name=>EVE_MODELS.find(row=>row.model===name);
export function appendEveModels(select,query='',vendor='ios',role='router',current=select.value){
 const search=query.trim().toLowerCase(),rows=EVE_MODELS.filter(row=>row.vendor===vendor&&row.role===role&&(!search||row.label.toLowerCase().includes(search)||row.model===current));
 if(!rows.length)return 0;const group=document.createElement('optgroup');group.label='EVE-NG lab images';
 for(const row of rows){const option=document.createElement('option');option.value=row.model;option.textContent=row.label;group.append(option);}select.append(group);select.value=current;return rows.length;
}
export function populateEveModels(select,query,vendor,role='router'){
 const current=select.value;select.replaceChildren();const custom=document.createElement('option');custom.value='';custom.textContent='Custom / other model';select.append(custom);return appendEveModels(select,query,vendor,role,current);
}
export function selectEveModel(site,name,role='router'){
 const row=eveModel(name),vendor=site[role==='router'?'vendor':'switchVendor'];if(!row||row.vendor!==vendor||row.role!==role)return false;
 site[role==='router'?'routerModel':'switchModel']=name;const keys=role==='router'?['wan','lan']:['uplink','access','vlan2Access'];keys.forEach((key,i)=>site[key]=row.ports[i]||'');return true;
}
export function evePortOptions(name,exclude=''){return (eveModel(name)?.ports||[]).filter(port=>!String(exclude).split(',').includes(port)).map(value=>({value,label:value+' · EVE-NG adapter example'}));}
export function validateEvePorts(site,role='router'){
 const row=eveModel(site[role==='router'?'routerModel':'switchModel']);if(!row)return [];if(!row.cli_supported)return [row.port_note];
 if(row.role!==role||row.vendor!==site[role==='router'?'vendor':'switchVendor'])return ['EVE-NG profile does not match this device/vendor.'];
 const valid=row.vendor==='ios'?/^(?:Ethernet|FastEthernet|GigabitEthernet|TenGigabitEthernet)\d+(?:\/\d+)*$/:row.vendor==='mikrotik'?/^[A-Za-z][A-Za-z0-9._/-]{0,45}$/:row.vendor==='paloalto'?/^ethernet\d+\/\d+(?:\.\d+)?$/:/^[A-Za-z][A-Za-z0-9._/-]{0,45}$/;
 return (role==='router'?['wan','lan']:['uplink','access',...(site.vlan2Enabled==='on'?['vlan2Access']:[])]).filter(key=>!valid.test(site[key]||'')).map(key=>'EVE-NG '+key+': enter the exact Ethernet interface from the node.');
}
export function renderEveInfo(container,name){
 const row=eveModel(name);container.replaceChildren();container.hidden=!row;if(!row)return;
 const intro=document.createElement('p');intro.textContent=row.label+' · '+(!row.cli_supported?'Firepower NGIPS':row.vendor==='ios'?'Cisco IOS':row.vendor==='mikrotik'?'RouterOS':row.vendor==='fortinet'?'FortiOS':'PAN-OS')+' lab profile';container.append(intro);
 const note=document.createElement('p');note.textContent=row.port_note;container.append(note);
 const ports=document.createElement('p');ports.textContent=row.ports.length?'Adapter examples: '+row.ports.join(', '):'This appliance requires its own platform configuration workflow.';container.append(ports);
}
