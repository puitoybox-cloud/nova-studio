const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const root=path.join(__dirname,'..');

function loadBridge(){
  const source=fs.readFileSync(path.join(root,'music-studio-audio-pipeline.js'),'utf8');
  const window={Uint8Array,Blob,Buffer,console,setTimeout(){},atob(value){return Buffer.from(value,'base64').toString('binary')}};
  window.window=window;
  vm.runInNewContext(source,{window,globalThis:window,Uint8Array,Blob,Buffer,console},{filename:'music-studio-audio-pipeline.js'});
  return window.MusicStudioAudioPipeline;
}

test('audio pipeline bridge recognizes supported local audio and keeps MIDI separate',()=>{
  const bridge=loadBridge();
  assert.equal(bridge.ENDPOINT,'http://127.0.0.1:8766');
  assert.equal(bridge.isAudioFile({name:'song.wav',type:'audio/wav'}),true);
  assert.equal(bridge.isAudioFile({name:'song.mp3',type:'audio/mpeg'}),true);
  assert.equal(bridge.isAudioFile({name:'song.mid',type:'audio/midi'}),false);
  assert.equal(bridge.isAudioFile({name:'song.mid',type:'audio/wav'}),false);
  assert.equal(bridge.isAudioFile({name:'song.midi',type:'audio/x-midi'}),false);
  assert.equal(bridge.isAudioFile({name:'song.wav',type:'audio/midi'}),false);
  assert.equal(bridge.isAudioFile({name:'notes.txt',type:'text/plain'}),false);
});

test('audio bridge validates MIDI header, track count and chunk boundaries',()=>{
  const bridge=loadBridge();
  const header=[0x4d,0x54,0x68,0x64,0,0,0,6,0,1,0,1,1,0xe0];
  const track=[0x4d,0x54,0x72,0x6b,0,0,0,4,0,0xff,0x2f,0];
  const valid=Uint8Array.from([...header,...track]);
  assert.doesNotThrow(()=>bridge.assertMidiHeader(valid));
  assert.throws(()=>bridge.assertMidiHeader(valid.subarray(0,13)),/MIDI/);
  assert.throws(()=>bridge.assertMidiHeader(Uint8Array.from([0,0,0,0,...valid.subarray(4)])),/MIDI/);
  assert.throws(()=>bridge.assertMidiHeader(Uint8Array.from([...valid.subarray(0,7),7,...valid.subarray(8)])),/MIDI/);
  assert.throws(()=>bridge.assertMidiHeader(Uint8Array.from([...header.slice(0,11),2,...header.slice(12),...track])),/MIDI/);
  assert.throws(()=>bridge.assertMidiHeader(Uint8Array.from([...header,...track.slice(0,7),5,...track.slice(8)])),/MIDI/);
  assert.throws(()=>bridge.assertMidiHeader(Uint8Array.from([...header,0,...track.slice(1)])),/MIDI/);
  assert.throws(()=>bridge.assertMidiHeader(Uint8Array.from([...header.slice(0,8),0,0,...header.slice(10),...track])),/MIDI/);
});

test('standalone and embedded entries load the audio pipeline bridge',()=>{
  const standalone=fs.readFileSync(path.join(root,'music-studio.html'),'utf8');
  const embedded=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const source of [standalone,embedded])assert.match(source,/music-studio-audio-pipeline\.js\?v=1\.0\.0/);
});

test('local helper is loopback-only and protects its POST boundary',()=>{
  const source=fs.readFileSync(path.join(root,'tools/music-audio-pipeline/server.py'),'utf8');
  assert.match(source,/HOST = "127\.0\.0\.1"/);
  assert.match(source,/PORT = 8766/);
  assert.match(source,/X-Nova-Audio-Pipeline/);
  assert.match(source,/TemporaryDirectory/);
  assert.match(source,/htdemucs_6s/);
  assert.match(source,/from basic_pitch\.inference import predict/);
  assert.match(source,/"Vocals"/);
  assert.match(source,/"Drums"/);
  assert.match(source,/"Bass"/);
  assert.match(source,/mido\.MidiFile\(type=1/);
  assert.doesNotMatch(source,/api\.openai|generativelanguage|anthropic|replicate\.com/i);
});

test('helper commands are local startup and shutdown scripts',()=>{
  const start=fs.readFileSync(path.join(root,'tools/music-audio-pipeline/START_AUDIO_PIPELINE.command'),'utf8');
  const stop=fs.readFileSync(path.join(root,'tools/music-audio-pipeline/STOP_AUDIO_PIPELINE.command'),'utf8');
  assert.match(start,/python3/);
  assert.match(start,/pip" install -r requirements\.txt/);
  assert.match(start,/server\.py/);
  assert.match(stop,/kill "\$PID"/);
});
