'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');

test('six separated audio stems retain valid one-based MIDI channels through an atomic song fork',async()=>{
 let sequence=0;
 const window={console,Date,Math,JSON,Intl,Blob,ArrayBuffer,DataView,Float32Array,Uint8Array,
  crypto:{subtle:webcrypto.subtle,randomUUID:()=>`demucs-channel-${++sequence}`},location:{hash:'#music-studio'}};
 window.window=window;
 vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),window);
 const studio=window.MusicStudio;
 const project=studio.makeProject({projectId:'source',projectName:'Six stems',midiData:{ppq:480,tempo:120,
  timeSignature:{numerator:4,denominator:4},tracks:[{id:'melody',name:'Melody',part:'melody',channel:1,
   notes:[{id:'note-1',pitch:60,startTick:0,durationTicks:480,velocity:90}]}]}});
 const repository=studio.memoryRepository([project]);
 // This test runs the same production fork path with an injected in-memory
 // transactional repository; the IndexedDB transaction itself is tested elsewhere.
 repository.kind='indexeddb';
 repository.getLongWav=async()=>null;
 studio.setRepository(repository);
 studio.state.projects=[project];
 studio.state.loaded=true;
 studio.state.settings=studio.defaultSettings();
 const wav=new Blob([studio.pcmEncodeWav({sampleRate:48000,channels:[[0,0.1,-0.1,0]]})],{type:'audio/wav'});
 wav.name='source.wav';
 const roles=['vocals','drums','bass','guitar','piano','other'];
 const entries=roles.map((role,index)=>({role,trackId:`demucs-${index}`,file:wav}));
 const baseline=JSON.stringify(await repository.get(project.projectId));
 const result=await studio.logicImportStemReturns(entries,project.projectId,{separatedAudio:true,
  model:'htdemucs_6s',sourceSha256:'a'.repeat(64),sourceFile:wav});
 assert.equal(result.ok,true,result.error);
 assert.equal(JSON.stringify(await repository.get(project.projectId)),baseline,'the source song must remain unchanged');
 const generated=entries.map(e=>result.project.midiData.tracks.find(t=>t.id===e.trackId));
 assert.ok(generated.every(Boolean),'each new WAV has a stable MIDI track');
 assert.deepEqual(generated.map(t=>t.channel),[1,10,1,1,1,1]);
 assert.equal(result.project.longWavAssets.length,6);
 vm.runInNewContext(fs.readFileSync('music-studio-midi.js','utf8'),window);
 const validated=window.MusicStudioMidi.validateMidiProjectData(result.project.midiData);
 assert.equal(validated.ok,true,validated.errors.join('; '));
 assert.equal(window.MusicStudioMidi.createMidiFile(result.project.midiData).validation.ok,true);
});
