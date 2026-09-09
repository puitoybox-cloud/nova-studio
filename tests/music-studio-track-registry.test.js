const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(){
  const window={crypto:{randomUUID:()=> 'unused'}};window.window=window;window.globalThis=window;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);
  return window.MusicStudioEditor
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('track registry enumerates standard and unknown tracks in source order without mutation',()=>{
  const core=load(),tracks=[
    {id:'bass',part:'bass',channel:2,program:32,notes:[]},
    {id:'external-strings',name:'Strings',channel:3,program:48,channels:[3],programChanges:[{tick:0,program:48}],controlChanges:[{tick:0,controller:1,value:64}],pitchBends:[{tick:120,value:256}],unsupportedEvents:[{type:15}],custom:{kept:true},notes:[]},
    {id:'melody',part:'melody',channel:1,program:0,notes:[]},
    {id:'drums',part:'drums',channel:10,program:null,drumCandidate:true,notes:[]}
  ],before=JSON.stringify(tracks),registry=core.createTrackRegistry({tracks});
  assert.deepEqual(Array.from(registry.tracks,track=>track.id),['bass','external-strings','melody','drums']);
  assert.equal(registry.tracks[1],tracks[1]);assert.equal(registry.validation.ok,true);
  assert.equal(JSON.stringify(tracks),before);assert.equal(Object.isFrozen(registry),true);assert.equal(Object.isFrozen(registry.tracks),true)
});

test('exact ID lookup returns the first source-order match and missing or invalid IDs return null',()=>{
  const core=load(),first={id:'same',name:'First'},second={id:'same',name:'Second'},tracks=[first,{id:'Same'},second,{id:null},{id:''},{id:42}],registry=core.createTrackRegistry(tracks);
  assert.equal(core.getTrackById(tracks,'same'),first);assert.equal(registry.getTrackById('same'),first);
  assert.equal(registry.getTrackById('Same'),tracks[1]);assert.equal(registry.getTrackById('missing'),null);
  assert.equal(registry.getTrackById(null),null);assert.equal(registry.getTrackById(''),null);assert.equal(registry.getTrackById(42),null)
});

test('registry validation reports duplicate blank missing and non-string IDs without repair',()=>{
  const core=load(),tracks=[{id:'kept'},{id:'kept'},{id:''},{id:'   '},{id:null},{}, {id:42}],before=JSON.stringify(tracks),result=core.validateTrackRegistry(tracks);
  assert.equal(result.ok,false);assert.deepEqual(Array.from(result.duplicateIds),['kept']);assert.deepEqual(Array.from(result.invalidIndexes),[2,3,4,5,6]);
  assert.deepEqual(plain(result.issues),[
    {type:'duplicate-id',id:'kept',firstIndex:0,index:1},
    {type:'invalid-id',reason:'blank',index:2,id:''},
    {type:'invalid-id',reason:'blank',index:3,id:'   '},
    {type:'invalid-id',reason:'missing',index:4,id:null},
    {type:'invalid-id',reason:'missing',index:5,id:null},
    {type:'invalid-id',reason:'non-string',index:6,id:42}
  ]);assert.equal(JSON.stringify(tracks),before)
});

test('core role resolution recognizes only explicit core part or canonical ID',()=>{
  const core=load();
  for(const role of ['melody','drums','bass']){assert.equal(core.resolveCoreTrackRole({part:role,id:`custom-${role}`}),role);assert.equal(core.resolveCoreTrackRole({id:role}),role);assert.equal(core.isCoreTrack({part:role}),true);assert.equal(core.isKnownTrack({id:role}),true)}
  for(const track of [{id:'strings',name:'Melody'},{id:'kit',channel:10},{id:'low',program:32},{id:'other',part:'lead'}]){assert.equal(core.resolveCoreTrackRole(track),null);assert.equal(core.isKnownTrack(track),false)}
});

test('drum helper preserves existing recognition without misclassifying pitched tracks',()=>{
  const core=load();
  for(const track of [{part:'drums'},{id:'drums'},{id:'kit',channel:10},{id:'candidate',drumCandidate:true},{id:'named',name:'Drums'}])assert.equal(core.isDrumTrack(track),true);
  for(const track of [{id:'strings',name:'Strings',channel:3,program:48},{id:'lead',name:'Lead',channel:1,program:0},{id:'bass-line',name:'Bass',channel:2,program:32}])assert.equal(core.isDrumTrack(track),false)
});

