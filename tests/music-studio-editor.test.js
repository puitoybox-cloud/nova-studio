const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(){
  const window={crypto:{randomUUID:(()=>{let value=0;return()=>`id-${++value}`})()}};
  window.window=window;window.globalThis=window;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);
  return window.MusicStudioEditor;
}
function project(){return{projectId:'p1',musicalSettings:{bpm:128,timeSignature:{numerator:4,denominator:4}},midiData:{version:1,ppq:480,tempoMap:[{tick:0,bpm:128}],tracks:[{id:'lead',name:'Lead',channel:1,notes:[{id:'n1',pitch:60,startTick:0,durationTicks:480,velocity:90,releaseVelocity:12}]},{id:'low',name:'Bass',channel:2,notes:[{id:'b1',pitch:36,startTick:0,durationTicks:960,velocity:80}]}]}}}

test('normalizes existing MIDI without dropping metadata or note extensions',()=>{
  const core=load(),data=core.normalizeMidiData(project().midiData,project());
  assert.equal(data.ppq,480);
  assert.equal(data.tempoMap[0].bpm,128);
  assert.equal(data.tracks.find(track=>track.part==='melody').notes[0].releaseVelocity,12);
  assert.equal(JSON.stringify(data.tracks.slice(0,3).map(track=>track.part)),JSON.stringify(['melody','drums','bass']));
});
test('old project without MIDI opens as optional blank three-part session',()=>{
  const core=load(),session=core.createSession({projectId:'old',musicalSettings:{bpm:100,timeSignature:{numerator:3,denominator:4}}});
  assert.equal(session.midiData.tracks.length,3);
  assert.equal(session.midiData.tempo,100);
  assert.equal(session.midiData.editor.transport.countInEnabled,true);
  assert.equal(session.midiData.editor.transport.metronomeEnabled,true);
  assert.equal(session.dirty,false);
});

test('default Melody Drums and Bass tracks lock the Version 1 track contract',()=>{
  const core=load(),data=core.normalizeMidiData({},{}),tracks=Object.fromEntries(data.tracks.slice(0,3).map(track=>[track.part,track]));
  assert.deepEqual(JSON.parse(JSON.stringify(Object.keys(tracks))),['melody','drums','bass']);
  assert.deepEqual(JSON.parse(JSON.stringify(tracks.melody)),{id:'melody',part:'melody',name:'Melody',channel:1,program:0,muted:false,notes:[]});
  assert.deepEqual(JSON.parse(JSON.stringify(tracks.drums)),{id:'drums',part:'drums',name:'Drums',channel:10,program:null,muted:false,notes:[]});
  assert.deepEqual(JSON.parse(JSON.stringify(tracks.bass)),{id:'bass',part:'bass',name:'Bass',channel:2,program:32,muted:false,notes:[]});
});

test('legacy partial tracks normalize missing fields without changing existing notes',()=>{
  const core=load(),melodyNote={id:'legacy-m',pitch:67,startTick:123,durationTicks:456,velocity:78,releaseVelocity:9},drumNote={id:'legacy-d',pitch:38,startTick:480,durationTicks:120,velocity:111},bassNote={id:'legacy-b',pitch:40,startTick:960,durationTicks:720,velocity:82};
  const cases=[
    {tracks:[{part:'melody',notes:[melodyNote]}]},
    {tracks:[{id:'melody',notes:[melodyNote]},{id:'drums',notes:[drumNote]}]},
    {tracks:[{name:'Bass',notes:[bassNote]},{name:'Melody',notes:[melodyNote]}]},
    {tracks:[{name:'Melody',notes:[melodyNote]},{channel:10,notes:[drumNote]},{program:32,notes:[bassNote]}]},
    {tracks:[{part:'melody',notes:[melodyNote]},{part:'drums'},{part:'bass'}]}
  ];
  for(const midiData of cases){
    const data=core.normalizeMidiData(midiData,{}),melody=data.tracks.find(track=>track.part==='melody'),drums=data.tracks.find(track=>track.part==='drums'),bass=data.tracks.find(track=>track.part==='bass');
    assert.ok(melody);assert.ok(drums);assert.ok(bass);
    for(const track of [melody,drums,bass]){assert.equal(typeof track.muted,'boolean');assert.ok(Array.isArray(track.notes))}
    assert.equal(drums.channel,10);assert.equal(drums.program,null);assert.equal(bass.channel,2);assert.equal(bass.program,32);
    const sourceNotes=midiData.tracks.flatMap(track=>track.notes||[]);
    for(const note of sourceNotes){const normalized=data.tracks.flatMap(track=>track.notes).find(item=>item.id===note.id);assert.ok(normalized);for(const key of ['pitch','startTick','durationTicks','velocity'])assert.equal(normalized[key],note[key]);if(note.releaseVelocity!=null)assert.equal(normalized.releaseVelocity,note.releaseVelocity)}
  }
});

test('explicit part and canonical id win while ambiguous tracks remain additional tracks',()=>{
  const core=load(),data=core.normalizeMidiData({tracks:[
    {id:'bass',name:'Unlabeled',notes:[]},
    {id:'custom',part:'melody',channel:10,notes:[]},
    {id:'unknown',name:'Strings',channel:3,program:48,notes:[{id:'kept',pitch:72,startTick:0,durationTicks:480,velocity:90}]}
  ]},{});
  assert.equal(data.tracks.find(track=>track.part==='bass').id,'bass');
  assert.equal(data.tracks.find(track=>track.part==='melody').id,'custom');
  const additional=data.tracks.find(track=>track.id==='unknown');assert.ok(additional);assert.equal(additional.part,undefined);assert.equal(additional.notes[0].id,'kept');
});

test('an unknown first track stays additional with all track and note metadata',()=>{
  const core=load(),unknown={id:'unknown',name:'Strings',channel:3,program:48,muted:true,trackMetadata:{source:'legacy'},notes:[{id:'unknown-note',pitch:72,startTick:123,durationTicks:456,velocity:78,noteMetadata:{articulation:'legato'}}]},data=core.normalizeMidiData({tracks:[unknown]},{}),additional=data.tracks.find(track=>track.id==='unknown');
  assert.ok(additional);assert.equal(additional.part,undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(additional)),unknown);
  assert.deepEqual(JSON.parse(JSON.stringify(data.tracks.slice(0,3).map(track=>track.part))),['melody','drums','bass']);
});

test('legacy Melody names remain recognizable without relying on track index',()=>{
  const core=load(),note={id:'legacy-piano-note',pitch:62,startTick:239,durationTicks:481,velocity:87,releaseVelocity:11},data=core.normalizeMidiData({tracks:[{id:'unknown-first',name:'Strings',channel:3,program:48,notes:[]},{name:'Imported Piano',channel:1,notes:[note]}]},{}),melody=data.tracks.find(track=>track.part==='melody');
  assert.equal(melody.name,'Imported Piano');assert.equal(melody.channel,1);assert.equal(melody.program,0);
  assert.deepEqual(JSON.parse(JSON.stringify(melody.notes[0])),note);
});

test('nonstandard order identifies canonical parts and leaves Unknown untouched',()=>{
  const core=load(),unknown={id:'unknown-order',name:'Strings',channel:3,program:48,notes:[{id:'u',pitch:74,startTick:12,durationTicks:34,velocity:56,custom:true}]},data=core.normalizeMidiData({tracks:[unknown,{name:'Drums',channel:10,notes:[]},{name:'Bass',channel:2,program:32,notes:[]},{name:'Melody',channel:1,program:0,notes:[]}]},{});
  assert.deepEqual(JSON.parse(JSON.stringify(data.tracks.slice(0,3).map(track=>track.part))),['melody','drums','bass']);
  assert.equal(data.tracks.find(track=>track.id==='unknown-order').part,undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(data.tracks.find(track=>track.id==='unknown-order'))),unknown);
});

