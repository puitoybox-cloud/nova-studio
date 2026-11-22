const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),plain=value=>JSON.parse(JSON.stringify(value));
function load(){
  const w={};w.window=w;w.globalThis=w;
  for(const file of ['music-studio-meter-map.js','music-studio-measure-locks.js','music-studio-editor.js','music-studio-ai-composition.js','music-studio-ai-candidate-preview.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),w,{filename:file});
  return w;
}
function project(id='p'){return{projectId:id,revision:1,musicalSettings:{key:'C'},midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},editor:{measureCount:4,editRange:{startMeasure:1,endMeasure:2}},tracks:[{id:'melody',part:'melody',notes:[]},{id:'drums',part:'drums',notes:[]},{id:'bass',part:'bass',notes:[]}]}}}
function lyricsFixture(){const w=load(),p=project();p.midiData.timeSignatureMap=[{tick:1000,numerator:3,denominator:8}];p.midiData.editor.editRange={startMeasure:1,endMeasure:4};const core=w.MusicStudioEditor,s=core.createCoordinatedSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,core),value=w.MusicStudioAIComposition.candidateValues('lyrics-structure',ctx)[1];return{w,p,core,s,value}}
test('Lyrics anchors use exact changing-meter windows and preserve line stress without allocating notes',()=>{const{w,p,core,s,value}=lyricsFixture(),before=plain({p,s,value}),bundle=w.MusicStudioAICandidatePreview.createPreview(s,core,{candidateId:'B',value},{project:p}),t=bundle.companion.timeline;assert.equal(bundle.type,'metadata-preview');assert.equal(t.alignmentPolicy,'measure-anchor-only');assert.deepEqual(plain(t.slots.map(x=>[x.line,x.measureSlot,x.startTick,x.endTick,x.melodySlot])),[[1,1,0,1000,1],[2,2,1000,1720,2],[3,3,1720,2440,1],[4,4,2440,3160,2]]);assert.deepEqual(plain(t.slots[1].stress),plain(value.lines[1].stress));assert.equal(Object.hasOwn(t.slots[1],'noteIds'),false);assert.deepEqual(plain({p,s,value}),before);assert.match(w.MusicStudioAIComposition.lyricsTimelineRows(t).join('|'),/Lyrics line 2: anchor M2 \/ tick 1000-1720.*7 syllables.*Melody B phrase 2/)});
test('Lyrics partial Preview contains only selected anchor lines and keeps original candidate intact',()=>{const{w,p,core,s,value}=lyricsFixture(),before=plain(value),bundle=w.MusicStudioAICandidatePreview.createPreview(s,core,{candidateId:'B',value},{project:p,measureRange:{startMeasure:2,endMeasure:3}});assert.deepEqual(plain(bundle.companion.timeline.slots.map(x=>x.line)),[2,3]);assert.equal(bundle.companion.timeline.range.startTick,1000);assert.equal(bundle.companion.timeline.range.endTick,2440);assert.deepEqual(plain(value),before);assert.deepEqual(plain(bundle.companion.phraseSlots.map(x=>x.line)),[2,3]);assert.equal(s.undo.length,0)});
for(const bars of [1,2])test(`Lyrics keeps distinct same-measure line anchors within ${bars} bars`,()=>{const{w,p,core,s}=lyricsFixture(),ctx=w.MusicStudioAIComposition.createContext(p,s,core);ctx.range={startMeasure:1,endMeasure:bars};const value=w.MusicStudioAIComposition.candidateValues('lyrics-structure',ctx)[0],t=w.MusicStudioAIComposition.lyricsTimeline(value,s,core);assert.equal(t.slots.length,4);assert.deepEqual(plain(t.slots.map(x=>x.line)),[1,2,3,4]);assert.ok(t.slots.every(x=>x.measureSlot<=bars));assert.equal(t.mutates,false)});
test('Lyrics selection without an anchor shows zero instead of moving an outside line',()=>{const{w,p,core,s}=lyricsFixture(),ctx=w.MusicStudioAIComposition.createContext(p,s,core);ctx.range={startMeasure:1,endMeasure:8};const value=w.MusicStudioAIComposition.candidateValues('lyrics-structure',ctx)[2],t=w.MusicStudioAIComposition.lyricsTimeline(value,s,core,{startMeasure:2,endMeasure:2});assert.equal(t.slots.length,0);assert.match(w.MusicStudioAIComposition.lyricsTimelineRows(t)[0],/Lyrics anchors: 0 \/ M2-2 \/ tick 1000-1720/)});
for(const [label,change,error] of [
  ['outside measure',v=>v.lines[3].measureSlot=5,/invalid-lyrics-line/],
  ['fractional measure',v=>v.lines[0].measureSlot=1.5,/invalid-lyrics-line/],
  ['reordered measure',v=>v.lines[3].measureSlot=1,/invalid-lyrics-line/],
  ['duplicate line',v=>v.lines[1].line=1,/invalid-lyrics-line/],
  ['missing phrase',v=>v.lines[1].melodyPhraseSlot=0,/invalid-lyrics-line/],
  ['wrong stress length',v=>v.lines[3].stress.pop(),/invalid-lyrics-stress/],
  ['unknown stress',v=>v.lines[3].stress[0]='unknown',/invalid-lyrics-stress/],
  ['invalid syllables',v=>v.lines[0].syllableCount=0,/invalid-lyrics-stress/],
  ['line count mismatch',v=>v.lineCount=3,/invalid-lyrics-line-count/],
  ['missing lines',v=>delete v.lines,/lyrics-lines-required/],
  ['wrong melody variant',v=>v.linkedMelodyCandidate='A',/lyrics-melody-reference-mismatch/],
  ['wrong melody family',v=>v.melodyCandidateRef.familyId='other',/lyrics-melody-reference-mismatch/]
])test(`Lyrics rejects ${label} even outside the selected window without mutation`,()=>{const{w,p,core,s,value}=lyricsFixture();change(value);const before=plain({p,s,value});assert.throws(()=>w.MusicStudioAICandidatePreview.createPreview(s,core,{candidateId:'B',value},{project:p,measureRange:{startMeasure:2,endMeasure:2}}),error);assert.deepEqual(plain({p,s,value}),before)});
for(const range of [{startMeasure:0,endMeasure:2},{startMeasure:2,endMeasure:5},{startMeasure:3,endMeasure:2},{startMeasure:'2',endMeasure:3}])test(`Lyrics rejects invalid selected interval ${JSON.stringify(range)}`,()=>{const{w,p,core,s,value}=lyricsFixture();assert.throws(()=>w.MusicStudioAICandidatePreview.createPreview(s,core,{candidateId:'B',value},{project:p,measureRange:range}),/invalid-lyrics-selection/);assert.equal(s.undo.length,0)});
test('Lyrics refuses missing or invalid tick conversion without using cached candidate ticks',()=>{const{w,s,value}=lyricsFixture();for(const core of [{},{measureRangeToTicks:()=>({startTick:0,endTick:0})},{measureRangeToTicks:()=>({startTick:0.5,endTick:1000})}])assert.throws(()=>w.MusicStudioAIComposition.lyricsTimeline(value,s,core),/lyrics-timeline-unavailable|invalid-lyrics-ticks/)});
test('melody candidate creates a non-mutating exact-range partial-edit preview',()=>{const w=load(),p=project(),s=w.MusicStudioEditor.createSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,w.MusicStudioEditor),value=w.MusicStudioAIComposition.candidateValues('melody',ctx)[1],candidate={candidateId:'B',value},before=JSON.stringify(s.midiData),bundle=w.MusicStudioAICandidatePreview.createPreview(s,w.MusicStudioEditor,candidate,{project:p});assert.equal(bundle.type,'midi-preview');assert.equal(bundle.targetTrackId,'melody');assert.equal(bundle.result.changes.adds.length,8);assert.equal(JSON.stringify(s.midiData),before);assert.equal(bundle.preview.afterNotes.length,8)});
test('melody materialization updates editable notes but never targets a locked note',()=>{const w=load(),p=project();p.midiData.tracks[0].notes=[{id:'free',pitch:60,startTick:0,durationTicks:240,velocity:90},{id:'locked',pitch:62,startTick:480,durationTicks:240,velocity:90,locked:true}];const s=w.MusicStudioEditor.createSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,w.MusicStudioEditor),value=w.MusicStudioAIComposition.candidateValues('melody',ctx)[0],bundle=w.MusicStudioAICandidatePreview.createPreview(s,w.MusicStudioEditor,{candidateId:'A',value},{project:p});assert.deepEqual(plain(bundle.result.changes.updates.map(n=>n.id)),['free']);assert.equal(bundle.result.changes.updates.some(n=>n.id==='locked'),false)});
test('chord candidate previews root motion on Bass and links arrangement roles',()=>{const w=load(),p=project(),s=w.MusicStudioEditor.createSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,w.MusicStudioEditor),value=w.MusicStudioAIComposition.candidateValues('chord',ctx)[1],bundle=w.MusicStudioAICandidatePreview.createPreview(s,w.MusicStudioEditor,{candidateId:'B',value},{project:p});assert.equal(bundle.targetTrackId,'bass');assert.deepEqual(plain(bundle.result.changes.adds.map(n=>n.pitch)),[36,45,41,43]);assert.equal(bundle.companion.kind,'chord-companion');assert.equal(bundle.companion.arrangement.roles.includes('bass'),true)});
test('lyrics candidate stays metadata-only and links phrase slots to matching Melody candidate',()=>{const w=load(),p=project(),s=w.MusicStudioEditor.createSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,w.MusicStudioEditor),value=w.MusicStudioAIComposition.candidateValues('lyrics-structure',ctx)[2],before=JSON.stringify(s.midiData),bundle=w.MusicStudioAICandidatePreview.createPreview(s,w.MusicStudioEditor,{candidateId:'C',value},{project:p});assert.equal(bundle.type,'metadata-preview');assert.equal(bundle.companion.kind,'lyrics-melody-link');assert.equal(bundle.companion.linkedMelodyCandidate,'C');assert.equal(bundle.companion.phraseSlots.length,4);assert.equal(JSON.stringify(s.midiData),before)});
test('candidate apply goes through guarded partial edit path and can be undone',()=>{const w=load(),p=project(),s=w.MusicStudioEditor.createSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,w.MusicStudioEditor),value=w.MusicStudioAIComposition.candidateValues('melody',ctx)[0],bundle=w.MusicStudioAICandidatePreview.createPreview(s,w.MusicStudioEditor,{candidateId:'A',value},{project:p});const applied=w.MusicStudioAICandidatePreview.applyPreview(s,w.MusicStudioEditor,bundle);assert.equal(applied.ok,true);assert.equal(w.MusicStudioEditor.currentTrack(s).notes.length,8);w.MusicStudioEditor.undo(s);assert.equal(w.MusicStudioEditor.currentTrack(s).notes.length,0)});
test('range lock causes candidate apply to fail closed without mutation',()=>{const w=load(),p=project(),s=w.MusicStudioEditor.createSession(p);w.MusicStudioMeasureLocks.addRangeLock(s,w.MusicStudioEditor,{trackId:'melody',startTick:0,endTick:3840});const ctx=w.MusicStudioAIComposition.createContext(p,s,w.MusicStudioEditor),value=w.MusicStudioAIComposition.candidateValues('melody',ctx)[0],bundle=w.MusicStudioAICandidatePreview.createPreview(s,w.MusicStudioEditor,{candidateId:'A',value},{project:p}),before=JSON.stringify(s.midiData);assert.throws(()=>w.MusicStudioAICandidatePreview.applyPreview(s,w.MusicStudioEditor,bundle),/rejected|protected|locked/);assert.equal(JSON.stringify(s.midiData),before)});
test('candidate partial adoption applies only the selected exact measure range',()=>{const w=load(),p=project(),s=w.MusicStudioEditor.createSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,w.MusicStudioEditor),value=w.MusicStudioAIComposition.candidateValues('melody',ctx)[0],bundle=w.MusicStudioAICandidatePreview.createPreview(s,w.MusicStudioEditor,{candidateId:'A',value},{project:p});const applied=w.MusicStudioAICandidatePreview.applyPreview(s,w.MusicStudioEditor,bundle,{startMeasure:1,endMeasure:1});assert.equal(applied.ok,true);const notes=w.MusicStudioEditor.currentTrack(s).notes;assert.ok(notes.length>0);assert.equal(notes.every(note=>note.startTick<1920),true);});
test('phrase Preview uses motif rhythm but never mutates the source before Apply',()=>{const w=load(),p=project(),s=w.MusicStudioEditor.createSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,w.MusicStudioEditor),value=w.MusicStudioAIComposition.candidateValues('melody',ctx)[0],before=JSON.stringify(s.midiData),bundle=w.MusicStudioAICandidatePreview.createPreview(s,w.MusicStudioEditor,{candidateId:'A',value},{project:p});assert.equal(JSON.stringify(s.midiData),before);assert.equal(bundle.companion.kind,'phrase-plan');assert.equal(new Set(bundle.result.changes.adds.map(note=>note.durationTicks)).size>1,true)});
test('continuation Preview retains the observed source fingerprint and uses its phrase degrees',()=>{const w=load(),p=project();p.midiData.tracks[0].notes=[{id:'n1',pitch:60,startTick:0,durationTicks:240,velocity:80},{id:'n2',pitch:62,startTick:480,durationTicks:480,velocity:82},{id:'n3',pitch:64,startTick:960,durationTicks:240,velocity:84}];const s=w.MusicStudioEditor.createSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,w.MusicStudioEditor),value=w.MusicStudioAIComposition.candidateValues('continuation',ctx)[1],before=JSON.stringify(s.midiData),bundle=w.MusicStudioAICandidatePreview.createPreview(s,w.MusicStudioEditor,{candidateId:'B',value},{project:p});assert.equal(value.derivedFromExisting,true);assert.equal(bundle.companion.sourcePhrase.fingerprint,ctx.sourcePhrase.fingerprint);assert.equal(bundle.result.changes.updates.length,3);assert.equal(JSON.stringify(s.midiData),before)});
test('Chord companion links Bass and Arrangement while Melody alignment stays preview-only',()=>{const w=load(),p=project();p.midiData.tracks[0].notes=[{id:'m1',pitch:61,startTick:0,durationTicks:240,velocity:80}];const s=w.MusicStudioEditor.createSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,w.MusicStudioEditor),value=w.MusicStudioAIComposition.candidateValues('chord',ctx)[0],before=JSON.stringify(s.midiData),bundle=w.MusicStudioAICandidatePreview.createPreview(s,w.MusicStudioEditor,{candidateId:'A',value},{project:p});assert.equal(bundle.companion.bass.familyId,value.candidateFamily.id);assert.equal(bundle.companion.arrangement.familyId,value.candidateFamily.id);assert.equal(bundle.companion.melodyAlignment.mutates,false);assert.equal(bundle.companion.melodyAlignment.slots[0].sourceNoteIds.includes('m1'),true);assert.equal(JSON.stringify(s.midiData),before)});
test('Section Arrangement and Lyrics companions preserve exact same-family dependencies',()=>{const w=load(),p=project(),s=w.MusicStudioEditor.createSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,w.MusicStudioEditor),section=w.MusicStudioAIComposition.candidateValues('section',ctx)[2],arrangement=w.MusicStudioAIComposition.candidateValues('arrangement',ctx)[2],lyrics=w.MusicStudioAIComposition.candidateValues('lyrics-structure',ctx)[2],sectionBundle=w.MusicStudioAICandidatePreview.createPreview(s,w.MusicStudioEditor,{candidateId:'C',value:section},{project:p}),arrangementBundle=w.MusicStudioAICandidatePreview.createPreview(s,w.MusicStudioEditor,{candidateId:'C',value:arrangement},{project:p}),lyricsBundle=w.MusicStudioAICandidatePreview.createPreview(s,w.MusicStudioEditor,{candidateId:'C',value:lyrics},{project:p});assert.equal(sectionBundle.companion.arrangementCandidateRef.familyId,section.candidateFamily.id);assert.equal(arrangementBundle.companion.sectionCandidateRef.familyId,arrangement.candidateFamily.id);assert.equal(lyricsBundle.companion.phraseSlots.every(slot=>slot.stress.length===slot.syllableCount),true)});
test('stale Track and stale range reject candidate Apply without mutation',()=>{const w=load(),p=project(),s=w.MusicStudioEditor.createSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,w.MusicStudioEditor),value=w.MusicStudioAIComposition.candidateValues('melody',ctx)[0],trackBundle=w.MusicStudioAICandidatePreview.createPreview(s,w.MusicStudioEditor,{candidateId:'A',value},{project:p});s.midiData.tracks=s.midiData.tracks.filter(track=>track.id!=='melody');const afterTrackRemoval=JSON.stringify(s.midiData);assert.throws(()=>w.MusicStudioAICandidatePreview.applyPreview(s,w.MusicStudioEditor,trackBundle),/rejected|stale|track/);assert.equal(JSON.stringify(s.midiData),afterTrackRemoval);const s2=w.MusicStudioEditor.createSession(p),rangeBundle=w.MusicStudioAICandidatePreview.createPreview(s2,w.MusicStudioEditor,{candidateId:'A',value},{project:p});w.MusicStudioEditor.setEditRange(s2,{startMeasure:2,endMeasure:2});const afterRangeChange=JSON.stringify(s2.midiData);assert.throws(()=>w.MusicStudioAICandidatePreview.applyPreview(s2,w.MusicStudioEditor,rangeBundle),/rejected|stale-range/);assert.equal(JSON.stringify(s2.midiData),afterRangeChange)});

