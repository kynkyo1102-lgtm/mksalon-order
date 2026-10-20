/* Shared presentation effects for calculator pages only. No calculation logic. */

document.addEventListener('DOMContentLoaded',()=>{
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const frames=[...document.querySelectorAll('.calc-steps,.calc-input-section,.calc-product-section,.calc-run-area,.calc-split-page .difficulty-select,.calc-split-page .split-product-editor,.calc-split-page .balance-stage')];
 function frame(el,delay=0){
   if(!el||el.querySelector(':scope > .neural-frame'))return;
   const border=document.createElement('span');
   border.className='neural-frame-lines';
   border.setAttribute('aria-hidden','true');
   for(let i=0;i<4;i++){const line=document.createElement('i');border.appendChild(line)}
   el.prepend(border);
   if(reduce){el.classList.add('neural-framed');return}
   const start=()=>{
     if(el.dataset.borderPlayed==='1')return;
     el.dataset.borderPlayed='1';
     const lines=[...border.children];
     el.classList.add('neural-framing');
     lines.forEach((line,i)=>{
       line.style.setProperty('animation','none','important');
       line.style.setProperty('opacity','1','important');
       line.style.transition='width 350ms linear, height 350ms linear';
       setTimeout(()=>{
         if(i%2===0)line.style.setProperty('width','100%','important');
         else line.style.setProperty('height','100%','important');
       },i*350+50);
     });
     setTimeout(()=>{el.classList.remove('neural-framing');el.classList.add('neural-framed')},1580);
   };
   const watcher=new IntersectionObserver(entries=>{
     if(entries.some(entry=>entry.isIntersecting)){
       watcher.disconnect();
       setTimeout(start,Math.min(delay,380));
     }
   },{threshold:0.08});
   watcher.observe(el);
 }
 frames.forEach((el,i)=>frame(el,2450+i*400));
 function type(el,delay=0,speed=35){
   if(!el||reduce)return;
   const value=el.textContent;
   el.setAttribute('aria-label',value);
   el.textContent='';
   el.classList.add('neural-typing');
   setTimeout(()=>{
     let n=0;
     const timer=setInterval(()=>{
       el.textContent=value.slice(0,++n);
       if(n>=value.length){clearInterval(timer);el.classList.remove('neural-typing')}
     },speed);
   },delay);
 }
 type(document.querySelector('.quest-eyebrow'),90,30);
 const mini=document.querySelector('.quest-mini');type(mini,2700,36);
 const observer=new MutationObserver(()=>{
   const result=document.getElementById('comboResult');
   if(!result||result.style.display==='none'||result.dataset.neuralAnimated==='yes')return;
   result.dataset.neuralAnimated='yes';
   const cards=[...result.querySelectorAll('.plan-card')];
   cards.forEach((el,i)=>frame(el,i*430));
   type(result.querySelector('.quest-result-heading > span:nth-child(2)'),100,48);
   cards.forEach((card,i)=>{
     const tag=card.querySelector('.quest-clear-tag');
     if(tag){
       const textNode=[...tag.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
       if(textNode){
         const label=document.createElement('span');label.className='neural-english-label';label.textContent=textNode.textContent.trim();
         textNode.replaceWith(label);type(label,420+i*430,38);
       }
     }
   });
 });
 const result=document.getElementById('comboResult');
 if(result)observer.observe(result,{attributes:true,attributeFilter:['style']});
 const splitResult=document.getElementById('splitResult');
 if(splitResult){
   const splitObserver=new MutationObserver(()=>{
     if(splitResult.style.display==='none'||splitResult.dataset.neuralAnimated==='yes')return;
     splitResult.dataset.neuralAnimated='yes';
     frame(splitResult.querySelector('.balance-stage'));
     type(splitResult.querySelector('#resultVisualTitle'),100,46);
     type(splitResult.querySelector('#balanceStatus'),520,42);
   });
   splitObserver.observe(splitResult,{attributes:true,attributeFilter:['style']});
   document.querySelectorAll('.calc-split-page .btn-copy').forEach(btn=>btn.addEventListener('click',()=>{delete splitResult.dataset.neuralAnimated}));
 }
 document.querySelectorAll('.calc-split-page .pixel-en,.calc-split-page .split-eyebrow').forEach((el,i)=>{if(!el.closest('#splitResult')&&!el.closest('[hidden]'))type(el,Math.min(200+i*170,1100),35)});
 const button=document.getElementById('calcRunButton');
 if(button)button.addEventListener('click',()=>{if(result)delete result.dataset.neuralAnimated});
});
