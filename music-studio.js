/* MS-01: isolated Music Studio home and safe placeholder routes. */
(function(root){
  'use strict';

  const HOME_ROUTE='music-studio';
  const STATUS_LABELS={available:'使用可能',working:'作業中',planned:'未実装'};
  const FEATURES=[
    {id:'new-project',icon:'＋',title:'新しい音楽プロジェクト',description:'曲名や制作目的を決めて、新しい制作を始める入口です。',status:'working'},
    {id:'recent-projects',icon:'◷',title:'最近使ったプロジェクト',description:'最近編集したMusic Studioプロジェクトへ戻る一覧です。',status:'working'},
    {id:'logic-pro',icon:'LP',title:'Logic Pro X連携',description:'Logic Pro Xとのファイル受け渡しと制作手順を管理します。',status:'planned'},
    {id:'midi-composer',icon:'♬',title:'MIDI Composer',description:'メロディや伴奏のMIDI制作を支援します。',status:'planned'},
    {id:'lyrics-notes',icon:'あ',title:'歌詞・音符割付',description:'歌詞の読みと音符の対応を確認・調整します。',status:'planned'},
    {id:'ai-import',icon:'AI',title:'AI作曲データ取り込み',description:'AI作曲サービスの出力を確認して複製取り込みします。',status:'planned'},
    {id:'instrument-midi',icon:'Pf',title:'楽器別MIDI',description:'パートと楽器ごとにMIDI素材を整理します。',status:'planned'},
    {id:'sounds-plugins',icon:'Fx',title:'音色・プラグイン管理',description:'使用する音色、プラグイン、プリセット情報を管理します。',status:'planned'},
    {id:'mixing',icon:'Mx',title:'ミックス支援',description:'音量、定位、エフェクトなどのミックスメモを整理します。',status:'planned'},
    {id:'mastering',icon:'Ms',title:'マスタリング支援',description:'完成音源の確認項目と書き出しメモを管理します。',status:'planned'},
    {id:'files',icon:'▤',title:'ファイル管理',description:'MIDI、音声、歌詞などの参照ファイルを整理します。',status:'planned'},
    {id:'backup',icon:'⇩',title:'バックアップ',description:'Music Studioプロジェクトを安全に書き出し・復元します。',status:'planned'},
    {id:'settings',icon:'⚙',title:'Music Studio設定',description:'保存先、表示、連携先、製品情報を確認します。',status:'working'},
    {id:'dream-architect',icon:'DA',title:'Dream Architect Studioへ戻る',description:'制作アプリをまとめるDream Architect Studioへ戻ります。',status:'available',action:'dream'},
    {id:'send-nova',icon:'N',title:'Nova Studioへ送る',description:'楽曲情報を自動登録せず、確認してNova Studioへ渡す入口です。',status:'working'}
  ];

  function escapeHtml(value){return String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]))}
  function statusBadge(status){return `<span class="music-status is-${status}">${STATUS_LABELS[status]}</span>`}
  function routeFor(item){return `${HOME_ROUTE}/${item.id}`}
  function navAction(item,standalone){
    if(item.action==='dream')return standalone?"location.href='./index.html#dream-architect'":"setView('dream-architect')";
    return standalone?`location.hash='${routeFor(item)}'`:`setView('${routeFor(item)}')`;
  }
  function card(item,standalone){
    const label=item.status==='available'?'開く':item.status==='working'?'入口を見る':'準備中ページを見る';
    return `<article class="music-feature-card is-${item.status}" data-music-feature-id="${escapeHtml(item.id)}"><div class="music-card-top"><span class="music-feature-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>${statusBadge(item.status)}</div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><button class="${item.status==='available'?'music-primary':'music-secondary'}" onclick="${navAction(item,standalone)}">${label}</button></article>`;
  }
  function contextNote(standalone){
    if(standalone)return `<aside class="music-context-note" role="status"><b>Music Studioを単体で開いています</b><span>Nova StudioやDream Architect Studioに接続しなくても、Music Studioの入口を確認できます。</span></aside>`;
    return `<aside class="music-context-note" role="status"><b>Dream Architect Studioから開いています</b><span>Music Studioの保存領域はNova Studioと分離されます。MS-01では既存データの読み書きを行いません。</span></aside>`;
  }
  function homeView(options={}){
    const standalone=Boolean(options.standalone);
    const counts=Object.keys(STATUS_LABELS).map(status=>`<div><b>${FEATURES.filter(item=>item.status===status).length}</b><span>${STATUS_LABELS[status]}</span></div>`).join('');
    return `<main class="music-studio-shell" aria-labelledby="musicStudioTitle"><header class="music-hero"><div><p class="music-kicker">Logic Pro X centered creative support</p><h1 id="musicStudioTitle">Music Studio</h1><p class="music-lead">Logic Pro Xを中心に、MIDI、歌詞、音色、ミックスから完成までの音楽制作を支援するアプリです。</p></div><span class="music-version">MS-01 / Home</span></header>${contextNote(standalone)}<nav class="music-quick-nav" aria-label="Music Studio主要ナビゲーション"><button class="music-secondary" onclick="${standalone?"location.href='./index.html#dream-architect'":"setView('dream-architect')"}">← Dream Architect Studio</button><button class="music-secondary" onclick="${standalone?"location.href='./index.html#home'":"novaReturnHome()"}">Nova Studio</button></nav><section class="music-status-summary" aria-label="機能の状態">${counts}</section><section aria-labelledby="musicFeaturesTitle"><div class="music-section-heading"><div><p class="music-kicker">Workspace</p><h2 id="musicFeaturesTitle">制作メニュー</h2></div><p>各機能の役割と現在の状態を確認できます。</p></div><div class="music-feature-grid">${FEATURES.map(item=>card(item,standalone)).join('')}</div></section><footer class="music-footer"><p><b>安全な骨組み：</b>未実装機能は準備中画面へ接続し、既存のNova Studio保存データとai-music-helperデータは変更しません。</p></footer></main>`;
  }
  function placeholderView(route,options={}){
    const standalone=Boolean(options.standalone);
    const id=route.replace(`${HOME_ROUTE}/`,'');
    const item=FEATURES.find(feature=>feature.id===id&&!feature.action);
    if(!item)return homeView(options);
    const detail=item.id==='recent-projects'?'<p class="music-empty">最近使ったプロジェクトはまだありません。プロジェクト保存はMS-02以降で実装します。</p>':item.id==='new-project'?'<p class="music-empty">プロジェクト作成フォームと保存処理はMS-02で実装します。現在はデータを作成・変更しません。</p>':'<p class="music-empty">この機能は今後のMS作業で実装します。現在は既存データを変更しない安全な準備中画面です。</p>';
    const back=standalone?`location.hash='${HOME_ROUTE}'`:`setView('${HOME_ROUTE}')`;
    return `<main class="music-studio-shell music-placeholder" aria-labelledby="musicPlaceholderTitle"><button class="music-secondary music-back" onclick="${back}">← Music Studioホームへ戻る</button><section class="music-placeholder-panel"><div class="music-card-top"><span class="music-feature-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>${statusBadge(item.status)}</div><p class="music-kicker">Music Studio</p><h1 id="musicPlaceholderTitle">${escapeHtml(item.title)}</h1><p class="music-lead">${escapeHtml(item.description)}</p>${detail}<div class="music-placeholder-actions"><button class="music-primary" onclick="${back}">ホームへ戻る</button><button class="music-secondary" onclick="history.length>1?history.back():${back}">前の画面へ戻る</button></div></section></main>`;
  }
  function renderRoute(route,options={}){return route===HOME_ROUTE?homeView(options):placeholderView(route,options)}
  function isMusicRoute(route){return route===HOME_ROUTE||route.startsWith(`${HOME_ROUTE}/`)}
  function syncHostChrome(route){root.document?.body?.classList?.toggle('is-music-studio-route',isMusicRoute(route))}
  function installHostRoutes(){
    if(typeof root.managementViewForRoute!=='function')return false;
    const base=root.managementViewForRoute;
    root.managementViewForRoute=function(route){syncHostChrome(route);return isMusicRoute(route)?renderRoute(route):base(route)};
    const baseSetView=typeof root.setView==='function'?root.setView:null;
    if(baseSetView)root.setView=function(route){syncHostChrome(route);return baseSetView(route)};
    const baseOpenApp=typeof root.openApp==='function'?root.openApp:null;
    if(baseOpenApp)root.openApp=function(appId,urlOverride){if(appId==='musicStudio'&&!urlOverride)return root.setView(HOME_ROUTE);return baseOpenApp(appId,urlOverride)};
    root.addEventListener?.('hashchange',()=>{const route=(root.location.hash||'').slice(1);syncHostChrome(route);if(isMusicRoute(route))root.render?.()});
    syncHostChrome((root.location.hash||'').slice(1));
    root.render?.();
    return true;
  }
  function mountStandalone(){
    const target=root.document?.querySelector('#music-studio-app');if(!target)return;
    const paint=()=>{const route=(root.location.hash||`#${HOME_ROUTE}`).slice(1)||HOME_ROUTE;target.innerHTML=renderRoute(route,{standalone:true});root.document.title=route===HOME_ROUTE?'Music Studio':'Music Studio — 準備中'};
    root.addEventListener('hashchange',paint);paint();
  }

  root.MusicStudio={HOME_ROUTE,FEATURES:FEATURES.map(item=>({...item})),STATUS_LABELS:{...STATUS_LABELS},homeView,placeholderView,renderRoute,isMusicRoute,installHostRoutes,mountStandalone};
  if(root.document){if(root.document.body?.dataset.musicStudioStandalone==='true')mountStandalone();else installHostRoutes()}
})(typeof window!=='undefined'?window:globalThis);