test('partial adoption clips generated notes at the exact truncated A bar end',()=>{const w=load(),p=project();p.midiData.timeSignatureMap=[{tick:1000,numerator:3,denominator:8}];const core=w.MusicStudioEditor,s=core.createCoordinatedSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,core),value=w.MusicStudioAIComposition.candidateValues('melody',ctx)[0];value.phraseEvents=[{degree:1,durationUnits:3},{degree:3,durationUnits:2}];const bundle=w.MusicStudioAICandidatePreview.createPreview(s,core,{candidateId:'A',value},{project:p}),before=plain(bundle);w.MusicStudioAICandidatePreview.applyPreview(s,core,bundle,{startMeasure:1,endMeasure:1});assert.ok(core.currentTrack(s).notes.length);assert.equal(core.currentTrack(s).notes.every(n=>n.startTick>=0&&n.startTick+n.durationTicks<=1000),true);assert.deepEqual(plain(bundle),before);core.undo(s);assert.equal(core.currentTrack(s).notes.length,0);core.redo(s);assert.equal(core.currentTrack(s).notes[0].durationTicks,1000)});

test('partial adoption cannot change an existing note outside the selected bar',()=>{const w=load(),p=project();p.midiData.timeSignatureMap=[{tick:1000,numerator:3,denominator:8}];p.midiData.tracks[0].notes=[{id:'crossing',pitch:62,startTick:900,durationTicks:400,velocity:90}];const core=w.MusicStudioEditor,s=core.createCoordinatedSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,core),value=w.MusicStudioAIComposition.candidateValues('melody',ctx)[0],bundle=w.MusicStudioAICandidatePreview.createPreview(s,core,{candidateId:'A',value},{project:p}),before=plain(s);assert.throws(()=>w.MusicStudioAICandidatePreview.applyPreview(s,core,bundle,{startMeasure:1,endMeasure:1}),/selection-boundary/);assert.deepEqual(plain(s),before)});

