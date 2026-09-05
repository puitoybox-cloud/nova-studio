const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const clone=value=>JSON.parse(JSON.stringify(value));
const plain=value=>JSON.parse(JSON.stringify(value));

function fakeIndexedDB(){
  const databases=new Map();
  const request=operation=>{const result={};queueMicrotask(()=>{try{result.result=operation();result.onsuccess?.()}catch(error){result.error=error;result.onerror?.()}});return result};
  return{open(name){
    const openRequest={};queueMicrotask(()=>{
      let db=databases.get(name),upgraded=false;
      if(!db){
        const stores=new Map();db={objectStoreNames:{contains:key=>stores.has(key)},createObjectStore(key){const records=new Map();stores.set(key,records);return{createIndex(){}}},transaction(key){const records=stores.get(key);return{objectStore(){return{getAll:()=>request(()=>[...records.values()].map(clone)),get:id=>request(()=>records.has(id)?clone(records.get(id)):undefined),getKey:id=>request(()=>records.has(id)?id:undefined),put:value=>request(()=>{const copy=clone(value),id=copy.projectId??copy.id??copy.backupId;records.set(id,copy);return id}),delete:id=>request(()=>records.delete(id))}}}}};databases.set(name,db);upgraded=true
      }
      openRequest.result=db;if(upgraded)openRequest.onupgradeneeded?.();openRequest.onsuccess?.()
    });return openRequest
  }}
}

