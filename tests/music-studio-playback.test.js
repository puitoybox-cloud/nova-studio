const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(){const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-playback.js'),'utf8'),{window,globalThis:window},{filename:'music-studio-playback.js'});return window.MusicStudioPlayback}
function tracks(){return[
  {id:'melody',part:'melody',name:'Melody',channel:1,program:0,muted:false,notes:[{id:'m',pitch:64,startTick:0,durationTicks:480,velocity:91,locked:true}]},
  {id:'drums',part:'drums',name:'Drums',channel:10,program:null,muted:false,notes:[{id:'d',pitch:38,startTick:240,durationTicks:120,velocity:112,gmName:'Acoustic Snare'}]},
  {id:'bass',part:'bass',name:'Bass',channel:2,program:32,muted:false,notes:[{id:'b',pitch:40,startTick:0,durationTicks:960,velocity:83,transpose:0}]}
]}

test('Melody Drums and Bass produce immutable common playback descriptors',()=>{const playback=load(),input=tracks(),before=JSON.stringify(input),descriptors=playback.createPlaybackDescriptors(input);assert.deepEqual(JSON.parse(JSON.stringify(descriptors.map(track=>[track.id,track.part,track.role,track.channel,track.program]))),[['melody','melody','melody',1,0],['drums','drums','drums',10,null],['bass','bass','bass',2,32]]);assert.deepEqual(JSON.parse(JSON.stringify(descriptors[1].notes[0])),input[1].notes[0]);descriptors[0].notes[0].pitch=1;assert.equal(input[0].notes[0].pitch,64);assert.equal(JSON.stringify(input),before)});

test('muted tracks are excluded and solo selects only eligible audible tracks',()=>{const playback=load(),input=tracks(),runtime={mutedByTrackId:{bass:true},soloByTrackId:{drums:true,bass:true}},descriptors=playback.createPlaybackDescriptors(input,runtime),active=playback.activePlaybackTracks(input,runtime);assert.deepEqual(active.map(track=>track.id),['drums']);assert.equal(descriptors.find(track=>track.id==='bass').muted,true);assert.equal(input[2].muted,false)});

test('solo is derived only from runtime state and ignores persisted-looking track fields',()=>{const playback=load(),input=tracks();input[0].solo=true;const runtime={soloByTrackId:{bass:true}},before=JSON.stringify(input),withoutRuntime=playback.createPlaybackDescriptors(input),withRuntime=playback.createPlaybackDescriptors(input,runtime);assert.deepEqual(withoutRuntime.map(track=>track.solo),[false,false,false]);assert.deepEqual(withRuntime.map(track=>track.solo),[false,false,true]);assert.deepEqual(playback.activePlaybackTracks(input,runtime).map(track=>track.id),['bass']);assert.equal(JSON.stringify(input),before)});

test('without solo every unmuted descriptor remains active',()=>{const playback=load(),input=tracks();input[1].muted=true;assert.deepEqual(playback.activePlaybackTracks(input).map(track=>track.id),['melody','bass'])});
test('a muted solo stays authoritative and never falls back to non-solo tracks',()=>{const playback=load(),input=tracks(),runtime={soloByTrackId:{bass:true},mutedByTrackId:{bass:true}};assert.deepEqual(playback.activePlaybackTracks(input,runtime).map(track=>track.id),[])});

test('transport owns timing loop origin and active track ids without track-specific state',()=>{const playback=load(),input=tracks(),midiData={ppq:960,tempo:132,editor:{loopEnabled:true,loopStart:480,loopEnd:1920},tracks:input},before=JSON.stringify(midiData),transport=playback.createTransportState(midiData,{playing:true,currentTick:720,playbackStartOrigin:12.5,soloByTrackId:{bass:true}});assert.deepEqual(JSON.parse(JSON.stringify(transport)),{playing:true,currentTick:720,ppq:960,bpm:132,tempoMap:[{tick:0,bpm:132,microsecondsPerQuarter:454545,track:0}],loopEnabled:true,loopStart:480,loopEnd:1920,playbackStartOrigin:12.5,activePlaybackTrackIds:['bass']});assert.equal(JSON.stringify(midiData),before)});

test('scheduler boundary delegates active descriptors to the existing shared scheduler',()=>{const playback=load(),input=tracks(),calls=[],synth={playTracks(active,timing){calls.push({active,timing});return{ok:true,trackCount:active.length,noteCount:active.reduce((count,track)=>count+track.notes.length,0)}}},result=playback.schedulePlaybackTracks(synth,input,{ppq:480,bpm:120,currentTick:240,endTick:960,startTime:10,playbackState:{mutedByTrackId:{drums:true}}});assert.deepEqual(calls[0].active.map(track=>track.id),['melody','bass']);assert.deepEqual(JSON.parse(JSON.stringify(calls[0].timing)),{ppq:480,tempo:120,startTick:240,endTick:960,startTime:10});assert.deepEqual(result,{ok:true,trackCount:2,noteCount:2})});

test('tempo timeline sorts deduplicates and integrates time before after and inside a loop',()=>{const playback=load(),map=playback.normalizeTempoMap([{tick:1920,bpm:60},{tick:1920,bpm:90},{tick:960,bpm:137.5},{tick:0,bpm:80}],120);assert.equal(JSON.stringify(map.map(item=>[item.tick,item.bpm])),JSON.stringify([[0,120],[960,137.5],[1920,90]]));const full=playback.tickDurationSeconds(0,2400,480,map,120),loop=playback.tickDurationSeconds(1200,2160,480,map,120),expected=960*60/(120*480)+960*60/(137.5*480)+480*60/(90*480);assert.ok(Math.abs(full-expected)<1e-9);assert.ok(Math.abs(playback.tickAtSeconds(0,full,480,map,120)-2400)<1e-7);assert.ok(loop>0)});

test('project and application versions remain on the Version 1 contract',()=>{const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');assert.match(source,/const SCHEMA_VERSION='1\.0'/);assert.match(source,/const APP_VERSION='1\.4\.0'/)});
