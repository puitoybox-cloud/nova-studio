const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(){
  const window={crypto:{randomUUID:(()=>{let value=0;return()=>`id-${++value}`})()}};window.window=window;window.globalThis=window;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);
  return window.MusicStudioEditor
}
const plain=value=>JSON.parse(JSON.stringify(value));
function project(){return{projectId:'selected-track',midiData:{tracks:[
  {id:'melody-custom',part:'melody',channel:1,program:0,notes:[{id:'m',pitch:60,startTick:0,durationTicks:480,velocity:90}]},
  {id:'drums-custom',part:'drums',channel:10,program:null,notes:[{id:'d',pitch:36,startTick:0,durationTicks:120,velocity:100}]},
  {id:'bass-custom',part:'bass',channel:2,program:32,notes:[{id:'b',pitch:36,startTick:0,durationTicks:960,velocity:80}]},
  {id:'external-strings',name:'Strings',channel:3,program:48,channels:[3],programChanges:[{tick:0,program:48}],controlChanges:[{tick:0,controller:1,value:64}],pitchBends:[{tick:120,value:256}],unsupportedEvents:[{type:15}],custom:{kept:true},notes:[{id:'u',pitch:72,startTick:0,durationTicks:480,velocity:70}]}
]}}}

test('createSession initializes selectedTrackId to the normalized Melody track without persisting it',()=>{
  const core=load(),session=core.createSession(project());
  assert.equal(session.part,'melody');assert.equal(session.selectedTrackId,'melody-custom');assert.equal(core.currentTrack(session).id,'melody-custom');
  assert.equal(Object.hasOwn(session.midiData,'selectedTrackId'),false);assert.equal(Object.hasOwn(session.savedMidiData,'selectedTrackId'),false)
});

test('currentTrack prefers selectedTrackId and falls back to the compatible part',()=>{
  const core=load(),session=core.createSession(project());session.selectedTrackId='external-strings';session.part='melody';
  assert.equal(core.currentTrack(session).id,'external-strings');session.selectedTrackId='missing';assert.equal(core.currentTrack(session).id,'melody-custom');
  session.selectedTrackId='';assert.equal(core.currentTrack(session).id,'melody-custom')
});

test('selectPart synchronizes the compatible part and exact core Track ID',()=>{
  const core=load(),session=core.createSession(project());
  for(const [part,id]of[['drums','drums-custom'],['bass','bass-custom'],['melody','melody-custom']]){core.selectPart(session,part);assert.equal(session.part,part);assert.equal(session.selectedTrackId,id);assert.equal(core.currentTrack(session).id,id);assert.deepEqual(Array.from(session.selectedNoteIds),[])}
});

test('selectTrackById selects core tracks and synchronizes the part alias',()=>{
  const core=load(),session=core.createSession(project());
  for(const [id,part]of[['drums-custom','drums'],['bass-custom','bass'],['melody-custom','melody']]){assert.equal(core.selectTrackById(session,id),true);assert.equal(session.selectedTrackId,id);assert.equal(session.part,part);assert.equal(core.currentTrack(session).id,id)}
});

test('unknown Track selection changes only Track identity and never promotes a core role',()=>{
  const core=load(),session=core.createSession(project()),unknown=session.midiData.tracks.find(track=>track.id==='external-strings'),before=JSON.stringify(unknown);
  core.selectPart(session,'bass');session.selectedNoteId='b';session.selectedNoteIds=['b'];assert.equal(core.selectTrackById(session,'external-strings'),true);
  assert.equal(session.selectedTrackId,'external-strings');assert.equal(session.part,'bass');assert.equal(core.currentTrack(session),unknown);
  assert.equal(core.resolveCoreTrackRole(unknown),null);assert.equal(session.selectedNoteId,null);assert.deepEqual(Array.from(session.selectedNoteIds),[]);assert.equal(JSON.stringify(unknown),before)
});

