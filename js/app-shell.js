/* Shared accessible menu: animated dropdown and hamburger/close state */
(() => {
  const toggle = document.querySelector('.home-menu-toggle, .app-menu-toggle');
  const menu = document.querySelector('.home-site-menu, .app-menu');
  if (!toggle || !menu) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pending = null;
  function stop(){if(pending){pending.cancel();pending=null;}menu.classList.remove('menu-enter','menu-exit');}
  function setIcon(open){toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'メニューを閉じる':'メニューを開く');}
  function open(){stop();menu.hidden=false;setIcon(true);if(!reduced.matches)menu.classList.add('menu-enter');}
  function close(){if(menu.hidden)return;stop();setIcon(false);if(reduced.matches){menu.hidden=true;return;}menu.classList.add('menu-exit');pending=menu.animate([{opacity:1},{opacity:0}],{duration:160});pending.onfinish=()=>{menu.hidden=true;menu.classList.remove('menu-exit');pending=null;};}
  toggle.addEventListener('click',()=>menu.hidden?open():close());
  document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!toggle.contains(e.target))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){close();toggle.focus();}});
})();
