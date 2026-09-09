const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(){
  const window={crypto:{randomUUID:(()=>{let i=0;return()=>`id-${++i}`})()}};window.window=window;window.globalThis=window;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.js'),'utf8'),window);
  return{core:window.MusicStudioEditor,selection:window.MusicStudioDynamicTrackSelection}
}
const plain=value=>JSON.parse(JSON.stringify(value));
function project(){return{projectId:'dynamic-selection',midiData:{tracks:[
  {id:'core-melody',part:'melody',name:'Melody',channel:1,program:0,muted:false,notes:[{id:'m',pitch:60,startTick:0,durationTicks:480,velocity:90}]},
  {id:'core-drums',part:'drums',name:'Drums',channel:10,program:null,muted:false,notes:[{id:'d',pitch:36,startTick:0,durationTicks:120,velocity:100}]},
  {id:'core-bass',part:'bass',name:'Bass',channel:2,program:32,muted:false,notes:[{id:'b',pitch:40,startTick:0,durationTicks:960,velocity:80}]},
  {id:'ext-a',name:'Strings',trackType:'midi-melodic',roleAssignment:'strings',channel:3,program:48,order:4,custom:{keep:'a'},notes:[{id:'a',pitch:72,startTick:0,durationTicks:480,velocity:70}]},
  {id:'ext-b',name:'Strings',trackType:'midi-melodic',roleAssignment:'strings',channel:4,program:49,order:5,custom:{keep:'b'},notes:[{id:'b2',pitch:74,startTick:480,durationTicks:480,velocity:71}]},
  {id:'audio-ref',name:'Audio',trackType:'audio',roleAssignment:'vocal',notes:[]}
]}}}

test('Core Melody Drums Bass are first-class selection targets in compatibility order',()=>{
  const{core,selection}=load(),session=core.createSession(project()),model=selection.createSelectionModel(session,core);
  assert.deepEqual(Array.from(model.slice(0,3),item=>[item.id,item.coreSlot,item.kind]),[['core-melody','melody','core'],['core-drums','drums','core'],['core-bass','bass','core']]);
  assert.equal(model[0].selected,true)
});

test('External MIDI Tracks are selectable while audio is excluded from MIDI Track selection',()=>{
  const{core,selection}=load(),session=core.createSession(project()),model=selection.createSelectionModel(session,core);
  assert.deepEqual(Array.from(model,item=>item.id),['core-melody','core-drums','core-bass','ext-a','ext-b']);
  assert.equal(model.find(item=>item.id==='ext-a').kind,'external');assert.equal(model.some(item=>item.id==='audio-ref'),false)
});

test('Track selection uses exact Track ID even when names and roleAssignment are identical',()=>{
  const{core,selection}=load(),session=core.createSession(project());
  assert.equal(core.selectTrackById(session,'ext-b'),true);const current=selection.resolveCurrentSelection(session,core);
  assert.equal(current.id,'ext-b');assert.equal(current.name,'Strings');assert.equal(current.role,'strings');assert.equal(selection.createSelectionModel(session,core).find(item=>item.id==='ext-a').selected,false)
});

test('Current Track resolves by selected Track ID and invalid runtime IDs safely fall back to Core Track',()=>{
  const{core,selection}=load(),session=core.createSession(project());core.selectTrackById(session,'ext-a');assert.equal(selection.resolveCurrentSelection(session,core).id,'ext-a');
  session.selectedTrackId='missing';assert.equal(core.currentTrack(session).id,'core-melody');assert.equal(selection.resolveCurrentSelection(session,core).id,'core-melody')
});

test('External selection preserves Track data roleAssignment Core Tracks and note identity without copies',()=>{
  const{core,selection}=load(),session=core.createSession(project()),before=plain(session.midiData),api={state:{midiEditor:session,partialEditSession:{kept:true},midiMultiSelect:true}};
  assert.equal(selection.selectTrack('ext-b',api,core,null),true);assert.equal(session.selectedTrackId,'ext-b');assert.deepEqual(plain(session.midiData),before);
  assert.equal(session.midiData.tracks.find(track=>track.id==='ext-b').roleAssignment,'strings');assert.deepEqual(Array.from(session.midiData.tracks.find(track=>track.id==='ext-b').notes,note=>note.id),['b2']);
  assert.deepEqual(Array.from(session.midiData.tracks.find(track=>track.id==='core-melody').notes,note=>note.id),['m']);assert.deepEqual(Array.from(session.midiData.tracks.find(track=>track.id==='core-drums').notes,note=>note.id),['d']);assert.deepEqual(Array.from(session.midiData.tracks.find(track=>track.id==='core-bass').notes,note=>note.id),['b'])
});

