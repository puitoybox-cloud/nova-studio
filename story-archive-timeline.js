/* Version 1.4.4: manage appearance episodes and chronology without changing existing card data. */
(function(){
  if(typeof openStoryArchiveDetail!=='function')return;

  const previousOpenStoryArchiveDetail=openStoryArchiveDetail;
  let activeCardId='';

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,char=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[char]));
  }

  function cardById(id){
    return typeof getStoryArchiveCard==='function'?getStoryArchiveCard(id):null;
  }

  function ensureWorkspace(card){
    card.archiveWorkspace=card.archiveWorkspace&&typeof card.archiveWorkspace==='object'?card.archiveWorkspace:{};
    card.archiveWorkspace.timeline=card.archiveWorkspace.timeline&&typeof card.archiveWorkspace.timeline==='object'?card.archiveWorkspace.timeline:{};
    card.archiveWorkspace.changeHistory=Array.isArray(card.archiveWorkspace.changeHistory)?card.archiveWorkspace.changeHistory:[];
    return card.archiveWorkspace;
  }

  function nowText(){
    try{return typeof now==='function'?now():new Date().toISOString()}catch(_){return new Date().toISOString()}
  }

  function episodesFor(card){
    const all=Array.isArray(window.state?.episodes)?window.state.episodes:[];
    const projectId=card.projectId||window.state?.activeContext?.projectId||'';
    return all.filter(item=>!item.isArchived&&(!projectId||item.projectId===projectId)).sort((a,b)=>(+a.sortOrder||0)-(+b.sortOrder||0));
  }

  function episodeLabel(item){
    return [item.numberLabel,item.subtitle||item.title].filter(Boolean).join(' / ')||item.id;
  }

  function section(card){
    const timeline=ensureWorkspace(card).timeline;
    const episodes=episodesFor(card);
    const selected=new Set(Array.isArray(timeline.episodeIds)?timeline.episodeIds:(card.relatedEpisodes||[]));
    return `
      <div class="archive-timeline-workspace">
        <div class="archive-timeline-head">
          <div><p class="eyebrow">入力・保存できます</p><h2>🕰 登場話・時系列</h2></div>
          <span class="archive-workspace-ready">利用可能</span>
        </div>
        <div class="archive-timeline-summary"><span>登場話 ${selected.size}件</span><span>初登場 ${esc(timeline.firstAppearance||'未設定')}</span></div>
        <div class="archive-timeline-form">
          <label>初登場<input id="archiveTimelineFirst" value="${esc(timeline.firstAppearance||'')}" placeholder="例：第0話 Scene3"></label>
          <label>時系列上の位置<input id="archiveTimelinePosition" value="${esc(timeline.position||'')}" placeholder="例：物語開始から3日目"></label>
          <label class="archive-timeline-wide">登場する話数
            <div class="archive-episode-picker">
              ${episodes.length?episodes.map(item=>`<label><input type="checkbox" data-archive-episode-id="${esc(item.id)}" ${selected.has(item.id)?'checked':''}>${esc(episodeLabel(item))}</label>`).join(''):'<span class="meta">この作品には話数がまだ登録されていません。</span>'}
            </div>
          </label>
          <label class="archive-timeline-wide">シーン・出来事メモ<textarea id="archiveTimelineScenes" rows="7" placeholder="登場シーン、重要な出来事、前後関係を入力">${esc(timeline.sceneNotes||'')}</textarea></label>
          <label class="archive-timeline-wide">時系列メモ<textarea id="archiveTimelineNotes" rows="6" placeholder="年齢、季節、日付、過去・現在などを入力">${esc(timeline.notes||'')}</textarea></label>
        </div>
        <div class="archive-timeline-actions"><button type="button" onclick="saveArchiveTimeline()">登場話・時系列を保存</button></div>
      </div>`;
  }

  function enhance(card){
    const body=document.querySelector('#modalBody');
    if(!body||!card)return;
    const target=body.querySelector('[data-archive-overview-resolved="timeline"]');
    if(!target)return;
    target.classList.add('archive-workspace-section');
    target.innerHTML=section(card);
  }

  window.saveArchiveTimeline=function(){
    const card=cardById(activeCardId);if(!card)return;
    const workspace=ensureWorkspace(card);
    const episodeIds=[...document.querySelectorAll('[data-archive-episode-id]:checked')].map(input=>input.dataset.archiveEpisodeId).filter(Boolean);
    workspace.timeline={
      firstAppearance:document.querySelector('#archiveTimelineFirst')?.value.trim()||'',
      position:document.querySelector('#archiveTimelinePosition')?.value.trim()||'',
      episodeIds,
      sceneNotes:document.querySelector('#archiveTimelineScenes')?.value.trim()||'',
      notes:document.querySelector('#archiveTimelineNotes')?.value.trim()||''
    };
    card.relatedEpisodes=episodeIds;
    card.relatedIds=[...new Set([...(card.relatedIds||[]).filter(id=>!(card.relatedEpisodes||[]).includes(id)),...episodeIds])];
    workspace.changeHistory.unshift({id:`workspace_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,message:'登場話・時系列を更新',createdAt:nowText()});
    workspace.changeHistory=workspace.changeHistory.slice(0,100);
    card.updatedAt=nowText();
    if(typeof saveState==='function')saveState(true);
    else try{localStorage.setItem('novaStudioState',JSON.stringify(state))}catch(_){/* existing saveState is preferred */}
    if(typeof toast==='function')toast('登場話・時系列を保存しました');
    openStoryArchiveDetail(activeCardId);
  };

  openStoryArchiveDetail=function(id,mode='all'){
    activeCardId=id;
    previousOpenStoryArchiveDetail(id,mode);
    enhance(cardById(id));
  };
})();
