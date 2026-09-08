const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

function load(){
  const window={TextEncoder,TextDecoder,Uint8Array,ArrayBuffer};window.window=window;
  const context={window,globalThis:window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,unescape,encodeURIComponent};
  for(const name of ['music-studio-midi.js','music-studio-midi-parser.js','music-studio-editor.js','music-studio-external-song-import.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),context,{filename:name});
  return{writer:window.MusicStudioMidi,editor:window.MusicStudioEditor,intake:window.MusicStudioExternalSongImport};
}

function sourceMidi(writer){return writer.createMidiFile({version:1,ppq:480,tempo:118,timeSignature:{numerator:4,denominator:4},tracks:[
  {id:'voice',name:'AI Vocal',channel:1,program:53,notes:[{id:'v1',pitch:67,startTick:0,durationTicks:480,velocity:91}]},
  {id:'kit',name:'AI Drums',channel:10,program:null,notes:[{id:'d1',pitch:38,startTick:240,durationTicks:120,velocity:110}]},
  {id:'strings',name:'AI Strings',channel:3,program:48,notes:[{id:'s1',pitch:72,startTick:0,durationTicks:960,velocity:82}]}
]}).bytes}

test('external MIDI intake reuses SMF parsing while leaving every imported role unassigned',()=>{
  const{writer,intake}=load(),bytes=sourceMidi(writer),prepared=intake.prepareMidiImport(bytes,{name:'external-ai-song.mid',size:bytes.length,type:'audio/midi'},{receivedAt:'2026-09-08T08:30:00.000Z'});
  assert.equal(prepared.status,'ready-for-project');
  assert.deepEqual(Array.from(prepared.midiData.tracks,track=>track.name),['AI Vocal','AI Drums','AI Strings']);
  assert.ok(prepared.midiData.tracks.every(track=>track.part===undefined&&track.roleAssignment==='unassigned'));
  assert.equal(prepared.midiData.importSource.trackAssignmentPolicy,'explicit-only');
  assert.equal(prepared.midiData.importSource.provider,null);
  assert.equal(prepared.source.contentStored,false);
  assert.equal(prepared.source.pathStored,false);
});

test('external MIDI survives editor normalization and Type 1 export without Track ID promotion or loss',()=>{
  const{writer,editor,intake}=load(),bytes=sourceMidi(writer),prepared=intake.prepareMidiImport(bytes,{name:'song.mid',size:bytes.length,type:'audio/midi'}),ids=Array.from(prepared.midiData.tracks,track=>track.id),session=editor.createSession({projectId:'external',midiData:prepared.midiData}),additional=session.midiData.tracks.filter(track=>track.roleAssignment==='unassigned');
  assert.deepEqual(Array.from(additional,track=>track.id),ids);
  assert.ok(additional.every(track=>track.part===undefined));
  assert.deepEqual(Array.from(session.midiData.tracks.filter(track=>track.part),track=>track.part),['melody','drums','bass']);
  const roundTrip=writer.createMidiFile({...session.midiData,tracks:additional}),inspection=writer.inspectMidiBytes(roundTrip.bytes);
  assert.equal(inspection.ok,true);
  assert.deepEqual(Array.from(inspection.tracks.slice(1),track=>track.name),['AI Vocal','AI Drums','AI Strings']);
});

test('Track Registry rejects duplicate and invalid imported Track IDs without repair',()=>{
  const{intake}=load();
  assert.throws(()=>intake.validateRegistry([{id:'same'},{id:'same'}]),/duplicate Track ID/);
  assert.throws(()=>intake.validateRegistry([{id:'ok'},{id:' '}]),/invalid Track ID/);
});

test('audio intake stores metadata only and stops before stem separation or Audio-to-MIDI',()=>{
  const{intake}=load(),file={name:'finished-song.mp3',size:2048,type:'audio/mpeg',lastModified:123,arrayBuffer(){throw Error('must not read')}};
  const prepared=intake.prepareAudioImport(file,{receivedAt:'2026-09-08T08:40:00.000Z'}),serialized=JSON.stringify(prepared);
  assert.equal(prepared.status,'awaiting-audio-processing');
  assert.deepEqual(Array.from(prepared.nextBoundary.stages),['stem-separation','audio-to-midi','track-review']);
  assert.equal(prepared.nextBoundary.automatic,false);
  assert.equal(prepared.projectData,null);
  assert.equal(serialized.includes('arrayBuffer'),false);
  assert.equal(serialized.includes('/Users/'),false);
});

test('intake rejects empty unsupported and mismatched source kinds without project mutation',()=>{
  const{intake}=load();
  assert.equal(intake.classifyFile(null).ok,false);
  assert.equal(intake.classifyFile({name:'empty.wav',size:0,type:'audio/wav'}).ok,false);
  assert.throws(()=>intake.prepareAudioImport({name:'notes.txt',size:10,type:'text/plain'}),/確認できません/);
  assert.throws(()=>intake.prepareMidiImport(new Uint8Array([1]),{name:'audio.wav',size:1,type:'audio/wav'}),/MIDIファイルではありません/);
});
