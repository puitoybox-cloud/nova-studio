const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(){
  const window={};window.window=window;window.globalThis=window;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-audio.js'),'utf8'),window);
  return window.MusicStudioAudio;
}
class Param{
  constructor(){this.value=0;this.events=[]}
  setValueAtTime(value,time){this.value=value;this.events.push(['set',value,time])}
  linearRampToValueAtTime(value,time){this.value=value;this.events.push(['ramp',value,time])}
  cancelScheduledValues(time){this.events.push(['cancel',time])}
  cancelAndHoldAtTime(time){this.events.push(['hold',time])}
}
class Node{constructor(){this.connections=[]}connect(target){this.connections.push(target)}}
class Oscillator extends Node{
  constructor(){super();this.frequency=new Param();this.started=[];this.stopped=[];this.type=''}
  start(time){this.started.push(time)}
  stop(time){this.stopped.push(time)}
}
class Gain extends Node{constructor(){super();this.gain=new Param()}}
class Context{
  constructor(){this.currentTime=10;this.state='suspended';this.destination={};this.oscillators=[];this.gains=[]}
  createOscillator(){const value=new Oscillator();this.oscillators.push(value);return value}
  createGain(){const value=new Gain();this.gains.push(value);return value}
  async resume(){this.state='running'}
  close(){}
}

