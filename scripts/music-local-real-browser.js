const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
const base='http://127.0.0.1:8768',packageApp=process.env.NOVA_PACKAGE_APP;
const host=spawn(packageApp?path.join(fs.realpathSync(packageApp),'Contents/Helpers/MusicStudioEngine'):(process.env.PYTHON||'python'),packageApp?['--port','8768']:['tools/music-local-generation/serve.py','--port','8768','--weights',process.env.NOVA_MODEL_WEIGHTS,'--sinsy',process.env.NOVA_SINSY,'--dictionary',process.env.NOVA_SINSY_DICTIONARY,'--voice',process.env.NOVA_SINSY_VOICE],{stdio:['ignore','pipe','pipe']});
let hostFailure;host.once('error',error=>{hostFailure=error});host.stdout.on('data',data=>process.stdout.write(data));host.stderr.on('data',data=>process.stderr.write(data));
(async()=>{let browser;try{const deadline=Date.now()+240000;while(true){if(hostFailure)throw hostFailure;if(host.exitCode!==null||host.signalCode!==null)throw Error('host exited before readiness');try{if((await fetch(base+'/__nova_generation/status',{signal:AbortSignal.timeout(1000)})).ok)break}catch{}if(Date.now()>deadline)throw Error('host readiness timeout');await new Promise(resolve=>setTimeout(resolve,200));}browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});const report=[];
for(const width of [1440,820,390,1180]){const page=await browser.newPage({viewport:{width,height:820}}),messages=[],external=[];page.on('console',m=>{if(['error','warning'].includes(m.type()))messages.push(m.text())});page.on('pageerror',e=>messages.push(e.message));await page.route('**/*',r=>{if(r.request().url().startsWith(base+'/')||/^(blob:|data:)/.test(r.request().url()))return r.continue();external.push(r.request().url());return r.abort()});await page.goto(base+'/music-studio.html');await page.waitForFunction(()=>MusicStudio.state.loaded);
const result=await page.evaluate(async()=>{const a=MusicStudio,core=MusicStudioEditor,repo=a.indexedDbRepository();a.setRepository(repo);const p=a.makeProject({projectId:'real-model-browser',projectName:'Real model',key:'Dm',bpm:90,midiData:{ppq:480,tempo:90,timeSignature:{numerator:4,denominator:4},editor:{measureCount:4,editRange:{startMeasure:1,endMeasure:4}},tracks:[{id:'melody',part:'melody',notes:[{id:'original',pitch:60,startTick:480,durationTicks:480,velocity:80}]},{id:'bass',part:'bass',notes:[]},{id:'drums',part:'drums',notes:[]}]}});await repo.put(p);a.state.projects=[p];a.openMidiEditor(p.projectId);await new Promise((resolve,reject)=>{const start=Date.now();function poll(){if(a.state.midiEditor?.projectId===p.projectId)return resolve();if(Date.now()-start>10000)return reject(Error('MIDI route not ready'));setTimeout(poll,20)}poll()});MusicStudioAIAssistantPanel.setTab(p.projectId,'candidates');document.querySelector('#aiRemakeMode').value='revise';document.querySelector('#aiRemakeAmount').value='100';document.querySelector('#aiModelStyle').value='gentle';document.querySelector('#aiModelRange').value='57:77';document.querySelector('#aiModelMood').value='優しい';document.querySelector('#aiModelGenre').value='ballad';const harmonyBefore=JSON.stringify(a.state.midiEditor.midiData);MusicStudioAIAssistantPanel.analyzeHarmony(p.projectId);const harmonicReview=MusicStudioAIAssistantPanel._states.get(p.projectId).harmonyAnalysis;if(!harmonicReview||harmonicReview.rows.length!==4||harmonicReview.rows.some(row=>row.symbol!==null))throw Error('ambiguous melody was confirmed');['Dm','Gm','A7','Dm'].forEach((symbol,i)=>document.querySelector('#aiHarmony'+i).value=symbol);MusicStudioAIAssistantPanel.useHarmony(p.projectId);MusicStudioAIAssistantPanel.confirmApprovedChange(p.projectId);if(document.querySelector('#aiModelChords').value!=='Dm Gm A7 Dm'||JSON.stringify(a.state.midiEditor.midiData)!==harmonyBefore)throw Error('harmonic confirmation mismatch');document.querySelector('#aiRemakeMode').value='revise';document.querySelector('#aiRemakeAmount').value='100';document.querySelector('#aiModelStyle').value='gentle';document.querySelector('#aiModelRange').value='57:77';document.querySelector('#aiModelMood').value='優しい';document.querySelector('#aiModelGenre').value='ballad';await MusicStudioAIAssistantPanel.generateLocalModel(p.projectId);const r=MusicStudioAIAssistantPanel._states.get(p.projectId),set=r.state.workspace.candidateSets.at(-1);if(!set||set.candidates.length!==3)throw Error(r.message);if(!set.candidates.every(c=>c.value.importedMidi.notes.every(n=>n.pitch>=57&&n.pitch<=77&&([[2,5,9],[7,10,2],[9,1,4,7],[2,5,9]][Math.floor(n.startTick/1920)%4]).includes(n.pitch%12))))throw Error('key/range mismatch');if(!set.candidates.every(c=>c.value.remake?.mode==='revise'))throw Error('missing source binding');const original=JSON.stringify(a.state.midiEditor.midiData);const bridge=MusicStudioAICandidatePreview,bundle=bridge.createPreview(a.state.midiEditor,core,set.candidates[0],{project:p});const audition=bridge.auditionPlan(a.state.midiEditor,core,bundle);const heard=await a.editorAuditionCandidate(audition);if(!heard.ok)throw Error('remake audition failed');a.editorStopCandidateAudition();bridge.applyPreview(a.state.midiEditor,core,bundle,{startMeasure:1,endMeasure:1});core.undo(a.state.midiEditor);if(JSON.stringify(a.state.midiEditor.midiData)!==original)throw Error('remake undo mismatch');core.redo(a.state.midiEditor);const baseline=JSON.stringify(a.state.midiEditor.midiData),instrument=MusicStudioAIComposition.remakeNewTrack(a.state.midiEditor,'strings'),layerValue=MusicStudioAIComposition.bindRemake(set.candidates[1].value,MusicStudioAIComposition.remakeSource(a.state.midiEditor,core),'layer',100,instrument.id,instrument),layer=bridge.createPreview(a.state.midiEditor,core,{candidateId:'B',value:layerValue},{project:p});if(JSON.stringify(a.state.midiEditor.midiData)!==baseline)throw Error('track created before adoption');const layered=await a.editorAuditionCandidate(bridge.auditionPlan(a.state.midiEditor,core,layer,{startMeasure:1,endMeasure:2}));if(!layered.ok)throw Error('new instrument audition failed');a.editorStopCandidateAudition();bridge.applyPreview(a.state.midiEditor,core,layer,{startMeasure:1,endMeasure:2});const added=a.state.midiEditor.midiData.tracks.at(-1);if(added.id!==instrument.id||!added.notes.length||added.program!==48||JSON.stringify(a.state.midiEditor.midiData.tracks.slice(0,-1))!==JSON.stringify(JSON.parse(baseline).tracks))throw Error('new instrument adoption mismatch');core.undo(a.state.midiEditor);if(JSON.stringify(a.state.midiEditor.midiData)!==baseline)throw Error('new instrument undo mismatch');core.redo(a.state.midiEditor);core.selectTrackById(a.state.midiEditor,'melody');const ensembleBaseline=JSON.stringify(a.state.midiEditor.midiData),ensembleValue=MusicStudioAIComposition.bindEnsemble(set.candidates[2].value,MusicStudioAIComposition.remakeSource(a.state.midiEditor,core),'Dm Gm A7 Dm'),ensemble=bridge.createPreview(a.state.midiEditor,core,{candidateId:'C',value:ensembleValue},{project:p});const ensembleHeard=await a.editorAuditionCandidate(bridge.auditionPlan(a.state.midiEditor,core,ensemble,{startMeasure:1,endMeasure:2}));if(!ensembleHeard.ok)throw Error('ensemble audition');a.editorStopCandidateAudition();bridge.applyPreview(a.state.midiEditor,core,ensemble,{startMeasure:1,endMeasure:2});const ensembleAdded=a.state.midiEditor.midiData.tracks.slice(JSON.parse(ensembleBaseline).tracks.length);if(ensembleAdded.length!==4||!ensembleAdded.every(t=>t.notes.length)||ensembleAdded.at(-1).channel!==10||JSON.stringify(a.state.midiEditor.midiData.tracks.slice(0,-4))!==JSON.stringify(JSON.parse(ensembleBaseline).tracks))throw Error('ensemble adoption mismatch');for(const t of ensembleAdded.filter(t=>t.roleAssignment!=='drums'))for(const n of t.notes){const pcs=n.startTick<1920?[2,5,9]:[7,10,2];if(!pcs.includes(n.pitch%12)||(t.roleAssignment==='bass'&&n.pitch%12!==(n.startTick<1920?2:7)))throw Error('chord ensemble mismatch');}core.undo(a.state.midiEditor);if(JSON.stringify(a.state.midiEditor.midiData)!==ensembleBaseline)throw Error('ensemble undo');core.redo(a.state.midiEditor);const sectionBefore=JSON.stringify(a.state.midiEditor.midiData);MusicStudioAIAssistantPanel.setTab(p.projectId,'candidates');document.querySelector('#aiSectionName').value='chorus';document.querySelector('#aiSectionDensity').value='rich';for(const role of ['piano','bass','strings','drums'])document.querySelector('#aiSection'+role).checked=role==='strings';document.querySelector('#aiSectionTargetstrings').value=instrument.id;MusicStudioAIAssistantPanel.saveSectionArrangement(p.projectId);MusicStudioAIAssistantPanel.confirmApprovedChange(p.projectId);const sectionSetting=r.state.workspace.sectionArrangements?.at(-1);if(sectionSetting?.targets.strings!==instrument.id)throw Error('section settings missing');const replacementValue=MusicStudioAIComposition.bindEnsemble(set.candidates[2].value,MusicStudioAIComposition.remakeSource(a.state.midiEditor,core),'Dm Gm A7 Dm',sectionSetting),replacement=bridge.createPreview(a.state.midiEditor,core,{candidateId:'C',value:replacementValue},{project:p});if(!(await a.editorAuditionCandidate(bridge.auditionPlan(a.state.midiEditor,core,replacement,{startMeasure:1,endMeasure:2}))).ok)throw Error('section replacement audition');a.editorStopCandidateAudition();bridge.applyPreview(a.state.midiEditor,core,replacement,{startMeasure:1,endMeasure:2});if(a.state.midiEditor.midiData.tracks.length!==JSON.parse(sectionBefore).tracks.length)throw Error('replacement added tracks');for(const track of JSON.parse(sectionBefore).tracks)if(track.id!==instrument.id&&JSON.stringify(core.getTrackById(a.state.midiEditor.midiData.tracks,track.id))!==JSON.stringify(track))throw Error('replacement touched another track');const replaced=JSON.stringify(a.state.midiEditor.midiData);core.undo(a.state.midiEditor);if(JSON.stringify(a.state.midiEditor.midiData)!==sectionBefore)throw Error('replacement undo');core.redo(a.state.midiEditor);if(JSON.stringify(a.state.midiEditor.midiData)!==replaced)throw Error('replacement redo');const saved=await a.saveMidiEditor({silent:true});if(!saved.ok)throw Error('MIDI save');a.openWorkAction('export',p.projectId);await new Promise(resolve=>setTimeout(resolve,100));const audio=await a.midiRenderForMix(p.projectId);if(!audio.ok)throw Error(audio.error);const asset=audio.project.longWavAssets.find(x=>x.id===audio.assetId),sourceBytes=new Uint8Array(await(await a.pcmLoadLongWav(p.projectId,asset.id)).arrayBuffer()),midi=JSON.stringify(audio.project.midiData);const output=await a.finalPreview(p.projectId,{format:'nova-final-export-plan-v1',routes:[{key:'wav:'+asset.id,role:'instrument',startSeconds:0,gainDb:0,muted:false}],targetLufs:-18,ceilingDb:-1,includeMidi:true});if(!output.ok)throw Error(output.error);if(!(await a.finalSave(p.projectId)).ok)throw Error('remake final save');const recovered=await a.restoreLongWavArchive(await a.createLongWavArchive());if(!recovered.ok)throw Error(recovered.error);const copy=recovered.projects.find(x=>x.projectId!==p.projectId),bytes=new Uint8Array(await(await a.pcmLoadLongWav(copy.projectId,copy.longWavAssets[0].id)).arrayBuffer());if(copy.aiWorkspace.harmonyReview.chords!=='Dm Gm A7 Dm'||copy.aiWorkspace.sectionArrangements.at(-1).targets.strings!==instrument.id)throw Error('harmony/section archive metadata');if(JSON.stringify(copy.midiData)!==midi||bytes.length!==sourceBytes.length||!bytes.every((v,i)=>v===sourceBytes[i]))throw Error('remake export recovery mismatch');return{notes:set.candidates.map(c=>c.value.importedMidi.notes.length),remakeRendered:true,sectionReplacement:true,harmonyPersisted:true,ensembleTracks:ensembleAdded.map(t=>({role:t.roleAssignment,notes:t.notes.length})),newInstrumentTrack:true,newInstrumentNotes:added.notes.length,finalFiles:output.candidate.files.map(f=>f.name),archiveAudioBytesEqual:true}});assert.ok(result.notes.every(n=>n>0));
if(width===1180){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nova-seconds-'));
 let context,requests=0;
 async function openSecondsProject(){
   context=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width,height:820},...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
   const target=context.pages()[0];
   await target.route('**/*',r=>{
     const url=r.request().url();
     if(url===base+'/__nova_generation/compose')requests++;
     if(url.startsWith(base+'/')||/^(blob:|data:)/.test(url))return r.continue();
     external.push(url);return r.abort();
   });
   await target.goto(base+'/music-studio.html');
   await target.waitForFunction(()=>MusicStudio.state.loaded);
   return target;
 }
 try{
 const exactPage=await openSecondsProject();
 const locked=await exactPage.evaluate(async()=>{
   const a=MusicStudio,core=MusicStudioEditor,panel=MusicStudioAIAssistantPanel,id='seconds-lock';
   const p=a.makeProject({projectId:id,projectName:'Empty locked range',midiData:{ppq:480,tempo:120,tracks:[{id:'melody',part:'melody',notes:[]}]}});
   await a.indexedDbRepository().put(p);
   a.state.projects=[p];a.openMidiEditor(id);
   const ready=Date.now()+10000;
   while(a.state.midiEditor?.projectId!==id&&Date.now()<ready)await new Promise(resolve=>setTimeout(resolve,20));
   const session=a.state.midiEditor;
   if(session?.projectId!==id)throw Error('locked editor not open');
   MusicStudioMeasureLocks.addRangeLock(session,core,{trackId:'melody',startTick:240,endTick:360});
   const before=JSON.stringify(session.midiData);
   panel.setTab(id,'candidates');
   document.querySelector('#aiRemakeMode').value='replace';
   document.querySelector('#aiReplaceStartSeconds').value='0.125';
   document.querySelector('#aiReplaceEndSeconds').value='0.75';
   await panel.generateLocalModel(id);
   const record=panel._states.get(id);
   const refused=record.message.includes('固定区間')&&!record.state.workspace.candidateSets.length&&before===JSON.stringify(session.midiData);
   a.state.midiEditor=null;
   return refused;
 });
 assert.equal(locked,true);
 assert.equal(requests,0,'protected empty range must block inference');
 const secondsResult=await exactPage.evaluate(async()=>{
 const app=MusicStudio,core=MusicStudioEditor,panel=MusicStudioAIAssistantPanel,repo=app.indexedDbRepository();
 const prior=[...app.state.projects],projectId='section-melody-browser';
 const notes=(part,pitches,length)=>Array.from({length:32},(_,bar)=>({
   id:part+'-'+bar,pitch:pitches[bar%pitches.length],startTick:bar*1920,durationTicks:length,velocity:85
 }));
 const project=app.makeProject({projectId,projectName:'Intro / Verse / Chorus / Outro',key:'C',bpm:96,midiData:{
   ppq:480,tempo:96,timeSignature:{numerator:4,denominator:4},keySignatureMap:[{tick:16*1920,sharps:1,minor:false},{tick:16*1920+480,sharps:-2,minor:false}],
   editor:{measureCount:32,editRange:{startMeasure:17,endMeasure:24}},
   tracks:[{id:'melody',part:'melody',notes:notes('melody',[60,64,67,62],480).filter((_,i)=>i!==24&&i!==25)},
     {id:'bass',part:'bass',notes:notes('bass',[43,40,36,38],1920)},
     {id:'strings',name:'Strings',roleAssignment:'strings',trackType:'midi-melodic',channel:5,program:48,notes:notes('strings',[67,64,60,62],960)}]
 }});
 await repo.put(project);app.state.projects=[project];app.openMidiEditor(projectId);
 const deadline=Date.now()+10000;
 while(app.state.midiEditor?.projectId!==projectId){
   if(Date.now()>deadline)throw Error('section editor timeout');
   await new Promise(resolve=>setTimeout(resolve,20));
 }
 const session=app.state.midiEditor,before=JSON.stringify(session.midiData);
 panel.setTab(projectId,'candidates');
 document.querySelector('#aiRemakeMode').value='replace';
 document.querySelector('#aiModelChords').value='';
 // 96 BPM and 480 PPQ. These endpoints are both inside a measure.
 document.querySelector('#aiReplaceStartSeconds').value='40.15625';
 document.querySelector('#aiReplaceEndSeconds').value='59.84375';
 await panel.generateLocalModel(projectId);
 const record=panel._states.get(projectId),set=record.state.workspace.candidateSets.at(-1);
 if(set?.candidates.length!==3||set.candidates.some(c=>c.value.remake?.mode!=='replace'||c.value.key!=='G'))throw Error(record.message);
 for(const {value} of set.candidates){
   const windows=value.replacementHarmony?.windows;
   if(windows?.length!==2||windows[0].key!=='G'||windows[1].key!=='Bb'||windows[1].startTick!==360)throw Error('modulation windows');
   if(!value.importedMidi.notes.every(note=>windows[note.startTick<360?0:1].pitchClasses.includes(note.pitch%12)))throw Error('modulation pitch class');
 }
 panel.previewCandidate(projectId,'A');
 for(const source of ['original','candidate']){
   await panel.auditionCandidate(projectId,'A',source);
   if(!record.message.includes('試聴中'))throw Error(record.message);
   app.editorStopCandidateAudition();
 }
 panel.applyCandidatePreview(projectId,'A');
 if(record.approval?.kind!=='candidate'||JSON.stringify(session.midiData)!==before)throw Error('approval boundary');
 panel.confirmApprovedChange(projectId);
 const after=JSON.stringify(session.midiData),old=JSON.parse(before),tracks=session.midiData.tracks;
 const cutStart=16*1920+120,cutEnd=24*1920-120;
 if(set.candidates.some(c=>c.value.range.startTick!==cutStart||c.value.range.endTick!==cutEnd||c.value.range.unit!=='ticks'))throw Error('seconds range rounded to measures');
 const outside=note=>note.startTick<cutStart||note.startTick>=cutEnd;
 const originalNotes=new Set(old.tracks[0].notes.map(n=>n.id));
 const generated=tracks[0].notes.filter(n=>!originalNotes.has(n.id));
 if(!generated.length||generated.some(note=>outside(note)||note.startTick+note.durationTicks>cutEnd))throw Error('seconds replacement crossed the operation boundary');
 if(after===before||JSON.stringify(tracks[0].notes.filter(outside))!==JSON.stringify(old.tracks[0].notes.filter(outside))
   ||JSON.stringify(tracks.slice(1))!==JSON.stringify(old.tracks.slice(1)))throw Error('section scope');
 core.undo(session);
 if(JSON.stringify(session.midiData)!==before)throw Error('section undo');
 core.redo(session);
 if(JSON.stringify(session.midiData)!==after)throw Error('section redo');
 if(!(await app.saveMidiEditor({silent:true})).ok||JSON.stringify((await repo.get(projectId)).midiData)!==after)throw Error('section persistence');
 core.setEditRange(session,{startMeasure:25,endMeasure:26});
 app.repaintEditor();
 panel.setTab(projectId,'candidates');
 document.querySelector('#aiSectionName').value='outro';
 document.querySelector('#aiSectionDensity').value='normal';
 for(const role of ['piano','bass','strings','drums'])document.querySelector('#aiSection'+role).checked=['bass','strings'].includes(role);
 document.querySelector('#aiSectionTargetbass').value='bass';
 document.querySelector('#aiSectionTargetstrings').value='strings';
 panel.saveSectionArrangement(projectId);
 panel.confirmApprovedChange(projectId);
 document.querySelector('#aiRemakeMode').value='ensemble';
 document.querySelector('#aiModelChords').value='Bbadd9/D F7b9/A';
 const ensembleBefore=JSON.stringify(session.midiData);
 await panel.generateLocalModel(projectId);
 const ensemble=record.state.workspace.candidateSets.at(-1);
 if(ensemble===set||ensemble?.candidates.length!==3||ensemble.candidates.some(c=>c.value.ensemble?.source.notes.length!==0))throw Error(record.message);
 panel.previewCandidate(projectId,'A');
 if(record.candidatePreview?.companion.ensembleDiff?.length!==2)throw Error(record.message);
 panel.applyCandidatePreview(projectId,'A');
 if(record.approval?.kind!=='candidate'||JSON.stringify(session.midiData)!==ensembleBefore)throw Error('ensemble approval boundary');
 panel.confirmApprovedChange(projectId);
 const ensembleAfter=JSON.stringify(session.midiData),ensembleOld=JSON.parse(ensembleBefore);
 if(ensembleAfter===ensembleBefore||session.midiData.tracks.length!==ensembleOld.tracks.length)throw Error('ensemble destinations');
 const arrangedBass=session.midiData.tracks.find(track=>track.id==='bass').notes;
 const range=record.candidatePreview?.range||ensemble.candidates[0].value.ensemble.source.range;
 const firstBass=arrangedBass.find(note=>note.startTick===range.startTick);
 if(firstBass?.pitch%12!==2)throw Error('slash chord bass must start on D');
 for(const track of ensembleOld.tracks){
   const next=core.getTrackById(session.midiData.tracks,track.id);
   if(!['bass','strings'].includes(track.id)&&JSON.stringify(track)!==JSON.stringify(next))throw Error('ensemble source mutated');
   if(['bass','strings'].includes(track.id)){
     const untouched=n=>n.startTick<24*1920||n.startTick>=26*1920;
     if(JSON.stringify(track.notes.filter(untouched))!==JSON.stringify(next.notes.filter(untouched))||
        JSON.stringify(track.notes)===JSON.stringify(next.notes))throw Error('ensemble range mutated');
   }
 }
 core.undo(session);
 if(JSON.stringify(session.midiData)!==ensembleBefore)throw Error('ensemble undo');
 app.state.projects=prior;app.state.midiEditor=null;
 return{bars:32,bpm:96,replacedBars:8,variants:3,compared:true,modulation:true,ensembleDestinationTracks:2,approval:true,undoRedo:true,indexedDB:true,cutStart,cutEnd,after};
 });
 await context.close();
 const reopened=await openSecondsProject();
 const same=await reopened.evaluate(async expected=>{
   const a=MusicStudio,p=await a.indexedDbRepository().get('section-melody-browser');
   const range=p?.aiWorkspace?.candidateSets?.find(s=>s.candidates.some(c=>c.value.range.unit==='ticks'))?.candidates[0].value.range;
   return JSON.stringify(p?.midiData)===expected.after&&range?.startTick===expected.cutStart&&range.endTick===expected.cutEnd;
 },secondsResult);
 assert.equal(same,true,'exact seconds adoption and candidate range survive Chromium restart');
 const {after,...seconds}=secondsResult;
 result.sectionMelody={...seconds,emptyRangeLock:true,realRestart:true};
 } finally {
   await context?.close();
   fs.rmSync(profile,{recursive:true,force:true});
 }
}
const whole=await page.evaluate(async()=>{
 const a=MusicStudio,core=MusicStudioEditor,panel=MusicStudioAIAssistantPanel,bridge=MusicStudioAICandidatePreview,prior=[...a.state.projects],repo=a.indexedDbRepository();
 const p=a.makeProject({projectId:'whole-song-browser',projectName:'Whole song',key:'C',bpm:90,midiData:{ppq:480,tempo:90,timeSignature:{numerator:4,denominator:4},editor:{measureCount:4,editRange:{startMeasure:1,endMeasure:2}},tracks:[{id:'melody',part:'melody',notes:[0,1,2,3].map(i=>({id:'whole-source-'+i,pitch:60+i*2,startTick:i*1920,durationTicks:480,velocity:80}))},{id:'bass',part:'bass',notes:[]},{id:'drums',part:'drums',notes:[]}]}});
 await repo.put(p);a.state.projects=[p];a.openMidiEditor(p.projectId);await new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{if(a.state.midiEditor?.projectId===p.projectId)return resolve();if(Date.now()-start>10000)return reject(Error('whole route timeout'));setTimeout(poll,20)};poll();});
 panel.setTab(p.projectId,'candidates');
 for(const [from,to,name] of [[1,2,'verse'],[3,4,'chorus']]){core.setEditRange(a.state.midiEditor,{startMeasure:from,endMeasure:to});a.repaintEditor();panel.setTab(p.projectId,'candidates');document.querySelector('#aiSectionName').value=name;document.querySelector('#aiSectionDensity').value='normal';for(const role of ['piano','bass','strings','drums'])document.querySelector('#aiSection'+role).checked=true;panel.saveSectionArrangement(p.projectId);panel.confirmApprovedChange(p.projectId);}
 document.querySelector('#aiJapaneseArrangement').value='Aメロは静かに。サビを豪華に。元のメロディーは変更しない。';panel.previewJapaneseArrangement(p.projectId);const record=panel._states.get(p.projectId);if(!record.japanesePlan)throw Error(record.message);panel.requestArrangementApproval(p.projectId);panel.confirmApprovedChange(p.projectId);
 const original=JSON.stringify(a.state.midiEditor.midiData),request=a.localGenerationRequest;let requestCount=0;
 a.localGenerationRequest=async function(kind,...args){if(kind==='compose'){
   const committed=await repo.get(p.projectId);
   if(JSON.stringify(committed.midiData)!==original||committed.aiWorkspace?.wholeSongCheckpoint?.results.length!==requestCount)throw Error('inference-before-durable-checkpoint');
   if(++requestCount===2)throw Error('intentional-checkpoint-disconnect');
 }return request(kind,...args)};
 try{await (panel.generateWholeSong(p.projectId),panel.confirmApprovedChange(p.projectId));}finally{a.localGenerationRequest=request;}
 if(record.state.workspace.wholeSongCheckpoint?.results.length!==1||record.state.workspace.candidateSets.length)throw Error('partial result publication');
 await (panel.saveWholeSongCheckpoint(p.projectId),panel.confirmApprovedChange(p.projectId));const paused=await repo.get(p.projectId);
 if(paused.aiWorkspace.wholeSongCheckpoint?.results.length!==1)throw Error('checkpoint not durable');
 a.state.midiEditor=core.createCoordinatedSession(paused);a.state.projects=a.state.projects.map(x=>x.projectId===p.projectId?paused:x);panel.render(paused,a.state.midiEditor,core);
 await (panel.generateWholeSong(p.projectId,true),panel.confirmApprovedChange(p.projectId));const set=record.state.workspace.candidateSets.at(-1);if(!set?.candidates.every(c=>c.value.ensemble.wholeSong.version===2&&c.value.ensemble.wholeSong.parts.length===4&&c.value.ensemble.wholeSong.parts.every(p=>!Object.hasOwn(p.ensemble.source,'midiSignature'))))throw Error(record.message);
 for(const candidate of set.candidates){const b=bridge.createPreview(a.state.midiEditor,core,candidate);if(b.companion.performance.length!==4||b.companion.performance.some(m=>m.notes<1||m.pitchMin<0||m.pitchMax>127))throw Error('whole performance metrics');if(new Set(b.result.changes.adds.map(n=>n.id)).size!==b.result.changes.adds.length)throw Error('duplicated whole preview notes');const full=bridge.auditionPlan(a.state.midiEditor,core,b);const all=await a.editorAuditionCandidate(full);if(!all.ok)throw Error('whole four instrument audition');a.editorStopCandidateAudition();const heard=await a.editorAuditionCandidate(bridge.auditionPlan(a.state.midiEditor,core,b,{startMeasure:2,endMeasure:3,roles:['bass']}));if(!heard.ok)throw Error('whole audition');a.editorStopCandidateAudition();}
 if(JSON.stringify(a.state.midiEditor.midiData)!==original)throw Error('whole preview mutation');
 const bundle=bridge.createPreview(a.state.midiEditor,core,set.candidates[0]);bridge.applyPreview(a.state.midiEditor,core,bundle,{startMeasure:2,endMeasure:3,roles:['bass']});const after=JSON.stringify(a.state.midiEditor.midiData);if(JSON.stringify(a.state.midiEditor.midiData.tracks.slice(0,3))!==JSON.stringify(JSON.parse(original).tracks))throw Error('whole source changed');core.undo(a.state.midiEditor);if(JSON.stringify(a.state.midiEditor.midiData)!==original)throw Error('whole undo');core.redo(a.state.midiEditor);if(JSON.stringify(a.state.midiEditor.midiData)!==after)throw Error('whole redo');
 if(!(await a.saveMidiEditor({silent:true})).ok)throw Error('whole save');const saved=await repo.get(p.projectId);if(JSON.stringify(saved.midiData)!==after||saved.aiWorkspace.candidateSets.at(-1).candidates.length!==3)throw Error('whole reopen');
 if(!await a.productionOpenAction('export',p.projectId))throw Error('whole export navigation blocked after Save');const audio=await a.midiRenderForMix(p.projectId);if(!audio.ok)throw Error(audio.error);const exported=await a.finalPreview(p.projectId,{format:'nova-final-export-plan-v1',routes:[{key:'wav:'+audio.assetId,role:'instrument',startSeconds:0,gainDb:0,muted:false}],targetLufs:-18,ceilingDb:-1,includeMidi:true});if(!exported.ok)throw Error(exported.error);
 a.state.projects=prior;a.state.midiEditor=null;return{wholeSong:true,checkpointSaveReopenResume:true,wholeVariants:3,wholeSections:2,wholePartialBass:true,wholeFourInstrumentAudition:true,wholeNoteMetrics:true,compactWholeCandidates:true,uniqueWholePreviewNotes:true,wholeMidiToMaster:true,japanesePreview:true};
});Object.assign(result,whole);
const sung=await page.evaluate(async()=>{const a=MusicStudio,p=a.state.projects[0],r=a.lyricsAssignmentPreview(p,{trackId:'melody',fromNote:1,toNote:1,text:'あ',reading:'あ'}),adopted=a.adoptLyricsAssignment(p,r);await a.indexedDbRepository().put(adopted);a.state.projects=[adopted];a.state.midiEditor=null;const record=adopted.syllableAssignments[0];a.openLyricsAssignment(adopted.projectId);const generated=await a.generateLocalScoreVocal(adopted.projectId,record.id);if(!generated.ok)throw Error(generated.error);const wav=await a.vocalRender(adopted.projectId,generated.assetId),bytes=new Uint8Array(await wav.blob.arrayBuffer());if(!bytes.slice(44).some(x=>x!==0))throw Error('silent generated WAV');return{bytes:bytes.length}});assert.ok(sung.bytes>44);
const rangeSung=await page.evaluate(async()=>{const a=MusicStudio,repo=a.indexedDbRepository(),p=a.makeProject({projectId:'range-vocal-browser',projectName:'Range vocal',bpm:90,midiData:{ppq:480,timeSignature:{numerator:4,denominator:4},tracks:[{id:'lead',part:'melody',notes:[{id:'a',pitch:60,startTick:0,durationTicks:480},{id:'b',pitch:62,startTick:1920,durationTicks:480},{id:'c',pitch:64,startTick:2400,durationTicks:480}]}]}}),adopted=a.adoptLyricsAssignment(p,a.lyricsAssignmentPreview(p,{trackId:'lead',fromNote:1,toNote:3,text:'あい',reading:'ア イ ~'}));await repo.put(adopted);a.state.projects=[adopted];a.state.midiEditor=null;const record=adopted.syllableAssignments[0];a.openLyricsAssignment(adopted.projectId);const original=await a.generateLocalScoreVocal(adopted.projectId,record.id);if(!original.ok)throw Error(original.error);const generated=await a.generateLocalScoreVocal(adopted.projectId,record.id,{startMeasure:2,endMeasure:2});if(!generated.ok)throw Error(generated.error);const asset=generated.project.longWavAssets.find(x=>x.id===generated.assetId),source=asset.vocalTake.scoreSource;if(source.generationRange.startMeasure!==2||source.scoreXML.includes('<text>あ</text>')||!source.scoreXML.includes('<text>い</text>'))throw Error('range source mismatch');const rendered=await a.vocalRender(adopted.projectId,generated.assetId),bytes=new Uint8Array(await rendered.blob.arrayBuffer());if(!bytes.slice(44).some(x=>x!==0))throw Error('silent range WAV');const reopened=await repo.get(adopted.projectId);if(JSON.stringify(reopened.longWavAssets)!==JSON.stringify(generated.project.longWavAssets))throw Error('range reopen mismatch');const comparison=await a.vocalReplacementRender(adopted.projectId,original.assetId,generated.assetId),dry=new Uint8Array(await(await a.pcmLoadLongWav(adopted.projectId,original.assetId)).arrayBuffer()),wet=new Uint8Array(await comparison.blob.arrayBuffer()),firstByte=44+comparison.first*comparison.base.channels*2,endByte=44+comparison.last*comparison.base.channels*2;if(!dry.slice(0,firstByte).every((v,i)=>v===wet[i])||!dry.slice(endByte).every((v,i)=>v===wet[endByte+i]))throw Error('real replacement changed outside range');const applied=await a.vocalReplacementApply(adopted.projectId,original.assetId,generated.assetId);if(!applied.ok)throw Error(applied.error);if(!(await a.vocalReplacementUndo(adopted.projectId,-1)).ok||!(await a.vocalReplacementUndo(adopted.projectId,1)).ok)throw Error('real adoption history');const restored=await a.restoreLongWavArchive(await a.createLongWavArchive(),{settings:false});if(!restored.ok)throw Error(restored.error);const copy=restored.projects.find(p=>p.vocalReplacement),take=copy.longWavAssets.find(x=>x.replacementSource),restoredBytes=new Uint8Array(await(await a.pcmLoadLongWav(copy.projectId,take.id)).arrayBuffer());if(restoredBytes.length!==wet.length||!restoredBytes.every((v,i)=>v===wet[i]))throw Error('real replacement archive mismatch');return{realRangeReplacement:true,realReplacementArchiveEqual:true,rangeBytes:bytes.length,rangeStart:source.generationRange.startMeasure,rangeReopened:true}});assert.ok(rangeSung.rangeBytes>44);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(messages,[]);assert.deepEqual(external,[]);report.push({width,height:820,...result,...sung,...rangeSung,messages,external});if(process.env.NOVA_PACKAGE_SCREENSHOT_DIR){fs.mkdirSync(process.env.NOVA_PACKAGE_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.NOVA_PACKAGE_SCREENSHOT_DIR,'package-'+width+'.png')})}await page.close()}
fs.writeFileSync(process.env.NOVA_REAL_BROWSER_REPORT||'verification/music-local-real-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}finally{await browser?.close();if(host.exitCode===null&&host.signalCode===null)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{host.kill('SIGKILL');reject(Error('owned engine shutdown deadline'))},8000);host.once('exit',()=>{clearTimeout(timer);resolve()});host.kill('SIGTERM')})}})().catch(e=>{console.error(e);process.exitCode=1});