function load(options={}){
  const values=new Map(),window={crypto:{randomUUID:(()=>{let n=0;return()=>`storage-id-${++n}`})()},indexedDB:options.indexedDB,localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},location:{hash:'#music-studio'},addEventListener(){},setTimeout,clearTimeout,Intl,Date,Math,JSON,console,TextEncoder};window.window=window;window.globalThis=window;
  for(const file of ['music-studio-editor.js','music-studio.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),{window,globalThis:window},{filename:file});
  return{app:window.MusicStudio,core:window.MusicStudioEditor,window}
}

function richProject(app,id='storage-project'){
  const tracks=[
    {id:'strings',part:null,name:'Strings',channel:3,program:48,muted:true,trackMetadata:{library:'legacy'},notes:[{id:'strings-low',pitch:0,startTick:0,durationTicks:153600,velocity:1,noteMetadata:{articulation:'long'}},{id:'strings-high',pitch:127,startTick:153600,durationTicks:960,velocity:127,noteMetadata:{articulation:'short'}}]},
    {id:'bass',part:'bass',name:'Bass',channel:2,program:32,muted:true,trackMetadata:{instrument:'fingered'},notes:[{id:'bass-1',pitch:28,startTick:0,durationTicks:1920,velocity:72,noteMetadata:{take:1}},{id:'bass-2',pitch:40,startTick:1920,durationTicks:480,velocity:96,noteMetadata:{take:2}}]},
    {id:'melody',part:'melody',name:'Melody',channel:1,program:0,muted:false,trackMetadata:{instrument:'lead'},notes:[{id:'melody-1',pitch:60,startTick:0,durationTicks:480,velocity:80,locked:true,noteMetadata:{lyric:'la'}},{id:'melody-2',pitch:67,startTick:960,durationTicks:240,velocity:104,noteMetadata:{lyric:'na'}}]},
    {id:'drums',part:'drums',name:'Drums',channel:10,program:null,muted:false,trackMetadata:{kit:'studio'},notes:[[36,110],[38,101],[42,84],[46,73]].map(([pitch,velocity],index)=>({id:`drum-${pitch}`,pitch,startTick:index*240,durationTicks:120,velocity,noteMetadata:{pad:index+1}}))}
  ];
  return app.makeProject({projectId:id,projectName:'Storage Regression',songTitle:'Three Tracks and Unknown',midiData:{version:1,ppq:960,tempo:137,timeSignature:{numerator:7,denominator:8},totalTick:184320,tracks,editor:{measureCount:96,editRange:{startMeasure:2,endMeasure:64},loopEnabled:true,loopStart:1920,loopEnd:7680,view:{zoom:3,pitchMin:24,pitchMax:84,pitchScrollTop:240,pitchScrollLeft:360,snapEnabled:false,snap:'1/8',quantizeEnabled:true,quantize:'1/16'},transport:{countInEnabled:false,metronomeEnabled:true}}}})
}

test('IndexedDB project round trip preserves three tracks Unknown metadata ordering and boundaries',async()=>{
  const indexedDB=fakeIndexedDB(),{app,core}=load({indexedDB}),repo=app.indexedDbRepository(),project=richProject(app);app.setRepository(repo);
  await repo.put(project);const reloaded=await repo.get(project.projectId);
  assert.deepEqual(plain(reloaded),plain(project));assert.deepEqual(plain(reloaded.midiData.tracks.map(track=>track.id)),['strings','bass','melody','drums']);
  const unknown=reloaded.midiData.tracks[0];assert.equal(unknown.part,null);assert.deepEqual(unknown.trackMetadata,{library:'legacy'});assert.equal(unknown.notes[0].pitch,0);assert.equal(unknown.notes[1].pitch,127);assert.equal(unknown.notes[0].velocity,1);assert.equal(unknown.notes[1].velocity,127);
  const drums=reloaded.midiData.tracks.find(track=>track.part==='drums'),bass=reloaded.midiData.tracks.find(track=>track.part==='bass');assert.equal(drums.channel,10);assert.equal(drums.program,null);assert.deepEqual(drums.notes.map(note=>[note.pitch,note.velocity]),[[36,110],[38,101],[42,84],[46,73]]);assert.equal(bass.channel,2);assert.equal(bass.program,32);assert.equal(bass.muted,true);
  const session=core.createSession(reloaded),sessionUnknown=session.midiData.tracks.find(track=>track.id==='strings');assert.equal(sessionUnknown.part,null);session.midiData.tracks.find(track=>track.part==='drums').trackMetadata={kit:'edited-and-saved'};core.updateDirty(session);app.state.midiEditor=session;app.state.projects=[reloaded];const saved=await app.saveMidiEditor({silent:true});assert.equal(saved.ok,true);assert.deepEqual(plain((await repo.get(project.projectId)).midiData.tracks.find(track=>track.part==='drums').trackMetadata),{kit:'edited-and-saved'})
});
test('IndexedDB JSON and reload preserve synchronized decimal BPM',async()=>{const indexedDB=fakeIndexedDB(),{app,core}=load({indexedDB}),repo=app.indexedDbRepository(),project=richProject(app,'bpm-persistence');app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.state.midiEditor=core.createSession(project);app.state.midiEditor.midiData.tempo=143.7;core.updateDirty(app.state.midiEditor);await app.saveMidiEditor({silent:true});const reloaded=await repo.get(project.projectId),exported=await app.exportProject(project.projectId),fresh=load(),target=fresh.app.memoryRepository();fresh.app.setRepository(target);const imported=await fresh.app.importText(exported.text),restored=await target.get(imported.project.projectId);for(const value of [reloaded,restored]){assert.equal(value.musicalSettings.bpm,143.7);assert.equal(value.midiData.tempo,143.7);assert.equal(value.schemaVersion,'1.0')}assert.equal(app.APP_VERSION,'1.4.0')});

test('Project JSON export import preserves MIDI editor state three tracks and Unknown exactly',async()=>{
  const{app}=load(),source=app.memoryRepository(),project=richProject(app,'json-source');app.setRepository(source);await source.put(project);const exported=await app.exportProject(project.projectId),target=app.memoryRepository();app.setRepository(target);const imported=await app.importText(exported.text),stored=await target.get(project.projectId);
  assert.equal(imported.ok,true);assert.deepEqual(plain(stored.midiData),plain(project.midiData));assert.deepEqual(plain(stored.midiData.tracks.map(track=>track.id)),['strings','bass','melody','drums']);assert.equal(stored.midiData.tracks[0].part,null)
});

test('three-track persistence excludes Solo Input Assignment recording state and GM labels',async()=>{
  const indexedDB=fakeIndexedDB(),{app}=load({indexedDB}),repo=app.indexedDbRepository(),project=richProject(app,'runtime-boundary');app.setRepository(repo);await repo.put(project);app.state.projects=[project];
  app.state.melodyAudio.playbackState.soloByTrackId={drums:true};Object.assign(app.state.midiInput,{targetPart:'bass',recording:true,recordingPart:'drums',recordingTrackId:'drums',liveNotes:[{id:'live',pitch:38,startTick:0,durationTicks:120,velocity:100}]});
  const stored=await repo.get(project.projectId),exported=await app.exportProject(project.projectId),backup=app.backupObject(),payloads=[stored,JSON.parse(exported.text),backup],forbidden=/soloByTrackId|targetPart|recordingPart|recordingTrackId|liveNotes|drumName|drumLabel|Kick|Snare|Closed Hi-Hat|Open Hi-Hat/;
  for(const payload of payloads)assert.doesNotMatch(JSON.stringify(payload),forbidden);
  const tracks=stored.midiData.tracks.filter(track=>track.part),byPart=Object.fromEntries(tracks.map(track=>[track.part,track]));assert.deepEqual(plain(tracks.map(track=>track.part)),['bass','melody','drums']);assert.equal(byPart.bass.muted,true);assert.equal(byPart.drums.channel,10);assert.equal(byPart.bass.channel,2);assert.equal(byPart.melody.program,0);assert.deepEqual(plain(byPart.drums.notes.map(note=>[note.pitch,note.startTick,note.durationTicks,note.velocity])),[[36,0,120,110],[38,240,120,101],[42,480,120,84],[46,720,120,73]]);
  const fresh=load(),target=fresh.app.memoryRepository();fresh.app.setRepository(target);const imported=await fresh.app.importText(exported.text);assert.equal(imported.ok,true);assert.equal(fresh.app.state.midiInput.targetPart,'melody');assert.deepEqual(plain((await target.get(project.projectId)).midiData.tracks),plain(project.midiData.tracks))
});

test('Backup restore recovers settings and multiple complete empty and legacy projects',async()=>{
  const{app}=load(),settings=app.defaultSettings();settings.projectDefaults.bpm=93;settings.backup.automaticEnabled=true;app.state.settings=settings;
  const complete=richProject(app,'backup-complete'),empty=app.makeProject({projectId:'backup-empty',projectName:'Empty Project',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[]}}),legacy=app.makeProject({projectId:'backup-legacy',projectName:'Legacy',midiData:{ppq:480,tracks:[{name:'Imported Piano',channel:1,notes:[{id:'legacy-note',pitch:62,startTick:239,durationTicks:481,velocity:87,legacyMetadata:true}]},{id:'legacy-unknown',name:'Strings',channel:3,program:48,notes:[]}]}});assert.equal(app.validateProject(app.makeProject({projectName:''})).valid,false);app.state.projects=[complete,empty,legacy];const backup=JSON.parse(JSON.stringify(app.backupObject())),target=app.memoryRepository();app.setRepository(target);app.state.projects=[];await app.persistSettings(app.defaultSettings());const result=await app.restoreBackup(backup,{settings:true,projects:true}),restored=(await target.list()).sort((a,b)=>a.projectId.localeCompare(b.projectId));
  assert.equal(result.ok,true);assert.equal(result.added,3);assert.equal(app.getSettings().projectDefaults.bpm,93);assert.deepEqual(plain(restored.map(project=>project.projectId)),['backup-complete','backup-empty','backup-legacy']);assert.deepEqual(plain(restored.find(project=>project.projectId==='backup-complete').midiData),plain(complete.midiData));assert.deepEqual(plain(restored.find(project=>project.projectId==='backup-empty').midiData),plain(empty.midiData));assert.deepEqual(plain(restored.find(project=>project.projectId==='backup-legacy').midiData),plain(legacy.midiData))
});

