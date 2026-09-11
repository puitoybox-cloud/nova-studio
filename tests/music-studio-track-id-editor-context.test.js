const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(){
  const window={crypto:{randomUUID:(()=>{let value=0;return()=>`context-note-${++value}`})()}};window.window=window;window.globalThis=window;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);
  return window.MusicStudioEditor
}
const plain=value=>JSON.parse(JSON.stringify(value));
function project(){return{projectId:'track-context',midiData:{editor:{parts:{melody:{selectedMeasures:[1]},drums:{lockedMeasures:[2]},bass:{selectedMeasures:[3]}}},tracks:[
  {id:'core-melody',part:'melody',name:'Melody',channel:1,program:0,meta:{keep:'melody'},notes:[{id:'shared-note',pitch:60,startTick:0,durationTicks:480,velocity:80}]},
  {id:'core-drums',part:'drums',name:'Drums',channel:10,program:null,notes:[{id:'drum-note',pitch:36,startTick:0,durationTicks:120,velocity:90}]},
  {id:'core-bass',part:'bass',name:'Bass',channel:2,program:32,notes:[{id:'bass-note',pitch:36,startTick:0,durationTicks:960,velocity:70}]},
  {id:'guitar-a',name:'Guitar',channel:3,program:24,roleAssignment:'guitar',custom:'a',notes:[{id:'shared-note',pitch:64,startTick:0,durationTicks:480,velocity:81}]},
  {id:'guitar-b',name:'Guitar',channel:4,program:25,roleAssignment:'guitar',custom:'b',notes:[{id:'shared-note',pitch:67,startTick:0,durationTicks:480,velocity:82}]},
  {id:'external-melody',name:'Melody',channel:5,program:40,roleAssignment:'melody',notes:[{id:'external-note',pitch:72,startTick:0,durationTicks:480,velocity:83}]}
]}}}

test('Core selection exposes exact identity and synchronizes only its compatibility alias',()=>{
  const core=load(),session=core.createSession(project());
  for(const[id,part]of[['core-melody','melody'],['core-drums','drums'],['core-bass','bass']]){assert.equal(core.selectTrackById(session,id),true);const context=core.createEditorContext(session);assert.equal(session.selectedTrackId,id);assert.equal(session.part,part);assert.deepEqual(plain(context),{targetTrackId:id,currentTrackId:id,selectedTrackId:id,corePartAlias:part,trackRole:part,trackType:part==='drums'?'midi-drums':'midi-melodic'});assert.equal(core.validateEditorContext(session,context).ok,true)}
});

test('External duplicate names roles and Core name collisions stay independent by exact ID',()=>{
  const core=load(),session=core.createSession(project());
  for(const id of ['guitar-a','guitar-b','external-melody']){core.selectTrackById(session,id);const context=core.createEditorContext(session);assert.equal(context.targetTrackId,id);assert.equal(context.corePartAlias,null);assert.equal(session.selectedTrackId,id);assert.equal(core.currentTrack(session).id,id)}
  assert.equal(session.part,'melody');assert.equal(core.resolveEditorTrack(session,'core-melody').id,'core-melody');assert.equal(core.resolveEditorTrack(session,'external-melody').id,'external-melody')
});

test('same Note ID selection and mutation never cross Track identity',()=>{
  const core=load(),session=core.createSession(project());core.selectTrackById(session,'guitar-a');core.selectNote(session,'shared-note');core.updateSelectedNotes(session,{velocity:99});
  assert.equal(core.resolveEditorTrack(session,'guitar-a').notes[0].velocity,99);assert.equal(core.resolveEditorTrack(session,'guitar-b').notes[0].velocity,82);assert.equal(core.resolveEditorTrack(session,'core-melody').notes[0].velocity,80)
});

test('Track switch clears stale selection provenance even when the Note ID is shared',()=>{
  const core=load(),session=core.createSession(project());core.selectTrackById(session,'guitar-a');core.selectNote(session,'shared-note');assert.equal(session.selectionTrackId,'guitar-a');core.selectTrackById(session,'guitar-b');assert.deepEqual(Array.from(core.selectedIds(session)),[]);core.updateSelectedNotes(session,{velocity:100});assert.equal(core.resolveEditorTrack(session,'guitar-b').notes[0].velocity,82)
});

test('pinned editor context becomes stale after a Track switch and cannot resolve as current',()=>{
  const core=load(),session=core.createSession(project());core.selectTrackById(session,'guitar-a');const context=core.createEditorContext(session);core.selectTrackById(session,'guitar-b');const checked=core.validateEditorContext(session,context);assert.equal(checked.ok,false);assert.deepEqual(Array.from(checked.errors),['stale-selection']);assert.equal(checked.track.id,'guitar-a');assert.equal(core.validateEditorContext(session,context,{requireSelected:false}).ok,true)
});

test('External and Core switching restores Core alias and Track-ID keyed editor state',()=>{
  const core=load(),session=core.createSession(project());core.selectTrackById(session,'core-drums');session.selectedMeasures=[4];core.selectTrackById(session,'guitar-a');assert.equal(session.part,'drums');session.selectedMeasures=[7];core.selectTrackById(session,'core-bass');assert.equal(session.part,'bass');core.selectTrackById(session,'guitar-a');assert.equal(session.part,'bass');assert.deepEqual(Array.from(session.selectedMeasures),[7]);core.selectTrackById(session,'core-drums');assert.equal(session.part,'drums');assert.deepEqual(Array.from(session.selectedMeasures),[4]);assert.deepEqual(Array.from(session.midiData.editor.parts.drums.selectedMeasures),[4]);assert.deepEqual(Array.from(session.midiData.editor.trackStates['core-drums'].selectedMeasures),[4])
});

test('Undo Redo preserve exact Track ID and selection provenance',()=>{
  const core=load(),session=core.createSession(project());core.selectTrackById(session,'guitar-b');core.selectNote(session,'shared-note');core.updateSelectedNotes(session,{velocity:101});core.undo(session);assert.equal(session.selectedTrackId,'guitar-b');assert.equal(session.selectionTrackId,'guitar-b');assert.equal(core.currentTrack(session).notes[0].velocity,82);core.redo(session);assert.equal(session.selectedTrackId,'guitar-b');assert.equal(core.currentTrack(session).notes[0].velocity,101)
});

test('normalization preserves Track IDs order metadata and notes while adding keyed state compatibly',()=>{
  const core=load(),source=project(),before=plain(source.midiData.tracks),session=core.createSession(source),normalized=session.midiData;
  assert.deepEqual(plain(normalized.tracks.map(track=>track.id)),before.map(track=>track.id));for(const track of before){const actual=normalized.tracks.find(item=>item.id===track.id);assert.deepEqual(plain(actual.notes),track.notes);for(const key of ['name','part','roleAssignment','custom','meta'])if(Object.hasOwn(track,key))assert.deepEqual(plain(actual[key]),track[key])}assert.deepEqual(Object.keys(normalized.editor.trackStates),before.map(track=>track.id));assert.deepEqual(Array.from(normalized.editor.parts.melody.selectedMeasures),[1]);assert.deepEqual(Array.from(normalized.editor.parts.drums.lockedMeasures),[2]);assert.deepEqual(Array.from(normalized.editor.parts.bass.selectedMeasures),[3]);assert.equal(normalized.editor.trackStates['guitar-a'].selectedMeasures.length,0)
});
