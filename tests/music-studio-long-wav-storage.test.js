const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
// Transactional IDB model: binary structured cloning, commit, abort and reopen.
// Physical browser persistence is a separate acceptance test.
function idb(){const stores=new Map();let fault=false;const db={close(){},objectStoreNames:{contains:n=>stores.has(n)},createObjectStore(n){stores.set(n,new Map());return{createIndex(){}}},transaction(names,mode){names=Array.isArray(names)?names:[names];const staged=new Map(names.map(n=>[n,new Map(stores.get(n))]));let pending=0,aborted=false,timer;const tx={abort(){if(aborted)return;aborted=true;clearImmediate(timer);setImmediate(()=>tx.onabort?.())},objectStore(n){const map=staged.get(n);function req(op){pending++;const r={};setImmediate(()=>{if(aborted)return;try{r.result=op();r.onsuccess?.()}catch(e){r.error=e;r.onerror?.();tx.abort()}pending--;if(!pending&&!aborted){timer=setImmediate(()=>{if(aborted)return;if(mode==='readwrite')for(const[n,m]of staged)stores.set(n,m);tx.oncomplete?.()})}});return r}return{get:k=>req(()=>structuredClone(map.get(k))),getAll:()=>req(()=>structuredClone([...map.values()])),getKey:k=>req(()=>map.has(k)?k:undefined),put:v=>req(()=>{if(fault)throw Error('QuotaExceededError');map.set(v.projectId||v.id,structuredClone(v))}),add:v=>req(()=>{if(fault)throw Error('QuotaExceededError');const key=v.projectId||v.id;if(map.has(key))throw Error('ConstraintError');map.set(key,structuredClone(v))})}}};return tx}};return{stores,fail(){fault=true},open(){const r={};setImmediate(()=>{r.result=db;r.onupgradeneeded?.();r.onsuccess?.()});return r}}}
function fixture(indexedDB=idb()){let seq=0;const w={console,Date,Math,JSON,Intl,Blob,ArrayBuffer,DataView,Float32Array,Uint8Array,crypto:{subtle:webcrypto.subtle,randomUUID:()=>`long-${++seq}`},indexedDB,location:{hash:'#music-studio'}};w.window=w;vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),w);const a=w.MusicStudio;return{a,indexedDB,w}}
function wav(frames=2100000){const b=new ArrayBuffer(44+frames*2),v=new DataView(b),tag=(p,s)=>[...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt()));tag(0,'RIFF');v.setUint32(4,b.byteLength-8,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);tag(36,'data');v.setUint32(40,frames*2,true);const file=new Blob([b],{type:'audio/wav'});file.name='long.wav';return file}
async function setup(){const f=fixture(),a=f.a,repo=a.indexedDbRepository(),p=a.makeProject({projectId:'long-project',projectName:'Long',midiData:{unchanged:true},legacy:{keep:true}});a.setRepository(repo);await repo.put(p);a.state.projects=[p];a.pcmOpen(p.projectId);return{...f,repo,p}}
test('real import route stores >2M samples as Blob and a fresh repository reload verifies every byte',async()=>{const{a,repo,p,indexedDB}=await setup(),file=wav();file.arrayBuffer=()=>{throw Error('whole-file-read-forbidden')};const result=await a.pcmImportFile(file,p.projectId);assert.equal(result.ok,true,result.error);assert.equal(result.project.longWavAssets[0].frames,2100000);assert.deepEqual(JSON.parse(JSON.stringify(result.project.midiData)),{unchanged:true});await repo.close();const fresh=fixture(indexedDB);fresh.a.setRepository(fresh.a.indexedDbRepository());const blob=await fresh.a.pcmLoadLongWav(p.projectId,result.assetId);assert.equal(blob.size,file.size);assert.equal(Buffer.compare(Buffer.from(await blob.arrayBuffer()),Buffer.from(await Blob.prototype.arrayBuffer.call(file))),0)});
test('quota abort preserves metadata and exposes no orphan binary',async()=>{const{a,p,repo,indexedDB}=await setup(),before=JSON.stringify(await repo.get(p.projectId));indexedDB.fail();const r=await a.pcmImportLongFile(wav(100),p.projectId);assert.equal(r.ok,false);assert.match(r.error,/Quota/);assert.equal(JSON.stringify(await repo.get(p.projectId)),before);assert.equal(indexedDB.stores.get('longWavBinaries').size,0)});
test('concurrent project update is rejected without binary writes',async()=>{const{a,p,repo,indexedDB}=await setup();await repo.put({...p,revision:20});const r=await a.pcmImportLongFile(wav(100),p.projectId);assert.equal(r.ok,false);assert.match(r.error,/conflict/);assert.equal(indexedDB.stores.get('longWavBinaries').size,0);assert.equal((await repo.get(p.projectId)).revision,20)});
test('interrupted validation cannot commit',async()=>{const{a,p,indexedDB}=await setup(),file=wav(100),slice=file.slice.bind(file);file.slice=(...args)=>{a.pcmEditor.generation++;return slice(...args)};const r=await a.pcmImportLongFile(file,p.projectId);assert.equal(r.ok,false);assert.match(r.error,/stale/);assert.equal(indexedDB.stores.get('longWavBinaries').size,0)});
test('corrupt or missing binary is rejected; JSON backup cannot claim success',async()=>{const{a,p,indexedDB}=await setup(),r=await a.pcmImportLongFile(wav(100),p.projectId);assert.equal(r.ok,true);const rec=indexedDB.stores.get('longWavBinaries').get(r.assetId);rec.blob=new Blob([new Uint8Array(rec.blob.size)]);await assert.rejects(a.pcmLoadLongWav(p.projectId,r.assetId),/corrupt/);assert.equal(a.exportBackup().ok,false);a.state.settings=a.defaultSettings();a.state.settings.backup.automaticEnabled=true;assert.equal((await a.runAutoBackupCheck()).created,false);const backup=a.backupObject();assert.equal((await a.inspectBackupCompleteness(backup)).fullBackupComplete,false);assert.equal((await a.restoreBackup(backup,{settings:false,projects:true})).ok,false);indexedDB.stores.get('longWavBinaries').delete(r.assetId);await assert.rejects(a.pcmLoadLongWav(p.projectId,r.assetId),/missing/)});
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
 const result=await a.longMixAnalyze(p.projectId,r.assetId);assert.equal(result.ok,true,result.error);assert.equal(result.before.frames,2100000);assert.ok(max<=1048576);assert.ok(reads>400);assert.equal(result.proposals[0].after.clippingSamples,0);
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
