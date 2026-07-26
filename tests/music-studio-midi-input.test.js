const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(navigator){
  const window={navigator,performance:{now:()=>0}};window.window=window;window.globalThis=window;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-midi-input.js'),'utf8'),window);
  return window.MusicStudioMidiInput;
}

test('unsupported Web MIDI environment is reported without throwing',async()=>{
  const midi=load({});
  assert.equal(midi.isSupported(),false);
  const result=await midi.requestAccess();
  assert.equal(result.supported,false);assert.equal(result.access,null);assert.equal(result.inputs.length,0);
});
test('note-on and note-off preserve pitch velocity channel and calculate ticks',()=>{
  const midi=load({}),recorder=midi.createRecorder({ppq:480,tempo:120});
  recorder.start(1000);
  const on=recorder.handleMessage([0x92,64,99],1125);
  assert.equal(on.type,'noteOn');assert.equal(on.channel,3);assert.equal(on.velocity,99);
  recorder.handleMessage([0x82,64,45],1375);
  const notes=recorder.stop(1400);
  assert.equal(notes.length,1);assert.equal(notes[0].pitch,64);assert.equal(notes[0].startTick,120);
  assert.equal(notes[0].durationTicks,240);assert.equal(notes[0].velocity,99);assert.equal(notes[0].inputChannel,3);
});
test('note-on with zero velocity closes a note and stop safely closes held notes',()=>{
  const midi=load({}),recorder=midi.createRecorder({ppq:480,tempo:120});
  recorder.start(0);recorder.handleMessage([0x90,60,80],0);recorder.handleMessage([0x90,60,0],250);
  recorder.handleMessage([0x91,62,70],500);
  const notes=recorder.stop(750);
  assert.equal(notes.length,2);assert.equal(notes[0].durationTicks,240);assert.equal(notes[1].durationTicks,240);
});
test('requestAccess exposes connected MIDI inputs',async()=>{
  const input={id:'keyboard-1',name:'Keyboard'},access={inputs:new Map([[input.id,input]])};
  const midi=load({requestMIDIAccess:async options=>{assert.equal(options.sysex,false);return access}});
  const result=await midi.requestAccess();
  assert.equal(result.supported,true);assert.equal(result.inputs[0].id,'keyboard-1');
});
