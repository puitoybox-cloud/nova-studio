/* Direct Story Archive opener: bypasses the stacked generic render overrides on in-app clicks. */
(function(){
  function setStoryArchiveRoute(){
    const next='#storyArchive';
    if(location.hash!==next){
      history.pushState(null,'',`${location.pathname}${location.search}${next}`);
    }
  }

  window.openStoryArchive=function(){
    setStoryArchiveRoute();
    document.body.classList.remove('is-home-route');
    document.body.classList.add('is-management-route');
    try{
      shell(storyArchiveView());
    }catch(error){
      console.error('Direct Story Archive render failed',error);
      try{ render(); }catch(renderError){ console.error('Story Archive fallback render failed',renderError); }
    }
  };
})();
