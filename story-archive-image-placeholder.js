/* Version 1.3.1: image-first empty state for Story Archive details. */
(function(){
  if(typeof archiveRepresentativeHero!=='function')return;

  const previousArchiveRepresentativeHero=archiveRepresentativeHero;

  archiveRepresentativeHero=function(card){
    const normalized=typeof normalizeStoryArchiveCard==='function'?normalizeStoryArchiveCard(card):card;
    const images=Array.isArray(normalized?.images)?normalized.images:[];
    if(images.length)return previousArchiveRepresentativeHero(normalized);

    const cardId=String(normalized?.id||'');
    return `<section class="archive-detail-hero archive-empty-image-hero"><div class="archive-empty-image-copy"><p class="eyebrow">代表画像</p><h3>画像を追加して、このカードの資料を育てよう</h3><p class="meta">立ち絵・表情・横顔・背景・Vidu参照画像などを、あとから何枚でも追加できます。</p></div><button class="archive-add-image-placeholder" type="button" onclick="editArchiveImage('${cardId}')" aria-label="画像を追加する"><span class="archive-add-image-plus">＋</span><b>画像を追加する</b><small>最初の1枚を登録</small></button></section>`;
  };
})();
