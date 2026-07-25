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
