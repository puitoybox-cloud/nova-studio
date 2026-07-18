/* Version 1.4.0: place the full Story Archive feature map before detailed editing is expanded. */
(function(){
  if(typeof openStoryArchiveDetail!=='function')return;

  const previousOpenStoryArchiveDetail=openStoryArchiveDetail;
  const sectionDefinitions=[
    {key:'basic',icon:'📝',title:'基本設定',description:'名前・分類・説明・タグ・状態'},
    {key:'images',icon:'🖼',title:'画像管理',description:'代表画像・ギャラリー・画像セット・正式採用'},
    {key:'relations',icon:'🔗',title:'関連カード',description:'人物・場所・用語・アイテムを相互につなぐ'},
    {key:'timeline',icon:'🕰',title:'登場話・時系列',description:'登場する話数・シーン・年表を確認'},
    {key:'story',icon:'📚',title:'ストーリー資料',description:'台本・プロット・アイデア・決定事項'},
    {key:'gemini',icon:'✦',title:'Gemini制作',description:'参照画像・日本語／英語プロンプト・生成画像'},
    {key:'vidu',icon:'🎬',title:'Vidu制作',description:'参照画像・動画プロンプト・生成動画'},
    {key:'status',icon:'✅',title:'確定・未確定・没案',description:'採用状態を分けて管理'},
    {key:'history',icon:'📝',title:'変更履歴',description:'設定変更・画像差し替え・更新記録'}
  ];

  function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,char=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[char]));
  }

  function sectionTitle(section){
    return section.querySelector('h1,h2,h3,h4')?.textContent?.trim()||'';
  }

  function existingSectionFor(key,modalBody){
    const keywords={
      basic:['基本情報','基本設定','本文','詳細'],
      images:['画像ギャラリー','画像セット','画像'],
      relations:['関連カード','関連リンク','関連'],
      timeline:['登場話','時系列','年表'],
      story:['台本','プロット','アイデア','ストーリー'],
      history:['変更履歴','管理情報']
    }[key]||[];
    return [...modalBody.querySelectorAll('section,details')].find(section=>{
      const title=sectionTitle(section);
      return keywords.some(keyword=>title.includes(keyword));
    })||null;
  }

  function placeholderSection(definition){
    const section=document.createElement('section');
    section.className='archive-overview-placeholder';
    section.dataset.archiveOverviewSection=definition.key;
    section.innerHTML=`
      <div class="archive-overview-placeholder-head">
        <span class="archive-overview-placeholder-icon">${definition.icon}</span>
        <div><p class="eyebrow">配置済み</p><h2>${escapeHtml(definition.title)}</h2></div>
      </div>
      <p>${escapeHtml(definition.description)}</p>
      <p class="meta">この枠の編集機能は、全体配置の確認後に順番に追加します。</p>`;
    return section;
  }

  function buildHub(modalBody){
    modalBody.querySelector('.archive-overview-hub')?.remove();
    modalBody.querySelectorAll('[data-archive-overview-section]').forEach(section=>section.remove());

    const hub=document.createElement('section');
    hub.className='archive-overview-hub';
    hub.innerHTML=`
      <div class="archive-overview-heading">
        <div><p class="eyebrow">Story Archive 1.4</p><h2>このカードで管理するもの</h2></div>
        <span class="archive-overview-badge">全体機能配置版</span>
      </div>
      <p class="archive-overview-lead">先に全体の機能を並べ、あとから各機能の入力欄や操作を仕上げます。</p>
      <div class="archive-overview-grid">
        ${sectionDefinitions.map(definition=>`
          <button type="button" class="archive-overview-tile" data-archive-overview-target="${definition.key}">
            <span class="archive-overview-icon">${definition.icon}</span>
            <span><b>${escapeHtml(definition.title)}</b><small>${escapeHtml(definition.description)}</small></span>
          </button>`).join('')}
      </div>`;

    const hero=modalBody.querySelector('.archive-detail-hero');
    if(hero)hero.insertAdjacentElement('afterend',hub);
    else modalBody.prepend(hub);

    const insertionAnchor=[...modalBody.children].at(-1);
    sectionDefinitions.forEach(definition=>{
      let target=existingSectionFor(definition.key,modalBody);
      if(!target){
        target=placeholderSection(definition);
        if(insertionAnchor?.parentNode)insertionAnchor.parentNode.appendChild(target);
        else modalBody.appendChild(target);
      }
      target.dataset.archiveOverviewResolved=definition.key;
    });

    hub.addEventListener('click',event=>{
      const button=event.target.closest('[data-archive-overview-target]');
      if(!button)return;
      const target=modalBody.querySelector(`[data-archive-overview-resolved="${button.dataset.archiveOverviewTarget}"]`);
      target?.scrollIntoView({behavior:'smooth',block:'start'});
    });
  }

  openStoryArchiveDetail=function(id,mode='all'){
    previousOpenStoryArchiveDetail(id,mode);
    const modalBody=document.querySelector('#modalBody');
    if(!modalBody)return;
    buildHub(modalBody);
  };
})();