test('Legacy normalize save reload preserves notes and Unknown while adding canonical empty tracks',async()=>{
  const{app,core}=load(),repo=app.memoryRepository(),legacy=app.makeProject({projectId:'legacy-save',projectName:'Legacy Save',midiData:{ppq:480,tracks:[{name:'Imported Piano',channel:1,notes:[{id:'legacy-note',pitch:62,startTick:239,durationTicks:481,velocity:87,legacyMetadata:true}]},{id:'legacy-unknown',name:'Strings',channel:3,program:48,trackMetadata:{kept:true},notes:[{id:'unknown-note',pitch:71,startTick:0,durationTicks:960,velocity:64,noteMetadata:{kept:true}}]}]}}),session=core.createSession(legacy);app.setRepository(repo);await repo.put(legacy);await repo.put({...legacy,midiData:core.clone(session.midiData)});const reloaded=await repo.get(legacy.projectId),melody=reloaded.midiData.tracks.find(track=>track.part==='melody'),unknown=reloaded.midiData.tracks.find(track=>track.id==='legacy-unknown');
  assert.deepEqual(plain(reloaded.midiData.tracks.slice(0,3).map(track=>track.part)),['melody','drums','bass']);assert.deepEqual(plain(melody.notes[0]),{id:'legacy-note',pitch:62,startTick:239,durationTicks:481,velocity:87,legacyMetadata:true});assert.equal(unknown.part,undefined);assert.deepEqual(plain(unknown.trackMetadata),{kept:true});assert.deepEqual(plain(unknown.notes[0].noteMetadata),{kept:true})
});

test('automatic backup snapshots whole project after Melody Drums and Bass saves',async()=>{
  const{app,core}=load(),repo=app.memoryRepository(),project=richProject(app,'automatic-three-part');app.setRepository(repo);await repo.put(project);app.state.projects=[project];const settings=app.defaultSettings();settings.backup.automaticEnabled=true;settings.backup.intervalHours=1;settings.backup.maxCopies=5;await app.persistSettings(settings);
  for(const [index,part] of ['melody','drums','bass'].entries()){
    app.state.midiEditor=core.createSession(await repo.get(project.projectId));core.selectPart(app.state.midiEditor,part);core.addNote(app.state.midiEditor,{pitch:part==='melody'?69:part==='drums'?42:35,startTick:8000+index*480,durationTicks:240,velocity:90+index});await app.saveMidiEditor({silent:true});const saved=await repo.get(project.projectId);assert.equal(saved.midiData.tracks.find(track=>track.part===part).notes.some(note=>note.startTick===8000+index*480),true);const result=await app.runAutoBackupCheck(`2026-08-24T0${index*2}:00:00.000Z`);assert.equal(result.created,true);const snapshot=result.backup.snapshot.projects.find(item=>item.projectId===project.projectId);assert.deepEqual(snapshot.midiData,saved.midiData);assert.ok(snapshot.midiData.tracks.find(track=>track.id==='strings'))
  }
});
