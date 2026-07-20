/* LINK-02 to LINK-06: local-only Dream Architect Studio handoff UI. */
(function(){
  'use strict';
  const Core=window.DreamArchitectTransferCore;
  if(!Core){console.error('Dream Architect transfer core is unavailable');return;}
  const KEYS={transfer:'novaStudio_dreamArchitectLink_v2',legacy:'novaStudio_dreamArchitectLink_v1',results:'novaStudio_dreamArchitectResults_v1',history:'novaStudio_dreamArchitectHistory_v1'};
  const ROUTE='dream-architect-link';
  let draft=null;
  const selected={characters:new Set(),assets:new Set()};
  const parse=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch(error){console.warn(`Dream Architect: ${key} could not be read`,error);return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch(error){console.error(`Dream Architect: ${key} could not be saved`,error);toast('連携情報を保存できませんでした。既存データは変更されていません。');return false}};
  const activeProject=()=>{const id=String(state?.activeContext?.projectId||'');return (state?.projects||[]).find(item=>String(item.id)===id)||null};
  const activeEpisode=()=>{const id=String(state?.activeContext?.episodeId||'');return (state?.episodes||[]).find(item=>String(item.id)===id)||null};
  const imageKey=(image,index)=>String(image?.id||image?.imageId||image?.fileName||image?.name||`image_${index}`);

  function characterChoices(project){
    if(!project)return [];
    const direct=(state.characters||[]).filter(item=>String(item.projectId||'')===String(project.id));
    const archive=(state.storyArchiveCards||[]).filter(card=>String(card.projectId||'')===String(project.id)&&card.category==='キャラクター').map(card=>({
      id:card.id,title:card.title,projectId:card.projectId,role:card.templateData?.role,profile:card.templateData?.profile||card.body,
      personality:card.templateData?.personality,voice:card.templateData?.voice,appearance:card.templateData?.appearance,updatedAt:card.updatedAt,
      archiveCardId:card.id
    }));
    const seen=new Set();return [...direct,...archive].filter(item=>item.id&&!seen.has(String(item.id))&&seen.add(String(item.id)));
  }

  function assetChoices(project){
    if(!project)return [];
    const output=(state.images||[]).filter(item=>String(item.projectId||'')===String(project.id)).map(item=>Core.normalizeAsset(item,{projectId:project.id}));
    (state.storyArchiveCards||[]).filter(card=>String(card.projectId||'')===String(project.id)).forEach(card=>{
      const management=card.archiveWorkspace?.imageManagement||{},items=management.items||{};
      (Array.isArray(card.images)?card.images:[]).forEach((image,index)=>{
        const key=imageKey(image,index),saved=items[key]||{};
        output.push(Core.normalizeAsset(image,{id:`${card.id}:${key}`,projectId:project.id,name:image.name||image.title||image.fileName,type:card.category||'image',usage:image.referenceRole||card.title,setName:saved.setName,updatedAt:image.updatedAt||card.updatedAt,management:saved}));
      });
    });
    const seen=new Set();return output.filter(item=>item.assetId&&!seen.has(item.assetId)&&seen.add(item.assetId));
  }

  function enrichCharacter(item,project,assets){
    const related=assets.filter(asset=>asset.assetId.startsWith(`${item.archiveCardId||item.id}:`));
    return Core.normalizeCharacter({...item,officialImages:related.filter(asset=>asset.isOfficial),viduReferenceImages:related.filter(asset=>asset.isViduReference)},project);
  }

  function createDraft(){
    const project=activeProject(),episode=activeEpisode();
    if(!project)return null;
    const assets=assetChoices(project),characters=characterChoices(project);
    return Core.buildTransfer({project:{id:project.id,name:project.title},episode:{id:episode?.id||'',name:episode?.numberLabel||episode?.title||''},characters:characters.filter(item=>selected.characters.has(String(item.id))).map(item=>enrichCharacter(item,project,assets)),assets:assets.filter(item=>selected.assets.has(item.assetId)),options:{automaticSync:false,filesUploaded:false,confirmationRequired:true}});
  }

  function sharedWarnings(transfer){
    const warnings=[];
    const unavailable=transfer.assets.filter(item=>item.availability==='metadata-only').length;
    if(unavailable)warnings.push(`${unavailable}件の画像本体は共有されず、メタデータのみ共有されます。Nova Studio側で再選択が必要です。`);
    warnings.push('外部API、クラウド、実ファイルへの送信は行いません。');
    return warnings;
  }

  function saveHistory(transfer,result,error=''){
    const history=parse(KEYS.history,[]);history.unshift({transferId:transfer?.transferId||'',sentAt:new Date().toISOString(),source:Core.SOURCE_APP,destination:Core.DESTINATION_APP,projectId:transfer?.project?.id||'',projectName:transfer?.project?.name||'',episode:transfer?.episode?.name||transfer?.episode?.id||'',characterCount:transfer?.characters?.length||0,assetCount:transfer?.assets?.length||0,result,error});write(KEYS.history,history.slice(0,100));
  }

  function selectionView(){
    const project=activeProject(),episode=activeEpisode();
    if(!project)return `<section class="dream-transfer-empty"><h2>作品を選択してください</h2><p>作品未選択のため共有データは作成しません。Nova Studioホームで作品を選択してください。</p><button class="primary-action" onclick="setView('home')">Nova Studioホームへ戻る</button></section>`;
    const characters=characterChoices(project),assets=assetChoices(project);
    return `<section class="dream-transfer-panel"><div class="section-head"><div><p class="eyebrow">LINK-04 / LINK-05</p><h2>共有する情報を選択</h2><p>${esc(project.title)} / ${esc(episode?.numberLabel||episode?.title||'話数未選択')}</p></div><span class="connection-state">外部アプリ未接続</span></div>
      <div class="dream-transfer-columns"><section><h3>キャラクター</h3>${characters.length?characters.map(item=>`<label class="dream-choice"><input type="checkbox" data-character-id="${esc(item.id)}" ${selected.characters.has(String(item.id))?'checked':''}><span><b>${esc(item.title||item.name||'名称未設定')}</b><small>${esc(item.role||item.templateData?.role||'役割未設定')}</small></span></label>`).join(''):'<p class="empty-note">この作品にはキャラクターが登録されていません</p>'}</section>
      <section><h3>素材</h3>${assets.length?assets.map(item=>`<label class="dream-choice"><input type="checkbox" data-asset-id="${esc(item.assetId)}" ${selected.assets.has(item.assetId)?'checked':''}><span><b>${esc(item.assetName||'名称未設定')}</b><small>${esc(item.assetType)} / ${item.availability==='metadata-only'?'メタデータのみ':'参照情報あり'}${item.isOfficial?' / 正式採用':''}${item.isViduReference?' / Vidu参照':''}</small></span></label>`).join(''):'<p class="empty-note">この作品には共有候補の素材がありません</p>'}</section></div>
      <div class="dream-transfer-actions"><button class="primary-action" onclick="previewDreamArchitectTransfer()">送信前確認へ</button><button class="secondary" onclick="showDreamArchitectResults()">制作結果の受け取り候補</button><button class="secondary" onclick="setView('storyArchive')">Story Archiveへ戻る</button><button class="secondary" onclick="setView('home')">Nova Studioホームへ戻る</button></div></section>`;
  }

  function confirmationView(transfer){
    const warnings=sharedWarnings(transfer);
    return `<section class="dream-transfer-panel"><p class="eyebrow">送信前確認</p><h2>Dream Architect Studioへ渡す内容</h2><dl class="dream-transfer-summary"><div><dt>作品</dt><dd>${esc(transfer.project.name)}（${esc(transfer.project.id)}）</dd></div><div><dt>話数</dt><dd>${esc(transfer.episode.name||transfer.episode.id||'未選択')}</dd></div><div><dt>キャラクター</dt><dd>${transfer.characters.length?transfer.characters.map(item=>esc(item.characterName)).join('、'):'未選択'}</dd></div><div><dt>素材</dt><dd>${transfer.assets.length?transfer.assets.map(item=>esc(item.assetName)).join('、'):'未選択'}</dd></div><div><dt>作成日時</dt><dd>${esc(transfer.createdAt)}</dd></div></dl>
      <section class="dream-transfer-warning"><h3>共有されない情報</h3>${warnings.map(item=>`<p>${esc(item)}</p>`).join('')}</section>
      <div class="dream-transfer-actions"><button class="primary-action" onclick="confirmDreamArchitectTransfer()">Dream Architect Studioを開く</button><button class="secondary" onclick="changeDreamArchitectSelection()">選択内容を変更する</button><button class="secondary" onclick="rebuildDreamArchitectTransfer()">共有データを作り直す</button><button class="secondary" onclick="cancelDreamArchitectTransfer()">キャンセル</button></div></section>`;
  }

  function resultView(){
    const items=parse(KEYS.results,[]);
    return `<section class="dream-transfer-panel"><div class="section-head"><div><p class="eyebrow">LINK-06</p><h2>制作結果の受け取り候補</h2></div><span class="connection-state">自動正式採用なし</span></div><p>Dream Architect Studioが未接続でも、同じ形式のJSONを読み込んで確認できます。登録先は既存素材ではなく専用の候補領域です。</p>
      <div class="dream-result-import"><label>制作結果JSON<textarea id="dreamResultJson" rows="5" placeholder='{"resultId":"result_1", ...}'></textarea></label><button onclick="importDreamArchitectResults()">内容を検証して読み込む</button></div>
      <div class="dream-result-list">${items.length?items.map(item=>`<article class="dream-result-card"><div><b>${esc(item.title||'無題')}</b><small>${esc(item.resultType)} / ${esc(item.status)} / ${esc(item.resultId)}</small></div>${item.updateCandidate?'<p class="warning-text">同じresultIdの更新候補があります。上書き前の確認が必要です。</p>':''}<p>${esc(item.description||'説明なし')}</p><div class="dream-transfer-actions"><button onclick="decideDreamArchitectResult('${esc(item.resultId)}','registered')">確認して登録</button><button class="secondary" onclick="decideDreamArchitectResult('${esc(item.resultId)}','held')">保留</button><button class="secondary" onclick="decideDreamArchitectResult('${esc(item.resultId)}','rejected')">却下</button>${item.updateCandidate?`<button class="secondary" onclick="acceptDreamArchitectResultUpdate('${esc(item.resultId)}')">更新候補を確認</button>`:''}</div></article>`).join(''):'<p class="empty-note">受け取り候補はありません。</p>'}</div><div class="dream-transfer-actions"><button class="secondary" onclick="changeDreamArchitectSelection()">共有画面へ戻る</button><button class="secondary" onclick="setView('home')">Nova Studioホームへ戻る</button></div></section>`;
  }

  function renderRoute(content){document.body.classList.remove('is-home-route');document.body.classList.add('is-management-route');const app=document.querySelector('#app');if(app)app.innerHTML=`<main class="dream-architect-link-shell">${content}</main>`}
  function syncSelection(){document.querySelectorAll('[data-character-id]').forEach(node=>node.addEventListener('change',()=>node.checked?selected.characters.add(node.dataset.characterId):selected.characters.delete(node.dataset.characterId)));document.querySelectorAll('[data-asset-id]').forEach(node=>node.addEventListener('change',()=>node.checked?selected.assets.add(node.dataset.assetId):selected.assets.delete(node.dataset.assetId)))}
  function renderSelection(){renderRoute(selectionView());syncSelection()}

  window.openDreamArchitectStudio=function(){draft=null;setView(ROUTE)};
  window.previewDreamArchitectTransfer=function(){draft=createDraft();if(!draft){renderSelection();return}renderRoute(confirmationView(draft))};
  window.changeDreamArchitectSelection=function(){draft=null;renderSelection()};
  window.rebuildDreamArchitectTransfer=function(){draft=createDraft();if(draft)renderRoute(confirmationView(draft));else renderSelection()};
  window.cancelDreamArchitectTransfer=function(){draft=null;setView('home')};
  window.confirmDreamArchitectTransfer=function(){if(!draft)draft=createDraft();if(!draft){toast('作品を選択してください。');renderSelection();return}const checked=Core.validateTransfer(draft);if(!checked.valid){saveHistory(draft,'error',checked.errors.join(' '));toast('共有データを作成できませんでした。');return}if(!write(KEYS.transfer,draft)){saveHistory(draft,'error','localStorageへの保存に失敗');return}saveHistory(draft,'prepared');renderRoute(`<section class="dream-transfer-panel dream-transfer-empty"><p class="eyebrow">共有データを保存しました</p><h2>Dream Architect Studioは未接続です</h2><p>外部送信は行わず、連携専用localStorageへ保存しました。Dream Architect Studio側はこのキーを読み取ることで接続できます。</p><p><code>${KEYS.transfer}</code></p><div class="dream-transfer-actions"><button class="primary-action" onclick="changeDreamArchitectSelection()">選択内容を変更する</button><button class="secondary" onclick="showDreamArchitectResults()">制作結果を確認する</button><button class="secondary" onclick="setView('home')">Nova Studioホームへ戻る</button></div></section>`)};
  window.showDreamArchitectResults=function(){renderRoute(resultView())};
  window.importDreamArchitectResults=function(){let raw;try{raw=JSON.parse(document.querySelector('#dreamResultJson')?.value||'')}catch(_){toast('JSONを読み込めません。不正な形式です。');return}const incoming=Array.isArray(raw)?raw:Array.isArray(raw.results)?raw.results:[raw];const merged=Core.mergeResultCandidates(parse(KEYS.results,[]),incoming);write(KEYS.results,merged.items);toast(`追加 ${merged.report.added}件 / 重複 ${merged.report.duplicates}件 / 更新候補 ${merged.report.updates}件 / 除外 ${merged.report.rejected.length}件`);renderRoute(resultView())};
  window.decideDreamArchitectResult=function(resultId,decision){const items=parse(KEYS.results,[]),item=items.find(value=>value.resultId===resultId);if(!item)return;if(decision==='registered'&&!confirm('内容を確認し、Nova Studioの受け取り候補として登録しますか？正式採用にはなりません。'))return;item.status=decision;item.decision=decision;item.updatedAt=new Date().toISOString();write(KEYS.results,items);renderRoute(resultView())};
  window.acceptDreamArchitectResultUpdate=function(resultId){const items=parse(KEYS.results,[]),index=items.findIndex(value=>value.resultId===resultId);if(index<0||!items[index].updateCandidate)return;if(!confirm('既存候補を更新候補の内容で上書きしますか？'))return;items[index]={...items[index].updateCandidate,decision:'pending'};write(KEYS.results,items);renderRoute(resultView())};
  window.getDreamArchitectShareData=function(){const current=parse(KEYS.transfer,null);if(current)return Core.normalizeTransfer(current);const legacy=parse(KEYS.legacy,null);return legacy?Core.normalizeTransfer(legacy):null};
  window.DREAM_ARCHITECT_KEYS=KEYS;
  window.createDreamArchitectMockData=function(kind='results'){if(new URLSearchParams(location.search).get('dreamArchitectDebug')!=='1')return null;return kind==='results'?[{resultId:'mock_result_1',transferId:'mock_transfer',projectId:activeProject()?.id||'mock_project',sourceApp:'dream-architect-studio',resultType:'image',title:'確認用画像候補',description:'開発確認用。通常利用時には表示されません。',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'pending',assetMetadata:{},notes:''}]:Core.buildTransfer({project:{id:activeProject()?.id||'mock_project',name:activeProject()?.title||'確認用作品'}})};

  function entryCard(){return `<section class="dream-architect-entry" aria-labelledby="dreamArchitectEntryTitle"><div><p class="eyebrow">Studio Link</p><h2 id="dreamArchitectEntryTitle">Dream Architect Studio</h2><p>作品・話数に加えて、選択したキャラクターと素材を確認して共有します。制作結果は必ず確認してから候補登録します。</p></div><button class="primary-action" data-dream-architect-entry onclick="openDreamArchitectStudio()">連携内容を選ぶ</button></section>`}
  const baseHomeView=homeView;homeView=function(){const html=baseHomeView(),entry=entryCard();return html.includes('</main>')?html.replace('</main>',`${entry}</main>`):`${html}${entry}`};
  const baseRender=render;render=function(){const route=(location.hash||'#home').slice(1)||'home';if(route!==ROUTE)return baseRender();renderSelection()};
  render();
})();
