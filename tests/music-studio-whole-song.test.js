const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const prefix=fs.readFileSync('tests/music-studio-ai-midi-candidate-import.test.js','utf8').split('\ntest(')[0],fixture=new Function('require',prefix+'\nreturn fixture;')(require),plain=v=>JSON.parse(JSON.stringify(v));
function setup(){const f=fixture();f.s.midiData.tracks[0].notes=Array.from({length:4},(_,i)=>({id:'source'+i,pitch:60+i,startTick:i*1920,durationTicks:480,velocity:80}));const record=f.panel._states.get(f.p.projectId);record.state.workspace.sectionArrangements=[{range:f.core.measureRangeToTicks({startMeasure:1,endMeasure:2},f.s.midiData),name:'verse',density:'sparse',roles:['piano','bass','strings','drums'],targets:{}},{range:f.core.measureRangeToTicks({startMeasure:3,endMeasure:4},f.s.midiData),name:'chorus',density:'rich',roles:['piano','bass','strings','drums'],targets:{}}];return {...f,record};}
function make(f,index=0){const plan=f.C.wholeSongPlan(f.p,f.s,f.core,f.record.state.workspace),parts=plan.chunks.map(ch=>f.C.bindEnsemble(f.C.midiCandidate(f.data,f.file,{key:ch.key,range:ch.range},index,480),ch.source,'C',ch.section));return {candidateId:String.fromCharCode(65+index),value:f.C.wholeSongCandidate(plan,parts,index)};}
function mock(f,handler){f.w.location.hostname='127.0.0.1';f.w.atob=atob;f.a.localGenerationRequest=async(kind,payload)=>{await handler?.(payload);return{model:'skytnt/midi-model-tv2o-medium',revision:'test-only',synthetic:false,sourceConditioning:payload.sourceNotes?{method:'source-prefix-then-rebase-continuation',notes:payload.sourceNotes.length}:undefined,candidates:['A','B','C'].map((variant,i)=>({variant,seed:72+i,midiBase64:Buffer.from(f.data).toString('base64')}))};};}
test('full-song preview/listen/partial instrument adoption preserves source and other bars; single undo/redo exact',()=>{const f=setup(),before=plain(f.s.midiData),c=make(f),b=f.P.createPreview(f.s,f.core,c);f.P.auditionPlan(f.s,f.core,b);assert.deepEqual(plain(f.s.midiData),before);f.P.applyPreview(f.s,f.core,b,{startMeasure:2,endMeasure:3,roles:['bass']});assert.equal(f.s.midiData.tracks.length,4);assert.deepEqual(plain(f.s.midiData.tracks.slice(0,3)),before.tracks);const generated=f.s.midiData.tracks.at(-1);assert.ok(generated.notes.every(n=>n.startTick>=1920&&n.startTick+n.durationTicks<=5760));assert.ok(generated.notes.some(n=>n.startTick>=3840));const after=plain(f.s.midiData);f.core.undo(f.s);assert.deepEqual(plain(f.s.midiData),before);f.core.redo(f.s);assert.deepEqual(plain(f.s.midiData),after);assert.throws(()=>f.P.applyPreview(f.s,f.core,b),/stale-whole-song/);});
test('full song reuses one destination per instrument, no duplicate note IDs or metadata changes',()=>{const f=setup(),before=plain(f.s.midiData),b=f.P.createPreview(f.s,f.core,make(f));f.P.applyPreview(f.s,f.core,b);assert.equal(f.s.midiData.tracks.length,7);assert.deepEqual(plain(f.s.midiData.tracks.slice(0,3)),before.tracks);const ids=f.s.midiData.tracks.flatMap(t=>t.notes.map(n=>n.id));assert.equal(ids.length,new Set(ids).size);assert.deepEqual(plain(f.s.midiData.tempoMap),before.tempoMap);const bass=f.s.midiData.tracks.find(t=>t.id.startsWith('arrange-bass'));assert.ok(bass.notes.filter(n=>n.startTick>=3840).length>bass.notes.filter(n=>n.startTick<3840).length);});
test('missing/overlapping/outdated sections and malformed excluded bars fail without mutation',()=>{for(const change of [f=>f.record.state.workspace.sectionArrangements.pop(),f=>f.record.state.workspace.sectionArrangements[1].range.startMeasure=2,f=>f.record.state.workspace.sectionArrangements[0].range.endTick++]){const f=setup();change(f);const before=plain(f.s);assert.throws(()=>f.C.wholeSongPlan(f.p,f.s,f.core,f.record.state.workspace));assert.deepEqual(plain(f.s),before);}const f=setup(),c=make(f);c.value.ensemble.wholeSong.parts[3].importedMidi.notes[0].pitch=128;const before=plain(f.s);assert.throws(()=>f.P.createPreview(f.s,f.core,c));assert.deepEqual(plain(f.s),before);});
test('sequential request publishes A/B/C only after all bars, with real-input ranges and source intact',async()=>{const f=setup(),requests=[],before=plain(f.s.midiData);mock(f,p=>requests.push(p));await f.panel.generateWholeSong(f.p.projectId,false,false);const set=f.record.state.workspace.candidateSets.at(-1);assert.ok(set,f.record.message);assert.equal(set.candidates.length,3);assert.equal(requests.length,4);assert.equal(requests[0].style,'gentle');assert.equal(requests[3].style,'varied');assert.equal(set.candidates[0].value.ensemble.wholeSong.parts.length,4);assert.deepEqual(plain(f.s.midiData),before);assert.equal(f.record.localModelBusy,false);});
test('stop, failure, source changes and workspace changes discard every pending full song result',async()=>{for(const action of ['stop','fail','midi','workspace']){const f=setup(),before=plain(f.record.state.workspace.candidateSets);let count=0;mock(f,()=>{if(++count===2){if(action==='stop')f.panel.stopWholeSong(f.p.projectId);if(action==='fail')throw Error('test failure');if(action==='midi')f.s.midiData.tempo++;if(action==='workspace')f.record.state.workspace.history.push({kind:'changed'});}});await f.panel.generateWholeSong(f.p.projectId,false,false);assert.deepEqual(plain(f.record.state.workspace.candidateSets),before);assert.equal(f.record.localModelBusy,false);}});
test('rest bars use no prefix; held source notes are clipped only in prompt, original remains intact',()=>{const f=setup();f.s.midiData.tracks[0].notes=[{id:'held',pitch:64,startTick:1800,durationTicks:2400,velocity:80}];const plan=f.C.wholeSongPlan(f.p,f.s,f.core,f.record.state.workspace);assert.equal(plan.chunks[0].source.notes[0].durationTicks,120);assert.equal(plan.chunks[1].source.notes[0].durationTicks,1920);assert.equal(plan.chunks[3].modelInputNotes,0);assert.equal(f.s.midiData.tracks[0].notes[0].durationTicks,2400);});
test('Japanese finite commands preview before workspace adoption, reject entire unsupported input, undo exact',()=>{const f=setup(),before=plain(f.record.state.workspace),midi=plain(f.s.midiData);f.w.document={querySelector:()=>({value:'Aメロは静かに。サビを豪華に。元のメロディーは変更しない。'}),querySelectorAll:()=>[]};f.panel.previewJapaneseArrangement(f.p.projectId);assert.ok(f.record.japanesePlan);assert.deepEqual(plain(f.record.state.workspace),before);f.panel.applyJapaneseArrangement(f.p.projectId);assert.equal(f.record.state.workspace.sectionArrangements[1].density,'rich');f.core.undo(f.s);assert.deepEqual(plain(f.record.state.workspace),before);assert.deepEqual(plain(f.s.midiData),midi);for(const instruction of ['いい感じに','サビを豪華に。あと全部よろしく','ベースだけ作り直す','サビのベースだけ作り直す'])assert.throws(()=>f.C.japaneseArrangement(instruction,before));});
test('full song candidates and section settings survive save/reopen/full backup, then adopt',async()=>{const f=setup();mock(f);await f.panel.generateWholeSong(f.p.projectId,false,false);const repo=f.a.memoryRepository();f.a.setRepository(repo);await repo.put(f.p);assert.equal((await f.a.saveMidiEditor({silent:true})).ok,true);const stored=await repo.get(f.p.projectId),g=fixture(),rr=g.a.memoryRepository();g.a.setRepository(rr);assert.equal((await g.a.restoreBackup(f.a.backupObject(),{settings:false,projects:true})).ok,true);const restored=await rr.get(f.p.projectId);assert.deepEqual(plain(restored.aiWorkspace),plain(stored.aiWorkspace));const session=g.core.createCoordinatedSession(restored),c=restored.aiWorkspace.candidateSets.at(-1).candidates[0];g.P.applyPreview(session,g.core,g.P.createPreview(session,g.core,c));assert.equal(session.midiData.tracks.length,7);});
test('bar plan follows immediate partial-bar meter boundaries and tempo/key events; refuses intra-bar key guessing',()=>{const f=setup();f.s.midiData.timeSignatureMap=[{tick:0,numerator:4,denominator:4},{tick:2880,numerator:3,denominator:4}];f.s.midiData.tempoMap=[{tick:0,bpm:72},{tick:2880,bpm:110}];f.s.midiData.keySignatureMap=[{tick:0,sharps:0,minor:false},{tick:2880,sharps:1,minor:false}];for(const section of f.record.state.workspace.sectionArrangements)section.range=f.core.measureRangeToTicks(section.range,f.s.midiData);const before=plain(f.s.midiData),plan=f.C.wholeSongPlan(f.p,f.s,f.core,f.record.state.workspace);assert.equal(plan.chunks[1].range.endTick,2880);assert.equal(plan.chunks[2].range.startTick,2880);assert.equal(plan.chunks[2].key,'G');assert.equal(plan.chunks[2].bpm,110);assert.equal(plan.chunks[2].numerator,3);assert.deepEqual(plain(f.s.midiData),before);f.s.midiData.keySignatureMap.push({tick:3000,sharps:2,minor:false});assert.throws(()=>f.C.wholeSongPlan(f.p,f.s,f.core,f.record.state.workspace),/小節途中/);});
test('whole song replacing explicit bass keeps locked and crossing notes exactly',()=>{const f=setup();const bass=f.core.getTrackById(f.s.midiData.tracks,'bass');bass.notes=[{id:'protected-bass',pitch:40,startTick:1920,durationTicks:240,velocity:90,locked:true},{id:'cross-bass',pitch:43,startTick:3700,durationTicks:400,velocity:80}];for(const section of f.record.state.workspace.sectionArrangements){section.roles=['bass'];section.targets={bass:'bass'};}const before=plain(f.s.midiData),b=f.P.createPreview(f.s,f.core,make(f));f.P.applyPreview(f.s,f.core,b);assert.equal(f.s.midiData.tracks.length,3);for(const note of before.tracks[1].notes)assert.deepEqual(plain(f.s.midiData.tracks[1].notes.find(n=>n.id===note.id)),note);assert.deepEqual(plain(f.s.midiData.tracks[0]),before.tracks[0]);});
test('low melody cannot remove all valid voicing choices for accidental chords',()=>{const f=setup();for(const n of f.s.midiData.tracks[0].notes)n.pitch=59;const c=make(f);for(const part of c.value.ensemble.wholeSong.parts)part.ensemble.chords='Ebm';assert.doesNotThrow(()=>f.P.createPreview(f.s,f.core,c));});
test('chord-conditioned A/B/C keep distinct explicit piano rule performances',()=>{const f=setup(),rendered=[];for(let index=0;index<3;index++){const c=make(f,index),b=f.P.createPreview(f.s,f.core,c),plan=f.P.auditionPlan(f.s,f.core,b,{startMeasure:1,endMeasure:2,roles:['piano']});rendered.push(JSON.stringify(plan.tracks.find(t=>t.id.startsWith('arrange-piano')).notes.map(n=>[n.pitch,n.startTick,n.durationTicks])));}assert.equal(new Set(rendered).size,3);});

