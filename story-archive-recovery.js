/* Story Archive recovery layer: prevents one malformed card/helper error from blanking the whole view. */
(function(){
  const recoveryEsc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const rawCards=()=>Array.isArray(state?.storyArchiveCards)?state.storyArchiveCards.filter(Boolean):[];

  if(typeof archiveUiCards==='function'){
    archiveUiCards=function(){
      return rawCards().map((card,index)=>{
        try{
          if(typeof normalizeStoryArchiveCardV1==='function')return normalizeStoryArchiveCardV1(card);
          if(typeof normalizeStoryArchiveCard==='function')return normalizeStoryArchiveCard(card);
          return card;
        }catch(error){
          console.error('Story Archive card normalization failed',card?.id||index,error);
          return {
            ...card,
            id:card?.id||`recovery-card-${index}`,
            title:card?.title||'読み込みに問題のあるカード',
            body:card?.body||'',
            category:card?.category||'その他',
            tags:Array.isArray(card?.tags)?card.tags:[],
            images:Array.isArray(card?.images)?card.images:[],
            recoveryError:true
          };
        }
      });
    };
  }

  const currentStoryArchiveView=typeof storyArchiveView==='function'?storyArchiveView:null;
  function recoveryCardTile(card){
    const imageCount=Array.isArray(card?.images)?card.images.length:0;
    return `<article class="app-card archive-home-card"><div class="app-card-top"><span class="app-icon">${imageCount?'🖼️':'📚'}</span><span class="ver">${recoveryEsc(card?.category||'その他')}</span></div><h3>${recoveryEsc(card?.title||'無題')}</h3><p class="meta">${recoveryEsc(card?.body||'本文は未入力です。').slice(0,120)}</p><dl><dt>画像</dt><dd>${imageCount}枚</dd><dt>状態</dt><dd>${card?.recoveryError?'要確認':recoveryEsc(card?.status||'仮設定')}</dd></dl><div class="app-actions"><button class="primary-action" onclick="openStoryArchiveDetail('${recoveryEsc(card?.id||'')}')">詳細</button><button class="secondary" onclick="editStoryArchiveCard('${recoveryEsc(card?.id||'')}')">編集</button></div></article>`;
  }
  function recoveryView(error){
    const cards=typeof archiveUiCards==='function'?archiveUiCards():rawCards();
    console.error('Story Archive view recovered from an error',error);
    return `<section class="home-hero archive-home-hero"><div class="nova-logo"><span class="nova-mark">📚</span><span><b>Story Archive</b><small>復旧モード</small></span></div><div><p class="eyebrow">Recovery</p><h1>Story Archive</h1><p class="catch">保存済みデータを変更せず、安全表示で開いています。</p><p class="meta">カード ${cards.length}件を保持しています。</p><div class="archive-hero-actions"><button class="primary-action" onclick="editStoryArchiveCard()">＋ 新しいカード</button><button class="secondary" onclick="novaReturnHome()">Nova Studioへ戻る</button></div></div></section><section class="home-panel"><div class="section-head"><div><p class="eyebrow">Cards</p><h2>アーカイブ一覧</h2></div></div><div class="app-grid archive-home-grid">${cards.map(recoveryCardTile).join('')||'<p class="empty-note">カードはまだありません。</p>'}</div></section>`;
  }
  storyArchiveView=function(){
    try{
      return currentStoryArchiveView?currentStoryArchiveView():recoveryView();
    }catch(error){
      return recoveryView(error);
    }
  };

  const currentOpenDetail=typeof openStoryArchiveDetail==='function'?openStoryArchiveDetail:null;
  openStoryArchiveDetail=function(id,mode='all'){
    try{
      return currentOpenDetail?.(id,mode);
    }catch(error){
      console.error('Story Archive detail recovered from an error',id,error);
      const card=rawCards().find(item=>item?.id===id);
      if(!card)return;
      modal(`<article class="archive-detail archive-home-detail"><section class="home-panel"><h2>${recoveryEsc(card.title||'無題')}</h2><p>${recoveryEsc(card.body||'本文は未入力です。')}</p><p class="meta">画像：${Array.isArray(card.images)?card.images.length:0}枚 / 保存データは変更していません。</p><div class="app-actions"><button class="primary-action" onclick="editStoryArchiveCard('${recoveryEsc(id)}')">カード編集</button><button class="secondary" onclick="closeModal()">閉じる</button></div></section></article>`);
    }
  };

  if((location.hash||'').slice(1)==='storyArchive')render();
})();