test('exact partial adoption coexists with legacy locks new ranges and additive release',()=>{const w=load(),p=project();p.midiData.timeSignatureMap=[{tick:1000,numerator:3,denominator:8}];p.midiData.editor.lockedMeasures=[1];const core=w.MusicStudioEditor,locks=w.MusicStudioMeasureLocks,s=core.createCoordinatedSession(p);locks.unlockRange(s,core,{trackId:'melody',startTick:0,endTick:1000});locks.addRangeLock(s,core,{trackId:'melody',startTick:1000,endTick:1720});const before=plain(s.midiData.editor),ctx=w.MusicStudioAIComposition.createContext(p,s,core),value=w.MusicStudioAIComposition.candidateValues('melody',ctx)[0];value.phraseEvents=[{degree:1,durationUnits:3},{degree:3,durationUnits:2}];const bundle=w.MusicStudioAICandidatePreview.createPreview(s,core,{candidateId:'A',value},{project:p});w.MusicStudioAICandidatePreview.applyPreview(s,core,bundle,{startMeasure:1,endMeasure:1});assert.equal(core.currentTrack(s).notes[0].durationTicks,1000);assert.equal(locks.isProtected(s.midiData,core,'melody',{startTick:999,durationTicks:1}),false);assert.equal(locks.isProtected(s.midiData,core,'melody',{startTick:1000,durationTicks:1}),true);assert.deepEqual(plain(s.midiData.editor.measureLocks),before.measureLocks);assert.deepEqual(plain(s.midiData.editor.lockedMeasures),before.lockedMeasures);assert.deepEqual(plain(s.midiData.timeSignatureMap),p.midiData.timeSignatureMap)});