test('pause retains complete bars; resume skips them and publishes no partial candidates',async()=>{
 const f=setup(),before=plain(f.s.midiData);let calls=0;
 mock(f,()=>{if(++calls===2)f.panel.stopWholeSong(f.p.projectId)});
 await f.panel.generateWholeSong(f.p.projectId,false,false);
 assert.equal(f.record.state.workspace.wholeSongCheckpoint.results.length,1);
 assert.equal(f.record.state.workspace.candidateSets.length,0);
 f.panel.setTab(f.p.projectId,'candidates');assert.match(f.panel.render(f.p,f.s,f.core),/Resume（続きから再開）/);
 calls=0;mock(f,()=>calls++);await f.panel.generateWholeSong(f.p.projectId,true,false);
 assert.equal(calls,3);assert.equal(f.record.state.workspace.candidateSets.at(-1).candidates.length,3);
 assert.equal(f.record.state.workspace.wholeSongCheckpoint,undefined);assert.deepEqual(plain(f.s.midiData),before);
});
test('failed bar is retried; malformed restored results and changed conditions issue no requests',async()=>{
 for(const change of ['midi','section','track','music','revision','bytes']){
  const f=setup();let calls=0;mock(f,()=>{if(++calls===2)throw Error('connection-lost')});await f.panel.generateWholeSong(f.p.projectId,false,false);
  assert.equal(f.record.state.workspace.wholeSongCheckpoint.results.length,1);
  if(change==='midi')f.s.midiData.tracks[0].notes[0].velocity++;
  if(change==='section')f.record.state.workspace.sectionArrangements[0].density='rich';
  if(change==='track')f.core.selectTrackById(f.s,'bass');
  if(change==='music')f.p.musicalSettings.key='D';
  if(change==='revision')f.record.state.workspace.wholeSongCheckpoint.revision='other-model';
  if(change==='bytes')f.record.state.workspace.wholeSongCheckpoint.results[0].candidates[0].midiBase64='AAAA';
  calls=0;mock(f,()=>calls++);const before=plain(f.record.state.workspace.candidateSets);
  await f.panel.generateWholeSong(f.p.projectId,true,false);assert.equal(calls,0,change);assert.deepEqual(plain(f.record.state.workspace.candidateSets),before);
 }
});
test('checkpoint saves, reopens and restores through full backup before successful resume/adoption',async()=>{
 const f=setup(),repo=f.a.memoryRepository();f.a.setRepository(repo);await repo.put(f.p);
 let calls=0;mock(f,()=>{if(++calls===3)throw Error('offline')});await f.panel.generateWholeSong(f.p.projectId,false,false);
 await f.panel.saveWholeSongCheckpoint(f.p.projectId);assert.match(f.record.message,/Checkpoint saved/);
 const stored=await repo.get(f.p.projectId);assert.equal(stored.aiWorkspace.wholeSongCheckpoint.results.length,2);
 const g=setup(),rr=g.a.memoryRepository();g.a.setRepository(rr);
 assert.equal((await g.a.restoreBackup(f.a.backupObject(),{settings:false,projects:true})).ok,true);
 const restored=await rr.get(f.p.projectId);g.a.state.projects=[restored];g.a.state.midiEditor=g.core.createCoordinatedSession(restored);g.panel.render(restored,g.a.state.midiEditor,g.core);
 let resumed=0;mock(g,()=>resumed++);await g.panel.generateWholeSong(restored.projectId,true,false);
 const record=g.panel._states.get(restored.projectId);assert.equal(resumed,2,record.message);
 const candidate=record.state.workspace.candidateSets.at(-1).candidates[0];const before=plain(g.a.state.midiEditor.midiData);
 g.P.applyPreview(g.a.state.midiEditor,g.core,g.P.createPreview(g.a.state.midiEditor,g.core,candidate),{startMeasure:3,endMeasure:4,roles:['bass']});
 const after=plain(g.a.state.midiEditor.midiData);g.core.undo(g.a.state.midiEditor);assert.deepEqual(plain(g.a.state.midiEditor.midiData),before);g.core.redo(g.a.state.midiEditor);assert.deepEqual(plain(g.a.state.midiEditor.midiData),after);
});
test('new generation does not overwrite a paused job; explicit discard keeps source and candidates',async()=>{
 const f=setup();let calls=0;mock(f,()=>{if(++calls===2)throw Error('offline')});await f.panel.generateWholeSong(f.p.projectId,false,false);
 const checkpoint=plain(f.record.state.workspace.wholeSongCheckpoint),before=plain(f.s.midiData);
 calls=0;mock(f,()=>calls++);await f.panel.generateWholeSong(f.p.projectId,false,false);assert.equal(calls,0);assert.deepEqual(plain(f.record.state.workspace.wholeSongCheckpoint),checkpoint);
 f.panel.clearWholeSongCheckpoint(f.p.projectId);assert.equal(f.record.state.workspace.wholeSongCheckpoint,undefined);assert.deepEqual(plain(f.s.midiData),before);
});

