'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const midi=Buffer.from([
  0x4d,0x54,0x68,0x64,0,0,0,6,0,1,0,1,1,0xe0,
  0x4d,0x54,0x72,0x6b,0,0,0,4,0,0xff,0x2f,0,
]).toString('base64');

function setup(){
  const host={Uint8Array,Blob,Buffer,AbortController,console,setTimeout(){},atob:value=>Buffer.from(value,'base64').toString('binary')};
  host.window=host;
  let imports=0,release,fetchStarted;
  const started=new Promise(resolve=>{fetchStarted=resolve});
  const state={selectedId:'p1',projects:[{projectId:'p1',revision:1},{projectId:'p2',revision:1}],externalSongImport:{status:'review',tracks:[{id:'original'}]}};
  host.MusicStudio={state,selectedMidiProject(){return this.state.projects.find(p=>p.projectId===this.state.selectedId)||null},async importExternalSongFile(){imports++;return{ok:true}}};
  host.fetch=async()=>{fetchStarted();await new Promise(resolve=>{release=resolve});return{ok:true,json:async()=>({ok:true,pipelineRevision:2,midiBase64:midi})}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-audio-pipeline.js'),'utf8'),{window:host,globalThis:host,Uint8Array,Blob,Buffer,console});
  return{host,state,started,release:()=>release(),imports:()=>imports,file:{name:'song.wav',type:'audio/wav',size:128}};
}

test('audio conversion cannot import into a different project after selection changes while helper is running',async()=>{
  const f=setup(),running=f.host.MusicStudio.importExternalSongFile(f.file);
  await f.started;
  f.state.selectedId='p2';
  const replacement={status:'review',tracks:[{id:'other-review'}]};f.state.externalSongImport=replacement;
  f.release();
  const result=await running;
  assert.equal(result.ok,false);
  assert.match(result.message,/audio-import-context-changed/);
  assert.equal(f.imports(),0);
  assert.equal(f.state.externalSongImport,replacement,'do not overwrite the newly selected review');
});

test('changing source project revision during audio-to-MIDI processing rejects the old result',async()=>{
  const f=setup(),running=f.host.MusicStudio.importExternalSongFile(f.file);
  await f.started;
  f.state.projects[0].revision++;
  const originalReview=f.state.externalSongImport;
  f.release();
  const result=await running;
  assert.equal(result.ok,false);
  assert.match(result.message,/audio-import-context-changed/);
  assert.equal(f.imports(),0);
  assert.equal(f.state.externalSongImport,originalReview,'retain the active review without an old failure banner');
});

test('changing the review itself during conversion never replaces newer review notes',async()=>{
  const f=setup(),running=f.host.MusicStudio.importExternalSongFile(f.file);
  await f.started;
  const newReview={status:'review',tracks:[{id:'later-import'}]};f.state.externalSongImport=newReview;
  f.release();
  const result=await running;
  assert.equal(result.ok,false);
  assert.match(result.message,/audio-import-context-changed/);
  assert.equal(f.imports(),0);
  assert.equal(f.state.externalSongImport,newReview);
});

test('leaving the import screen while the helper runs does not open a stale new project',async()=>{
  const f=setup();f.host.location={hash:'#/music-studio/midi-composer'};
  const running=f.host.MusicStudio.importExternalSongFile(f.file);
  await f.started;
  f.host.location.hash='#/music-studio/projects';
  f.release();
  const result=await running;
  assert.equal(result.ok,false);
  assert.match(result.message,/audio-import-context-changed/);
  assert.equal(f.imports(),0);
  assert.equal(f.state.externalSongImport.status,'review');
});

test('cancelling audio conversion discards a late result and preserves the active review',async()=>{
  const f=setup(),review=f.state.externalSongImport;
  const running=f.host.MusicStudio.importExternalSongFile(f.file);
  await f.started;
  assert.equal(f.host.MusicStudioAudioPipeline.cancelAudioImport(),true);
  f.release();
  const result=await running;
  assert.equal(result.cancelled,true);
  assert.equal(f.imports(),0);
  assert.equal(f.state.externalSongImport,review);
  assert.equal(f.host.MusicStudioAudioPipeline.cancelAudioImport(),false);
});

test('direct Basic Pitch import rejects a result for different source bytes',async()=>{
  const f=setup(),file=new File(['audio source'],'song.wav',{type:'audio/wav'});
  const digest=require('node:crypto').createHash('sha256').update('audio source').digest('hex');
  let sourceSha256='0'.repeat(64);
  f.host.fetch=async url=>{
    assert.match(url,/\/transcribe$/);
    return {ok:true,json:async()=>({ok:true,pipelineRevision:2,model:'basic-pitch',localOnly:true,
      stems:[],sourceSha256,midiBase64:midi})};
  };
  const pipeline=f.host.MusicStudioAudioPipeline;
  const rejected=await pipeline.importAudioFile(file,{mode:'transcribe'});
  assert.match(rejected.message,/transcription-source-mismatch/);
  assert.equal(f.imports(),0);
  sourceSha256=digest;
  assert.equal((await pipeline.importAudioFile(file,{mode:'transcribe'})).ok,true);
  assert.equal(f.imports(),1);
  assert.equal(f.state.externalSongImport.audioPipeline.sourceSha256,digest);
});
