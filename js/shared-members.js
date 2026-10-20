/* Non-destructive shared member registry. Legacy keys are retained. */
(function(){
 'use strict';
 const KEY='salonOrderSharedMembers';
 function parse(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch(e){return []}}
 function normalize(m){
  if(!m||typeof m!=='object')return null;
  const raw=String(m.code||m.id||((m.mainId||'')+'-'+(m.subId||'00'))).trim();
  const match=raw.match(/^(.*)-(\d{2})$/);
  const code=(match?match[1]:raw).trim();
  const subId=String(m.subId||(match?match[2]:'00')).padStart(2,'0');
  const name=String(m.name||'').trim();
  return code&&name?{code,name,subId}:null;
 }
 function dedupe(rows){const map=new Map();rows.forEach(m=>{const n=normalize(m);if(n)map.set(n.code,n)});return Array.from(map.values())}
 function read(){return dedupe([...parse('salonOrderPresetMembers'),...parse('registered_members'),...parse(KEY)])}
 function write(rows){const merged=dedupe([...read(),...rows]);try{localStorage.setItem(KEY,JSON.stringify(merged))}catch(e){}return merged}
 window.SalonMembers={read,write};
})();