test('automatic bar checkpoint save survives failure and resumes without redoing saved inference',async()=>{
 const f=setup(),repo=f.a.memoryRepository();f.a.setRepository(repo);await repo.put(f.p);let count=0;
 mock(f,()=>{if(++count===2)throw Error('disconnect')});await f.panel.generateWholeSong(f.p.projectId,false,true);
 const saved=await repo.get(f.p.projectId);assert.equal(saved.aiWorkspace.wholeSongCheckpoint.results.length,1);assert.equal(f.record.pending,false);
 let resumed=0;mock(f,()=>resumed++);await f.panel.generateWholeSong(f.p.projectId,true,true);
 assert.equal(resumed,3,f.record.message);assert.equal(f.record.state.workspace.candidateSets.at(-1).candidates.length,3);
 assert.equal((await repo.get(f.p.projectId)).aiWorkspace.wholeSongCheckpoint,undefined);assert.equal((await repo.get(f.p.projectId)).aiWorkspace.candidateSets.at(-1).candidates.length,3);
 assert.equal((await f.a.saveMidiEditor({silent:true})).ok,true);assert.equal((await repo.get(f.p.projectId)).aiWorkspace.wholeSongCheckpoint,undefined);
});
test('automatic save failure stops before the next model request and retains completed checkpoint for retry',async()=>{
 const f=setup(),repo=f.a.memoryRepository();f.a.setRepository(repo);await repo.put(f.p);let calls=0;
 f.a.saveMidiEditor=async()=>({ok:false,error:Error('quota')});mock(f,()=>calls++);await f.panel.generateWholeSong(f.p.projectId,false,true);
 assert.equal(calls,1);assert.equal(f.record.state.workspace.wholeSongCheckpoint.results.length,1);assert.equal(f.record.pending,true);assert.equal(f.record.state.workspace.candidateSets.length,0);assert.match(f.record.message,/checkpoint-save-failed/);
});
test('pause during an automatic save retains its durable bar and rejects later completion',async()=>{
 const f=setup(),repo=f.a.memoryRepository();f.a.setRepository(repo);await repo.put(f.p);const originalSave=f.a.saveMidiEditor;
 let entered,release;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);let calls=0;
 f.a.saveMidiEditor=async options=>{entered();await gate;return originalSave(options)};mock(f,()=>calls++);
 const pending=f.panel.generateWholeSong(f.p.projectId,false,true);await ready;f.panel.stopWholeSong(f.p.projectId);release();await pending;
 assert.equal(f.record.localModelBusy,false);assert.equal(f.record.state.workspace.candidateSets.length,0);assert.equal((await repo.get(f.p.projectId)).aiWorkspace.wholeSongCheckpoint.results.length,1);
 f.a.saveMidiEditor=originalSave;calls=0;mock(f,()=>calls++);await f.panel.generateWholeSong(f.p.projectId,true,true);assert.equal(calls,3,f.record.message);
});
test('failed completed-candidate save preserves full durable checkpoint and in-memory A/B/C',async()=>{
 const f=setup(),repo=f.a.memoryRepository();f.a.setRepository(repo);await repo.put(f.p);const originalSave=f.a.saveMidiEditor;let saves=0;
 f.a.saveMidiEditor=options=>++saves===5?Promise.resolve({ok:false,error:Error('quota')}):originalSave(options);mock(f);await f.panel.generateWholeSong(f.p.projectId,false,true);
 assert.equal(f.record.state.workspace.candidateSets.at(-1).candidates.length,3);assert.equal(f.record.pending,true);assert.equal((await repo.get(f.p.projectId)).aiWorkspace.wholeSongCheckpoint.results.length,4);assert.match(f.record.message,/保存に失敗/);
});

