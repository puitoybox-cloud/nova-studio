const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
// Transactional IDB model: binary structured cloning, commit, abort and reopen.
// Physical browser persistence is a separate acceptance test.
function idb(){const stores=new Map();let fault=false;const db={close(){},objectStoreNames:{contains:n=>stores.has(n)},createObjectStore(n){stores.set(n,new Map());return{createIndex(){}}},transaction(names,mode){names=Array.isArray(names)?names:[names];const staged=new Map(names.map(n=>[n,new Map(stores.get(n))]));let pending=0,aborted=false,timer;const tx={abort(){if(aborted)return;aborted=true;clearImmediate(timer);setImmediate(()=>tx.onabort?.())},objectStore(n){const map=staged.get(n);function req(op){pending++;const r={};setImmediate(()=>{if(aborted)return;try{r.result=op();r.onsuccess?.()}catch(e){r.error=e;r.onerror?.();tx.abort()}pending--;if(!pending&&!aborted){timer=setImmediate(()=>{if(aborted)return;if(mode==='readwrite')for(const[n,m]of staged)stores.set(n,m);tx.oncomplete?.()})}});return r}return{delete:k=>req(()=>map.delete(k)),get:k=>req(()=>structuredClone(map.get(k))),getAll:()=>req(()=>structuredClone([...map.values()])),getKey:k=>req(()=>map.has(k)?k:undefined),put:v=>req(()=>{if(fault)throw Error('QuotaExceededError');map.set((n==='projects'?v.projectId:v.id||v.backupId||v.projectId),structuredClone(v))}),add:v=>req(()=>{if(fault)throw Error('QuotaExceededError');const key=(n==='projects'?v.projectId:v.id||v.backupId||v.projectId);if(map.has(key))throw Error('ConstraintError');map.set(key,structuredClone(v))})}}};return tx}};return{stores,fail(){fault=true},open(){const r={};setImmediate(()=>{r.result=db;r.onupgradeneeded?.();r.onsuccess?.()});return r}}}
let fixtureId=0;
function fixture(indexedDB=idb()){const instance=++fixtureId;let seq=0;const w={console,Date,Math,JSON,Intl,Blob,ArrayBuffer,DataView,Float32Array,Uint8Array,crypto:{subtle:webcrypto.subtle,randomUUID:()=>`long-${instance}-${++seq}`},indexedDB,location:{hash:'#music-studio'}};w.window=w;vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),w);const a=w.MusicStudio;return{a,indexedDB,w}}
function wav(frames=2100000){const b=new ArrayBuffer(44+frames*2),v=new DataView(b),tag=(p,s)=>[...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt()));tag(0,'RIFF');v.setUint32(4,b.byteLength-8,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);tag(36,'data');v.setUint32(40,frames*2,true);const file=new Blob([b],{type:'audio/wav'});file.name='long.wav';return file}
async function setup(){const f=fixture(),a=f.a,repo=a.indexedDbRepository(),p=a.makeProject({projectId:'long-project',projectName:'Long',midiData:{unchanged:true},legacy:{keep:true}});a.setRepository(repo);await repo.put(p);a.state.projects=[p];a.pcmOpen(p.projectId);return{...f,repo,p}}
test('real import route stores >2M samples as Blob and a fresh repository reload verifies every byte',async()=>{const{a,repo,p,indexedDB}=await setup(),file=wav();file.arrayBuffer=()=>{throw Error('whole-file-read-forbidden')};const result=await a.pcmImportFile(file,p.projectId);assert.equal(result.ok,true,result.error);assert.equal(result.project.longWavAssets[0].frames,2100000);assert.deepEqual(JSON.parse(JSON.stringify(result.project.midiData)),{unchanged:true});await repo.close();const fresh=fixture(indexedDB);fresh.a.setRepository(fresh.a.indexedDbRepository());const blob=await fresh.a.pcmLoadLongWav(p.projectId,result.assetId);assert.equal(blob.size,file.size);assert.equal(Buffer.compare(Buffer.from(await blob.arrayBuffer()),Buffer.from(await Blob.prototype.arrayBuffer.call(file))),0)});
test('quota abort preserves metadata and exposes no orphan binary',async()=>{const{a,p,repo,indexedDB}=await setup(),before=JSON.stringify(await repo.get(p.projectId));indexedDB.fail();const r=await a.pcmImportLongFile(wav(100),p.projectId);assert.equal(r.ok,false);assert.match(r.error,/Quota/);assert.equal(JSON.stringify(await repo.get(p.projectId)),before);assert.equal(indexedDB.stores.get('longWavBinaries').size,0)});
test('concurrent project update is rejected without binary writes',async()=>{const{a,p,repo,indexedDB}=await setup();await repo.put({...p,revision:20});const r=await a.pcmImportLongFile(wav(100),p.projectId);assert.equal(r.ok,false);assert.match(r.error,/conflict/);assert.equal(indexedDB.stores.get('longWavBinaries').size,0);assert.equal((await repo.get(p.projectId)).revision,20)});
test('interrupted validation cannot commit',async()=>{const{a,p,indexedDB}=await setup(),file=wav(100),slice=file.slice.bind(file);file.slice=(...args)=>{a.pcmEditor.generation++;return slice(...args)};const r=await a.pcmImportLongFile(file,p.projectId);assert.equal(r.ok,false);assert.match(r.error,/stale/);assert.equal(indexedDB.stores.get('longWavBinaries').size,0)});
test('corrupt or missing binary is rejected; JSON backup cannot claim success',async()=>{const{a,p,indexedDB}=await setup(),r=await a.pcmImportLongFile(wav(100),p.projectId);assert.equal(r.ok,true);const rec=indexedDB.stores.get('longWavBinaries').get(r.assetId);rec.blob=new Blob([new Uint8Array(rec.blob.size)]);await assert.rejects(a.pcmLoadLongWav(p.projectId,r.assetId),/corrupt/);assert.equal((await a.exportBackup()).ok,false);a.state.settings=a.defaultSettings();a.state.settings.backup.automaticEnabled=true;assert.equal((await a.runAutoBackupCheck()).created,false);const backup=a.backupObject();assert.equal((await a.inspectBackupCompleteness(backup)).fullBackupComplete,false);assert.equal((await a.restoreBackup(backup,{settings:false,projects:true})).ok,false);indexedDB.stores.get('longWavBinaries').delete(r.assetId);await assert.rejects(a.pcmLoadLongWav(p.projectId,r.assetId),/missing/)});
test('memory fallback refuses durable long-audio save',async()=>{const{a}=fixture();a.setRepository(a.memoryRepository());const p=a.makeProject({projectId:'p',projectName:'p'});a.state.projects=[p];a.pcmOpen('p');assert.match((await a.pcmImportLongFile(wav(100),'p')).error,/durable/)});

test('portable archive restores every original byte, PCM/MIDI/unknown fields and settings atomically into fresh storage',async()=>{
 const src=await setup();src.p=src.a.pcmImport(src.p,{sampleRate:8000,channels:[[0,0.25,-0.25,0]]},'short.wav');await src.repo.put(src.p);src.a.state.projects=[src.p];const r=await src.a.pcmImportLongFile(wav(2100000),src.p.projectId);assert.equal(r.ok,true);
 const archive=await src.a.createLongWavArchive();archive.arrayBuffer=()=>{throw Error('whole-archive-read-forbidden')};
 const dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());
 const restored=await dst.a.restoreLongWavArchive(archive);assert.equal(restored.ok,true,restored.error);assert.equal(restored.projects.length,1);
 const p=restored.projects[0];assert.notEqual(p.projectId,src.p.projectId);assert.deepEqual(JSON.parse(JSON.stringify(p.midiData)),{unchanged:true});assert.deepEqual(JSON.parse(JSON.stringify(p.legacy)),{keep:true});assert.equal(JSON.stringify(p.pcmMix),JSON.stringify(src.p.pcmMix));
 const original=await src.a.pcmLoadLongWav(src.p.projectId,r.assetId),copy=await dst.a.pcmLoadLongWav(p.projectId,p.longWavAssets[0].id);
 assert.equal(Buffer.compare(Buffer.from(await original.arrayBuffer()),Buffer.from(await copy.arrayBuffer())),0);
});
test('archive missing, corrupt and trailing bytes fail before any restore writes',async()=>{
 const src=await setup();await src.a.pcmImportLongFile(wav(100),src.p.projectId);const archive=await src.a.createLongWavArchive();
 const bytes=new Uint8Array(await archive.arrayBuffer());bytes[bytes.length-1]^=1;
 for(const bad of [archive.slice(0,archive.size-1),new Blob([bytes]),new Blob([archive,new Uint8Array(1)])]){
 const dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());const r=await dst.a.restoreLongWavArchive(bad);assert.equal(r.ok,false);assert.equal((await dst.a.indexedDbRepository().list()).length,0);assert.equal(dst.indexedDB.stores.get('longWavBinaries').size,0);
 }
});
test('archive quota failure rolls back projects, bytes and settings; cancellation writes nothing',async()=>{
 const src=await setup();await src.a.pcmImportLongFile(wav(100),src.p.projectId);const archive=await src.a.createLongWavArchive();
 const dst=await setup();const settings=dst.a.defaultSettings();await dst.repo.putSettings(settings);const before=JSON.stringify(await dst.repo.list());dst.indexedDB.fail();
 const r=await dst.a.restoreLongWavArchive(archive);assert.equal(r.ok,false);assert.match(r.error,/Quota/);assert.equal(JSON.stringify(await dst.repo.list()),before);assert.equal(JSON.stringify(await dst.repo.getSettings()),JSON.stringify(settings));assert.equal(dst.indexedDB.stores.get('longWavBinaries').size,0);
 const cancelled=await src.a.restoreLongWavArchive(archive,{signal:{aborted:true}});assert.equal(cancelled.ok,false);assert.match(cancelled.error,/cancelled/);
});
test('archive refuses omitted external binaries and corrupted source bytes',async()=>{
 const src=await setup();await src.a.pcmImportLongFile(wav(100),src.p.projectId);const p=await src.repo.get(src.p.projectId);p.fileReferences=[{name:'missing.wav'}];await src.repo.put(p);await assert.rejects(src.a.createLongWavArchive(),/external/);
 p.fileReferences=[];await src.repo.put(p);const record=src.indexedDB.stores.get('longWavBinaries').get(p.longWavAssets[0].id);record.blob=new Blob([new Uint8Array(record.blob.size)]);await assert.rejects(src.a.createLongWavArchive(),/corrupt/);
});
test('archive cancellation during byte verification and changed editor state reject all writes',async()=>{
 const src=await setup();await src.a.pcmImportLongFile(wav(100),src.p.projectId);const archive=await src.a.createLongWavArchive();
 for(const mode of ['cancel','state']){const dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());const signal={aborted:false},wrapped=new Blob([archive]),slice=wrapped.slice.bind(wrapped);let reads=0;wrapped.slice=(...args)=>{const part=slice(...args);if(++reads===3){if(mode==='cancel')signal.aborted=true;else dst.a.state.dirty=true}return part};
 const r=await dst.a.restoreLongWavArchive(wrapped,{signal});assert.equal(r.ok,false);assert.equal((await dst.a.indexedDbRepository().list()).length,0);assert.equal(dst.indexedDB.stores.get('longWavBinaries').size,0)}
});
test('repeated archive recovery never overwrites original or previously recovered song identities',async()=>{
 const src=await setup();await src.a.pcmImportLongFile(wav(100),src.p.projectId);const archive=await src.a.createLongWavArchive(),before=JSON.stringify(await src.repo.get(src.p.projectId));
 for(let i=0;i<2;i++){const r=await src.a.restoreLongWavArchive(archive);assert.equal(r.ok,true,r.error);const p=r.projects[0];assert.equal((await src.a.pcmLoadLongWav(p.projectId,p.longWavAssets[0].id)).size,244)}
 assert.equal(JSON.stringify(await src.repo.get(src.p.projectId)),before);assert.equal((await src.repo.list()).length,3);assert.equal(src.indexedDB.stores.get('longWavBinaries').size,3);
});

