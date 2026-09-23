const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const root=path.join(__dirname,'..');

function loadBridge(configure){
  const source=fs.readFileSync(path.join(root,'music-studio-audio-pipeline.js'),'utf8');
  const window={Uint8Array,Blob,Buffer,console,setTimeout(){},atob(value){return Buffer.from(value,'base64').toString('binary')}};
  window.window=window;
  configure?.(window);
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
  assert.throws(()=>bridge.assertMidiHeader(Uint8Array.from([...header.slice(0,8),0,3,...header.slice(10),...track])),/MIDI/);
});

test('invalid local MIDI never reaches import and preserves existing review state',async()=>{
  let importCalls=0,host;
  const existing={status:'review',tracks:[{id:'keep-this-track'}]};
  const bridge=loadBridge(window=>{
    host=window;
    window.MusicStudio={
      state:{externalSongImport:existing},
      async importExternalSongFile(){importCalls++;return{ok:true}}
    };
    window.fetch=async()=>({
      ok:true,
      async json(){return{ok:true,midiBase64:Buffer.from('not midi').toString('base64')}}
    });
  });
  assert.equal(bridge.install(),false);
  const result=await host.MusicStudio.importExternalSongFile({name:'song.wav',type:'audio/wav'});
  assert.equal(result.ok,false);
  assert.equal(importCalls,0);
  assert.equal(host.MusicStudio.state.externalSongImport.tracks[0].id,'keep-this-track');
  assert.equal(host.MusicStudio.state.externalSongImport.status,'review');
  assert.match(host.MusicStudio.state.externalSongImport.audioPipelineError,/MIDI/);
});

test('successful local conversion reaches original MIDI importer with review metadata',async()=>{
  let host,importCalls=0,importedFile;
  const header=[0x4d,0x54,0x68,0x64,0,0,0,6,0,1,0,1,1,0xe0];
  const track=[0x4d,0x54,0x72,0x6b,0,0,0,4,0,0xff,0x2f,0];
  const midi=Buffer.from([...header,...track]).toString('base64');
  loadBridge(window=>{
    host=window;
    window.MusicStudio={
      state:{externalSongImport:{status:'review',tracks:[{id:'E1'}]}},
      async importExternalSongFile(file){importCalls++;importedFile=file;return{ok:true}}
    };
    window.fetch=async(url,request)=>{
      assert.equal(url,'http://127.0.0.1:8766/process');
      assert.equal(request.method,'POST');
      assert.equal(request.headers['X-Nova-Audio-Pipeline'],'1');
      return{ok:true,async json(){return{ok:true,midiBase64:midi,stems:['Vocals','Piano'],bpm:120}}};
    };
  });
  const result=await host.MusicStudio.importExternalSongFile({name:'song.wav',type:'audio/wav'});
  assert.equal(result.ok,true);
  assert.equal(importCalls,1);
  assert.equal(importedFile.name,'song_stems.mid');
  assert.equal(host.MusicStudio.state.externalSongImport.tracks[0].id,'E1');
  assert.equal(host.MusicStudio.state.externalSongImport.audioPipeline.sourceFileName,'song.wav');
  assert.equal(host.MusicStudio.state.externalSongImport.audioPipeline.localOnly,true);
  assert.equal(host.MusicStudio.state.externalSongImport.audioPipeline.bpm,120);
  assert.equal(Object.hasOwn(result.audioPipeline,'midiBase64'),false,'Do not retain large MIDI payload in result');
});

test('second audio request is rejected while first processes without duplicate fetch',async()=>{
  let host,fetchCalls=0,release;
  const pending=new Promise(resolve=>{release=resolve});
  loadBridge(window=>{
    host=window;
    window.MusicStudio={state:{externalSongImport:{}},async importExternalSongFile(){return{ok:true}}};
    window.fetch=async()=>{fetchCalls++;await pending;throw Error('mock processing stopped')};
  });
  const first=host.MusicStudio.importExternalSongFile({name:'first.wav',type:'audio/wav'});
  const second=await host.MusicStudio.importExternalSongFile({name:'second.wav',type:'audio/wav'});
  assert.equal(second.ok,false);
  assert.equal(second.busy,true);
  assert.equal(fetchCalls,1);
  release();
  assert.equal((await first).ok,false);
});

