function downloadJson(obj,name){downloadText(JSON.stringify(obj,null,2),name,'application/json')}
function downloadText(text,name,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function stamp(){return now().replace(/[-: ]/g,'-')}
function exportCore(scope='all'){let out={format:'nova-studio-core',schemaVersion:SCHEMA_VERSION,appVersion:NOVA_VERSION,exportedAt:now(),projects:state.projects,episodes:state.episodes,characters:state.characters,worlds:state.worlds,terms:state.terms,images:state.images,videos:state.videos,ideas:state.ideas,scenes:state.scenes,timelines:state.timelines,changeHistory:state.changeHistory,storyArchiveCards:state.storyArchiveCards||[],storyArchiveFolders:state.storyArchiveFolders||[],activeContext:state.activeContext,apps:state.apps,favorites:state.favorites,recentItems:state.recentItems,settings:state.settings,tasks:state.tasks,viduTemplates:state.viduTemplates||[],viduCharacterSettings:state.viduCharacterSettings||[],progress:state.progress,lastLocation:state.lastLocation,universeSettings:state.universeSettings};if(scope==='projects')out={...out,episodes:[],apps:[],favorites:[],recentItems:[]};if(scope==='episodes')out={...out,projects:[],apps:[],favorites:[],recentItems:[]};if(scope==='apps')out={...out,projects:[],episodes:[],favorites:[],recentItems:[]};if(scope==='favorites')out={...out,projects:[],episodes:[],apps:[]};state.backupStatus.lastExportedAt=now();saveState(true);downloadJson(out,`nova-studio-core-${stamp()}.json`)}
function exportBackup(auto=false){const out={format:'nova-studio-backup',schemaVersion:SCHEMA_VERSION,appVersion:NOVA_VERSION,exportedAt:now(),data:state};state.backupStatus.lastExportedAt=now();saveState(true);downloadJson(out,`${auto?'auto-':''}nova-studio-backup-${stamp()}.json`)}
function analyzeImport(obj){const d=obj.format==='nova-studio-backup'?obj.data:obj;const count=k=>Array.isArray(d?.[k])?d[k].length:0;const collections=[...COMMON_COLLECTIONS,'storyArchiveFolders','apps','viduTemplates','viduCharacterSettings'];const ids=new Set(collections.flatMap(k=>(state[k]||[]).map(x=>x.id)));const incoming=collections.flatMap(k=>d[k]||[]);return{data:d,summary:`JSON形式：${obj.format||'不明'}
schemaVersion：${obj.schemaVersion||''}
書き出し日時：${obj.exportedAt||''}
作品数：${count('projects')}
エピソード数：${count('episodes')}
キャラクター数：${count('characters')}
世界観数：${count('worlds')}
用語数：${count('terms')}
画像数：${count('images')}
動画数：${count('videos')}
アイデア数：${count('ideas')}
シーン数：${count('scenes')}
年表数：${count('timelines')}
変更履歴数：${count('changeHistory')}
Story Archiveカード数：${count('storyArchiveCards')}
Story Archiveフォルダ数：${count('storyArchiveFolders')}
アプリ設定数：${count('apps')}
お気に入り数：${count('favorites')}
履歴数：${count('recentItems')}
タスク数：${count('tasks')}
Viduテンプレート数：${count('viduTemplates')}
キャラクター固定設定数：${count('viduCharacterSettings')}
重複候補数：${incoming.filter(x=>ids.has(x.id)).length}
エラー数：${(obj.format==='nova-studio-core'||obj.format==='nova-studio-backup')?0:1}`}}
function importFile(file){const reader=new FileReader();reader.onload=()=>{try{const obj=JSON.parse(reader.result);const {data,summary}=analyzeImport(obj);if(!data||!(obj.format==='nova-studio-core'||obj.format==='nova-studio-backup'))throw Error('unsupported');const mode=prompt(summary+'\n\n読み込み方法を入力してください：add / merge / replace','merge');if(!mode)return;if(mode==='replace'){alert('現在のNova Studioデータを置き換えます。先にバックアップを保存することをおすすめします。');exportBackup(true);if(!confirm('現在のNova Studioデータを置き換えます。先にバックアップを保存することをおすすめします。'))return;state=mergeDefaults(data)}else if(mode==='add'){[...COMMON_COLLECTIONS,'apps','favorites','recentItems','viduTemplates','viduCharacterSettings'].forEach(k=>state[k]=[...(state[k]||[]),...(data[k]||[]).map(x=>k==='tasks'?normalizeTask({...x,id:uid('task')}):COLLECTION_TYPE_MAP[k]?normalizeCommonItem({...x,id:uid(COLLECTION_TYPE_MAP[k])},COLLECTION_TYPE_MAP[k]):{...x,id:uid(k.slice(0,-1)||'item')})])}else{[...COMMON_COLLECTIONS,'apps','favorites','recentItems','viduTemplates','viduCharacterSettings'].forEach(k=>{state[k]=state[k]||[];(data[k]||[]).map(x=>k==='tasks'?normalizeTask(x):COLLECTION_TYPE_MAP[k]?normalizeCommonItem(x,COLLECTION_TYPE_MAP[k]):x).forEach(x=>{const i=state[k].findIndex(y=>y.id===x.id); if(i>=0){if(confirm(`${k}:${x.id} は重複しています。読み込むデータを採用しますか？（キャンセルで現在を残す）`))state[k][i]=x}else state[k].push(x)})});state.settings={...state.settings,...(data.settings||{})};state.progress={...state.progress,...(data.progress||{})};state.lastLocation={...state.lastLocation,...(data.lastLocation||{})};state.universeSettings={...state.universeSettings,...(data.universeSettings||{})}}state.backupStatus.lastImportedAt=now();saveState(true);render();toast('JSONを読み込みました')}catch(e){console.error(e);toast('不正なJSONです。現在のデータは変更していません。')}};reader.readAsText(file)}
function makeConsultText(type,body){const p=currentProject(),e=currentEpisode();return `【Nova Studio・ノヴァ相談用データ】\n\nNova Studioバージョン：${NOVA_VERSION}\n書き出し日時：${now()}\n\n現在の作品：${p?.title||''}\n作品ID：${p?.id||''}\n制作状態：${p?.productionStatus||''}\n\n現在の話数：${e?.numberLabel||''}\n話数ID：${e?.id||''}\n\n相談の種類：${type}\n\n相談内容：\n${body}\n\n関連アプリ：\n- ノヴァ物語制作室\n- AIアニメ制作ダッシュボード\n- Prompt Studio\n- Music Studio\n\nノヴァへの依頼：\n上記の情報を基に、状況を整理し、次に行うことを分かりやすく案内してください。`}

// Version 1.0 RC: faster large JSON export/import and legacy JSON tolerance.
function downloadJson(obj,name){downloadText(JSON.stringify(obj),name,'application/json')}
function slugForImport(text,prefix='item'){return prefix+'_'+String(text||prefix).normalize('NFKC').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'_').replace(/^_+|_+$/g,'').slice(0,80)||prefix+'_'+Date.now().toString(36)}
function templateDataFromImportFields(category,fields={}){
 const keyMap={
  キャラクター:{'役割':'role','プロフィール':'profile','目的':'goal','性格':'personality','外見':'appearance','髪型':'appearance','特徴':'importantSettings','重要設定':'importantSettings','声・話し方':'voice'},
  世界観:{'概要':'overview','世界のルール':'rules','歴史':'history','文化':'culture','対立・問題':'conflict'},
  場所:{'種別':'locationType','説明':'description','雰囲気':'atmosphere','関係者':'residents','起きる出来事':'events'},
  アイテム:{'種別':'itemType','所有者':'owner','説明':'description','効果・能力':'ability','由来':'origin','制約':'limits'},
  用語:{'読み':'reading','意味':'meaning','使い方':'usage','関連概念':'relatedConcepts'},
  ストーリー:{'あらすじ':'synopsis','テーマ':'theme','プロット':'plot','葛藤':'conflict','結末':'resolution','伏線':'foreshadowing'}
 };
 return Object.entries(fields||{}).reduce((out,[label,value])=>{const key=keyMap[category]?.[label]||label;out[key]=out[key]?[out[key],value].filter(Boolean).join('\n'):String(value||'');return out},{});
}
function normalizeNestedStoryArchivePayload(obj){
 if(!obj||!Array.isArray(obj.projects))return null;
 const out={schemaVersion:obj.schemaVersion||SCHEMA_VERSION,importSyncId:obj.syncId||'',exportedAt:obj.createdAt||now(),projects:[],episodes:[],storyArchiveCards:[]};
 obj.projects.forEach((projectInput,projectIndex)=>{
  const projectId=projectInput.id||slugForImport(projectInput.title||projectInput.name||`project_${projectIndex+1}`,'project');
  out.projects.push({id:projectId,title:projectInput.title||projectInput.name||'無題の作品',sortOrder:projectIndex+1,status:projectInput.status||'仮設定',createdAt:obj.createdAt||now(),updatedAt:obj.createdAt||now()});
  (projectInput.episodes||[]).forEach((episodeInput,episodeIndex)=>{
   const episodeId=episodeInput.id||slugForImport(`${projectId}_${episodeInput.title||episodeInput.numberLabel||episodeIndex+1}`,'episode');
   out.episodes.push({id:episodeId,projectId,numberLabel:episodeInput.title||episodeInput.numberLabel||`第${episodeIndex+1}話`,sortOrder:episodeIndex+1,status:episodeInput.status||'仮設定',createdAt:obj.createdAt||now(),updatedAt:obj.createdAt||now()});
   (episodeInput.cards||[]).forEach((cardInput,cardIndex)=>{
    const category=cardInput.category||cardInput.templateCategory||'概要';
    const templateData={...templateDataFromImportFields(category,cardInput.fields),...(cardInput.templateData||{})};
    out.storyArchiveCards.push({id:cardInput.id||slugForImport(`${episodeId}_${cardInput.title||cardIndex+1}`,'archive'),type:COMMON_ITEM_TYPES.STORY_ARCHIVE_CARD,title:cardInput.title||'無題',body:cardInput.body||cardInput.content||cardInput.memo||'',category,templateCategory:category,status:cardInput.status||'仮設定',isConfirmed:cardInput.status==='確定'||Boolean(cardInput.isConfirmed),tags:Array.isArray(cardInput.tags)?cardInput.tags:parseTags(cardInput.tags||''),projectId,episodeId,relatedTitles:Array.isArray(cardInput.relatedTitles)?cardInput.relatedTitles:parseTags(cardInput.relatedTitles||''),relatedIds:Array.isArray(cardInput.relatedIds)?cardInput.relatedIds:[],templateData,importFields:cardInput.fields||{},images:Array.isArray(cardInput.images)?cardInput.images:[],imageSets:Array.isArray(cardInput.imageSets)?cardInput.imageSets:[],createdAt:obj.createdAt||now(),updatedAt:obj.createdAt||now()});
   });
  });
 });
 out.storyArchiveCards.forEach(card=>{
  const titleLinks=(card.relatedTitles||[]).map(title=>out.storyArchiveCards.find(c=>c.title===title)?.id).filter(Boolean);
  card.relatedIds=[...new Set([...(card.relatedIds||[]),...titleLinks])];
 });
 return out;
}
function normalizeImportPayload(obj){
 if(obj?.format==='nova-studio-backup')return obj.data||{};
 if(obj?.format==='nova-studio-core')return obj;
 if(obj?.data&&typeof obj.data==='object')return obj.data;
 const nested=normalizeNestedStoryArchivePayload(obj);
 if(nested)return nested;
 if(obj&&typeof obj==='object'&&(['projects','episodes','scenes','characters','terms'].some(k=>Array.isArray(obj[k]))))return obj;
 return null;
}
analyzeImport=function(obj){const d=normalizeImportPayload(obj);const count=k=>Array.isArray(d?.[k])?d[k].length:0;const collections=[...COMMON_COLLECTIONS,'storyArchiveFolders','apps','favorites','recentItems','viduTemplates','viduCharacterSettings'];const ids=new Set(collections.flatMap(k=>(state[k]||[]).map(x=>x.id)));const incoming=collections.flatMap(k=>d?.[k]||[]);return{data:d,summary:`JSON形式：${obj.format||'旧形式/自動判定'}\nschemaVersion：${obj.schemaVersion||d?.schemaVersion||''}\n書き出し日時：${obj.exportedAt||d?.exportedAt||''}\n作品数：${count('projects')}\nエピソード数：${count('episodes')}\nシーン数：${count('scenes')}\nキャラクター数：${count('characters')}\n用語数：${count('terms')}\nStory Archiveカード数：${count('storyArchiveCards')}
Story Archiveフォルダ数：${count('storyArchiveFolders')}\nViduテンプレート数：${count('viduTemplates')}\n重複候補数：${incoming.filter(x=>ids.has(x.id)).length}\nエラー数：${d?0:1}`}};
function mergeImportedData(data,mode){
 const collections=[...COMMON_COLLECTIONS,'storyArchiveFolders','apps','favorites','recentItems','viduTemplates','viduCharacterSettings'];
 if(mode==='replace'){state=mergeDefaults(data);return}
 collections.forEach(k=>{const incoming=Array.isArray(data[k])?data[k]:[];state[k]=state[k]||[];const map=new Map(state[k].map((x,i)=>[x.id,i]));incoming.forEach(raw=>{let x=COLLECTION_TYPE_MAP[k]?normalizeCommonItem(raw,COLLECTION_TYPE_MAP[k]):(k==='tasks'?normalizeTask(raw):{...raw}); if(mode==='add'||!x.id||map.has(x.id)&&mode==='add')x={...x,id:uid(COLLECTION_TYPE_MAP[k]||k)}; const i=map.get(x.id); if(mode==='merge'&&i>=0)state[k][i]={...state[k][i],...x,updatedAt:x.updatedAt||now()}; else state[k].push(x)})});
 state.settings={...state.settings,...(data.settings||{})}; state.progress={...state.progress,...(data.progress||{})}; state.lastLocation={...state.lastLocation,...(data.lastLocation||{})}; state.universeSettings={...state.universeSettings,...(data.universeSettings||{})}; state=mergeDefaults(state);
}
function importFile(file){const reader=new FileReader();reader.onload=()=>{try{const obj=JSON.parse(reader.result);const {data,summary}=analyzeImport(obj);if(!data)throw Error('unsupported');const mode=prompt(summary+'\n\n読み込み方法：add / merge / replace','merge');if(!mode)return;if(mode==='replace'&&!confirm('現在のNova Studioデータを置き換えます。実行前に自動バックアップを書き出します。'))return;if(mode==='replace')exportBackup(true);mergeImportedData(data,['add','merge','replace'].includes(mode)?mode:'merge');state.backupStatus.lastImportedAt=now();saveState(true);render();toast('JSONを読み込みました')}catch(e){console.error(e);toast('不正なJSONです。現在のデータは変更していません。')}};reader.readAsText(file)}
