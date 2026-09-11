const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(){const window={crypto:{randomUUID:(()=>{let value=0;return()=>`quantize-note-${++value}`})()}};window.window=window;window.globalThis=window;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);return window.MusicStudioEditor}
const plain=value=>JSON.parse(JSON.stringify(value));
function project(){return{projectId:'external-quantize',midiData:{ppq:480,editor:{measureCount:4},tracks:[
  {id:'core-melody',part:'melody',name:'Melody',notes:[{id:'shared',pitch:60,startTick:301,durationTicks:241,velocity:80,meta:{track:'core'}}]},
  {id:'core-drums',part:'drums',name:'Drums',channel:10,notes:[{id:'drum',pitch:36,startTick:301,durationTicks:61,velocity:100}]},
  {id:'core-bass',part:'bass',name:'Bass',channel:2,notes:[{id:'bass',pitch:40,startTick:301,durationTicks:481,velocity:75}]},
  {id:'external-a',name:'Melody',trackType:'midi-melodic',roleAssignment:'guitar',custom:'a',notes:[{id:'shared',pitch:64,startTick:301,durationTicks:333,velocity:91,meta:{keep:'a'}},{id:'open',pitch:67,startTick:181,durationTicks:222,velocity:72,extra:'keep'},{id:'locked',pitch:69,startTick:61,durationTicks:111,velocity:73,locked:true},{id:'unselected',pitch:71,startTick:77,durationTicks:444,velocity:74}]},
  {id:'external-b',name:'Melody',trackType:'midi-melodic',roleAssignment:'guitar',custom:'b',notes:[{id:'shared',pitch:76,startTick:301,durationTicks:555,velocity:92,meta:{keep:'b'}}]}
]}}}
function track(session,id){return session.midiData.tracks.find(item=>item.id===id)}

test('External Quantize supports every resolution on the exact target Track ID',()=>{
  const core=load(),expected={'1/4':480,'1/8':240,'1/16':360,'1/32':300};
  for(const[resolution,startTick]of Object.entries(expected)){const session=core.createSession(project()),beforeOther=plain(track(session,'external-b'));core.selectTrackById(session,'external-a');core.selectNote(session,'shared');const result=core.quantizeSelectedStarts(session,resolution,core.createEditorContext(session));assert.deepEqual(plain(result),{ok:true,changed:true,count:1,resolution,targetTrackId:'external-a'});assert.equal(track(session,'external-a').notes.find(note=>note.id==='shared').startTick,startTick);assert.deepEqual(plain(track(session,'external-b')),beforeOther)}
});

test('External Quantize changes only unlocked selected starts and preserves every other field',()=>{
  const core=load(),session=core.createSession(project());core.selectTrackById(session,'external-a');for(const id of['shared','open','locked'])core.selectNote(session,id,{additive:true});const before=plain(track(session,'external-a').notes),otherBefore=plain(session.midiData.tracks.filter(item=>item.id!=='external-a'));const result=core.quantizeSelectedStarts(session,'1/16',core.createEditorContext(session));assert.equal(result.count,2);const after=track(session,'external-a').notes;
  for(const id of['shared','open']){const previous=before.find(note=>note.id===id),current=after.find(note=>note.id===id);assert.equal(current.startTick%120,0);for(const field of['id','pitch','velocity','durationTicks','locked','meta','extra'])assert.equal(JSON.stringify(current[field]),JSON.stringify(previous[field]))}
  for(const id of['locked','unselected'])assert.deepEqual(plain(after.find(note=>note.id===id)),before.find(note=>note.id===id));assert.deepEqual(plain(session.midiData.tracks.filter(item=>item.id!=='external-a')),otherBefore)
});

test('same Note ID duplicate names roles and Core External name collision remain Track-ID scoped',()=>{
  const core=load(),session=core.createSession(project()),coreBefore=plain(track(session,'core-melody')),bBefore=plain(track(session,'external-b'));core.selectTrackById(session,'external-a');core.selectNote(session,'shared');core.quantizeSelectedStarts(session,'1/4',core.createEditorContext(session));assert.equal(track(session,'external-a').notes.find(note=>note.id==='shared').startTick,480);assert.deepEqual(plain(track(session,'external-b')),bBefore);assert.deepEqual(plain(track(session,'core-melody')),coreBefore)
});

test('stale selection and stale Editor Context cannot Quantize a switched Track',()=>{
  const core=load(),session=core.createSession(project());core.selectTrackById(session,'external-a');core.selectNote(session,'shared');const context=core.createEditorContext(session);core.selectTrackById(session,'external-b');const before=plain(session.midiData),undo=session.undo.length,result=core.quantizeSelectedStarts(session,'1/4',context);assert.equal(result.ok,false);assert.ok(result.errors.includes('stale-selection'));assert.deepEqual(plain(session.midiData),before);assert.equal(session.undo.length,undo);session.selectedNoteId='shared';session.selectedNoteIds=['shared'];session.selectionTrackId='external-a';const currentContext=core.createEditorContext(session),staleSelection=core.quantizeSelectedStarts(session,'1/4',currentContext);assert.equal(staleSelection.ok,false);assert.deepEqual(Array.from(core.selectedIds(session)),[]);assert.deepEqual(plain(session.midiData),before)
});

test('External Quantize Undo Redo restores the exact Track without changing another Track',()=>{
  const core=load(),session=core.createSession(project());core.selectTrackById(session,'external-a');core.selectNote(session,'shared');const other=plain(track(session,'external-b'));core.quantizeSelectedStarts(session,'1/4',core.createEditorContext(session));assert.equal(track(session,'external-a').notes.find(note=>note.id==='shared').startTick,480);core.undo(session);assert.equal(session.selectedTrackId,'external-a');assert.equal(track(session,'external-a').notes.find(note=>note.id==='shared').startTick,301);core.redo(session);assert.equal(session.selectedTrackId,'external-a');assert.equal(track(session,'external-a').notes.find(note=>note.id==='shared').startTick,480);assert.deepEqual(plain(track(session,'external-b')),other)
});

test('Core Melody Drums and Bass retain the existing Quantize contract',()=>{
  const core=load(),session=core.createSession(project());for(const[id,noteId]of[['core-melody','shared'],['core-drums','drum'],['core-bass','bass']]){core.selectTrackById(session,id);core.selectNote(session,noteId);const result=core.quantizeSelectedStarts(session,'1/16',core.createEditorContext(session));assert.equal(result.ok,true);assert.equal(result.targetTrackId,id);assert.equal(track(session,id).notes.find(note=>note.id===noteId).startTick,360)}
});
