// Opt-in real model/voice verification. Requires explicit local assets; no fixtures substitute inference.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const base='http://127.0.0.1:8767';
const packageApp=process.env.NOVA_PACKAGE_APP;
const executable=packageApp?path.join(fs.realpathSync(packageApp),'Contents/Helpers/MusicStudioEngine'):(process.env.PYTHON||'python');
const arguments_=packageApp?['--port','8767']:['tools/music-local-generation/serve.py','--port','8767','--weights',process.env.NOVA_MODEL_WEIGHTS,'--sinsy',process.env.NOVA_SINSY,'--dictionary',process.env.NOVA_SINSY_DICTIONARY,'--voice',process.env.NOVA_SINSY_VOICE];
const server=spawn(executable,arguments_,{stdio:['ignore','pipe','pipe']});
let serverFailure;server.once('error',error=>{serverFailure=error});
server.stdout.on('data',data=>process.stdout.write(data));server.stderr.on('data',data=>process.stderr.write(data));
(async()=>{try{
 const deadline=Date.now()+240000;
 while(true){
  if(serverFailure)throw serverFailure;
  if(server.exitCode!==null||server.signalCode!==null)throw Error('host exited before readiness');
  try{const response=await fetch(base+'/__nova_generation/status',{signal:AbortSignal.timeout(1000)});if(response.ok)break}catch{}
  if(Date.now()>deadline)throw Error('host readiness timeout');
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 if(packageApp)console.log(JSON.stringify({packageOrigin:true,app:fs.realpathSync(packageApp),helper:executable,externalFallback:false}));
 const source=fs.readFileSync('tests/music-studio-ai-midi-candidate-import.test.js','utf8').split('\ntest(')[0],fixture=new Function('require',source+'\nreturn fixture;')(require),f=fixture();
 const measurements=[];
 f.w.location.hostname='127.0.0.1';f.w.File=File;f.w.atob=atob;f.w.fetch=async(url,options={})=>{
  const response=await fetch(base+url,{...options,headers:{...options.headers,...(options.method==='POST'?{Origin:base}:{})}});
  if(url.endsWith('/compose')&&response.ok)measurements.push((await response.clone().json()).performance);
  return response;
 };
 f.p.musicalSettings={...f.p.musicalSettings,key:'Dm',bpm:90};f.s.midiData.tempo=90;
 f.w.document={querySelector:selector=>({value:({'#aiModelStyle':'gentle','#aiModelRange':'57:77','#aiModelMood':'優しい','#aiModelGenre':'ballad','#aiModelChords':'Dm Gm A7 Dm'})[selector]||''}),querySelectorAll:()=>[]};
 await f.panel.generateLocalModel(f.p.projectId);
 const r=f.panel._states.get(f.p.projectId),set=r.state.workspace.candidateSets.at(-1);assert.ok(set,r.message);assert.equal(set.candidates.length,3);
 assert.ok(set.candidates.every(c=>c.value.synthetic===false&&c.value.importedMidi.notes.length>0));
 assert.ok(set.candidates.every(c=>c.value.importedMidi.notes.every(n=>n.pitch>=57&&n.pitch<=77&&([[2,5,9],[7,10,2],[9,1,4,7],[2,5,9]][Math.floor(n.startTick/1920)%4]).includes(n.pitch%12))));
 const candidate=set.candidates[0],bundle=f.P.createPreview(f.s,f.core,candidate,{project:f.p}),plan=f.P.auditionPlan(f.s,f.core,bundle,null);assert.ok(plan.tracks[0].notes.length>0);
 f.P.applyPreview(f.s,f.core,bundle,{startMeasure:2,endMeasure:2});assert.ok(f.core.currentTrack(f.s).notes.some(n=>n.id==='original'));
 const repo=f.a.memoryRepository();f.a.setRepository(repo);await repo.put(f.p);assert.equal((await f.a.saveMidiEditor({silent:true})).ok,true);
 const stored=await repo.get(f.p.projectId);assert.equal(stored.aiWorkspace.candidateSets.at(-1).candidates.length,3);
 // Actual source-conditioned ONNX remake, preserving original rhythm and other tracks.
 const m=fixture();m.w.location.hostname='127.0.0.1';m.w.File=File;m.w.atob=atob;m.w.fetch=f.w.fetch;
 m.s.midiData.tracks[0].notes.push({id:'source-phrase',pitch:67,startTick:1920,durationTicks:480,velocity:87});
 m.w.document={querySelector:s=>({value:({'#aiRemakeMode':'revise','#aiRemakeAmount':'100'})[s]||''}),querySelectorAll:()=>[]};
 const baseline=JSON.stringify(m.s.midiData);await m.panel.generateLocalModel(m.p.projectId);
 const mr=m.panel._states.get(m.p.projectId),ms=mr.state.workspace.candidateSets.at(-1);assert.ok(ms,mr.message);
 assert.ok(ms.candidates.every(c=>c.value.remake?.mode==='revise'&&c.value.synthetic===false));assert.equal(JSON.stringify(m.s.midiData),baseline);
 const layer=m.C.bindRemake(ms.candidates[0].value,m.C.remakeSource(m.s,m.core),'layer',100,'bass'),lb=m.P.createPreview(m.s,m.core,{candidateId:'A',value:layer},{project:m.p});assert.equal(lb.targetTrackId,'bass');assert.ok(lb.result.changes.adds.length>0);
 const mb=m.P.createPreview(m.s,m.core,ms.candidates[0],{project:m.p});assert.equal(mb.result.changes.updates[0].durationTicks,480);assert.equal(mb.result.changes.updates[0].velocity,87);
 m.P.auditionPlan(m.s,m.core,mb);m.P.applyPreview(m.s,m.core,mb);m.core.undo(m.s);assert.equal(JSON.stringify(m.s.midiData),baseline);m.core.redo(m.s);
 assert.equal(measurements.length,2);assert.equal(measurements[0].sessionReused,false);assert.equal(measurements[1].sessionReused,true);
 assert.ok(measurements.every(p=>p.onnxCalls.base>0&&p.onnxCalls.token>0&&p.midiBytes>0&&p.elapsedSeconds>=p.loadSeconds));
 console.log(JSON.stringify({realModelRuntimeMeasurements:measurements,requestStateReused:false}));
 console.log(JSON.stringify({realSourceConditionedRemake:true,candidates:ms.candidates.map(c=>c.value.importedMidi.notes.length),timingAndVelocityPreserved:true,undoRedo:true}));
 const scoreFixture=new Function('require',fs.readFileSync('tests/music-studio-score-vocal-return.test.js','utf8').split('\ntest(')[0]+'\nreturn scoreSetup;')(require),s=await scoreFixture();
 s.w.location.hostname='127.0.0.1';s.w.File=File;s.w.atob=atob;s.w.fetch=f.w.fetch;
 let rangeProject=s.a.makeProject({projectId:s.p.projectId,projectName:'Range generation',bpm:90,midiData:{ppq:480,tracks:[{id:'lead',part:'melody',notes:[{id:'a',pitch:60,startTick:0,durationTicks:480},{id:'b',pitch:62,startTick:1920,durationTicks:480},{id:'c',pitch:64,startTick:2400,durationTicks:480}]}]}});
 rangeProject=s.a.adoptLyricsAssignment(rangeProject,s.a.lyricsAssignmentPreview(rangeProject,{trackId:'lead',fromNote:1,toNote:3,text:'あい',reading:'ア イ ~'}));await s.repo.put(rangeProject);s.a.state.projects=[rangeProject];s.recordId=rangeProject.syllableAssignments[0].id;
 const sung=await s.a.generateLocalScoreVocal(s.p.projectId,s.recordId,{startMeasure:2,endMeasure:2});assert.equal(sung.ok,true,sung.error);
 const sourceInfo=sung.project.longWavAssets.find(a=>a.id===sung.assetId).vocalTake.scoreSource;assert.equal(sourceInfo.generationRange.startMeasure,2);assert.ok(!sourceInfo.scoreXML.includes('<text>あ</text>'));assert.ok(sourceInfo.scoreXML.includes('<text>い</text>'));
 const rendered=await s.a.vocalRender(s.p.projectId,sung.assetId);assert.ok(rendered.blob.size>44);
 const generatedAsset=s.a.state.projects[0].longWavAssets.find(a=>a.id===sung.assetId),frames=generatedAsset.sampleRate*180,channels=generatedAsset.channels;
 const header=await rendered.blob.slice(0,44).arrayBuffer(),view=new DataView(header);view.setUint32(4,36+frames*channels*2,true);view.setUint32(40,frames*channels*2,true);
 const longFile=Object.assign(new Blob([header,new Uint8Array(frames*channels*2)],{type:'audio/wav'}),{name:'long-original.wav'}),longBase=await s.a.importScoreVocal(longFile,s.p.projectId,s.recordId,'score-zero');assert.equal(longBase.ok,true,longBase.error);
 const replacement=await s.a.vocalReplacementApply(s.p.projectId,longBase.assetId,sung.assetId,{fadeMs:10});assert.equal(replacement.ok,true,replacement.error);
 const replaced=Buffer.from(await(await s.a.pcmLoadLongWav(s.p.projectId,replacement.assetId)).arrayBuffer()),dry=Buffer.from(await longFile.arrayBuffer()),first=Math.round(4*60/90*generatedAsset.sampleRate),last=Math.round(8*60/90*generatedAsset.sampleRate);
 assert.deepEqual(replaced.subarray(0,44+first*channels*2),dry.subarray(0,44+first*channels*2));assert.deepEqual(replaced.subarray(44+last*channels*2),dry.subarray(44+last*channels*2));assert.ok(replaced.subarray(44+first*channels*2,44+last*channels*2).some(x=>x!==0));
 const archive=await s.a.createLongWavArchive(),restored=await s.a.restoreLongWavArchive(archive,{settings:false});assert.equal(restored.ok,true,restored.error);
 const copy=restored.projects[0],again=await s.a.vocalRender(copy.projectId,copy.vocalWorkspace.selectedAssetId);
 assert.deepEqual(Buffer.from(await again.blob.arrayBuffer()),replaced);
 // Late-song inference must not synthesize the preceding 200 seconds of silence.
 let late=s.a.makeProject({projectId:s.p.projectId,projectName:'Late range',bpm:120,midiData:{ppq:480,tracks:[{id:'lead',part:'melody',notes:[{id:'late',pitch:60,startTick:192000,durationTicks:480}]}]}});
 late=s.a.adoptLyricsAssignment(late,s.a.lyricsAssignmentPreview(late,{trackId:'lead',fromNote:1,toNote:1,text:'あ',reading:'あ'}));await s.repo.put(late);s.a.state.projects=[late];
 const lateSung=await s.a.generateLocalScoreVocal(late.projectId,late.syllableAssignments[0].id,{startMeasure:101,endMeasure:101});assert.equal(lateSung.ok,true,lateSung.error);
 const lateRender=await s.a.vocalRender(late.projectId,lateSung.assetId);assert.equal(lateRender.startSeconds,200);assert.ok(lateRender.frames>0);assert.ok(lateRender.frames/lateSung.project.longWavAssets[0].sampleRate<120);
 const lateCopy=await s.a.restoreLongWavArchive(await s.a.createLongWavArchive(),{settings:false});assert.equal(lateCopy.ok,true,lateCopy.error);const lateAgain=await s.a.vocalRender(lateCopy.projects[0].projectId,lateCopy.projects[0].vocalWorkspace.selectedAssetId);assert.equal(lateAgain.startSeconds,200);assert.deepEqual(Buffer.from(await lateAgain.blob.arrayBuffer()),Buffer.from(await lateRender.blob.arrayBuffer()));
 console.log(JSON.stringify({lateRangeRealSinsy:true,measure:101,startSeconds:200,archiveByteEquality:true}));
 const forbidden=await fetch(base+'/__nova_generation/compose',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{}'});assert.equal(forbidden.status,403);
 console.log(JSON.stringify({realInference:true,longBaseSeconds:180,longReplacementOutsideBytesUnchanged:true,model:'skytnt/midi-model-tv2o-medium',candidateNotes:set.candidates.map(c=>c.value.importedMidi.notes.length),midiPartialApply:true,midiSaveReopen:true,singingEngine:'Sinsy 0.92 HMM',voice:'NIT SONG070 F001',wavBytes:rendered.blob.size,archiveByteEquality:true,selectedMeasures:[2,2],outsideLyricExcluded:true,normalizedKana:true,foreignOriginRejected:true},null,2));
}finally{server.kill('SIGTERM')}})().catch(e=>{console.error(e);process.exitCode=1});
