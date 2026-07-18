/* Version 1.3.2: keep one clear image-add entry while a card has no images. */
(function(){
  if(typeof openStoryArchiveDetail!=='function')return;

  const previousOpenStoryArchiveDetail=openStoryArchiveDetail;

  openStoryArchiveDetail=function(id,mode='all'){
    const result=previousOpenStoryArchiveDetail(id,mode);
    const raw=typeof getStoryArchiveCard==='function'?getStoryArchiveCard(id):null;
    const card=typeof normalizeStoryArchiveCard==='function'?normalizeStoryArchiveCard(raw||{}):(raw||{});
    const images=Array.isArray(card?.images)?card.images:[];
    if(images.length)return result;

    const modalBody=document.querySelector('#modalBody');
    if(!modalBody)return result;
    const gallery=modalBody.querySelector('.archive-gallery-panel');
    if(!gallery)return result;

    gallery.querySelectorAll('.archive-image-actions button').forEach(button=>{
      if(button.textContent.trim()==='画像追加')button.remove();
    });

    return result;
  };
})();