test('long mix actual chunk output, settings Undo/Redo, reopen and archive retain originals/MIDI',async()=>{
 const src=await setup(),r=await src.a.pcmImportLongFile(wav(2100000),src.p.projectId);assert.equal(r.ok,true);
 const a=src.a,settings={gainDb:-6,eq:{frequency:1000,gainDb:2,q:1},compressor:{thresholdDb:-20,ratio:3,attackMs:10,releaseMs:100}};
 const preview=await a.longMixPreview(src.p.projectId,r.assetId,settings);assert.equal(preview.ok,true,preview.error);assert.equal(preview.frames,2100000);assert.equal(preview.blob.size,4200044);
 assert.equal((await a.longMixSave(src.p.projectId,r.assetId)).ok,true);assert.equal((await a.longMixSave(src.p.projectId,r.assetId,-1)).ok,true);assert.equal((await a.longMixSave(src.p.projectId,r.assetId,1)).ok,true);
 const fresh=fixture(src.indexedDB);fresh.a.setRepository(fresh.a.indexedDbRepository());const saved=await src.repo.get(src.p.projectId);fresh.a.state.projects=[saved];fresh.a.pcmOpen(saved.projectId);
 const output=await fresh.a.longMixExport(saved.projectId,r.assetId);assert.equal(output.ok,true,output.error);assert.equal(output.frames,2100000);assert.match(output.filename,/-mix.wav$/);
 assert.equal(JSON.stringify(saved.midiData),JSON.stringify(src.p.midiData));const original=await fresh.a.pcmLoadLongWav(saved.projectId,r.assetId);assert.equal(Buffer.compare(Buffer.from(await original.arrayBuffer()),Buffer.from(await wav(2100000).arrayBuffer())),0);
 const dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());const restored=await dst.a.restoreLongWavArchive(await fresh.a.createLongWavArchive());assert.equal(restored.ok,true,restored.error);assert.equal(JSON.stringify(restored.projects[0].longWavAssets[0].mixHistory),JSON.stringify(saved.longWavAssets[0].mixHistory));
 assert.match(a.pcmMixView(saved.projectId),/Processed WAV/);
});
test('long mix quota/save conflicts and cancellation preserve song and original bytes',async()=>{
 for(const mode of ['quota','conflict','cancel']){const f=await setup(),{a,p,repo,indexedDB}=f,r=await a.pcmImportLongFile(wav(100),p.projectId),settings={gainDb:-6,eq:{frequency:1000,gainDb:0,q:1},compressor:{thresholdDb:-20,ratio:1,attackMs:10,releaseMs:100}};
 assert.equal((await a.longMixPreview(p.projectId,r.assetId,settings)).ok,true);const before=JSON.stringify(await repo.get(p.projectId));
 if(mode==='quota')indexedDB.fail();else if(mode==='conflict')await repo.put({...await repo.get(p.projectId),revision:30});else a.longMixCancel();
 const saved=await a.longMixSave(p.projectId,r.assetId);assert.equal(saved.ok,false);assert.equal(JSON.stringify(await repo.get(p.projectId)),mode==='conflict'?JSON.stringify({...JSON.parse(before),revision:30}):before);assert.equal(indexedDB.stores.get('longWavBinaries').size,1);
 }
});
test('long mix render rejects corrupt bytes, invalid settings, clipping, stale state and aborted signal',async()=>{
 const f=await setup(),{a,p,indexedDB}=f,r=await a.pcmImportLongFile(wav(100),p.projectId),settings={gainDb:-6,eq:{frequency:1000,gainDb:0,q:1},compressor:{thresholdDb:-20,ratio:1,attackMs:10,releaseMs:100}};
 assert.equal((await a.longMixRender(p.projectId,r.assetId,settings,{signal:{aborted:true}})).ok,false);
 assert.equal((await a.longMixRender(p.projectId,r.assetId,{...settings,gainDb:NaN})).ok,false);
 const rec=indexedDB.stores.get('longWavBinaries').get(r.assetId),get=f.repo.getLongWav;f.repo.getLongWav=async id=>{const result=await get(id);a.longMixCancel();return result};assert.equal((await a.longMixRender(p.projectId,r.assetId,settings)).ok,false);f.repo.getLongWav=get;
 rec.blob=new Blob([new Uint8Array(rec.blob.size)]);assert.match((await a.longMixRender(p.projectId,r.assetId,settings)).error,/corrupt/);
 // Encoding fails closed after gain raises valid input above full scale.
 const b=await wav(100).arrayBuffer(),v=new DataView(b);for(let i=44;i<b.byteLength;i+=2)v.setInt16(i,30000,true);const loud=new Blob([b]);loud.name='loud.wav';const added=await a.pcmImportLongFile(loud,p.projectId);assert.equal(added.ok,true);assert.match((await a.longMixRender(p.projectId,added.assetId,{...settings,gainDb:24})).error,/clipp/);
});
test('long mix nonzero processed output equals continuous Gain/EQ/Compression and A/B use checked Blobs',async()=>{
 const f=await setup(),{a,p,w}=f,b=await wav(40000).arrayBuffer(),v=new DataView(b);for(let i=44;i<b.byteLength;i+=2)v.setInt16(i,Math.round(12000*Math.sin(i/13)),true);const source=new Blob([b]);source.name='signal.wav';const added=await a.pcmImportLongFile(source,p.projectId);
 const settings={gainDb:-6,eq:{frequency:1000,gainDb:3,q:1},compressor:{thresholdDb:-25,ratio:4,attackMs:5,releaseMs:100}};
 const preview=await a.longMixPreview(p.projectId,added.assetId,settings);assert.equal(preview.ok,true,preview.error);const expected=await a.pcmRenderLongWavBlob(source,settings,7000);
 assert.equal(Buffer.compare(Buffer.from(await preview.blob.arrayBuffer()),Buffer.from(await expected.blob.arrayBuffer())),0);assert.notEqual(Buffer.compare(Buffer.from(await preview.blob.arrayBuffer()),Buffer.from(b)),0);
 let n=0;const blobs=new Map();w.URL={createObjectURL:blob=>{const url='blob:'+ ++n;blobs.set(url,blob);return url},revokeObjectURL:url=>blobs.delete(url)};w.Audio=class{constructor(url){this.url=url}async play(){}pause(){}removeAttribute(){}load(){}};
 assert.equal((await a.longMixListen(p.projectId,added.assetId,'A')).ok,true);const A=await blobs.get(a.longMix.url).arrayBuffer();assert.equal((await a.longMixListen(p.projectId,added.assetId,'B')).ok,true);const B=await blobs.get(a.longMix.url).arrayBuffer();assert.notEqual(Buffer.compare(Buffer.from(A),Buffer.from(B)),0);a.longMixCancel();assert.equal(blobs.size,0);
});
test('long mix saves and Undo/Redo keep real AI workspace revision aligned without touching MIDI',async()=>{
 const f=await setup(),{a,p,w,repo}=f;vm.runInNewContext(fs.readFileSync('music-studio-ai-workflow.js','utf8'),w);p.midiData={ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},totalTick:480,tracks:[{id:'keep',part:'melody',notes:[{id:'n',pitch:60,startTick:0,durationTicks:480,velocity:80}]}]};p.aiWorkspace=w.MusicStudioAIWorkflow.createWorkspace(p);await repo.put(p);a.state.projects=[p];
 const imported=await a.pcmImportLongFile(wav(100),p.projectId);assert.equal(imported.ok,true,imported.error);const s={gainDb:-3,eq:{frequency:1000,gainDb:0,q:1},compressor:{thresholdDb:-20,ratio:1,attackMs:10,releaseMs:100}};assert.equal((await a.longMixPreview(p.projectId,imported.assetId,s)).ok,true);
 const saved=await a.longMixSave(p.projectId,imported.assetId);assert.equal(saved.ok,true,saved.error);assert.equal(saved.project.aiWorkspace.baseRevision,saved.project.revision);assert.equal(JSON.stringify(saved.project.midiData),JSON.stringify(p.midiData));
 for(const direction of [-1,1]){const r=await a.longMixSave(p.projectId,imported.assetId,direction);assert.equal(r.ok,true,r.error);assert.equal(r.project.aiWorkspace.baseRevision,r.project.revision)}
});
test('cancel during pending real compare-and-put aborts staged metadata before transaction completion',async()=>{
 const f=await setup(),{a,p,repo}=f,r=await a.pcmImportLongFile(wav(100),p.projectId),s={gainDb:-3,eq:{frequency:1000,gainDb:0,q:1},compressor:{thresholdDb:-20,ratio:1,attackMs:10,releaseMs:100}};assert.equal((await a.longMixPreview(p.projectId,r.assetId,s)).ok,true);const baseline=JSON.stringify(await repo.get(p.projectId)),compare=repo.compareAndPut;
 repo.compareAndPut=(item,base,guard)=>{const register=guard.registerAbort;guard.registerAbort=abort=>{register(abort);setImmediate(()=>a.longMixCancel())};return compare(item,base,guard)};
 const result=await a.longMixSave(p.projectId,r.assetId);assert.equal(result.ok,false);assert.match(result.error,/cancelled/);assert.equal(JSON.stringify(await repo.get(p.projectId)),baseline);assert.equal(a.longMix.abort,null);
});

function toneFile(a,frames=16000,frequency=100,amplitude=.35){const channels=[Array.from({length:frames},(_,i)=>amplitude*Math.sin(2*Math.PI*frequency*i/8000))],file=new Blob([a.pcmEncodeWav({sampleRate:8000,channels})]);file.name='measured.wav';return file}
test('measured real PCM RMS/peak/crest and frequency energy match known signals across chunk sizes',async()=>{
 const{a}=fixture();for(const frequency of [100,1000,3000]){const pcm={sampleRate:8000,channels:[Array.from({length:16000},(_,i)=>.5*Math.sin(2*Math.PI*frequency*i/8000))]};const whole=await a.mixMeasure([pcm]);assert.ok(Math.abs(whole.rms-.5/Math.sqrt(2))<1e-10);assert.ok(Math.abs(whole.peak-.5)<1e-10);assert.ok(Math.abs(whole.crestDb-3.0103)<.0001);assert.equal(whole.clippingSamples,0);const chunks=[];for(let i=0;i<16000;i+=137)chunks.push({sampleRate:8000,channels:[pcm.channels[0].slice(i,i+137)]});const split=await a.mixMeasure(chunks);assert.equal(JSON.stringify(split),JSON.stringify(whole));assert.ok(whole.bandFractions[frequency===100?0:frequency===1000?1:2]>.5)}
});
test('analysis rejects silence, clipping, malformed/changed format and cancellation without publishing proposals',async()=>{
 const{a}=fixture();for(const sample of [-1,1,32767/32768])assert.equal((await a.mixMeasure([{sampleRate:8000,channels:[[sample]]}])).clippingSamples,1);const saved={gainDb:0,eq:{frequency:1000,gainDb:0,q:1},compressor:{thresholdDb:-12,ratio:1,attackMs:10,releaseMs:100}};
 assert.throws(()=>a.mixPropose({rmsDb:null,peakDb:null},saved),/silence/);await assert.rejects(a.mixMeasure([{sampleRate:8000,channels:[[NaN]]}]),/sample/);await assert.rejects(a.mixMeasure([{sampleRate:8000,channels:[[.1]]},{sampleRate:16000,channels:[[.1]]}]),/format/);
 const f=await setup(),r=await f.a.pcmImportLongFile(wav(100),f.p.projectId);assert.equal((await f.a.longMixAnalyze(f.p.projectId,r.assetId)).ok,false);assert.equal(f.a.longMix.proposals,null);assert.equal((await f.a.longMixAnalyze(f.p.projectId,r.assetId,{signal:{aborted:true}})).ok,false);
 const file=new Blob([f.a.pcmEncodeWav({sampleRate:8000,channels:[[-1,0,.25]]})]);file.name='clipped.wav';const imported=await f.a.pcmImportLongFile(file,f.p.projectId);assert.match((await f.a.longMixAnalyze(f.p.projectId,imported.assetId)).error,/clipping/);
});
test('two measured proposals differ, partial adoption saves and fresh reopen/undo/redo/archive preserve settings and bytes',async()=>{
 const f=await setup(),{a,p,repo}=f,file=toneFile(a),r=await a.pcmImportLongFile(file,p.projectId),before=JSON.stringify(await repo.get(p.projectId));
 const result=await a.longMixAnalyze(p.projectId,r.assetId);assert.equal(result.ok,true,result.error);assert.equal(result.proposals.length,2);assert.notEqual(JSON.stringify(result.proposals[0].settings),JSON.stringify(result.proposals[1].settings));assert.ok(result.proposals[1].settings.eq.gainDb<0);assert.equal(JSON.stringify(await repo.get(p.projectId)),before);
 assert.equal((await a.longMixSelect(p.projectId,r.assetId,1,'eq')).ok,true);assert.equal(a.longMix.candidate.settings.gainDb,0);assert.equal(a.longMix.candidate.settings.compressor.ratio,1);assert.equal((await a.longMixSave(p.projectId,r.assetId)).ok,true);
 const saved=await repo.get(p.projectId),fresh=fixture(f.indexedDB);fresh.a.setRepository(fresh.a.indexedDbRepository());fresh.a.state.projects=[saved];fresh.a.pcmOpen(p.projectId);
 assert.ok(fresh.a.longMixHistory(saved.longWavAssets[0]).settings[1].eq.gainDb<0);assert.equal((await fresh.a.longMixSave(p.projectId,r.assetId,-1)).ok,true);assert.equal((await fresh.a.longMixSave(p.projectId,r.assetId,1)).ok,true);assert.equal((await fresh.a.longMixExport(p.projectId,r.assetId)).ok,true);
 const dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());const restored=await dst.a.restoreLongWavArchive(await fresh.a.createLongWavArchive());assert.equal(restored.ok,true);assert.equal(JSON.stringify(restored.projects[0].longWavAssets[0].mixHistory),JSON.stringify(saved.longWavAssets[0].mixHistory));assert.equal(JSON.stringify(saved.midiData),JSON.stringify(p.midiData));assert.equal(Buffer.compare(Buffer.from(await a.pcmLoadLongWav(p.projectId,r.assetId).then(b=>b.arrayBuffer())),Buffer.from(await file.arrayBuffer())),0);
});
test('proposals track measured amplitude and dynamics, without hardcoded settings',async()=>{
 const{a}=fixture(),saved={gainDb:0,eq:{frequency:1000,gainDb:0,q:1},compressor:{thresholdDb:-12,ratio:1,attackMs:10,releaseMs:100}};const results=[];
 for(const amp of [.1,.5]){const metrics=await a.mixMeasure(a.pcmDecodeWavStream(toneFile(a,16000,100,amp)));results.push(a.mixPropose(metrics,saved))}assert.notEqual(results[0][0].settings.gainDb,results[1][0].settings.gainDb);
 const pcm={sampleRate:8000,channels:[Array.from({length:16000},(_,i)=>(i%800<5?.8:.01)*Math.sin(2*Math.PI*100*i/8000))]},m=await a.mixMeasure([pcm]),v=a.mixPropose(m,saved)[1];assert.ok(v.settings.compressor.ratio>1);assert.ok(v.settings.compressor.thresholdDb<0);
});
test('analysis >2M frames only reads bounded slices and rejects a mid-analysis cancellation',async()=>{
 const f=await setup(),{a,p,repo}=f,raw=await wav(2100000).arrayBuffer(),view=new DataView(raw);for(let i=0;i<2100000;i++)view.setInt16(44+i*2,Math.round(10000*Math.sin(2*Math.PI*100*i/8000)),true);const file=new Blob([raw]);file.name='nonzero-long.wav';const r=await a.pcmImportLongFile(file,p.projectId),get=repo.getLongWav;let max=0,reads=0;
 repo.getLongWav=async id=>{const rec=await get(id),blob=rec.blob,slice=blob.slice.bind(blob);blob.arrayBuffer=()=>{throw Error('whole-read-forbidden')};blob.slice=(start,end)=>{max=Math.max(max,end-start);reads++;return slice(start,end)};return rec};
 const result=await a.longMixAnalyze(p.projectId,r.assetId);assert.equal(result.ok,true,result.error);assert.equal(result.before.frames,2100000);assert.ok(max<=1048576);assert.ok(reads>0&&reads<100);assert.equal(result.proposals[0].after.clippingSamples,0);
 const before=JSON.stringify(await repo.get(p.projectId));repo.getLongWav=async id=>{const rec=await get(id),slice=rec.blob.slice.bind(rec.blob);let n=0;rec.blob.slice=(...args)=>{if(++n===12)a.longMixCancel();return slice(...args)};return rec};assert.equal((await a.longMixAnalyze(p.projectId,r.assetId)).ok,false);assert.equal(a.longMix.proposals,null);assert.equal(JSON.stringify(await repo.get(p.projectId)),before);
});
test('measured selection stale/conflict/quota/cancel never saves unreviewed settings',async()=>{
 for(const mode of ['quota','conflict','cancel','tamper']){const f=await setup(),{a,p,repo,indexedDB}=f,r=await a.pcmImportLongFile(toneFile(a),p.projectId);assert.equal((await a.longMixAnalyze(p.projectId,r.assetId)).ok,true);const before=JSON.stringify(await repo.get(p.projectId));
 if(mode==='cancel'){a.longMixCancel();assert.equal((await a.longMixSelect(p.projectId,r.assetId,0)).ok,false);continue}
 if(mode==='tamper'){a.longMix.proposals.proposals[0].settings.gainDb=24;assert.equal((await a.longMixSelect(p.projectId,r.assetId,0)).ok,false);assert.equal(a.longMix.candidate,null);continue}
 assert.equal((await a.longMixSelect(p.projectId,r.assetId,1)).ok,true);if(mode==='quota')indexedDB.fail();else await repo.put({...await repo.get(p.projectId),revision:999});assert.equal((await a.longMixSave(p.projectId,r.assetId)).ok,false);assert.equal(JSON.stringify(await repo.get(p.projectId)),mode==='quota'?before:JSON.stringify({...JSON.parse(before),revision:999}));
 }
});
test('original A0 and measured candidate B use different actual audio Blobs, and cancel removes previews',async()=>{
 const f=await setup(),{a,p,w}=f,file=toneFile(a),r=await a.pcmImportLongFile(file,p.projectId),blobs=[],revoked=[];
 w.URL={createObjectURL:blob=>{blobs.push(blob);return 'blob:'+blobs.length},revokeObjectURL:u=>revoked.push(u)};w.Audio=class{pause(){}removeAttribute(){}load(){}async play(){}};
 assert.equal((await a.longMixAnalyze(p.projectId,r.assetId)).ok,true);assert.equal((await a.longMixSelect(p.projectId,r.assetId,0,'all')).ok,true);assert.equal((await a.longMixListen(p.projectId,r.assetId,'Original')).ok,true);assert.equal((await a.longMixListen(p.projectId,r.assetId,'B')).ok,true);
 assert.equal(Buffer.compare(Buffer.from(await blobs[0].arrayBuffer()),Buffer.from(await file.arrayBuffer())),0);assert.notEqual(Buffer.compare(Buffer.from(await blobs[0].arrayBuffer()),Buffer.from(await blobs[1].arrayBuffer())),0);assert.equal(revoked.length,1);a.longMixCancel();assert.equal(revoked.length,2);assert.equal(a.longMix.candidate,null);assert.equal(a.longMix.proposals,null);
});
test('corrupt bytes and concurrent metadata during measurement reject proposals and preserve storage',async()=>{
 for(const mode of ['corrupt','conflict']){const f=await setup(),{a,p,repo,indexedDB}=f,r=await a.pcmImportLongFile(toneFile(a),p.projectId),before=JSON.stringify(await repo.get(p.projectId));
 if(mode==='corrupt')indexedDB.stores.get('longWavBinaries').get(r.assetId).blob=new Blob([new Uint8Array(32044)]);
 else{const get=repo.getLongWav;repo.getLongWav=async id=>{const record=await get(id);await repo.put({...await repo.get(p.projectId),revision:444});return record}}
 assert.equal((await a.longMixAnalyze(p.projectId,r.assetId)).ok,false);assert.equal(a.longMix.proposals,null);assert.equal(JSON.stringify(await repo.get(p.projectId)),mode==='corrupt'?before:JSON.stringify({...JSON.parse(before),revision:444}));
 }
});

