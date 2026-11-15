'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function setup(){const c={console:{...console,error(){}},Date,Math,JSON,Intl,Blob,ArrayBuffer,DataView,Uint8Array,Float32Array,crypto:webcrypto,location:{hash:'#music-studio'}};c.window=c;vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),c);const app=c.MusicStudio,repo=app.memoryRepository();app.setRepository(repo);app.state.settings=app.defaultSettings();app.__testRoot=c;return{app,repo}}
const input=id=>({projectInput:{projectId:id,projectName:'New AI song'},midiData:{ppq:480,tracks:[]}});
test('AI new song refuses a colliding project ID without changing existing audio or history',async()=>{const{app,repo}=setup(),old=app.makeProject({projectId:'taken',projectName:'Protected',productionHistory:[{type:'original'}]});await repo.put(old);app.state.projects=[old];await assert.rejects(app.createAIProject(input('taken')),/stale-lyrics-assignment-storage/);assert.equal(JSON.stringify(await repo.get('taken')),JSON.stringify(old));assert.equal(app.state.projects.length,1)});
test('concurrent new song creation publishes exactly one project with its provenance',async()=>{const{app,repo}=setup();const results=await Promise.allSettled([app.createAIProject(input('race')),app.createAIProject(input('race'))]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);const p=await repo.get('race');assert.equal(p.productionHistory.length,1);assert.equal(p.productionHistory[0].source,'ai-new-song');assert.equal(app.validateProject(p).valid,true)});
test('project duplication checks source revision in the same transaction and leaves racing changes intact',async()=>{const{app,repo}=setup(),p=app.makeProject({projectId:'source',projectName:'Original'});await repo.put(p);app.state.projects=[p];const fork=repo.compareAndFork;repo.compareAndFork=async(...args)=>{const changed=await repo.get('source');changed.revision++;changed.productionNotes='Concurrent edit';await repo.put(changed);return fork(...args)};const result=await app.duplicateProject('source');assert.equal(result.ok,false);assert.equal((await repo.list()).length,1);assert.equal((await repo.get('source')).productionNotes,'Concurrent edit')});
test('successful duplicate preserves source and records exact source revision in saved copy',async()=>{const{app,repo}=setup(),p=app.makeProject({projectId:'source',projectName:'Original',productionHistory:[{type:'prior'}]});await repo.put(p);app.state.projects=[p];const result=await app.duplicateProject('source');assert.equal(result.ok,true,result.error);assert.equal(JSON.stringify(await repo.get('source')),JSON.stringify(p));const copy=await repo.get(result.project.projectId);assert.equal(copy.productionHistory[0].type,'prior');assert.equal(copy.productionHistory[1].type,'project-duplicate');assert.equal(copy.productionHistory[1].sourceRevision,p.revision);assert.equal(app.validateProject(copy).valid,true)});
test('new project quota failure publishes neither project nor local provenance',async()=>{const{app,repo}=setup();repo.compareAndPut=async()=>{throw Error('QuotaExceededError')};await assert.rejects(app.createAIProject(input('quota')),/QuotaExceededError/);assert.equal((await repo.list()).length,0);assert.equal(app.state.projects.length,0)});

