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
