const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(){return{projectId:'dynamic-playback',midiData:{ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},editor:{measureCount:4,transport:{countInEnabled:true,metronomeEnabled:true}},tracks:[
  {id:'core-melody',part:'melody',name:'Melody',channel:1,program:0,notes:[{id:'m',pitch:60,startTick:0,durationTicks:480,velocity:90}]},
  {id:'core-drums',part:'drums',name:'Drums',channel:10,program:null,notes:[{id:'d',pitch:36,startTick:0,durationTicks:120,velocity:100}]},
  {id:'core-bass',part:'bass',name:'Bass',channel:2,program:32,notes:[{id:'b',pitch:40,startTick:0,durationTicks:960,velocity:80}]},
  {id:'ext-a',name:'Strings',trackType:'midi-melodic',roleAssignment:'strings',channel:3,program:48,notes:[{id:'a',pitch:72,startTick:0,durationTicks:480,velocity:70}]},
  {id:'ext-b',name:'Strings',trackType:'midi-melodic',roleAssignment:'strings',channel:4,program:49,notes:[{id:'b2',pitch:74,startTick:480,durationTicks:480,velocity:71}]},
  {id:'ext-drums',name:'Imported Drums',trackType:'midi-drums',roleAssignment:'unassigned',channel:10,notes:[{id:'ed',pitch:38,startTick:0,durationTicks:120,velocity:95}]}
]}}}

function load(selectedId='ext-b'){
  const window={crypto:{randomUUID:(()=>{let i=0;return()=>`id-${++i}`})()}};window.window=window;window.globalThis=window;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-playback.js'),'utf8'),window);
  const core=window.MusicStudioEditor,session=core.createSession(fixture());core.selectTrackById(session,selectedId);
  let originalToggleCalls=0,shortcutCalls=0,scheduledTracks=[];
  const synth={supported:()=>true,unlock:async()=>true,stopPlayback:()=>{},playTracks:(tracks,timing)=>{scheduledTracks=plain(tracks);const notes=tracks.flatMap(track=>track.notes||[]);return{ok:true,trackCount:tracks.length,noteCount:notes.length,durationMs:10,playbackStart:0,secondsPerTick:.001,timelineDurationSeconds:.01,tempoMap:timing.tempoMap||[],startTick:Number(timing.startTick)||0,endTick:Number(timing.endTick)||1920,scheduledNotes:notes}}};
  window.MusicStudioAudio={createSynth:()=>synth};
  window.MusicStudio={
    __dynamicTrackSelectionInstalled:true,
    state:{midiEditor:session,midiInput:{recording:false,countingIn:false},melodyAudio:{synth:null,playing:false,starting:false,playRequest:0,playbackTimer:null,playbackFrame:null,playbackState:{mutedByTrackId:{},soloByTrackId:{}},transport:null,status:''}},
    resolveCurrentTrackSelection(){const track=core.currentTrack(session),caps=core.resolveTrackCapabilities(track);return{id:track.id,name:core.resolveTrackDisplayName(track),kind:core.resolveCoreTrackSlot(track)?'core':'external',capabilities:caps}},
    editorToggleMelodyPlayback(){originalToggleCalls++;return{ok:true,source:'core'}},
    editorHandleShortcut(){shortcutCalls++;return'original-shortcut'}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-playback.js'),'utf8'),window);
  return{window,core,session,api:window.MusicStudio,get originalToggleCalls(){return originalToggleCalls},get shortcutCalls(){return shortcutCalls},get scheduledTracks(){return scheduledTracks}}
}

test('selected External MIDI Track resolves by exact Track ID without mutating source data',()=>{
  const env=load('ext-b'),before=JSON.stringify(env.session.midiData),track=env.api.resolveExternalPlaybackTrack();
  assert.equal(track.id,'ext-b');assert.equal(track.part,'melody');assert.deepEqual(Array.from(track.notes,note=>note.id),['b2']);assert.equal(JSON.stringify(env.session.midiData),before)
});

test('External drum MIDI routes to drum playback while retaining exact source Track ID',()=>{
  const env=load('ext-drums'),track=env.api.resolveExternalPlaybackTrack();assert.equal(track.id,'ext-drums');assert.equal(track.part,'drums');assert.equal(env.session.midiData.tracks.find(item=>item.id==='ext-drums').part,undefined)
});

test('External playback schedules only the selected Track and preserves MIDI project data',async()=>{
  const env=load('ext-b'),before=JSON.stringify(env.session.midiData),result=await env.api.editorToggleMelodyPlayback();
  assert.equal(result.ok,true);assert.equal(result.noteCount,1);assert.deepEqual(Array.from(env.scheduledTracks,track=>track.id),['ext-b']);assert.deepEqual(Array.from(env.api.state.melodyAudio.transport.activePlaybackTrackIds),['ext-b']);assert.equal(JSON.stringify(env.session.midiData),before);assert.equal(env.originalToggleCalls,0)
});

test('Core Melody Drums Bass playback remains delegated to the existing transport',async()=>{
  const env=load('core-drums'),result=await env.api.editorToggleMelodyPlayback();assert.equal(result.source,'core');assert.equal(env.originalToggleCalls,1);assert.equal(env.scheduledTracks.length,0)
});

test('Stop while External playback is active delegates to the existing transport stop path',async()=>{
  const env=load('ext-a');env.api.state.melodyAudio.playing=true;const result=await env.api.editorToggleMelodyPlayback();assert.equal(result.source,'core');assert.equal(env.originalToggleCalls,1)
});

test('Space shortcut is restored for External playback without opening other gated shortcuts',()=>{
  const env=load('ext-a');let prevented=false;const handled=env.api.editorHandleShortcut({key:' ',preventDefault(){prevented=true}});assert.equal(handled,true);assert.equal(prevented,true);assert.equal(env.shortcutCalls,0);
  assert.equal(env.api.editorHandleShortcut({key:'Delete'}),'original-shortcut');assert.equal(env.shortcutCalls,1)
});

test('Dynamic Playback does not widen Recording Correction Partial Edit or Track assignment scope',()=>{
  const playback=fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-playback.js'),'utf8'),selection=fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.js'),'utf8');
  assert.doesNotMatch(playback,/editorToggleMidiRecording\s*=/);assert.doesNotMatch(playback,/editorPreviewCorrection\s*=/);assert.doesNotMatch(playback,/editorStartPartialEdit\s*=/);assert.doesNotMatch(playback,/roleAssignment\s*=/);
  for(const action of ['editorToggleMidiRecording','editorStartPartialEdit','editorPreviewCorrection'])assert.ok(selection.includes(`'${action}'`))
});

test('Nova Studio host and standalone Music Studio load playback routing after Dynamic Track Selection',()=>{
  for(const file of ['index.html','music-studio.html']){const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8'),selection=html.indexOf('music-studio-dynamic-track-selection.js'),playback=html.indexOf('music-studio-dynamic-track-playback.js');assert.ok(selection>=0);assert.ok(playback>selection)}
});

test('Playback routing keeps project schema and app version unchanged',()=>{
  const app=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');assert.match(app,/const SCHEMA_VERSION='1\.0'/);assert.match(app,/const APP_VERSION='1\.4\.0'/)
});
