/* Story Archive home alignment and shared background handling. */
(function(){
  const BACKGROUND_KEY='novaStudioHomeBackground';
  const BACKGROUNDS=[
    {id:'glass',label:'ガラス風',file:'glass_fantasy_background.jpg'},
    {id:'glassUi',label:'ガラス風UI',file:'glass_fantasy_ui_background.jpg'},
    {id:'nightSky',label:'夜空',file:'night_sky_background.jpg'},
    {id:'shootingStars',label:'流れ星',file:'shooting_stars_background.jpg'},
    {id:'fantasyAtelier',label:'幻想アトリエ',file:'fantasy_atelier_background.png'}
  ];
  const DEFAULT_BACKGROUND='glassUi';
  const hasBackground=id=>BACKGROUNDS.some(bg=>bg.id===id);
  const selectedBackground=()=>BACKGROUNDS.find(bg=>bg.id===(localStorage.getItem(BACKGROUND_KEY)||DEFAULT_BACKGROUND))||BACKGROUNDS.find(bg=>bg.id===DEFAULT_BACKGROUND)||BACKGROUNDS[0];
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  window.applyHomeBackground=function(){
    const bg=selectedBackground();
    document.body.dataset.homeBackground=bg.id;
    document.body.style.setProperty('--home-background-image',`url('./${bg.file}')`);
  };

  window.setHomeBackground=function(id){
    if(!hasBackground(id))return;
    localStorage.setItem(BACKGROUND_KEY,id);
    applyHomeBackground();
    render?.();
  };

  window.homeBackgroundPicker=function(){
    const selected=selectedBackground().id;
    return `<details class="home-background-picker"><summary role="button">背景</summary><div>${BACKGROUNDS.map(bg=>`<button class="secondary ${bg.id===selected?'active':''}" onclick="setHomeBackground('${escapeHtml(bg.id)}')" aria-pressed="${bg.id===selected?'true':'false'}">${escapeHtml(bg.label)}</button>`).join('')}</div></details>`;
  };

  const previousRender=window.render;
  window.render=function(){
    const route=(location.hash||'#home').slice(1)||'home';
    document.body.classList.toggle('is-story-archive-route',route==='storyArchive');
    return previousRender?.();
  };

  if(typeof archiveUiFilterState==='function'){
    window.archiveHomeFilters=function(cards,filtered){
      const f=archiveUiFilterState();
      return `<section class="home-panel archive-home-filters"><div class="section-head"><div><p class="eyebrow">Search & Filter</p><h2>検索・フィルター</h2></div><button class="secondary" onclick="document.getElementById('archiveSearch').value='';document.getElementById('archiveTypeFilter').value='';document.getElementById('archiveOnlyOfficial').checked=false;document.getElementById('archiveOnlyVidu').checked=false;document.getElementById('archiveOnlyImages').checked=false;render()">条件をクリア</button></div><div class="archive-home-filter-grid"><label>キーワード<input id="archiveSearch" placeholder="カード名・本文・タグ・関連カードを検索" value="${escapeHtml(document.querySelector('#archiveSearch')?.value||'')}" oninput="render()"></label><label>カテゴリ<select id="archiveTypeFilter" onchange="render()"><option value="">すべて</option>${archiveHomeTypeOptions(cards)}</select></label><label class="check-row"><input id="archiveOnlyOfficial" type="checkbox" ${f.official?'checked':''} onchange="render()">正式採用のみ</label><label class="check-row"><input id="archiveOnlyVidu" type="checkbox" ${f.vidu?'checked':''} onchange="render()">Vidu参照のみ</label><label class="check-row"><input id="archiveOnlyImages" type="checkbox" ${f.images?'checked':''} onchange="render()">画像ありのみ</label></div><div class="stats"><div><b>表示中</b><span>${filtered.length}件</span></div><div><b>全カード</b><span>${cards.length}件</span></div><div><b>画像あり</b><span>${cards.filter(c=>archiveRepresentativeImage(c)).length}件</span></div><div><b>正式採用</b><span>${cards.filter(c=>c.isConfirmed||c.status==='確定'||(c.images||[]).some(i=>i.isOfficial||i.state==='正式採用')).length}件</span></div></div></section>`;
    };

    window.archiveHomeCardTile=function(card){
      const confirmed=card.isConfirmed||card.status==='確定';
      const rep=archiveRepresentativeImage(card);
      return `<article class="app-card archive-home-card" role="button" tabindex="0" onclick="openStoryArchiveDetail('${card.id}')" onkeydown="if(event.key==='Enter'||event.key===' ')openStoryArchiveDetail('${card.id}')"><div class="app-card-top"><span class="app-icon">${rep?'View':'Card'}</span><span class="ver">${escapeHtml(card.category||'その他')}</span></div><div class="archive-home-thumb">${archiveCardListImage(card)}</div><h3>${escapeHtml(card.title||'無題')}</h3><p class="meta">${escapeHtml(card.body||'本文は未入力です。').slice(0,90)}</p><dl><dt>画像</dt><dd>${(card.images||[]).length}枚</dd><dt>状態</dt><dd>${confirmed?'正式採用':'検討中'}</dd><dt>タグ</dt><dd>${escapeHtml((card.tags||[]).slice(0,3).join(', ')||'なし')}</dd></dl><div class="app-actions"><button class="primary-action" onclick="event.stopPropagation();openStoryArchiveDetail('${card.id}')">詳細</button><button class="secondary" onclick="event.stopPropagation();editStoryArchiveCard('${card.id}')">編集</button></div></article>`;
    };

    window.storyArchiveView=function(){
      const p=currentProject();
      const cards=archiveUiCards();
      const filtered=cards.filter(card=>archiveUiMatches(card,archiveUiFilterState()));
      return `<main class="archive-home-page" aria-label="Story Archive"><div class="home-top-tools archive-top-tools">${homeBackgroundPicker()}</div><section class="home-hero archive-home-hero"><div class="nova-logo"><span class="nova-mark">Story</span><span><b>Story Archive</b><small>設定資料・画像資料</small></span></div><div><p class="eyebrow">Archive Workspace</p><h1>Story Archive</h1><p class="catch">物語の記憶、キャラクター、背景、参照画像をひとつのアトリエに。</p><p class="meta">現在の作品：${escapeHtml(p?.title||'未選択')} / 表示 ${filtered.length}件（全${cards.length}件）</p><div class="archive-hero-actions"><button class="primary-action" onclick="editStoryArchiveCard()">＋ 新しいカード</button><button class="secondary" onclick="openMemorySync()">Memory Sync</button><button class="secondary vidu-one-tap" onclick="openArchiveViduReferences()">Vidu参照画像（${archiveViduReferenceImages().length}）</button></div></div></section>${archiveHomeFilters(cards,filtered)}<section class="home-panel archive-list-panel"><div class="section-head"><div><p class="eyebrow">Cards</p><h2>アーカイブ一覧</h2></div></div><div class="app-grid archive-home-grid">${filtered.map(archiveHomeCardTile).join('')||'<p class="empty-note">条件に合うカードはありません。</p>'}</div></section><section class="home-panel archive-history-panel"><h2>Memory Sync履歴</h2>${memorySyncHistoryRows()}</section></main>`;
    };
  }

  applyHomeBackground();
  render?.();
})();
