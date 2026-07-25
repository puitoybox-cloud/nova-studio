const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');
function load(){
  const values=new Map([['novaStudio_v01','nova-safe'],['aiMusicHelperProject','ai-safe']]);
  const window={crypto:{randomUUID:()=>`id-1`},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},location:{hash:'#music-studio/logic-pro'},addEventListener(){},setTimeout,clearTimeout,Intl,Date,Math,JSON,console,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob};window.window=window;
  const midiSource=fs.readFileSync(path.join(__dirname,'..','music-studio-midi.js'),'utf8');vm.runInNewContext(midiSource,{window,globalThis:window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,unescape,encodeURIComponent},{filename:'music-studio-midi.js'});const parserSource=fs.readFileSync(path.join(__dirname,'..','music-studio-midi-parser.js'),'utf8');vm.runInNewContext(parserSource,{window,globalThis:window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,unescape,encodeURIComponent},{filename:'music-studio-midi-parser.js'});
  vm.runInNewContext(source,{window,globalThis:window},{filename:'music-studio.js'});return{app:window.MusicStudio,values,window};
}
function file(name,bytes,type='application/octet-stream'){const data=Uint8Array.from(bytes);return{name,size:data.length,type,async arrayBuffer(){return data.buffer},slice(start,end){const part=data.slice(start,end);return{async arrayBuffer(){return part.buffer}}}}}

