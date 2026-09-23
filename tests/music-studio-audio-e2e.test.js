const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
function fixture(){
  let sequence=0;
  const window={TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,Buffer,console,Intl,Date,Math,JSON,
    crypto:{randomUUID:()=>`audio-e2e-${++sequence}`},
    location:{hash:'#music-studio'},
    localStorage:{getItem(){return null},setItem(){},removeItem(){}},
    addEventListener(){},setTimeout(){},clearTimeout,
    atob(value){return Buffer.from(value,'base64').toString('binary')},
    btoa(value){return Buffer.from(value,'binary').toString('base64')}
  };
  window.window=window;
  const context={window,globalThis:window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,Buffer,unescape,encodeURIComponent,console};
  for(const name of ['music-studio-midi.js','music-studio-midi-parser.js','music-studio-editor.js',
    'music-studio-external-song-import.js','music-studio.js','music-studio-audio-pipeline.js']){
    vm.runInNewContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
  }
  assert.equal(window.MusicStudioAudioPipeline.install(),false,'Bridge must already wrap the real app');
  return window;
}

test('synthetic local audio response reaches real Track Review, repository reload and Logic Pro MIDI export',async()=>{
  const window=fixture(),app=window.MusicStudio,writer=window.MusicStudioMidi;
  const repo=app.memoryRepository();app.setRepository(repo);
  const source={version:1,ppq:480,tempo:92,timeSignature:{numerator:4,denominator:4},tracks:[
    {id:'vocal',name:'Vocals',channel:1,program:53,notes:[{id:'v1',pitch:69,startTick:0,durationTicks:480,velocity:90}]},
    {id:'bass',name:'Bass',channel:2,program:32,notes:[{id:'b1',pitch:40,startTick:480,durationTicks:960,velocity:80}]}
  ]};
  const bytes=writer.createMidiFile(source).bytes;
  let calls=0;
  window.fetch=async(url,request)=>{
    calls++;
    assert.equal(url,'http://127.0.0.1:8766/process');
    assert.equal(request.method,'POST');
    assert.equal(request.headers['X-Nova-Audio-Pipeline'],'1');
    return{ok:true,async json(){return{ok:true,localOnly:true,stems:['Vocals','Bass'],
      bpm:92,midiFileName:'synthetic_stems.mid',midiBase64:Buffer.from(bytes).toString('base64')}}};
  };
  const result=await app.importExternalSongFile({name:'synthetic.wav',type:'audio/wav',size:1024});
  assert.equal(result.ok,true);
  assert.equal(calls,1);
  const stored=await repo.get(result.project.projectId);
  assert.equal(stored.schemaVersion,'1.0');
  assert.equal(stored.importSource.trackAssignmentPolicy,'explicit-only');
  const external=stored.midiData.tracks.filter(track=>track.roleAssignment==='unassigned');
  assert.deepEqual(Array.from(external,track=>track.name),['Vocals','Bass']);
  assert.deepEqual(Array.from(external,track=>track.notes.length),[1,1]);
  assert.equal(app.state.externalSongImport.audioPipeline.localOnly,true);
  assert.equal(app.state.externalSongImport.audioPipeline.sourceFileName,'synthetic.wav');
  assert.equal(app.state.externalSongImport.audioPipeline.bpm,92);
  const reloaded=await repo.get(stored.projectId);
  const exported=writer.createMidiFile(app.midiExportInput(reloaded,'all'));
  const inspected=writer.inspectMidiBytes(exported.bytes);
  assert.equal(inspected.ok,true);
  assert.deepEqual(Array.from(inspected.tracks.slice(1),track=>track.name),['Vocals','Bass']);
});

test('invalid synthetic helper MIDI cannot create a project or overwrite an existing one',async()=>{
  const window=fixture(),app=window.MusicStudio,repo=app.memoryRepository();app.setRepository(repo);
  const existing=app.makeProject({projectId:'keep',projectName:'Keep'});await repo.put(existing);
  const before=JSON.stringify(await repo.list());
  window.fetch=async()=>({ok:true,async json(){return{ok:true,midiBase64:Buffer.from('not MIDI').toString('base64')}}});
  const result=await app.importExternalSongFile({name:'bad.wav',type:'audio/wav',size:8});
  assert.equal(result.ok,false);
  assert.equal(JSON.stringify(await repo.list()),before);
});