test('real PCM and streamed WAV share relationship measurement and overlap-based proposals',async()=>{
 const f=await setup();f.p=f.a.pcmImport(f.p,{sampleRate:8000,channels:[Array.from({length:16000},(_,i)=>.1*Math.sin(2*Math.PI*800*i/8000))]},'explicit-vocal.wav');await f.repo.put(f.p);f.a.state.projects=[f.p];
 const imported=await f.a.pcmImportLongFile(toneFile(f.a,16000,800,.2),f.p.projectId);assert.equal(imported.ok,true);
 const before=JSON.stringify(await f.repo.get(f.p.projectId)),vocalId='pcm:'+f.p.pcmMix.assets[0].id;
 const r=await f.a.mixAnalyzeRelationships(f.p.projectId,vocalId);assert.equal(r.ok,true,r.error);assert.equal(r.rows.length,2);assert.ok(r.pairs[0].overlap>.99);assert.ok(Math.abs(r.pairs[0].vocalMarginDb+6.02)<.02);
 const suggestions=await f.a.longMixAnalyze(f.p.projectId,imported.assetId);assert.equal(suggestions.ok,true,suggestions.error);assert.equal(suggestions.proposals.length,3);assert.equal(suggestions.proposals[2].after.clippingSamples,0);assert.equal(JSON.stringify(await f.repo.get(f.p.projectId)),before);
 assert.equal((await f.a.longMixSelect(f.p.projectId,imported.assetId,2,'eq')).ok,true);assert.equal((await f.a.longMixSave(f.p.projectId,imported.assetId)).ok,true);
});
test('multi-asset analysis rejects corrupt binary and cancellation without cached success or writes',async()=>{
 for(const mode of ['corrupt','cancel']){const f=await setup();f.p=f.a.pcmImport(f.p,{sampleRate:8000,channels:[[0,.1,-.1]]},'short');await f.repo.put(f.p);f.a.state.projects=[f.p];const r=await f.a.pcmImportLongFile(toneFile(f.a),f.p.projectId);assert.equal(r.ok,true);
 const before=JSON.stringify(await f.repo.get(f.p.projectId));if(mode==='corrupt'){const rec=f.indexedDB.stores.get('longWavBinaries').get(r.assetId);rec.blob=new Blob([new Uint8Array(rec.blob.size)])}else{const get=f.repo.get;f.repo.get=async id=>{const p=await get(id);f.a.pcmCancel();return p}}
 const result=await f.a.mixAnalyzeRelationships(f.p.projectId);assert.equal(result.ok,false);assert.equal(f.a.pcmSuggestions.relationships,null);assert.equal(JSON.stringify(await f.repo.get(f.p.projectId)),before);
 }
});
test('spatial stereo output survives Save/reopen/Undo/Redo/archive and protects original bytes and MIDI',async()=>{
 const f=await setup(),{a,p,repo,indexedDB}=f,pcm={sampleRate:8000,channels:[Array(160).fill(.4),Array(160).fill(.2)]},file=new Blob([a.pcmEncodeWav(pcm)]);file.name='stereo.wav';const imported=await a.pcmImportLongFile(file,p.projectId);assert.equal(imported.ok,true,imported.error);
 const setting={gainDb:0,eq:{frequency:1000,gainDb:0,q:1},compressor:{thresholdDb:-20,ratio:1,attackMs:10,releaseMs:100},spatial:{balance:.5,width:0}};
 const preview=await a.longMixPreview(p.projectId,imported.assetId,setting);assert.equal(preview.ok,true,preview.error);const out=a.pcmDecodeWav(await preview.blob.arrayBuffer());assert.ok(Math.abs(out.channels[0][0]-.15)<.0001);assert.ok(Math.abs(out.channels[1][0]-.3)<.0001);
 const saved=await a.longMixSave(p.projectId,imported.assetId);assert.equal(saved.ok,true,saved.error);const fresh=fixture(indexedDB);fresh.a.setRepository(fresh.a.indexedDbRepository());fresh.a.state.projects=[await repo.get(p.projectId)];fresh.a.pcmOpen(p.projectId);assert.deepEqual(JSON.parse(JSON.stringify(fresh.a.longMixHistory(fresh.a.state.projects[0].longWavAssets[0]).settings[1].spatial)),setting.spatial);
 for(const d of [-1,1])assert.equal((await fresh.a.longMixSave(p.projectId,imported.assetId,d)).ok,true);
 const archive=await fresh.a.createLongWavArchive(),dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());const restored=await dst.a.restoreLongWavArchive(archive);assert.equal(restored.ok,true,restored.error);assert.deepEqual(JSON.parse(JSON.stringify(dst.a.longMixHistory(restored.projects[0].longWavAssets[0]).settings[1].spatial)),setting.spatial);assert.equal(JSON.stringify(restored.projects[0].midiData),JSON.stringify(p.midiData));assert.equal(Buffer.compare(Buffer.from(await a.pcmLoadLongWav(p.projectId,imported.assetId).then(b=>b.arrayBuffer())),Buffer.from(await file.arrayBuffer())),0);
});

test('archive preview verifies all bytes without publishing and cancellation clears selection',async()=>{
 const f=await setup();await f.a.pcmImportLongFile(wav(100),f.p.projectId);const blob=await f.a.createLongWavArchive(),dst=fixture(),repo=dst.a.indexedDbRepository();dst.a.setRepository(repo);
 const result=await dst.a.previewLongWavArchive(blob);assert.equal(result.ok,true,result.error);assert.equal(result.preview.projectCount,1);assert.equal(result.preview.assetCount,1);assert.equal((await repo.list()).length,0);assert.equal(dst.indexedDB.stores.get('longWavBinaries').size,0);assert.match(dst.a.backupView(),/内容を確認して復元/);dst.a.cancelArchiveTransfer();assert.equal(dst.a.archiveTransfer.preview,null);assert.equal((await dst.a.restorePreviewedArchive()).error,'archive-preview-required');
});
test('archive preview confirmation revalidates bytes and can preserve destination settings',async()=>{
 const f=await setup();await f.a.pcmImportLongFile(wav(100),f.p.projectId);const blob=await f.a.createLongWavArchive(),dst=fixture(),repo=dst.a.indexedDbRepository();dst.a.setRepository(repo);const settings=dst.a.defaultSettings();settings.future={keep:true};await repo.putSettings(settings);dst.a.state.settings=settings;dst.w.document={querySelector:selector=>selector==='#archiveRestoreSettings'?{checked:false}:null};
 assert.equal((await dst.a.previewLongWavArchive(blob)).ok,true);assert.equal((await dst.a.restorePreviewedArchive()).ok,true);assert.equal(JSON.stringify(await repo.getSettings()),JSON.stringify(settings));assert.equal(dst.a.archiveTransfer.preview,null);assert.equal((await repo.list()).length,1);
});
test('archive busy transfer rejects second restore and blocks native shutdown',async()=>{
 const f=await setup();await f.a.pcmImportLongFile(wav(100),f.p.projectId);const blob=await f.a.createLongWavArchive();const dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());let release;const original=blob.slice.bind(blob);let once=true;blob.slice=(...args)=>{const part=original(...args);if(once){once=false;const read=part.arrayBuffer.bind(part);part.arrayBuffer=async()=>{await new Promise(r=>release=r);return read()}}return part};
 const first=dst.a.restoreLongWavArchive(blob);while(!release)await new Promise(r=>setImmediate(r));assert.equal((await dst.a.restoreLongWavArchive(blob)).error,'archive-transfer-busy');assert.equal((await dst.a.prepareForShutdown()).reason,'operation-in-progress');dst.a.cancelArchiveTransfer();release();const result=await first;assert.equal(result.ok,false);assert.match(result.error,/cancelled/);assert.equal(dst.a.archiveTransfer.busy,false);assert.equal(dst.indexedDB.stores.get('longWavBinaries').size,0);
});
test('failed archive preview never leaves a previous validated selection available',async()=>{
 const f=await setup();const blob=await f.a.createLongWavArchive();assert.equal((await f.a.previewLongWavArchive(blob)).ok,true);assert.equal((await f.a.previewLongWavArchive(new Blob(['bad']))).ok,false);assert.equal(f.a.archiveTransfer.preview,null);assert.equal(f.a.archiveTransfer.busy,false);
});
test('automatic WAV backup persists Blob and restores into independent storage through preview',async()=>{
 const f=await setup();await f.a.pcmImportLongFile(wav(100),f.p.projectId);f.a.state.settings=f.a.defaultSettings();f.a.state.settings.backup.automaticEnabled=true;await f.repo.putSettings(f.a.state.settings);
 const first=f.a.runAutoBackupCheck();assert.equal(f.a.runAutoBackupCheck(),first);const r=await first;assert.equal(r.created,true,r.reason);assert.ok(r.backup.archive instanceof Blob);await f.repo.close();const fresh=fixture(f.indexedDB);fresh.a.setRepository(fresh.a.indexedDbRepository());await fresh.a.loadAutoBackups();assert.equal(fresh.a.state.autoBackups.length,1);
 const dst=fixture(),repo=dst.a.indexedDbRepository();dst.a.setRepository(repo);dst.a.state.autoBackups=fresh.a.state.autoBackups;dst.w.confirm=()=>true;const preview=await dst.a.restoreAutoBackup(r.backup.backupId);assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal((await repo.list()).length,0);assert.equal((await dst.a.restorePreviewedArchive()).ok,true);const restored=(await repo.list())[0];assert.equal((await dst.a.pcmLoadLongWav(restored.projectId,restored.longWavAssets[0].id)).size,244);
});
test('automatic backup refuses dirty editor and failed archive storage preserves songs',async()=>{
 const f=await setup();await f.a.pcmImportLongFile(wav(100),f.p.projectId);f.a.state.settings=f.a.defaultSettings();f.a.state.settings.backup.automaticEnabled=true;f.a.state.dirty=true;assert.equal((await f.a.runAutoBackupCheck()).reason,'backup-unsaved-or-busy');f.a.state.dirty=false;const before=JSON.stringify(await f.repo.get(f.p.projectId));f.indexedDB.fail();const r=await f.a.runAutoBackupCheck();assert.equal(r.created,false);assert.equal(r.reason,'storage-error');assert.equal(JSON.stringify(await f.repo.get(f.p.projectId)),before);assert.equal((await f.repo.listAutoBackups()).length,0);
});
test('manual generic Backup routes WAV songs to verified binary archive and empty archive restores settings',async()=>{
 const f=await setup();await f.a.pcmImportLongFile(wav(100),f.p.projectId);const exported=await f.a.exportBackup();assert.equal(exported.ok,true,exported.error);assert.ok(exported.blob instanceof Blob);
 const src=fixture();src.a.setRepository(src.a.indexedDbRepository());const archive=await src.a.createLongWavArchive();const dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());const r=await dst.a.restoreLongWavArchive(archive);assert.equal(r.ok,true,r.error);assert.equal(r.projects.length,0);
});
test('shared WAV across duplicated songs is packed once and restores shared identity without losing edits',async()=>{
 const f=await setup();await f.a.pcmImportLongFile(wav(100),f.p.projectId);const original=await f.repo.get(f.p.projectId),copy=structuredClone(original);copy.projectId='copied-song';copy.projectName='Copied';copy.longWavAssets[0].name='shared but independent name';await f.repo.put(copy);f.a.state.projects=[original,copy];
 const blob=await f.a.createLongWavArchive(),header=new DataView(await blob.slice(0,12).arrayBuffer()),manifest=JSON.parse(await blob.slice(12,12+header.getUint32(8,true)).text());assert.equal(manifest.entries.length,1);assert.equal(manifest.projects.length,2);
 const dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());const r=await dst.a.restoreLongWavArchive(blob);assert.equal(r.ok,true,r.error);assert.equal(r.projects.length,2);assert.equal(r.projects[0].longWavAssets[0].id,r.projects[1].longWavAssets[0].id);assert.equal(r.projects[1].longWavAssets[0].name,'shared but independent name');assert.equal(dst.indexedDB.stores.get('longWavBinaries').size,1);
 copy.longWavAssets[0].frames++;await f.repo.put(copy);f.a.state.projects=[original,copy];await assert.rejects(f.a.createLongWavArchive(),/shared-asset-conflict/);
});