test('native MIDI files bypass audio helper even when MIME is wrong',async()=>{
  let host,fetchCalls=0,importCalls=0;
  loadBridge(window=>{
    host=window;
    window.MusicStudio={state:{externalSongImport:{}},async importExternalSongFile(){importCalls++;return{ok:true}}};
    window.fetch=async()=>{fetchCalls++;throw Error('audio helper should not be called')};
  });
  const result=await host.MusicStudio.importExternalSongFile({name:'notes.mid',type:'audio/wav'});
  assert.equal(result.ok,true);
  assert.equal(importCalls,1);
  assert.equal(fetchCalls,0);
});

test('local helper size and connection failures are actionable without sending audio',async()=>{
  let fetchCalls=0;
  const bridge=loadBridge(window=>{
    window.fetch=async()=>{fetchCalls++;throw Error('connection refused')};
  });
  await assert.rejects(bridge.processAudioLocally({name:'huge.wav',size:500*1024*1024+1}),/500 MiB/);
  await assert.rejects(bridge.processAudioLocally({name:'empty.wav',size:0}),/500 MiB/);
  assert.equal(fetchCalls,0);
  await assert.rejects(bridge.processAudioLocally({name:'song.wav',size:128,type:'audio/wav'}),/START_AUDIO_PIPELINE.command/);
  assert.equal(fetchCalls,1);
});

test('helper busy response does not call MIDI importer or discard existing tracks',async()=>{
  let host,importCalls=0;
  loadBridge(window=>{
    host=window;
    window.MusicStudio={
      state:{externalSongImport:{status:'review',tracks:[{id:'E5'}]}},
      async importExternalSongFile(){importCalls++;return{ok:true}}
    };
    window.fetch=async()=>({
      ok:false,status:409,
      async json(){return{ok:false,busy:true,message:'別の音声を処理中です。完了後に再試行してください。'}}
    });
  });
  const result=await host.MusicStudio.importExternalSongFile({name:'song.wav',type:'audio/wav'});
  assert.equal(result.ok,false);
  assert.match(result.message,/別の音声を処理中/);
  assert.equal(importCalls,0);
  assert.equal(host.MusicStudio.state.externalSongImport.tracks[0].id,'E5');
  assert.equal(host.MusicStudio.state.externalSongImport.status,'review');
  assert.match(host.MusicStudio.state.externalSongImport.audioPipelineError,/別の音声を処理中/);
});

test('failed MIDI importer does not claim successful Track Review',async()=>{
  let host,status;
  const header=[0x4d,0x54,0x68,0x64,0,0,0,6,0,1,0,1,1,0xe0];
  const track=[0x4d,0x54,0x72,0x6b,0,0,0,4,0,0xff,0x2f,0];
  loadBridge(window=>{
    host=window;
    status={dataset:{},setAttribute(){},textContent:''};
    const section={querySelector(){return status}};
    window.document={querySelector(selector){return selector==='.music-external-import'?section:null}};
    window.MusicStudio={
      state:{externalSongImport:{tracks:[{id:'existing'}]}},
      async importExternalSongFile(){return{ok:false,message:'MIDI import failed'}}
    };
    window.fetch=async()=>({
      ok:true,async json(){return{ok:true,midiBase64:Buffer.from([...header,...track]).toString('base64')}}
    });
  });
  const result=await host.MusicStudio.importExternalSongFile({name:'song.wav',type:'audio/wav'});
  assert.equal(result.ok,false);
  assert.equal(status.dataset.kind,'error');
  assert.match(status.textContent,/MIDI import failed/);
  assert.equal(host.MusicStudio.state.externalSongImport.tracks[0].id,'existing');
});

test('invalid helper base64 cannot reach the MIDI importer',async()=>{
  let host,importCalls=0;
  loadBridge(window=>{
    host=window;
    window.MusicStudio={
      state:{externalSongImport:{status:'review',tracks:[{id:'E2'}]}},
      async importExternalSongFile(){importCalls++;return{ok:true}}
    };
    window.fetch=async()=>({ok:true,async json(){return{ok:true,midiBase64:'not-base64!'}}});
  });
  const result=await host.MusicStudio.importExternalSongFile({name:'song.wav',type:'audio/wav'});
  assert.equal(result.ok,false);
  assert.equal(importCalls,0);
  assert.equal(host.MusicStudio.state.externalSongImport.status,'review');
  assert.equal(host.MusicStudio.state.externalSongImport.tracks[0].id,'E2');
  assert.match(result.message,/MIDI/);
});

