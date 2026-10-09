const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){let i=0;const w={console,Date,Math,JSON,Intl,ArrayBuffer,DataView,Float32Array,crypto:{randomUUID:()=>`pcm-${++i}`},location:{hash:'#music-studio'}};w.window=w;vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),w);const a=w.MusicStudio,p=a.makeProject({projectId:'p',projectName:'PCM',midiData:{ppq:480,tracks:[{id:'keep',part:'melody',notes:[{id:'n',pitch:60,startTick:0,durationTicks:480,velocity:80}]}]},audioAssets:[{id:'legacy',file:'legacy.wav'}],legacy:{future:true}}),pcm={sampleRate:48000,channels:[[0,.25,-.5,.75],[0,-.25,.5,-.75]]};return{w,a,p,pcm}}
async function ready(){const f=fixture();f.p=f.a.pcmImport(f.p,f.pcm,'voice.wav');const repo=f.a.memoryRepository([f.p,{...f.p,projectId:'other'}]);f.a.setRepository(repo);f.a.state.projects=[f.p];f.a.pcmMixView('p');f.a.pcmEditor.assetId=f.p.pcmMix.assets[0].id;f.a.pcmEditor.gainDb=-6;f.a.pcmEditor.preview=f.a.pcmPreview(f.p,f.a.pcmEditor.assetId,-6);return{...f,repo}}
test('actual stereo PCM Gain, peak and clipping matches independent expected samples and protects input',()=>{const{a,pcm}=fixture(),original=JSON.stringify(pcm),out=a.pcmGain(pcm,6.020599913279624);assert.equal(JSON.stringify(pcm),original);assert.deepEqual(plain(out.channels),[[0,.5,-1,1.5],[0,-.5,1,-1.5]]);const m=a.pcmAnalyze(out);assert.equal(m.peak,1.5);assert.equal(m.clippingSamples,4);assert.equal(m.frames,4);assert.equal(m.seconds,4/48000);assert.ok(Math.abs(m.rms-Math.sqrt(.875))<1e-12)});
test('silence has no fake finite dBFS',()=>{const{a}=fixture(),m=a.pcmAnalyze({sampleRate:8000,channels:[[0,0]]});assert.equal(m.peakDb,null);assert.equal(m.rmsDb,null);assert.equal(m.clippingSamples,0)});
for(const [label,change] of [['NaN',f=>f.pcm.channels[0][0]=NaN],['Infinity',f=>f.pcm.channels[0][0]=Infinity],['string',f=>f.pcm.channels[0][0]='0'],['channel length',f=>f.pcm.channels[1].pop()],['empty',f=>f.pcm.channels=[[]]],['rate',f=>f.pcm.sampleRate=7999],['channels',f=>f.pcm.channels.push([0])],['capacity',f=>f.pcm.channels=[Array(f.a.PCM_LIMIT+1).fill(0)]]])test('reject invalid PCM '+label,()=>{const f=fixture();change(f);assert.throws(()=>f.a.pcmGain(f.pcm,0))});
for(const gain of [NaN,Infinity,'6',25,-25])test('reject invalid Gain '+gain,()=>{const f=fixture();assert.throws(()=>f.a.pcmGain(f.pcm,gain),/invalid-pcm-gain/)});
test('real PCM16 WAV roundtrip preserves ordering/rate and quantization bound',()=>{const{a,pcm}=fixture(),wav=a.pcmEncodeWav(pcm),decoded=a.pcmDecodeWav(wav);assert.deepEqual(plain(decoded),pcm);assert.equal(new DataView(wav).getUint32(40,true),16);assert.throws(()=>a.pcmEncodeWav(a.pcmGain(pcm,6)),/clipping/)});
function wav(code,bits,values){const bytes=bits/8,b=new ArrayBuffer(44+values.length*bytes),v=new DataView(b);for(const [pos,s]of[[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])[...s].forEach((c,i)=>v.setUint8(pos+i,c.charCodeAt()));v.setUint32(4,b.byteLength-8,true);v.setUint32(16,16,true);v.setUint16(20,code,true);v.setUint16(22,1,true);v.setUint32(24,22050,true);v.setUint32(28,22050*bytes,true);v.setUint16(32,bytes,true);v.setUint16(34,bits,true);v.setUint32(40,values.length*bytes,true);values.forEach((x,i)=>{const at=44+i*bytes;if(code===3)v.setFloat32(at,x,true);else if(bits===32)v.setInt32(at,x,true);else if(bits===24){v.setUint8(at,x&255);v.setUint8(at+1,(x>>8)&255);v.setUint8(at+2,(x>>16)&255)}});return b}
for(const [code,bits,values,expected]of[[1,24,[-8388608,0,4194304,-4194304],[-1,0,.5,-.5]],[1,32,[-2147483648,0,1073741824,-1073741824],[-1,0,.5,-.5]],[3,32,[-1,0,.5,-.5],[-1,0,.5,-.5]]])test('decode real WAV '+code+'/'+bits,()=>{assert.deepEqual(plain(fixture().a.pcmDecodeWav(wav(code,bits,values)).channels[0]),expected)});
for(const [label,change]of[['RIFF',v=>v.setUint8(0,0)],['length',v=>v.setUint32(4,0,true)],['alignment',v=>v.setUint16(32,0,true)],['byte rate',v=>v.setUint32(28,1,true)],['codec',v=>v.setUint16(20,6,true)],['chunk overrun',v=>v.setUint32(40,999,true)]])test('reject malformed WAV '+label,()=>{const f=fixture(),b=f.a.pcmEncodeWav(f.pcm);change(new DataView(b));assert.throws(()=>f.a.pcmDecodeWav(b))});
test('preview does not mutate and tampered/stale preview cannot Apply',()=>{const f=fixture(),p=f.a.pcmImport(f.p,f.pcm,'voice'),id=p.pcmMix.assets[0].id,before=JSON.stringify(p),preview=f.a.pcmPreview(p,id,-6);assert.equal(JSON.stringify(p),before);preview.after.peak=0;assert.throws(()=>f.a.pcmAdopt(p,preview),/modified/);const fresh=f.a.pcmPreview(p,id,-6);p.revision++;assert.throws(()=>f.a.pcmAdopt(p,fresh),/stale/)});
test('Apply/Undo/Redo preserve exact original, MIDI, legacy, other audio and other project',async()=>{const f=await ready(),other=JSON.stringify(await f.repo.get('other'));assert.equal((await f.a.pcmApply('p')).ok,true);let p=await f.repo.get('p');assert.equal(p.pcmMix.assets[0].gains[p.pcmMix.assets[0].cursor],-6);assert.deepEqual(plain(p.pcmMix.assets[0].original),f.pcm);for(const key of ['midiData','audioAssets','legacy'])assert.deepEqual(plain(p[key]),plain(f.p[key]));assert.equal((await f.a.pcmUndoRedo('p',-1)).ok,true);p=await f.repo.get('p');assert.equal(p.pcmMix.assets[0].cursor,0);assert.equal((await f.a.pcmUndoRedo('p',1)).ok,true);assert.equal((await f.repo.get('p')).pcmMix.assets[0].cursor,1);assert.equal(JSON.stringify(await f.repo.get('other')),other)});
test('new Apply after Undo branches history without changing original or unrelated asset',()=>{const f=fixture();let p=f.a.pcmImport(f.p,f.pcm,'a');p=f.a.pcmImport(p,f.pcm,'b');const id=p.pcmMix.assets[0].id,other=plain(p.pcmMix.assets[1]);for(const g of [-6,-12])p=f.a.pcmAdopt(p,f.a.pcmPreview(p,id,g));p=f.a.pcmHistory(p,id,-1);p=f.a.pcmAdopt(p,f.a.pcmPreview(p,id,-3));assert.deepEqual(plain(p.pcmMix.assets[0].gains),[0,-6,-3]);assert.deepEqual(plain(p.pcmMix.assets[1]),other);assert.throws(()=>f.a.pcmHistory(p,id,1),/boundary/)});
test('save/reload JSON and Backup/Restore contain actual original PCM and gains',async()=>{const f=await ready();await f.a.pcmApply('p');const saved=await f.repo.get('p'),json=await f.a.exportProject('p'),backup=f.a.backupObject();for(const mode of ['json','backup']){const dest=fixture(),repo=dest.a.memoryRepository();dest.a.setRepository(repo);const result=mode==='json'?await dest.a.importText(json.text):await dest.a.restoreBackup(backup,{settings:false,projects:true});assert.equal(result.ok,true);const p=(await repo.list())[0];assert.deepEqual(plain(p.pcmMix),plain(saved.pcmMix));assert.deepEqual(plain(dest.a.makeProject(p).pcmMix),plain(saved.pcmMix));assert.equal(dest.a.pcmPreview(p,p.pcmMix.assets[0].id,-12).before.peak,f.pcm.channels[0][3]*10**(-6/20))}});
for(const [label,change]of[['dirty',f=>f.a.state.dirty=true],['MIDI dirty',f=>f.a.state.midiEditor={projectId:'p',dirty:true}],['recording',f=>f.a.state.midiInput.recording=true],['unsupported atomic',f=>delete f.repo.compareAndPut],['changed storage',async f=>{await f.repo.put({...f.p,productionNotes:'other tab'})}],['changed preview',f=>f.a.pcmEditor.preview.gainDb=3]])test('safe rejection '+label,async()=>{const f=await ready();await change(f);const before=JSON.stringify(await f.repo.get('p'));assert.equal((await f.a.pcmApply('p')).ok,false);assert.equal(JSON.stringify(await f.repo.get('p')),before);assert.ok(f.a.pcmEditor.preview);assert.equal(f.a.pcmEditor.busy,false)});
test('quota failure retains original/preview and retry succeeds',async()=>{const f=await ready(),cas=f.repo.compareAndPut;f.repo.compareAndPut=async()=>{throw Error('quota')};assert.equal((await f.a.pcmApply('p')).ok,false);assert.deepEqual(plain(await f.repo.get('p')),plain(f.p));assert.ok(f.a.pcmEditor.preview);f.repo.compareAndPut=cas;assert.equal((await f.a.pcmApply('p')).ok,true)});
test('repository change during read and concurrent storage update fail closed',async()=>{let f=await ready(),get=f.repo.get;f.repo.get=async id=>{f.a.setRepository(f.a.memoryRepository());return get(id)};assert.equal((await f.a.pcmApply('p')).ok,false);assert.deepEqual(plain(await get('p')),plain(f.p));f=await ready();const cas=f.repo.compareAndPut;f.repo.compareAndPut=async(item,baseline,guard)=>{await f.repo.put({...f.p,productionNotes:'race'});return cas(item,baseline,guard)};assert.equal((await f.a.pcmApply('p')).ok,false);assert.equal((await f.repo.get('p')).productionNotes,'race')});
test('WAV file import decodes/persists real samples without touching legacy references',async()=>{const f=await ready(),b=f.a.pcmEncodeWav(f.pcm),result=await f.a.pcmImportFile({name:'second.wav',size:b.byteLength,arrayBuffer:async()=>b},'p');assert.equal(result.ok,true);assert.equal(result.project.pcmMix.assets.length,2);assert.deepEqual(plain(result.project.pcmMix.assets[1].original),f.pcm);assert.deepEqual(plain(result.project.audioAssets),plain(f.p.audioAssets))});
test('cancel during asynchronous file read rejects original import',async()=>{const f=await ready(),b=f.a.pcmEncodeWav(f.pcm);const result=await f.a.pcmImportFile({name:'b.wav',size:b.byteLength,arrayBuffer:async()=>{f.a.pcmCancel();return b}},'p');assert.equal(result.ok,false);assert.deepEqual(plain(await f.repo.get('p')),plain(f.p))});
test('corrupt PCM/history fails project validation and JSON/Backup import',async()=>{const f=await ready(),bad=plain(f.p);bad.pcmMix.assets[0].cursor=10;assert.equal(f.a.validateProject(bad).valid,false);assert.equal((await f.a.importText(JSON.stringify(bad))).ok,false);const b=f.a.backupObject();b.projects=[bad];assert.equal(f.a.restorePreflight(b,{settings:false,projects:true}).ok,false)});
test('capacity and history boundaries reject without dropping original data',()=>{const f=fixture(),p=f.a.pcmImport(f.p,f.pcm,'a'),id=p.pcmMix.assets[0].id;p.pcmMix.assets[0].gains=Array(65).fill(0);p.pcmMix.assets[0].cursor=64;assert.throws(()=>f.a.pcmAdopt(p,f.a.pcmPreview(p,id,-6)),/history-capacity/);p.pcmMix.assets[0].gains[1]='2';assert.throws(()=>f.a.pcmPreview(p,id,0),/gain/)});
test('UI escapes imported name and says partial DSP and incomplete AI/export',async()=>{const f=await ready();f.p.pcmMix.assets[0].name='<img src=x onerror=x>';f.a.state.projects=[f.p];const html=f.a.pcmMixView('p');assert.ok(html.includes('&lt;img'));assert.doesNotMatch(html,/<img src=x/);assert.match(html,/部分実装/);assert.match(html,/一括Exportは未実装/);assert.equal(f.a.FEATURES.find(x=>x.id==='mixing').status,'working')});
test('A/B playback creates distinct actual buffers, stops previous source and exports applied WAV',async()=>{const f=await ready(),calls=[];f.w.AudioContext=class{createBufferSource(){return{connect(){},start(){calls.push('start')},stop(){calls.push('stop')}}}createBuffer(c,n,rate){return{copyToChannel(x,i){calls.push([i,...x])}}}resume(){return Promise.resolve()}close(){return Promise.resolve()}};assert.equal((await f.a.pcmListen('p','A')).ok,true);const a=calls.find(Array.isArray);assert.equal((await f.a.pcmListen('p','B')).ok,true);assert.ok(calls.includes('stop'));const arrays=calls.filter(Array.isArray);assert.ok(Math.abs(arrays[2][2]-.25*10**(-6/20))<1e-7);assert.equal(a[2],.25);f.a.pcmCancel();assert.equal((await f.a.pcmListen('p','B')).ok,false);const output=f.a.pcmDownload('p');assert.deepEqual(plain(f.a.pcmDecodeWav(output.buffer)),f.pcm)});

function transactionDB(){const stores=new Map(),control={failPut:false,delayComplete:0};return{control,open(){const open={};queueMicrotask(()=>{open.result={objectStoreNames:{contains:n=>stores.has(n)},createObjectStore(n){stores.set(n,new Map());return{createIndex(){}}},close(){},transaction(name){let active=true,pending=0,scheduled=false;const original=stores.get(name),staged=new Map(original),tx={abort(){if(!active)return;active=false;queueMicrotask(()=>tx.onabort?.())},objectStore(){const req=operation=>{const r={};pending++;queueMicrotask(()=>{if(!active)return;try{r.result=operation();r.onsuccess?.()}catch(e){r.error=e;r.onerror?.()}pending--;if(active&&pending===0&&!scheduled){scheduled=true;setTimeout(()=>{if(active){active=false;stores.set(name,staged);tx.oncomplete?.()}},control.delayComplete)}});return r};return{get:id=>req(()=>staged.has(id)?plain(staged.get(id)):undefined),put:item=>req(()=>{if(control.failPut)throw Error('quota-exceeded');staged.set(item.projectId||item.id,plain(item));return item.projectId||item.id}),getAll:()=>req(()=>[...staged.values()].map(plain))}}};return tx}};open.onupgradeneeded?.();open.onsuccess?.()});return open}}}

async function indexedPcm(){const f=await ready(),db=transactionDB();f.w.indexedDB=db;const repo=f.a.indexedDbRepository();await repo.put(f.p);f.a.setRepository(repo);return{...f,db,repo}}
test('PCM IndexedDB Apply waits for transaction commit and reopens actual original/gain',async()=>{const f=await indexedPcm();f.db.control.delayComplete=25;let done=false;const work=f.a.pcmApply('p').then(r=>{done=true;return r});await new Promise(r=>setTimeout(r,5));assert.equal(done,false);assert.equal(f.a.pcmEditor.busy,true);assert.equal((await work).ok,true);const saved=await f.repo.get('p');assert.deepEqual(plain(saved.pcmMix.assets[0].original),f.pcm);assert.equal(saved.pcmMix.assets[0].gains[1],-6)});
test('PCM IndexedDB quota failure aborts all writes and allows retry',async()=>{const f=await indexedPcm();f.db.control.failPut=true;assert.equal((await f.a.pcmApply('p')).ok,false);assert.deepEqual(plain(await f.repo.get('p')),plain(f.p));assert.ok(f.a.pcmEditor.preview);f.db.control.failPut=false;assert.equal((await f.a.pcmApply('p')).ok,true)});
test('PCM IndexedDB compare-and-put rejects competing tab at readwrite boundary',async()=>{const f=await indexedPcm();await f.repo.put({...f.p,productionNotes:'competing tab'});assert.equal((await f.a.pcmApply('p')).ok,false);assert.equal((await f.repo.get('p')).productionNotes,'competing tab')});
test('Preview Cancel is read-only and leaving route invalidates pending operation',async()=>{const f=await ready(),before=JSON.stringify(await f.repo.get('p'));f.a.pcmCancel();assert.equal(f.a.pcmEditor.preview,null);assert.equal(JSON.stringify(await f.repo.get('p')),before);f.a.pcmEditor.preview=f.a.pcmPreview(f.p,f.a.pcmEditor.assetId,-6);const get=f.repo.get;f.repo.get=async id=>{f.a.renderRoute('#music-studio');return get(id)};assert.equal((await f.a.pcmApply('p')).ok,false);assert.equal(JSON.stringify(await get('p')),before)});

test('EQ actually transforms samples deterministically without mutating source',()=>{
  const{a,pcm}=fixture(),before=JSON.stringify(pcm),out=a.pcmEq(pcm,2000,6,1);
  assert.equal(JSON.stringify(pcm),before);
  assert.notDeepEqual(plain(out.channels),plain(pcm.channels));
  assert.deepEqual(plain(a.pcmEq(pcm,2000,6,1)),plain(out));
  assert.deepEqual(plain(a.pcmEq(pcm,2000,0).channels),plain(pcm.channels));
  assert.notStrictEqual(a.pcmEq(pcm,2000,0).channels[0],pcm.channels[0]);
});
test('EQ processes stereo independently and leaves silent channel silent',()=>{
  const{a}=fixture(),pcm={sampleRate:48000,channels:[[1,...Array(127).fill(0)],Array(128).fill(0)]};
  const out=a.pcmEq(pcm,1000,-6,1);
  assert.ok(out.channels[0].some((v,i)=>Math.abs(v-pcm.channels[0][i])>1e-7));
  assert.ok(out.channels[1].every(v=>v===0));
  assert.equal(a.pcmAnalyze(out).frames,128);
});
for(const [freq,gain,q] of [[NaN,1,1],[Infinity,1,1],[0,1,1],[22000,1,1],[1000,19,1],[1000,-19,1],[1000,1,0],[1000,1,11],[1000,'6',1]])test('EQ fails closed on invalid coefficients '+String(freq)+':'+String(gain)+':'+String(q),()=>{
  const{a,pcm}=fixture();assert.throws(()=>a.pcmEq(pcm,freq,gain,q),/invalid-pcm-eq/);
});

test('EQ preview computes real peak and commits EQ without rewriting original PCM',async()=>{
 const f=await ready(),id=f.a.pcmEditor.assetId,original=JSON.stringify(await f.repo.get('p'));
 const eq={frequency:1000,gainDb:6,q:1},preview=f.a.pcmEqPreview(f.p,id,eq);
 assert.equal(preview.kind,'eq-preview-only');
 assert.notEqual(preview.before.peak,preview.after.peak);
 f.a.pcmEditor.preview=preview;
 const result=await f.a.pcmApply('p');
 assert.equal(result.ok,true);
 assert.notEqual(JSON.stringify(await f.repo.get('p')),original);
 assert.deepEqual(plain((await f.repo.get('p')).pcmMix.assets[0].original),plain(f.p.pcmMix.assets[0].original));
 const changed={...preview,eq:{...eq,gainDb:-6}};
 assert.notDeepEqual(plain(f.a.pcmEqPreview(f.p,id,changed.eq).after),plain(preview.after));
});

test('EQ applied signal is used by Gain preview, A/B and WAV render, and EQ Undo/Redo protects unrelated data',async()=>{
 const f=await ready(),id=f.a.pcmEditor.assetId,pcmBefore=plain(f.p.pcmMix.assets[0].original),baseline=plain(f.p.midiData);
 const eq={frequency:1000,gainDb:-6,q:1};f.a.pcmEditor.preview=f.a.pcmEqPreview(f.p,id,eq);
 assert.equal((await f.a.pcmApply('p')).ok,true);
 let saved=await f.repo.get('p');assert.equal(saved.pcmMix.assets[0].eqHistory.cursor,1);
 assert.deepEqual(plain(saved.pcmMix.assets[0].original),pcmBefore);assert.deepEqual(plain(saved.midiData),baseline);
 assert.deepEqual(plain(f.a.pcmRenderAsset(saved.pcmMix.assets[0]).channels),plain(f.a.pcmEq(f.a.pcmGain(saved.pcmMix.assets[0].original,0),1000,-6,1).channels));
 assert.equal(f.a.pcmPreview(saved,id,-3).before.peak,f.a.pcmAnalyze(f.a.pcmRenderAsset(saved.pcmMix.assets[0])).peak);
 assert.equal((await f.a.pcmUndoRedoEq('p',-1)).ok,true);
 saved=await f.repo.get('p');assert.equal(saved.pcmMix.assets[0].eqHistory.cursor,0);
 assert.deepEqual(plain(f.a.pcmRenderAsset(saved.pcmMix.assets[0])),plain(f.p.pcmMix.assets[0].original));
 assert.equal((await f.a.pcmUndoRedoEq('p',1)).ok,true);
 saved=await f.repo.get('p');assert.equal(saved.pcmMix.assets[0].eqHistory.cursor,1);
 assert.deepEqual(plain(saved.midiData),baseline);
});
test('EQ history validates imported state and preview cannot adopt after state drift',()=>{
 const f=fixture();let p=f.a.pcmImport(f.p,f.pcm,'eq'),id=p.pcmMix.assets[0].id;
 const eq={frequency:1200,gainDb:3,q:1},preview=f.a.pcmEqPreview(p,id,eq);
 preview.after.peak=999;assert.throws(()=>f.a.pcmEqAdopt(p,preview),/stale-or-modified/);
 p=f.a.pcmEqAdopt(p,f.a.pcmEqPreview(p,id,eq));
 assert.equal(f.a.validateProject(JSON.parse(JSON.stringify(p))).valid,true);
 const bad=JSON.parse(JSON.stringify(p));bad.pcmMix.assets[0].eqHistory.cursor=500;
 assert.equal(f.a.validateProject(bad).valid,false);
 const stale=f.a.pcmEqPreview(p,id,{frequency:1200,gainDb:4,q:1});stale.baseline='stale';
 assert.throws(()=>f.a.pcmEqAdopt(p,stale),/stale-or-modified/);
});

test('real stereo-linked compressor attenuates sustained signal and preserves original',()=>{
 const{a}=fixture(),pcm={sampleRate:8000,channels:[Array(3000).fill(.8),Array(3000).fill(-.8)]},original=JSON.stringify(pcm);
 const out=a.pcmCompress(pcm,{thresholdDb:-20,ratio:4,attackMs:.1,releaseMs:100});
 assert.equal(JSON.stringify(pcm),original);
 assert.ok(out.channels[0][2999]>0&&out.channels[0][2999]<.45);
 assert.equal(out.channels[0][2999],-out.channels[1][2999]);
 assert.deepEqual(plain(a.pcmCompress(pcm,{thresholdDb:-20,ratio:1,attackMs:10,releaseMs:100})),pcm);
});
test('compressor silence passes unchanged and envelope release recovers gain',()=>{
 const{a}=fixture(),v={thresholdDb:-20,ratio:4,attackMs:.1,releaseMs:10};
 assert.deepEqual(plain(a.pcmCompress({sampleRate:8000,channels:[[0,0,0]]},v).channels),[[0,0,0]]);
 const pcm={sampleRate:8000,channels:[[...Array(3000).fill(.8),...Array(3000).fill(.03)]]};
 const out=a.pcmCompress(pcm,v).channels[0];
 assert.ok(out[3000]<.03);
 assert.ok(out[5999]>out[3000]);
});
for(const [name,s] of [
 ['threshold',{thresholdDb:-61,ratio:4,attackMs:10,releaseMs:100}],
 ['ratio',{thresholdDb:-12,ratio:0,attackMs:10,releaseMs:100}],
 ['attack',{thresholdDb:-12,ratio:4,attackMs:0,releaseMs:100}],
 ['release',{thresholdDb:-12,ratio:4,attackMs:10,releaseMs:Infinity}],
 ['typed',{thresholdDb:'-12',ratio:4,attackMs:10,releaseMs:100}]
])test('compressor rejects invalid '+name,()=>{const{a,pcm}=fixture();assert.throws(()=>a.pcmCompress(pcm,s),/invalid-pcm-compressor/);});

test('Compression persists atomically, retains original and provides EQ-compatible Undo/Redo',async()=>{
 const f=await ready(),id=f.a.pcmEditor.assetId,original=plain(f.p.pcmMix.assets[0].original),midi=plain(f.p.midiData);
 const settings={thresholdDb:-24,ratio:4,attackMs:.1,releaseMs:30},preview=f.a.pcmCompressorPreview(f.p,id,settings);
 assert.equal(preview.kind,'compressor-preview');
 assert.ok(preview.after.peak<preview.before.peak);
 f.a.pcmEditor.preview=preview;assert.equal((await f.a.pcmApply('p')).ok,true);
 let p=await f.repo.get('p'),asset=p.pcmMix.assets[0];
 assert.equal(asset.compressorHistory.cursor,1);
 assert.deepEqual(plain(asset.original),original);assert.deepEqual(plain(p.midiData),midi);
 const rendered=f.a.pcmRenderAsset(asset);
 assert.deepEqual(plain(rendered),plain(f.a.pcmCompress(f.a.pcmGain(asset.original,0),settings)));
 const json=await f.a.exportProject('p');assert.equal(json.text.includes('compressorHistory'),true);
 assert.equal((await f.a.pcmUndoRedoCompressor('p',-1)).ok,true);
 p=await f.repo.get('p');assert.equal(p.pcmMix.assets[0].compressorHistory.cursor,0);
 assert.deepEqual(plain(f.a.pcmRenderAsset(p.pcmMix.assets[0])),original);
 assert.equal((await f.a.pcmUndoRedoCompressor('p',1)).ok,true);
 p=await f.repo.get('p');assert.equal(p.pcmMix.assets[0].compressorHistory.cursor,1);
 assert.deepEqual(plain(p.midiData),midi);
});
test('Compression preview invalidation and corrupt history fail closed',()=>{
 const f=fixture();let p=f.a.pcmImport(f.p,f.pcm,'vocal.wav'),id=p.pcmMix.assets[0].id;
 const settings={thresholdDb:-24,ratio:3,attackMs:1,releaseMs:100};
 const preview=f.a.pcmCompressorPreview(p,id,settings);
 preview.after.peak=-3;assert.throws(()=>f.a.pcmCompressorAdopt(p,preview),/stale-or-modified/);
 p=f.a.pcmCompressorAdopt(p,f.a.pcmCompressorPreview(p,id,settings));
 const invalid=plain(p);invalid.pcmMix.assets[0].compressorHistory.settings[1].ratio=100;
 assert.equal(f.a.validateProject(invalid).valid,false);
 assert.equal(f.a.validateProject(plain(p)).valid,true);
 assert.throws(()=>f.a.pcmCompressorAdopt(p,{...f.a.pcmCompressorPreview(p,id,{...settings,ratio:5}),baseline:'outdated'}),/stale-or-modified/);
});
test('Compression applied WAV bytes equal quantized rendered samples',()=>{
 const f=fixture();let p=f.a.pcmImport(f.p,{sampleRate:8000,channels:[Array(320).fill(.5)]},'vocal.wav'),id=p.pcmMix.assets[0].id;
 p=f.a.pcmCompressorAdopt(p,f.a.pcmCompressorPreview(p,id,{thresholdDb:-20,ratio:4,attackMs:.1,releaseMs:50}));
 const pcm=f.a.pcmRenderAsset(p.pcmMix.assets[0]),round=f.a.pcmDecodeWav(f.a.pcmEncodeWav(pcm));
 for(let i=0;i<pcm.channels[0].length;i++)assert.ok(Math.abs(round.channels[0][i]-pcm.channels[0][i])<=1/32768);
});

test('chunk DSP equals continuous full Gain/EQ/Compression across arbitrary boundaries',()=>{
 const f=fixture(),a=f.a,frames=2500,pcm={sampleRate:8000,channels:[
  Array.from({length:frames},(_,i)=>Math.sin(i*.031)*.7),
  Array.from({length:frames},(_,i)=>Math.cos(i*.047)*.5)]};
 const gain=2.5,eq={frequency:750,gainDb:5,q:1.3},compressor={thresholdDb:-18,ratio:3,attackMs:2,releaseMs:60};
 const reference=a.pcmCompress(a.pcmEq(a.pcmGain(pcm,gain),eq.frequency,eq.gainDb,eq.q),compressor);
 const splits=[137,1,503,204,711,944],parts=[],original=JSON.stringify(pcm);let start=0;
 for(const n of splits){parts.push({sampleRate:8000,channels:pcm.channels.map(ch=>ch.slice(start,start+n))});start+=n}
 assert.equal(start,frames);
 const result=Array.from(a.pcmProcessChunks(parts,{sampleRate:8000,channelCount:2,gainDb:gain,eq,compressor}));
 assert.equal(JSON.stringify(pcm),original);
 for(let c=0;c<2;c++){const joined=result.flatMap(part=>part.channels[c]);assert.equal(joined.length,frames);
  for(let i=0;i<frames;i++)assert.ok(Math.abs(joined[i]-reference.channels[c][i])<1e-12,'difference at '+c+':'+i);}
});
test('chunk processor streams beyond previous whole-project sample cap without concatenating full track',()=>{
 const a=fixture().a,part={sampleRate:8000,channels:[Array(40000).fill(.125)]};
 let provided=0,observed=0,count=0;
 function* input(){for(let i=0;i<51;i++){provided++;yield part}}
 for(const output of a.pcmProcessChunks(input(),{sampleRate:8000,channelCount:1,gainDb:0})){
  observed+=output.channels[0].length;count++;
  assert.equal(output.channels[0].length,40000);
  assert.equal(output.channels[0][0],.125);
 }
 assert.equal(provided,51);assert.equal(count,51);assert.equal(observed,2040000);
 assert.ok(observed>a.PCM_LIMIT);
});
test('stream rejects malformed chunk or format switch instead of corrupting original',()=>{
 const a=fixture().a,good={sampleRate:8000,channels:[[0,.5]]};
 assert.throws(()=>Array.from(a.pcmProcessChunks([],{sampleRate:8000,channelCount:1})),/pcm-stream-empty/);
 assert.throws(()=>Array.from(a.pcmProcessChunks([good,{sampleRate:16000,channels:[[0]]}],{sampleRate:8000,channelCount:1})),/pcm-stream-format-changed/);
 assert.throws(()=>Array.from(a.pcmProcessChunks([good],{sampleRate:8000,channelCount:1,gainDb:Infinity})),/invalid-pcm-gain/);
 assert.throws(()=>Array.from(a.pcmProcessChunks([good],{sampleRate:8000,channelCount:1,compressor:{thresholdDb:0,ratio:100,attackMs:10,releaseMs:100}})),/invalid-pcm-compressor/);
 assert.throws(()=>Array.from(a.pcmProcessChunks([{sampleRate:8000,channels:[[NaN]]}],{sampleRate:8000,channelCount:1})),/invalid-pcm-sample/);
 assert.deepEqual(plain(good),{sampleRate:8000,channels:[[0,.5]]});
});
