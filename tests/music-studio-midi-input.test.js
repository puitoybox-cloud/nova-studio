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
test('duplicate delivery of three different key presses creates exactly three notes',()=>{
  const midi=load({}),recorder=midi.createRecorder({ppq:480,tempo:120});
  recorder.start(0);
  [[60,0,125],[64,250,500],[67,625,1000]].forEach(([pitch,on,off])=>{
    recorder.handleMessage([0x90,pitch,90],on);
    recorder.handleMessage([0x90,pitch,90],on);
    recorder.handleMessage([0x80,pitch,0],off);
    recorder.handleMessage([0x80,pitch,0],off);
  });
  const notes=recorder.stop(1100);
  assert.equal(notes.length,3);
  assert.equal(notes.map(note=>note.pitch).join(','),'60,64,67');
  assert.equal(notes.map(note=>note.durationTicks).join(','),'120,240,360');
});
test('three consecutive presses of the same key create exactly three notes',()=>{
  const midi=load({}),recorder=midi.createRecorder({ppq:480,tempo:120});
  recorder.start(0);
  [[0,100],[200,350],[500,750]].forEach(([on,off])=>{
    recorder.handleMessage([0x90,60,82],on);
    recorder.handleMessage([0x90,60,82],on);
    recorder.handleMessage([0x80,60,0],off);
    recorder.handleMessage([0x80,60,0],off);
  });
  const notes=recorder.stop(800);
  assert.equal(notes.length,3);
  assert.equal(notes.map(note=>note.durationTicks).join(','),'96,144,240');
});
test('Record Stop Record cycles do not retain notes or duplicate-message state',()=>{
  const midi=load({}),recorder=midi.createRecorder({ppq:480,tempo:120});
  for(let cycle=0;cycle<3;cycle++){
    const start=cycle*1000;
    recorder.start(start);
    recorder.handleMessage([0x90,60,75],start+10);
    recorder.handleMessage([0x90,60,75],start+10);
    recorder.handleMessage([0x80,60,0],start+210);
    recorder.handleMessage([0x80,60,0],start+210);
    const notes=recorder.stop(start+250);
    assert.equal(notes.length,1);
    assert.equal(notes[0].durationTicks,192);
  }
});