function originalFile(bytes=[77,84,104,100,0,0,0,6],name='original.mid'){const file=new Blob([new Uint8Array(bytes)],{type:'audio/midi'});file.name=name;return file}
test('referenced original route persists exact bytes across independent repository reopen and downloads',async()=>{
 const f=await setup(),file=originalFile();const r=await f.a.retainReferenceFile(f.p.projectId,'fileReferences',-1,file);assert.equal(r.ok,true,r.error);await f.repo.close();const fresh=fixture(f.indexedDB);fresh.a.setRepository(fresh.a.indexedDbRepository());const loaded=await fresh.a.loadReferenceFile(f.p.projectId,'fileReferences',0);assert.equal(loaded.name,file.name);assert.equal(Buffer.compare(Buffer.from(await loaded.blob.arrayBuffer()),Buffer.from(await file.arrayBuffer())),0);assert.equal((await fresh.a.downloadReferenceFile(f.p.projectId,'fileReferences',0)).ok,true);
});
test('MIDI, audio and generic references including opaque future metadata all archive and restore original bytes',async()=>{
 const f=await setup();const p=await f.repo.get(f.p.projectId);p.midiAssets=[{assetId:'midi',name:'MIDI',future:{kept:true}}];p.audioAssets=[{assetId:'audio',derivedFromAssetId:'midi',storage:{reference:'/old/file.wav'}}];p.fileReferences=[{id:'file',name:'File'}];await f.repo.put(p);f.a.state.projects=[p];
 for(const field of ['midiAssets','audioAssets','fileReferences'])assert.equal((await f.a.retainReferenceFile(p.projectId,field,0,originalFile([1,2,3],field+'.bin'))).ok,true);
 const archive=await f.a.createLongWavArchive(),dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());assert.equal((await dst.a.previewLongWavArchive(archive)).ok,true);assert.equal((await dst.a.repository?.list?.())?.length,undefined);assert.equal(dst.indexedDB.stores.get('longWavBinaries').size,0);const r=await dst.a.restorePreviewedArchive();assert.equal(r.ok,true,r.error);const restored=r.projects[0];assert.notEqual(restored.projectId,p.projectId);assert.equal(restored.audioAssets[0].derivedFromAssetId,'midi');assert.equal(restored.midiAssets[0].future.kept,true);
 for(const field of ['midiAssets','audioAssets','fileReferences']){assert.notEqual(restored[field][0].binary.id,f.a.state.projects[0][field][0].binary.id);const b=await dst.a.loadReferenceFile(restored.projectId,field,0);assert.deepEqual([...new Uint8Array(await b.blob.arrayBuffer())],[1,2,3]);}
});
test('archive with WAV and retained MIDI includes both originals and shares identities across duplicate songs',async()=>{
 const f=await setup();await f.a.pcmImportLongFile(wav(100),f.p.projectId);await f.a.retainReferenceFile(f.p.projectId,'fileReferences',-1,originalFile());const p=await f.repo.get(f.p.projectId),copy=structuredClone(p);copy.projectId='duplicate';await f.repo.put(copy);f.a.state.projects=[p,copy];const archive=await f.a.createLongWavArchive(),dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());const r=await dst.a.restoreLongWavArchive(archive);assert.equal(r.ok,true,r.error);assert.equal(dst.indexedDB.stores.get('longWavBinaries').size,2);assert.equal(r.projects[0].fileReferences[0].binary.id,r.projects[1].fileReferences[0].binary.id);assert.equal((await dst.a.pcmLoadLongWav(r.projects[0].projectId,r.projects[0].longWavAssets[0].id)).size,244);
});
test('generic manual and automatic Backup include retained references even without long WAV',async()=>{
 const f=await setup();await f.a.retainReferenceFile(f.p.projectId,'fileReferences',-1,originalFile());const manual=await f.a.exportBackup();assert.equal(manual.ok,true,manual.error);assert.ok(manual.blob instanceof Blob);f.a.state.settings=f.a.defaultSettings();f.a.state.settings.backup.automaticEnabled=true;const r=await f.a.runAutoBackupCheck();assert.equal(r.created,true,r.reason);assert.ok(r.backup.archive instanceof Blob);
});
test('unselected legacy references cannot masquerade as complete archive',async()=>{
 const f=await setup();const p={...f.p,midiAssets:[{assetId:'old',storage:{reference:'old.mid'}}]};await f.repo.put(p);f.a.state.projects=[p];await assert.rejects(f.a.createLongWavArchive(),/external-binaries/);assert.equal((await f.a.exportBackup()).ok,false);assert.match(f.a.referenceFilesView(p),/本体未保存/);
});
test('quota rejection atomically retains original metadata and no new reference bytes',async()=>{
 const f=await setup(),before=JSON.stringify(await f.repo.get(f.p.projectId));f.indexedDB.fail();assert.equal((await f.a.retainReferenceFile(f.p.projectId,'fileReferences',-1,originalFile())).ok,false);assert.equal(JSON.stringify(await f.repo.get(f.p.projectId)),before);assert.equal(f.indexedDB.stores.get('longWavBinaries').size,0);
});
test('dirty edits, invalid targets, empty files and cancelled selection never publish reference bytes',async()=>{
 const f=await setup();f.a.state.dirty=true;assert.equal((await f.a.retainReferenceFile(f.p.projectId,'fileReferences',-1,originalFile())).ok,false);f.a.state.dirty=false;
 for(const [field,index,file]of [['invalid',0,originalFile()],['midiAssets',-1,originalFile()],['audioAssets',0,originalFile()],['fileReferences',-1,originalFile([])]])assert.equal((await f.a.retainReferenceFile(f.p.projectId,field,index,file)).ok,false);assert.equal((await f.a.retainReferenceFile(f.p.projectId,'fileReferences',-1,null)).cancelled,true);assert.equal(f.indexedDB.stores.get('longWavBinaries').size,0);
});
test('cancelled retained file hashing blocks shutdown and second transfer then leaves source intact',async()=>{
 const f=await setup(),file=originalFile();let release;const digest=f.w.crypto.subtle.digest.bind(f.w.crypto.subtle);f.w.crypto={...f.w.crypto,subtle:{digest:async(...args)=>{await new Promise(r=>release=r);return digest(...args)}}};const first=f.a.retainReferenceFile(f.p.projectId,'fileReferences',-1,file);while(!release)await new Promise(r=>setImmediate(r));assert.equal((await f.a.prepareForShutdown()).reason,'operation-in-progress');assert.equal((await f.a.retainReferenceFile(f.p.projectId,'fileReferences',-1,file)).error,'reference-transfer-busy');f.a.cancelArchiveTransfer();release();assert.equal((await first).ok,false);assert.equal(f.indexedDB.stores.get('longWavBinaries').size,0);assert.equal(f.a.archiveTransfer.busy,false);
});
test('replacement keeps asset identity and relationships, preserves old bytes, and corrupt reads fail',async()=>{
 const f=await setup();await f.a.retainReferenceFile(f.p.projectId,'fileReferences',-1,originalFile());const old=(await f.repo.get(f.p.projectId)).fileReferences[0];assert.equal((await f.a.retainReferenceFile(f.p.projectId,'fileReferences',0,originalFile([9,8],'new.mid'))).ok,true);const replacement=(await f.repo.get(f.p.projectId)).fileReferences[0];assert.equal(replacement.id,old.id);assert.notEqual(replacement.binary.id,old.binary.id);assert.ok(await f.repo.getLongWav(old.binary.id));const r=await f.repo.getLongWav(replacement.binary.id);f.indexedDB.stores.get('longWavBinaries').set(r.id,{...r,blob:new Blob([new Uint8Array([0,0])])});await assert.rejects(f.a.loadReferenceFile(f.p.projectId,'fileReferences',0),/corrupt/);await assert.rejects(f.a.createLongWavArchive(),/corrupt/);
});
test('archive reference checksum corruption fails before publication into destination',async()=>{
 const f=await setup();await f.a.retainReferenceFile(f.p.projectId,'fileReferences',-1,originalFile());const archive=await f.a.createLongWavArchive(),bytes=new Uint8Array(await archive.arrayBuffer());bytes[bytes.length-1]^=255;const dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());assert.equal((await dst.a.restoreLongWavArchive(new Blob([bytes]))).ok,false);assert.equal(dst.indexedDB.stores.get('longWavBinaries').size,0);
});
test('reference UI encodes project identity and escapes untrusted filenames',()=>{const f=fixture(),p=f.a.makeProject({projectId:"song');alert(1);//",projectName:'safe'});p.fileReferences=[{id:'x',name:'<img src=x onerror=alert(1)>'}];const html=f.a.referenceFilesView(p);assert.ok(html.includes('%27'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes("retainReferenceFile('song'"));});
test('referenced archive transaction failure rolls back all destination songs and bytes',async()=>{const f=await setup();await f.a.retainReferenceFile(f.p.projectId,'fileReferences',-1,originalFile());const archive=await f.a.createLongWavArchive(),dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());await dst.a.previewLongWavArchive(archive);dst.indexedDB.fail();assert.equal((await dst.a.restorePreviewedArchive()).ok,false);assert.equal(dst.indexedDB.stores.get('projects').size,0);assert.equal(dst.indexedDB.stores.get('longWavBinaries').size,0);assert.equal((await f.repo.get(f.p.projectId)).fileReferences.length,1);});

function masterWav(a,frames=48000,amplitude=.1,rate=48000){const b=new ArrayBuffer(44+frames*2),v=new DataView(b),tag=(p,s)=>[...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt()));tag(0,'RIFF');v.setUint32(4,b.byteLength-8,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);tag(36,'data');v.setUint32(40,frames*2,true);for(let i=0;i<frames;i++)v.setInt16(44+i*2,Math.round(amplitude*Math.sin(2*Math.PI*997*i/rate)*32767),true);const blob=new Blob([b],{type:'audio/wav'});blob.name='master-source.wav';return blob}
async function masterSetup(frames=48000,amp=.1,rate=48000){const f=await setup(),r=await f.a.pcmImportLongFile(masterWav(f.a,frames,amp,rate),f.p.projectId);assert.equal(r.ok,true,r.error);return{...f,assetId:r.assetId}}
test('long master streams > inline capacity without whole PCM reads; actual WAV reaches LUFS and ceiling',async()=>{const f=await masterSetup(2100000),{a,p,assetId}=f,r=await a.longMasterPreview(p.projectId,assetId,-14,-1);assert.equal(r.ok,true,r.error);assert.equal(r.frames,2100000);assert.ok(Math.abs(r.mastering.after.lufs+14)<.03);assert.ok(r.mastering.after.truePeakDb<=-1+.002);assert.equal(r.mastering.after.clippingSamples,0);assert.equal((await f.repo.get(p.projectId)).longWavAssets[0].mixHistory,undefined)});
test('long master adoption retains original bytes, saves provenance; fresh reopen and full archive recovery render identical WAV',async()=>{const f=await masterSetup(),{a,p,assetId}=f,original=await a.pcmLoadLongWav(p.projectId,assetId);const c=await a.longMasterPreview(p.projectId,assetId,-18,-3);assert.equal(c.ok,true,c.error);assert.equal((await a.longMixSave(p.projectId,assetId)).ok,true);const saved=await f.repo.get(p.projectId);assert.equal(saved.masteringNotes[0].format,'nova-long-master-result-v1');assert.equal(saved.longWavAssets[0].mixHistory.cursor,1);assert.deepEqual(saved.midiData,{unchanged:true});const fresh=fixture(f.indexedDB);fresh.a.setRepository(fresh.a.indexedDbRepository());fresh.a.state.projects=await fresh.a.indexedDbRepository().list();fresh.a.pcmOpen(p.projectId);const rendered=await fresh.a.longMixExport(p.projectId,assetId);assert.equal(rendered.ok,true,rendered.error);assert.equal(Buffer.compare(Buffer.from(await rendered.blob.arrayBuffer()),Buffer.from(await c.blob.arrayBuffer())),0);const archive=await fresh.a.createLongWavArchive(),dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());const rr=await dst.a.restoreLongWavArchive(archive);assert.equal(rr.ok,true,rr.error);const recovered=rr.projects[0];assert.equal(recovered.masteringNotes[0].sourceAssetId,recovered.longWavAssets[0].id);assert.deepEqual(JSON.parse(JSON.stringify(recovered.masteringNotes[0].after)),JSON.parse(JSON.stringify(saved.masteringNotes[0].after)));dst.a.state.projects=rr.projects;dst.a.pcmOpen(recovered.projectId);const exported=await dst.a.longMixExport(recovered.projectId,recovered.longWavAssets[0].id);assert.equal(exported.ok,true,exported.error);assert.equal(Buffer.compare(Buffer.from(await exported.blob.arrayBuffer()),Buffer.from(await c.blob.arrayBuffer())),0);const unchanged=await a.pcmLoadLongWav(p.projectId,assetId);assert.equal(Buffer.compare(Buffer.from(await unchanged.arrayBuffer()),Buffer.from(await original.arrayBuffer())),0)});
for(const [name,frames,amp,rate,error] of [['silence',48000,0,48000,/loudness/],['short',100,.1,48000,/loudness/],['unsupported rate',48000,.1,44100,/48khz/]])test('long mastering fails closed on '+name,async()=>{const f=await masterSetup(frames,amp,rate),r=await f.a.longMasterPreview(f.p.projectId,f.assetId,-14,-1);assert.equal(r.ok,false);assert.match(r.error,error);assert.equal(f.a.longMix.candidate,null);assert.equal((await f.repo.get(f.p.projectId)).masteringNotes.length,0)});
for(const mode of ['dirty','cancel','stale','tamper','quota'])test('long master '+mode+' protects saved source',async()=>{const f=await masterSetup(),{a,p,assetId}=f,before=JSON.stringify(await f.repo.get(p.projectId));if(mode==='dirty')a.state.dirty=true;if(mode==='cancel'){const get=f.repo.get.bind(f.repo);f.repo.get=async id=>{a.longMixCancel();return get(id)}}if(mode==='stale')await f.repo.put({...a.state.projects[0],revision:50});const c=await a.longMasterPreview(p.projectId,assetId,-14,-1);if(['dirty','cancel','stale'].includes(mode)){assert.equal(c.ok,false);assert.equal(a.pcmEditor.busy,false);return}assert.equal(c.ok,true,c.error);if(mode==='tamper')c.mastering.after.lufs=0;if(mode==='quota')f.indexedDB.fail();const r=await a.longMixSave(p.projectId,assetId);assert.equal(r.ok,false);assert.equal(JSON.stringify(await f.repo.get(p.projectId)),before);assert.ok(a.longMix.candidate)});
test('long master preserves saved EQ/compressor and undo/redo changes actual processed output',async()=>{const f=await masterSetup(),{a,p,assetId}=f,asset=a.state.projects[0].longWavAssets[0],settings=a.longMixHistory(asset).settings[0];settings.gainDb=-2;assert.equal((await a.longMixPreview(p.projectId,assetId,settings)).ok,true);assert.equal((await a.longMixSave(p.projectId,assetId)).ok,true);const c=await a.longMasterPreview(p.projectId,assetId,-14,-1);assert.equal(c.ok,true,c.error);assert.deepEqual(JSON.parse(JSON.stringify(c.settings.eq)),JSON.parse(JSON.stringify(settings.eq)));assert.deepEqual(JSON.parse(JSON.stringify(c.settings.compressor)),JSON.parse(JSON.stringify(settings.compressor)));assert.equal((await a.longMixSave(p.projectId,assetId)).ok,true);assert.equal((await a.longMixSave(p.projectId,assetId,-1)).ok,true);const undo=await a.longMixExport(p.projectId,assetId);assert.notEqual(Buffer.compare(Buffer.from(await undo.blob.arrayBuffer()),Buffer.from(await c.blob.arrayBuffer())),0);assert.equal((await a.longMixSave(p.projectId,assetId,1)).ok,true);const redo=await a.longMixExport(p.projectId,assetId);assert.equal(Buffer.compare(Buffer.from(await redo.blob.arrayBuffer()),Buffer.from(await c.blob.arrayBuffer())),0)});
test('long master parameters reject invalid targets; cancellation allows a fresh retry; peak limit shown',async()=>{const f=await masterSetup(),{a,p,assetId}=f;for(const target of [NaN,-50,1])assert.equal((await a.longMasterPreview(p.projectId,assetId,target,-1)).ok,false);a.longMixCancel();const c=await a.longMasterPreview(p.projectId,assetId,-5,-6);assert.equal(c.ok,true,c.error);assert.equal(c.mastering.peakLimited,true);assert.ok(c.mastering.after.lufs< -5);assert.match(a.longMasterView(p.projectId,a.state.projects[0].longWavAssets[0]),/ピーク保護/)});
test('long master compares distinct measured targets; explicit gain-only selection preserves EQ and saves chosen provenance',async()=>{const f=await masterSetup(),{a,p,assetId}=f;const r=await a.longMasterCompare(p.projectId,assetId,-16,-1);assert.equal(r.ok,true);assert.equal(r.count,3);assert.deepEqual(Array.from(a.longMix.masterChoices,c=>c.mastering.targetLufs),[-16,-14,-18]);assert.equal(a.longMasterSelect(p.projectId,assetId,1).ok,true);assert.equal(a.longMix.candidate.mastering.targetLufs,-14);assert.equal((await a.longMixSave(p.projectId,assetId)).ok,true);assert.equal((await f.repo.get(p.projectId)).masteringNotes[0].targetLufs,-14);assert.equal(a.longMix.masterChoices,null);assert.equal(a.longMasterSelect(p.projectId,assetId,0).ok,false)});
test('long master comparison cancellation drops retained choices and permits fresh measurement',async()=>{const f=await masterSetup(),{a,p,assetId}=f;assert.equal((await a.longMasterCompare(p.projectId,assetId,-14,-1)).ok,true);a.longMixCancel();assert.equal(a.longMix.masterChoices,null);assert.equal(a.longMasterSelect(p.projectId,assetId,0).ok,false);assert.equal((await a.longMasterPreview(p.projectId,assetId,-18,-3)).ok,true)});
test('editing long Master target invalidates active candidates and blocks stale adoption',async()=>{const f=await masterSetup(),{a,p,assetId}=f;assert.equal((await a.longMasterPreview(p.projectId,assetId,-14,-1)).ok,true);a.longMasterInvalidate();assert.equal(a.longMix.candidate,null);assert.equal((await a.longMixSave(p.projectId,assetId)).ok,false);assert.equal((await f.repo.get(p.projectId)).masteringNotes.length,0);assert.equal((await a.longMasterPreview(p.projectId,assetId,-18,-3)).ok,true)});