test('invalid Track ID selection is rejected without any session mutation',()=>{
  const{core,selection}=load(),session=core.createSession(project()),api={state:{midiEditor:session}},before=JSON.stringify(session);
  assert.equal(selection.selectTrack('missing',api,core,null),false);assert.equal(JSON.stringify(session),before)
});

test('runtime Track selection does not persist and Save Reload data remains byte-equivalent',()=>{
  const{core}=load(),session=core.createSession(project()),saved=JSON.stringify(session.midiData);core.selectTrackById(session,'ext-a');
  assert.equal(JSON.stringify(session.midiData),saved);const reloaded=core.createSession({projectId:'reload',midiData:JSON.parse(saved)});assert.equal(reloaded.selectedTrackId,'core-melody');assert.equal(JSON.stringify(reloaded.midiData),saved)
});

test('Capability Registry is carried into UI model without promoting External roles to Core slots',()=>{
  const{core,selection}=load(),session=core.createSession(project()),external=selection.createSelectionModel(session,core).find(item=>item.id==='ext-a');
  assert.equal(external.capabilities.canEditNotes,true);assert.equal(external.capabilities.canPlayMidi,true);assert.equal(external.capabilities.supportsPartialEdit,false);assert.equal(external.coreSlot,null)
});

test('Mute Solo integration keeps existing exact Track-ID handlers for Core Track controls',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.js'),'utf8');
  assert.match(source,/editorSetTrackMuted\(item\.id,!muted\)/);assert.match(source,/editorSetTrackSolo\(item\.id,!solo\)/);assert.doesNotMatch(source,/api\.editorSetTrackMuted\s*=/);assert.doesNotMatch(source,/api\.editorSetTrackSolo\s*=/)
});

test('Review Assignment UI remains separate from Selection UI',()=>{
  const app=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8'),selection=fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.js'),'utf8');
  assert.match(app,/External Track Review \/ Assignment/);assert.match(app,/editorApplyExternalTrackAssignments/);assert.doesNotMatch(selection,/roleAssignment\s*=/);assert.doesNotMatch(selection,/applyExternalTrackAssignments/)
});

test('External selection gates editing playback recording correction and Partial Edit without changing Core APIs',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.js'),'utf8');
  for(const action of ['editorAddNote','editorToggleMidiRecording','editorToggleMelodyPlayback','editorStartPartialEdit','editorPreviewCorrection'])assert.ok(source.includes(`'${action}'`));
  assert.match(source,/core-track-required/);assert.match(source,/supportsPartialEdit/)
});

test('All MIDI Export path remains all-track based and is not rewritten as roleAssignment selection',()=>{
  const app=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');
  assert.match(app,/scope==='all'\|\|track\.part===scope/);assert.match(app,/const MIDI_EXPORT_SCOPES=\{melody:'Melody',drums:'Drums',bass:'Bass',all:'All'\}/)
});

test('responsive Track strip is one row at 1440 820 and 390 boundaries without vertical Track stacking',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.css'),'utf8');
  assert.match(css,/flex-wrap:nowrap/);assert.match(css,/overflow-x:auto/);assert.match(css,/@media \(max-width:820px\)/);assert.match(css,/@media \(max-width:390px\)/);assert.doesNotMatch(css,/flex-direction\s*:\s*column/)
});

test('standalone HTML loads Dynamic Selection CSS and JS after the existing editor stack',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','music-studio.html'),'utf8');
  assert.match(html,/music-studio-dynamic-track-selection\.css\?v=1\.0\.0/);assert.match(html,/music-studio-dynamic-track-selection\.js\?v=1\.0\.0/);
  assert.ok(html.indexOf('music-studio.js?v=1.4.98')<html.indexOf('music-studio-dynamic-track-selection.js?v=1.0.0'))
});
