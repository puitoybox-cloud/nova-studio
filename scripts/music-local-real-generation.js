// Opt-in real model/voice verification. Requires explicit local assets; no fixtures substitute inference.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const base='http://127.0.0.1:8767';
const server=spawn(process.env.PYTHON||'python',['tools/music-local-generation/serve.py','--port','8767','--weights',process.env.NOVA_MODEL_WEIGHTS,'--sinsy',process.env.NOVA_SINSY,'--dictionary',process.env.NOVA_SINSY_DICTIONARY,'--voice',process.env.NOVA_SINSY_VOICE],{stdio:['ignore','pipe','pipe']});
(async()=>{try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('host exited '+code)))});
 const source=fs.readFileSync('tests/music-studio-ai-midi-candidate-import.test.js','utf8').split('\ntest(')[0],fixture=new Function('require',source+'\nreturn fixture;')(require),f=fixture();
 f.w.location.hostname='127.0.0.1';f.w.File=File;f.w.atob=atob;f.w.fetch=(url,options={})=>fetch(base+url,{...options,headers:{...options.headers,...(options.method==='POST'?{Origin:base}:{})}});
 await f.panel.generateLocalModel(f.p.projectId);
 const r=f.panel._states.get(f.p.projectId),set=r.state.workspace.candidateSets.at(-1);assert.ok(set,r.message);assert.equal(set.candidates.length,3);
 assert.ok(set.candidates.every(c=>c.value.synthetic===false&&c.value.importedMidi.notes.length>0));
 const candidate=set.candidates[0],bundle=f.P.createPreview(f.s,f.core,candidate,{project:f.p}),plan=f.P.auditionPlan(f.s,f.core,bundle,null);assert.ok(plan.tracks[0].notes.length>0);
 f.P.applyPreview(f.s,f.core,bundle,{startMeasure:2,endMeasure:2});assert.ok(f.core.currentTrack(f.s).notes.some(n=>n.id==='original'));
 const repo=f.a.memoryRepository();f.a.setRepository(repo);await repo.put(f.p);assert.equal((await f.a.saveMidiEditor({silent:true})).ok,true);
 const stored=await repo.get(f.p.projectId);assert.equal(stored.aiWorkspace.candidateSets.at(-1).candidates.length,3);
 const scoreFixture=new Function('require',fs.readFileSync('tests/music-studio-score-vocal-return.test.js','utf8').split('\ntest(')[0]+'\nreturn scoreSetup;')(require),s=await scoreFixture();
 s.w.location.hostname='127.0.0.1';s.w.File=File;s.w.atob=atob;s.w.fetch=f.w.fetch;
 const sung=await s.a.generateLocalScoreVocal(s.p.projectId,s.recordId);assert.equal(sung.ok,true,sung.error);
 const rendered=await s.a.vocalRender(s.p.projectId,sung.assetId);assert.ok(rendered.blob.size>44);
 const archive=await s.a.createLongWavArchive(),restored=await s.a.restoreLongWavArchive(archive,{settings:false});assert.equal(restored.ok,true,restored.error);
 const copy=restored.projects[0],again=await s.a.vocalRender(copy.projectId,copy.vocalWorkspace.selectedAssetId);
 assert.deepEqual(Buffer.from(await again.blob.arrayBuffer()),Buffer.from(await rendered.blob.arrayBuffer()));
 const forbidden=await fetch(base+'/__nova_generation/compose',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{}'});assert.equal(forbidden.status,403);
 console.log(JSON.stringify({realInference:true,model:'skytnt/midi-model-tv2o-medium',candidateNotes:set.candidates.map(c=>c.value.importedMidi.notes.length),midiPartialApply:true,midiSaveReopen:true,singingEngine:'Sinsy 0.92 HMM',voice:'NIT SONG070 F001',wavBytes:rendered.blob.size,archiveByteEquality:true,foreignOriginRejected:true},null,2));
}finally{server.kill('SIGTERM')}})().catch(e=>{console.error(e);process.exitCode=1});
