/* Fix Story Archive search on iPhone without replacing the whole app. */
(function(){
  'use strict';

  const CONTROL_IDS=['archiveSearch','archiveTypeFilter','archiveOnlyOfficial','archiveOnlyVidu','archiveOnlyImages'];
  let cachedQuery='';
  let updating=false;
  let composing=false;

  function isArchiveControl(target){
    return target&&CONTROL_IDS.includes(target.id);
  }

  function stripInlineHandlers(root=document){
    CONTROL_IDS.forEach(id=>{
      const el=root.querySelector?.('#'+id);
      if(!el)return;
      el.removeAttribute('oninput');
      el.removeAttribute('onchange');
      el.oninput=null;
      el.onchange=null;
    });
  }

  function syncControlState(sourceRoot,targetRoot){
    CONTROL_IDS.forEach(id=>{
      const source=sourceRoot.querySelector('#'+id);
      const target=targetRoot.querySelector('#'+id);
      if(!source||!target)return;
      if(source.type==='checkbox')target.checked=source.checked;
      else target.value=source.value;
    });
  }

  function updateArchiveResults(){
    if(updating||composing||typeof storyArchiveView!=='function')return;
    const app=document.querySelector('#app');
    const currentPage=app?.querySelector('.archive-home-page, .archive-shell');
    if(!app||!currentPage)return;

    updating=true;
    const input=document.querySelector('#archiveSearch');
    cachedQuery=input?.value||cachedQuery;

    const holder=document.createElement('div');
    holder.innerHTML=storyArchiveView();
    syncControlState(document,holder);

    const pairs=[
      ['.archive-list-panel, .archive-grid-panel','.archive-list-panel, .archive-grid-panel'],
      ['.archive-search-resultbar','.archive-search-resultbar'],
      ['.archive-search-panel .stats','.archive-search-panel .stats'],
      ['.archive-home-hero .meta, .archive-title-block .meta','.archive-home-hero .meta, .archive-title-block .meta']
    ];

    pairs.forEach(([nextSelector,liveSelector])=>{
      const next=holder.querySelector(nextSelector);
      const live=currentPage.querySelector(liveSelector);
      if(next&&live)live.innerHTML=next.innerHTML;
    });

    stripInlineHandlers(currentPage);
    requestAnimationFrame(()=>{ updating=false; });
  }

  document.addEventListener('compositionstart',event=>{
    if(event.target?.id!=='archiveSearch')return;
    stripInlineHandlers();
    composing=true;
  },true);

  document.addEventListener('compositionupdate',event=>{
    if(event.target?.id==='archiveSearch')cachedQuery=event.target.value;
  },true);

  document.addEventListener('compositionend',event=>{
    if(event.target?.id!=='archiveSearch')return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cachedQuery=event.target.value;
    composing=false;
    setTimeout(updateArchiveResults,0);
  },true);

  document.addEventListener('input',event=>{
    const target=event.target;
    if(target?.id!=='archiveSearch'||updating)return;
    stripInlineHandlers();
    event.stopImmediatePropagation();
    cachedQuery=target.value;
    if(composing||event.isComposing||event.inputType==='insertCompositionText')return;
    updateArchiveResults();
  },true);

  document.addEventListener('change',event=>{
    const target=event.target;
    if(!isArchiveControl(target)||target.id==='archiveSearch'||updating||composing)return;
    stripInlineHandlers();
    event.stopImmediatePropagation();
    cachedQuery=document.querySelector('#archiveSearch')?.value||cachedQuery;
    updateArchiveResults();
  },true);

  document.addEventListener('focusin',event=>{
    if(event.target?.id!=='archiveSearch')return;
    stripInlineHandlers();
    cachedQuery=event.target.value||cachedQuery;
  },true);

  const observer=new MutationObserver(()=>stripInlineHandlers());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  stripInlineHandlers();

  const previousCurrentQuery=window.archiveSearchCurrentQuery;
  window.archiveSearchCurrentQuery=function(){
    return document.querySelector('#archiveSearch')?.value||cachedQuery||(typeof previousCurrentQuery==='function'?previousCurrentQuery():'');
  };
})();