/* Progressive chat presentation: existing input fields and calculation functions are untouched. */
(function(){
  function start(){
    const headings=Array.from(document.querySelectorAll('.line-order-page .info-card > .section-title'));
    const steps=headings.map(h=>h.parentElement);
    if(steps.length!==5)return;
    let active=0;
    const summaries=[
      ()=>document.getElementById('ship_name').value.trim()||'お届け先を入力しました',
      ()=>document.getElementById('payment_method').value||'決済方法を選択しました',
      ()=>document.getElementById('target_month').value||'処理月度を選択しました',
      ()=>{const d=typeof calculateAll==='function'?calculateAll():null;return d?`商品 ${d.grandTotalQty}点 ／ ${d.grandTotalPrice.toLocaleString()}円`:'商品を入力しました';},
      ()=>'注文内容を確認しました'
    ];
    steps.forEach((step,i)=>{
      step.classList.add('chat-step');
      const title=step.querySelector('.section-title');
      const question=step.querySelector('.chat-question');
      const content=document.createElement('div');content.className='chat-step-content';
      while(title.nextSibling)content.appendChild(title.nextSibling);
      step.appendChild(content);
      const answer=document.createElement('div');answer.className='chat-answer';
      const bubble=document.createElement('div');bubble.className='chat-answer-bubble';answer.appendChild(bubble);
      step.appendChild(answer);
      const actions=document.createElement('div');actions.className='chat-step-actions';
      const edit=document.createElement('button');edit.type='button';edit.className='chat-edit';edit.textContent='編集する';
      edit.addEventListener('click',()=>show(i));step.appendChild(edit);
      if(i<steps.length-1){const next=document.createElement('button');next.type='button';next.className='chat-next';next.textContent=i===3?'注文内容を確認する →':'次へ進む →';next.addEventListener('click',()=>show(i+1));actions.appendChild(next)}
      step.appendChild(actions);
      step._chatBubble=bubble;
    });
    function show(index){
      active=index;
      steps.forEach((step,i)=>{
        step.dataset.chatState=i<active?'done':i===active?'active':'future';
        if(i<active)step._chatBubble.textContent=summaries[i]();
      });
      steps[index].scrollIntoView({behavior:'smooth',block:'start'});
    }
    steps.forEach((step,i)=>step.dataset.chatState=i===0?'active':'future');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
