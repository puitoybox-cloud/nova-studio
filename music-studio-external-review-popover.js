/* External Track Review: normalize the review panel to the standard Music Studio topbar popover structure. */
(function(root){
  'use strict';

  let frame=null;

  function cancelReview(menu,api){
    if(!menu?.open||typeof api?.editorCancelExternalTrackAssignments!=='function')return;
    menu.dataset.reviewWasOpen='true';
  }

  function normalizeReviewPopover(doc=root.document,api=root.MusicStudio){
    const page=doc?.querySelector?.('.music-midi-editor-page');
    if(!page)return false;
    const existing=page.querySelector('.music-external-track-review-menu');
    if(existing)return true;
    const entry=page.querySelector('.music-external-track-review-entry');
    const dialog=page.querySelector('#externalTrackReviewDialog');
    if(!entry||!dialog)return false;

    const menu=doc.createElement('details');
    menu.className='music-editor-menu music-external-track-review-menu';
    const summary=doc.createElement('summary');
    summary.textContent=entry.textContent||'External Tracks / Review';
    summary.setAttribute('aria-label',summary.textContent);

    const popover=doc.createElement('div');
    popover.className='music-editor-popover music-external-track-review';
    popover.id='externalTrackReviewPopover';
    popover.setAttribute('role','region');
    popover.setAttribute('aria-label','External Tracks Review');
    while(dialog.firstChild)popover.appendChild(dialog.firstChild);

    menu.append(summary,popover);
    entry.replaceWith(menu);
    dialog.remove();

    menu.addEventListener('toggle',()=>{
      if(menu.open){menu.dataset.reviewWasOpen='true';return}
      if(menu.dataset.reviewWasOpen!=='true')return;
      menu.dataset.reviewWasOpen='false';
      if(api?.state?.externalTrackAssignmentDraft&&typeof api.editorCancelExternalTrackAssignments==='function')api.editorCancelExternalTrackAssignments();
    });
    cancelReview(menu,api);
    return true;
  }

  function schedule(){
    if(frame!=null)return;
    const run=()=>{frame=null;normalizeReviewPopover()};
    frame=root.requestAnimationFrame?.(run)??root.setTimeout?.(run,0)??null;
  }

  if(root.document){
    root.addEventListener?.('DOMContentLoaded',schedule,{once:true});
    const observer=new MutationObserver(schedule);
    observer.observe(root.document.documentElement,{childList:true,subtree:true});
    schedule();
  }
})(typeof window!=='undefined'?window:globalThis);
