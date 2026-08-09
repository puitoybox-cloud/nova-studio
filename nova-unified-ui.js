(function unifyNovaManagementPages(){
  const unifiedRoutes=new Set(['storyArchive','productionDashboard','settings','backup']);
  const baseShell=window.shell;

  function routeName(route){
    return ({storyArchive:'Story Archive',productionDashboard:'Production Dashboard',settings:'設定',backup:'バックアップ'})[route]||'Nova Studio';
  }

  window.shell=function(main){
    const route=(location.hash||'#home').slice(1)||'home';
    document.body.classList.toggle('is-unified-route',unifiedRoutes.has(route));
    if(!unifiedRoutes.has(route))return baseShell(main);
    document.body.classList.remove('nav-open');
    document.body.dataset.homeBackground='fantasyAtelier';
    document.body.style.setProperty('--home-background-image',"url('./fantasy_atelier_background.png')");
    document.querySelector('#app').innerHTML=`<main class="nova-unified-page" data-unified-route="${route}" aria-label="${routeName(route)}">${homeHeroSection()}<section class="nova-unified-panel">${main}</section></main><div id="toast"></div>`;
  };

  const baseRender=window.render;
  window.render=function(){
    const route=(location.hash||'#home').slice(1)||'home';
    document.body.classList.toggle('is-unified-route',unifiedRoutes.has(route));
    return baseRender();
  };

  render?.();
})();
