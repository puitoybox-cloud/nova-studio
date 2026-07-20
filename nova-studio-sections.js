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
    {group:'system',icon:'🏛️',title:'Dream Architect Studio',description:'映像・漫画・音楽などの制作アプリをまとめたスタジオです。',status:'complete',action:"setView('dream-architect')"}
  ];
  const DREAM_STATUS={existing:'利用可能',available:'利用可能',priority:'優先制作',preparing:'準備中',planned:'未実装',review:'確認待ち'};
  const DREAM_GROUPS=[
    {id:'video',icon:'🎬',label:'映像・アニメ',description:'企画からプロンプト、進行管理、動画制作まで。'},
    {id:'music',icon:'🎵',label:'音楽・音声',description:'楽曲、MIDI、歌詞、ボイスを扱う制作入口。'},
    {id:'art',icon:'🎨',label:'イラスト・漫画',description:'画像、漫画、LINEスタンプの制作入口。'},
    {id:'publish',icon:'🌐',label:'公開・Web',description:'作品を届けるためのWeb制作入口。'},
    {id:'ai',icon:'🤖',label:'AI・プロンプト',description:'制作で使うプロンプトの整理と今後の拡張。'}
  ];
  const DREAM_APPS=[
    {id:'ai-anime',group:'video',icon:'🎬',title:'AIアニメ制作',description:'AIアニメの制作工程をまとめて進めます。',status:'available',integration:'Nova Studio連携あり',action:'openProductionDashboard()',features:['制作工程管理','Scene進捗確認','完成状況の確認']},
    {id:'production-dashboard',group:'video',icon:'📊',title:'Production Dashboard',description:'作品と話数の進行状況を確認します。',status:'available',integration:'Nova Studio連携あり',action:'openProductionDashboard()',features:['制作工程管理','Scene進捗確認','完成状況の確認']},
    {id:'prompt-studio',group:'video',icon:'✨',title:'Prompt Studio',description:'映像生成用のプロンプトを整えます。',status:'available',integration:'Nova Studio連携あり',action:"openApp('promptStudio')",features:['日本語・英語プロンプト','キャラクター設定参照','テンプレート管理']},
    {id:'video',group:'video',icon:'🎞️',title:'動画制作',description:'編集工程と動画素材を扱う制作入口です。',status:'preparing',integration:'Nova Studio連携準備中',route:'dream-video',features:['素材整理','編集工程管理','完成動画候補の確認']},
    {id:'music-studio',group:'music',icon:'🎵',title:'Music Studio',description:'音楽と音声の制作をまとめて進めます。',status:'priority',priority:true,integration:'Nova Studio連携あり',action:"openApp('musicStudio')",features:['楽曲構成と制作メモ','Logic Pro作業の整理','MIDI・歌詞制作への移動']},
    {id:'midi-composer',group:'music',icon:'🎹',title:'MIDI Composer',description:'既存のMusic StudioでMIDI制作を支援します。',status:'priority',priority:true,integration:'Nova Studio連携あり',action:"openApp('musicStudio')",features:['MIDI内容の確認','作品・話数との紐付け','Logic Pro向け制作準備']},
    {id:'lyrics-notes',group:'music',icon:'🎼',title:'歌詞・音符割付',description:'既存のMusic Studioで歌詞の変換と音符への割付を行います。',status:'existing',priority:true,integration:'Nova Studio連携あり',action:"openApp('musicStudio')",features:['歌詞のひらがな変換','音符への歌詞割付','MIDI確認']},
    {id:'music-production',group:'music',icon:'🎚️',title:'音楽制作支援',description:'楽曲の構想、Logic Pro作業、制作メモを支援します。',status:'priority',priority:true,integration:'Nova Studio連携あり',action:"openApp('musicStudio')",features:['楽曲構成と制作メモ','Logic Pro作業の整理','MIDI・歌詞制作への移動']},
    {id:'voice',group:'music',icon:'🎙️',title:'Voice Studio',description:'台詞、ナレーション、音声素材を扱う制作入口です。',status:'planned',integration:'Nova Studio連携予定',route:'dream-voice',features:['台詞リスト','声の方向性管理','音声素材候補の確認']},
    {id:'image',group:'art',icon:'🖼️',title:'画像制作',description:'参照画像と制作画像を扱うワークスペースを準備中です。',status:'preparing',integration:'Nova Studio連携準備中',route:'dream-image',features:['参照画像選択','画像制作メモ','制作結果候補の受取']},
    {id:'comic',group:'art',icon:'📖',title:'漫画制作',description:'コマ、台詞、ページ構成を扱う制作室を予定しています。',status:'planned',integration:'Nova Studio連携予定',route:'dream-comic',features:['ページ構成','コマ割り','台詞と素材の配置']},
    {id:'line-stickers',group:'art',icon:'💬',title:'LINEスタンプ制作',description:'スタンプ案と書き出し準備を管理する予定です。',status:'planned',integration:'Nova Studio連携予定',route:'dream-line-stickers',features:['スタンプ案一覧','表情と台詞管理','書き出しチェック']},
    {id:'website',group:'publish',icon:'🌐',title:'ホームページ制作',description:'作品公開用ページを制作するワークスペースを予定しています。',status:'planned',integration:'Nova Studio連携予定',route:'dream-website',features:['ページ構成','作品情報の配置','公開前チェック']},
    {id:'prompt-management',group:'ai',icon:'🗂️',title:'プロンプト管理',description:'用途別プロンプトを横断管理する制作入口です。',status:'preparing',integration:'Nova Studio連携準備中',route:'dream-prompt-management',features:['プロンプト一覧','用途別分類','作品・話数との紐付け']},
    {id:'future',group:'ai',icon:'＋',title:'今後追加予定',description:'新しい制作アプリを安全に追加するための予約入口です。',status:'review',integration:'接続仕様確認待ち',route:'dream-future-apps',features:['追加候補の整理','連携範囲の確認','安全な起動方式の決定']}
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
  function safeStoredJson(key){try{const raw=localStorage.getItem(key);return raw?{value:JSON.parse(raw),invalid:false}:{value:null,invalid:false}}catch{return{value:null,invalid:true}}}
  function dreamContext(){
    const v2=safeStoredJson('novaStudio_dreamArchitectLink_v2'),v1=safeStoredJson('novaStudio_dreamArchitectLink_v1'),results=safeStoredJson('novaStudio_dreamArchitectResults_v1');
    const transfer=v2.value&&typeof v2.value==='object'&&!Array.isArray(v2.value)?v2.value:(v1.value&&typeof v1.value==='object'&&!Array.isArray(v1.value)?v1.value:null);
    const project=transfer?.project||{};const episode=transfer?.episode||{};const activeProject=typeof currentProject==='function'?currentProject():null;const activeEpisode=typeof currentEpisode==='function'?currentEpisode():null;
    const resultItems=Array.isArray(results.value)?results.value:Array.isArray(results.value?.items)?results.value.items:[];
    const productionStatus=episode.productionStatus||episode.production?.status||episode.status||activeEpisode?.productionStatus||activeEpisode?.production?.status||activeEpisode?.status||project.productionStatus||project.status||activeProject?.productionStatus||activeProject?.status||'制作中';
    return {projectName:String(project.name||transfer?.projectName||activeProject?.title||''),projectId:String(project.id||transfer?.projectId||activeProject?.id||''),episodeName:String(episode.name||activeEpisode?.numberLabel||''),episodeId:String(episode.id||transfer?.episodeId||activeEpisode?.id||''),productionStatus:String(productionStatus),characters:Array.isArray(transfer?.characters)?transfer.characters.length:0,assets:Array.isArray(transfer?.assets)?transfer.assets.length:0,results:resultItems.length,invalid:v2.invalid||v1.invalid||results.invalid,shared:Boolean(transfer)};
  }
  function dreamStatusBadge(status){return `<span class="dream-status is-${status}">${esc(DREAM_STATUS[status]||status)}</span>`}
  function dreamAppCard(item){const action=item.action||`setView('${item.route}')`;const live=Boolean(item.action);const priorityClass=item.priority&&item.status!=='priority'?' is-priority':'';return `<article class="dream-app-card is-${item.status}${priorityClass}" data-dream-app-id="${esc(item.id)}"><div class="nova-section-card-top"><span class="nova-section-icon" aria-hidden="true">${item.icon}</span>${dreamStatusBadge(item.status)}</div><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><dl><div><dt>状態</dt><dd>${esc(DREAM_STATUS[item.status])}</dd></div><div><dt>連携</dt><dd>${esc(item.integration)}</dd></div></dl><button class="${live?'primary-action':'secondary'}" onclick="${action}">${live?'開く':'準備中画面を開く'}</button></article>`}
  function dreamContextPanel(ctx){const selected=ctx.projectId||ctx.projectName;return `<section class="dream-context home-panel" aria-labelledby="dreamContextTitle"><div class="section-head"><div><p class="eyebrow">Current Production</p><h2 id="dreamContextTitle">現在の制作</h2></div><button class="secondary" onclick="setView('dream-architect-link')">共有内容を確認</button></div>${selected?`<dl class="dream-context-grid"><div><dt>作品名</dt><dd>${esc(ctx.projectName||'名称未設定')}</dd></div><div><dt>話数</dt><dd>${esc(ctx.episodeName||ctx.episodeId||'未選択')}</dd></div><div class="is-status"><dt>制作状況</dt><dd>${esc(ctx.productionStatus)}</dd></div></dl><p class="dream-context-meta">作品ID：${esc(ctx.projectId||'未設定')} ／ 共有キャラクター ${ctx.characters}件 ／ 共有素材 ${ctx.assets}件 ／ 受け取り候補 ${ctx.results}件</p>`:'<p class="dream-empty-note">Nova Studioから作品が選択されていません。Nova Studioで作品を選び、必要に応じて共有内容を準備してください。</p>'}${ctx.invalid?'<p class="dream-warning" role="status">一部の共有データを読み取れませんでした。既存データは変更せず、安全な値で表示しています。</p>':''}</section>`}
  function dreamQuickNav(){return `<nav class="dream-quick-nav home-panel" aria-label="主要ナビゲーション"><p class="eyebrow">Quick Access</p><div><button class="dream-nav-home" onclick="novaReturnHome()">← Nova Studioへ戻る</button><button onclick="openStoryArchive()">Story Archive</button><button onclick="openProductionDashboard()">Production Dashboard</button><button onclick="openApp('musicStudio')">Music Studio</button><button onclick="openApp('promptStudio')">Prompt Studio</button></div></nav>`}
  function dreamArchitectView(){const ctx=dreamContext();const externalConfigured=(state?.apps||[]).some(app=>['productionDashboard','promptStudio','musicStudio'].includes(app.id)&&app.url);return `<main class="dream-architect-home" aria-label="Dream Architect Studio"><header class="dream-architect-hero"><div><p class="eyebrow">Creative Room</p><h1>Dream Architect Studio</h1><p>制作アプリを目的ごとにまとめた、あなたの制作室です。</p></div><button class="secondary" onclick="novaReturnHome()">← Nova Studioへ戻る</button></header>${dreamContextPanel(ctx)}${dreamQuickNav()}${externalConfigured?'':`<aside class="dream-connection-note" role="status"><b>外部アプリは未接続です</b><span>登録URLを推測して開くことはありません。既存の内部画面は利用でき、外部接続先はNova Studioの設定から登録できます。</span><button class="secondary" onclick="setView('settings')">接続設定を確認</button></aside>`}<section class="home-panel dream-apps-panel"><div class="section-head"><div><p class="eyebrow">Creative Apps</p><h2>制作アプリ</h2><p class="meta">目的に合うカテゴリから制作室を選んでください。</p></div></div><div class="dream-groups">${DREAM_GROUPS.map(group=>`<section class="dream-group" aria-labelledby="dream-group-${group.id}"><div class="dream-group-heading"><div><p class="eyebrow">${String(DREAM_APPS.filter(app=>app.group===group.id).length).padStart(2,'0')} Apps</p><h2 id="dream-group-${group.id}"><span aria-hidden="true">${group.icon}</span> ${esc(group.label)}</h2></div><p>${esc(group.description)}</p></div><div class="dream-app-grid">${DREAM_APPS.filter(app=>app.group===group.id).map(dreamAppCard).join('')}</div></section>`).join('')}</div></section></main>`}
  function dreamPlaceholderView(route){const item=DREAM_APPS.find(app=>app.route===route);if(!item)return '';const ctx=dreamContext();return `<main class="dream-placeholder-shell"><section class="home-panel nova-placeholder dream-placeholder"><button class="dream-back-link secondary" onclick="history.length>1?history.back():setView('dream-architect')">← 戻る</button><div class="nova-placeholder-title"><span class="nova-section-icon" aria-hidden="true">${item.icon}</span><div><p class="eyebrow">Dream Architect Studio</p><div class="nova-section-heading"><h1>${esc(item.title)}</h1>${dreamStatusBadge(item.status)}</div></div></div><p>${esc(item.description)}</p><dl class="dream-placeholder-context"><div><dt>現在の状態</dt><dd>${esc(DREAM_STATUS[item.status])}</dd></div><div><dt>Nova Studioの作品</dt><dd>${esc(ctx.projectName||'未選択')}</dd></div></dl><section><h2>今後追加予定の主な機能</h2><ul>${item.features.map(feature=>`<li>${esc(feature)}</li>`).join('')}</ul></section><p class="meta">この準備中画面は既存データ、localStorage、JSONバックアップを変更しません。</p><div class="nova-placeholder-actions"><button class="primary-action" onclick="setView('dream-architect')">Dream Architect Studioホームへ戻る</button><button class="secondary" onclick="novaReturnHome()">Nova Studioへ戻る</button></div></section></main>`}

  const baseHomeView=window.homeView;
  if(typeof baseHomeView==='function')window.homeView=function(){return insertSections(baseHomeView())};
  const baseManagementViewForRoute=window.managementViewForRoute;
  if(typeof baseManagementViewForRoute==='function')window.managementViewForRoute=function(route){
    if(route==='dream-architect')return dreamArchitectView();
    if(route.startsWith('dream-'))return dreamPlaceholderView(route);
    if(['locations','items','images','scripts','gemini'].includes(route))return placeholderView(route);
    if(route==='ns-conflicts')return conflictsView();
    return baseManagementViewForRoute(route);
  };
  window.NOVA_STUDIO_SECTIONS=SECTIONS.map(item=>({...item}));
  window.DREAM_ARCHITECT_APPS=DREAM_APPS.map(item=>({...item}));
  window.addEventListener('hashchange',function renderNovaStudioSectionRoute(){
    const route=(location.hash||'').slice(1);
    if(route==='dream-architect'||route.startsWith('dream-')||['locations','items','images','scripts','gemini','ns-conflicts'].includes(route))render?.();
  });
  render?.();
})();