test('preview synth uses a safe 12 percent master volume and unlocks on demand',async()=>{
  const audio=load(),synth=audio.createSynth({AudioContext:Context});
  assert.equal(synth.volume,.12);assert.equal(await synth.unlock(),true);assert.equal(synth.context.state,'running');
  assert.equal(synth.context.gains[0].gain.events[0][1],.12);
});
test('MIDI note-on and note-off create and release the matching Web Audio voice',async()=>{
  const synth=load().createSynth({AudioContext:Context});await synth.unlock();
  assert.equal(synth.noteOn(69,100,2),true);assert.equal(synth.context.oscillators[0].frequency.events[0][1],440);
  assert.equal(synth.noteOff(69,2),true);assert.ok(synth.context.oscillators[0].stopped.length>0);
});
test('duplicate Note On while a key is held creates only one oscillator',async()=>{
  const synth=load().createSynth({AudioContext:Context});await synth.unlock();
  assert.equal(synth.noteOn(60,90,1),true);
  assert.equal(synth.noteOn(60,90,1),false);
  assert.equal(synth.context.oscillators.length,1);
  assert.equal(synth.liveVoices,1);
  assert.equal(synth.noteOff(60,1),true);
  assert.equal(synth.noteOff(60,1),false);
  assert.equal(synth.liveVoices,0);
});
test('the same key can sound once per press before during and after recording lifecycle',async()=>{
  const synth=load().createSynth({AudioContext:Context});await synth.unlock();
  for(let phase=0;phase<3;phase++){
    assert.equal(synth.noteOn(64,88,1),true);
    assert.equal(synth.noteOn(64,88,1),false);
    assert.equal(synth.noteOff(64,1),true);
  }
  assert.equal(synth.context.oscillators.length,3);
  assert.equal(synth.liveVoices,0);
  assert.equal(synth.context.oscillators.every(oscillator=>oscillator.stopped.length===1),true);
});
test('metronome reuses the synth AudioContext with a stronger higher downbeat',async()=>{
  const synth=load().createSynth({AudioContext:Context});await synth.unlock();const context=synth.context;
  assert.equal(synth.metronomeClick(true),true);assert.equal(synth.metronomeClick(false),true);
  assert.equal(synth.context,context);assert.equal(context.oscillators.length,2);
  assert.equal(context.oscillators[0].frequency.events[0][1],1560);assert.equal(context.oscillators[1].frequency.events[0][1],1040);
  assert.equal(synth.diagnostics.metronomeClicks,2);synth.stopMetronome();
});
test('Melody playback schedules notes from PPQ and tempo without changing note data',async()=>{
  const synth=load().createSynth({AudioContext:Context}),notes=[{pitch:60,startTick:480,durationTicks:240,velocity:80}],before=JSON.stringify(notes);await synth.unlock();
  const result=synth.playNotes(notes,{ppq:480,tempo:120}),oscillator=synth.context.oscillators[0];
  assert.equal(result.ok,true);assert.equal(result.noteCount,1);assert.equal(JSON.stringify(notes),before);
  assert.equal(result.oscillatorCount,1);assert.equal(oscillator.type,'sine');
  assert.equal(result.playbackStart,10.04);assert.equal(result.secondsPerTick,60/(120*480));assert.equal(result.endTick,720);
  assert.equal(Math.round(oscillator.started[0]*100)/100,10.54);assert.ok(result.durationMs>800&&result.durationMs<1000);
  synth.stopPlayback();assert.equal(synth.playingVoices,0);
});
test('absolute playback start keeps a full count-in on the shared running context and master output',async()=>{
  const synth=load().createSynth({AudioContext:Context});await synth.unlock();const context=synth.context;
  const result=synth.playNotes([{pitch:60,startTick:0,durationTicks:480,velocity:80}],{ppq:480,tempo:120,startTime:12});
  assert.equal(context.state,'running');assert.equal(result.playbackStart,12);assert.equal(result.durationMs,2650);assert.equal(context.oscillators[0].started[0],12);assert.equal(context.oscillators[0].connections[0],context.gains[1]);assert.equal(context.gains[1].connections[0],context.gains[0]);assert.equal(context.gains[0].connections[0],context.destination);
  synth.stopPlayback();assert.equal(synth.playingVoices,0);
});
test('absolute playback start is never scheduled before AudioContext currentTime',async()=>{
  const synth=load().createSynth({AudioContext:Context});await synth.unlock();
  const result=synth.playNotes([{pitch:60,startTick:0,durationTicks:120,velocity:80}],{ppq:480,tempo:120,startTime:9});
  assert.equal(result.playbackStart,10);assert.equal(synth.context.oscillators[0].started[0],10);
});
test('Melody playback can start from a moved playhead without inventing notes',async()=>{
  const synth=load().createSynth({AudioContext:Context}),notes=[
    {pitch:60,startTick:0,durationTicks:240,velocity:80},
    {pitch:64,startTick:480,durationTicks:480,velocity:90}
  ];await synth.unlock();
  const result=synth.playNotes(notes,{ppq:480,tempo:120,startTick:600});
  assert.equal(result.startTick,600);assert.equal(result.endTick,960);assert.equal(result.noteCount,1);
  assert.equal(synth.context.oscillators.length,1);
  assert.equal(Math.round(synth.context.oscillators[0].started[0]*100)/100,10.04);
});
test('bounded playback clips crossing notes and excludes notes outside the loop',async()=>{
  const synth=load().createSynth({AudioContext:Context}),notes=[
    {pitch:60,startTick:0,durationTicks:720,velocity:80},
    {pitch:64,startTick:720,durationTicks:480,velocity:90},
    {pitch:67,startTick:1440,durationTicks:240,velocity:90}
  ];await synth.unlock();
  const result=synth.playNotes(notes,{ppq:480,tempo:120,startTick:480,endTick:960});
  assert.equal(result.noteCount,2);assert.equal(result.startTick,480);assert.equal(result.endTick,960);assert.equal(synth.context.oscillators.length,2);
  assert.ok(synth.context.oscillators.every(item=>item.stopped[0]<=10.68));
});
test('track-aware playback preserves track and note identity on one shared timeline',async()=>{
  const synth=load().createSynth({AudioContext:Context}),tracks=[
    {id:'melody',part:'melody',channel:1,program:0,notes:[{id:'m1',pitch:60,startTick:480,durationTicks:240,velocity:81}]},
    {id:'drums',part:'drums',channel:10,program:null,notes:[{id:'d1',pitch:38,startTick:480,durationTicks:120,velocity:111}]},
    {id:'bass',part:'bass',channel:2,program:32,notes:[{id:'b1',pitch:28,startTick:480,durationTicks:480,velocity:92}]}
  ],before=JSON.stringify(tracks);await synth.unlock();const result=synth.playTracks(tracks,{ppq:480,tempo:120});
  assert.equal(result.ok,true);assert.equal(result.trackCount,3);assert.equal(result.noteCount,3);assert.equal(result.oscillatorCount,2);assert.equal(JSON.stringify(tracks),before);
  assert.deepEqual(JSON.parse(JSON.stringify(result.scheduledNotes.map(note=>[note.trackId,note.part,note.channel,note.program,note.noteId,note.pitch,note.startTick,note.durationTicks,note.velocity,note.audible]))),[
    ['melody','melody',1,0,'m1',60,480,240,81,true],['drums','drums',10,null,'d1',38,480,120,111,false],['bass','bass',2,32,'b1',28,480,480,92,true]
  ]);
  assert.equal(new Set(result.scheduledNotes.map(note=>note.startTime)).size,1);
});
test('track-aware loop bounds share one range and retain Drums duration without synthesizing it',async()=>{
  const synth=load().createSynth({AudioContext:Context});await synth.unlock();const result=synth.playTracks([
    {id:'drums',part:'drums',channel:10,program:null,notes:[{id:'crossing-drum',pitch:46,startTick:360,durationTicks:480,velocity:105}]},
    {id:'bass',part:'bass',channel:2,program:32,notes:[{id:'inside-bass',pitch:40,startTick:600,durationTicks:480,velocity:88}]}
  ],{ppq:480,tempo:120,startTick:480,endTick:960});
  assert.equal(result.startTick,480);assert.equal(result.endTick,960);assert.equal(result.noteCount,2);assert.equal(result.oscillatorCount,1);
  assert.deepEqual(JSON.parse(JSON.stringify(result.scheduledNotes.map(note=>[note.noteId,note.scheduledStartTick,note.scheduledDurationTicks,note.durationTicks]))),[['crossing-drum',480,360,480],['inside-bass',600,360,480]]);
});
test('Stop cancels every audible voice from a multi-track schedule',async()=>{
  const synth=load().createSynth({AudioContext:Context});await synth.unlock();synth.playTracks([
    {id:'melody',part:'melody',channel:1,program:0,notes:[{id:'m',pitch:60,startTick:0,durationTicks:960,velocity:80}]},
    {id:'bass',part:'bass',channel:2,program:32,notes:[{id:'b',pitch:36,startTick:0,durationTicks:960,velocity:90}]}
  ],{ppq:480,tempo:120});const voices=synth.context.oscillators.slice();assert.equal(synth.playingVoices,2);synth.stopPlayback();assert.equal(synth.playingVoices,0);assert.equal(voices.every(oscillator=>oscillator.stopped.at(-1)<10.01),true);
});
test('scheduled note release holds the current envelope instead of re-attacking at full gain',async()=>{
  const synth=load().createSynth({AudioContext:Context});await synth.unlock();
  synth.playNotes([{pitch:60,startTick:0,durationTicks:480,velocity:68}],{ppq:480,tempo:120});
  const voiceGain=synth.context.gains[1],events=voiceGain.gain.events;
  assert.equal(events.some(event=>event[0]==='hold'),true);
  assert.equal(events.some(event=>event[0]==='set'&&event[1]===1),false);
  const releaseRamp=events.at(-1);
  assert.equal(releaseRamp[0],'ramp');assert.equal(releaseRamp[1],.0001);
});
test('three Melody notes make exactly three voice calls and three oscillators',async()=>{
  const synth=load().createSynth({AudioContext:Context}),notes=[
    {pitch:60,startTick:0,durationTicks:120,velocity:80},
    {pitch:64,startTick:120,durationTicks:120,velocity:80},
    {pitch:67,startTick:240,durationTicks:120,velocity:80}
  ];await synth.unlock();
  const result=synth.playNotes(notes,{ppq:480,tempo:120});
  assert.equal(result.noteCount,3);assert.equal(result.oscillatorCount,3);
  assert.equal(synth.diagnostics.playbackVoicesCreated,3);
  assert.equal(synth.diagnostics.voiceCalls,3);
  assert.equal(synth.context.oscillators.length,3);
});
test('three repeated pitches still make one oscillator per Piano Roll note',async()=>{
  const synth=load().createSynth({AudioContext:Context}),notes=[0,120,240].map(startTick=>({pitch:60,startTick,durationTicks:120,velocity:80}));await synth.unlock();
  const result=synth.playNotes(notes,{ppq:480,tempo:120});
  assert.equal(result.noteCount,3);assert.equal(result.oscillatorCount,3);
  assert.equal(synth.diagnostics.playbackVoicesCreated,3);
});
test('screen-key preview uses one sine oscillator through its separate preview path',async()=>{
  const synth=load().createSynth({AudioContext:Context});await synth.unlock();
  assert.equal(synth.previewNote(60,100,.35),true);
  assert.equal(synth.diagnostics.previewVoicesCreated,1);
  assert.equal(synth.diagnostics.oscillatorsCreated,1);
  assert.equal(synth.context.oscillators[0].type,'sine');
});
test('stop then replay cancels old scheduled voices before scheduling each note once',async()=>{
  const synth=load().createSynth({AudioContext:Context}),notes=[
    {pitch:60,startTick:0,durationTicks:480,velocity:80},
    {pitch:64,startTick:480,durationTicks:480,velocity:80}
  ];await synth.unlock();
  assert.equal(synth.playNotes(notes,{ppq:480,tempo:120}).noteCount,2);
  const firstRun=synth.context.oscillators.slice();
  synth.stopPlayback();
  assert.equal(firstRun.every(oscillator=>oscillator.stopped.at(-1)<10.01),true);
  assert.equal(synth.playNotes(notes,{ppq:480,tempo:120}).noteCount,2);
  assert.equal(synth.context.oscillators.length,4);
  assert.equal(synth.playingVoices,2);
});
test('missing Web Audio API is non-fatal',async()=>{
  const synth=load().createSynth({AudioContext:null});
  assert.equal(synth.supported(),false);assert.equal(await synth.unlock(),false);
  assert.equal(synth.playNotes([{pitch:60,startTick:0,durationTicks:480}],{ppq:480,tempo:120}).ok,false);
});
