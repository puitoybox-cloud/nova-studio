/* Version 1.4.1: make Basic Settings and Decision Status usable without changing existing card storage. */
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
    card.archiveWorkspace.basic=card.archiveWorkspace.basic&&typeof card.archiveWorkspace.basic==='object'?card.archiveWorkspace.basic:{};
    card.archiveWorkspace.decisions=card.archiveWorkspace.decisions&&typeof card.archiveWorkspace.decisions==='object'?card.archiveWorkspace.decisions:{};
    card.archiveWorkspace.changeHistory=Array.isArray(card.archiveWorkspace.changeHistory)?card.archiveWorkspace.changeHistory:[];
    return card.archiveWorkspace;
  }

  function lines(value){
    return Array.isArray(value)?value:String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  }

  function nowText(){
    try{return typeof now==='function'?now():new Date().toISOString()}catch(_){return new Date().toISOString()}
  }

  function persist(card,message){
    const workspace=ensureWorkspace(card);
    workspace.changeHistory.unshift({id:`workspace_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,message,createdAt:nowText()});
    workspace.changeHistory=workspace.changeHistory.slice(0,100);
    card.updatedAt=nowText();
    if(typeof saveState==='function')saveState(true);
    else try{localStorage.setItem('novaStudioState',JSON.stringify(state))}catch(_){/* existing saveState is preferred */}
    if(typeof toast==='function')toast('保存しました');
  }

  function basicSection(card){
    const workspace=ensureWorkspace(card);
    const basic=workspace.basic;
    const title=basic.title??card.title??card.name??'';
    const category=basic.category??card.category??card.cardType??'';
    const description=basic.description??card.description??card.body??card.memo??'';
    const tags=(basic.tags??card.tags??[]);
    const status=basic.status??card.status??'未確定';
    return `
      <div class="archive-workspace-head">
        <div><p class="eyebrow">入力・保存できます</p><h2>📝 基本設定</h2></div>
        <span class="archive-workspace-ready">利用可能</span>
      </div>
      <div class="archive-workspace-form">
        <label>名前・タイトル<input id="archiveBasicTitle" value="${esc(title)}" placeholder="例：ティア"></label>
        <label>分類<input id="archiveBasicCategory" value="${esc(category)}" placeholder="例：キャラクター、場所、アイテム"></label>
        <label class="archive-workspace-wide">説明<textarea id="archiveBasicDescription" rows="6" placeholder="設定や特徴を入力">${esc(description)}</textarea></label>
        <label class="archive-workspace-wide">タグ（カンマ区切り）<input id="archiveBasicTags" value="${esc(Array.isArray(tags)?tags.join(', '):tags)}" placeholder="主人公, 正式設定"></label>
        <label>状態<select id="archiveBasicStatus">
          ${['確定','未確定','要確認','旧設定','没案'].map(option=>`<option ${status===option?'selected':''}>${option}</option>`).join('')}
        </select></label>
      </div>
      <div class="archive-workspace-actions"><button type="button" onclick="saveArchiveBasicSettings()">基本設定を保存</button></div>`;
  }

  function decisionColumn(title,key,value,placeholder){
    return `<label class="archive-decision-column"><b>${title}</b><small>1行につき1項目</small><textarea id="archiveDecision_${key}" rows="9" placeholder="${esc(placeholder)}">${esc(lines(value).join('\n'))}</textarea></label>`;
  }

  function statusSection(card){
    const decisions=ensureWorkspace(card).decisions;
    return `
      <div class="archive-workspace-head">
        <div><p class="eyebrow">採用状態を整理</p><h2>✅ 確定・未確定・没案</h2></div>
        <span class="archive-workspace-ready">利用可能</span>
      </div>
      <p class="archive-workspace-note">決まった設定、まだ検討中の設定、使わない案を分けて残せます。</p>
      <div class="archive-decision-grid">
        ${decisionColumn('確定','confirmed',decisions.confirmed,'例：瞳の中の星は必須')}
        ${decisionColumn('未確定','undecided',decisions.undecided,'例：別衣装の色を検討中')}
        ${decisionColumn('没案','rejected',decisions.rejected,'例：初期デザイン案')}
      </div>
      <div class="archive-workspace-actions"><button type="button" onclick="saveArchiveDecisionStatus()">採用状態を保存</button></div>`;
  }

  function enhance(card){
    const body=document.querySelector('#modalBody');
    if(!body||!card)return;
    const basic=body.querySelector('[data-archive-overview-resolved="basic"]');
    const status=body.querySelector('[data-archive-overview-resolved="status"]');
    if(basic){basic.classList.add('archive-workspace-section');basic.innerHTML=basicSection(card)}
    if(status){status.classList.add('archive-workspace-section');status.innerHTML=statusSection(card)}
  }

  window.saveArchiveBasicSettings=function(){
    const card=cardById(activeCardId);if(!card)return;
    const workspace=ensureWorkspace(card);
    const title=document.querySelector('#archiveBasicTitle')?.value.trim()||'';
    const category=document.querySelector('#archiveBasicCategory')?.value.trim()||'';
    const description=document.querySelector('#archiveBasicDescription')?.value.trim()||'';
    const tags=String(document.querySelector('#archiveBasicTags')?.value||'').split(',').map(x=>x.trim()).filter((x,i,a)=>x&&a.indexOf(x)===i);
    const status=document.querySelector('#archiveBasicStatus')?.value||'未確定';
    workspace.basic={title,category,description,tags,status};
    if(title){card.title=title;if('name' in card)card.name=title}
    card.category=category;
    card.description=description;
    card.tags=tags;
    card.status=status;
    persist(card,'基本設定を更新');
    openStoryArchiveDetail(activeCardId);
  };

  window.saveArchiveDecisionStatus=function(){
    const card=cardById(activeCardId);if(!card)return;
    const workspace=ensureWorkspace(card);
    workspace.decisions={
      confirmed:lines(document.querySelector('#archiveDecision_confirmed')?.value),
      undecided:lines(document.querySelector('#archiveDecision_undecided')?.value),
      rejected:lines(document.querySelector('#archiveDecision_rejected')?.value)
    };
    persist(card,'確定・未確定・没案を更新');
    openStoryArchiveDetail(activeCardId);
  };

  openStoryArchiveDetail=function(id,mode='all'){
    activeCardId=id;
    previousOpenStoryArchiveDetail(id,mode);
    enhance(cardById(id));
  };
})();
