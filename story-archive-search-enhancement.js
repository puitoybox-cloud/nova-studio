/* Story Archive search enhancement. */
(function(){
  const searchInput=()=>document.querySelector('#archiveSearch');
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const escapeRegExp=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const normalize=value=>String(value??'').toLocaleLowerCase('ja-JP');
  const currentQuery=()=>String(searchInput()?.value||'').trim();
  const currentNeedle=()=>normalize(currentQuery());
  const projectName=card=>{
    if(typeof storyArchiveProjectName==='function')return storyArchiveProjectName(card?.projectId);
    const project=state?.projects?.find?.(item=>item.id===card?.projectId)||currentProject?.();
    return project?.title||card?.projectId||'未設定';
  };
  const relatedTitles=card=>{
    if(typeof archiveRelatedIds!=='function')return '';
    return archiveRelatedIds(card).map(id=>getStoryArchiveCard?.(id)?.title||id).join(' ');
  };
  const searchFields=card=>({
    project:projectName(card),
    title:card?.title||'',
    body:card?.body||'',
    tags:(card?.tags||[]).join(' '),
    category:card?.category||'',
    status:card?.status||'',
    related:relatedTitles(card)
  });
  const fieldLabels={project:'作品名',title:'タイトル',body:'本文',tags:'タグ'};
  const searchableText=card=>Object.values(searchFields(card)).join(' ');
  const baseFiltersMatch=(card,f)=>{
    const imgs=card.images||[];
    const rep=archiveRepresentativeImage?.(card);
    const knownTypes=typeof ARCHIVE_UI_TYPES!=='undefined'?ARCHIVE_UI_TYPES:[];
    return (!f.type||(f.type==='その他'?!knownTypes.slice(0,-1).includes(card.category):card.category===f.type))
      &&(!f.official||card.isConfirmed||card.status==='確定'||imgs.some(img=>img.isOfficial||img.state==='正式採用'))
      &&(!f.images||!!rep)
      &&(!f.vidu||imgs.some(img=>img.isViduReference));
  };
  const highlight=value=>{
    const raw=String(value??'');
    const query=currentQuery();
    if(!query)return escapeHtml(raw);
    const matcher=new RegExp(`(${escapeRegExp(query)})`,'ig');
    return raw.split(matcher).map(part=>normalize(part)===normalize(query)?`<mark class="archive-search-mark">${escapeHtml(part)}</mark>`:escapeHtml(part)).join('');
  };
  const compactBody=body=>{
    const text=String(body||'本文は未入力です。');
    const query=currentQuery();
    if(!query)return text.slice(0,110);
    const hay=normalize(text);
    const index=hay.indexOf(currentNeedle());
    if(index<0)return text.slice(0,110);
    const start=Math.max(0,index-34);
    const end=Math.min(text.length,index+query.length+74);
    return `${start?'...':''}${text.slice(start,end)}${end<text.length?'...':''}`;
  };
  const hitLabels=card=>{
    const needle=currentNeedle();
    if(!needle)return [];
    const fields=searchFields(card);
    return Object.entries(fieldLabels).filter(([key])=>normalize(fields[key]).includes(needle)).map(([,label])=>label);
  };
  const clearSearchFilters=()=>{
    const ids=['archiveSearch','archiveTypeFilter','archiveOnlyOfficial','archiveOnlyVidu','archiveOnlyImages'];
    ids.forEach(id=>{
      const el=document.getElementById(id);
      if(!el)return;
      if(el.type==='checkbox')el.checked=false;
      else el.value='';
    });
    render?.();
  };

  window.archiveUiFilterState=function(){
    return {
      q:currentQuery(),
      type:document.querySelector('#archiveTypeFilter')?.value||'',
      official:!!document.querySelector('#archiveOnlyOfficial')?.checked,
      images:!!document.querySelector('#archiveOnlyImages')?.checked,
      vidu:!!document.querySelector('#archiveOnlyVidu')?.checked
    };
  };

  window.archiveUiMatches=function(card,f){
    const needle=normalize(f?.q||'');
    return (!needle||normalize(searchableText(card)).includes(needle))&&baseFiltersMatch(card,f||{});
  };

  window.clearArchiveSearchFilters=clearSearchFilters;
  window.archiveSearchHighlight=highlight;

  if(typeof archiveHomeFilters==='function'){
    window.archiveHomeFilters=function(cards,filtered){
      const f=archiveUiFilterState();
      return `<section class="home-panel archive-home-filters archive-search-panel"><div class="section-head"><div><p class="eyebrow">Search & Filter</p><h2>検索・フィルター</h2><p class="meta">作品名・タイトル・本文・タグからリアルタイム検索します。</p></div><button class="secondary" onclick="clearArchiveSearchFilters()">条件をクリア</button></div><div class="archive-home-filter-grid archive-search-grid"><label class="archive-keyword-field">キーワード<input id="archiveSearch" type="search" placeholder="作品名・タイトル・本文・タグを検索" value="${escapeHtml(currentQuery())}" oninput="render()" autocomplete="off"></label><label>カテゴリ<select id="archiveTypeFilter" onchange="render()"><option value="">すべて</option>${archiveHomeTypeOptions(cards)}</select></label><label class="check-row"><input id="archiveOnlyOfficial" type="checkbox" ${f.official?'checked':''} onchange="render()">正式採用のみ</label><label class="check-row"><input id="archiveOnlyVidu" type="checkbox" ${f.vidu?'checked':''} onchange="render()">Vidu参照のみ</label><label class="check-row"><input id="archiveOnlyImages" type="checkbox" ${f.images?'checked':''} onchange="render()">画像ありのみ</label></div><div class="archive-search-resultbar" aria-live="polite"><b>検索結果 ${filtered.length}件</b><span>全${cards.length}件中</span>${currentQuery()?`<span class="archive-search-query">「${escapeHtml(currentQuery())}」</span>`:'<span>キーワード未入力</span>'}</div><div class="stats"><div><b>表示中</b><span>${filtered.length}件</span></div><div><b>全カード</b><span>${cards.length}件</span></div><div><b>画像あり</b><span>${cards.filter(card=>archiveRepresentativeImage(card)).length}件</span></div><div><b>正式採用</b><span>${cards.filter(card=>card.isConfirmed||card.status==='確定'||(card.images||[]).some(img=>img.isOfficial||img.state==='正式採用')).length}件</span></div></div></section>`;
    };
  }

  if(typeof archiveHomeCardTile==='function'){
    window.archiveHomeCardTile=function(card){
      const confirmed=card.isConfirmed||card.status==='確定';
      const rep=archiveRepresentativeImage(card);
      const hits=hitLabels(card);
      return `<article class="app-card archive-home-card archive-search-card" role="button" tabindex="0" onclick="openStoryArchiveDetail('${card.id}')" onkeydown="if(event.key==='Enter'||event.key===' ')openStoryArchiveDetail('${card.id}')"><div class="app-card-top"><span class="app-icon">${rep?'View':'Card'}</span><span class="ver">${highlight(card.category||'その他')}</span></div><div class="archive-home-thumb">${archiveCardListImage(card)}</div><p class="archive-card-project">${highlight(projectName(card))}</p><h3>${highlight(card.title||'無題')}</h3><p class="meta">${highlight(compactBody(card.body))}</p><dl><dt>画像</dt><dd>${(card.images||[]).length}枚</dd><dt>状態</dt><dd>${confirmed?'正式採用':'検討中'}</dd><dt>タグ</dt><dd>${highlight((card.tags||[]).slice(0,4).join(', ')||'なし')}</dd></dl>${hits.length?`<div class="archive-search-hits">${hits.map(label=>`<span>${escapeHtml(label)}</span>`).join('')}</div>`:''}<div class="app-actions"><button class="primary-action" onclick="event.stopPropagation();openStoryArchiveDetail('${card.id}')">詳細</button><button class="secondary" onclick="event.stopPropagation();editStoryArchiveCard('${card.id}')">編集</button></div></article>`;
    };
  }

  if(typeof storyArchiveView==='function'&&typeof archiveUiCards==='function'){
    window.storyArchiveView=function(){
      const project=currentProject?.();
      const cards=archiveUiCards();
      const filtered=cards.filter(card=>archiveUiMatches(card,archiveUiFilterState()));
      if(typeof homeBackgroundPicker==='function'&&typeof archiveHomeFilters==='function'&&typeof archiveHomeCardTile==='function'){
        return `<main class="archive-home-page" aria-label="Story Archive"><div class="home-top-tools archive-top-tools">${homeBackgroundPicker()}</div><section class="home-hero archive-home-hero"><div class="nova-logo"><span class="nova-mark">Story</span><span><b>Story Archive</b><small>設定資料・画像資料</small></span></div><div><p class="eyebrow">Archive Workspace</p><h1>Story Archive</h1><p class="catch">物語の記憶、キャラクター、背景、参照画像をひとつのアトリエに。</p><p class="meta">現在の作品：${escapeHtml(project?.title||'未選択')} / 検索結果 ${filtered.length}件（全${cards.length}件）</p><div class="archive-hero-actions"><button class="primary-action" onclick="editStoryArchiveCard()">＋ 新しいカード</button><button class="secondary" onclick="openMemorySync()">Memory Sync</button><button class="secondary vidu-one-tap" onclick="openArchiveViduReferences()">Vidu参照画像（${archiveViduReferenceImages().length}）</button></div></div></section>${archiveHomeFilters(cards,filtered)}<section class="home-panel archive-list-panel"><div class="section-head"><div><p class="eyebrow">Cards</p><h2>アーカイブ一覧</h2></div></div><div class="app-grid archive-home-grid">${filtered.map(archiveHomeCardTile).join('')||'<p class="empty-note">条件に合うカードはありません。</p>'}</div></section><section class="home-panel archive-history-panel"><h2>Memory Sync履歴</h2>${memorySyncHistoryRows()}</section></main>`;
      }
      return `<section class="archive-shell"><div class="archive-topbar"><button class="secondary archive-back" onclick="novaReturnHome()">← Nova Studioへ戻る</button><div class="archive-title-block"><p class="eyebrow">Story Archive</p><h1>Story Archive</h1><p class="meta">現在の作品：${escapeHtml(project?.title||'未選択')} / 検索結果 ${filtered.length}件（全${cards.length}件）</p></div><input id="archiveSearch" class="archive-search" type="search" placeholder="作品名・タイトル・本文・タグを検索" value="${escapeHtml(currentQuery())}" oninput="render()"><button class="primary-action" onclick="editStoryArchiveCard()">＋ 新しいカード</button><button class="archive-filter-toggle secondary" onclick="document.body.classList.toggle('archive-filters-open')">フィルター</button></div><div class="archive-workspace">${archiveUiFilters(cards)}<section class="archive-grid-panel"><div class="archive-board-grid">${filtered.map(archiveCardTile).join('')||'<p class="empty-note">条件に合うカードはありません。</p>'}</div></section></div></section>`;
    };
  }

  render?.();
})();
