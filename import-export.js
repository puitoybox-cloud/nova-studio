function downloadJson(obj,name){downloadText(JSON.stringify(obj,null,2),name,'application/json')}
function downloadText(text,name,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function stamp(){return now().replace(/[-: ]/g,'-')}
function exportCore(scope='all'){let out={format:'nova-studio-core',schemaVersion:SCHEMA_VERSION,appVersion:NOVA_VERSION,exportedAt:now(),projects:state.projects,episodes:state.episodes,characters:state.characters,worlds:state.worlds,terms:state.terms,images:state.images,videos:state.videos,ideas:state.ideas,activeContext:state.activeContext,apps:state.apps,favorites:state.favorites,recentItems:state.recentItems,settings:state.settings};if(scope==='projects')out={...out,episodes:[],apps:[],favorites:[],recentItems:[]};if(scope==='episodes')out={...out,projects:[],apps:[],favorites:[],recentItems:[]};if(scope==='apps')out={...out,projects:[],episodes:[],favorites:[],recentItems:[]};if(scope==='favorites')out={...out,projects:[],episodes:[],apps:[]};state.backupStatus.lastExportedAt=now();saveState(true);downloadJson(out,`nova-studio-core-${stamp()}.json`)}
function exportBackup(auto=false){const out={format:'nova-studio-backup',schemaVersion:SCHEMA_VERSION,appVersion:NOVA_VERSION,exportedAt:now(),data:state};state.backupStatus.lastExportedAt=now();saveState(true);downloadJson(out,`${auto?'auto-':''}nova-studio-backup-${stamp()}.json`)}
function analyzeImport(obj){const d=obj.format==='nova-studio-backup'?obj.data:obj;const count=k=>Array.isArray(d?.[k])?d[k].length:0;const collections=[...COMMON_COLLECTIONS,'apps'];const ids=new Set(collections.flatMap(k=>(state[k]||[]).map(x=>x.id)));const incoming=collections.flatMap(k=>d[k]||[]);return{data:d,summary:`JSON形式：${obj.format||'不明'}
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
アプリ設定数：${count('apps')}
お気に入り数：${count('favorites')}
履歴数：${count('recentItems')}
重複候補数：${incoming.filter(x=>ids.has(x.id)).length}
エラー数：${(obj.format==='nova-studio-core'||obj.format==='nova-studio-backup')?0:1}`}}
function importFile(file){const reader=new FileReader();reader.onload=()=>{try{const obj=JSON.parse(reader.result);const {data,summary}=analyzeImport(obj);if(!data||!(obj.format==='nova-studio-core'||obj.format==='nova-studio-backup'))throw Error('unsupported');const mode=prompt(summary+'\n\n読み込み方法を入力してください：add / merge / replace','merge');if(!mode)return;if(mode==='replace'){alert('現在のNova Studioデータを置き換えます。先にバックアップを保存することをおすすめします。');exportBackup(true);if(!confirm('現在のNova Studioデータを置き換えます。先にバックアップを保存することをおすすめします。'))return;state=mergeDefaults(data)}else if(mode==='add'){[...COMMON_COLLECTIONS,'apps','favorites','recentItems'].forEach(k=>state[k]=[...(state[k]||[]),...(data[k]||[]).map(x=>COLLECTION_TYPE_MAP[k]?normalizeCommonItem({...x,id:uid(COLLECTION_TYPE_MAP[k])},COLLECTION_TYPE_MAP[k]):{...x,id:uid(k.slice(0,-1)||'item')})])}else{[...COMMON_COLLECTIONS,'apps','favorites','recentItems'].forEach(k=>{(data[k]||[]).map(x=>COLLECTION_TYPE_MAP[k]?normalizeCommonItem(x,COLLECTION_TYPE_MAP[k]):x).forEach(x=>{const i=state[k].findIndex(y=>y.id===x.id); if(i>=0){if(confirm(`${k}:${x.id} は重複しています。読み込むデータを採用しますか？（キャンセルで現在を残す）`))state[k][i]=x}else state[k].push(x)})});state.settings={...state.settings,...(data.settings||{})}}state.backupStatus.lastImportedAt=now();saveState(true);render();toast('JSONを読み込みました')}catch(e){console.error(e);toast('不正なJSONです。現在のデータは変更していません。')}};reader.readAsText(file)}
function makeConsultText(type,body){const p=currentProject(),e=currentEpisode();return `【Nova Studio・ノヴァ相談用データ】\n\nNova Studioバージョン：${NOVA_VERSION}\n書き出し日時：${now()}\n\n現在の作品：${p?.title||''}\n作品ID：${p?.id||''}\n制作状態：${p?.productionStatus||''}\n\n現在の話数：${e?.numberLabel||''}\n話数ID：${e?.id||''}\n\n相談の種類：${type}\n\n相談内容：\n${body}\n\n関連アプリ：\n- ノヴァ物語制作室\n- AIアニメ制作ダッシュボード\n- Prompt Studio\n- Music Studio\n\nノヴァへの依頼：\n上記の情報を基に、状況を整理し、次に行うことを分かりやすく案内してください。`}
