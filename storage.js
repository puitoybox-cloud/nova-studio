const STORAGE_KEY='novaStudio_v01';let saveTimer=null;
function mergeDefaults(d){
 const base=initialData();
 if(!d)return base;
 const normalizeCollection=(key,items)=>{const source=Array.isArray(items)&&items.length?items:base[key]||[];return source.map(x=>normalizeCommonItem(x,COLLECTION_TYPE_MAP[key]||key.slice(0,-1)))};
 const normalized={...base,...d};
 COMMON_COLLECTIONS.forEach(k=>normalized[k]=normalizeCollection(k,d[k]));
 normalized.apps=(Array.isArray(d.apps)&&d.apps.length?d.apps:base.apps).map(x=>normalizeCommonItem(x,COLLECTION_TYPE_MAP.apps));
 normalized.favorites=d.favorites||base.favorites;
 normalized.recentItems=d.recentItems||base.recentItems;
 normalized.settings={...base.settings,...(d.settings||{})};
 normalized.backupStatus={...base.backupStatus,...(d.backupStatus||{})};
 normalized.schemaVersion=SCHEMA_VERSION;
 normalized.appVersion=NOVA_VERSION;
 normalized.activeContext={...base.activeContext,...(d.activeContext||{})};
 return normalized;
}
function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return initialData();toast('保存データを復元しました');return mergeDefaults(JSON.parse(raw))}catch(e){console.error(e);toast('保存データの復元に失敗しました。初期データで表示します。');return initialData()}}
function saveState(immediate=false){if(!state.settings?.autoSave&&!immediate)return;clearTimeout(saveTimer);const run=()=>{try{setSaveStatus('保存中…');state.updatedAt=now();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));setSaveStatus('保存しました')}catch(e){console.error(e);setSaveStatus('保存に失敗しました')}}; immediate?run():saveTimer=setTimeout(run,350)}
function setSaveStatus(text){const el=document.querySelector('#saveStatus');if(el)el.textContent=text}
function toast(msg){setTimeout(()=>{let el=document.querySelector('#toast');if(!el){el=document.createElement('div');el.id='toast';document.body.appendChild(el)}el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)},0)}
function resetAll(){if(confirm('Nova Studioの保存データをすべて初期化します。各制作アプリのデータには影響しません。')&&confirm('本当に初期化しますか？')){localStorage.removeItem(STORAGE_KEY);state=initialData();render();saveState(true)}}
