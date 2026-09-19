const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(){const window={crypto:{randomUUID:(()=>{let value=0;return()=>`partial-${++value}`})()}};window.window=window;window.globalThis=window;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.js'),'utf8'),window);return{core:window.MusicStudioEditor,selection:window.MusicStudioDynamicTrackSelection}}
const plain=value=>JSON.parse(JSON.stringify(value));
function project(){return{projectId:'external-partial',midiData:{editor:{measureCount:4,editRange:{startMeasure:1,endMeasure:1}},tracks:[
  {id:'core-melody',part:'melody',name:'Twin',channel:1,program:0,notes:[{id:'shared',pitch:60,startTick:0,durationTicks:120,velocity:90}]},
  {id:'core-drums',part:'drums',name:'Drums',channel:10,program:null,notes:[{id:'core-drum',pitch:36,startTick:0,durationTicks:120,velocity:100}]},
  {id:'core-bass',part:'bass',name:'Bass',channel:2,program:32,notes:[{id:'core-bass-note',pitch:40,startTick:0,durationTicks:480,velocity:88}]},
  {id:'external-a',name:'Twin',trackType:'midi-melodic',roleAssignment:'strings',channel:3,program:48,order:4,metadata:{take:'a'},notes:[{id:'shared',pitch:72,startTick:0,durationTicks:120,velocity:80},{id:'delete-me',pitch:73,startTick:120,durationTicks:120,velocity:81},{id:'locked',pitch:74,startTick:240,durationTicks:120,velocity:82,locked:true},{id:'outside',pitch:75,startTick:1920,durationTicks:120,velocity:83}]},
  {id:'external-b',name:'Twin',trackType:'midi-melodic',roleAssignment:'strings',channel:4,program:49,order:5,metadata:{take:'b'},notes:[{id:'shared',pitch:76,startTick:0,durationTicks:120,velocity:84}]},
  {id:'external-drums',name:'Kit',trackType:'midi-drums',roleAssignment:'drums',channel:10,program:null,order:6,notes:[{id:'kick',pitch:36,startTick:0,durationTicks:120,velocity:100}]},
  {id:'audio',name:'Audio',trackType:'audio',roleAssignment:'vocal',notes:[]}
]}}}

test('External Partial Edit routes mixed changes by exact Track ID and preserves metadata history and reload',()=>{
  const{core}=load(),session=core.createSession(project());core.selectTrackById(session,'external-a');
  const beforeOther=plain(session.midiData.tracks.filter(track=>track.id!=='external-a')),metadata=plain(core.currentTrack(session));
  const request=core.createPartialEditRequest(session),result=core.createPartialEditResult(request,{updates:[{...request.notes.find(note=>note.id==='shared'),pitch:73}],adds:[{id:'added',pitch:77,startTick:360,durationTicks:120,velocity:90}],deleteNoteIds:['delete-me']}),preview=core.createPartialEditPreview(request,result),flow=core.createPartialEditSession(request);
  assert.equal(request.trackId,'external-a');assert.equal(request.part,null);assert.deepEqual(Array.from(request.targetNoteIds),['shared','delete-me']);assert.deepEqual(Array.from(request.lockedNoteIds),['locked']);
  core.attachPartialEditResult(flow,result);core.attachPartialEditPreview(flow,preview);assert.equal(core.applyPartialEditSession(session,flow).applied,true);assert.equal(session.undo.length,1);
  assert.deepEqual(Array.from(core.currentTrack(session).notes,note=>[note.id,note.pitch]),[['shared',73],['locked',74],['added',77],['outside',75]]);assert.deepEqual(plain(session.midiData.tracks.filter(track=>track.id!=='external-a')),beforeOther);
  for(const key of['id','name','trackType','roleAssignment','channel','program','order','metadata'])assert.deepEqual(plain(core.currentTrack(session)[key]),metadata[key]);
  core.undo(session);assert.deepEqual(Array.from(core.currentTrack(session).notes,note=>note.id),['shared','delete-me','locked','outside']);core.redo(session);assert.deepEqual(Array.from(core.currentTrack(session).notes,note=>note.id),['shared','locked','added','outside']);
  core.markSaved(session);const reloaded=core.createSession({projectId:'reloaded',midiData:plain(session.midiData)});core.selectTrackById(reloaded,'external-a');assert.deepEqual(plain(core.currentTrack(reloaded)),plain(core.currentTrack(session)))
});

test('External Partial Edit rejects stale Track Note and Lock snapshots without cross-track mutation',()=>{
  const{core}=load(),make=()=>{const session=core.createSession(project());core.selectTrackById(session,'external-a');const request=core.createPartialEditRequest(session),result=core.createPartialEditResult(request,{updates:[{...request.notes.find(note=>note.id==='shared'),pitch:73}]}),preview=core.createPartialEditPreview(request,result);return{session,request,result,preview}};
  for(const mutate of [value=>core.selectTrackById(value.session,'external-b'),value=>value.session.midiData.tracks.find(track=>track.id==='external-a').notes.find(note=>note.id==='shared').pitch=71,value=>value.session.midiData.tracks.find(track=>track.id==='external-a').notes.find(note=>note.id==='shared').locked=true,value=>value.session.midiData.tracks.find(track=>track.id==='external-a').notes=value.session.midiData.tracks.find(track=>track.id==='external-a').notes.filter(note=>note.id!=='shared')]){const value=make(),beforeOther=plain(value.session.midiData.tracks.find(track=>track.id==='external-b'));mutate(value);const before=JSON.stringify(value.session),undo=value.session.undo.length,response=core.applyPartialEditPreview(value.session,value.request,value.result,value.preview);assert.equal(response.applied,false);assert.equal(JSON.stringify(value.session),before);assert.equal(value.session.undo.length,undo);assert.deepEqual(plain(value.session.midiData.tracks.find(track=>track.id==='external-b')),beforeOther)}
});

test('External Local Preview requires pinned selection provenance and rejects deleted or same-ID stale selection',()=>{
  const{core,selection}=load(),session=core.createSession(project()),api={state:{midiEditor:session,partialEditSession:null,midiMultiSelect:false},editorPreviewPartialEditPitchUp(){return'previewed'},editorRunPartialEditProvider(){return'provider'},editorStartPartialEdit(){return'started'},editorApplyPartialEdit(){return'applied'},editorStartNoteDrag(event,id){core.selectNote(session,id);return true}};
  selection.install(api,core,null);core.selectTrackById(session,'external-a');api.state.partialEditSession=core.createPartialEditSession(core.createPartialEditRequest(session));
  core.selectNote(session,'shared');assert.deepEqual(plain(api.editorPreviewPartialEditPitchUp()),{ok:false,reason:'stale-selection'});
  api.__externalNoteSelectionTrackId='external-a';assert.equal(api.editorPreviewPartialEditPitchUp(),'previewed');
  core.selectTrackById(session,'external-b');session.selectionTrackId='external-b';session.selectedNoteId='shared';session.selectedNoteIds=['shared'];assert.deepEqual(plain(api.editorPreviewPartialEditPitchUp()),{ok:false,reason:'stale-selection'});
  core.selectTrackById(session,'external-a');core.selectNote(session,'shared');api.__externalNoteSelectionTrackId='external-a';core.currentTrack(session).notes=core.currentTrack(session).notes.filter(note=>note.id!=='shared');assert.deepEqual(plain(api.editorPreviewPartialEditPitchUp()),{ok:false,reason:'stale-selection'});
  core.selectTrackById(session,'external-a');assert.deepEqual(plain(api.editorRunPartialEditProvider()),{ok:false,reason:'unsupported-external-edit'})
});

test('External drums share Local Pitch edit contract while unsupported Tracks cannot start a request',()=>{
  const{core}=load(),session=core.createSession(project());core.selectTrackById(session,'external-drums');const request=core.createPartialEditRequest(session),note=request.notes[0],result=core.createPartialEditResult(request,{updates:[{...note,pitch:note.pitch+1}]}),preview=core.createPartialEditPreview(request,result);assert.equal(core.applyPartialEditPreview(session,request,result,preview).applied,true);assert.equal(core.currentTrack(session).notes[0].pitch,37);
  core.selectTrackById(session,'audio');assert.throws(()=>core.createPartialEditRequest(session),/valid track/);assert.equal(core.resolveTrackCapabilities(core.currentTrack(session)).supportsPartialEdit,false)
});

test('External all-locked ranges remain valid and duplicate Add IDs are rejected',()=>{
  const{core}=load(),source=project(),track=source.midiData.tracks.find(item=>item.id==='external-a');track.notes=track.notes.filter(note=>note.id==='locked');const session=core.createSession(source);core.selectTrackById(session,'external-a');const request=core.createPartialEditRequest(session);assert.deepEqual(Array.from(request.targetNoteIds),[]);assert.deepEqual(Array.from(request.lockedNoteIds),['locked']);assert.throws(()=>core.createPartialEditResult(request,{adds:[{id:'shared',pitch:60,startTick:0,durationTicks:120,velocity:80},{id:'shared',pitch:61,startTick:120,durationTicks:120,velocity:80}]}),/duplicate/)
});
