export const SIMULATED_EVENTS=[
  ['INFO','SYSLOG','BGP-5-ADJCHANGE','Neighbor 192.0.2.2 transitioned Idle → Established'],
  ['INFO','SNMP TRAP','IF-MIB::linkUp','GigabitEthernet0/1 operational state: up'],
  ['WARNING','SYSLOG','CPU-4-HIGH','Core router CPU utilization 86% for 60 seconds'],
  ['INFO','SYSLOG','IPSEC-5-SA_UP','Tunnel0 IKE/IPsec security associations established'],
  ['WARNING','SNMP TRAP','IF-MIB::ifHCOutOctets','WAN utilization crossed configured 85% threshold'],
  ['CRITICAL','SNMP TRAP','IF-MIB::linkDown','GigabitEthernet0/1 operational state: down'],
  ['ERROR','SYSLOG','BGP-3-NOTIFICATION','Peer 192.0.2.2 session reset: hold timer expired'],
  ['WARNING','SYSLOG','IPSEC-4-REKEY','Tunnel0 SA rekey retry; negotiation pending'],
  ['INFO','SNMP TRAP','IF-MIB::linkUp','WAN interface recovered; traffic forwarding resumed'],
  ['INFO','SYSLOG','BGP-5-ADJCHANGE','Neighbor 192.0.2.2 session re-established'],
];
export function mountMonitor(container){
  container.innerHTML=`<section class="noc-panel" aria-label="Simulated Syslog and SNMP Trap Monitor"><div class="noc-heading"><div><h3>LIVE EVENT STREAM</h3><p>SYSLOG / SNMP TRAPS · SIMULATION · synthetic events only</p></div><span class="noc-badge" data-monitor-state>STREAMING</span></div><div class="noc-actions"><button type="button" data-stream-toggle>Pause Stream</button><button type="button" data-stream-clear>Clear Logs</button><label><input type="checkbox" data-stream-follow checked> Auto-scroll</label></div><div class="noc-log" data-stream-log tabindex="0" role="log" aria-label="Simulated network events" aria-live="off"></div><p class="noc-note" data-stream-count>0 events · buffer limit 150</p></section>`;
  const log=container.querySelector('[data-stream-log]'),toggle=container.querySelector('[data-stream-toggle]'),badge=container.querySelector('[data-monitor-state]');
  let paused=false,index=0,total=0,timer;
  function append(){
    const [level,source,code,message]=SIMULATED_EVENTS[index++%SIMULATED_EVENTS.length];const line=document.createElement('div');line.className=`noc-event noc-event-${level.toLowerCase()}`;
    line.textContent=`${new Date().toISOString().slice(11,19)} UTC [${level}] [${source}] ${code}: ${message}`;log.append(line);total++;
    while(log.children.length>150)log.firstElementChild.remove();
    if(container.querySelector('[data-stream-follow]').checked)log.scrollTop=log.scrollHeight;
    container.querySelector('[data-stream-count]').textContent=`${total} events received · ${log.children.length}/150 buffered`;
  }
  function schedule(){clearInterval(timer);if(!paused&&!document.hidden)timer=setInterval(append,2500);badge.textContent=paused?'PAUSED':document.hidden?'BACKGROUND PAUSED':'STREAMING';toggle.textContent=paused?'Resume Stream':'Pause Stream';}
  toggle.addEventListener('click',()=>{paused=!paused;schedule();});
  container.querySelector('[data-stream-clear]').addEventListener('click',()=>{log.replaceChildren();total=0;container.querySelector('[data-stream-count]').textContent='0 events · buffer limit 150';});
  document.addEventListener('visibilitychange',schedule);append();schedule();
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',schedule);container.replaceChildren();};
}
