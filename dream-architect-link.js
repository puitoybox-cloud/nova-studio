/* LINK-02 / LINK-03: safe handoff entry for Dream Architect Studio. */
(function(){
  const DREAM_ARCHITECT_SHARE_KEY='novaStudio_dreamArchitectLink_v1';
  const DREAM_ARCHITECT_ROUTE='dream-architect-link';
  function selectedDreamArchitectContext(){
    const projectId=String(state?.activeContext?.projectId||'');
    const project=(state?.projects||[]).find(item=>item.id===projectId)||null;
    const selectedEpisodeId=String(state?.activeContext?.episodeId||'');
    const episode=(state?.episodes||[]).find(item=>item.id===selectedEpisodeId&&item.projectId===project?.id)||null;
    return {projectName:String(project?.title||''),projectId:String(project?.id||''),episodeId:String(episode?.id||'')};
  }
  function saveDreamArchitectContext(){
    const payload=selectedDreamArchitectContext();
    try{localStorage.setItem(DREAM_ARCHITECT_SHARE_KEY,JSON.stringify(payload))}
    catch(error){console.error('Dream Architect Studio context save failed',error);toast('連携情報を保存できませんでした。Nova Studioのデータは変更されていません。')}
    return payload;
  }
  function dreamArchitectEntryCard(){return `<section class="dream-architect-entry" aria-labelledby="dreamArchitectEntryTitle"><div><p class="eyebrow">Studio Link</p><h2 id="dreamArchitectEntryTitle">Dream Architect Studio</h2><p>選択中の作品と話数を引き継いで、制作スタジオへの入口を開きます。</p></div><button class="primary-action" data-dream-architect-entry onclick="openDreamArchitectStudio()">Dream Architect Studioを開く</button></section>`}
  function dreamArchitectWaitingView(){
    const context=selectedDreamArchitectContext();
    return `<section class="dream-architect-waiting" aria-labelledby="dreamArchitectWaitingTitle"><p class="eyebrow">Dream Architect Studio Link</p><h1 id="dreamArchitectWaitingTitle">接続準備中</h1><p>Dream Architect Studio本体はまだ接続されていません。Nova Studioの既存データは変更せず、今回の共有情報だけを安全に準備しました。</p><dl><div><dt>作品名</dt><dd>${esc(context.projectName||'未選択')}</dd></div><div><dt>作品ID</dt><dd>${esc(context.projectId||'未選択')}</dd></div><div><dt>選択中の話数</dt><dd>${esc(context.episodeId||'未選択')}</dd></div></dl><p class="meta">共有対象は上の3項目だけです。キャラクターや素材、制作結果は送信しません。</p><button class="primary-action" onclick="setView('home')">Nova Studioへ戻る</button></section>`;
  }
  window.openDreamArchitectStudio=function(){saveDreamArchitectContext();setView(DREAM_ARCHITECT_ROUTE)};
  window.getDreamArchitectShareData=selectedDreamArchitectContext;
  window.DREAM_ARCHITECT_SHARE_KEY=DREAM_ARCHITECT_SHARE_KEY;
  const baseHomeView=homeView;
  homeView=function(){const html=baseHomeView(),entry=dreamArchitectEntryCard();return html.includes('</main>')?html.replace('</main>',`${entry}</main>`):`${html}${entry}`};
  const baseRender=render;
  render=function(){
    const route=(location.hash||'#home').slice(1)||'home';
    if(route!==DREAM_ARCHITECT_ROUTE)return baseRender();
    document.body.classList.remove('is-home-route');document.body.classList.add('is-management-route');
    const app=document.querySelector('#app');if(app)app.innerHTML=`<main class="dream-architect-link-shell">${dreamArchitectWaitingView()}</main>`;
  };
  render();
})();
