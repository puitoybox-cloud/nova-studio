/* Version 1.4.3: make Related Cards usable while preserving existing card data. */
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
    return typeof getStoryArchiveCard==='function'
      ?getStoryArchiveCard(id)
      :(Array.isArray(state?.storyArchiveCards)?state.storyArchiveCards.find(card=>card?.id===id):null);
  }

  function allCards(){
    return Array.isArray(state?.storyArchiveCards)?state.storyArchiveCards.filter(Boolean):[];
  }

  function ensureWorkspace(card){
    card.archiveWorkspace=card.archiveWorkspace&&typeof card.archiveWorkspace==='object'?card.archiveWorkspace:{};
    card.archiveWorkspace.relations=Array.isArray(card.archiveWorkspace.relations)?card.archiveWorkspace.relations:[];
    card.archiveWorkspace.changeHistory=Array.isArray(card.archiveWorkspace.changeHistory)?card.archiveWorkspace.changeHistory:[];
    return card.archiveWorkspace;
  }

  function nowText(){
    try{return typeof now==='function'?now():new Date().toISOString()}catch(_){return new Date().toISOString()}
  }

  function persist(card,message){
    const workspace=ensureWorkspace(card);
    workspace.changeHistory.unshift({
      id:`workspace_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      message,
      createdAt:nowText()
    });
    workspace.changeHistory=workspace.changeHistory.slice(0,100);
    card.updatedAt=nowText();
    if(typeof saveState==='function')saveState(true);
    else try{localStorage.setItem('novaStudioState',JSON.stringify(state))}catch(_){/* existing saveState is preferred */}
    if(typeof toast==='function')toast('保存しました');
  }

  function cardTitle(card){
    return card?.archiveWorkspace?.basic?.title||card?.title||card?.name||'無題';
  }

  function cardCategory(card){
    return card?.archiveWorkspace?.basic?.category||card?.category||card?.cardType||'その他';
  }

  function relationRows(card){
    const relations=ensureWorkspace(card).relations;
    if(!relations.length)return '<p class="archive-related-empty">関連カードはまだ登録されていません。</p>';
    return relations.map((relation,index)=>{
      const target=cardById(relation.cardId);
      return `<article class="archive-related-row">
        <div>
          <span class="archive-related-category">${esc(target?cardCategory(target):'見つかりません')}</span>
          <h3>${esc(target?cardTitle(target):'削除済みのカード')}</h3>
          <p><b>${esc(relation.type||'関連')}</b>${relation.memo?` — ${esc(relation.memo)}`:''}</p>
        </div>
        <div class="archive-related-actions">
          <button type="button" ${target?'':'disabled'} onclick="openStoryArchiveDetail('${esc(relation.cardId)}')">開く</button>
          <button type="button" class="secondary" onclick="removeArchiveRelation(${index})">解除</button>
        </div>
      </article>`;
    }).join('');
  }

  function relationSection(card){
    const candidates=allCards().filter(candidate=>candidate.id!==card.id);
    return `
      <div class="archive-workspace-head">
        <div><p class="eyebrow">カード同士をつなぐ</p><h2>🔗 関連カード</h2></div>
        <span class="archive-workspace-ready">利用可能</span>
      </div>
      <p class="archive-workspace-note">人物・場所・用語・アイテムなどをつなぎ、関連先へすぐ移動できます。</p>
      <div class="archive-related-list">${relationRows(card)}</div>
      <div class="archive-related-form">
        <label>関連先
          <select id="archiveRelationCard">
            <option value="">カードを選択</option>
            ${candidates.map(candidate=>`<option value="${esc(candidate.id)}">${esc(cardCategory(candidate))}｜${esc(cardTitle(candidate))}</option>`).join('')}
          </select>
        </label>
        <label>関係
          <select id="archiveRelationType">
            ${['関連','登場人物','家族','友人','敵対','所属','場所','所有物','用語','登場話','参照資料','その他'].map(type=>`<option>${type}</option>`).join('')}
          </select>
        </label>
        <label class="archive-related-wide">補足<input id="archiveRelationMemo" placeholder="例：ティアが常に持っているアイテム"></label>
        <label class="archive-related-check"><input id="archiveRelationReverse" type="checkbox" checked>相手のカードにも逆向きの関連を追加する</label>
      </div>
      <div class="archive-workspace-actions"><button type="button" onclick="addArchiveRelation()">関連カードを追加</button></div>`;
  }

  function enhance(card){
    const body=document.querySelector('#modalBody');
    if(!body||!card)return;
    const section=body.querySelector('[data-archive-overview-resolved="relations"]');
    if(!section)return;
    section.classList.add('archive-workspace-section','archive-related-section');
    section.innerHTML=relationSection(card);
  }

  window.addArchiveRelation=function(){
    const card=cardById(activeCardId);if(!card)return;
    const targetId=document.querySelector('#archiveRelationCard')?.value||'';
    if(!targetId){if(typeof toast==='function')toast('関連先のカードを選んでください');return;}
    const type=document.querySelector('#archiveRelationType')?.value||'関連';
    const memo=document.querySelector('#archiveRelationMemo')?.value.trim()||'';
    const reverse=document.querySelector('#archiveRelationReverse')?.checked!==false;
    const workspace=ensureWorkspace(card);
    const existing=workspace.relations.find(relation=>relation.cardId===targetId&&relation.type===type);
    if(existing)existing.memo=memo;
    else workspace.relations.push({cardId:targetId,type,memo,createdAt:nowText()});

    if(reverse){
      const target=cardById(targetId);
      if(target){
        const targetWorkspace=ensureWorkspace(target);
        const reverseExisting=targetWorkspace.relations.find(relation=>relation.cardId===card.id&&relation.type===type);
        if(reverseExisting)reverseExisting.memo=reverseExisting.memo||memo;
        else targetWorkspace.relations.push({cardId:card.id,type,memo,createdAt:nowText()});
        target.updatedAt=nowText();
      }
    }

    persist(card,'関連カードを追加');
    openStoryArchiveDetail(activeCardId);
  };

  window.removeArchiveRelation=function(index){
    const card=cardById(activeCardId);if(!card)return;
    const workspace=ensureWorkspace(card);
    const relation=workspace.relations[index];
    if(!relation)return;
    workspace.relations.splice(index,1);
    const target=cardById(relation.cardId);
    if(target){
      const targetWorkspace=ensureWorkspace(target);
      targetWorkspace.relations=targetWorkspace.relations.filter(item=>!(item.cardId===card.id&&item.type===relation.type));
      target.updatedAt=nowText();
    }
    persist(card,'関連カードを解除');
    openStoryArchiveDetail(activeCardId);
  };

  openStoryArchiveDetail=function(id,mode='all'){
    activeCardId=id;
    previousOpenStoryArchiveDetail(id,mode);
    enhance(cardById(id));
  };
})();