test('noncanonical base64 cannot reach MIDI import even if its bytes decode to a MIDI header',async()=>{
  let host,importCalls=0;
  const valid=Buffer.from([0x4d,0x54,0x68,0x64,0,0,0,6,0,1,0,1,1,0xe0,0x4d,0x54,0x72,0x6b,0,0,0,4,0,0xff,0x2f,0]).toString('base64');
  loadBridge(window=>{
    host=window;
    window.MusicStudio={state:{externalSongImport:{status:'review',tracks:[{id:'E1'}]}},async importExternalSongFile(){importCalls++;return{ok:true}}};
    window.fetch=async()=>({ok:true,async json(){return{ok:true,midiBase64:valid.slice(0,-2)+'=='}}});
  });
  const result=await host.MusicStudio.importExternalSongFile({name:'song.wav',type:'audio/wav'});
  assert.equal(result.ok,false);
  assert.equal(importCalls,0);
  assert.equal(host.MusicStudio.state.externalSongImport.status,'review');
});

test('unexpected helper stem metadata cannot disrupt a valid MIDI import',async()=>{
  let host,importCalls=0;
  const header=[0x4d,0x54,0x68,0x64,0,0,0,6,0,1,0,1,1,0xe0];
  const track=[0x4d,0x54,0x72,0x6b,0,0,0,4,0,0xff,0x2f,0];
  loadBridge(window=>{
    host=window;
    window.MusicStudio={state:{externalSongImport:{}},async importExternalSongFile(){importCalls++;return{ok:true}}};
    window.fetch=async()=>({ok:true,async json(){return{
      ok:true,midiBase64:Buffer.from([...header,...track]).toString('base64'),stems:'unexpected'
    }}});
  });
  const result=await host.MusicStudio.importExternalSongFile({name:'song.wav',type:'audio/wav'});
  assert.equal(result.ok,true);
  assert.equal(importCalls,1);
  assert.equal(host.MusicStudio.state.externalSongImport.audioPipeline.stems.length,0);
});

test('helper-provided MIDI filename is a safe basename with MIDI extension',async()=>{
  let host,importedFile;
  const midi=Buffer.from([0x4d,0x54,0x68,0x64,0,0,0,6,0,1,0,1,1,0xe0,0x4d,0x54,0x72,0x6b,0,0,0,4,0,0xff,0x2f,0]).toString('base64');
  loadBridge(window=>{
    host=window;
    window.MusicStudio={state:{externalSongImport:{}},async importExternalSongFile(file){importedFile=file;return{ok:true}}};
    window.fetch=async()=>({ok:true,async json(){return{ok:true,midiBase64:midi,midiFileName:'../../other\\\\folder/\u0000evil.wav'}}});
  });
  const result=await host.MusicStudio.importExternalSongFile({name:'song.wav',type:'audio/wav'});
  assert.equal(result.ok,true);
  assert.equal(importedFile.name,'evil.wav.mid');
  assert.equal(host.MusicStudio.state.externalSongImport.audioPipeline.midiFileName,'evil.wav.mid');
});

test('missing importer result is not reported as successful Track Review',async()=>{
  let host;
  const midi=Buffer.from([0x4d,0x54,0x68,0x64,0,0,0,6,0,1,0,1,1,0xe0,0x4d,0x54,0x72,0x6b,0,0,0,4,0,0xff,0x2f,0]).toString('base64');
  loadBridge(window=>{
    host=window;
    window.MusicStudio={state:{externalSongImport:{}},async importExternalSongFile(){return undefined}};
    window.fetch=async()=>({ok:true,async json(){return{ok:true,midiBase64:midi}}});
  });
  const result=await host.MusicStudio.importExternalSongFile({name:'song.wav',type:'audio/wav'});
  assert.equal(result.ok,false);
  assert.match(result.message,/MIDI取り込み結果/);
  assert.equal(host.MusicStudio.state.externalSongImport.audioPipeline,undefined);
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