for(const action of ['delete','extend'])test(`partial adoption rejects crossing-note ${action} before touching Undo`,()=>{const w=load(),p=project();p.midiData.timeSignatureMap=[{tick:1000,numerator:3,denominator:8}];p.midiData.tracks[0].notes=[{id:'edge',pitch:62,startTick:900,durationTicks:action==='delete'?400:50,velocity:90}];const core=w.MusicStudioEditor,s=core.createCoordinatedSession(p),ctx=w.MusicStudioAIComposition.createContext(p,s,core),value=w.MusicStudioAIComposition.candidateValues('melody',ctx)[0],bundle=w.MusicStudioAICandidatePreview.createPreview(s,core,{candidateId:'A',value},{project:p}),note=bundle.request.notes.find(n=>n.id==='edge');bundle.result=core.createPartialEditResult(bundle.request,action==='delete'?{deleteNoteIds:['edge']}:{updates:[{...plain(note),durationTicks:400}]});bundle.preview=core.createPartialEditPreview(bundle.request,bundle.result);const before=plain(s);assert.throws(()=>w.MusicStudioAICandidatePreview.applyPreview(s,core,bundle,{startMeasure:1,endMeasure:1}),/selection-boundary/);assert.deepEqual(plain(s),before)});

test('selected model replacement keeps the other 24 bars and accompaniment intact, compares adjacent bars, and undoes as one edit',()=>{
  const w=load(),p=project(),core=w.MusicStudioEditor,composition=w.MusicStudioAIComposition,bridge=w.MusicStudioAICandidatePreview;
  p.midiData.editor={measureCount:32,editRange:{startMeasure:17,endMeasure:24}};
  const note=(id,pitch,startTick,durationTicks)=>({id,pitch,startTick,durationTicks,velocity:90});
  p.midiData.tracks[0].notes=Array.from({length:32},(_,bar)=>note('melody-'+bar,60+bar%7,bar*1920,480));
  p.midiData.tracks[2].notes=Array.from({length:32},(_,bar)=>note('bass-'+bar,36+bar%4,bar*1920,1920));
  const session=core.createCoordinatedSession(p),before=plain(session.midiData);
  const source=composition.remakeSource(session,core,{operation:'replace'});
  assert.deepEqual(plain(composition.replacementPrompt(source,session,core).map(n=>n.pitch)),[61,62,63,64,65,66,60,61]);
  const modelOutput={kind:'melody',variant:'A',range:source.range,summary:'Model output fixture',importedMidi:{
    version:1,ppq:480,notes:Array.from({length:16},(_,i)=>({pitch:67+i%5,startTick:i*960,durationTicks:720,velocity:88}))
  }};
  const value=composition.bindRemake(modelOutput,source,'replace',100);
  const bundle=bridge.createPreview(session,core,{value},{project:p});
  assert.equal(bundle.result.changes.deleteNoteIds.length,8);
  assert.equal(bundle.result.changes.adds.length,16);
  const original=bridge.auditionPlan(session,core,bundle,null,{source:'original'});
  const candidate=bridge.auditionPlan(session,core,bundle);
  assert.equal(candidate.transport.startTick,15*1920);
  assert.equal(candidate.transport.endTick,25*1920);
  assert.equal(original.tracks[0].notes.length,10);
  assert.equal(candidate.tracks[0].notes.length,18);
  assert.deepEqual(plain(session.midiData),before);
  bridge.applyPreview(session,core,bundle);
  const outside=n=>n.startTick<source.range.startTick||n.startTick>=source.range.endTick;
  assert.deepEqual(plain(session.midiData.tracks[0].notes.filter(outside)),before.tracks[0].notes.filter(outside));
  assert.deepEqual(plain(session.midiData.tracks.slice(1)),before.tracks.slice(1));
  assert.equal(session.undo.length,1);
  core.undo(session);
  assert.deepEqual(plain(session.midiData),before);
});

