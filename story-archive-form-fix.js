/* Story Archive form stability: keep the card modal open when its category changes. */
(function(){
  function isStoryArchiveCategorySelect(target){
    if(!(target instanceof HTMLSelectElement))return false;
    const modalBody=document.querySelector('#modalBody');
    if(!modalBody||!modalBody.contains(target))return false;
    const heading=modalBody.querySelector('h1,h2,h3')?.textContent||'';
    if(!heading.includes('Story Archiveカード'))return false;
    const label=target.closest('label');
    return Boolean(label&&label.textContent.trim().startsWith('カテゴリ'));
  }

  document.addEventListener('change',function(event){
    if(!isStoryArchiveCategorySelect(event.target))return;
    event.stopImmediatePropagation();
  },true);
})();
