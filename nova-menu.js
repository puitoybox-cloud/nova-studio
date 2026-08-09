(function createNovaMenu(){
  const root=document.querySelector('.nova-menu-root');
  if(!root)return;

  const toggle=root.querySelector('.nova-menu-toggle');
  const menuBar=root.querySelector('.nova-menu-bar');
  const panel=root.querySelector('.nova-menu-panel');
  const scrim=root.querySelector('.nova-menu-scrim');

  const studioPreviews={
    'story-studio':['Story Studio','物語・構成・脚本をつくる'],
    'video-studio':['Video Studio','動画素材と編集をまとめる'],
    'comic-studio':['Comic Studio','漫画・制作日誌画像をつくる'],
    'line-sns-studio':['LINE・SNS Studio','スタンプ・告知画像・投稿素材をつくる'],
    'web-studio':['Web Studio','サイト・作品ページをつくる']
  };
  function menuItems(){return [...panel.querySelectorAll('button:not([disabled]),summary')]}
  function currentRoute(){return (location.hash||'#home').slice(1)||'home'}
  function updateActive(){
    const route=currentRoute();
    panel.querySelectorAll('button[data-route],button[data-active-route]').forEach(button=>{
      const active=(button.dataset.activeRoute||button.dataset.route)===route;
      button.classList.toggle('is-current',active);
      if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
  }
  function toggleGroup(event){
    event.preventDefault();
    const details=event.currentTarget.parentElement;
    const items=details.querySelector('.nova-menu-group-items');
    const opening=!details.open;
    if(opening)details.open=true;
    if(!items||matchMedia('(prefers-reduced-motion: reduce)').matches){details.open=opening;return}
    const animation=items.animate(
      opening
        ?[{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'translateY(0)'}]
        :[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-4px)'}],
      {duration:160,easing:'ease-out'}
    );
    if(!opening)animation.addEventListener('finish',()=>{details.open=false},{once:true});
  }
  function placeToggle(){
    const hero=document.querySelector('.home-only .atelier-hero, .universe-main .atelier-hero, .nova-unified-page .atelier-hero');
    const target=hero||menuBar;
    if(toggle.parentElement!==target)(hero?target.prepend(toggle):target.appendChild(toggle));
  }
  function openMenu(){
    updateActive();
    root.classList.add('is-open');
    scrim.hidden=false;
    toggle.setAttribute('aria-expanded','true');
    toggle.setAttribute('aria-label','メインメニューを閉じる');
    toggle.setAttribute('aria-hidden','true');
    toggle.tabIndex=-1;
    panel.setAttribute('aria-hidden','false');
    setTimeout(()=>menuItems()[0]?.focus(),0);
  }
  function closeMenu(restoreFocus=true){
    root.classList.remove('is-open');
    scrim.hidden=true;
    toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-label','メインメニューを開く');
    toggle.removeAttribute('aria-hidden');
    toggle.tabIndex=0;
    panel.setAttribute('aria-hidden','true');
    if(restoreFocus){toggle.focus();setTimeout(()=>toggle.focus(),0)}
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
  function runCommand(command){
    closeMenu(false);
    if(studioPreviews[command]){
      const [title,description]=studioPreviews[command];
      window.openHomeStudioPreview?.(title,description);
      return;
    }
    if(command==='prompt-studio')return window.openApp?.('promptStudio');
    if(command==='music-studio')return window.openApp?.('musicStudio');
    if(command==='voice-studio')return window.openApp?.('voiceStudio');
    if(command==='story-archive')return window.openStoryArchive?.();
    if(command==='production-dashboard')return window.openProductionDashboard?.();
  }

  toggle.addEventListener('click',()=>root.classList.contains('is-open')?closeMenu():openMenu());
  scrim.addEventListener('pointerdown',event=>event.preventDefault());
  scrim.addEventListener('click',event=>{event.preventDefault();closeMenu()});
  root.querySelectorAll('[data-menu-close]').forEach(button=>button.addEventListener('click',()=>closeMenu()));
  root.querySelectorAll('.nova-menu-group>summary').forEach(summary=>summary.addEventListener('click',toggleGroup));
  root.querySelectorAll('[data-route]').forEach(button=>button.addEventListener('click',()=>go(button.dataset.route)));
  root.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>runCommand(button.dataset.command)));
  document.addEventListener('keydown',event=>{
    if(!root.classList.contains('is-open'))return;
    if(event.key==='Escape'){event.preventDefault();closeMenu();return}
    if(event.key!=='Tab')return;
    const items=menuItems(),first=items[0],last=items[items.length-1];
    if(document.activeElement===panel||!panel.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first).focus()}
    else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  });
  window.addEventListener('hashchange',()=>{updateActive();closeMenu(false)});
  new MutationObserver(placeToggle).observe(document.querySelector('#app'),{childList:true,subtree:true});
  placeToggle();
  updateActive();
})();