test('model replacement rejects locked originals and notes that cross the selected end',()=>{
  const w=load(),core=w.MusicStudioEditor,compose=w.MusicStudioAIComposition;
  for(const [note,reason] of [
    [{startTick:0,durationTicks:120,locked:true},/固定音符/],
    [{startTick:3800,durationTicks:120},/crosses-range/]
  ]){
    const p=project();
    p.midiData.tracks[0].notes=[{id:'edge',pitch:60,velocity:90,...note}];
    const session=core.createCoordinatedSession(p);
    assert.throws(()=>compose.remakeSource(session,core,{operation:'replace'}),reason);
  }
});

test('replacement follows exact project modulation and chord boundaries without altering MIDI timing',()=>{
  const w=load(),p=project(),core=w.MusicStudioEditor,compose=w.MusicStudioAIComposition;
  p.midiData.timeSignatureMap=[{tick:1000,numerator:3,denominator:8}];
  p.midiData.keySignatureMap=[{tick:600,sharps:-2,minor:false}];
  const session=core.createCoordinatedSession(p),context=compose.createContext(p,session,core);
  const original=plain(session.midiData);
  const notes=[599,600,999,1000].map(startTick=>({pitch:70,startTick,durationTicks:44,velocity:90}));
  const value={importedMidi:{notes}};
  const harmony=compose.replacementHarmony(p,session,core,context.range,'');
  assert.deepEqual(plain(harmony.map(({startTick,key})=>[startTick,key])),[[0,'C'],[600,'Bb']]);
  const fitted=compose.fitReplacementHarmony(value,harmony,[60,84]);
  assert.deepEqual(plain(fitted.importedMidi.notes),notes.map((note,i)=>({...note,pitch:i===0?69:70})));
  const chords=compose.replacementHarmony(p,session,core,context.range,'Csus4 → Dm');
  assert.deepEqual(plain(chords.map(({startTick,chord})=>[startTick,chord])),[[0,'Csus4'],[600,'Csus4'],[1000,'Dm']]);
  assert.deepEqual(plain(compose.fitReplacementHarmony(value,chords,[60,84]).importedMidi.notes.map(n=>n.pitch)),[72,72,72,69]);
  assert.deepEqual(plain(session.midiData),original);
  assert.equal(value.importedMidi.notes[0].pitch,70);
});

