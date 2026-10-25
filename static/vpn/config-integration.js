/** Preserve IOS command blocks verbatim; reject ambiguous replacement semantics. */
export function integrateConfiguration(existing, generated, vendor) {
  const fail=message=>({errors:[message],code:'',empty:false});
  if(typeof existing!=='string'||existing.length>200000)return fail('Existing configuration must be text of at most 200,000 characters.');
  if(!existing.trim())return fail('Paste the existing configuration or turn integration mode off.');
  if(vendor!=='ios')return fail('Integration supports Cisco IOS / IOS XE only. Turn integration mode off to generate a separate script for this vendor.');
  const invalid=text=>/[^\x09\x0a\x0d\x20-\x7e]/.test(text.split('\n').filter(line=>!line.trim().startsWith('!')).join('\n'))||/^(?:banner|crypto pki|macro name|event manager|tclsh|menu)\b/im.test(text);
  if(invalid(existing)||invalid(generated))return fail('Unsupported multiline or executable context. Remove banners, PKI, macros and automation blocks before integration.');
  function parse(text){
    const blocks=[];let current=null;
    for(const raw of text.replace(/\r/g,'').split('\n')){
      const s=raw.trim();if(!s||s.startsWith('!')||/^(?:Building configuration|Current configuration\s*:)/.test(s))continue;
      if(/^(?:configure terminal|conf t|end)$/.test(s))continue;
      if(!/^\s/.test(raw)&&s==='exit')continue;
      if(/^\s/.test(raw)){if(!current)throw Error('Indented snippet is missing its parent command.');current.lines.push(raw);continue;}
      if(/^(?:no |default |clear |reload|write |copy |show |debug |do |commit|delete |set )/.test(s))throw Error('Top-level destructive or operational commands require a separate reviewed change script.');
      current={header:s,lines:[]};blocks.push(current);
    }
    return blocks;
  }
  // Identity keys identify definitions which must never silently override one another.
  function identity(block){const h=block.header;
    if(block.lines.length)return h;
    if(/^ip route /.test(h))return h.split(/\s+/).slice(0,4).join(' ');
    if(/^(?:hostname|ip domain.name|username|enable secret|crypto isakmp key)\b/.test(h))return h.split(/\s+/).slice(0,h.startsWith('username ')?2:h.startsWith('crypto ')?5:1).join(' ');
    return h;
  }
  try{
    const prior=parse(existing),next=parse(generated),all=[...prior],index=new Map();
    const canonical=b=>[b.header,...b.lines.map(s=>s.trim())].join('\n');
    for(const b of prior){const k=identity(b);if(index.has(k)&&canonical(index.get(k))!==canonical(b))throw Error('Existing configuration repeats a conflicting definition: '+k);index.set(k,b);}
    function mergeBlock(old,b){
      if(!/^(interface (?!range )|router ospf |ip dhcp pool )/.test(b.header))return false;
      const lines=x=>x.lines.map(v=>v.trim()).filter(v=>v!=='exit');
      const a=lines(old),extra=lines(b);
      if([...a,...extra].some(v=>/^(?:address-family|class |service instance|peer |exit-)/.test(v)))return false;
      const commandKey=v=>{
        const match=v.match(/^(?:ip address|ipv6 address|ip mtu|ip tcp adjust-mss|ip access-group|encapsulation|switchport mode|switchport access vlan|switchport trunk allowed vlan|switchport trunk native vlan|tunnel source|tunnel destination|tunnel mode|tunnel protection|router-id|default-router|dns-server|lease)(?= |$)/);
        if(match)return match[0];
        if(/^(?:no )?shutdown$/.test(v))return 'shutdown';
        if(b.header.startsWith('ip dhcp pool ')&&v.startsWith('network '))return 'network';
        return null;
      };
      for(const v of extra){if(a.includes(v))continue;const k=commandKey(v);if(k&&a.some(x=>commandKey(x)===k))return false;a.push(v);}
      old.lines=[...a.map(v=>' '+v),' exit'];return true;
    }
    for(const b of next){const k=identity(b),old=index.get(k);if(old){if(canonical(old)!==canonical(b)&&!mergeBlock(old,b))throw Error('Conflicting definition: '+k+'. Reconcile existing commands and form values before merging.');continue;}all.push(b);index.set(k,b);}

    return{errors:[],empty:false,code:['! Unified IOS configuration / review and validate before deployment','configure terminal',...all.flatMap(b=>[b.header,...b.lines,...(b.lines.length&&b.lines.at(-1).trim()!=='exit'?['exit']:[]),'!']),'end'].join('\n')};
  }catch(error){return fail('Integration: '+error.message+' No partial configuration was emitted.');}
}