test('registry preserves import fields and project round trips',()=>{
  const core=load(),tracks=[
    {id:'melody',part:'melody',channel:1,program:0,notes:[]},
    {id:'external',name:'Strings',channel:3,program:48,channels:[3],programChanges:[{tick:0,program:48}],controlChanges:[{tick:0,controller:1,value:64}],pitchBends:[{tick:120,value:256}],drumCandidate:false,unsupportedEvents:[{type:15}],custom:{kept:true},notes:[]},
    {id:'drums',part:'drums',channel:10,program:null,notes:[]},
    {id:'bass',part:'bass',channel:2,program:32,notes:[]}
  ],project={schemaVersion:'1.0',midiData:{tracks}},before=JSON.stringify(project);
  const registry=core.createTrackRegistry(project.midiData);assert.deepEqual(Array.from(registry.tracks,track=>track.id),['melody','external','drums','bass']);
  const projectJson=plain(project),indexedDb=plain(project),backup=plain({projects:[project]}).projects[0],smfImport=plain(tracks);
  for(const value of [projectJson,indexedDb,backup]){core.createTrackRegistry(value.midiData);assert.deepEqual(value,project)}
  core.createTrackRegistry(smfImport);assert.deepEqual(smfImport,tracks);assert.equal(JSON.stringify(project),before)
});

test('registry does not add delete reorder repair or persist tracks',()=>{
  const core=load(),tracks=[{id:'melody',part:'melody'},{id:'unknown',custom:true},{id:'melody',part:'lead'},{id:''}],midiData={tracks},before=JSON.stringify(midiData),registry=core.createTrackRegistry(midiData);
  assert.deepEqual(Array.from(registry.tracks,track=>track.id),['melody','unknown','melody','']);
  assert.deepEqual(Array.from(registry.validation.duplicateIds),['melody']);assert.deepEqual(Array.from(registry.validation.invalidIndexes),[3]);
  assert.equal(JSON.stringify(midiData),before);assert.equal(Object.hasOwn(midiData,'registry'),false)
});

test('track type catalog prefers valid explicit values and uses only technical legacy evidence',()=>{
  const core=load(),type=core.resolveTrackType;
  assert.deepEqual(plain(core.TRACK_TYPES),{MIDI_MELODIC:'midi-melodic',MIDI_DRUMS:'midi-drums',AUDIO:'audio',UNKNOWN:'unknown'});
  for(const value of Object.values(core.TRACK_TYPES))assert.equal(type({trackType:value,channel:value==='audio'?10:1}),value);
  assert.equal(type({trackType:'invalid',channel:1}),'midi-melodic');assert.equal(type({channel:1}),'midi-melodic');assert.equal(type({notes:[]}),'midi-melodic');assert.equal(type({}),'unknown');
  assert.equal(type({id:'external-channel-10',channel:10}),'midi-drums');assert.equal(core.resolveTrackRole({id:'external-channel-10',channel:10}),'unassigned');assert.equal(core.resolveCoreTrackSlot({id:'external-channel-10',channel:10}),null)
});

test('track role catalog separates explicit role core fallback and unassigned without inference',()=>{
  const core=load();
  assert.deepEqual(Object.values(plain(core.TRACK_ROLES)),['unassigned','melody','drums','bass','vocal','piano','guitar','strings','synth','fx','other']);
  assert.equal(core.resolveTrackRole({part:'melody',roleAssignment:'strings'}),'strings');
  for(const role of ['melody','drums','bass']){assert.equal(core.resolveTrackRole({part:role}),role);assert.equal(core.resolveTrackRole({id:role}),role)}
  assert.equal(core.resolveTrackRole({part:'melody',roleAssignment:'invalid'}),'melody');assert.equal(core.resolveTrackRole({id:'external',roleAssignment:'invalid'}),'unassigned');assert.equal(core.resolveTrackRole({id:'external'}),'unassigned');
  for(const track of [{id:'x',name:'Drums'},{id:'x',program:32},{id:'x',channel:10},{id:'x',order:0}])assert.equal(core.resolveTrackRole(track),'unassigned')
});

