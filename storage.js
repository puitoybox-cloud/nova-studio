const STORAGE_KEY='novaStudio_v01';let saveTimer=null;
function mergeDefaults(d){
 const base=initialData();
 if(!d)return base;
 const normalizeCollection=(key,items)=>{const source=Array.isArray(items)&&items.length?items:base[key]||[];return source.map(x=>normalizeCommonItem(x,COLLECTION_TYPE_MAP[key]||key.slice(0,-1)))};
 const normalized={...base,...d};
 COMMON_COLLECTIONS.forEach(k=>normalized[k]=normalizeCollection(k,d[k]));
 normalized.apps=(Array.isArray(d.apps)&&d.apps.length?d.apps:base.apps).map(x=>normalizeCommonItem(x,COLLECTION_TYPE_MAP.apps));
 normalized.favorites=normalizeFavorites(d.favorites||base.favorites,normalized);
 normalized.recentItems=(d.recentItems||base.recentItems).map(x=>({...x,updatedAt:x.updatedAt||x.openedAt||now()}));
 normalized.settings={...base.settings,...(d.settings||{})};
 normalized.tasks=Array.isArray(d.tasks)?d.tasks.map(x=>normalizeTask(x)):base.tasks;
 normalized.progress={...base.progress,...(d.progress||{}),manualAdjustments:{...(base.progress?.manualAdjustments||{}),...(d.progress?.manualAdjustments||{})}};
 normalized.lastLocation={...base.lastLocation,...(d.lastLocation||{})};
 normalized.universeSettings={...base.universeSettings,...(d.universeSettings||{}),visibleTypes:{...(base.universeSettings?.visibleTypes||{}),...(d.universeSettings?.visibleTypes||{})}};
 normalized.backupStatus={...base.backupStatus,...(d.backupStatus||{})};
 normalized.schemaVersion=SCHEMA_VERSION;
 normalized.appVersion=NOVA_VERSION;
 normalized.activeContext={...base.activeContext,...(d.activeContext||{})};
 return normalized;
}
function normalizeTask(x){const t=x.createdAt||x.updatedAt||now();return {...commonItemFields('task',x.title||'',t),id:x.id||uid('task'),type:'task',title:x.title||'',content:x.content||'',projectId:x.projectId||x.relatedProjectId||'',episodeId:x.episodeId||'',sceneId:x.sceneId||'',priority:['高','中','低'].includes(x.priority)?x.priority:'中',dueDate:x.dueDate||'',completed:Boolean(x.completed),createdAt:t,updatedAt:x.updatedAt||t,status:x.status||'仮設定',tags:Array.isArray(x.tags)?x.tags:[],favorite:Boolean(x.favorite),memo:x.memo||'',relatedIds:Array.isArray(x.relatedIds)?x.relatedIds:[]}}
function normalizeFavorites(items,data){
 const list=(Array.isArray(items)?items:[]).map(f=>({...f,createdAt:f.createdAt||now()}));
 [...COMMON_COLLECTIONS,'apps'].forEach(collection=>{(data[collection]||[]).forEach(item=>{if(!item.favorite)return;const type=item.type||COLLECTION_TYPE_MAP[collection],targetId=item.id;if(!list.some(f=>f.type===type&&f.targetId===targetId)){list.push({id:uid('favorite'),type,targetId,projectId:item.projectId||item.id||'',episodeId:collection==='episodes'?item.id:(item.episodeId||''),title:itemTitle(collection,item),sortOrder:list.length+1,createdAt:item.updatedAt||item.createdAt||now()})}})});
 return list.filter(f=>f&&f.type&&f.targetId).map((f,i)=>({...f,sortOrder:f.sortOrder||i+1}));
}
function itemTitle(collection,item){if(collection==='apps')return item.name||item.title||'';if(collection==='episodes')return `${item.numberLabel||item.title||''} ${item.subtitle||''}`.trim();return item.title||item.name||item.numberLabel||item.id||''}
function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return initialData();toast('保存データを復元しました');return mergeDefaults(JSON.parse(raw))}catch(e){console.error(e);toast('保存データの復元に失敗しました。初期データで表示します。');return initialData()}}
function saveState(immediate=false){if(!state.settings?.autoSave&&!immediate)return;clearTimeout(saveTimer);const run=()=>{try{setSaveStatus('保存中…');state.updatedAt=now();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));setSaveStatus('保存しました')}catch(e){console.error(e);setSaveStatus('保存に失敗しました')}}; immediate?run():saveTimer=setTimeout(run,350)}
function setSaveStatus(text){const el=document.querySelector('#saveStatus');if(el)el.textContent=text}
function toast(msg){setTimeout(()=>{let el=document.querySelector('#toast');if(!el){el=document.createElement('div');el.id='toast';document.body.appendChild(el)}el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)},0)}
function resetAll(){if(confirm('Nova Studioの保存データをすべて初期化します。各制作アプリのデータには影響しません。')&&confirm('本当に初期化しますか？')){localStorage.removeItem(STORAGE_KEY);state=initialData();render();saveState(true)}}
