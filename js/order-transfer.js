/* Session-only clipboard handoff. No storage, cookies, server submission, or member details. */
(function(){
'use strict';
const MARK='NINA_ORDER_TRANSFER_V1:';
const clean=(items)=>items.map(x=>({name:String(x.name||'').trim(),qty:Number(x.qty)})).filter(x=>x.name&&Number.isInteger(x.qty)&&x.qty>0&&x.qty<=999);
window.NinaOrderTransfer={
 async copy(groups){
  const data={version:1,groups:groups.map(g=>({label:String(g.label||'注文'),items:clean(g.items||[])})).filter(g=>g.items.length)};
  if(!data.groups.length){alert('コピーできる商品がありません。');return}
  try{await navigator.clipboard.writeText(MARK+JSON.stringify(data));alert('注文用データをコピーしました。注文ページの貼り付け欄を長押しして「ペースト」を選んでください。')}
  catch(e){alert('クリップボードへのコピーができませんでした。HTTPS接続とブラウザのコピー許可を確認してください。')}
 },
 parse(raw){
  raw=String(raw||'').trim();
  if(!raw.startsWith(MARK))throw Error('注文データが見つかりません。計算ページで「コピー」を押してから、この枠に貼り付けてください。');
  const obj=JSON.parse(raw.slice(MARK.length));
  if(obj.version!==1||!Array.isArray(obj.groups)||obj.groups.length<1||obj.groups.length>10)throw Error('コピーしたデータの形式が正しくありません。');
  const groups=obj.groups.map(g=>({label:String(g.label||'注文'),items:clean(Array.isArray(g.items)?g.items:[])}));
  if(groups.some(g=>!g.items.length||g.items.length>100))throw Error('商品データが正しくありません。');
  return groups;
 },
 async read(){return this.parse(await navigator.clipboard.readText());},
 mount(kind){
  const anchor=document.querySelector(kind==='single'?'#positions_container':'#productPickerRows');
  if(!anchor)return;
  const panel=document.createElement('section');
  panel.style.cssText='margin:16px 0;padding:14px;border:1px solid #c9dce9;border-radius:12px;background:#f3f8fc;color:#243c52';
  panel.innerHTML='<details class="nina-transfer-details"><summary style="cursor:pointer;font-weight:700;font-size:15px;list-style-position:inside;padding:2px 0">計算サポートツールからの取り込み</summary><div style="padding-top:13px"><p style="font-size:13px;line-height:1.6;margin:0 0 12px">計算サポートツールでコピーした商品と個数を、まとめて入力できます。</p><label for="nina-transfer-paste" style="display:block;font-size:14px;margin-bottom:8px">① 下の枠を長押しして「ペースト（貼り付け）」</label><textarea id="nina-transfer-paste" class="nina-transfer-paste" rows="3" placeholder="ここを長押しして貼り付け" style="box-sizing:border-box;width:100%;font-size:16px;border:2px solid #9ebbd0;border-radius:9px;padding:12px"></textarea><button type="button" class="sub-btn nina-transfer-manual" style="display:block;width:100%;margin-top:10px;padding:13px 12px;font-size:16px">② 商品を取り込む</button><div class="nina-transfer-options" style="margin-top:12px"></div><small style="display:block;margin-top:8px">商品と個数のみを取り込みます。会員情報は含まれません。</small></div></details>';
  panel.style.padding='11px 14px';
  anchor.parentNode.insertBefore(panel,anchor);
  const options=panel.querySelector('.nina-transfer-options');
  let groups=null,done=new Set();
  panel.querySelector('.nina-transfer-manual').addEventListener('click',()=>{try{groups=window.NinaOrderTransfer.parse(panel.querySelector('.nina-transfer-paste').value);done.clear();render()}catch(e){alert(e.message||'貼り付けたデータを読み込めません。')}});
  function render(){
   options.replaceChildren();
   groups.forEach((g,i)=>{
    const b=document.createElement('button');b.type='button';b.className='sub-btn';
    b.style.cssText='display:block;margin:7px 0;padding:9px 12px;cursor:pointer';
    b.textContent=g.label+'（'+g.items.reduce((n,x)=>n+x.qty,0)+'個）を取り込む'+(done.has(i)?' ✓':'');
    b.addEventListener('click',()=>{const result=apply(g.items);if(result){done.add(i);render()}});
    options.appendChild(b);
   });
  }
  function apply(items){
   // Global lexical declarations are accessible in this page's classic scripts.
   const products=typeof currentMaster!=='undefined'?currentMaster.products:[];
   const matched=[],missing=[];
   items.forEach(item=>{const idx=products.findIndex(p=>p.name===item.name);if(idx<0)missing.push(item.name);else matched.push({idx,qty:item.qty})});
   if(missing.length){alert('注文ページの商品マスターにない商品があります。取り込みは行いません。\\n'+missing.join('\\n'));return false}
   if(kind==='single'){
    if(!confirm('この商品を新しい注文枠に追加しますか？（既存の注文は残ります）'))return false;
    const chunks=[];matched.forEach(x=>{let n=x.qty;while(n>0){const q=Math.min(40,n);chunks.push({prodIndex:x.idx,qty:q});n-=q}});
    addPositionBox('','00','',chunks);
   }else{
    if(!confirm('現在入力中の商品を、この結果の商品と個数に置き換えますか？'))return false;
    const list=document.getElementById('productPickerRows');
    list.replaceChildren();
    matched.forEach(x=>{let n=x.qty;while(n>0){addBulkProductPicker();const row=list.lastElementChild;const selects=row.querySelectorAll('select');selects[0].value=String(x.idx);selects[0].dispatchEvent(new Event('change',{bubbles:true}));if(selects[1]){selects[1].value=String(Math.min(n,Number(selects[1].options[selects[1].options.length-1].value)||40));selects[1].dispatchEvent(new Event('change',{bubbles:true}))}n-=Number(selects[1]?.value)||1}});
    updateCalc();
   }
   alert('商品と個数を取り込みました。内容と対象月度を確認してください。');return true;
  }
 }
};
})();