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
  assert.equal(session.dirty,false);
});
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