const versionEvent=name=>({preventDefault(){},currentTarget:{elements:{versionName:{value:name}}}});
test('named Long Mix version rerenders exact saved settings after other edits and fresh reopen',async()=>{
 const f=await masterSetup(),{a,p,assetId}=f,asset=a.state.projects[0].longWavAssets[0],s=a.longMixHistory(asset).settings[0];s.gainDb=-6;s.eq={frequency:997,gainDb:2,q:1};
 const c=await a.longMixPreview(p.projectId,assetId,s);assert.equal(c.ok,true,c.error);const bytes=Buffer.from(await c.blob.arrayBuffer());
 assert.equal((await a.longMixVersionSave(versionEvent('Warm Mix'),p.projectId,assetId)).ok,true);
 const saved=await f.repo.get(p.projectId);assert.equal(saved.longWavAssets[0].mixHistory,undefined);assert.equal(saved.longWavAssets[0].mixVersions[0].name,'Warm Mix');
 assert.equal((await a.longMixPreview(p.projectId,assetId,{...s,gainDb:-12})).ok,true);assert.equal((await a.longMixSave(p.projectId,assetId)).ok,true);
 const fresh=fixture(f.indexedDB),repo=fresh.a.indexedDbRepository();fresh.a.setRepository(repo);fresh.a.state.projects=await repo.list();fresh.a.pcmOpen(p.projectId);const baseline=JSON.stringify(await repo.get(p.projectId));
 const r=await fresh.a.longMixVersionRecall(p.projectId,assetId,saved.longWavAssets[0].mixVersions[0].id);assert.equal(r.ok,true,r.error);assert.deepEqual(Buffer.from(await r.blob.arrayBuffer()),bytes);assert.equal(JSON.stringify(await repo.get(p.projectId)),baseline);
 assert.equal((await fresh.a.longMixSave(p.projectId,assetId)).ok,true);assert.equal((await repo.get(p.projectId)).longWavAssets[0].mixHistory.settings.at(-1).gainDb,-6);
});
test('named Long Master settings and original bytes survive complete Archive into fresh app then re-edit',async()=>{
 const f=await masterSetup(),{a,p,assetId}=f,c=await a.longMasterPreview(p.projectId,assetId,-18,-3);assert.equal(c.ok,true,c.error);const bytes=Buffer.from(await c.blob.arrayBuffer()),original=Buffer.from(await (await a.pcmLoadLongWav(p.projectId,assetId)).arrayBuffer());
 assert.equal((await a.longMixVersionSave(versionEvent('Soft Master'),p.projectId,assetId)).ok,true);assert.equal((await f.repo.get(p.projectId)).masteringNotes.length,0);
 const archive=await a.createLongWavArchive(),dst=fixture(),repo=dst.a.indexedDbRepository();dst.a.setRepository(repo);const restored=await dst.a.restoreLongWavArchive(archive,{settings:false});assert.equal(restored.ok,true,restored.error);const q=restored.projects[0],source=q.longWavAssets[0],row=source.mixVersions[0];dst.a.state.projects=[q];dst.a.pcmOpen(q.projectId);
 assert.notEqual(source.id,assetId);assert.equal(row.masterTarget.targetLufs,-18);assert.deepEqual(Buffer.from(await (await dst.a.pcmLoadLongWav(q.projectId,source.id)).arrayBuffer()),original);
 const recalled=await dst.a.longMixVersionRecall(q.projectId,source.id,row.id);assert.equal(recalled.ok,true,recalled.error);assert.deepEqual(Buffer.from(await recalled.blob.arrayBuffer()),bytes);assert.ok(Math.abs(recalled.mastering.after.lufs+18)<.03);
 assert.equal((await dst.a.longMixSave(q.projectId,source.id)).ok,true);assert.equal((await repo.get(q.projectId)).masteringNotes[0].sourceAssetId,source.id);assert.equal((await dst.a.longMixSave(q.projectId,source.id,-1)).ok,true);assert.equal((await dst.a.longMixSave(q.projectId,source.id,1)).ok,true);
});
test('malformed long versions reject project and archive before destination writes; legacy remains valid',async()=>{
 const f=await masterSetup(),p=f.a.state.projects[0];assert.equal(f.a.validateProject(p).valid,true);const c=await f.a.longMasterPreview(p.projectId,f.assetId,-18,-3),good=f.a.longMixVersionCapture(p,f.assetId,'Master',c);
 for(const mutate of [x=>x.id='',x=>x.settings.gainDb=99,x=>x.masterTarget.ceilingDb=0,x=>x.createdAt='bad',x=>x.name='bad\u0000']){const bad=JSON.parse(JSON.stringify(good));mutate(bad.longWavAssets[0].mixVersions[0]);assert.equal(f.a.validateProject(bad).valid,false);f.indexedDB.stores.get('projects').set(p.projectId,structuredClone(bad));await assert.rejects(f.a.createLongWavArchive(),/archive-project-invalid/);}
 for(const rows of [null,{},[good.longWavAssets[0].mixVersions[0],good.longWavAssets[0].mixVersions[0]]]){const bad=JSON.parse(JSON.stringify(good));bad.longWavAssets[0].mixVersions=rows;assert.equal(f.a.validateProject(bad).valid,false);}
 const tampered={...c,mastering:{...c.mastering,targetLufs:-16}};assert.throws(()=>f.a.longMixVersionCapture(p,f.assetId,'changed',tampered),/modified/);
});
test('long version capacity and invalid names cannot mutate original metadata',async()=>{
 const f=await masterSetup(),p=f.a.state.projects[0],c=await f.a.longMasterPreview(p.projectId,f.assetId,-18,-3),s=JSON.stringify(p);
 for(const name of ['', 'x'.repeat(81),'unsafe\nname'])assert.throws(()=>f.a.longMixVersionCapture(p,f.assetId,name,c),/name/);
 const full=JSON.parse(s);full.longWavAssets[0].mixVersions=Array.from({length:32},(_,i)=>({id:'v'+i,name:'Mix '+i,createdAt:p.createdAt,settings:c.settings}));const candidate={...c,baseline:JSON.stringify(full),mastering:undefined};assert.throws(()=>f.a.longMixVersionCapture(full,f.assetId,'33',candidate),/capacity/);assert.equal(JSON.stringify(p),s);
});
test('quota conflict and busy Long version save protect original; retry needs intact preview',async()=>{
 const f=await masterSetup(),{a,p,assetId}=f;await a.longMasterPreview(p.projectId,assetId,-18,-3);const baseline=JSON.stringify(await f.repo.get(p.projectId)),cas=f.repo.compareAndPut;f.repo.compareAndPut=async()=>{throw Error('QuotaExceededError')};assert.equal((await a.longMixVersionSave(versionEvent('safe'),p.projectId,assetId)).ok,false);assert.equal(JSON.stringify(await f.repo.get(p.projectId)),baseline);f.repo.compareAndPut=cas;
 a.state.dirty=true;assert.equal((await a.longMixVersionSave(versionEvent('safe'),p.projectId,assetId)).ok,false);a.state.dirty=false;const event=versionEvent('safe'),pending=a.longMixVersionSave(event,p.projectId,assetId);event.currentTarget=null;assert.equal((await pending).ok,true);assert.equal((await f.repo.get(p.projectId)).longWavAssets[0].mixVersions.length,1);assert.equal(a.longMix.candidate,null);
});
test('route generation invalidation blocks old long Master comparison selection',async()=>{
 const f=await masterSetup();assert.equal((await f.a.longMasterCompare(f.p.projectId,f.assetId,-14,-1)).ok,true);f.a.longMix.generation++;assert.equal(f.a.longMasterSelect(f.p.projectId,f.assetId,0).ok,false);assert.equal((await f.repo.get(f.p.projectId)).masteringNotes.length,0);
});
test('long version recall cancellation publishes no candidate and metadata stays intact',async()=>{
 const f=await masterSetup(),{a,p,assetId}=f;await a.longMasterPreview(p.projectId,assetId,-18,-3);await a.longMixVersionSave(versionEvent('soft'),p.projectId,assetId);const saved=await f.repo.get(p.projectId),pending=a.longMixVersionRecall(p.projectId,assetId,saved.longWavAssets[0].mixVersions[0].id);a.longMixCancel();assert.equal((await pending).ok,false);assert.equal(a.longMix.candidate,null);assert.equal(JSON.stringify(await f.repo.get(p.projectId)),JSON.stringify(saved));
});
test('Long Master source selection persists across reopen and archive identity remapping without changing audio settings',async()=>{
 const f=await masterSetup(),{a,p,assetId}=f,second=await a.pcmImportLongFile(masterWav(a,48000,.08),p.projectId);assert.equal(second.ok,true,second.error);
 const selected=await a.longMasterSelectAsset(p.projectId,second.assetId);assert.equal(selected.ok,true,selected.error);const saved=await f.repo.get(p.projectId);assert.equal(saved.longMasterWorkspace.selectedAssetId,second.assetId);assert.equal(saved.longWavAssets[0].mixHistory,undefined);assert.equal(saved.longWavAssets[1].mixHistory,undefined);
 assert.equal(a.validateProject(a.makeProject(saved)).valid,true);assert.equal(a.makeProject(saved).longWavAssets[1].id,second.assetId);const fresh=fixture(f.indexedDB),repo=fresh.a.indexedDbRepository();fresh.a.setRepository(repo);fresh.a.state.projects=await repo.list();assert.equal(fresh.a.longMasterWorkspaceState(fresh.a.state.projects[0]).selectedAssetId,second.assetId);
 const archive=await fresh.a.createLongWavArchive(),dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());const restored=await dst.a.restoreLongWavArchive(archive,{settings:false});assert.equal(restored.ok,true,restored.error);const q=restored.projects[0];assert.equal(q.longMasterWorkspace.selectedAssetId,q.longWavAssets[1].id);assert.notEqual(q.longMasterWorkspace.selectedAssetId,second.assetId);const bad=JSON.parse(JSON.stringify(saved));bad.longMasterWorkspace.selectedAssetId=assetId+'-missing';assert.equal(a.validateProject(bad).valid,false);bad.longMasterWorkspace=null;assert.equal(a.validateProject(bad).valid,false);
 a.state.dirty=true;assert.equal((await a.longMasterSelectAsset(p.projectId,assetId)).ok,false);assert.equal((await f.repo.get(p.projectId)).longMasterWorkspace.selectedAssetId,second.assetId);
});
async function renderSetup(){const f=fixture(),a=f.a,repo=a.indexedDbRepository(),p=a.makeProject({projectId:'render-project',projectName:'MIDI render',midiData:{ppq:480,tempo:120,tracks:[{id:'melody',part:'melody',notes:[{pitch:60,startTick:0,durationTicks:480,velocity:90}]}]}});a.setRepository(repo);await repo.put(p);a.state.projects=[p];a.state.loaded=true;a.state.settings=a.defaultSettings();const data=Float32Array.from({length:48000},(_,i)=>.02*Math.sin(2*Math.PI*440*i/48000));f.w.MusicStudioAudio={async renderMidi(midi,entries,{guard}){guard();return{buffer:{getChannelData:()=>data},frames:data.length,sampleRate:48000,channels:2,seconds:.5,tail:.5,noteCount:1,trackIds:['melody']}}};return{...f,repo,p}}
test('rendered MIDI saves authenticated WAV then reopens, exports, and restores full archive with original MIDI',async()=>{const f=await renderSetup(),r=await f.a.midiRenderForMix(f.p.projectId);assert.equal(r.ok,true,r.error);const original=await f.a.pcmLoadLongWav(f.p.projectId,r.assetId);assert.equal(original.size,44+48000*4);const saved=await f.repo.get(f.p.projectId);assert.equal(JSON.stringify(saved.midiData),JSON.stringify(f.p.midiData));assert.equal(saved.longWavAssets[0].midiRender.sourceRevision,f.p.revision);const plan={format:'nova-final-export-plan-v1',routes:[{key:'wav:'+r.assetId,role:'instrument',startSeconds:0,gainDb:0,muted:false}],targetLufs:-18,ceilingDb:-1,includeMidi:false};const candidate=await f.a.finalPreview(f.p.projectId,plan);assert.equal(candidate.ok,true,candidate.error);assert.equal(candidate.candidate.files.some(x=>x.name==='Instrumental.wav'),true);assert.equal((await f.a.finalSave(f.p.projectId)).ok,true);const archive=await f.a.createLongWavArchive(),fresh=fixture();fresh.a.setRepository(fresh.a.indexedDbRepository());const restored=await fresh.a.restoreLongWavArchive(archive);assert.equal(restored.ok,true,restored.error);const copy=restored.projects[0],blob=await fresh.a.pcmLoadLongWav(copy.projectId,copy.longWavAssets[0].id);assert.deepEqual(Buffer.from(await blob.arrayBuffer()),Buffer.from(await original.arrayBuffer()));assert.equal(JSON.stringify(copy.midiData),JSON.stringify(f.p.midiData));assert.equal(copy.longWavAssets[0].midiRender.sourceRevision,f.p.revision)});
test('MIDI rendering refuses unsaved edits, concurrent changes, missing storage, clipping and quota without losing project',async()=>{for(const kind of ['dirty','conflict','memory','clipping','quota','cancel']){const f=await renderSetup(),original=JSON.stringify(await f.repo.get(f.p.projectId));if(kind==='dirty')f.a.state.dirty=true;if(kind==='conflict')await f.repo.put({...f.p,revision:10});if(kind==='memory')f.a.setRepository(f.a.memoryRepository([f.p]));if(kind==='quota')f.indexedDB.fail();if(kind==='clipping'||kind==='cancel')f.w.MusicStudioAudio.renderMidi=async()=>{if(kind==='cancel')f.a.pcmCancel();return{buffer:{getChannelData:()=>new Float32Array(48000).fill(kind==='clipping'?2:0)},frames:48000,sampleRate:48000,channels:2,seconds:1,tail:0,noteCount:1,trackIds:['melody']}};const r=await f.a.midiRenderForMix(f.p.projectId);assert.equal(r.ok,false,kind);if(kind!=='conflict')assert.equal(JSON.stringify(await f.repo.get(f.p.projectId)),original);assert.equal(f.indexedDB.stores.get('longWavBinaries').size,0);assert.equal(f.a.pcmEditor.busy,false)}});

