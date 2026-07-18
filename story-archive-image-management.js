/* Version 1.4.2: manage image roles without changing existing gallery data. */
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
    card.archiveWorkspace.imageManagement=card.archiveWorkspace.imageManagement&&typeof card.archiveWorkspace.imageManagement==='object'?card.archiveWorkspace.imageManagement:{};
    card.archiveWorkspace.imageManagement.items=card.archiveWorkspace.imageManagement.items&&typeof card.archiveWorkspace.imageManagement.items==='object'?card.archiveWorkspace.imageManagement.items:{};
    card.archiveWorkspace.changeHistory=Array.isArray(card.archiveWorkspace.changeHistory)?card.archiveWorkspace.changeHistory:[];
    return card.archiveWorkspace;
  }

  function images(card){
    const normalized=typeof normalizeStoryArchiveCard==='function'?normalizeStoryArchiveCard(card||{}):(card||{});
    return Array.isArray(normalized.images)?normalized.images:[];
  }

  function imageKey(image,index){
    return String(image?.id||image?.imageId||image?.fileName||image?.name||`image_${index}`);
  }

  function imageSource(image){
    return image?.dataUrl||image?.url||image?.src||image?.previewUrl||image?.thumbnailUrl||'';
  }

  function imageName(image,index){
    return image?.name||image?.title||image?.fileName||`画像 ${index+1}`;
  }

  function nowText(){
    try{return typeof now==='function'?now():new Date().toISOString()}catch(_){return new Date().toISOString()}
  }

  function persist(card){
    const workspace=ensureWorkspace(card);
    workspace.changeHistory.unshift({id:`workspace_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,message:'画像管理を更新',createdAt:nowText()});
    workspace.changeHistory=workspace.changeHistory.slice(0,100);
    card.updatedAt=nowText();
    if(typeof saveState==='function')saveState(true);
    else try{localStorage.setItem('novaStudioState',JSON.stringify(state))}catch(_){/* existing saveState is preferred */}
    if(typeof toast==='function')toast('画像管理を保存しました');
  }

  function imageCard(image,index,management){
    const key=imageKey(image,index);
    const saved=management.items[key]||{};
    const src=imageSource(image);
    const checked=value=>value?'checked':'';
    return `
      <article class="archive-image-manager-card" data-image-key="${esc(key)}">
        <div class="archive-image-manager-preview">${src?`<img src="${esc(src)}" alt="${esc(imageName(image,index))}">`:'画像'}</div>
        <div class="archive-image-manager-fields">
          <b>${esc(imageName(image,index))}</b>
          <label>画像セット名<input data-field="setName" value="${esc(saved.setName||'')}" placeholder="例：通常衣装・正面"></label>
          <div class="archive-image-manager-checks">
            <label><input type="radio" name="archiveRepresentative" data-field="representative" ${checked(management.representativeKey===key)}>代表画像</label>
            <label><input type="checkbox" data-field="official" ${checked(saved.official)}>正式採用</label>
            <label><input type="checkbox" data-field="favorite" ${checked(saved.favorite)}>お気に入り</label>
            <label><input type="checkbox" data-field="geminiReference" ${checked(saved.geminiReference)}>Gemini参照</label>
            <label><input type="checkbox" data-field="viduReference" ${checked(saved.viduReference)}>Vidu参照</label>
            <label><input type="checkbox" data-field="rejected" ${checked(saved.rejected)}>旧版・没画像</label>
          </div>
        </div>
      </article>`;
  }

  function section(card){
    const workspace=ensureWorkspace(card);
    const management=workspace.imageManagement;
    const list=images(card);
    const official=Object.values(management.items).filter(x=>x?.official).length;
    const gemini=Object.values(management.items).filter(x=>x?.geminiReference).length;
    const vidu=Object.values(management.items).filter(x=>x?.viduReference).length;
    return `
      <div class="archive-image-manager">
        <div class="archive-image-manager-head">
          <div><p class="eyebrow">入力・保存できます</p><h2>🖼 画像管理</h2></div>
          <span class="archive-workspace-ready">利用可能</span>
        </div>
        <div class="archive-image-manager-summary">
          <span>画像 ${list.length}枚</span><span>正式採用 ${official}枚</span><span>Gemini ${gemini}枚</span><span>Vidu ${vidu}枚</span>
        </div>
        <p class="archive-workspace-note">既存の画像は削除せず、用途と採用状態だけを整理します。</p>
        ${list.length?`<div class="archive-image-manager-list">${list.map((image,index)=>imageCard(image,index,management)).join('')}</div>`:'<div class="archive-image-manager-empty">画像を追加すると、ここで画像セットや参照用途を設定できます。</div>'}
        ${list.length?'<div class="archive-image-manager-actions"><button type="button" onclick="saveArchiveImageManagement()">画像管理を保存</button></div>':''}
      </div>`;
  }

  function enhance(card){
    const body=document.querySelector('#modalBody');
    if(!body||!card)return;
    const target=body.querySelector('[data-archive-overview-resolved="images"]');
    if(!target)return;
    const manager=document.createElement('section');
    manager.className='archive-overview-placeholder archive-workspace-section';
    manager.dataset.archiveImageManager='true';
    manager.innerHTML=section(card);
    target.insertAdjacentElement('beforebegin',manager);
  }

  window.saveArchiveImageManagement=function(){
    const card=cardById(activeCardId);if(!card)return;
    const management=ensureWorkspace(card).imageManagement;
    const nextItems={};
    let representativeKey='';
    document.querySelectorAll('[data-image-key]').forEach(node=>{
      const key=node.dataset.imageKey;
      const value=field=>node.querySelector(`[data-field="${field}"]`);
      nextItems[key]={
        setName:value('setName')?.value.trim()||'',
        official:!!value('official')?.checked,
        favorite:!!value('favorite')?.checked,
        geminiReference:!!value('geminiReference')?.checked,
        viduReference:!!value('viduReference')?.checked,
        rejected:!!value('rejected')?.checked
      };
      if(value('representative')?.checked)representativeKey=key;
    });
    management.items=nextItems;
    management.representativeKey=representativeKey;
    persist(card);
    openStoryArchiveDetail(activeCardId);
  };

  openStoryArchiveDetail=function(id,mode='all'){
    activeCardId=id;
    previousOpenStoryArchiveDetail(id,mode);
    enhance(cardById(id));
  };
})();