test('committed AI project never enters a replacement repository view',async()=>{
 const{app,repo}=setup(),other=app.memoryRepository(),sentinel=app.makeProject({projectId:'other',projectName:'Other'});await other.put(sentinel);
 const write=repo.compareAndPut;repo.compareAndPut=async(...args)=>{const result=await write(...args);app.setRepository(other);app.state.projects=[sentinel];return result};
 const p=await app.createAIProject(input('committed'));assert.ok(await repo.get(p.projectId));assert.equal((await other.list()).length,1);assert.deepEqual(app.state.projects.map(p=>p.projectId),['other']);
 app.setRepository(repo);await app.refresh();assert.equal(app.state.projects[0].projectId,'committed');assert.equal(app.state.projects[0].productionHistory[0].source,'ai-new-song');
});
test('committed duplicate returns its receipt without changing replacement view',async()=>{
 const{app,repo}=setup(),other=app.memoryRepository(),p=app.makeProject({projectId:'source',projectName:'Original'}),sentinel=app.makeProject({projectId:'other',projectName:'Other'});await repo.put(p);app.state.projects=[p];await other.put(sentinel);
 const write=repo.compareAndFork;repo.compareAndFork=async(...args)=>{const result=await write(...args);app.setRepository(other);app.state.projects=[sentinel];return result};
 const result=await app.duplicateProject('source');assert.equal(result.ok,true);assert.equal(result.committed,true);assert.equal(result.refreshPending,true);assert.deepEqual(app.state.projects.map(p=>p.projectId),['other']);assert.ok(await repo.get(result.project.projectId));assert.equal(JSON.stringify(await repo.get('source')),JSON.stringify(p));assert.equal((await other.list()).length,1);
});
for(const kind of ['repository','editor'])test(`delayed refresh cannot replace changed ${kind} state`,async()=>{
 const{app,repo}=setup(),other=app.memoryRepository(),sentinel=app.makeProject({projectId:'current',projectName:'Current'});let resume;repo.list=()=>new Promise(resolve=>resume=resolve);
 const pending=app.refresh();if(kind==='repository')app.setRepository(other);app.state.projects=[sentinel];resume([app.makeProject({projectId:'old',projectName:'Stale'})]);
 const result=await pending;assert.equal(result.stale,true);assert.deepEqual(app.state.projects.map(p=>p.projectId),['current']);
});

for(const phase of ['commit','refresh'])for(const mode of ['view','dirty','midi','route','read-failure'])test(`durable duplicate retains receipt and current context after ${phase}/${mode}`,async()=>{
 const{app,repo}=setup(),p=app.makeProject({projectId:'source',projectName:'Original'});await repo.put(p);app.state.projects=[p];
 const replacement=app.makeProject({projectId:'current',projectName:'Current'}),list=repo.list.bind(repo),fork=repo.compareAndFork.bind(repo);let expected;
 const change=()=>{if(mode==='read-failure')throw Error('read-failed');if(mode==='view')app.state.projects=[replacement];if(mode==='dirty')app.state.dirty=true;if(mode==='midi')app.state.midiEditor={projectId:'current',sentinel:'new editor'};if(mode==='route')appRoot.location.hash='#music-studio/current';expected=JSON.stringify(app.state.projects)};
 const appRoot=app.__testRoot;
 if(phase==='commit')repo.compareAndFork=async(...args)=>{await fork(...args);if(mode==='read-failure')repo.list=async()=>{throw Error('read-failed')};else change()};
 else repo.list=async()=>{change();return list()};
 const result=await app.duplicateProject('source');assert.equal(result.ok,true);assert.equal(result.committed,true);assert.equal(result.refreshPending,true);assert.ok(await repo.get(result.project.projectId));assert.equal(JSON.stringify(await repo.get('source')),JSON.stringify(p));if(expected)assert.equal(JSON.stringify(app.state.projects),expected);assert.equal(appRoot.location.hash,mode==='route'?'#music-studio/current':'#music-studio');if(mode==='dirty')assert.equal(app.state.dirty,true);if(mode==='midi')assert.equal(app.state.midiEditor.sentinel,'new editor');
});

test('duplicate reconciles its exact stored event after losing the commit notification',async()=>{
 const {app,repo}=setup(),source=app.makeProject({projectId:'source',projectName:'Original'});
 await repo.put(source);
 app.state.projects=[source];
 const fork=repo.compareAndFork.bind(repo);
 repo.compareAndFork=async(...args)=>{
  await fork(...args);
  throw Error('lost commit notification');
 };
 const receipt=await app.duplicateProject(source.projectId);
 assert.equal(receipt.ok,true,receipt.error);
 assert.equal(receipt.committed,true);
 assert.equal((await repo.list()).length,2);
 const copy=await repo.get(receipt.project.projectId);
 assert.equal(JSON.stringify(copy),JSON.stringify(receipt.project));
 assert.equal(copy.productionHistory.length,1);
 assert.equal(copy.productionHistory[0].sourceProjectId,source.projectId);
 assert.equal(copy.productionHistory[0].sourceRevision,source.revision);
 assert.equal(JSON.stringify(await repo.get(source.projectId)),JSON.stringify(source));
});
