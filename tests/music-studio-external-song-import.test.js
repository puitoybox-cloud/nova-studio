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

test('external Track Review shows identifiers summaries and explicit unassigned defaults without auto assignment',()=>{
  const{app,editor}=loadApp(),project=app.makeProject({projectId:'review-ui',projectName:'Review UI',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[
    {id:'external-vocal',name:'Melody',channel:10,program:53,roleAssignment:'unassigned',notes:[{id:'n1',pitch:67,startTick:0,durationTicks:480,velocity:90}]}
  ]}});app.state.projects=[project];const html=app.renderRoute('music-studio/midi-editor/review-ui'),review=editor.externalReviewTracks(app.state.midiEditor.midiData);
  assert.equal(review[0].roleAssignment,'unassigned');assert.equal(review[0].id,'external-vocal');assert.equal(review[0].noteCount,1);
  for(const text of ['External Track Review / Assignment','external-vocal','Melody','Channel 10','Program 53','1 notes','Current: unassigned','Apply Assignment','Cancel'])assert.match(html,new RegExp(text));
  assert.equal(app.state.midiEditor.midiData.tracks.find(track=>track.id==='external-vocal').part,undefined);
});

test('Editor render mounts exactly three review rows for the real six-Track compatibility layout',()=>{
  const{app,editor}=loadApp(),notes=(prefix,pitch)=>Array.from({length:12},(_,index)=>({id:`${prefix}-${index}`,pitch,startTick:index*120,durationTicks:120,velocity:90})),compatibility=['melody','drums','bass'].map(part=>({id:part,name:part,part,roleAssignment:part,notes:[]})),external=[
    {id:'midi-track-2',name:'Melody',channel:1,program:1,roleAssignment:'unassigned',notes:notes('m2',60)},
    {id:'midi-track-3',name:'Drums',channel:10,program:null,roleAssignment:'unassigned',notes:notes('m3',38)},
    {id:'midi-track-4',name:'Bass',channel:2,program:33,roleAssignment:'unassigned',notes:notes('m4',36)}
  ],project=app.makeProject({projectId:'real-review-case',projectName:'Real Review Case',midiData:{version:1,ppq:480,tempo:72,timeSignature:{numerator:4,denominator:4},tracks:[...compatibility,...external]}});app.state.projects=[project];
  const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),review=editor.externalReviewTracks(app.state.midiEditor.midiData);
  assert.equal(review.length,3);assert.equal(review.reduce((sum,track)=>sum+track.noteCount,0),36);assert.deepEqual(Array.from(review,track=>track.id),['midi-track-2','midi-track-3','midi-track-4']);
  assert.equal((html.match(/class="music-external-track-review"/g)||[]).length,1);assert.equal((html.match(/class="music-external-track-row"/g)||[]).length,3);
  for(const id of ['midi-track-2','midi-track-3','midi-track-4'])assert.match(html,new RegExp(`data-track-id="${id}"`));
  for(const part of ['melody','drums','bass'])assert.doesNotMatch(html,new RegExp(`class="music-external-track-row" data-track-id="${part}"`));
});

test('External Track Review renders after import and repository reload, including assigned roles',async()=>{
  const{app,writer}=loadApp(),repo=app.memoryRepository();app.setRepository(repo);
  const imported=await app.importExternalSongFile(midiFile('review-after-import.mid',sourceMidi(writer))),route=`music-studio/midi-editor/${imported.project.projectId}`;
  let html=app.renderRoute(route);assert.equal((html.match(/class="music-external-track-row"/g)||[]).length,3);
  const stored=await repo.get(imported.project.projectId);stored.midiData.tracks.filter(track=>!track.part).forEach((track,index)=>{track.roleAssignment=['melody','drums','bass'][index]});await repo.put(stored);
  app.state.projects=await repo.list();app.state.midiEditor=null;app.state.externalTrackAssignmentDraft=null;html=app.renderRoute(route);
  assert.equal((html.match(/class="music-external-track-row"/g)||[]).length,3);for(const role of ['melody','drums','bass'])assert.match(html,new RegExp(`Current: ${role}`));
});

test('External Track Review stays absent without external Tracks and cannot flex-collapse when present',()=>{
  const{app}=loadApp(),project=app.makeProject({projectId:'compatibility-only',projectName:'Compatibility Only'});app.state.projects=[project];
  assert.doesNotMatch(app.renderRoute(`music-studio/midi-editor/${project.projectId}`),/music-external-track-review/);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');assert.match(css,/\.music-midi-editor-page>\.music-external-track-review\{[^}]*min-height:34px;flex:0 0 auto;[^}]*overflow-y:auto/);
});

