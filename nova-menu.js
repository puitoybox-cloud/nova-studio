(function createNovaMenu(){
  const root=document.querySelector('.nova-menu-root');
  if(!root)return;

  const toggle=root.querySelector('.nova-menu-toggle');
  const menuBar=root.querySelector('.nova-menu-bar');
  const panel=root.querySelector('.nova-menu-panel');
  const scrim=root.querySelector('.nova-menu-scrim');
  let lastFocus=null;

  function menuItems(){return [...panel.querySelectorAll('button:not([disabled])')]}
  function placeToggle(){
    const hero=document.querySelector('.home-only .atelier-hero, .universe-main .atelier-hero');
    const target=hero||menuBar;
    if(toggle.parentElement!==target)(hero?target.prepend(toggle):target.appendChild(toggle));
  }
  function openMenu(){
    lastFocus=document.activeElement;
    root.classList.add('is-open');
    scrim.hidden=false;
    toggle.setAttribute('aria-expanded','true');
    toggle.setAttribute('aria-label','メインメニューを閉じる');
    panel.setAttribute('aria-hidden','false');
    menuItems()[0]?.focus();
  }
  function closeMenu(restoreFocus=true){
    root.classList.remove('is-open');
    scrim.hidden=true;
    toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-label','メインメニューを開く');
    panel.setAttribute('aria-hidden','true');
    if(restoreFocus)(lastFocus||toggle).focus();
  }
  function go(route){
    closeMenu(false);
    if(document.body?.dataset.musicStudioStandalone==='true'){
      if(route==='music-studio'){location.hash='music-studio';return}
      location.href=`./index.html#${route}`;
      return;
    }
    if(typeof window.setView==='function')window.setView(route);else location.hash=route;
  }

  toggle.addEventListener('click',()=>root.classList.contains('is-open')?closeMenu():openMenu());
  scrim.addEventListener('click',()=>closeMenu());
  root.querySelectorAll('[data-menu-close]').forEach(button=>button.addEventListener('click',()=>closeMenu()));
  root.querySelector('[data-menu-back]').addEventListener('click',()=>{closeMenu(false);history.length>1?history.back():go('home')});
  root.querySelectorAll('[data-route]').forEach(button=>button.addEventListener('click',()=>go(button.dataset.route)));
  document.addEventListener('keydown',event=>{
    if(!root.classList.contains('is-open'))return;
    if(event.key==='Escape'){event.preventDefault();closeMenu();return}
    if(event.key!=='Tab')return;
    const items=menuItems(),first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  });
  window.addEventListener('hashchange',()=>closeMenu(false));
  new MutationObserver(placeToggle).observe(document.querySelector('#app'),{childList:true,subtree:true});
  placeToggle();
})();