test('transport preferences preserve explicit OFF values while legacy data defaults both ON',()=>{
  const core=load(),legacy=core.normalizeMidiData({},{}),saved=core.normalizeMidiData({editor:{transport:{countInEnabled:false,metronomeEnabled:false}}},{});
  assert.deepEqual(JSON.parse(JSON.stringify(legacy.editor.transport)),{countInEnabled:true,metronomeEnabled:true});
  assert.equal(saved.editor.transport.countInEnabled,false);assert.equal(saved.editor.transport.metronomeEnabled,false);
});
test('editor view preserves Snap ON OFF and Grid while legacy projects safely default to ON and 1/16',()=>{
  const core=load(),legacy=core.createSession({projectId:'legacy-snap'}),off=core.createSession({projectId:'snap-off',midiData:{editor:{view:{snapEnabled:false,snap:'1/4'}}}}),on=core.createSession({projectId:'snap-on',midiData:{editor:{view:{snapEnabled:true,snap:'1/16'}}}});
  assert.equal(legacy.view.snapEnabled,true);assert.equal(legacy.view.snap,'1/16');
  assert.equal(off.view.snapEnabled,false);assert.equal(off.view.snap,'1/4');
  assert.equal(on.view.snapEnabled,true);assert.equal(on.view.snap,'1/16');
});
test('loop range is backward-compatible persisted editor state independent from bar selection',()=>{
  const editor=load(),legacy=editor.createSession({projectId:'legacy'});
  assert.equal(legacy.midiData.editor.loopEnabled,false);assert.equal(legacy.midiData.editor.loopStart,null);assert.equal(legacy.midiData.editor.loopEnd,null);
  editor.toggleMeasure(legacy,2);editor.setLoopRange(legacy,240,1680,true);
  assert.deepEqual(Array.from(legacy.selectedMeasures),[2]);assert.equal(legacy.midiData.editor.loopEnabled,true);assert.equal(legacy.midiData.editor.loopStart,240);assert.equal(legacy.midiData.editor.loopEnd,1680);
  const restored=editor.createSession({projectId:'restored',midiData:legacy.midiData});
  assert.equal(restored.midiData.editor.loopEnabled,true);assert.equal(restored.midiData.editor.loopStart,240);assert.equal(restored.midiData.editor.loopEnd,1680);assert.deepEqual(Array.from(restored.selectedMeasures),[2]);
  editor.setLoopEnabled(restored,false);assert.equal(restored.midiData.editor.loopEnabled,false);assert.equal(restored.midiData.editor.loopStart,240);assert.equal(restored.midiData.editor.loopEnd,1680);
  editor.setLoopRange(restored,null,null,false);assert.equal(restored.midiData.editor.loopStart,null);assert.equal(restored.midiData.editor.loopEnd,null);
});
test('empty timeline measures persist as undoable editor metadata',()=>{
  const core=load(),session=core.createSession(project());
  assert.equal(session.midiData.editor.measureCount,4);
  core.extendTimelineMeasures(session,4);
  assert.equal(session.midiData.editor.measureCount,8);
  assert.equal(session.dirty,true);
  core.undo(session);
  assert.equal(session.midiData.editor.measureCount,4);
  core.redo(session);
  assert.equal(session.midiData.editor.measureCount,8);
  const imported=core.normalizeMidiData({...project().midiData,totalTick:15360},project());
  assert.equal(imported.editor.measureCount,8);
});
test('timeline removal subtracts one empty measure and supports Undo Redo',()=>{
  const core=load(),session=core.createSession({projectId:'remove-empty',midiData:{editor:{measureCount:16},tracks:[{part:'melody',notes:[]}]}});
  for(const [measureCount,totalTick] of [[15,28800],[14,26880],[13,24960],[12,23040]]){const result=core.removeTimelineMeasures(session);assert.equal(result.ok,true);assert.equal(result.removed,1);assert.equal(result.measureCount,measureCount);assert.equal(session.midiData.totalTick,totalTick)}
  core.undo(session);assert.equal(session.midiData.editor.measureCount,13);assert.equal(session.midiData.totalTick,24960);
  core.undo(session);assert.equal(session.midiData.editor.measureCount,14);core.redo(session);assert.equal(session.midiData.editor.measureCount,13);
  core.extendTimelineMeasures(session,4);assert.equal(session.midiData.editor.measureCount,17);assert.equal(session.midiData.totalTick,32640);
  for(let count=16;count>=13;count--){assert.equal(core.removeTimelineMeasures(session).ok,true);assert.equal(session.midiData.editor.measureCount,count)}
});
test('timeline removal preserves boundary notes and rejects crossing notes in every track',()=>{
  const core=load(),boundary=28800,session=core.createSession({projectId:'remove-notes',midiData:{ppq:480,timeSignature:{numerator:4,denominator:4},editor:{measureCount:16},tracks:[
    {part:'melody',notes:[{id:'before',pitch:60,startTick:boundary-120,durationTicks:120,velocity:90}]},
    {part:'drums',channel:10,notes:[{id:'crossing',pitch:36,startTick:boundary-60,durationTicks:120,velocity:100}]},
    {part:'bass',notes:[{id:'after',pitch:36,startTick:boundary,durationTicks:240,velocity:80}]}
  ]}}),before=JSON.stringify(session.midiData.tracks);
  const blocked=core.removeTimelineMeasures(session);assert.equal(blocked.ok,false);assert.equal(blocked.reason,'notes');assert.deepEqual(Array.from(blocked.blocking,note=>note.noteId),['crossing','after']);assert.equal(session.midiData.editor.measureCount,16);assert.equal(JSON.stringify(session.midiData.tracks),before);assert.equal(session.undo.length,0);
  session.midiData.tracks.find(track=>track.part==='drums').notes=[];session.midiData.tracks.find(track=>track.part==='bass').notes=[];
  const removed=core.removeTimelineMeasures(session);assert.equal(removed.ok,true);assert.equal(session.midiData.editor.measureCount,15);assert.equal(session.midiData.tracks.find(track=>track.part==='melody').notes[0].id,'before');
});
test('timeline removal enforces four-measure minimum and clamps Playhead Loop and measure state',()=>{
  const core=load(),session=core.createSession({projectId:'remove-bounds',midiData:{editor:{measureCount:5,loopEnabled:true,loopStart:7000,loopEnd:9000,parts:{melody:{selectedMeasures:[2,5],lockedMeasures:[3,5]}}},tracks:[{part:'melody',notes:[]}]}});
  session.playheadTick=10000;session.selectedMeasures=[2,5];session.lockedMeasures=[3,5];
  const result=core.removeTimelineMeasures(session);assert.equal(result.ok,true);assert.equal(result.totalTicks,7680);assert.equal(session.playheadTick,7680);assert.equal(session.midiData.editor.loopStart,7000);assert.equal(session.midiData.editor.loopEnd,7680);assert.equal(session.midiData.editor.loopEnabled,true);assert.deepEqual(Array.from(session.selectedMeasures),[2]);assert.deepEqual(Array.from(session.lockedMeasures),[3]);
  const minimum=core.removeTimelineMeasures(session);assert.equal(minimum.ok,false);assert.equal(minimum.reason,'minimum');assert.equal(session.midiData.editor.measureCount,4);
  core.undo(session);assert.equal(session.midiData.editor.measureCount,5);assert.equal(session.playheadTick,10000);assert.equal(session.midiData.editor.loopEnd,9000);
});
test('one-measure removal derives ticks from PPQ and time signature',()=>{const core=load();for(const [signature,expected] of [[{numerator:3,denominator:4},7200],[{numerator:6,denominator:8},7200]]){const session=core.createSession({midiData:{ppq:480,timeSignature:signature,editor:{measureCount:6},tracks:[{part:'melody',notes:[]}]}}),result=core.removeTimelineMeasures(session);assert.equal(result.ok,true);assert.equal(result.measureCount,5);assert.equal(result.totalTicks,expected)}});
test('add, update and delete notes are undoable and redoable',()=>{
  const core=load(),session=core.createSession(project());
  core.addNote(session,{pitch:64,startTick:480,durationTicks:240,velocity:100});
  const id=session.selectedNoteId;
  core.updateNote(session,id,{pitch:65,startTick:720,durationTicks:120,velocity:70});
  assert.equal(core.currentTrack(session).notes.find(note=>note.id===id).pitch,65);
  core.deleteSelected(session);
  assert.equal(core.currentTrack(session).notes.some(note=>note.id===id),false);
  core.undo(session);
  assert.equal(core.currentTrack(session).notes.some(note=>note.id===id),true);
  core.redo(session);
  assert.equal(core.currentTrack(session).notes.some(note=>note.id===id),false);
});
test('copy and paste offsets a new note by one beat',()=>{
  const core=load(),session=core.createSession(project());
  core.selectNote(session,'n1');core.copy(session);core.paste(session);
  const pasted=core.currentTrack(session).notes.find(note=>note.id===session.selectedNoteId);
  assert.equal(pasted.startTick,480);
  assert.notEqual(pasted.id,'n1');
});
test('paste targets the playhead while preserving relative note spacing and Undo Redo',()=>{
  const source=project();source.midiData.tracks[0].notes.push({id:'n2',pitch:64,startTick:240,durationTicks:240,velocity:76});
  const core=load(),session=core.createSession(source),before=core.currentTrack(session).notes.length;
  core.selectAllNotes(session);core.copy(session);core.paste(session,1920);
  const pasted=core.selectedNotes(session);
  assert.deepEqual(Array.from(pasted,note=>note.startTick),[1920,2160]);
  assert.equal(core.currentTrack(session).notes.length,before+2);
  core.undo(session);assert.equal(core.currentTrack(session).notes.length,before);
  core.redo(session);assert.equal(core.currentTrack(session).notes.length,before+2);
});
test('duplicate places selected notes immediately after their block as one undoable edit',()=>{
  const source=project();source.midiData.tracks[0].notes.push({id:'n2',pitch:64,startTick:240,durationTicks:240,velocity:76});
  const core=load(),session=core.createSession(source),before=core.currentTrack(session).notes.length;
  core.selectAllNotes(session);core.duplicateSelected(session);
  assert.deepEqual(Array.from(core.selectedNotes(session),note=>note.startTick),[480,720]);
  assert.equal(core.currentTrack(session).notes.length,before+2);
  core.undo(session);assert.equal(core.currentTrack(session).notes.length,before);
  core.redo(session);assert.equal(core.currentTrack(session).notes.length,before+2);
});
test('multiple selected notes copy and paste together as one undoable edit',()=>{
  const source=project();source.midiData.tracks[0].notes.push({id:'n2',pitch:64,startTick:240,durationTicks:240,velocity:76});
  const core=load(),session=core.createSession(source),before=core.currentTrack(session).notes.length;
  core.selectNote(session,'n1');core.selectNote(session,'n2',{toggle:true});core.copy(session);
  assert.equal(session.clipboard.length,2);
  core.paste(session);
  assert.equal(core.currentTrack(session).notes.length,before+2);
  assert.equal(core.selectedNotes(session).length,2);
  assert.deepEqual(Array.from(core.selectedNotes(session),note=>note.startTick),[480,720]);
  core.undo(session);assert.equal(core.currentTrack(session).notes.length,before);
  core.redo(session);assert.equal(core.currentTrack(session).notes.length,before+2);
});
test('normal note selection collapses an existing multi-selection to the clicked note',()=>{
  const source=project();source.midiData.tracks[0].notes.push({id:'n2',pitch:64,startTick:240,durationTicks:240,velocity:76});
  const core=load(),session=core.createSession(source);
  core.selectNote(session,'n1');core.selectNote(session,'n2',{toggle:true});
  assert.deepEqual(Array.from(core.selectedIds(session)),['n1','n2']);
  core.selectNote(session,'n1');
  assert.deepEqual(Array.from(core.selectedIds(session)),['n1']);
  assert.equal(session.selectedNoteId,'n1');
});
test('multiple notes move resize change velocity and delete as single history steps',()=>{
  const source=project();source.midiData.tracks[0].notes.push({id:'n2',pitch:64,startTick:480,durationTicks:240,velocity:76});
  const core=load(),session=core.createSession(source);
  core.selectAllNotes(session);
  core.moveSelected(session,120,2);
  assert.deepEqual(Array.from(core.currentTrack(session).notes,note=>[note.startTick,note.pitch]),[[120,62],[600,66]]);
  core.resizeSelected(session,120);assert.deepEqual(Array.from(core.currentTrack(session).notes,note=>note.durationTicks),[600,360]);
  core.setSelectedVelocity(session,55);assert.deepEqual(Array.from(core.currentTrack(session).notes,note=>note.velocity),[55,55]);
  core.deleteSelected(session);assert.equal(core.currentTrack(session).notes.length,0);
  core.undo(session);assert.equal(core.currentTrack(session).notes.length,2);
  core.undo(session);assert.deepEqual(Array.from(core.currentTrack(session).notes,note=>note.velocity),[90,76]);
});
test('selected notes can match the representative duration and velocity with Undo and Redo',()=>{
  const core=load(),session=core.createSession(project()),track=core.currentTrack(session);
  track.notes=[
    {id:'first',pitch:60,startTick:0,durationTicks:120,velocity:42},
    {id:'representative',pitch:64,startTick:480,durationTicks:360,velocity:108}
  ];
  core.selectNote(session,'first');
  core.selectNote(session,'representative',{additive:true});
  core.matchSelectedDuration(session);
  assert.equal(JSON.stringify(track.notes.map(note=>note.durationTicks)),'[360,360]');
  core.matchSelectedVelocity(session);
  assert.equal(JSON.stringify(track.notes.map(note=>note.velocity)),'[108,108]');
  core.undo(session);
  assert.equal(JSON.stringify(core.currentTrack(session).notes.map(note=>note.velocity)),'[42,108]');
  core.undo(session);
  assert.equal(JSON.stringify(core.currentTrack(session).notes.map(note=>note.durationTicks)),'[120,360]');
  core.redo(session);core.redo(session);
  assert.equal(JSON.stringify(core.currentTrack(session).notes.map(note=>[note.durationTicks,note.velocity])),'[[360,108],[360,108]]');
});
test('multi-note moves clamp safely without dropping note extension metadata',()=>{
  const core=load(),session=core.createSession(project());
  core.selectNote(session,'n1');core.moveSelected(session,-999,-999);
  const note=core.currentTrack(session).notes[0];
  assert.equal(note.startTick,0);assert.equal(note.pitch,0);assert.equal(note.releaseVelocity,12);
});
test('measure selection and measure/beat calculation use PPQ and signature',()=>{
  const core=load(),session=core.createSession(project());
  core.toggleMeasure(session,2);
  assert.equal(JSON.stringify(session.selectedMeasures),'[2]');
  assert.equal(JSON.stringify(session.midiData.editor.selectedMeasures),'[2]');
  assert.equal(core.position({startTick:2400},session.midiData).measure,2);
  assert.equal(core.position({startTick:2400},session.midiData).beat,2);
});
test('Melody, Drums and Bass share the same note operations',()=>{
  const core=load(),session=core.createSession(project());
  for(const part of ['melody','drums','bass']){core.selectPart(session,part);core.addNote(session);assert.equal(core.currentTrack(session).notes.length>0,true)}
  assert.equal(session.midiData.tracks.find(track=>track.part==='drums').channel,10);
});
test('multi-select movement copy paste and delete stay isolated in Melody Drums and Bass',()=>{
  const core=load(),session=core.createSession(project());
  for(const part of ['melody','drums','bass']){
    core.selectPart(session,part);const otherTracks=JSON.stringify(session.midiData.tracks.filter(track=>track.part!==part));
    core.addNotes(session,[{pitch:40,startTick:960},{pitch:43,startTick:1440}]);core.selectAllNotes(session);
    const count=core.currentTrack(session).notes.length;core.moveSelected(session,120,1);core.copy(session);core.paste(session);
    assert.equal(core.currentTrack(session).notes.length,count*2);
    core.deleteSelected(session);assert.equal(core.currentTrack(session).notes.length,count);
    assert.equal(JSON.stringify(session.midiData.tracks.filter(track=>track.part!==part)),otherTracks);
    core.undo(session);assert.equal(core.currentTrack(session).notes.length,count*2);
  }
});
test('Drums common editing preserves performance data and the channel 10 track contract',()=>{
  const core=load(),session=core.createSession(project());core.selectPart(session,'drums');const track=()=>core.currentTrack(session);
  core.addNotes(session,[{id:'kick',pitch:36,startTick:119,durationTicks:121,velocity:110},{id:'snare',pitch:38,startTick:601,durationTicks:122,velocity:99}]);
  core.selectNote(session,'kick');core.selectNote(session,'snare',{additive:true});assert.equal(JSON.stringify(core.selectedIds(session)),'["kick","snare"]');
  core.copy(session);session.playheadTick=960;core.paste(session);assert.equal(track().notes.length,4);core.undo(session);assert.equal(track().notes.length,2);core.redo(session);assert.equal(track().notes.length,4);
  core.selectNote(session,'kick');core.duplicateSelected(session);assert.equal(track().notes.length,5);core.undo(session);assert.equal(track().notes.length,4);
  core.selectNote(session,'kick');const quantized=core.quantizeSelectedStarts(session,'1/16');assert.equal(quantized.ok,true);assert.equal(track().notes.find(note=>note.id==='kick').startTick,120);
  core.setSelectedVelocity(session,77);const edited=core.selectedNotes(session)[0];assert.deepEqual([edited.pitch,edited.startTick,edited.durationTicks,edited.velocity],[36,120,121,77]);
  core.extendTimelineMeasures(session,4);assert.equal(session.midiData.editor.measureCount,8);core.removeTimelineMeasures(session,1);assert.equal(session.midiData.editor.measureCount,7);
  core.deleteSelected(session);assert.equal(track().notes.some(note=>note.id==='kick'),false);core.undo(session);assert.equal(track().notes.some(note=>note.id==='kick'),true);
  assert.equal(track().channel,10);assert.equal(track().program,null);
  const before=JSON.stringify(track().notes);assert.equal(core.previewCorrection(session).ok,false);assert.equal(core.previewTranspose(session).ok,false);assert.equal(core.previewNoteLength(session).ok,false);assert.equal(JSON.stringify(track().notes),before);
});
test('Bass common editing preserves metadata performance data and the channel 2 program 32 contract',()=>{
  const core=load(),session=core.createSession(project());core.selectPart(session,'bass');const track=()=>core.currentTrack(session);track().notes=[];
  core.addNotes(session,[{id:'bass-low',pitch:28,startTick:119,durationTicks:481,velocity:82,noteMetadata:{articulation:'fingered'}},{id:'bass-high',pitch:40,startTick:601,durationTicks:959,velocity:96,noteMetadata:{articulation:'accent'}}]);
  core.selectNote(session,'bass-low');core.selectNote(session,'bass-high',{additive:true});assert.equal(JSON.stringify(core.selectedIds(session)),'["bass-low","bass-high"]');
  core.copy(session);session.playheadTick=1920;core.paste(session);assert.equal(track().notes.length,4);core.undo(session);assert.equal(track().notes.length,2);core.redo(session);assert.equal(track().notes.length,4);
  core.selectNote(session,'bass-low');core.duplicateSelected(session);assert.equal(track().notes.length,5);core.undo(session);assert.equal(track().notes.length,4);
  core.selectNote(session,'bass-low');assert.equal(core.quantizeSelectedStarts(session,'1/16').ok,true);core.setSelectedVelocity(session,77);const edited=core.selectedNotes(session)[0];assert.deepEqual([edited.pitch,edited.startTick,edited.durationTicks,edited.velocity],[28,120,481,77]);assert.deepEqual(JSON.parse(JSON.stringify(edited.noteMetadata)),{articulation:'fingered'});
  core.extendTimelineMeasures(session,4);core.removeTimelineMeasures(session,1);assert.equal(session.midiData.editor.measureCount,7);core.deleteSelected(session);assert.equal(track().notes.some(note=>note.id==='bass-low'),false);core.undo(session);assert.equal(track().notes.some(note=>note.id==='bass-low'),true);
  assert.equal(track().channel,2);assert.equal(track().program,32);const before=JSON.stringify(track().notes);assert.equal(core.previewCorrection(session).ok,false);assert.equal(core.previewTranspose(session).ok,false);assert.equal(core.previewNoteLength(session).ok,false);assert.equal(JSON.stringify(track().notes),before);
  const candidate=core.setCandidate(session,'bass','alternate');assert.equal(candidate.context.melodyNoteCount,1);assert.ok(candidate.notes.every(note=>note.velocity===88&&note.durationTicks>0));core.applyCandidate(session,'bass');assert.equal(track().notes.length,candidate.notes.length);core.undo(session);assert.equal(JSON.stringify(track().notes),before);
});
test('selected melody measures can be locked and unlocked without changing notes',()=>{
  const core=load(),session=core.createSession(project()),before=JSON.stringify(core.currentTrack(session).notes);
  core.setSelectedMeasures(session,[2,3]);core.toggleLockSelected(session);
  assert.equal(JSON.stringify(session.lockedMeasures),'[2,3]');
  assert.equal(JSON.stringify(session.midiData.editor.lockedMeasures),'[2,3]');
  assert.equal(JSON.stringify(core.currentTrack(session).notes),before);
  core.toggleLockSelected(session);
  assert.equal(JSON.stringify(session.lockedMeasures),'[]');
});
test('regeneration preparation excludes locked measures and never rewrites melody',()=>{
  const core=load(),session=core.createSession(project()),before=JSON.stringify(core.currentTrack(session).notes);
  core.setSelectedMeasures(session,[1,2,3]);core.toggleLockSelected(session);
  core.setSelectedMeasures(session,[2,3,4]);
  const result=core.prepareRegeneration(session,'2026-07-25T00:00:00.000Z');
  assert.equal(result.ok,true);
  assert.equal(JSON.stringify(result.request.targetMeasures),'[4]');
  assert.equal(result.request.status,'prepared');
  assert.equal(JSON.stringify(core.currentTrack(session).notes),before);
});
test('regeneration preparation refuses an all-locked range',()=>{
  const core=load(),session=core.createSession(project());
  core.setSelectedMeasures(session,[1]);core.toggleLockSelected(session);
  const result=core.prepareRegeneration(session);
  assert.equal(result.ok,false);
  assert.match(result.reason,/固定/);
});
test('measure selection and locks remain independent for all three parts',()=>{
  const core=load(),session=core.createSession(project());
  core.setSelectedMeasures(session,[2]);core.toggleLockSelected(session);
  core.selectPart(session,'drums');core.setSelectedMeasures(session,[3,4]);core.toggleLockSelected(session);
  core.selectPart(session,'bass');core.setSelectedMeasures(session,[5]);
  core.selectPart(session,'melody');
  assert.equal(JSON.stringify(session.selectedMeasures),'[2]');
  assert.equal(JSON.stringify(session.lockedMeasures),'[2]');
  core.selectPart(session,'drums');
  assert.equal(JSON.stringify(session.selectedMeasures),'[3,4]');
  assert.equal(JSON.stringify(session.lockedMeasures),'[3,4]');
  assert.equal(JSON.stringify(session.midiData.editor.parts.bass.selectedMeasures),'[5]');
});
test('drum candidates preview safely and apply only to the Drums channel 10 track',()=>{
  const core=load(),session=core.createSession(project()),melodyBefore=JSON.stringify(session.midiData.tracks.find(track=>track.part==='melody').notes);
  core.selectPart(session,'drums');core.addNote(session,{pitch:46,startTick:0});
  const before=JSON.stringify(core.currentTrack(session).notes),candidate=core.setCandidate(session,'drums','basic');
  assert.ok(candidate.notes.length>0);
  assert.equal(JSON.stringify(core.currentTrack(session).notes),before);
  core.applyCandidate(session,'drums');
  assert.equal(core.currentTrack(session).channel,10);
  assert.equal(core.currentTrack(session).notes.length,candidate.notes.length);
  assert.equal(JSON.stringify(session.midiData.tracks.find(track=>track.part==='melody').notes),melodyBefore);
});
test('bass candidate receives Melody and chord context before explicit adoption',()=>{
  const core=load(),source=project();source.chordProgressions=[{measure:1,chord:'C'}];
  const session=core.createSession(source);core.selectPart(session,'bass');
  const before=JSON.stringify(core.currentTrack(session).notes),candidate=core.setCandidate(session,'bass','root');
  assert.equal(candidate.context.melodyNoteCount,1);
  assert.equal(candidate.context.chordProgressionCount,1);
  assert.equal(JSON.stringify(core.currentTrack(session).notes),before);
  core.applyCandidate(session,'bass');
  assert.equal(core.currentTrack(session).channel,2);
  assert.ok(core.currentTrack(session).notes.length>0);
});
test('Drums and Bass regeneration requests use each part fixed range without rewriting notes',()=>{
  const core=load(),session=core.createSession(project());
  for(const part of ['drums','bass']){
    core.selectPart(session,part);core.setSelectedMeasures(session,[1]);core.toggleLockSelected(session);core.setSelectedMeasures(session,[1,2]);
    const before=JSON.stringify(core.currentTrack(session).notes),result=core.prepareRegeneration(session,'2026-07-25T00:00:00.000Z');
    assert.equal(result.ok,true);
    assert.equal(result.request.part,part);
    assert.equal(JSON.stringify(result.request.targetMeasures),'[2]');
    assert.equal(JSON.stringify(core.currentTrack(session).notes),before);
  }
});
test('recorded notes are added to the shared Melody model as one undoable change',()=>{
  const core=load(),session=core.createSession(project()),before=core.currentTrack(session).notes.length;
  core.addNotes(session,[{pitch:67,startTick:17,durationTicks:231,velocity:94,inputChannel:3,inputMethod:'midi-keyboard'}]);
  const note=core.currentTrack(session).notes.at(-1);
  assert.equal(note.pitch,67);assert.equal(note.velocity,94);assert.equal(note.inputChannel,3);
  core.undo(session);assert.equal(core.currentTrack(session).notes.length,before);
  core.redo(session);assert.equal(core.currentTrack(session).notes.length,before+1);
});
test('correction preview is non-destructive, cancel restores Original, and Apply supports Undo Redo',()=>{
  const core=load(),session=core.createSession(project()),track=core.currentTrack(session);
  track.notes=[{id:'human',pitch:64,startTick:119,durationTicks:251,velocity:88}];
  const original=JSON.stringify(track.notes),result=core.previewCorrection(session,'1/16',true);
  assert.equal(result.ok,true);assert.equal(JSON.stringify(core.currentTrack(session).notes),original);
  assert.equal(result.preview.correctedNotes[0].startTick,120);assert.equal(result.preview.correctedNotes[0].durationTicks,240);
  core.cancelCorrection(session);assert.equal(session.correctionPreview,null);assert.equal(JSON.stringify(core.currentTrack(session).notes),original);
  core.previewCorrection(session,'1/16',true);core.applyCorrection(session);
  assert.equal(core.currentTrack(session).notes[0].durationTicks,240);
  core.undo(session);assert.equal(JSON.stringify(core.currentTrack(session).notes),original);
  core.redo(session);assert.equal(core.currentTrack(session).notes[0].startTick,120);
});
test('Melody Correction targets selected notes and measures with key scale quantize strength and swing',()=>{
  const core=load(),session=core.createSession({projectId:'correction-options',midiData:{ppq:480,timeSignature:{numerator:4,denominator:4},tracks:[{part:'melody',notes:[
    {id:'selected',pitch:61,startTick:119,durationTicks:251,velocity:90},
    {id:'same-measure',pitch:66,startTick:480,durationTicks:240,velocity:90},
    {id:'measure-two',pitch:70,startTick:2041,durationTicks:240,velocity:90}
  ]}]}});
  const original=JSON.stringify(core.currentTrack(session).notes);
  core.selectNote(session,'selected');
  let result=core.previewCorrection(session,{key:'C',scale:'Major',quantize:'1/16',strength:100,swing:0,target:'selected',measureFrom:1,measureTo:1});
  assert.equal(result.ok,true);assert.equal(JSON.stringify(result.preview.targetNoteIds),'["selected"]');
  let corrected=result.preview.correctedNotes;
  assert.equal(JSON.stringify(corrected.map(note=>[note.id,note.pitch,note.startTick])),'[["selected",60,120],["same-measure",66,480],["measure-two",70,2041]]');
  assert.equal(JSON.stringify(core.currentTrack(session).notes),original);
  core.cancelCorrection(session);assert.equal(JSON.stringify(core.currentTrack(session).notes),original);
  result=core.previewCorrection(session,{key:'C',scale:'Chromatic',quantize:'1/16',strength:100,swing:100,target:'measures',measureFrom:2,measureTo:2});
  assert.equal(JSON.stringify(result.preview.targetNoteIds),'["measure-two"]');
  corrected=result.preview.correctedNotes;assert.equal(corrected.find(note=>note.id==='measure-two').startTick,2100);
  core.applyCorrection(session);assert.equal(core.currentTrack(session).notes.find(note=>note.id==='measure-two').startTick,2100);
  core.undo(session);assert.equal(core.currentTrack(session).notes.find(note=>note.id==='measure-two').startTick,2041);
  core.redo(session);assert.equal(core.currentTrack(session).notes.find(note=>note.id==='measure-two').startTick,2100);
});
test('scale guide pitch classes reuse Melody Correction key and scale definitions',()=>{
  const core=load();
  assert.deepEqual([...core.correctionScalePitchClasses('C','Major')],[0,2,4,5,7,9,11]);
  assert.deepEqual([...core.correctionScalePitchClasses('A','Minor')],[0,2,4,5,7,9,11]);
  assert.deepEqual([...core.correctionScalePitchClasses('D','Pentatonic')],[2,4,6,9,11]);
  assert.deepEqual([...core.correctionScalePitchClasses('C','Chromatic')],[]);
});
test('key transpose calculates shortest upward and downward semitone distances',()=>{
  const core=load();
  assert.equal(core.transposeSemitones('C','D','shortest'),2);
  assert.equal(core.transposeSemitones('D','C','shortest'),-2);
  assert.equal(core.transposeSemitones('C','B','shortest'),-1);
  assert.equal(core.transposeSemitones('C','B','up'),11);
  assert.equal(core.transposeSemitones('B','C','down'),-11);
});
test('key transpose previews all notes non-destructively and Apply is one Undo Redo step',()=>{
  const core=load(),session=core.createSession({projectId:'transpose-all',midiData:{tracks:[{part:'melody',notes:[
    {id:'a',pitch:60,startTick:120,durationTicks:240,velocity:87},
    {id:'b',pitch:67,startTick:480,durationTicks:360,velocity:105}
  ]}]}}),before=JSON.stringify(core.currentTrack(session).notes);
  const result=core.previewTranspose(session,{fromKey:'C',toKey:'D',direction:'shortest',target:'all'});
  assert.equal(result.ok,true);assert.equal(result.preview.semitones,2);
  assert.equal(JSON.stringify(core.currentTrack(session).notes),before);
  assert.deepEqual([...result.preview.transposedNotes.map(note=>[note.pitch,note.startTick,note.durationTicks,note.velocity])],[[62,120,240,87],[69,480,360,105]]);
  core.cancelTranspose(session);assert.equal(session.transposePreview,null);assert.equal(JSON.stringify(core.currentTrack(session).notes),before);
  core.previewTranspose(session,{fromKey:'C',toKey:'D',direction:'shortest',target:'all'});core.applyTranspose(session);
  assert.deepEqual([...core.currentTrack(session).notes.map(note=>note.pitch)],[62,69]);assert.equal(session.undo.length,1);
  core.undo(session);assert.equal(JSON.stringify(core.currentTrack(session).notes),before);
  core.redo(session);assert.deepEqual([...core.currentTrack(session).notes.map(note=>note.pitch)],[62,69]);
});
test('key transpose isolates selected notes and measure ranges',()=>{
  const core=load(),session=core.createSession({projectId:'transpose-targets',midiData:{ppq:480,timeSignature:{numerator:4,denominator:4},editor:{measureCount:4},tracks:[{part:'melody',notes:[
    {id:'first',pitch:60,startTick:0,durationTicks:240,velocity:80},
    {id:'second',pitch:64,startTick:1920,durationTicks:240,velocity:90},
    {id:'third',pitch:67,startTick:3840,durationTicks:240,velocity:100}
  ]}]}});
  core.selectNote(session,'second');let result=core.previewTranspose(session,{fromKey:'C',toKey:'D',direction:'shortest',target:'selected'});
  assert.deepEqual([...result.preview.transposedNotes.map(note=>note.pitch)],[60,66,67]);core.cancelTranspose(session);
  result=core.previewTranspose(session,{fromKey:'C',toKey:'D',direction:'shortest',target:'measures',measureFrom:3,measureTo:3});
  assert.deepEqual([...result.preview.transposedNotes.map(note=>note.pitch)],[60,64,69]);
});
test('key transpose rejects empty targets invalid measures and any out-of-range note atomically',()=>{
  const core=load(),empty=core.createSession({projectId:'empty'});
  let result=core.previewTranspose(empty,{fromKey:'C',toKey:'D',direction:'shortest',target:'all'});assert.equal(result.ok,false);assert.match(result.reason,/ノートがありません/);
  result=core.previewTranspose(empty,{fromKey:'C',toKey:'D',direction:'shortest',target:'selected'});assert.equal(result.ok,false);assert.match(result.reason,/選択/);
  const session=core.createSession({projectId:'bounds',midiData:{editor:{measureCount:4},tracks:[{part:'melody',notes:[{id:'low',pitch:0,startTick:0,durationTicks:120,velocity:80},{id:'high',pitch:127,startTick:480,durationTicks:120,velocity:90}]}]}}),before=JSON.stringify(core.currentTrack(session).notes);
  result=core.previewTranspose(session,{fromKey:'C',toKey:'B',direction:'shortest',target:'all'});assert.equal(result.ok,false);assert.equal(result.outOfRange[0].id,'low');assert.equal(session.transposePreview,null);
  result=core.previewTranspose(session,{fromKey:'C',toKey:'D',direction:'shortest',target:'all'});assert.equal(result.ok,false);assert.equal(result.outOfRange[0].id,'high');assert.equal(JSON.stringify(core.currentTrack(session).notes),before);
  result=core.previewTranspose(session,{fromKey:'C',toKey:'D',direction:'shortest',target:'measures',measureFrom:3,measureTo:2});assert.equal(result.ok,false);assert.match(result.reason,/小節範囲/);
  result=core.previewTranspose(session,{fromKey:'C',toKey:'D',direction:'shortest',target:'measures',measureFrom:5,measureTo:5});assert.equal(result.ok,false);assert.match(result.reason,/1〜4/);
  result=core.previewTranspose(session,{fromKey:'C',toKey:'D',direction:'shortest',target:'measures',measureFrom:4,measureTo:4});assert.equal(result.ok,false);assert.match(result.reason,/ノートがありません/);
});
test('key transpose stays Melody-only and never changes scale-guide session settings',()=>{
  const core=load(),session=core.createSession(project()),guide=JSON.stringify(session.correctionSettings),tracks=JSON.stringify(session.midiData.tracks);
  core.selectPart(session,'drums');let result=core.previewTranspose(session,{fromKey:'C',toKey:'D',target:'all',direction:'shortest'});assert.equal(result.ok,false);assert.match(result.reason,/Melody専用/);
  core.selectPart(session,'bass');result=core.previewTranspose(session,{fromKey:'C',toKey:'D',target:'all',direction:'shortest'});assert.equal(result.ok,false);
  core.selectPart(session,'melody');core.previewTranspose(session,{fromKey:'C',toKey:'D',target:'all',direction:'shortest'});core.applyTranspose(session);
  assert.equal(JSON.stringify(session.correctionSettings),guide);
  const originalTracks=JSON.parse(tracks),current=session.midiData.tracks;
  assert.equal(JSON.stringify(current.find(track=>track.part==='drums')),JSON.stringify(originalTracks.find(track=>track.part==='drums')));
  assert.equal(JSON.stringify(current.find(track=>track.part==='bass')),JSON.stringify(originalTracks.find(track=>track.part==='bass')));
  assert.equal(Object.hasOwn(session.midiData,'transposeSettings'),false);
});
test('key transpose Preview and Melody Correction Preview never coexist or overwrite MIDI data',()=>{
  const core=load(),session=core.createSession(project()),before=JSON.stringify(core.currentTrack(session).notes);
  core.previewCorrection(session,{key:'C',scale:'Major',quantize:'OFF',strength:100,swing:0,target:'all'});
  assert.ok(session.correctionPreview);assert.equal(session.transposePreview,null);
  core.previewTranspose(session,{fromKey:'C',toKey:'D',target:'all',direction:'shortest'});
  assert.equal(session.correctionPreview,null);assert.ok(session.transposePreview);
  core.previewCorrection(session,{key:'C',scale:'Major',quantize:'OFF',strength:100,swing:0,target:'all'});
  assert.equal(session.transposePreview,null);assert.ok(session.correctionPreview);
  assert.equal(JSON.stringify(core.currentTrack(session).notes),before);
});
test('batch note length converts regular dotted and triplet values from PPQ',()=>{
  const core=load(),ppq=480;
  assert.deepEqual(['1/1','1/2','1/4','1/8','1/16','1/32'].map(value=>core.noteLengthTicks(ppq,value)),[1920,960,480,240,120,60]);
  assert.deepEqual(['dotted-1/4','dotted-1/8','dotted-1/16'].map(value=>core.noteLengthTicks(ppq,value)),[720,360,180]);
  assert.deepEqual(['triplet-1/4','triplet-1/8','triplet-1/16'].map(value=>core.noteLengthTicks(ppq,value)),[320,160,80]);
  assert.equal(core.noteLengthTicks(ppq,'current'),null);
});
test('batch note length previews all notes non-destructively and Apply is one Undo Redo step',()=>{
  const core=load(),session=core.createSession({projectId:'length-all',midiData:{ppq:480,tracks:[{part:'melody',notes:[
    {id:'a',pitch:60,startTick:0,durationTicks:120,velocity:81},
    {id:'b',pitch:64,startTick:240,durationTicks:120,velocity:102}
  ]}]}}),before=JSON.stringify(core.currentTrack(session).notes);
  let result=core.previewNoteLength(session,{target:'all',length:'1/2'});
  assert.equal(result.ok,true);assert.equal(result.preview.durationTicks,960);assert.equal(JSON.stringify(core.currentTrack(session).notes),before);
  assert.deepEqual([...result.preview.changedNotes.map(note=>[note.pitch,note.startTick,note.durationTicks,note.velocity])],[[60,0,960,81],[64,240,960,102]]);
  assert.ok(result.preview.changedNotes[0].startTick+result.preview.changedNotes[0].durationTicks>result.preview.changedNotes[1].startTick);
  core.cancelNoteLength(session);assert.equal(session.noteLengthPreview,null);assert.equal(JSON.stringify(core.currentTrack(session).notes),before);
  core.previewNoteLength(session,{target:'all',length:'1/2'});core.applyNoteLength(session);assert.deepEqual([...core.currentTrack(session).notes.map(note=>note.durationTicks)],[960,960]);assert.equal(session.undo.length,1);
  core.undo(session);assert.equal(JSON.stringify(core.currentTrack(session).notes),before);
  core.redo(session);assert.deepEqual([...core.currentTrack(session).notes.map(note=>note.durationTicks)],[960,960]);
});
test('batch note length isolates selected notes and measure ranges',()=>{
  const core=load(),session=core.createSession({projectId:'length-targets',midiData:{ppq:480,timeSignature:{numerator:4,denominator:4},editor:{measureCount:4},tracks:[{part:'melody',notes:[
    {id:'first',pitch:60,startTick:0,durationTicks:100,velocity:80},
    {id:'second',pitch:64,startTick:1920,durationTicks:200,velocity:90},
    {id:'third',pitch:67,startTick:3840,durationTicks:300,velocity:100}
  ]}]}});
  core.selectNote(session,'second');let result=core.previewNoteLength(session,{target:'selected',length:'1/4'});
  assert.deepEqual([...result.preview.changedNotes.map(note=>note.durationTicks)],[100,480,300]);core.cancelNoteLength(session);
  result=core.previewNoteLength(session,{target:'measures',measureFrom:3,measureTo:3,length:'1/8'});
  assert.deepEqual([...result.preview.changedNotes.map(note=>note.durationTicks)],[100,200,240]);
});
test('batch note length rejects empty selection empty range and invalid measures',()=>{
  const core=load(),empty=core.createSession({projectId:'length-empty'});
  let result=core.previewNoteLength(empty,{target:'all',length:'1/4'});assert.equal(result.ok,false);assert.match(result.reason,/ノートがありません/);
  result=core.previewNoteLength(empty,{target:'selected',length:'1/4'});assert.equal(result.ok,false);assert.match(result.reason,/選択/);
  const session=core.createSession({projectId:'length-range',midiData:{editor:{measureCount:4},tracks:[{part:'melody',notes:[{id:'note',pitch:60,startTick:0,durationTicks:120,velocity:80}]}]}});
  result=core.previewNoteLength(session,{target:'measures',measureFrom:3,measureTo:2,length:'1/4'});assert.equal(result.ok,false);assert.match(result.reason,/小節範囲/);
  result=core.previewNoteLength(session,{target:'measures',measureFrom:4,measureTo:4,length:'1/4'});assert.equal(result.ok,false);assert.match(result.reason,/ノートがありません/);
});
test('batch note length stays Melody-only session-only and independent from other settings',()=>{
  const core=load(),session=core.createSession(project()),guide=JSON.stringify(session.correctionSettings),transpose=JSON.stringify(session.transposeSettings),tracks=JSON.stringify(session.midiData.tracks);
  core.selectPart(session,'drums');let result=core.previewNoteLength(session,{target:'all',length:'1/4'});assert.equal(result.ok,false);assert.match(result.reason,/Melody専用/);
  core.selectPart(session,'bass');result=core.previewNoteLength(session,{target:'all',length:'1/4'});assert.equal(result.ok,false);
  core.selectPart(session,'melody');core.previewNoteLength(session,{target:'all',length:'1/4'});assert.ok(session.noteLengthPreview);
  core.previewTranspose(session,{fromKey:'C',toKey:'D',target:'all',direction:'shortest'});assert.equal(session.noteLengthPreview,null);assert.ok(session.transposePreview);
  core.previewNoteLength(session,{target:'all',length:'1/8'});assert.equal(session.transposePreview,null);assert.ok(session.noteLengthPreview);
  core.previewCorrection(session,{key:'C',scale:'Major',quantize:'OFF',strength:100,swing:0,target:'all'});assert.equal(session.noteLengthPreview,null);assert.ok(session.correctionPreview);
  assert.equal(JSON.stringify(session.correctionSettings),guide);assert.equal(JSON.stringify(session.transposeSettings),transpose);
  const original=JSON.parse(tracks);assert.equal(JSON.stringify(session.midiData.tracks.find(track=>track.part==='drums')),JSON.stringify(original.find(track=>track.part==='drums')));assert.equal(Object.hasOwn(session.midiData,'noteLengthSettings'),false);
});
test('Melody Correction rejects an empty selected-note target and Quantize OFF preserves timing',()=>{
  const core=load(),session=core.createSession({projectId:'correction-off',midiData:{tracks:[{part:'melody',notes:[{id:'note',pitch:61,startTick:119,durationTicks:240,velocity:90}]}]}});
  let result=core.previewCorrection(session,{key:'C',scale:'Major',quantize:'OFF',strength:100,swing:100,target:'selected'});
  assert.equal(result.ok,false);assert.match(result.reason,/選択/);
  core.selectNote(session,'note');result=core.previewCorrection(session,{key:'C',scale:'Major',quantize:'OFF',strength:100,swing:100,target:'selected'});
  assert.equal(result.preview.correctedNotes[0].startTick,119);assert.equal(result.preview.correctedNotes[0].pitch,60);
});
test('Undo and Redo close a stale correction preview before changing edit history',()=>{
  const core=load(),session=core.createSession(project()),original=JSON.stringify(core.currentTrack(session).notes);
  core.addNote(session,{pitch:65,startTick:119,durationTicks:251});
  core.previewCorrection(session,'1/16',true);
  assert.ok(session.correctionPreview);
  core.undo(session);
  assert.equal(session.correctionPreview,null);
  assert.equal(JSON.stringify(core.currentTrack(session).notes),original);
  assert.equal(session.dirty,false);
  core.previewCorrection(session,'1/16',true);
  core.redo(session);
  assert.equal(session.correctionPreview,null);
  assert.equal(core.currentTrack(session).notes.length,2);
  assert.equal(session.dirty,true);
});
test('part changes discard Melody correction preview without mixing track state',()=>{
  const core=load(),session=core.createSession(project()),tracks=JSON.stringify(session.midiData.tracks);
  core.previewCorrection(session,'1/16',true);
  core.selectPart(session,'drums');
  assert.equal(session.correctionPreview,null);
  assert.equal(core.currentTrack(session).part,'drums');
  core.selectPart(session,'bass');assert.equal(core.currentTrack(session).part,'bass');
  core.selectPart(session,'melody');assert.equal(JSON.stringify(session.midiData.tracks),tracks);
});
test('saved correction baseline drives dirty state through Undo and Redo',()=>{
  const core=load(),session=core.createSession(project());
  core.currentTrack(session).notes[0].startTick=119;
  core.previewCorrection(session,'1/16',true);core.applyCorrection(session);
  assert.equal(session.dirty,true);
  core.markSaved(session);assert.equal(session.dirty,false);
  core.undo(session);assert.equal(session.dirty,true);
  core.redo(session);assert.equal(session.dirty,false);
});
test('manual Melody edit invalidates preview and correction remains one undoable change',()=>{
  const core=load(),session=core.createSession(project()),note=core.currentTrack(session).notes[0];
  core.updateNote(session,note.id,{startTick:119,durationTicks:251});
  const manuallyEdited=JSON.stringify(core.currentTrack(session).notes);
  core.previewCorrection(session,'1/16',true);
  core.updateNote(session,note.id,{velocity:91});
  assert.equal(session.correctionPreview,null);
  core.previewCorrection(session,'1/16',true);core.applyCorrection(session);
  assert.equal(core.currentTrack(session).notes[0].startTick,120);
  core.undo(session);assert.equal(core.currentTrack(session).notes[0].startTick,119);
  core.undo(session);assert.equal(JSON.stringify(core.currentTrack(session).notes),manuallyEdited);
  core.redo(session);core.redo(session);assert.equal(core.currentTrack(session).notes[0].startTick,120);
});
test('legacy and imported Version 1 MIDI data need no correction persistence fields',()=>{
  const core=load(),legacy={projectId:'legacy',musicalSettings:{bpm:120},midiData:{ppq:960,tracks:[{name:'Imported Piano',channel:1,notes:[{pitch:62,startTick:239,durationTicks:481,velocity:87}]}]}};
  const session=core.createSession(legacy),before=JSON.stringify(legacy);
  core.previewCorrection(session,'1/16',true);core.applyCorrection(session);
  assert.equal(core.currentTrack(session).notes[0].startTick,240);
  assert.equal(core.currentTrack(session).notes[0].durationTicks,480);
  assert.equal(JSON.stringify(legacy),before);
  assert.equal(Object.hasOwn(session.midiData,'savedMidiData'),false);
  assert.equal(Object.hasOwn(session.midiData,'correctionPreview'),false);
});
test('short same-pitch overlap is trimmed only in preview and Apply remains undoable',()=>{
  const core=load(),session=core.createSession(project()),track=core.currentTrack(session);
  track.notes=[
    {id:'first',pitch:69,startTick:1262,durationTicks:594,velocity:90,inputChannel:1,inputMethod:'midi-keyboard'},
    {id:'second',pitch:69,startTick:1720,durationTicks:300,velocity:90,inputChannel:1,inputMethod:'midi-keyboard'}
  ];
  const original=JSON.stringify(track.notes),cleanup=core.trimShortSamePitchOverlaps(track.notes,480);
  assert.equal(cleanup.adjustments.length,1);assert.equal(cleanup.adjustments[0].overlapTicks,136);
  assert.equal(cleanup.notes[0].durationTicks,458);assert.equal(JSON.stringify(track.notes),original);
  const result=core.previewCorrection(session,'1/32',false,true);
  assert.equal(JSON.stringify(track.notes),original);assert.equal(result.preview.overlapAdjustments.length,1);
  const corrected=result.preview.correctedNotes;
  assert.equal(corrected[0].startTick+corrected[0].durationTicks,corrected[1].startTick);
  core.cancelCorrection(session);assert.equal(JSON.stringify(track.notes),original);
  core.previewCorrection(session,'1/32',false,true);core.applyCorrection(session);
  assert.equal(core.currentTrack(session).notes[0].startTick+core.currentTrack(session).notes[0].durationTicks,core.currentTrack(session).notes[1].startTick);
  core.undo(session);assert.equal(JSON.stringify(core.currentTrack(session).notes),original);
  core.redo(session);assert.equal(core.currentTrack(session).notes[0].startTick+core.currentTrack(session).notes[0].durationTicks,core.currentTrack(session).notes[1].startTick);
});
test('long or intentional overlaps and different pitches are preserved',()=>{
  const core=load(),notes=[
    {id:'long-a',pitch:69,startTick:0,durationTicks:1000,velocity:90,inputChannel:1},
    {id:'other-pitch',pitch:72,startTick:200,durationTicks:700,velocity:90,inputChannel:1},
    {id:'long-b',pitch:69,startTick:500,durationTicks:300,velocity:90,inputChannel:1}
  ],result=core.trimShortSamePitchOverlaps(notes,480);
  assert.equal(result.adjustments.length,0);
  assert.equal(result.notes.find(note=>note.id==='long-a').durationTicks,1000);
  assert.equal(result.notes.find(note=>note.id==='other-pitch').durationTicks,700);
});
test('short overlap cleanup can be disabled without affecting quantize or duration correction',()=>{
  const core=load(),session=core.createSession(project()),track=core.currentTrack(session);
  track.notes=[
    {id:'first',pitch:69,startTick:119,durationTicks:251,velocity:90},
    {id:'second',pitch:69,startTick:300,durationTicks:240,velocity:90}
  ];
  const result=core.previewCorrection(session,'1/16',true,false);
  assert.equal(result.preview.cleanShortOverlaps,false);assert.equal(result.preview.overlapAdjustments.length,0);
  assert.equal(result.preview.correctedNotes[0].startTick,120);assert.equal(result.preview.correctedNotes[0].durationTicks,240);
});
test('all supported quantize resolutions derive from project PPQ',()=>{
  const core=load();
  assert.deepEqual(['1/4','1/8','1/16','1/32'].map(value=>core.quantizeTicks(480,value)),[480,240,120,60]);
});
test('selected-note Quantize uses nearest grid and preserves note performance data with Undo Redo',()=>{
  const core=load(),session=core.createSession(project()),track=core.currentTrack(session);track.notes=[
    {id:'before',pitch:60,startTick:10,durationTicks:211,velocity:81},
    {id:'early',pitch:62,startTick:115,durationTicks:222,velocity:82},
    {id:'late',pitch:64,startTick:125,durationTicks:233,velocity:83},
    {id:'exact',pitch:65,startTick:240,durationTicks:244,velocity:84},
    {id:'unselected',pitch:67,startTick:181,durationTicks:255,velocity:85}
  ];session.savedMidiData=core.clone(session.midiData);const untouched=core.quantizeSelectedStarts(session,'1/16');assert.equal(untouched.ok,false);assert.equal(untouched.reason,'ノートを選択してください');assert.deepEqual(Array.from(track.notes,note=>note.startTick),[10,115,125,240,181]);
  for(const id of['before','early','late','exact'])core.selectNote(session,id,{additive:true});const original=core.clone(track.notes),result=core.quantizeSelectedStarts(session,'1/16');assert.equal(result.ok,true);assert.equal(result.changed,true);assert.equal(result.count,4);assert.deepEqual(Array.from(track.notes,note=>[note.id,note.startTick]),[['before',0],['early',120],['late',120],['unselected',181],['exact',240]]);for(const note of track.notes.filter(note=>note.id!=='unselected')){const before=original.find(item=>item.id===note.id);assert.equal(note.pitch,before.pitch);assert.equal(note.velocity,before.velocity);assert.equal(note.durationTicks,before.durationTicks)}assert.equal(track.notes.find(note=>note.id==='unselected').startTick,181);
  core.undo(session);assert.deepEqual(Array.from(core.currentTrack(session).notes,note=>[note.id,note.startTick]),Array.from(original,note=>[note.id,note.startTick]));core.redo(session);assert.deepEqual(Array.from(core.currentTrack(session).notes,note=>[note.id,note.startTick]),[['before',0],['early',120],['late',120],['unselected',181],['exact',240]]);
});