test('manual Melody Drums Bass assignments and return to Unassigned preserve Track IDs notes and save reload',async()=>{
  const{app,editor}=loadApp(),repo=app.memoryRepository(),tracks=['melody','drums','bass'].map((role,index)=>({id:`external-${role}`,name:`AI ${role}`,channel:index+1,program:40+index,roleAssignment:'unassigned',notes:[{id:`note-${role}`,pitch:60+index,startTick:index*240,durationTicks:480,velocity:80+index}]})),project=app.makeProject({projectId:'assignment-save',projectName:'Assignment Save',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks}});app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.midiEditorView(project.projectId);
  const before=JSON.stringify(editor.externalReviewTracks(app.state.midiEditor.midiData).map(track=>[track.id,track.noteCount,track.channel,track.program]));
  for(const role of ['melody','drums','bass'])app.editorDraftExternalTrackAssignment(`external-${role}`,role);
  const applied=await app.editorApplyExternalTrackAssignments(),stored=await repo.get(project.projectId),session=editor.createSession(stored);
  assert.equal(applied.ok,true);assert.deepEqual(Array.from(editor.externalReviewTracks(session.midiData),track=>track.roleAssignment),['melody','drums','bass']);
  assert.equal(JSON.stringify(editor.externalReviewTracks(session.midiData).map(track=>[track.id,track.noteCount,track.channel,track.program])),before);
  app.state.midiEditor=session;app.state.externalTrackAssignmentDraft=null;app.editorDraftExternalTrackAssignment('external-melody','unassigned');assert.equal((await app.editorApplyExternalTrackAssignments()).ok,true);
  assert.equal((await repo.get(project.projectId)).midiData.tracks.find(track=>track.id==='external-melody').roleAssignment,'unassigned');
});

test('invalid and duplicate external assignments are atomic and Cancel is non-destructive',()=>{
  const{app,editor}=loadApp(),project=app.makeProject({projectId:'assignment-conflict',projectName:'Conflict',midiData:{version:1,tracks:[
    {id:'external-a',name:'A',roleAssignment:'unassigned',notes:[{id:'a1',pitch:60,startTick:0,durationTicks:480,velocity:90}]},
    {id:'external-b',name:'B',roleAssignment:'unassigned',notes:[{id:'b1',pitch:62,startTick:0,durationTicks:480,velocity:90}]}
  ]}});app.state.projects=[project];app.midiEditorView(project.projectId);const before=JSON.stringify(app.state.midiEditor.midiData.tracks);
  const conflict=editor.applyExternalTrackAssignments(app.state.midiEditor,{'external-a':'melody','external-b':'melody'}),invalid=editor.applyExternalTrackAssignments(app.state.midiEditor,{'missing':'bass'});
  assert.equal(conflict.applied,false);assert.ok(conflict.errors.includes('duplicate-role'));assert.equal(invalid.applied,false);assert.equal(JSON.stringify(app.state.midiEditor.midiData.tracks),before);
  app.editorDraftExternalTrackAssignment('external-a','bass');assert.equal(app.editorCancelExternalTrackAssignments().cancelled,true);assert.equal(JSON.stringify(app.state.midiEditor.midiData.tracks),before);
});

test('assignment metadata keeps compatibility tracks separate and All MIDI exports each external Track once',()=>{
  const{app,writer,editor}=loadApp(),project=app.makeProject({projectId:'assignment-export',projectName:'Export',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[
    {id:'external-kit',name:'AI Drums',channel:10,program:null,roleAssignment:'drums',notes:[{id:'d1',pitch:38,startTick:0,durationTicks:120,velocity:100}]}
  ]}});app.state.projects=[project];const session=editor.createSession(project),external=session.midiData.tracks.find(track=>track.id==='external-kit'),input=app.midiExportInput({...project,midiData:session.midiData},'all'),result=writer.createMidiFile(input),parsed=writer.inspectMidiBytes(result.bytes);
  assert.equal(external.part,undefined);assert.deepEqual(Array.from(session.midiData.tracks.filter(track=>track.part),track=>track.part),['melody','drums','bass']);assert.equal(input.tracks.filter(track=>track.id==='external-kit').length,1);assert.equal(parsed.tracks.filter(track=>track.name==='AI Drums').length,1);
});

test('External Track Review CSS remains compact at desktop tablet and phone boundaries',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-external-track-review\{margin:6px 0/);assert.match(css,/grid-template-columns:minmax\(0,1fr\) 150px/);assert.match(css,/@media\(max-width:600px\)\{\.music-external-track-row\{grid-template-columns:1fr\}/);
});
