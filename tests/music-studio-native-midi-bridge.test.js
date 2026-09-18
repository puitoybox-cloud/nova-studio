const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(extra={}){
  const window={navigator:{},performance:{now:()=>321},...extra};window.window=window;window.globalThis=window;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-midi-input.js'),'utf8'),window);
  return window.MusicStudioMidiInput;
}

test('native bridge accepts validated note-on and note-off messages',()=>{
  const midi=load(),received=[];
  assert.equal(midi.setNativeMessageHandler(message=>received.push(message)),true);
  assert.equal(midi.receiveNativeMessage({data:[0x90,60,101],timeStamp:1000}).accepted,true);
  assert.equal(midi.receiveNativeMessage({data:[0x80,60,0],timeStamp:1250}).accepted,true);
  assert.deepEqual(Array.from(received[0].data),[0x90,60,101]);
  assert.equal(received[0].timeStamp,1000);
  assert.equal(received[0].source,'native-core-midi');
  assert.equal(received.length,2);
});

test('native bridge accepts velocity-zero note-on for existing note-off handling',()=>{
  const midi=load(),received=[];
  midi.setNativeMessageHandler(message=>received.push(message));
  assert.equal(midi.receiveNativeMessage({data:[0x90,60,0],timeStamp:1250}).accepted,true);
  assert.deepEqual(Array.from(received[0].data),[0x90,60,0]);
});

test('native bridge rejects malformed, out-of-range, and non-note messages',()=>{
  const midi=load();
  midi.setNativeMessageHandler(()=>assert.fail('invalid message must not be delivered'));
  assert.equal(midi.receiveNativeMessage({data:[0x90,60]}).accepted,false);
  assert.equal(midi.receiveNativeMessage({data:[0x90,60,1,2]}).accepted,false);
  assert.equal(midi.receiveNativeMessage({data:[0x90,128,1]}).accepted,false);
  assert.equal(midi.receiveNativeMessage({data:[0x90,60,1.5]}).accepted,false);
  assert.equal(midi.receiveNativeMessage({data:[0xb0,1,64]}).accepted,false);
  assert.equal(midi.receiveNativeMessage({data:['x',60,64]}).accepted,false);
});

test('native bridge refuses delivery until Music Studio registers a handler',()=>{
  const midi=load();
  assert.deepEqual(JSON.parse(JSON.stringify(midi.receiveNativeMessage({data:[0x90,64,90],timeStamp:50}))),{accepted:false,reason:'no-handler'});
});

test('native message timestamp falls back to the local monotonic clock',()=>{
  const midi=load(),received=[];
  midi.setNativeMessageHandler(message=>received.push(message));
  midi.receiveNativeMessage({data:[0x90,67,88]});
  assert.equal(received[0].timeStamp,321);
});

test('native bridge capability is explicit and does not impersonate Web MIDI',()=>{
  const midi=load({NovaMusicNativeMidi:{isAvailable:true,platform:'iPadOS',version:'1'}});
  assert.deepEqual(JSON.parse(JSON.stringify(midi.nativeBridgeInfo())),{available:true,platform:'iPadOS',version:'1'});
  assert.equal(midi.isSupported(),false);
});
