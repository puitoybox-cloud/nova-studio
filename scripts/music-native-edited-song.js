// Executed only by the explicitly instrumented Intel CI app, in its real WKWebView.
// The MIDI input is the existing observed_six_notes_stems.mid fixture, not a new demo.
async function runNativeEditedSong(input) {
const a=MusicStudio,core=MusicStudioEditor,repo=a.indexedDbRepository();
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const wait=async check=>{for(let n=0;n<600;n++){if(check())return;await new Promise(r=>setTimeout(r,50))}throw Error('native editor deadline')};
const to64=async blob=>{const bytes=new Uint8Array(await blob.arrayBuffer());let text='';for(let n=0;n<bytes.length;n+=32768)text+=String.fromCharCode(...bytes.subarray(n,n+32768));return btoa(text)};
const from64=text=>new Blob([Uint8Array.from(atob(text),c=>c.charCodeAt(0))]);
// Persistence acceptance uses explicit four-bar generation controls. The default
// short-range acceptance is independently exercised by music-local-real-generation.js.
const generationSettings={startMeasure:1,endMeasure:4,style:'gentle',genre:'ballad',chords:'C F G C',seed:72};
function configureGeneration(id){
 MusicStudioAIAssistantPanel.setTab(id,'candidates');
 for(const [selector,value] of Object.entries({'#aiRemakeMode':'new','#aiModelStyle':'gentle','#aiModelRange':'57:77','#aiModelGenre':'ballad','#aiModelChords':'C F G C','#aiGenerationSeed':'72'})){
  const field=document.querySelector(selector);assert(field,'native generation control missing: '+selector);field.value=value;
 }
}
const messages=[],external=[];
for(const name of ['warn','error']){const original=console[name].bind(console);console[name]=(...args)=>{messages.push(name+':'+args.map(String).join(' '));original(...args)}}
addEventListener('error',e=>messages.push(e.message));addEventListener('unhandledrejection',e=>messages.push(String(e.reason)));
const fetchOriginal=window.fetch.bind(window);window.fetch=(url,...args)=>{const resolved=new URL(typeof url==='string'?url:url.url,location.href);if(resolved.origin!==location.origin){external.push(resolved.href);return Promise.reject(Error('external request forbidden'))}return fetchOriginal(url,...args)};
assert(location.origin==='http://127.0.0.1:8765','unexpected persistent origin');
assert(!a.state.persistenceUnavailable&&repo.kind==='indexeddb','durable repository required');
let id=input.id,p;
let stage='entry';
const loadAudio=async(projectId,assetId)=>{try{return await a.pcmLoadLongWav(projectId,assetId)}catch(error){throw Error(input.phase+'/'+stage+'/'+assetId+': '+error.message)}};
if(input.phase==='write'){
 assert(!(await repo.get(id)),'acceptance project already exists');
 const parsed=MusicStudioMidiParser.parseMidiFile(Uint8Array.from(atob(input.midi),c=>c.charCodeAt(0)));
 assert(parsed.validation.importable,'existing MIDI fixture rejected');
 const midi=MusicStudioMidiParser.convertParsedMidiToProjectData(parsed);
 midi.editor={...(midi.editor||{}),measureCount:Math.max(4,midi.editor?.measureCount||0),editRange:{startMeasure:1,endMeasure:4}};
 const lead=midi.tracks.find(t=>t.notes.length&&t.part!=='drums');assert(lead,'fixture melodic track required');
 lead.part='melody';
 p=await a.createAIProject({projectInput:{projectId:id,projectName:'Native lifecycle acceptance',bpm:midi.tempo,key:'C'},midiData:midi});
 // Open the existing imported song and actually edit before generation/save.
 a.openMidiEditor(id);await wait(()=>a.state.midiEditor?.projectId===id);
 const session=a.state.midiEditor;core.selectPart(session,'melody');
 core.addNote(session,{pitch:67,startTick:1920,durationTicks:480,velocity:83});session.midiData.tempo=96;session.dirty=true;
 assert((await a.saveMidiEditor({silent:true})).ok,'edited song save failed');
 configureGeneration(id);
 await MusicStudioAIAssistantPanel.generateLocalModel(id);
 assert((await a.saveMidiEditor({silent:true})).ok,'AI workspace save failed');
 p=await repo.get(id);assert(p.aiWorkspace?.candidateSets?.some(s=>s.candidates.length),'real ONNX candidates missing: '+MusicStudioAIAssistantPanel._states.get(id)?.message);
 const track=p.midiData.tracks.find(t=>t.part==='melody'&&t.notes.length);
 const preview=a.lyricsAssignmentPreview(p,{trackId:track.id,fromNote:1,toNote:1,text:'あ',reading:'あ'});
 p=a.adoptLyricsAssignment(p,preview);assert(a.validateProject(p).valid,'lyrics project invalid');
 await repo.compareAndPut(p,JSON.stringify(await repo.get(id)));await a.refresh();a.state.midiEditor=null;
 a.openLyricsAssignment(id);
 const sung=await a.generateLocalScoreVocal(id,p.syllableAssignments.at(-1).id);assert(sung.ok,'real Sinsy generation failed: '+sung.error);
 assert((await a.versionSave(id,'Native lifecycle saved revision')).ok,'song history save failed');
}else if(input.phase==='edit'||input.phase==='read'||input.phase==='read-return'){
 p=await repo.get(id);assert(JSON.stringify(p)===input.expected,'restarted metadata mismatch');
 for(const asset of p.longWavAssets||[])assert(await to64(await loadAudio(id,asset.id))===input.audio[asset.id],'restarted audio mismatch');
 a.openMidiEditor(id);await wait(()=>a.state.midiEditor?.projectId===id);
 if(input.phase==='edit'||input.phase==='read-return'){
  const session=a.state.midiEditor;core.selectPart(session,'melody');core.addNote(session,{pitch:69,startTick:2400,durationTicks:360,velocity:77});session.midiData.tempo=102;session.dirty=true;
  assert((await a.saveMidiEditor({silent:true})).ok,'re-edit save failed');
 }
 if(input.phase==='read-return'){
  stage='final-export';const output=await a.finalPreview(id,p.finalExportPlan);assert(output.ok,'returned-song restart export failed: '+output.error);
  assert(output.candidate.files.some(f=>f.name==='Instrumental.wav')&&output.candidate.files.some(f=>f.name==='Song.mid'),'returned-song package incomplete');
 }
}else if(input.phase==='restore'){
 assert((await repo.list()).length===0,'restore profile is not empty');
 const restored=await a.restoreLongWavArchive(from64(input.archive),{settings:false});assert(restored.ok,'isolated archive restore failed: '+restored.error);
 p=restored.projects.find(x=>x.projectName.startsWith('Native lifecycle acceptance'));assert(p&&p.projectId!==input.id,'non-destructive restore identity required');id=p.projectId;
 const expected=JSON.parse(input.expected);
 assert(JSON.stringify(p.midiData)===JSON.stringify(expected.midiData),'restored MIDI mismatch');
 assert(JSON.stringify(p.syllableAssignments)===JSON.stringify(expected.syllableAssignments),'restored lyric mismatch');
 const workspaceContent=value=>{const copy=structuredClone(value);for(const key of ['projectId','baseRevision','updatedAt'])delete copy[key];return JSON.stringify(copy)};
 assert(JSON.stringify(p.musicalSettings)===JSON.stringify(expected.musicalSettings),'restored musical metadata mismatch');
 assert(workspaceContent(p.aiWorkspace)===workspaceContent(expected.aiWorkspace),'restored AI workspace mismatch');
 const historyContent=project=>JSON.stringify(project.songVersions.checkpoints.map(c=>({name:c.name,midi:c.snapshot.midiData,lyrics:c.snapshot.syllableAssignments})));
 assert(historyContent(p)===historyContent(expected),'restored checkpoint content mismatch');
 for(let i=0;i<(expected.longWavAssets||[]).length;i++)assert(await to64(await loadAudio(id,p.longWavAssets[i].id))===input.audio[expected.longWavAssets[i].id],'restored WAV mismatch');
 a.openMidiEditor(id);await wait(()=>a.state.midiEditor?.projectId===id);core.selectPart(a.state.midiEditor,'melody');
 core.addNote(a.state.midiEditor,{pitch:71,startTick:2880,durationTicks:240,velocity:70});assert((await a.saveMidiEditor({silent:true})).ok,'restored edit save failed');
 const candidatesBefore=(await repo.get(id)).aiWorkspace.candidateSets.length;
 configureGeneration(id);await MusicStudioAIAssistantPanel.generateLocalModel(id);assert((await a.saveMidiEditor({silent:true})).ok,'restored AI save failed');
 assert((await repo.get(id)).aiWorkspace.candidateSets.length>candidatesBefore,'restored AI did not generate a new candidate set');
 stage='restored-render';const render=await a.midiRenderForMix(id);assert(render.ok,'restored MIDI audio render failed');
 stage='final-export';const output=await a.finalPreview(id,{format:'nova-final-export-plan-v1',routes:[{key:'wav:'+render.assetId,role:'instrument',startSeconds:0,gainDb:0,muted:false}],targetLufs:-18,ceilingDb:-1,includeMidi:true});
 assert(output.ok,'restored final export failed: '+output.error);assert(output.candidate.zip.size>44,'final ZIP missing');
 assert(output.candidate.files.some(f=>f.name==='Song.mid')&&output.candidate.files.some(f=>f.name==='Master.wav'),'final MIDI/Master missing');
 assert((await a.finalSave(id)).ok,'restored export history save failed');
 // Return the actual completed native WAV through the production Logic return path.
 // This checks the transport contract; it does not claim physical Logic operation.
 stage='logic-return';const original=JSON.stringify(await repo.get(id)),master=output.candidate.files.find(f=>f.name==='Master.wav').blob;
 const file=new File([master],'Native-return.wav',{type:'audio/wav'});
 const returned=await a.logicImportAudioReturn(file,id);assert(returned.ok,'native Logic WAV return failed: '+returned.error);
 assert(JSON.stringify(await repo.get(id))===original,'Logic return changed source song');id=returned.project.projectId;
 const asset=returned.project.longWavAssets.at(-1);
 const again=await a.finalPreview(id,{...output.candidate.plan,routes:[{key:'wav:'+asset.id,role:'instrument',startSeconds:0,gainDb:0,muted:false}]});
 assert(again.ok,'native returned-song export failed: '+again.error);assert((await a.finalSave(id)).ok,'returned-song history save failed');
 // Render the existing fixture's real instrument parts, then export aligned Stems.
 stage='logic-stem-render';const tracks=(await repo.get(id)).midiData.tracks.filter(t=>t.notes?.length&&!t.muted).slice(0,2);assert(tracks.length===2,'two original MIDI tracks required');
 const stems=await a.midiRenderStems(id,tracks.map(t=>t.id));assert(stems.ok,'native stem render: '+stems.error);
 const routed=await a.finalPreview(id,{...output.candidate.plan,routes:stems.completed.map(x=>({key:'wav:'+x.assetId,role:'instrument',startSeconds:0,gainDb:0,muted:false}))});assert(routed.ok,'aligned stem package: '+routed.error);
 const sourceBefore=JSON.stringify(await repo.get(id));
 const entries=stems.completed.map((x,i)=>({trackId:x.trackId,file:new File([routed.candidate.files.find(f=>f.name==='Instrument-'+(i+1)+'.wav').blob],'Returned-'+(i+1)+'.wav',{type:'audio/wav'})}));
 const batch=await a.logicImportStemReturns(entries,id);assert(batch.ok,'native batch return: '+batch.error);assert(JSON.stringify(await repo.get(id))===sourceBefore,'batch changed source');id=batch.project.projectId;
 const returnedAssets=batch.project.longWavAssets.slice(-2),batchOut=await a.finalPreview(id,{...routed.candidate.plan,routes:returnedAssets.map(x=>({key:'wav:'+x.id,role:'instrument',startSeconds:0,gainDb:0,muted:false}))});assert(batchOut.ok,'native batch export: '+batchOut.error);assert((await a.finalSave(id)).ok,'batch history save');
}else if(input.phase==='restore-return'){
 assert((await repo.list()).length===0,'returned-batch restore store must be empty');
 const restored=await a.restoreLongWavArchive(from64(input.archive),{settings:false});assert(restored.ok,'returned batch restore: '+restored.error);
 p=restored.projects.find(x=>x.integrations?.logicPro?.filter(l=>l.batchId).length===2);assert(p,'restored mapped batch missing');id=p.projectId;
 for(const link of p.integrations.logicPro.filter(l=>l.batchId)){const asset=p.longWavAssets.find(x=>x.id===link.assetId);assert(asset?.midiRender?.stemTrackId===link.trackId,'restored native track correspondence');assert(p.midiData.tracks.some(t=>t.id===link.trackId),'returned MIDI identity missing')}
 const output=await a.finalPreview(id,p.finalExportPlan);assert(output.ok,'returned batch restored export: '+output.error);assert((await a.finalSave(id)).ok,'returned batch restored history save');
}else throw Error('invalid native acceptance phase');
stage='shutdown';assert((await a.prepareForShutdown()).ok,'page save gate refused');
stage='saved-audio-readback';p=await repo.get(id);const audio={};for(const asset of p.longWavAssets||[])audio[asset.id]=await to64(await loadAudio(id,asset.id));
const archive=['read','restore'].includes(input.phase)?await to64(await a.createLongWavArchive()):null;
assert(messages.length===0,'console errors/warnings: '+messages.join(';'));assert(external.length===0,'Live Provider/external request attempted');
return {phase:input.phase,id,generationSettings,expected:JSON.stringify(p),audio,archive,origin:location.origin,console:messages,external,revision:p.revision,noteCount:p.midiData.tracks.reduce((n,t)=>n+t.notes.length,0),physicalAcceptance:false};

}
