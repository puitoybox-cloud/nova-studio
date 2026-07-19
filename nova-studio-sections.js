/* Nova Studio top-level framework. Adds routes and entry points without changing persisted data. */
(function(){
  const STATUS={complete:'完成済み',working:'作業中',planned:'未実装'};
  const STATUS_HELP={complete:'現在の機能を利用できます',working:'入口を先行整備しています',planned:'今後の実装予定です'};
  const GROUPS=[
    {id:'story',label:'物語と世界',description:'物語の記憶、登場人物、世界設定を整理します。'},
    {id:'create',label:'制作素材',description:'制作に使う素材、台本、アイデアへ移動します。'},
    {id:'assist',label:'制作アシスト',description:'検索、同期、AI連携の入口をまとめます。'},
    {id:'system',label:'Studio管理',description:'保存、環境設定、外部スタジオを管理します。'}
  ];
  const SECTIONS=[
    {group:'story',icon:'📚',title:'Story Archive',description:'設定カードと画像資料を確認・編集します。',status:'complete',action:'openStoryArchive()'},
    {group:'story',icon:'👤',title:'Characters',description:'登場人物のプロフィールと設定を管理します。',status:'complete',action:"setView('characters')"},
    {group:'story',icon:'🌌',title:'World',description:'作品世界のルールと背景設定を管理します。',status:'complete',action:"setView('worlds')"},
    {group:'story',icon:'🗓️',title:'Timeline',description:'出来事と物語の時系列を整理します。',status:'complete',action:"setView('timelines')"},
    {group:'story',icon:'📍',title:'Locations',description:'場所設定の専用画面を準備中です。',status:'working',action:"setView('locations')"},
    {group:'story',icon:'🗝️',title:'Items',description:'小物・重要アイテムの専用画面を準備中です。',status:'working',action:"setView('items')"},
    {group:'story',icon:'📖',title:'Terminology',description:'固有名詞と用語の定義を管理します。',status:'complete',action:"setView('terms')"},
    {group:'create',icon:'🖼️',title:'Images',description:'画像素材の専用一覧を準備中です。',status:'working',action:"setView('images')"},
    {group:'create',icon:'🎬',title:'Scripts',description:'Sceneから台本制作へ進む入口です。',status:'working',action:"setView('scripts')"},
    {group:'create',icon:'💡',title:'Ideas',description:'制作アイデアを記録・整理します。',status:'complete',action:"setView('ideas')"},
    {group:'assist',icon:'🔎',title:'Search',description:'Studio内の登録情報を横断検索します。',status:'complete',action:"setView('search')"},
    {group:'assist',icon:'🔄',title:'Memory Sync',description:'差分を確認してStory Archiveへ安全に反映します。',status:'complete',action:'openMemorySync()'},
    {group:'assist',icon:'✦',title:'Gemini',description:'Gemini連携の入口です。',status:'planned',action:"setView('gemini')"},
    {group:'system',icon:'💾',title:'Backup',description:'Studio全体のJSON書き出しと読み込みを行います。',status:'complete',action:"setView('backup')"},
    {group:'system',icon:'⚙️',title:'Settings',description:'表示と外部アプリの設定を管理します。',status:'complete',action:"setView('settings')"},
    {group:'system',icon:'🏛️',title:'Dream Architect Studio',description:'作品世界を設計する外部スタジオの入口です。',status:'planned',action:"setView('dream-architect')"}
  ];

  function statusBadge(status){return `<span class="nova-section-status is-${status}">${STATUS[status]}</span>`}
  function statusSummary(){return `<div class="nova-status-summary" aria-label="機能の実装状況">${Object.keys(STATUS).map(status=>{const count=SECTIONS.filter(item=>item.status===status).length;return `<div class="is-${status}"><b>${count}</b><span>${STATUS[status]}</span><small>${STATUS_HELP[status]}</small></div>`}).join('')}</div>`}
  function sectionCard(item){return `<article class="nova-section-card is-${item.status}"><div class="nova-section-card-top"><span class="nova-section-icon" aria-hidden="true">${item.icon}</span>${statusBadge(item.status)}</div><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><button class="${item.status==='complete'?'primary-action':'secondary'}" onclick="${item.action}">${item.status==='complete'?'開く':item.status==='working'?'入口を見る':'準備中ページを見る'}</button></article>`}
  function sectionCards(){return `<section class="home-panel nova-sections" aria-labelledby="novaSectionsTitle"><div class="section-head nova-sections-head"><div><p class="eyebrow">All Features</p><h2 id="novaSectionsTitle">Nova Studio 機能一覧</h2><p class="meta">全機能の入口と現在の実装状況を、ひとつのホームで確認できます。</p></div></div>${statusSummary()}<div class="nova-feature-groups">${GROUPS.map(group=>{const items=SECTIONS.filter(item=>item.group===group.id);return `<section class="nova-feature-group" aria-labelledby="novaGroup-${group.id}"><div class="nova-group-heading"><div><p class="eyebrow">${String(items.length).padStart(2,'0')} Features</p><h3 id="novaGroup-${group.id}">${esc(group.label)}</h3></div><p>${esc(group.description)}</p></div><div class="nova-sections-grid">${items.map(sectionCard).join('')}</div></section>`}).join('')}</div><div class="nova-status-legend" aria-label="状態表示">${Object.keys(STATUS).map(status=>`<span>${statusBadge(status)} ${STATUS_HELP[status]}</span>`).join('')}</div></section>`}
  function insertSections(html){if(!html||html.includes('id="novaSectionsTitle"'))return html;const section=sectionCards();return html.includes('</main>')?html.replace('</main>',`${section}</main>`):`${html}${section}`}
  function placeholderView(route){
    const item=SECTIONS.find(section=>section.action.includes(`'${route}'`));
    if(!item)return '';
    const related={locations:{label:'Story Archiveを開く',action:'openStoryArchive()'},items:{label:'Story Archiveを開く',action:'openStoryArchive()'},images:{label:'素材カードを開く',action:"setView('cards')"},scripts:{label:'Sceneを開く',action:"setView('scenes')"}}[route];
    return `<section class="home-panel nova-placeholder"><div class="nova-placeholder-title"><span class="nova-section-icon" aria-hidden="true">${item.icon}</span><div><p class="eyebrow">Nova Studio Feature</p><div class="nova-section-heading"><h1>${esc(item.title)}</h1>${statusBadge(item.status)}</div></div></div><p>${esc(item.description)}</p><p class="meta">この入口はNova Studio全体の画面構成を先に揃えるために用意されています。既存の保存データやlocalStorageは変更しません。</p><div class="nova-placeholder-actions">${related?`<button class="primary-action" onclick="${related.action}">${related.label}</button>`:''}<button class="${related?'secondary':'primary-action'}" onclick="novaReturnHome()">ホームへ戻る</button></div></section>`
  }
  function conflictsView(){const content=typeof novaConflictsHtml==='function'?novaConflictsHtml():'<p class="empty-note">矛盾検出は準備中です。</p>';return `<section class="home-panel nova-placeholder"><p class="eyebrow">Consistency Check</p><div class="nova-section-heading"><h1>矛盾検出</h1>${statusBadge('working')}</div><p>現在登録されているデータを変更せず、確認候補だけを表示します。</p><section><h2>確認候補</h2>${content}</section><div class="nova-placeholder-actions"><button class="primary-action" onclick="novaReturnHome()">ホームへ戻る</button><button class="secondary" onclick="history.back()">前の画面へ戻る</button></div></section>`}

  const baseHomeView=window.homeView;
  if(typeof baseHomeView==='function')window.homeView=function(){return insertSections(baseHomeView())};
  const baseManagementViewForRoute=window.managementViewForRoute;
  if(typeof baseManagementViewForRoute==='function')window.managementViewForRoute=function(route){
    if(['locations','items','images','scripts','gemini','dream-architect'].includes(route))return placeholderView(route);
    if(route==='ns-conflicts')return conflictsView();
    return baseManagementViewForRoute(route);
  };
  window.NOVA_STUDIO_SECTIONS=SECTIONS.map(item=>({...item}));
  render?.();
})();
