const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');

function load(){
  const values=new Map([['novaStudio_v01','nova-safe'],['aiMusicHelperProject','ai-safe']]);
  const window={crypto:{randomUUID:(()=>{let n=0;return()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`})()},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},location:{hash:'#music-studio'},addEventListener(){},setTimeout,clearTimeout,Intl,Date,Math,JSON,console};
  window.window=window;
  vm.runInNewContext(source,{window,globalThis:window},{filename:'music-studio.js'});
  return{app:window.MusicStudio,values};
}

test('Version 1 project defaults and required fields are valid',()=>{
  const {app}=load();
  const project=app.makeProject({projectName:'テスト曲'});
  assert.equal(project.format,'music-studio-project');
  assert.equal(project.schemaVersion,'1.0');
  assert.equal(project.musicalSettings.bpm,120);
  assert.deepEqual({...project.musicalSettings.timeSignature},{numerator:4,denominator:4});
  assert.equal(project.musicalSettings.key,null);
  assert.equal(project.status,'idea');
  assert.equal(app.validateProject(project).valid,true);
});

test('validator rejects corrupt and foreign formats without writing',()=>{
  const {app}=load();
  assert.equal(app.validateProject(null).valid,false);
  const foreign=app.makeProject({projectName:'別形式'});foreign.format='nova-studio-backup';
  assert.equal(app.validateProject(foreign).valid,false);
  const bad=app.makeProject({projectName:'BPM不正'});bad.musicalSettings.bpm=999;
  assert.equal(app.validateProject(bad).valid,false);
});

test('repository creates, persists, lists and deletes only the target',async()=>{
  const {app}=load();const repo=app.memoryRepository();app.setRepository(repo);
  const a=app.makeProject({projectName:'A'}),b=app.makeProject({projectName:'B'});
  await repo.put(a);await repo.put(b);
  assert.equal((await repo.list()).length,2);
  await repo.delete(a.projectId);
  assert.equal(await repo.get(a.projectId),null);
  assert.equal((await repo.get(b.projectId)).projectName,'B');
});

test('JSON import preserves existing data and renews duplicate IDs',async()=>{
  const {app}=load();const repo=app.memoryRepository();app.setRepository(repo);
  const original=app.makeProject({projectName:'Original'});await repo.put(original);
  const result=await app.importText(JSON.stringify(original));
  assert.equal(result.ok,true);assert.equal(result.duplicated,true);
  assert.notEqual(result.project.projectId,original.projectId);
  assert.equal((await repo.list()).length,2);
  assert.equal((await repo.get(original.projectId)).projectName,'Original');
});

test('project JSON round trip preserves Melody Drums and Bass tracks exactly',async()=>{
  const {app}=load(),repo=app.memoryRepository();app.setRepository(repo);
  const tracks=[
    {id:'melody',part:'melody',name:'Melody',channel:1,program:0,muted:false,notes:[{id:'m1',pitch:64,startTick:0,durationTicks:480,velocity:91}]},
    {id:'drums',part:'drums',name:'Drums',channel:10,program:null,muted:false,notes:[{id:'d1',pitch:38,startTick:240,durationTicks:120,velocity:112}]},
    {id:'bass',part:'bass',name:'Bass',channel:2,program:32,muted:true,notes:[{id:'b1',pitch:40,startTick:0,durationTicks:960,velocity:83}]}
  ],project=app.makeProject({projectId:'three-track-json',projectName:'Three Track JSON',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks}});
  await repo.put(project);const exported=await app.exportProject(project.projectId),result=await app.importText(exported.text);
  assert.equal(result.ok,true);assert.deepEqual(JSON.parse(JSON.stringify(result.project.midiData.tracks)),tracks);
  assert.deepEqual(JSON.parse(JSON.stringify((await repo.get(result.project.projectId)).midiData.tracks)),tracks);
});

test('broken JSON and unsupported versions leave projects untouched',async()=>{
  const {app}=load();const repo=app.memoryRepository();app.setRepository(repo);
  const original=app.makeProject({projectName:'Safe'});await repo.put(original);
  assert.equal((await app.importText('{broken')).ok,false);
  const future={...original,schemaVersion:'2.0'};
  assert.equal((await app.importText(JSON.stringify(future))).ok,false);
  assert.equal((await repo.list()).length,1);
});

test('Music Studio never overwrites Nova Studio or ai-music-helper keys',async()=>{
  const {app,values}=load();const repo=app.memoryRepository();app.setRepository(repo);
  const project=app.makeProject({projectName:'Separated'});await repo.put(project);
  await app.importText(JSON.stringify(project));
  assert.equal(values.get('novaStudio_v01'),'nova-safe');
  assert.equal(values.get('aiMusicHelperProject'),'ai-safe');
  assert.equal(app.DB_NAME,'music-studio-projects');
  assert.equal(app.LAST_PROJECT_KEY,'musicStudio_lastProjectId_v1');
});
