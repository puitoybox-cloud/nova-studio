/* Version 1.3.3: hide the empty gallery section until the first image is added. */
(function(){
  if(typeof openStoryArchiveDetail!=='function')return;

  const previousOpenStoryArchiveDetail=openStoryArchiveDetail;

  openStoryArchiveDetail=function(id,mode='all'){
    previousOpenStoryArchiveDetail(id,mode);

    const card=typeof getStoryArchiveCard==='function'?getStoryArchiveCard(id):null;
    const normalized=typeof normalizeStoryArchiveCard==='function'?normalizeStoryArchiveCard(card||{}):(card||{});
    const images=Array.isArray(normalized?.images)?normalized.images:[];
    if(images.length)return;

    const modalBody=document.querySelector('#modalBody');
    if(!modalBody)return;
    const gallery=[...modalBody.querySelectorAll('section')].find(section=>section.querySelector('h2,h3')?.textContent?.trim()==='画像ギャラリー');
    if(gallery)gallery.hidden=true;
  };
})();