test('Logic Pro route opens standalone and includes safe round-trip actions',()=>{const {app}=load();const html=app.renderRoute('music-studio/logic-pro',{standalone:true});assert.match(html,/Logic Pro X連携/);assert.match(html,/Logic ProからMIDIを取り込む/);assert.match(html,/Type 1 MIDIを書き出す/);assert.match(html,/新規または複製/);assert.match(html,/読み込み履歴/);assert.match(html,/Music Studioホームへ戻る/)});
test('route reads normalized project data without mutating settings',()=>{const {app}=load();app.state.settings=app.normalizeSettings({midi:{fileType:0,ppq:960,channel:3,autoChannel:false},fileNaming:{template:'{projectName}_{type}'}});const before=JSON.stringify(app.state.settings),html=app.logicProView();assert.match(html,/Type 0／1読み込み/);assert.equal(JSON.stringify(app.state.settings),before)});
test('no MIDI data produces an explanation and no download',()=>{const {app}=load();assert.equal(app.requestMidiExport().validation.ok,false);assert.match(app.state.notice,/書き出せません/)});
test('MIDI boundary trusts content over extension and rejects broken files',async()=>{const {app,window}=load(),generated=window.MusicStudioMidi.createMidiFile(window.MusicStudioMidi.createTestMidiData()).bytes;assert.equal((await app.inspectMidiFile(file('safe.mid',generated))).ok,true);assert.equal((await app.inspectMidiFile(file('wrong.txt',generated))).ok,true);assert.equal((await app.inspectMidiFile(file('broken.mid',[0,1,2,3]))).ok,false);assert.equal((await app.inspectMidiFile()).cancelled,true)});
test('audio reference records no body and rejects unsupported formats',()=>{const {app}=load();assert.equal(app.inspectAudioReference(file('mix.wav',[1,2,3],'audio/wav')).ok,true);assert.equal(app.inspectAudioReference(file('mix.mp3',[1,2,3],'audio/mpeg')).ok,false);assert.equal(app.inspectAudioReference().cancelled,true)});
test('existing project and other application data remain unchanged',async()=>{const {app,values,window}=load();const repo=app.memoryRepository();app.setRepository(repo);const project=app.makeProject({projectName:'Safe'});await repo.put(project);const generated=window.MusicStudioMidi.createMidiFile(window.MusicStudioMidi.createTestMidiData()).bytes;await app.inspectMidiFile(file('return.mid',generated));assert.deepEqual(await repo.get(project.projectId),project);assert.equal(values.get('novaStudio_v01'),'nova-safe');assert.equal(values.get('aiMusicHelperProject'),'ai-safe')});
test('new MIDI import creates a new editable Version 1 project and metadata-only history',async()=>{const {app,window}=load(),repo=app.memoryRepository();app.setRepository(repo);const bytes=window.MusicStudioMidi.createMidiFile(window.MusicStudioMidi.createTestMidiData()).bytes;await app.inspectMidiFile(file('Logic Song.mid',bytes,'audio/midi'));const result=await app.saveMidiImport('new'),stored=await repo.get(result.project.projectId),history=await repo.listMidiImportHistory();assert.equal(result.ok,true);assert.equal(stored.schemaVersion,'1.0');assert.equal(stored.projectName,'Logic Song');assert.equal(stored.midiData.tracks.reduce((n,t)=>n+t.notes.length,0),10);assert.equal(window.location.hash.includes('music-studio/midi-editor/'),true);assert.equal(history.length,1);assert.equal(JSON.stringify(history).includes('bytes'),false);assert.equal(JSON.stringify(stored).includes('/Users/'),false)});
test('duplicate MIDI import leaves the source project byte-for-byte unchanged',async()=>{const {app,window}=load(),repo=app.memoryRepository(),source=app.makeProject({projectId:'source',projectName:'Original',productionNotes:'keep'});app.setRepository(repo);await repo.put(source);app.state.projects=[source];const before=JSON.stringify(await repo.get('source')),bytes=window.MusicStudioMidi.createMidiFile(window.MusicStudioMidi.createTestMidiData()).bytes;await app.inspectMidiFile(file('duplicate.mid',bytes));const result=await app.saveMidiImport('duplicate');assert.equal(result.ok,true);assert.notEqual(result.project.projectId,'source');assert.equal(JSON.stringify(await repo.get('source')),before);assert.equal(result.project.importSource.fileName,'duplicate.mid');assert.equal(result.project.integrations.logicPro[0].sourceProjectId,'source')});
test('history failure does not roll back an imported project',async()=>{const {app,window}=load(),base=app.memoryRepository(),repo={...base,async putMidiImportHistory(){throw Error('history unavailable')}};app.setRepository(repo);const bytes=window.MusicStudioMidi.createMidiFile(window.MusicStudioMidi.createTestMidiData()).bytes;await app.inspectMidiFile(file('history.mid',bytes));const result=await app.saveMidiImport('new');assert.equal(result.ok,true);assert.ok(await repo.get(result.project.projectId));assert.match(result.history.historyWarning,/履歴/) });
test('cancelled import clears preview without writing',async()=>{const {app}=load(),repo=app.memoryRepository();app.setRepository(repo);app.state.midiImportPreview={error:'test'};app.cancelMidiImport();assert.equal(app.state.midiImportPreview,null);assert.equal((await repo.list()).length,0)});
test('responsive CSS stacks integration sections below tablet width',()=>{const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');const tablet=css.slice(css.indexOf('@media(max-width:900px)'));assert.match(tablet,/\.music-integration-grid\{grid-template-columns:1fr\}/)});
test('part and All exports keep tempo, PPQ, note timing, velocity and channel through round trip',()=>{
  const{app,window}=load(),project=app.makeProject({projectName:'NOVA / MIDI:*Test',midiData:{version:1,ppq:960,tempo:132,timeSignature:{numerator:6,denominator:8},tracks:[
    {id:'melody',part:'melody',name:'Melody',channel:1,program:0,notes:[{id:'m1',pitch:67,startTick:240,durationTicks:720,velocity:93}]},
    {id:'drums',part:'drums',name:'Drums',channel:10,program:null,notes:[{id:'d1',pitch:38,startTick:480,durationTicks:120,velocity:111}]},
    {id:'bass',part:'bass',name:'Bass',channel:2,program:32,notes:[{id:'b1',pitch:40,startTick:0,durationTicks:1440,velocity:82}]}
  ]}});
  for(const [scope,expected] of [['melody',{pitch:67,startTick:240,durationTicks:720,velocity:93,channel:1}],['drums',{pitch:38,startTick:480,durationTicks:120,velocity:111,channel:10}],['bass',{pitch:40,startTick:0,durationTicks:1440,velocity:82,channel:2}]]){
    const summary=app.midiExportSummary(project,scope),parsed=window.MusicStudioMidiParser.parseMidiFile(window.MusicStudioMidi.createMidiFile(summary.input).bytes).normalized,track=parsed.tracks.find(item=>item.noteCount);
    assert.equal(summary.validation.ok,true);assert.match(summary.filename,new RegExp(`_${scope[0].toUpperCase()+scope.slice(1)}\\.mid$`));assert.equal(parsed.ppq,960);assert.ok(Math.abs(parsed.tempo-132)<.001);assert.equal(`${parsed.timeSignature.numerator}/${parsed.timeSignature.denominator}`,'6/8');assert.equal(track.channel,expected.channel);assert.equal(track.notes[0].pitch,expected.pitch);assert.equal(track.notes[0].startTick,expected.startTick);assert.equal(track.notes[0].durationTicks,expected.durationTicks);assert.equal(track.notes[0].velocity,expected.velocity);
  }
  const all=app.midiExportSummary(project,'all'),roundTrip=window.MusicStudioMidiParser.parseMidiFile(window.MusicStudioMidi.createMidiFile(all.input).bytes).normalized;
  assert.equal(all.filename,'NOVA-MIDI-Test_All.mid');assert.equal(all.validation.trackCount,3);assert.equal(roundTrip.tracks.filter(track=>track.noteCount).length,3);assert.equal(roundTrip.totalNotes,3);
});
test('Drums editor export uses its explicit project instead of stale Piano project data',async()=>{
  const{app,values,window}=load(),repo=app.memoryRepository();app.setRepository(repo);
  const piano=app.makeProject({projectId:'piano-project',projectName:'Old Piano',midiData:window.MusicStudioMidi.createTestMidiData()});
  const drums=app.makeProject({projectId:'drums-project',projectName:'MS-RESTART-06 Drums Test',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[
    {id:'drums',part:'drums',name:'Drums',channel:10,program:null,notes:[
      {id:'kick',pitch:36,startTick:0,durationTicks:240,velocity:108},
      {id:'snare',pitch:38,startTick:480,durationTicks:240,velocity:100},
      {id:'hat',pitch:42,startTick:0,durationTicks:120,velocity:86}
    ]}
  ]}});
  await repo.put(piano);await repo.put(drums);app.state.projects=[piano,drums];values.set(app.LAST_PROJECT_KEY,piano.projectId);
  app.state.midiEditor={projectId:drums.projectId,part:'drums',midiData:drums.midiData};
  window.URL={createObjectURL:()=>`blob:test`,revokeObjectURL(){}};
  window.document={body:{dataset:{},appendChild(){}},createElement:()=>({click(){},remove(){}})};
  const exported=await app.performMidiExport('drums',drums.projectId);
  const parsed=window.MusicStudioMidiParser.parseMidiFile(exported.bytes).normalized,track=parsed.tracks.find(item=>item.noteCount);
  assert.equal(exported.ok,true);assert.equal(exported.history.projectId,drums.projectId);assert.equal(exported.filename,'MS-RESTART-06-Drums-Test_Drums.mid');
  assert.equal(track.name,'Drums');assert.equal(track.channel,10);assert.equal(track.drumCandidate,true);assert.deepEqual([...new Set(track.notes.map(note=>note.pitch))].sort((a,b)=>a-b),[36,38,42]);assert.equal(track.programChanges.length,0);
});