test('core slots require exact compatibility part or canonical ID and ignore assignment and heuristics',()=>{
  const core=load();assert.deepEqual(plain(core.CORE_TRACK_SLOTS),{MELODY:'melody',DRUMS:'drums',BASS:'bass'});
  for(const slot of ['melody','drums','bass']){assert.equal(core.resolveCoreTrackSlot({part:slot,id:`custom-${slot}`}),slot);assert.equal(core.resolveCoreTrackSlot({id:slot}),slot)}
  for(const track of [{id:'external',roleAssignment:'melody'},{id:'kit',channel:10},{id:'Melody'},{id:'external',part:'Melody'},{id:'external',name:'Bass',program:32}])assert.equal(core.resolveCoreTrackSlot(track),null)
});

test('role cardinality is future registry metadata and leaves current four-role assignment contract unchanged',()=>{
  const core=load(),cardinality=plain(core.ROLE_CARDINALITY);
  for(const role of ['melody','drums','bass'])assert.equal(cardinality[role].maxExternalAssignments,1);
  for(const role of ['unassigned','vocal','piano','guitar','strings','synth','fx','other'])assert.equal(cardinality[role].maxExternalAssignments,null);
  assert.deepEqual(Array.from(core.EXTERNAL_TRACK_ROLES),['unassigned','melody','drums','bass']);assert.equal(core.validateExternalTrackAssignments([{id:'external',roleAssignment:'unassigned'}],{external:'vocal'}).ok,false)
});

test('capability matrix distinguishes core external MIDI audio and unknown tracks',()=>{
  const core=load(),caps=track=>plain(core.resolveTrackCapabilities(track)),melodic={canEditNotes:true,canRecordMidi:true,canPlayMidi:true,supportsPitchCorrection:false,supportsDrumLabels:false,supportsPartialEdit:false},drum={...melodic,supportsDrumLabels:true},none={canEditNotes:false,canRecordMidi:false,canPlayMidi:false,supportsPitchCorrection:false,supportsDrumLabels:false,supportsPartialEdit:false};
  assert.deepEqual(caps({part:'melody'}),{...melodic,supportsPitchCorrection:true,supportsPartialEdit:true});assert.deepEqual(caps({part:'drums'}),{...drum,supportsPartialEdit:true});assert.deepEqual(caps({part:'bass'}),{...melodic,supportsPartialEdit:true});
  assert.deepEqual(caps({id:'external-melodic',trackType:'midi-melodic'}),melodic);assert.deepEqual(caps({id:'external-drums',trackType:'midi-drums'}),drum);assert.deepEqual(caps({trackType:'audio'}),none);assert.deepEqual(caps({trackType:'unknown'}),none)
});

test('classification normalization preserves identity content name role and optional valid type only',()=>{
  const core=load(),note={id:'n',pitch:60,startTick:0,durationTicks:480,velocity:90},base={id:'external',name:'Lead Piano',roleAssignment:'piano',channel:1,program:0,order:4,notes:[note],unsupportedEvents:[{type:15}]},before=JSON.stringify(base),missing=core.normalizeTrackClassification(base),valid=core.normalizeTrackClassification({...base,trackType:'midi-melodic'}),invalid=core.normalizeTrackClassification({...base,trackType:'not-a-type'}),invalidRole=core.normalizeTrackClassification({...base,roleAssignment:'broken'});
  assert.equal(Object.hasOwn(missing,'trackType'),false);assert.equal(valid.trackType,'midi-melodic');assert.equal(Object.hasOwn(invalid,'trackType'),false);assert.equal(invalidRole.roleAssignment,'broken');
  for(const value of [missing,valid,invalid,invalidRole]){assert.equal(value.id,'external');assert.equal(value.name,'Lead Piano');assert.deepEqual(plain(value.notes),[note]);assert.deepEqual(plain(value.unsupportedEvents),[{type:15}])}
  assert.equal(JSON.stringify(base),before);valid.notes[0].pitch=1;assert.equal(note.pitch,60);assert.equal(core.resolveTrackDisplayName(valid),'Lead Piano')
});