test('invalid Track IDs leave the complete session state unchanged',()=>{
  const core=load(),session=core.createSession(project());core.selectNote(session,'m');session.correctionPreview={kept:true};
  for(const id of ['missing','',null,undefined,42]){const before=JSON.stringify(session);assert.equal(core.selectTrackById(session,id),false);assert.equal(JSON.stringify(session),before)}
});

test('duplicate Track ID selection follows registry first-match behavior without repair',()=>{
  const core=load(),source=project();source.midiData.tracks.push({id:'external-strings',name:'Second',channel:4,notes:[]});const session=core.createSession(source),matches=session.midiData.tracks.filter(track=>track.id==='external-strings'),before=JSON.stringify(session.midiData.tracks);
  assert.equal(matches.length,2);assert.equal(core.selectTrackById(session,'external-strings'),true);assert.equal(core.currentTrack(session),matches[0]);assert.equal(JSON.stringify(session.midiData.tracks),before)
});

test('Undo and Redo preserve runtime selectedTrackId while core editing stays compatible',()=>{
  const core=load(),session=core.createSession(project());core.selectTrackById(session,'bass-custom');core.selectNote(session,'b');core.updateNote(session,'b',{velocity:81});
  assert.equal(session.selectedTrackId,'bass-custom');assert.equal(core.currentTrack(session).notes[0].velocity,81);core.undo(session);
  assert.equal(session.selectedTrackId,'bass-custom');assert.equal(session.part,'bass');assert.equal(core.currentTrack(session).notes[0].velocity,80);core.redo(session);
  assert.equal(session.selectedTrackId,'bass-custom');assert.equal(core.currentTrack(session).notes[0].velocity,81)
});

test('runtime selection never changes Project JSON track fields or persistent shape',()=>{
  const core=load(),session=core.createSession(project()),shape=plain(session.midiData),unknownBefore=plain(session.midiData.tracks.find(track=>track.id==='external-strings'));
  core.selectTrackById(session,'external-strings');assert.deepEqual(plain(session.midiData),shape);assert.deepEqual(plain(session.midiData.tracks.find(track=>track.id==='external-strings')),unknownBefore);
  for(const container of [session.midiData,session.savedMidiData,...session.midiData.tracks])assert.equal(Object.hasOwn(container,'selectedTrackId'),false)
});

test('addNotesToTrack writes only the first exact Track ID and preserves unknown fields',()=>{
  const core=load(),source=project();source.midiData.tracks.push({id:'external-strings',name:'Duplicate',channel:4,notes:[]});const session=core.createSession(source),matches=session.midiData.tracks.filter(track=>track.id==='external-strings'),metadata=plain(matches[0]);
  core.selectTrackById(session,'external-strings');core.addNotesToTrack(session,'external-strings',[{id:'recorded',pitch:75,startTick:240,durationTicks:120,velocity:99,inputChannel:10,extension:{keep:true}}]);assert.equal(matches[0].notes.length,2);assert.equal(matches[1].notes.length,0);assert.deepEqual(plain(matches[0].notes[1]),{id:'recorded',pitch:75,startTick:240,durationTicks:120,velocity:99,locked:false,inputChannel:10,extension:{keep:true}});assert.deepEqual(plain({...matches[0],notes:metadata.notes}),metadata);assert.deepEqual(Array.from(session.selectedNoteIds),['recorded']);core.undo(session);assert.equal(core.getTrackById(session.midiData.tracks,'external-strings').notes.length,1);core.redo(session);assert.equal(core.getTrackById(session.midiData.tracks,'external-strings').notes.length,2)
});

test('addNotesToTrack ignores invalid IDs without changing session state',()=>{
  const core=load(),session=core.createSession(project());for(const id of ['missing','',null,42]){const before=JSON.stringify(session);assert.equal(core.addNotesToTrack(session,id,[{pitch:60,startTick:0}]),session);assert.equal(JSON.stringify(session),before)}
});