test('whole-song runtime measurements survive candidate save and full backup reopen',async()=>{
 const f=setup(),repo=f.a.memoryRepository();f.a.setRepository(repo);await repo.put(f.p);mock(f);
 const request=f.a.localGenerationRequest;
 const performance={elapsedSeconds:1.25,loadSeconds:0.2,sessionReused:true,onnxCalls:{base:12,token:85},memoryAfter:{processPeakRssBytes:123456,peakScope:'host-process-lifetime'}};
 f.a.localGenerationRequest=async(...args)=>({...await request(...args),performance});
 await f.panel.generateWholeSong(f.p.projectId,false,true);
 const g=setup(),rr=g.a.memoryRepository();g.a.setRepository(rr);assert.equal((await g.a.restoreBackup(f.a.backupObject(),{settings:false,projects:true})).ok,true);
 const restored=await rr.get(f.p.projectId),candidate=restored.aiWorkspace.candidateSets.at(-1).candidates[0];
 assert.deepEqual(plain(candidate.value.ensemble.wholeSong.parts.map(p=>p.modelGeneration.performance)),Array.from({length:4},()=>performance));
 assert.match(f.C.detailLines(candidate.value).join('\n'),/A\/B\/C total.*1\.25s.*12\+85 calls/);
});
test('pause during final whole-song preview validation retains all bars and resumes without inference',async()=>{
 const f=setup();mock(f);const timer=f.w.setTimeout;let paused=false;
 f.w.setTimeout=(callback,delay)=>{if(!paused&&f.record.message.startsWith('Finalizing')){paused=true;f.panel.stopWholeSong(f.p.projectId)}return timer(callback,delay)};
 await f.panel.generateWholeSong(f.p.projectId,false,false);
 assert.equal(f.record.state.workspace.wholeSongCheckpoint.results.length,4);assert.equal(f.record.state.workspace.candidateSets.length,0);assert.equal(f.record.localModelBusy,false);
 f.w.setTimeout=timer;let calls=0;mock(f,()=>calls++);await f.panel.generateWholeSong(f.p.projectId,true,false);
 assert.equal(calls,0);assert.equal(f.record.state.workspace.candidateSets.at(-1).candidates.length,3);
});