test('individual MIDI stem passes exact selection to renderer and persists provenance without changing source',async()=>{
 const f=await renderSetup(),before=JSON.stringify(f.p.midiData),render=f.w.MusicStudioAudio.renderMidi;let selected;
 f.w.MusicStudioAudio.renderMidi=(m,e,o)=>{selected=o.trackIds;return render(m,e,o)};
 assert.equal((await f.a.midiRenderForMix(f.p.projectId,'missing')).ok,false);
 const r=await f.a.midiRenderForMix(f.p.projectId,'melody');assert.equal(r.ok,true,r.error);assert.deepEqual(Array.from(selected),['melody']);assert.equal(r.project.longWavAssets[0].midiRender.stemTrackId,'melody');assert.equal(JSON.stringify(r.project.midiData),before);
});

test('batch stems serialize durable writes and retain completed assets on cancellation or failure',async()=>{
 for(const mode of ['success','cancel','failure']){
  const f=await renderSetup();f.p.midiData.tracks.push({...JSON.parse(JSON.stringify(f.p.midiData.tracks[0])),id:'bass',name:'Bass'});await f.repo.put(f.p);
  const before=JSON.stringify(f.p.midiData),render=f.w.MusicStudioAudio.renderMidi;let calls=0,active=0,maxActive=0;
  f.w.MusicStudioAudio.renderMidi=async(m,e,o)=>{calls++;active++;maxActive=Math.max(maxActive,active);try{if(calls===2){if(mode==='cancel')f.a.pcmCancel();if(mode==='failure')throw Error('render-failed')}return await render(m,e,o)}finally{active--}};
  const r=await f.a.midiRenderStems(f.p.projectId,['melody','bass']);assert.equal(r.ok,mode==='success',r.error);assert.equal(maxActive,1);assert.equal(r.completed.length,mode==='success'?2:1);
  const saved=await f.repo.get(f.p.projectId);assert.equal(saved.longWavAssets.length,r.completed.length);assert.equal(JSON.stringify(saved.midiData),before);
  for(const entry of r.completed)assert.equal((await f.a.pcmLoadLongWav(f.p.projectId,entry.assetId)).size,192044);
  assert.equal(f.a.pcmEditor.busy,false);
 }
});
test('batch stem invalid selections do not render or change storage',async()=>{
 const f=await renderSetup(),before=JSON.stringify(await f.repo.get(f.p.projectId));for(const ids of [[],['melody','melody'],['missing'],null])assert.equal((await f.a.midiRenderStems(f.p.projectId,ids)).ok,false);assert.equal(JSON.stringify(await f.repo.get(f.p.projectId)),before);
});
test('saved stem-only ZIP preserves exact WAV bytes without rendering Mix or Master',async()=>{
 const f=await renderSetup();const r=await f.a.midiRenderStems(f.p.projectId,['melody']);assert.equal(r.ok,true,r.error);
 const before=JSON.stringify(await f.repo.get(f.p.projectId)),result=await f.a.midiStemZip(f.p.projectId,r.completed.map(x=>x.assetId));assert.equal(result.ok,true,result.error);
 const bytes=Buffer.from(await result.zip.arrayBuffer()),n=bytes.readUInt16LE(26),size=bytes.readUInt32LE(18),original=await f.a.pcmLoadLongWav(f.p.projectId,r.completed[0].assetId);
 assert.equal(bytes.readUInt32LE(0),0x04034b50);assert.equal(bytes.subarray(30,30+n).toString(),'Stem-1.wav');assert.deepEqual(bytes.subarray(30+n,30+n+size),Buffer.from(await original.arrayBuffer()));assert.equal(result.files.length,1);assert.equal(result.completion,'prepared');assert.equal(JSON.stringify(await f.repo.get(f.p.projectId)),before);
 assert.equal((await f.a.midiStemZip(f.p.projectId,[])).ok,false);assert.equal((await f.a.midiStemZip(f.p.projectId,['missing'])).ok,false);
});
test('large durable records own bounded byte chunks; corruption fails and legacy Blob remains readable',async()=>{
 const f=await setup(),file=wav(2100000),r=await f.a.pcmImportLongFile(file,f.p.projectId);assert.equal(r.ok,true,r.error);
 const store=f.indexedDB.stores.get('longWavBinaries'),record=store.get(r.assetId);assert.equal(record.format,'nova-long-binary-blobs-v2');assert.equal(record.blob,undefined);assert.equal(record.parts.reduce((sum,p)=>sum+p.size,0),file.size);assert.ok(record.parts.every(p=>p.size<=1048576));
 const first=record.parts[0],bad=new Uint8Array(await first.arrayBuffer());bad[60]^=1;record.parts[0]=new Blob([bad]);await assert.rejects(f.a.pcmLoadLongWav(f.p.projectId,r.assetId),/corrupt/);record.parts[0]=first;
 const blob=await f.a.pcmLoadLongWav(f.p.projectId,r.assetId);store.set(r.assetId,{id:r.assetId,blob,hashes:record.hashes});assert.deepEqual(Buffer.from(await (await f.a.pcmLoadLongWav(f.p.projectId,r.assetId)).arrayBuffer()),Buffer.from(await file.arrayBuffer()));
});
test('malformed chunk lengths fail closed without rewriting saved metadata',async()=>{
 const f=await setup(),r=await f.a.pcmImportLongFile(wav(2100000),f.p.projectId),record=f.indexedDB.stores.get('longWavBinaries').get(r.assetId),baseline=JSON.stringify(await f.repo.get(f.p.projectId));record.parts.pop();await assert.rejects(f.a.pcmLoadLongWav(f.p.projectId,r.assetId),/chunks-invalid/);assert.equal(JSON.stringify(await f.repo.get(f.p.projectId)),baseline);
});

test('large durable reconstruction bounds each raw-byte Blob transport to one MiB',async()=>{
 const f=await setup(),file=wav(2100000),saved=await f.a.pcmImportLongFile(file,f.p.projectId);assert.equal(saved.ok,true,saved.error);
 let largest=0;f.w.Blob=class extends Blob{constructor(parts,options){const raw=parts.reduce((n,p)=>n+(ArrayBuffer.isView(p)?p.byteLength:0),0);largest=Math.max(largest,raw);assert.ok(raw<=1048576,'raw Blob transport must stay bounded');super(parts,options)}};
 // Exercise the pre-v2 byte format as well as durable Blob nodes.
 const record=f.indexedDB.stores.get('longWavBinaries').get(saved.assetId);
 const durableParts=record.parts;
 await f.repo.close();const repo=f.a.indexedDbRepository();f.a.setRepository(repo);const blob=await f.a.pcmLoadLongWav(f.p.projectId,saved.assetId);
 assert.equal(largest,0,'durable reopen must not retransmit any raw WAV bytes');assert.deepEqual(Buffer.from(await blob.arrayBuffer()),Buffer.from(await file.arrayBuffer()));
 record.format='nova-long-binary-chunks-v1';record.parts=await Promise.all(durableParts.map(async p=>new Uint8Array(await p.arrayBuffer())));
 const legacy=await f.a.pcmLoadLongWav(f.p.projectId,saved.assetId);assert.equal(largest,1048576);assert.deepEqual(Buffer.from(await legacy.arrayBuffer()),Buffer.from(await file.arrayBuffer()));
});

test('MIDI PCM render rejects a nested edit before binary publication when the check clock does not advance',async()=>{const f=await renderSetup();f.w.performance={now:()=>0};f.w.MusicStudioAudio.renderMidi=async()=>{f.a.state.projects[0].midiData.tracks[0].notes[0].velocity=11;return{buffer:{getChannelData:()=>new Float32Array(48000).fill(.01)},frames:48000,sampleRate:48000,channels:2,seconds:1,tail:0,noteCount:1,trackIds:['melody']}};const result=await f.a.midiRenderForMix(f.p.projectId);assert.equal(result.ok,false);assert.match(result.error,/stale/);assert.equal(f.indexedDB.stores.get('longWavBinaries').size,0)});

test('final export reuses a bypassed durable stem and still applies explicit channel processing',async()=>{
 const {a,p,repo}=await setup();
 const pcm={sampleRate:48000,channels:[Array.from({length:24000},(_,i)=>.1*Math.sin(2*Math.PI*997*i/48000))]};
 const file=new Blob([a.pcmEncodeWav(pcm)],{type:'audio/wav'});file.name='Stem.wav';
 const imported=await a.pcmImportLongFile(file,p.projectId);assert.equal(imported.ok,true,imported.error);
 const plan={format:'nova-final-export-plan-v1',routes:[{key:'wav:'+imported.assetId,role:'instrument',startSeconds:0,gainDb:0,muted:false}],targetLufs:-18,ceilingDb:-1,mixMasterOnly:true};
 const first=await a.finalPreview(p.projectId,plan);assert.equal(first.ok,true,first.error);
 const raw=a.pcmDecodeWav(await first.candidate.files.find(x=>x.name==='Mix.wav').blob.arrayBuffer());
 for(let i=0;i<24000;i+=97)assert.equal(raw.channels[0][i],Math.round(pcm.channels[0][i]*32768)/32768);
 a.finalCancel();const changed=await repo.get(p.projectId);changed.longWavAssets[0].mixHistory={cursor:0,settings:[{gainDb:-6,eq:{frequency:1000,gainDb:0,q:1},compressor:{thresholdDb:-12,ratio:1,attackMs:10,releaseMs:100}}]};await repo.put(changed);a.state.projects=[changed];
 const edited=await a.finalPreview(p.projectId,plan);assert.equal(edited.ok,true,edited.error);
 const quieter=a.pcmDecodeWav(await edited.candidate.files.find(x=>x.name==='Mix.wav').blob.arrayBuffer());
 assert.ok(Math.abs(a.pcmAnalyze(quieter).peak/a.pcmAnalyze(raw).peak-10**(-6/20))<.001);
 assert.deepEqual(Buffer.from(await (await a.pcmLoadLongWav(p.projectId,imported.assetId)).arrayBuffer()),Buffer.from(await file.arrayBuffer()));
});

test('quiet long Master normalizes after compression and keeps input settings through undo/reopen/archive',async()=>{
 const f=await masterSetup(48000,.001),{a,p,assetId}=f;const settings=a.longMixHistory(a.state.projects[0].longWavAssets[0]).settings[0];settings.gainDb=6;settings.compressor={thresholdDb:-60,ratio:4,attackMs:10,releaseMs:100};
 assert.equal((await a.longMixPreview(p.projectId,assetId,settings)).ok,true);assert.equal((await a.longMixSave(p.projectId,assetId)).ok,true);
 const c=await a.longMasterPreview(p.projectId,assetId,-18,-1);assert.equal(c.ok,true,c.error);assert.ok(c.settings.postGainDb>24);assert.equal(c.settings.gainDb,6);assert.deepEqual(JSON.parse(JSON.stringify(c.settings.compressor)),settings.compressor);assert.equal(c.mastering.targetReached,true);
 const before=await a.masterMeasure(a.pcmRenderLongWav(await a.pcmLoadLongWav(p.projectId,assetId),settings));assert.ok(Math.abs(c.mastering.after.lufs-before.lufs-c.settings.postGainDb)<.05);assert.equal(c.mastering.after.clippingSamples,0);
 const expected=Buffer.from(await c.blob.arrayBuffer());assert.equal((await a.longMixSave(p.projectId,assetId)).ok,true);const saved=await f.repo.get(p.projectId);assert.ok(saved.longWavAssets[0].mixHistory.settings.at(-1).postGainDb>24);
 assert.equal((await a.longMixSave(p.projectId,assetId,-1)).ok,true);assert.equal((await a.longMixSave(p.projectId,assetId,1)).ok,true);assert.deepEqual(Buffer.from(await (await a.longMixExport(p.projectId,assetId)).blob.arrayBuffer()),expected);
 const archive=await a.createLongWavArchive(),dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());const restored=await dst.a.restoreLongWavArchive(archive,{settings:false});assert.equal(restored.ok,true,restored.error);const q=restored.projects[0];dst.a.pcmMixView(q.projectId);assert.deepEqual(Buffer.from(await (await dst.a.longMixExport(q.projectId,q.longWavAssets[0].id)).blob.arrayBuffer()),expected);
});
test('post-master gain is validated without widening legacy input gain; export cannot bypass it',async()=>{
 const f=await masterSetup(),{a,p,assetId}=f,s=a.longMixHistory(a.state.projects[0].longWavAssets[0]).settings[0];
 for(const value of [null,'1',NaN,Infinity,-61,61])assert.throws(()=>a.longMixSettings({...s,postGainDb:value},48000),/master-gain/);
 assert.throws(()=>a.longMixSettings({...s,gainDb:25},48000),/long-mix-gain/);assert.equal(JSON.stringify(a.longMixSettings(s,48000)),JSON.stringify(s));
 assert.equal((await a.longMixPreview(p.projectId,assetId,{...s,postGainDb:-6})).ok,true);assert.equal((await a.longMixSave(p.projectId,assetId)).ok,true);
 const r=await a.finalPreview(p.projectId,{format:'nova-final-export-plan-v1',routes:[{key:'wav:'+assetId,role:'instrument',startSeconds:0,gainDb:0,muted:false}],targetLufs:-18,ceilingDb:-1,includeMidi:false,mixMasterOnly:true});assert.equal(r.ok,true,r.error);const measured=await a.masterMeasure(a.pcmDecodeWavStream(r.candidate.files.find(x=>x.name==='Mix.wav').blob));assert.ok(Math.abs(measured.lufs-(-23.01-6+3.0103))<.06,measured.lufs);
});

test('archive restore bounds metadata serialization during chunk reads and still commits exact bytes',async()=>{
 const src=await setup();await src.a.pcmImportLongFile(wav(120000),src.p.projectId);const archive=await src.a.createLongWavArchive(),dst=await setup();dst.w.performance={now:()=>0};let reads=0;
 Object.defineProperty(dst.a.state.projects[0],'productionNotes',{enumerable:true,configurable:true,get(){reads++;return 'unchanged'}});
 const r=await dst.a.restoreLongWavArchive(archive,{settings:false});assert.equal(r.ok,true,r.error);assert.ok(reads<20,reads);assert.equal((await dst.repo.list()).length,2);assert.equal((await dst.a.pcmLoadLongWav(r.projects[0].projectId,r.projects[0].longWavAssets[0].id)).size,240044);
});
for(const phase of ['read','transaction'])test('archive forced boundary rejects in-place edits with frozen clock during '+phase,async()=>{
 const src=await setup();await src.a.pcmImportLongFile(wav(120000),src.p.projectId);const archive=await src.a.createLongWavArchive(),dst=await setup(),before=JSON.stringify(await dst.repo.list());dst.w.performance={now:()=>0};
 if(phase==='read'){const slice=archive.slice.bind(archive);let reads=0;archive.slice=(...args)=>{const part=slice(...args);if(++reads===3)dst.a.state.projects[0].productionNotes='new unsaved value';return part}}
 else{const restore=dst.repo.restoreLongArchive.bind(dst.repo);dst.repo.restoreLongArchive=async(...args)=>{dst.a.state.projects[0].productionNotes='new unsaved value';return restore(...args)}}
 const r=await dst.a.restoreLongWavArchive(archive,{settings:false});assert.equal(r.ok,false);assert.match(r.error,/state-conflict/);assert.equal(JSON.stringify(await dst.repo.list()),before);assert.equal(dst.indexedDB.stores.get('longWavBinaries').size,0);assert.equal(dst.a.state.projects[0].productionNotes,'new unsaved value');
});

