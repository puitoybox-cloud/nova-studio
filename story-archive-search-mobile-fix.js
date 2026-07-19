/* Fix Story Archive search on iPhone without replacing the whole app. */
(function(){
  'use strict';

  let cachedQuery='';
  let updating=false;
  let composing=false;
  let compositionTarget=null;

  function isArchiveControl(target){
    return target&&['archiveSearch','archiveTypeFilter','archiveOnlyOfficial','archiveOnlyVidu','archiveOnlyImages'].includes(target.id);
  }

  function syncControlState(sourceRoot,targetRoot){
    ['archiveSearch','archiveTypeFilter','archiveOnlyOfficial','archiveOnlyVidu','archiveOnlyImages'].forEach(id=>{
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

    const nextList=holder.querySelector('.archive-list-panel, .archive-grid-panel');
    const liveList=currentPage.querySelector('.archive-list-panel, .archive-grid-panel');
    if(nextList&&liveList)liveList.innerHTML=nextList.innerHTML;

    const nextResult=holder.querySelector('.archive-search-resultbar');
    const liveResult=currentPage.querySelector('.archive-search-resultbar');
    if(nextResult&&liveResult)liveResult.innerHTML=nextResult.innerHTML;

    const nextStats=holder.querySelector('.archive-search-panel .stats');
    const liveStats=currentPage.querySelector('.archive-search-panel .stats');
    if(nextStats&&liveStats)liveStats.innerHTML=nextStats.innerHTML;

    const nextMeta=holder.querySelector('.archive-home-hero .meta, .archive-title-block .meta');
    const liveMeta=currentPage.querySelector('.archive-home-hero .meta, .archive-title-block .meta');
    if(nextMeta&&liveMeta)liveMeta.innerHTML=nextMeta.innerHTML;

    requestAnimationFrame(()=>{
      updating=false;
    });
  }

  document.addEventListener('compositionstart',event=>{
    if(event.target?.id!=='archiveSearch')return;
    composing=true;
    compositionTarget=event.target;
  },true);

  document.addEventListener('compositionupdate',event=>{
    if(event.target?.id!=='archiveSearch')return;
    cachedQuery=event.target.value;
  },true);

  document.addEventListener('compositionend',event=>{
    if(event.target?.id!=='archiveSearch')return;
    event.stopImmediatePropagation();
    cachedQuery=event.target.value;
    composing=false;
    compositionTarget=null;
    requestAnimationFrame(updateArchiveResults);
  },true);

  document.addEventListener('input',event=>{
    const target=event.target;
    if(target?.id!=='archiveSearch'||updating)return;
    event.stopImmediatePropagation();
    cachedQuery=target.value;
    if(composing||event.isComposing||event.inputType==='insertCompositionText'||compositionTarget===target)return;
    updateArchiveResults();
  },true);

  document.addEventListener('change',event=>{
    const target=event.target;
    if(!isArchiveControl(target)||target.id==='archiveSearch'||updating||composing)return;
    event.stopImmediatePropagation();
    cachedQuery=document.querySelector('#archiveSearch')?.value||cachedQuery;
    updateArchiveResults();
  },true);

  document.addEventListener('focusin',event=>{
    if(event.target?.id==='archiveSearch')cachedQuery=event.target.value||cachedQuery;
  },true);

  const previousCurrentQuery=window.archiveSearchCurrentQuery;
  window.archiveSearchCurrentQuery=function(){
    return document.querySelector('#archiveSearch')?.value||cachedQuery||(typeof previousCurrentQuery==='function'?previousCurrentQuery():'');
  };
})();