test('Pause during restored checkpoint validation yields before inference and preserves every saved bar',async()=>{
 const f=setup();mock(f);const timer=f.w.setTimeout;let paused=false;
 f.w.setTimeout=(callback,delay)=>{if(!paused&&f.record.message.startsWith('Finalizing')){paused=true;f.panel.stopWholeSong(f.p.projectId)}return timer(callback,delay)};
 await f.panel.generateWholeSong(f.p.projectId,false,false);
 const checkpoint=plain(f.record.state.workspace.wholeSongCheckpoint),original=plain(f.s.midiData);assert.equal(checkpoint.results.length,4);
 let calls=0;mock(f,()=>calls++);f.w.setTimeout=(callback,delay)=>{if(f.record.message.startsWith('Restoring'))f.panel.stopWholeSong(f.p.projectId);return timer(callback,delay)};
 await f.panel.generateWholeSong(f.p.projectId,true,false);
 assert.equal(calls,0);assert.deepEqual(plain(f.record.state.workspace.wholeSongCheckpoint),checkpoint);assert.deepEqual(plain(f.s.midiData),original);assert.equal(f.record.state.workspace.candidateSets.length,0);assert.equal(f.record.localModelBusy,false);
 f.w.setTimeout=timer;await f.panel.generateWholeSong(f.p.projectId,true,false);assert.equal(calls,0);assert.equal(f.record.state.workspace.candidateSets.at(-1).candidates.length,3);
});
