(function createNovaMenu(){
  const root=document.createElement('div');
  root.className='nova-menu-root';
  root.innerHTML=`
    <div class="nova-menu-bar">
      <button class="nova-menu-toggle" type="button" aria-label="メインメニューを開く" aria-controls="novaMenuPanel" aria-expanded="false">
        <span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>
      </button>
      <button class="nova-wordmark" type="button" aria-label="Nova Studio ホームへ移動">
        <svg viewBox="0 0 238 34" role="img" aria-labelledby="novaWordmarkTitle">
          <title id="novaWordmarkTitle">NOVA STUDIO</title>
          <path d="M16 2l3.4 9.6L29 15l-9.6 3.4L16 28l-3.4-9.6L3 15l9.6-3.4L16 2z" fill="none" stroke="currentColor" stroke-width="2"/>
          <circle cx="16" cy="15" r="2.5" fill="currentColor"/>
          <text x="38" y="23" fill="currentColor" font-family="-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif" font-size="18" font-weight="750" letter-spacing="2.2">NOVA STUDIO</text>
        </svg>
      </button>
    </div>
    <div class="nova-menu-scrim" hidden></div>
    <nav class="nova-menu-panel" id="novaMenuPanel" aria-label="Nova Studio メインメニュー" aria-hidden="true" tabindex="-1">
      <div class="nova-menu-heading"><span>MENU</span><button type="button" data-menu-close aria-label="メニューを閉じる">閉じる <span aria-hidden="true">×</span></button></div>
      <button type="button" data-route="home">ホーム</button>
      <button type="button" data-route="projects">プロジェクト</button>
      <button type="button" data-route="music-studio">Music Studio</button>
      <button type="button" data-route="dream-architect">Dream Architect Studio</button>
      <button type="button" data-route="settings">設定</button>
      <div class="nova-menu-divider" role="separator"></div>
      <button type="button" data-menu-back>戻る</button>
      <button type="button" data-menu-close>閉じる</button>
    </nav>`;
  document.body.appendChild(root);

  const toggle=root.querySelector('.nova-menu-toggle');
  const panel=root.querySelector('.nova-menu-panel');
  const scrim=root.querySelector('.nova-menu-scrim');
  const wordmark=root.querySelector('.nova-wordmark');
  let lastFocus=null;

  function menuItems(){return [...panel.querySelectorAll('button:not([disabled])')]}
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
  function go(route){closeMenu(false);if(typeof window.setView==='function')window.setView(route);else location.hash=route}

  toggle.addEventListener('click',()=>root.classList.contains('is-open')?closeMenu():openMenu());
  wordmark.addEventListener('click',()=>go('home'));
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
})();
