/* Version 1.4.5: manage story materials without changing existing card data. */
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
    card.archiveWorkspace.storyMaterials=card.archiveWorkspace.storyMaterials&&typeof card.archiveWorkspace.storyMaterials==='object'?card.archiveWorkspace.storyMaterials:{};
    card.archiveWorkspace.changeHistory=Array.isArray(card.archiveWorkspace.changeHistory)?card.archiveWorkspace.changeHistory:[];
    return card.archiveWorkspace;
  }

  function nowText(){
    try{return typeof now==='function'?now():new Date().toISOString()}catch(_){return new Date().toISOString()}
  }

  function countFilled(materials){
    return ['plot','script','ideas','decisions','notes'].filter(key=>String(materials[key]||'').trim()).length;
  }

  function section(card){
    const materials=ensureWorkspace(card).storyMaterials;
    const filled=countFilled(materials);
    return `
      <div class="archive-story-workspace">
        <div class="archive-story-head">
          <div><p class="eyebrow">入力・保存できます</p><h2>📚 ストーリー資料</h2></div>
          <span class="archive-workspace-ready">利用可能</span>
        </div>
        <div class="archive-story-summary"><span>入力済み ${filled}/5</span><span>カード別資料</span></div>
        <p class="archive-workspace-note">このカードに関係する物語資料をまとめます。長文もそのまま保存できます。</p>
        <div class="archive-story-grid">
          <label class="archive-story-wide">プロット・概要<textarea id="archiveStoryPlot" rows="8" placeholder="この人物・場所・アイテムが物語で担う役割や流れ">${esc(materials.plot||'')}</textarea></label>
          <label class="archive-story-wide">台本・セリフ<textarea id="archiveStoryScript" rows="12" placeholder="関連する台本、セリフ、ナレーション">${esc(materials.script||'')}</textarea></label>
          <label>アイデア<textarea id="archiveStoryIdeas" rows="9" placeholder="検討中の展開や演出案">${esc(materials.ideas||'')}</textarea></label>
          <label>決定事項<textarea id="archiveStoryDecisions" rows="9" placeholder="物語上の確定事項">${esc(materials.decisions||'')}</textarea></label>
          <label class="archive-story-wide">制作メモ<textarea id="archiveStoryNotes" rows="7" placeholder="注意点、次に確認すること、出典など">${esc(materials.notes||'')}</textarea></label>
        </div>
        <div class="archive-story-actions"><button type="button" onclick="saveArchiveStoryMaterials()">ストーリー資料を保存</button></div>
      </div>`;
  }

  function enhance(card){
    const body=document.querySelector('#modalBody');
    if(!body||!card)return;
    const target=body.querySelector('[data-archive-overview-resolved="story"]');
    if(!target)return;
    target.classList.add('archive-workspace-section');
    target.innerHTML=section(card);
  }

  window.saveArchiveStoryMaterials=function(){
    const card=cardById(activeCardId);if(!card)return;
    const workspace=ensureWorkspace(card);
    workspace.storyMaterials={
      plot:document.querySelector('#archiveStoryPlot')?.value.trim()||'',
      script:document.querySelector('#archiveStoryScript')?.value.trim()||'',
      ideas:document.querySelector('#archiveStoryIdeas')?.value.trim()||'',
      decisions:document.querySelector('#archiveStoryDecisions')?.value.trim()||'',
      notes:document.querySelector('#archiveStoryNotes')?.value.trim()||''
    };
    workspace.changeHistory.unshift({id:`workspace_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,message:'ストーリー資料を更新',createdAt:nowText()});
    workspace.changeHistory=workspace.changeHistory.slice(0,100);
    card.updatedAt=nowText();
    if(typeof saveState==='function')saveState(true);
    else try{localStorage.setItem('novaStudioState',JSON.stringify(state))}catch(_){/* existing saveState is preferred */}
    if(typeof toast==='function')toast('ストーリー資料を保存しました');
    openStoryArchiveDetail(activeCardId);
  };

  openStoryArchiveDetail=function(id,mode='all'){
    activeCardId=id;
    previousOpenStoryArchiveDetail(id,mode);
    enhance(cardById(id));
  };
})();
