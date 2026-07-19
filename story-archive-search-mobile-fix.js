/* Fix Story Archive search on iPhone: keep the archive route open while typing. */
(function(){
  'use strict';

  let cachedQuery='';
  let restoring=false;

  function isArchiveControl(target){
    return target&&['archiveSearch','archiveTypeFilter','archiveOnlyOfficial','archiveOnlyVidu','archiveOnlyImages'].includes(target.id);
  }

  function renderArchiveOnly(focusSearch=false){
    const app=document.querySelector('#app');
    if(!app||typeof storyArchiveView!=='function')return;
    restoring=true;
    app.innerHTML=storyArchiveView();
    restoring=false;
    if(focusSearch){
      requestAnimationFrame(()=>{
        const input=document.querySelector('#archiveSearch');
        if(!input)return;
        input.value=cachedQuery;
        input.focus({preventScroll:true});
        const end=input.value.length;
        try{input.setSelectionRange(end,end)}catch(_){/* search inputs may not support selection on every browser */}
      });
    }
  }

  document.addEventListener('input',event=>{
    const target=event.target;
    if(target?.id!=='archiveSearch'||restoring)return;
    event.stopImmediatePropagation();
    cachedQuery=target.value;
    renderArchiveOnly(true);
  },true);

  document.addEventListener('change',event=>{
    const target=event.target;
    if(!isArchiveControl(target)||target.id==='archiveSearch'||restoring)return;
    event.stopImmediatePropagation();
    cachedQuery=document.querySelector('#archiveSearch')?.value||cachedQuery;
    renderArchiveOnly(false);
  },true);

  document.addEventListener('focusin',event=>{
    if(event.target?.id==='archiveSearch')cachedQuery=event.target.value||cachedQuery;
  },true);

  const previousCurrentQuery=window.archiveSearchCurrentQuery;
  window.archiveSearchCurrentQuery=function(){
    return document.querySelector('#archiveSearch')?.value||cachedQuery||(typeof previousCurrentQuery==='function'?previousCurrentQuery():'');
  };
})();
