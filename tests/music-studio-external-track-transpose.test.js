const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(){const window={crypto:{randomUUID:(()=>{let value=0;return()=>`transpose-note-${++value}`})()}};window.window=window;window.globalThis=window;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);return window.MusicStudioEditor}
const plain=value=>JSON.parse(JSON.stringify(value));
function project(){return{projectId:'external-transpose',midiData:{ppq:480,timeSignature:{numerator:4,denominator:4},editor:{measureCount:4},tracks:[
  {id:'core-melody',part:'melody',name:'Melody',notes:[{id:'shared',pitch:60,startTick:0,durationTicks:240,velocity:80,meta:{track:'core'}}]},
  {id:'core-drums',part:'drums',name:'Drums',channel:10,notes:[{id:'drum',pitch:36,startTick:0,durationTicks:120,velocity:100}]},
  {id:'core-bass',part:'bass',name:'Bass',channel:2,notes:[{id:'bass',pitch:40,startTick:0,durationTicks:480,velocity:75}]},
  {id:'external-a',name:'Melody',trackType:'midi-melodic',roleAssignment:'piano',custom:'a',notes:[{id:'shared',pitch:64,startTick:0,durationTicks:333,velocity:91,meta:{keep:'a'}},{id:'range',pitch:67,startTick:1920,durationTicks:222,velocity:72,extra:'keep'},{id:'locked',pitch:69,startTick:1920,durationTicks:111,velocity:73,locked:true},{id:'outside',pitch:71,startTick:3840,durationTicks:444,velocity:74}]},
  {id:'external-b',name:'Melody',trackType:'midi-melodic',roleAssignment:'piano',custom:'b',notes:[{id:'shared',pitch:76,startTick:0,durationTicks:555,velocity:92,meta:{keep:'b'}}]}
]}}}
function track(session,id){return session.midiData.tracks.find(item=>item.id===id)}

test('External Preview pins targetTrackId and Apply changes only that exact Track',()=>{
  const core=load(),session=core.createSession(project()),before=plain(session.midiData.tracks);core.selectTrackById(session,'external-a');const result=core.previewTranspose(session,{fromKey:'C',toKey:'D',target:'all',direction:'shortest'},core.createEditorContext(session));assert.equal(result.ok,true);assert.equal(result.preview.targetTrackId,'external-a');assert.deepEqual(plain(session.midiData.tracks),before);core.applyTranspose(session,core.createEditorContext(session));assert.deepEqual(Array.from(track(session,'external-a').notes,note=>note.pitch),[66,69,69,73]);for(const id of['core-melody','external-b'])assert.deepEqual(plain(track(session,id)),before.find(item=>item.id===id))
});

test('same Note ID duplicate names roles and Core External name collision stay independent',()=>{
  const core=load(),session=core.createSession(project()),coreBefore=plain(track(session,'core-melody')),bBefore=plain(track(session,'external-b'));core.selectTrackById(session,'external-a');core.selectNote(session,'shared');core.previewTranspose(session,{fromKey:'C',toKey:'D',target:'selected'},core.createEditorContext(session));core.applyTranspose(session,core.createEditorContext(session));assert.equal(track(session,'external-a').notes.find(note=>note.id==='shared').pitch,66);assert.deepEqual(plain(track(session,'external-b')),bBefore);assert.deepEqual(plain(track(session,'core-melody')),coreBefore)
});

test('stale Preview and stale Editor Context are rejected after Track switch',()=>{
  const core=load(),session=core.createSession(project());core.selectTrackById(session,'external-a');const contextA=core.createEditorContext(session),created=core.previewTranspose(session,{fromKey:'C',toKey:'D',target:'all'},contextA),preview=plain(created.preview);core.selectTrackById(session,'external-b');const before=plain(session.midiData),undo=session.undo.length;session.transposePreview=preview;let result=core.applyTranspose(session,contextA);assert.equal(result.ok,false);assert.deepEqual(plain(session.midiData),before);assert.equal(session.undo.length,undo);session.transposePreview=preview;result=core.applyTranspose(session,core.createEditorContext(session));assert.equal(result.ok,false);assert.deepEqual(plain(session.midiData),before);assert.equal(session.undo.length,undo)
});

test('measure target changes only unlocked overlapping notes and preserves all non-pitch fields',()=>{
  const core=load(),session=core.createSession(project());core.selectTrackById(session,'external-a');const before=plain(track(session,'external-a').notes);const result=core.previewTranspose(session,{fromKey:'C',toKey:'D',target:'measures',measureFrom:2,measureTo:2},core.createEditorContext(session));assert.deepEqual(Array.from(result.preview.targetNoteIds),['range']);core.applyTranspose(session,core.createEditorContext(session));const after=track(session,'external-a').notes;assert.equal(after.find(note=>note.id==='range').pitch,69);for(const note of after){const previous=before.find(item=>item.id===note.id);for(const field of['id','startTick','durationTicks','velocity','locked','meta','extra'])assert.equal(JSON.stringify(note[field]),JSON.stringify(previous[field]));if(note.id!=='range')assert.equal(note.pitch,previous.pitch)}
});

test('pitch boundaries retain the existing reject behavior without mutation',()=>{
  const core=load();for(const[pitch,fromKey,toKey,direction]of[[127,'C','D','up'],[0,'C','B','down']]){const source=project(),external=source.midiData.tracks.find(item=>item.id==='external-a');external.notes=[{id:'boundary',pitch,startTick:0,durationTicks:120,velocity:80}];const session=core.createSession(source);core.selectTrackById(session,'external-a');const before=plain(session.midiData),result=core.previewTranspose(session,{fromKey,toKey,target:'all',direction},core.createEditorContext(session));assert.equal(result.ok,false);assert.match(result.reason,/MIDI音域外/);assert.deepEqual(plain(session.midiData),before)}
});

test('External Transpose Undo Redo preserves Exact Track ID and other Tracks',()=>{
  const core=load(),session=core.createSession(project()),other=plain(track(session,'external-b'));core.selectTrackById(session,'external-a');core.previewTranspose(session,{fromKey:'C',toKey:'D',target:'all'},core.createEditorContext(session));core.applyTranspose(session,core.createEditorContext(session));core.undo(session);assert.equal(session.selectedTrackId,'external-a');assert.equal(track(session,'external-a').notes[0].pitch,64);core.redo(session);assert.equal(session.selectedTrackId,'external-a');assert.equal(track(session,'external-a').notes[0].pitch,66);assert.deepEqual(plain(track(session,'external-b')),other)
});

test('Core Melody keeps Transpose targets while Core Drums and Bass remain rejected',()=>{
  const core=load(),session=core.createSession(project());core.selectTrackById(session,'core-melody');core.selectNote(session,'shared');let result=core.previewTranspose(session,{fromKey:'C',toKey:'D',target:'selected'},core.createEditorContext(session));assert.equal(result.ok,true);core.applyTranspose(session,core.createEditorContext(session));assert.equal(track(session,'core-melody').notes[0].pitch,62);for(const id of['core-drums','core-bass']){core.selectTrackById(session,id);result=core.previewTranspose(session,{fromKey:'C',toKey:'D',target:'all'},core.createEditorContext(session));assert.equal(result.ok,false)}
});