for(const mode of ['mix','master'])test(`long ${mode} rejects in-place change at publication with frozen clock`,async()=>{
 const f=await setup(),{a,p,repo}=f,r=await a.pcmImportLongFile(Object.assign(new Blob([a.pcmEncodeWav({sampleRate:48000,channels:[Array.from({length:24000},(_,i)=>.1*Math.sin(i*.1))]})]),{name:'48k.wav'}),p.projectId);f.w.performance={now:()=>0};
 const original=JSON.stringify(await repo.get(p.projectId)),get=repo.get.bind(repo);let reads=0;
 repo.get=async id=>{const v=await get(id);if(++reads===4)a.state.projects[0].productionNotes='changed during final read';return v};
 const result=mode==='master'?await a.longMasterPreview(p.projectId,r.assetId,-18,-1):await a.longMixRender(p.projectId,r.assetId,{gainDb:0,eq:{frequency:1000,gainDb:0,q:1},compressor:{thresholdDb:-18,ratio:1,attackMs:10,releaseMs:100}});
 assert.equal(result.ok,false);assert.match(result.error,/stale/);assert.equal(JSON.stringify(await get(p.projectId)),original);assert.equal(a.longMix.candidate,null);
});

test('archive creation bounds repeated live metadata reads while preserving all authenticated bytes',async()=>{
 const f=await setup(),{a,p}=f;await a.pcmImportLongFile(wav(),p.projectId);f.w.performance={now:()=>0};
 let reads=0;Object.defineProperty(a.state.projects[0],'productionNotes',{enumerable:true,configurable:true,get(){reads++;return ''}});
 const archive=await a.createLongWavArchive();assert.ok(reads<=8,`metadata read ${reads} times`);
 const dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());const r=await dst.a.restoreLongWavArchive(archive);assert.equal(r.ok,true,r.error);
 const source=await a.pcmLoadLongWav(p.projectId,a.state.projects[0].longWavAssets[0].id),copy=await dst.a.pcmLoadLongWav(r.projects[0].projectId,r.projects[0].longWavAssets[0].id);
 assert.deepEqual(Buffer.from(await copy.arrayBuffer()),Buffer.from(await source.arrayBuffer()));
});
for(const mode of ['state','cancel'])test(`archive creation frozen-clock ${mode} during hashing cannot publish a backup`,async()=>{
 const f=await setup(),{a,p,repo}=f;await a.pcmImportLongFile(wav(),p.projectId);const before=JSON.stringify(await repo.list()),get=repo.getLongWav.bind(repo);f.w.performance={now:()=>0};
 repo.getLongWav=async id=>{const rec=await get(id),slice=rec.blob.slice.bind(rec.blob);let reads=0;rec.blob.slice=(...args)=>{const part=slice(...args),read=part.arrayBuffer.bind(part);part.arrayBuffer=async()=>{const bytes=await read();if(++reads===2){if(mode==='state')a.state.projects[0].productionNotes='in-place edit';else a.cancelArchiveTransfer()}return bytes};return part};return rec};
 await assert.rejects(a.createLongWavArchive(),mode==='state'?/state-conflict/:/cancelled/);assert.equal(JSON.stringify(await repo.list()),before);
});

test('Logic long WAV return forks metadata and binary atomically, reopens and restores without a whole-file read',async()=>{
 const f=await renderSetup(),file=wav(2100000),original=JSON.stringify(await f.repo.get(f.p.projectId));
 file.arrayBuffer=()=>{throw Error('whole-file-read-forbidden')};
 const r=await f.a.logicImportAudioReturn(file,f.p.projectId);assert.equal(r.ok,true,r.error);
 assert.notEqual(r.project.projectId,f.p.projectId);assert.equal(JSON.stringify(await f.repo.get(f.p.projectId)),original);
 assert.equal(JSON.stringify(r.project.midiData),JSON.stringify(f.p.midiData));assert.equal(JSON.stringify(r.project.musicalSettings),JSON.stringify(f.p.musicalSettings));
 const asset=r.project.longWavAssets.at(-1),link=r.project.integrations.logicPro.at(-1);assert.equal(asset.frames,2100000);assert.equal(link.assetId,asset.id);assert.equal(link.startFrame,0);assert.equal(link.sourceRevision,f.p.revision);
 const fresh=fixture(f.indexedDB);fresh.a.setRepository(fresh.a.indexedDbRepository());fresh.a.state.projects=await fresh.a.indexedDbRepository().list();
 const bytes=await fresh.a.pcmLoadLongWav(r.project.projectId,asset.id);assert.equal(bytes.size,file.size);
 const archive=await fresh.a.createLongWavArchive(),dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());
 const restored=await dst.a.restoreLongWavArchive(archive,{settings:false});assert.equal(restored.ok,true,restored.error);
 const copy=restored.projects.find(p=>p.integrations?.logicPro?.length);assert.ok(copy);assert.equal(copy.integrations.logicPro.at(-1).assetId,copy.longWavAssets.at(-1).id);
 assert.deepEqual(Buffer.from(await (await dst.a.pcmLoadLongWav(copy.projectId,copy.longWavAssets.at(-1).id)).arrayBuffer()),Buffer.from(await bytes.arrayBuffer()));
});
test('Logic long return quota, cancellation and source conflict leave neither fork nor orphan binary',async()=>{
 for(const kind of ['quota','cancel','conflict']){
  const f=await renderSetup(),file=wav(100),before=JSON.stringify(await f.repo.get(f.p.projectId));
  if(kind==='quota')f.indexedDB.fail();
  if(kind==='conflict')await f.repo.put({...f.p,revision:50});
  if(kind==='cancel'){const slice=file.slice.bind(file);file.slice=(...args)=>{f.a.pcmCancel();return slice(...args)}}
  const r=await f.a.logicImportAudioReturn(file,f.p.projectId);assert.equal(r.ok,false,kind);
  assert.equal((await f.repo.list()).length,1);assert.equal(f.indexedDB.stores.get('longWavBinaries').size,0);
  if(kind!=='conflict')assert.equal(JSON.stringify(await f.repo.get(f.p.projectId)),before);
 }
});

test('small archive-backed records detach bounded bytes before the source backing expires',async()=>{
 const f=await setup(),raw=wav(100),bytes=await raw.arrayBuffer(),hashes=[Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex')];let available=true,reads=0;
 // A transient readable source; it cannot itself be structured-cloned into IDB.
 const borrowed={size:raw.size,type:raw.type,slice(start,end){assert.equal(available,true);assert.ok(end-start<=1048576);reads++;return raw.slice(start,end)}};
 const next=JSON.parse(JSON.stringify(f.p));next.longWavAssets=[{id:'detached-short',name:'short.wav',size:raw.size,frames:100,sampleRate:8000,channels:1,hashes}];next.revision++;
 await f.repo.putLongWav(next,{id:'detached-short',blob:borrowed,hashes},JSON.stringify(f.p),()=>{});available=false;
 assert.ok(reads>0);const saved=await f.a.pcmLoadLongWav(next.projectId,'detached-short');assert.deepEqual(Buffer.from(await saved.arrayBuffer()),Buffer.from(bytes));
});

test('Logic multi-Stem return atomically retains track identities through reopen, archive and final Export',async()=>{
 const f=await renderSetup();f.p.midiData.tracks.push({...JSON.parse(JSON.stringify(f.p.midiData.tracks[0])),id:'bass',name:'Bass',part:'bass'});await f.repo.put(f.p);
 const before=JSON.stringify(await f.repo.get(f.p.projectId)),files=[0,1].map(()=>new Blob([f.a.pcmEncodeWav({sampleRate:48000,channels:[Array.from({length:48000},(_,i)=>.02*Math.sin(i*.1)),Array.from({length:48000},(_,i)=>.02*Math.sin(i*.1))]})],{type:'audio/wav'}));files.forEach((x,i)=>{x.name=['piano.wav','bass.wav'][i];x.arrayBuffer=()=>{throw Error('whole-file-read-forbidden')}});
 const r=await f.a.logicImportStemReturns(files.map((file,i)=>({file,trackId:['melody','bass'][i]})),f.p.projectId);assert.equal(r.ok,true,r.error);
 assert.equal(JSON.stringify(await f.repo.get(f.p.projectId)),before);assert.equal(r.project.longWavAssets.length,2);assert.equal(r.project.integrations.logicPro[1].trackId,'bass');
 const reopened=fixture(f.indexedDB);reopened.a.setRepository(reopened.a.indexedDbRepository());reopened.a.state.projects=await reopened.a.indexedDbRepository().list();
 const archive=await reopened.a.createLongWavArchive(),dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());const restored=await dst.a.restoreLongWavArchive(archive,{settings:false});assert.equal(restored.ok,true,restored.error);
 const p=restored.projects.find(x=>x.integrations?.logicPro?.length);assert.ok(p);const restoredSource=restored.projects.find(x=>!x.integrations?.logicPro?.length);assert.ok(restoredSource);for(const link of p.integrations.logicPro){assert.equal(link.sourceProjectId,restoredSource.projectId);assert.equal(link.originalSourceProjectId,f.p.projectId)}for(const link of p.integrations.logicPro){const asset=p.longWavAssets.find(a=>a.id===link.assetId);assert.ok(asset);assert.equal(asset.midiRender.stemTrackId,link.trackId);assert.equal((await dst.a.pcmLoadLongWav(p.projectId,asset.id)).size,files[0].size)}
 const plan={format:'nova-final-export-plan-v1',routes:p.longWavAssets.map(a=>({key:'wav:'+a.id,role:'instrument',startSeconds:0,gainDb:0,muted:false})),targetLufs:-18,ceilingDb:-1,includeMidi:false};
 // Small actual PCM verifies restored final routing; commercial quality remains listening acceptance.
 const out=await dst.a.finalPreview(p.projectId,plan);assert.equal(out.ok,true,out.error);assert.equal(out.candidate.files.filter(x=>/Instrument-/.test(x.name)).length,2);
 const second=fixture();second.a.setRepository(second.a.indexedDbRepository());const twice=await second.a.restoreLongWavArchive(await dst.a.createLongWavArchive(),{settings:false});assert.equal(twice.ok,true,twice.error);
 const twiceReturn=twice.projects.find(x=>x.integrations?.logicPro?.length);for(const link of twiceReturn.integrations.logicPro){assert.ok(twice.projects.some(x=>x.projectId===link.sourceProjectId));assert.equal(link.originalSourceProjectId,f.p.projectId);assert.ok(twiceReturn.longWavAssets.some(x=>x.id===link.assetId))}
});
for(const mode of ['length','track','duplicate','cancel','quota','conflict','corrupt'])test('Logic multi-Stem '+mode+' publishes neither partial song nor orphan bytes',async()=>{
 const f=await renderSetup();f.p.midiData.tracks.push({...JSON.parse(JSON.stringify(f.p.midiData.tracks[0])),id:'bass'});await f.repo.put(f.p);
 const entries=[{file:wav(100),trackId:'melody'},{file:mode==='corrupt'?Object.assign(new Blob([new Uint8Array(44)]),{name:'bad.wav'}):wav(mode==='length'?101:100),trackId:mode==='track'?'missing':mode==='duplicate'?'melody':'bass'}];
 if(mode==='quota')f.indexedDB.fail();if(mode==='conflict')await f.repo.put({...f.p,revision:50});
 if(mode==='cancel'){const slice=entries[1].file.slice.bind(entries[1].file);entries[1].file.slice=(...args)=>{f.a.pcmCancel();return slice(...args)}}
 const r=await f.a.logicImportStemReturns(entries,f.p.projectId);assert.equal(r.ok,false,mode);assert.equal((await f.repo.list()).length,1);assert.equal(f.indexedDB.stores.get('longWavBinaries').size,0);assert.equal(f.a.pcmEditor.busy,false);
});

test('Demucs six WAV adoption preserves source bytes and restores independent audio routes',async()=>{
 const f=await renderSetup(),roles=['vocals','drums','bass','guitar','piano','other'];
 const original=wav(100),entries=roles.map((role,i)=>({role,trackId:'demucs-'+i,file:wav(100)}));
 const before=JSON.stringify(await f.repo.get(f.p.projectId));
 const r=await f.a.logicImportStemReturns(entries,f.p.projectId,{separatedAudio:true,model:'htdemucs_6s',sourceSha256:'a'.repeat(64),sourceFile:original});
 assert.equal(r.ok,true,r.error);assert.equal(JSON.stringify(await f.repo.get(f.p.projectId)),before);
 assert.equal(r.project.longWavAssets.length,6);assert.equal(r.project.fileReferences.length,1);
 assert.equal(r.project.audioSeparationHistory[0].assetIds.length,6);
 const dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());
 const restored=await dst.a.restoreLongWavArchive(await f.a.createLongWavArchive(),{settings:false});assert.equal(restored.ok,true,restored.error);
 const p=restored.projects.find(p=>p.audioSeparationHistory?.length);assert.ok(p);
 for(const asset of p.longWavAssets)assert.equal((await dst.a.pcmLoadLongWav(p.projectId,asset.id)).size,entries[0].file.size);
 assert.equal((await dst.a.loadReferenceFile(p.projectId,'fileReferences',0)).blob.size,original.size);
});

test('automatic archive backup detaches borrowed backing before acknowledging storage',async()=>{
 const {repo}=await setup(),bytes=new Uint8Array([1,2,3,4]);let reads=0;
 const archive=new Blob([bytes],{type:'application/octet-stream'});archive.slice=(start,end)=>({async arrayBuffer(){reads++;return bytes.slice(start,end).buffer}});
 await repo.putAutoBackup({backupId:'detached-archive',archive});
 const saved=(await repo.listAutoBackups())[0];
 assert.ok(reads>0,'archive bytes must be read before the durable write');
 bytes.fill(0);assert.deepEqual([...new Uint8Array(await saved.archive.arrayBuffer())],[1,2,3,4]);
});
test('automatic archive backing read failure preserves the prior backup',async()=>{
 const {repo}=await setup();await repo.putAutoBackup({backupId:'keep',archive:new Blob(['original'])});
 await assert.rejects(repo.putAutoBackup({backupId:'keep',archive:Object.assign(new Blob(['next']),{slice(){return{arrayBuffer:async()=>{throw Error('backing-unavailable')}}}})}),/backing-unavailable/);
 assert.equal(await (await repo.listAutoBackups())[0].archive.text(),'original');
});
test('full archive export refuses authenticated WAV with mismatched frame metadata',async()=>{
 const {a,p,repo}=await setup(),r=await a.pcmImportLongFile(wav(100),p.projectId);assert.equal(r.ok,true,r.error);
 const stored=await repo.get(p.projectId);stored.longWavAssets[0].frames++;await repo.put(stored);a.state.projects=[stored];
 await assert.rejects(a.createLongWavArchive(),/archive-wav-metadata-mismatch/);
 assert.equal((await repo.get(p.projectId)).longWavAssets[0].frames,101);
});

