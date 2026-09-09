const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function fixture(){return{midiData:{tracks:[
  {id:'melody',part:'melody',name:'Melody',notes:[]},
  {id:'drums',part:'drums',name:'Drums',channel:10,notes:[]},
  {id:'bass',part:'bass',name:'Bass',notes:[]},
  {id:'ext-a',name:'Duplicate',trackType:'midi-melodic',roleAssignment:'strings',notes:[{id:'a',pitch:60,startTick:0,durationTicks:120,velocity:80}]},
  {id:'ext-b',name:'Duplicate',trackType:'midi-melodic',roleAssignment:'strings',notes:[{id:'b',pitch:62,startTick:0,durationTicks:120,velocity:80}]},
  {id:'ext-drums',name:'External Drums',trackType:'midi-drums',roleAssignment:'unassigned',channel:10,notes:[{id:'d',pitch:36,startTick:0,durationTicks:120,velocity:100}]},
  {id:'audio',name:'Audio',trackType:'audio',roleAssignment:'other',notes:[]}
]},selectedTrackId:'ext-b',part:'melody'} }

function load(selectedTrackId='ext-b'){
  const window={};window.window=window;window.globalThis=window;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);
  const core=window.MusicStudioEditor,session=fixture();session.selectedTrackId=selectedTrackId;
  let starts=0,stops=0,coreToggles=0;
  window.MusicStudio={
    state:{midiEditor:session,midiInput:{recording:false,countingIn:false,starting:false,stopping:false,recordingTrackId:null}},
    resolveCurrentTrackSelection(){
      const track=core.getTrackById(session.midiData.tracks,session.selectedTrackId);if(!track)return null;
      const caps=core.resolveTrackCapabilities(track),slot=core.resolveCoreTrackSlot(track);
      return{id:track.id,name:track.name,kind:slot?'core':'external',capabilities:caps}
    },
    async editorStartMidiRecording(){starts++;this.state.midiInput.recording=true;this.state.midiInput.recordingTrackId=session.selectedTrackId;return{ok:true,recording:true,targetTrackId:session.selectedTrackId}},
    async editorStopTransport(){stops++;this.state.midiInput.recording=false;this.state.midiInput.recordingTrackId=null;return{ok:true,stopped:true}},
    editorToggleMidiRecording(){coreToggles++;return{ok:true,source:'core'}}
  };
  window.MusicStudio.__dynamicTrackSelectionInstalled=true;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-recording.js'),'utf8'),window);
  return{window,api:window.MusicStudio,core,session,get starts(){return starts},get stops(){return stops},get coreToggles(){return coreToggles}}
}

test('External melodic recording resolves exact selected Track ID with duplicate display name and duplicate role',async()=>{
  const env=load('ext-b'),destination=env.api.resolveRecordingDestination();
  assert.equal(destination.trackId,'ext-b');assert.equal(destination.canRecordMidi,true);
  const result=await env.api.editorStartMidiRecording();assert.equal(result.ok,true);assert.equal(env.api.state.midiInput.recordingTrackId,'ext-b');assert.equal(env.starts,1);
  assert.equal(env.session.midiData.tracks.find(track=>track.id==='ext-a').notes.length,1);assert.equal(env.session.midiData.tracks.find(track=>track.id==='ext-b').notes.length,1)
});

test('External drum recording uses the selected drum Track ID instead of Core Drums',async()=>{
  const env=load('ext-drums');const result=await env.api.editorToggleMidiRecording();assert.equal(result.ok,true);assert.equal(env.api.state.midiInput.recordingTrackId,'ext-drums');assert.equal(env.coreToggles,0)
});

test('External recording Stop delegates to the existing transport stop path',async()=>{
  const env=load('ext-b');await env.api.editorToggleMidiRecording();const result=await env.api.editorToggleMidiRecording();assert.equal(result.stopped,true);assert.equal(env.stops,1);assert.equal(env.api.state.midiInput.recording,false)
});

test('Core Melody Drums Bass remain delegated to the existing recording toggle',()=>{
  for(const id of ['melody','drums','bass']){const env=load(id),result=env.api.editorToggleMidiRecording();assert.equal(result.source,'core');assert.equal(env.coreToggles,1);assert.equal(env.starts,0)}
});

test('Recording capability gate rejects a selected Track without canRecordMidi',async()=>{
  const env=load('audio'),destination=env.api.resolveRecordingDestination();assert.equal(destination.canRecordMidi,false);const result=await env.api.editorStartMidiRecording();assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:false,reason:'recording-capability-required',targetTrackId:'audio'});assert.equal(env.starts,0)
});

test('Selection gate no longer blocks recording while Correction and Partial Edit remain gated',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.js'),'utf8');
  const blocked=source.match(/const BLOCKED_EXTERNAL_ACTIONS=\[([\s\S]*?)\];/)?.[1]||'';
  assert.doesNotMatch(blocked,/editorToggleMidiRecording/);assert.doesNotMatch(blocked,/editorStartMidiRecording/);
  for(const action of ['editorPreviewCorrection','editorStartPartialEdit'])assert.match(blocked,new RegExp(`'${action}'`))
});

test('Existing recording engine commits by exact recordingTrackId and preserves fallback only for legacy missing selection',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');
  assert.match(source,/selectedTrack=editor\?\.getTrackById\?\.\(state\.midiEditor\.midiData\.tracks,state\.midiEditor\.selectedTrackId\)/);
  assert.match(source,/midi\.recordingTrackId=targetTrack\?\.id\|\|null/);
  assert.match(source,/commitRecordedNotes\(midi\.recorder,stoppedAt,offset,targetTrackId,targetPart\)/);
  assert.match(source,/editor\?\.addNotesToTrack\)editor\.addNotesToTrack\(state\.midiEditor,trackId,notes\)/)
});

test('Dynamic Recording does not widen Correction Partial Edit Assignment schema or version scope',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-recording.js'),'utf8'),app=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');
  assert.doesNotMatch(source,/editorPreviewCorrection\s*=/);assert.doesNotMatch(source,/editorStartPartialEdit\s*=/);assert.doesNotMatch(source,/roleAssignment\s*=/);assert.doesNotMatch(source,/schemaVersion\s*=/);
  assert.match(app,/const SCHEMA_VERSION='1\.0'/);assert.match(app,/const APP_VERSION='1\.4\.0'/)
});

test('Nova Studio host and standalone load Selection then Playback then Recording routing',()=>{
  for(const file of ['index.html','music-studio.html']){const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8'),selection=html.indexOf('music-studio-dynamic-track-selection.js?v=1.0.1'),playback=html.indexOf('music-studio-dynamic-track-playback.js?v=1.0.1'),recording=html.indexOf('music-studio-dynamic-track-recording.js?v=1.0.0');assert.ok(selection>=0);assert.ok(playback>selection);assert.ok(recording>playback)}
});
