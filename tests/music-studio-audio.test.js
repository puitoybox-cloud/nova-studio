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
test('Melody playback schedules notes from PPQ and tempo without changing note data',async()=>{
  const synth=load().createSynth({AudioContext:Context}),notes=[{pitch:60,startTick:480,durationTicks:240,velocity:80}],before=JSON.stringify(notes);await synth.unlock();
  const result=synth.playNotes(notes,{ppq:480,tempo:120}),oscillator=synth.context.oscillators[0];
  assert.equal(result.ok,true);assert.equal(result.noteCount,1);assert.equal(JSON.stringify(notes),before);
  assert.equal(Math.round(oscillator.started[0]*100)/100,10.54);assert.ok(result.durationMs>800&&result.durationMs<1000);
  synth.stopPlayback();assert.equal(synth.playingVoices,0);
});
test('missing Web Audio API is non-fatal',async()=>{
  const synth=load().createSynth({AudioContext:null});
  assert.equal(synth.supported(),false);assert.equal(await synth.unlock(),false);
  assert.equal(synth.playNotes([{pitch:60,startTick:0,durationTicks:480}],{ppq:480,tempo:120}).ok,false);
});
