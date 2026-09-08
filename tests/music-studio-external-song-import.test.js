const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

function load(){
  let sequence=0;const window={TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,console,Intl,Date,Math,JSON,crypto:{randomUUID:()=>`external-${++sequence}`},location:{hash:'#music-studio'},localStorage:{getItem(){return null},setItem(){},removeItem(){}},addEventListener(){},setTimeout,clearTimeout};window.window=window;
  const context={window,globalThis:window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,unescape,encodeURIComponent};
  for(const name of ['music-studio-midi.js','music-studio-midi-parser.js','music-studio-editor.js','music-studio-external-song-import.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),context,{filename:name});
  return{window,writer:window.MusicStudioMidi,editor:window.MusicStudioEditor,intake:window.MusicStudioExternalSongImport};
}
function loadApp(){const loaded=load(),source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');vm.runInNewContext(source,{window:loaded.window,globalThis:loaded.window},{filename:'music-studio.js'});return{...loaded,app:loaded.window.MusicStudio}}
function midiFile(name,bytes,type='audio/midi'){const data=Uint8Array.from(bytes);return{name,size:data.length,type,async arrayBuffer(){return data.buffer},slice(start,end){const part=data.slice(start,end);return{async arrayBuffer(){return part.buffer}}}}}

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

test('Editor exposes a separate compact External Song Import MIDI entry',()=>{
  const{app}=loadApp(),project=app.makeProject({projectId:'ui-source',projectName:'UI Source'});app.state.projects=[project];
  const html=app.renderRoute('music-studio/midi-editor/ui-source');
  assert.match(html,/External Song Import（外部楽曲取り込み）/);
  assert.match(html,/id="externalSongMidiImport"[^>]*accept="audio\/midi,audio\/x-midi,\.mid,\.midi"/);
  assert.match(html,/MusicStudio\.importExternalSongFile\(this\.files\[0\]\)/);
  assert.match(html,/id="editorMidiImport"/);
  assert.match(html,/Logic Pro Integration（連携）/);
});

test('UI import calls the PR 223 boundary and creates an unassigned Version 1 project with summary',async()=>{
  const{app,writer,intake}=loadApp(),repo=app.memoryRepository(),bytes=sourceMidi(writer);app.setRepository(repo);
  let calls=0;const prepare=intake.prepareMidiImport;intake.prepareMidiImport=(...args)=>{calls++;return prepare(...args)};
  const result=await app.importExternalSongFile(midiFile('AI Arrangement.mid',bytes)),stored=await repo.get(result.project.projectId);
  assert.equal(result.ok,true);assert.equal(calls,1);assert.equal(stored.schemaVersion,'1.0');assert.equal(app.APP_VERSION,'1.4.0');
  const external=stored.midiData.tracks.filter(track=>track.roleAssignment==='unassigned');
  assert.equal(external.length,3);assert.ok(external.every(track=>track.part===undefined));
  assert.deepEqual(Array.from(external,track=>track.name),['AI Vocal','AI Drums','AI Strings']);
  assert.equal(stored.importSource.trackAssignmentPolicy,'explicit-only');
  const summary=app.externalSongImportHtml();
  for(const text of ['Import成功：AI Arrangement.mid','MIDI Type','Track','playable Track','note','BPM','拍子','Trackの割当はまだ行われていません'])assert.match(summary,new RegExp(text));
});

test('cancel and failed external import leave every existing project unchanged',async()=>{
  const{app}=loadApp(),repo=app.memoryRepository(),existing=app.makeProject({projectId:'keep',projectName:'Keep',productionNotes:'unchanged'});app.setRepository(repo);await repo.put(existing);app.state.projects=[existing];const before=JSON.stringify(await repo.list());
  assert.equal((await app.importExternalSongFile()).cancelled,true);
  const broken=await app.importExternalSongFile(midiFile('broken.mid',[0,1,2,3]));
  assert.equal(broken.ok,false);assert.equal(JSON.stringify(await repo.list()),before);assert.match(app.externalSongImportHtml(),/Import失敗/);
});

test('repository failure does not expose a partial external project',async()=>{
  const{app,writer}=loadApp(),base=app.memoryRepository(),existing=app.makeProject({projectId:'keep',projectName:'Keep'}),repo={...base,async put(project){if(project.projectId!=='keep')throw Error('storage unavailable');return base.put(project)}};app.setRepository(repo);await repo.put(existing);app.state.projects=[existing];const before=JSON.stringify(app.state.projects),result=await app.importExternalSongFile(midiFile('failure.mid',sourceMidi(writer)));
  assert.equal(result.ok,false);assert.equal(JSON.stringify(app.state.projects),before);assert.deepEqual(Array.from(await repo.list(),item=>item.projectId),['keep']);
});

test('external import summary CSS stays compact and responsive',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-external-import\{display:grid;gap:7px;padding:9px/);
  assert.match(css,/@media\(max-width:600px\)\{\.music-external-import-result dl\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
});
