const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function load(){const window={};window.window=window;for(const file of ['music-studio-playback.js','music-studio-midi-input.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),window);return window}
const plain=value=>JSON.parse(JSON.stringify(value));
for(const startTick of [0,240,480,720])test(`recording across exact tempo events from tick ${startTick}`,()=>{
  const w=load(),map=[{tick:0,bpm:120},{tick:480,bpm:60},{tick:960,bpm:180}],saved=plain(map),recorder=w.MusicStudioMidiInput.createRecorder({ppq:480,tempo:120,tempoMap:map,startTick});
  recorder.start(1000);recorder.handleMessage([0x90,60,90],1100);recorder.handleMessage([0x80,60,0],2500);
  const notes=plain(recorder.stop(2600)),timing=w.MusicStudioPlayback;
  const onset=Math.round(timing.tickAtSeconds(startTick,.1,480,map,120)-startTick),end=Math.round(timing.tickAtSeconds(startTick,1.5,480,map,120)-startTick);
  assert.equal(notes.length,1);assert.equal(notes[0].startTick,onset);assert.equal(notes[0].durationTicks,end-onset);assert.deepEqual(map,saved);
  assert.ok(Math.abs(timing.tickDurationSeconds(startTick,startTick+onset,480,map,120)-.1)<.002);
});
test('active recording freezes tempo map and closes active notes using mapped elapsed time',()=>{
  const w=load(),map=[{tick:480,bpm:60}],r=w.MusicStudioMidiInput.createRecorder({ppq:480,tempo:120,tempoMap:map,startTick:240});r.start(0);r.handleMessage([0x90,60,100],0);map[0].tick=99999;const notes=plain(r.stop(750));assert.equal(notes[0].durationTicks,480);assert.equal(notes[0].startTick,0);
});
test('map recording fails closed without the shared timing service',()=>{const w={};w.window=w;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-midi-input.js'),'utf8'),w);assert.throws(()=>w.MusicStudioMidiInput.createRecorder({tempoMap:[]}),/service-unavailable/)});
