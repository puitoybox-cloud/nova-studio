/* Route render timing fix: commit the target hash before rendering. */
(function(){
  const normalizeRoute=value=>String(value||'home').replace(/^#/,'');

  window.setView=function(view){
    const route=normalizeRoute(view);
    const nextHash=`#${route}`;
    if(location.hash!==nextHash){
      history.pushState(null,'',`${location.pathname}${location.search}${nextHash}`);
    }
    render();
  };

  window.addEventListener('popstate',()=>render());
})();
