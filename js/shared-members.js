/* Shared member-only browser storage for both ordering tools. */
(function(){
 const KEY='salonOrderSharedMembers';
 function parse(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch(e){return []}}
 function normalize(m){
  const raw=String(m.code||m.id||((m.mainId||'')+'-'+(m.subId||'00'))).trim();
  const code=raw.replace(/-\d{2}$/,'').trim();
  const name=String(m.name||'').trim();
  return code&&name?{code,name}:null;
 }
 function dedupe(rows){const map=new Map();rows.forEach(m=>{const n=normalize(m);if(n)map.set(n.code,n)});return Array.from(map.values())}
 function read(){return dedupe(parse(KEY))}
 function write(rows){const clean=dedupe(rows);try{localStorage.setItem(KEY,JSON.stringify(clean))}catch(e){}return clean}
 function migrate(){
  const legacyText=parse('registered_members');
  const legacyImage=parse('salonOrderPresetMembers');
  const shared=read();
  const merged=dedupe([...legacyImage,...legacyText,...shared]);
  if(merged.length)write(merged);
  ['registered_members','salonOrderPresetMembers','ship_name','payment_method','receipt_name','salon_order_shipName','salonOrderUserInfo','salonOrderMasterConfig'].forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});
 }
 migrate();
 window.SalonMembers={read,write};
})();