test('automatic archive short backing read cannot replace an existing backup',async()=>{
 const {repo}=await setup();await repo.putAutoBackup({backupId:'keep',archive:new Blob(['original'])});
 const archive=Object.assign(new Blob(['next']),{slice(){return{arrayBuffer:async()=>new ArrayBuffer(1)}}});
 await assert.rejects(repo.putAutoBackup({backupId:'keep',archive}),/long-wav-binary-chunks-invalid/);
 assert.equal(await (await repo.listAutoBackups())[0].archive.text(),'original');
});

async function historySource(){
 const src=await setup();await src.a.pcmImportLongFile(wav(100),src.p.projectId);
 await src.repo.putMidiHistory({id:'export-one',projectId:src.p.projectId,createdAt:'2026-10-29',filename:'song.mid',future:{keep:true}});
 await src.repo.putMidiImportHistory({id:'import-one',projectId:src.p.projectId,createdAt:'2026-10-29',fileName:'source.mid',warningCount:2});
 return src;
}
async function changeManifest(archive,edit){const v=new DataView(await archive.slice(0,12).arrayBuffer()),n=v.getUint32(8,true),m=JSON.parse(await archive.slice(12,12+n).text());edit(m);const body=new Blob([JSON.stringify(m)]);v.setUint32(8,body.size,true);return new Blob([v.buffer,body,archive.slice(12+n)])}
test('complete archive migrates MIDI histories with remapped identities and fresh repository reload',async()=>{
 const src=await historySource(),archive=await src.a.createLongWavArchive(),dst=await setup();
 await dst.repo.putMidiHistory({id:'export-one',projectId:dst.p.projectId,filename:'existing.mid'});
 for(let i=0;i<2;i++){
  const r=await dst.a.restoreLongWavArchive(archive);assert.equal(r.ok,true,r.error);
  const exports=await dst.repo.listMidiHistory(),imports=await dst.repo.listMidiImportHistory();
  const e=exports.find(x=>x.projectId===r.projects[0].projectId),im=imports.find(x=>x.projectId===r.projects[0].projectId);
  assert.equal(e.filename,'song.mid');assert.equal(e.future.keep,true);assert.notEqual(e.id,'export-one');assert.equal(im.warningCount,2);assert.notEqual(im.id,'import-one');
 }
 const fresh=fixture(dst.indexedDB),repo=fresh.a.indexedDbRepository();assert.equal((await repo.listMidiHistory()).length,3);assert.equal((await repo.listMidiImportHistory()).length,2);assert.equal((await repo.listMidiHistory()).find(x=>x.id==='export-one').filename,'existing.mid');
});
test('history write failure atomically rolls back audio, settings, projects and both histories',async()=>{
 const src=await historySource(),archive=await src.a.createLongWavArchive(),dst=await setup();const before=JSON.stringify(await dst.repo.list());
 const restore=dst.repo.restoreLongArchive.bind(dst.repo);dst.repo.restoreLongArchive=(...args)=>{args[5].imports.push(args[5].imports[0]);return restore(...args)};
 const r=await dst.a.restoreLongWavArchive(archive);assert.equal(r.ok,false);assert.equal(JSON.stringify(await dst.repo.list()),before);assert.equal((await dst.repo.listMidiHistory()).length,0);assert.equal((await dst.repo.listMidiImportHistory()).length,0);assert.equal(dst.indexedDB.stores.get('longWavBinaries').size,0);assert.equal(await dst.repo.getSettings(),undefined);
});
test('legacy archives without histories restore; malformed histories fail before writing',async()=>{
 const src=await historySource(),archive=await src.a.createLongWavArchive();
 for(const value of [null,{}, {exports:[{id:'x'}],imports:[]}]){
  const dst=await setup(),before=JSON.stringify(await dst.repo.list()),bad=await changeManifest(archive,m=>m.midiHistories=value);
  const r=await dst.a.restoreLongWavArchive(bad);assert.equal(r.ok,false);assert.match(r.error,/history-invalid/);assert.equal(JSON.stringify(await dst.repo.list()),before);
 }
 const dst=await setup(),legacy=await changeManifest(archive,m=>delete m.midiHistories);assert.equal((await dst.a.restoreLongWavArchive(legacy)).ok,true);assert.equal((await dst.repo.listMidiHistory()).length,0);
});
test('history changes during archive export reject publication',async()=>{
 const src=await historySource(),read=src.repo.listMidiHistory;let calls=0;src.repo.listMidiHistory=async()=>{const rows=await read();if(++calls===2)rows[0].filename='concurrent.mid';return rows};await assert.rejects(src.a.createLongWavArchive(),/history-conflict/);
});

async function automaticSource(audio=false){
 const src=await setup();if(audio)await src.a.pcmImportLongFile(wav(100),src.p.projectId);
 src.a.state.settings=src.a.defaultSettings();Object.assign(src.a.state.settings.backup,{automaticEnabled:true,intervalHours:1,maxCopies:1});await src.repo.putSettings(src.a.state.settings);return src;
}
const backupDay=n=>`2026-11-${String(n).padStart(2,'0')}T00:00:00.000Z`;
test('history-only export/import changes refresh automatic archive without audio or stale UI histories',async()=>{
 const src=await automaticSource();const first=await src.a.runAutoBackupCheck(backupDay(1));assert.equal(first.created,true,first.reason);
 const project=JSON.stringify(await src.repo.get(src.p.projectId));
 for(const [day,method,id] of [[2,'putMidiHistory','export'],[3,'putMidiImportHistory','import']]){
  await src.repo[method]({id,projectId:src.p.projectId,filename:id+'.mid',future:{keep:true}});
  assert.equal(src.a.state.midiExportHistory.length,0);assert.equal(src.a.state.midiImportHistory.length,0);
  const result=await src.a.runAutoBackupCheck(backupDay(day));assert.equal(result.created,true,result.reason);assert.ok(result.backup.archive instanceof Blob);
  const dst=fixture(),repo=dst.a.indexedDbRepository();dst.a.setRepository(repo);const restored=await dst.a.restoreLongWavArchive(result.backup.archive);assert.equal(restored.ok,true,restored.error);
  assert.equal((await repo.listMidiHistory()).length,1);assert.equal((await repo.listMidiImportHistory()).length,day===3?1:0);
  assert.equal((await repo.listMidiHistory())[0].projectId,restored.projects[0].projectId);
 }
 assert.equal(JSON.stringify(await src.repo.get(src.p.projectId)),project);
 assert.equal((await src.a.runAutoBackupCheck(backupDay(4))).reason,'unchanged');
 // Updating a row without changing its ID or timestamp must also be detected.
 await src.repo.putMidiHistory({id:'export',projectId:src.p.projectId,filename:'renamed.mid'});
 assert.equal((await src.a.runAutoBackupCheck(backupDay(5))).created,true);
});
test('history-only automatic backup quota abort keeps previous committed backup after reopen',async()=>{
 const src=await automaticSource(true),first=await src.a.runAutoBackupCheck(backupDay(1));assert.equal(first.created,true);
 await src.repo.putMidiHistory({id:'later',projectId:src.p.projectId});src.indexedDB.fail();
 const result=await src.a.runAutoBackupCheck(backupDay(2));assert.equal(result.created,false);assert.equal(result.reason,'storage-error');
 await src.repo.close();const fresh=fixture(src.indexedDB),repo=fresh.a.indexedDbRepository(),records=await repo.listAutoBackups();assert.equal(records.length,1);assert.equal(records[0].backupId,first.backup.backupId);
 assert.equal(Buffer.compare(Buffer.from(await records[0].archive.arrayBuffer()),Buffer.from(await first.backup.archive.arrayBuffer())),0);
});
test('automatic backup interrupted by history mutation rejects publication and keeps last normal copy',async()=>{
 const src=await automaticSource(true),first=await src.a.runAutoBackupCheck(backupDay(1));assert.equal(first.created,true);
 await src.repo.putMidiImportHistory({id:'new',projectId:src.p.projectId});
 const read=src.repo.listMidiImportHistory;let calls=0;src.repo.listMidiImportHistory=async()=>{const rows=await read();if(++calls===2)await src.repo.putMidiImportHistory({id:'during',projectId:src.p.projectId});return rows};
 const r=await src.a.runAutoBackupCheck(backupDay(2));assert.equal(r.created,false);assert.match(r.reason,/conflict/);assert.equal((await src.repo.listAutoBackups())[0].backupId,first.backup.backupId);
});
test('automatic history read failure cannot prune the previous normal backup',async()=>{
 const src=await automaticSource(),first=await src.a.runAutoBackupCheck(backupDay(1));assert.equal(first.created,true);
 src.repo.listMidiHistory=async()=>{throw Error('history-read-unavailable')};const r=await src.a.runAutoBackupCheck(backupDay(2));assert.equal(r.created,false);assert.equal(r.reason,'history-read-unavailable');assert.equal((await src.repo.listAutoBackups())[0].backupId,first.backup.backupId);
});
test('automatic full archive restores project, production history, settings, MIDI histories and exact WAV bytes',async()=>{
 const src=await automaticSource(true);const p=await src.repo.get(src.p.projectId);p.productionHistory=[{id:'production-1',operation:'test',future:{keep:true}}];await src.repo.put(p);src.a.state.projects=[p];
 await src.repo.putMidiHistory({id:'export',projectId:p.projectId,filename:'export.mid'});await src.repo.putMidiImportHistory({id:'import',projectId:p.projectId,fileName:'import.mid'});
 const result=await src.a.runAutoBackupCheck(backupDay(1));assert.equal(result.created,true,result.reason);
 const dst=fixture(),repo=dst.a.indexedDbRepository();dst.a.setRepository(repo);const r=await dst.a.restoreLongWavArchive(result.backup.archive);assert.equal(r.ok,true,r.error);
 const restored=(await repo.list())[0];for(const key of ['midiData','productionHistory','legacy'])assert.equal(JSON.stringify(restored[key]),JSON.stringify(p[key]),key);
 assert.equal(JSON.stringify(restored.longWavAssets.map(({id,...rest})=>rest)),JSON.stringify(p.longWavAssets.map(({id,...rest})=>rest)));assert.equal((await repo.getSettings()).backup.intervalHours,1);assert.equal((await repo.listMidiHistory())[0].filename,'export.mid');assert.equal((await repo.listMidiImportHistory())[0].fileName,'import.mid');
 const original=await src.a.pcmLoadLongWav(p.projectId,p.longWavAssets[0].id),copy=await dst.a.pcmLoadLongWav(restored.projectId,restored.longWavAssets[0].id);assert.equal(Buffer.compare(Buffer.from(await original.arrayBuffer()),Buffer.from(await copy.arrayBuffer())),0);
});

async function rewriteLegacyManifest(archive,change){
 const header=new DataView(await archive.slice(0,12).arrayBuffer()),length=header.getUint32(8,true),manifest=JSON.parse(await archive.slice(12,12+length).text());
 change(manifest);const json=new Blob([JSON.stringify(manifest)]),out=new ArrayBuffer(12),v=new DataView(out);v.setUint32(0,0x4e4f5641);v.setUint32(4,1,true);v.setUint32(8,json.size,true);return new Blob([out,json,archive.slice(12+length)]);
}
for(const route of ['project','backup','archive'])for(const historical of [false,true])test(`legacy MIDI validation protects ${route} stores, historical=${historical}`,async()=>{
 const src=await setup();await src.a.pcmImportLongFile(wav(100),src.p.projectId);
 let p=await src.repo.get(src.p.projectId);p.midiData={ppq:480,tracks:[{notes:[{note:60,start:0,duration:480}]}]};
 if(historical)p=src.a.versionCapture(p,'Legacy');await src.repo.put(p);src.a.state.projects=[p];const archive=await src.a.createLongWavArchive();
 const corrupt=p=>{const target=historical?p.songVersions.checkpoints[0].snapshot:p;target.midiData.tracks[0].notes[0].duration=0};
 const bad=await rewriteLegacyManifest(archive,m=>corrupt(m.projects[0])),metadata=JSON.parse(JSON.stringify(p));delete metadata.longWavAssets;if(historical)delete metadata.songVersions.checkpoints[0].snapshot.longWavAssets;corrupt(metadata);
 const dst=await setup();await dst.repo.putSettings(dst.a.defaultSettings());await dst.repo.putAutoBackup({backupId:'safe',createdAt:'2026-10-29T00:00:00Z',snapshot:dst.a.backupObject()});
 const before=JSON.stringify([...dst.indexedDB.stores].map(([k,v])=>[k,[...v]]));
 const result=route==='project'?await dst.a.importText(JSON.stringify(metadata)):route==='backup'?await dst.a.restoreBackup({format:dst.a.BACKUP_FORMAT,version:dst.a.BACKUP_VERSION,projects:[metadata]},{settings:false}):await dst.a.restoreLongWavArchive(bad);
 assert.equal(result.ok,false);assert.match(result.error||result.message,/invalid|不正/);
 assert.equal(JSON.stringify([...dst.indexedDB.stores].map(([k,v])=>[k,[...v]])),before);
 const reopened=fixture(dst.indexedDB);reopened.a.setRepository(reopened.a.indexedDbRepository());assert.equal((await reopened.a.restoreLongWavArchive(archive)).ok,true);
 assert.equal((await reopened.a.indexedDbRepository().listAutoBackups()).length,1);
});
test('pre-history archive preserves legacy aliases, opaque data, historical WAV and settings after reopen',async()=>{
 const src=await setup();await src.a.pcmImportLongFile(wav(100),src.p.projectId);let p=await src.repo.get(src.p.projectId);
 p.midiData={ppq:480,tracks:[{notes:[{note:64,start:0,duration:480,legacyExtension:{keep:true}}]}],opaque:'keep'};p=src.a.versionCapture(p,'Legacy');p.longWavAssets=[];
 await src.repo.put(p);src.a.state.projects=[p];const original=JSON.stringify(p),archive=await rewriteLegacyManifest(await src.a.createLongWavArchive(),m=>delete m.midiHistories),dst=fixture();dst.a.setRepository(dst.a.indexedDbRepository());
 const result=await dst.a.restoreLongWavArchive(archive);assert.equal(result.ok,true,result.error);await dst.a.indexedDbRepository().close();const fresh=fixture(dst.indexedDB),repo=fresh.a.indexedDbRepository();fresh.a.setRepository(repo);const copy=await repo.get(result.projects[0].projectId);
 assert.equal(JSON.stringify(copy.midiData),JSON.stringify(p.midiData));assert.equal(JSON.stringify(copy.songVersions.checkpoints[0].snapshot.midiData),JSON.stringify(p.midiData));assert.equal(copy.legacy.keep,true);
 const asset=copy.songVersions.checkpoints[0].snapshot.longWavAssets[0],record=await repo.getLongWav(asset.id);assert.equal(Buffer.compare(Buffer.from(await record.blob.arrayBuffer()),Buffer.from(await wav(100).arrayBuffer())),0);
 assert.equal((await repo.listMidiHistory()).length,0);assert.equal((await repo.listMidiImportHistory()).length,0);assert.equal((await repo.getSettings()).format,src.a.defaultSettings().format);assert.equal(JSON.stringify(await src.repo.get(p.projectId)),original);
});