test('ensemble replaces two destination tracks in an empty melody section as one edit',()=>{
  const w=load(),p=project(),core=w.MusicStudioEditor,composition=w.MusicStudioAIComposition,bridge=w.MusicStudioAICandidatePreview;
  const note=(id,pitch,startTick,durationTicks=240)=>({id,pitch,startTick,durationTicks,velocity:80});
  p.midiData.editor={measureCount:32,editRange:{startMeasure:17,endMeasure:24}};
  const start=16*1920,end=24*1920;
  p.midiData.tracks[0].notes=[note('previous',67,start-480),note('following',72,end)];
  p.midiData.tracks[2].notes=[note('bass-crossing',36,start-120),note('bass-inside',38,start+480),note('bass-after',36,end)];
  p.midiData.tracks.push({id:'strings',name:'Strings',roleAssignment:'strings',trackType:'midi-melodic',channel:5,program:48,
    notes:[note('strings-inside',64,start+480),{...note('strings-locked',65,start+1920),locked:true},note('strings-after',67,end)]});
  const session=core.createCoordinatedSession(p),before=plain(session.midiData);
  const source=composition.remakeSource(session,core,{operation:'ensemble'});
  assert.equal(source.notes.length,0);
  assert.equal(composition.replacementPrompt(source,session,core)[0].pitch,67);
  const output={kind:'melody',variant:'A',summary:'Model output fixture',range:source.range,importedMidi:{
    version:1,ppq:480,notes:[{pitch:67,startTick:480,durationTicks:240,velocity:80}]
  }};
  const section={name:'chorus',density:'normal',range:source.range,roles:['bass','strings'],targets:{bass:'bass',strings:'strings'}};
  const value=composition.bindEnsemble(output,source,'C Am F G',section);
  const bundle=bridge.createPreview(session,core,{value});
  assert.deepEqual(plain(bundle.result.changes.deleteNoteIds).sort(),['bass-inside','strings-inside']);
  assert.ok(bundle.result.changes.adds.length>2);
  assert.ok(bundle.result.changes.adds.every(n=>n.startTick>=start&&n.startTick+n.durationTicks<=end));
  const selection={startMeasure:17,endMeasure:18,roles:['bass']};
  const scoped=bridge.createPreview(session,core,{value},{measureRange:selection});
  assert.deepEqual(plain(scoped.companion.ensembleDiff.map(row=>row.replacedTrackId)),['bass']);
  assert.deepEqual(plain(scoped.result.changes.deleteNoteIds),['bass-inside']);
  assert.ok(scoped.result.changes.adds.every(n=>n.startTick+n.durationTicks<=start+3840));
  assert.deepEqual(plain(session.midiData),before);
  bridge.applyPreview(session,core,bundle);
  assert.equal(session.midiData.tracks.length,before.tracks.length);
  for(const id of ['melody','drums'])assert.deepEqual(plain(core.getTrackById(session.midiData.tracks,id)),core.getTrackById(before.tracks,id));
  for(const id of ['bass','strings']){
    const beforeTrack=core.getTrackById(before.tracks,id),afterTrack=core.getTrackById(session.midiData.tracks,id);
    for(const original of beforeTrack.notes.filter(n=>n.startTick<start||n.startTick>=end||n.locked)){
      assert.deepEqual(plain(afterTrack.notes.find(n=>n.id===original.id)),original);
    }
  }
  assert.equal(session.undo.length,1);
  core.undo(session);
  assert.deepEqual(plain(session.midiData),before);
});
