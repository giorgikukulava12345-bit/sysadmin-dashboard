// Shared router-model catalog. Existing interface names remain editable.
export const FORTIGATE_CATALOG=[
 {model:'FG-30G',name:'FortiGate 30G',ports:'4 GE RJ45 data ports (WAN, 1, 2, A/FortiLink)',source:'https://fortinetweb.s3.amazonaws.com/docs.fortinet.com/v2/attachments/b0f32597-a216-11ef-a705-1222899fa4e9/FG-30G-31G-QSG.pdf'},
 {model:'FG-50G',name:'FortiGate 50G',ports:'Desktop GE Ethernet appliance; verify exact interface names in FortiOS',source:'https://docs.fortinet.com/product/fortigate/hardware'},
 {model:'FG-70G',name:'FortiGate 70G',ports:'10 GE RJ45 data ports: 1-6, A, B, WAN1, WAN2',source:'https://docs.fortinet.com/document/fortigate/7.4.9/hardware-acceleration/218161/fortigate-70g-and-71g-fast-path-architecture'},
 {model:'FG-90G',name:'FortiGate 90G',ports:'8 GE RJ45 ports plus two shared-media 10G WAN/SFP+ ports',source:'https://docs.fortinet.com/document/fortigate/7.4.7/hardware-acceleration/403368/fortigate-90g-and-91g-fast-path-architecture'},
 {model:'FG-120G',name:'FortiGate 120G',ports:'16 GE RJ45, 8 GE SFP, 4 10GE SFP+ data ports; HA and MGMT',source:'https://docs.fortinet.com/document/fortigate/8.0.0/hardware-acceleration/221839/fortigate-120g-and-121g-fast-path-architecture'}
];
export const fortigateModel=name=>FORTIGATE_CATALOG.find(row=>row.model===name);
export function populateFortigateModels(select,query=''){
 const previous=select.value,search=query.trim().toLowerCase();select.replaceChildren();
 const custom=document.createElement('option');custom.value='';custom.textContent='Custom / other model';select.append(custom);let count=0;
 for(const row of FORTIGATE_CATALOG){if(search&&!(row.model+' '+row.name).toLowerCase().includes(search)&&row.model!==previous)continue;const option=document.createElement('option');option.value=row.model;option.textContent=row.name+' ('+row.model+')';select.append(option);count++;}
 select.value=previous;return count;
}
export function selectFortigateModel(site,name){site.routerModel=fortigateModel(name)?name:'';}
export function renderFortigateInfo(container,name){
 container.replaceChildren();const row=fortigateModel(name);container.hidden=!row;if(!row)return;
 const intro=document.createElement('p');intro.textContent=row.name+' · '+row.model+' · FortiOS';container.append(intro);
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Ports & official Fortinet specifications';details.append(summary);
 const ports=document.createElement('p');ports.textContent=row.ports;details.append(ports);
 const note=document.createElement('p');note.textContent='Use the exact interface names from your FortiOS configuration below. Selecting a model preserves entered ports; it does not change existing switch or FortiLink membership. Features depend on FortiOS version and licensing.';details.append(note);
 const link=document.createElement('a');link.href=row.source;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Official Fortinet hardware guide';details.append(link);container.append(details);
}
