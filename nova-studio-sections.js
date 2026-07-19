/* NS-02–NS-05: top-level sections without changing persisted data. */
(function(){
  const STATUS={available:'利用可能',working:'作業中',planned:'未実装'};
  const SECTIONS=[
    {title:'作品・設定管理',description:'作品、話数、Scene、キャラクター、世界観、用語、年表を管理します。',status:'available',action:"setView('projects')"},
    {title:'Story Archive',description:'物語の設定カード、画像資料、関連情報を確認・編集します。',status:'available',action:'openStoryArchive()'},
    {title:'素材・資料管理',description:'登録済みの画像、動画、アイデアなどをカード形式で確認します。',status:'working',action:"setView('cards')"},
    {title:'Memory Sync',description:'JSONの差分を確認し、バックアップ後にStory Archiveへ反映します。',status:'available',action:'openMemorySync()'},
    {title:'制作進捗',description:'作品、話数、Scene、タスクの現在の進み具合を確認します。',status:'working',action:"setView('progress')"},
    {title:'矛盾検出',description:'登録済みデータから重複、順序、未関連データの候補を確認します。',status:'working',action:"setView('ns-conflicts')"},
    {title:'ノヴァに相談',description:'制作状況を整理し、検索、相談用文章、次の作業候補を確認します。',status:'working',action:"setView('consult')"},
    {title:'バックアップ',description:'Nova Studio全体のJSON書き出しと読み込みを行います。',status:'available',action:"setView('backup')"},
    {title:'Dream Architect Studioを開く',description:'Dream Architect Studioとの連携入口です。',status:'planned',action:"setView('dream-architect')"}
  ];
  function statusBadge(status){return `<span class="nova-section-status is-${status}">${STATUS[status]}</span>`}
  function sectionCards(){return `<section class="home-panel nova-sections" aria-labelledby="novaSectionsTitle"><div class="section-head"><div><p class="eyebrow">Nova Studio</p><h2 id="novaSectionsTitle">制作メニュー</h2><p class="meta">既存機能をそのまま利用しながら、Nova Studio全体へ移動できます。</p></div></div><div class="nova-sections-grid">${SECTIONS.map(item=>`<article class="nova-section-card is-${item.status}"><div class="nova-section-heading"><h3>${esc(item.title)}</h3>${statusBadge(item.status)}</div><p>${esc(item.description)}</p><button class="${item.status==='available'?'primary-action':'secondary'}" onclick="${item.action}">${item.status==='planned'?'準備中ページを見る':'開く'}</button></article>`).join('')}</div><div class="nova-status-legend" aria-label="状態表示">${Object.entries(STATUS).map(([key,label])=>`<span>${statusBadge(key)} ${label==='利用可能'?'既存ページを利用できます':label==='作業中'?'既存機能を使いながら拡張中です':'入口のみで、機能は準備中です'}</span>`).join('')}</div></section>`}
  function insertSections(html){if(!html||html.includes('id="novaSectionsTitle"'))return html;const section=sectionCards();return html.includes('</main>')?html.replace('</main>',`${section}</main>`):`${html}${section}`}
  function pendingView(){return `<section class="home-panel nova-placeholder"><p class="eyebrow">準備中</p><div class="nova-section-heading"><h1>Dream Architect Studio</h1>${statusBadge('planned')}</div><p>作品世界の設計を支援する制作スタジオを追加予定です。</p><p class="meta">既存機能や保存データを変更せず、今後この入口へ接続します。</p><div class="nova-placeholder-actions"><button class="primary-action" onclick="novaReturnHome()">ホームへ戻る</button><button class="secondary" onclick="history.back()">前の画面へ戻る</button></div></section>`}
  function conflictsView(){const content=typeof novaConflictsHtml==='function'?novaConflictsHtml():'<p class="empty-note">矛盾検出は準備中です。</p>';return `<section class="home-panel nova-placeholder"><p class="eyebrow">Consistency Check</p><div class="nova-section-heading"><h1>矛盾検出</h1>${statusBadge('working')}</div><p>現在登録されているデータを変更せず、確認候補だけを表示します。</p><section><h2>確認候補</h2>${content}</section><div class="nova-placeholder-actions"><button class="primary-action" onclick="novaReturnHome()">ホームへ戻る</button><button class="secondary" onclick="history.back()">前の画面へ戻る</button></div></section>`}
  const baseHomeView=window.homeView;
  if(typeof baseHomeView==='function')window.homeView=function(){return insertSections(baseHomeView())};
  const baseManagementViewForRoute=window.managementViewForRoute;
  if(typeof baseManagementViewForRoute==='function')window.managementViewForRoute=function(route){if(route==='dream-architect')return pendingView();if(route==='ns-conflicts')return conflictsView();return baseManagementViewForRoute(route)};
  window.NOVA_STUDIO_SECTIONS=SECTIONS.map(item=>({...item}));
  render?.();
})();
