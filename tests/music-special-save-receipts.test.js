'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');

function runtime(){
 const host={console,Date,Math,JSON,Intl,Blob,ArrayBuffer,DataView,Uint8Array,Float32Array,crypto:webcrypto,location:{hash:'#music-studio'}};
 host.window=host;vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),host);
 return host.MusicStudio;
}
function fixture(){
 const app=runtime(),project=app.makeProject({projectId:'receipts-song',projectName:'Receipts',productionNotes:'before',midiData:{ppq:480,tracks:[{id:'lead',notes:[{id:'note',pitch:60,velocity:80,startTick:0,durationTicks:480}]}]}});
 const repo=app.memoryRepository([project]);app.setRepository(repo);app.state.projects=[project];app.state.settings=app.defaultSettings();
 return {app,repo};
}
const plain=x=>JSON.parse(JSON.stringify(x));
const receipts=p=>plain(p.specialSaveReceipts||[]);
const assertSaved=async(result,repo)=>{assert.equal(result.ok,true,result.error);const project=await repo.get(result.project?.projectId||'receipts-song');assert.equal(project.specialSaveReceipts.at(-1).revision,project.revision);assert.equal(project.specialSaveReceipts.at(-1).type,'special-save');assert.equal(new Set(project.specialSaveReceipts.map(x=>x.id)).size,project.specialSaveReceipts.length);assert.ok(project.specialSaveReceipts.at(-1).entryId,'receipt must identify its real production entry');return project;};

test('checkpoint, adopt, Undo/Redo, session, daily, finished and fork each produce a unique atomic receipt',async()=>{
 const {app,repo}=fixture();
 await assertSaved(await app.productionSessionSave('receipts-song','start','Beginning session'),repo);
 await assertSaved(await app.productionDaySave('receipts-song','2026-11-17','Working notes'),repo);
 await assertSaved(await app.versionSave('receipts-song','Before change'),repo);
 let p=await repo.get('receipts-song');const checkpointId=p.songVersions.checkpoints[0].id,sessionId=p.songVersions.sessions[0].id;
 p.productionNotes='after';p.revision++;await repo.put(p);app.state.projects=[p];
 assert.equal(app.versionPreview('receipts-song',checkpointId,['notes']).ok,true);
 await assertSaved(await app.versionApply('receipts-song'),repo);
 await assertSaved(await app.versionUndoRedo('receipts-song',-1),repo);
 await assertSaved(await app.versionUndoRedo('receipts-song',1),repo);
 await assertSaved(await app.productionSessionSave('receipts-song','finish','Ending session'),repo);
 await assertSaved(await app.versionSave('receipts-song','Completed song',{kind:'finished'}),repo);
 p=await repo.get('receipts-song');const original=JSON.stringify(p),finishedId=p.songVersions.checkpoints.find(x=>x.kind==='finished').id;
 const fork=await app.finishedOpen('receipts-song',finishedId);assert.equal(fork.ok,true,fork.error);
 const saved=await repo.get(fork.project.projectId);assert.equal(saved.specialSaveReceipts.at(-1).action,'finished-fork');
 assert.equal(JSON.stringify(await repo.get('receipts-song')),original,'fork must not alter source receipts');
 const actions=receipts(p).map(x=>x.action);
 assert.deepEqual(actions,['session-start','daily-save','checkpoint-save','checkpoint-adopt','checkpoint-undo','checkpoint-redo','session-finish','finished-checkpoint']);
 assert.equal(receipts(p).filter(x=>x.sessionId===sessionId).length,7,'all operations before session finish retain the session identity');
 assert.equal(p.specialSaveReceipts[0].entryId,sessionId);
 assert.equal(p.specialSaveReceipts[1].entryId,p.songVersions.days[0].id);
 assert.equal(p.specialSaveReceipts[2].entryId,checkpointId);
 for(const action of ['checkpoint-adopt','checkpoint-undo','checkpoint-redo'])assert.equal(p.specialSaveReceipts.find(x=>x.action===action).entryId,p.songVersions.operations[0].id);
 assert.equal(p.specialSaveReceipts.find(x=>x.action==='session-finish').entryId,sessionId);
 assert.equal(saved.specialSaveReceipts.at(-1).entryId,finishedId);
 assert.equal(app.validateProject(p).valid,true);
 const restarted=runtime();restarted.setRepository(repo);restarted.state.projects=await repo.list();
 assert.deepEqual(receipts(restarted.state.projects.find(x=>x.projectId==='receipts-song')),receipts(p),'restart must preserve receipts');
 const destination=runtime();destination.setRepository(destination.memoryRepository());
 const restored=await destination.restoreBackup(app.backupObject(),{projects:true,settings:false});
 assert.equal(restored.ok,true,restored.message);
 assert.deepEqual(receipts(destination.state.projects.find(x=>x.projectId==='receipts-song')),receipts(p),'backup must preserve receipts');
});

test('pre-commit interruption cannot publish a phantom special-save receipt',async()=>{
 const {app,repo}=fixture(),before=JSON.stringify(await repo.get('receipts-song'));
 repo.compareAndPut=async()=>{throw Error('storage interrupted before commit')};
 const result=await app.productionDaySave('receipts-song','2026-11-17','Not written');
 assert.equal(result.ok,false);assert.match(result.error,/before commit/);
 assert.equal(JSON.stringify(await repo.get('receipts-song')),before);
});

test('lost success after atomic commit is confirmed without duplicating daily history',async()=>{
 const {app,repo}=fixture(),original=repo.compareAndPut.bind(repo);
 repo.compareAndPut=async(...args)=>{await original(...args);throw Error('commit notification lost')};
 const result=await app.productionDaySave('receipts-song','2026-11-17','Committed daily note');
 const saved=await assertSaved(result,repo);
 assert.equal(saved.songVersions.days.length,1);assert.equal(saved.specialSaveReceipts.length,1);
 assert.equal(app.state.projects[0].specialSaveReceipts.length,1);
 assert.equal((await app.productionDaySave('receipts-song','2026-11-18','Next note')).ok,true);
 assert.equal((await repo.get('receipts-song')).specialSaveReceipts.length,2);
});

test('a later committed revision does not defeat the original receipt or overwrite newer history',async()=>{
 const {app,repo}=fixture(),original=repo.compareAndPut.bind(repo),baseline=JSON.stringify(app.state.projects[0]);
 repo.compareAndPut=async(...args)=>{
  await original(...args);
  const advanced=await repo.get('receipts-song');advanced.revision++;advanced.productionNotes='Another writer advanced';
  await repo.put(advanced);throw Error('commit notification lost after another writer');
 };
 const result=await app.productionDaySave('receipts-song','2026-11-17','Saved before later write');
 assert.equal(result.ok,true,result.error);assert.equal(result.refreshPending,true);
 const stored=await repo.get('receipts-song');assert.equal(stored.productionNotes,'Another writer advanced');
 assert.equal(stored.songVersions.days.length,1);assert.equal(stored.specialSaveReceipts.length,1);
 assert.equal(JSON.stringify(app.state.projects[0]),baseline,'a stale UI must not overwrite the later revision');
});

test('lost fork success is confirmed using the unique receipt in the fork, not the source',async()=>{
 const {app,repo}=fixture();await assertSaved(await app.versionSave('receipts-song','Completed',{kind:'finished'}),repo);
 const original=JSON.stringify(await repo.get('receipts-song'));
 const forkId=app.state.projects[0].songVersions.checkpoints[0].id,commit=repo.compareAndFork.bind(repo);
 repo.compareAndFork=async(...args)=>{await commit(...args);throw Error('fork reply lost')};
 const result=await app.finishedOpen('receipts-song',forkId);
 assert.equal(result.ok,true,result.error);
 const fork=await repo.get(result.project.projectId);
 assert.equal(fork.specialSaveReceipts.at(-1).action,'finished-fork');
 assert.equal((await repo.list()).length,2);
 assert.equal(JSON.stringify(await repo.get('receipts-song')),original);
});

test('generic versionCommit forks do not fabricate a special-save entry when destination revision restarts',async()=>{
 const {app,repo}=fixture();await assertSaved(await app.versionSave('receipts-song','Source checkpoint'),repo);
 const original=await repo.get('receipts-song');
 const result=await app.versionCommit('receipts-song',p=>{
  const copy=plain(p);copy.projectId='logic-return';copy.projectName='Logic return';copy.revision=1;
  app.versionRebind(copy);return copy;
 },{fork:true});
 assert.equal(result.ok,true,result.error);
 const fork=await repo.get('logic-return');
 assert.deepEqual(receipts(fork),receipts(original),'only the original checkpoint receipt may be copied');
 assert.equal(fork.revision,1);
 assert.deepEqual(receipts(await repo.get('receipts-song')),receipts(original));
});

test('malformed or duplicate receipts fail validation without rewriting source history',async()=>{
 const {app,repo}=fixture();await assertSaved(await app.versionSave('receipts-song','Source checkpoint'),repo);
 const original=await repo.get('receipts-song');
 for(const change of [p=>p.specialSaveReceipts.push({...p.specialSaveReceipts[0]}),p=>p.specialSaveReceipts[0].action='made-up',p=>p.specialSaveReceipts[0].revision=p.specialSaveReceipts[0].sourceRevision]){
  const corrupt=plain(original);change(corrupt);assert.equal(app.validateProject(corrupt).valid,false);
 }
 assert.deepEqual(receipts(await repo.get('receipts-song')),receipts(original));
});

test('checkpoint commit notification loss preserves one checkpoint and one receipt',async()=>{
 const {app,repo}=fixture(),original=repo.compareAndPut.bind(repo);
 repo.compareAndPut=async(...args)=>{await original(...args);throw Error('checkpoint reply lost')};
 const result=await app.versionSave('receipts-song','Before vocals');
 const saved=await assertSaved(result,repo);
 assert.equal(saved.songVersions.checkpoints.length,1);
 assert.equal(saved.specialSaveReceipts.length,1);
 assert.equal(saved.specialSaveReceipts[0].action,'checkpoint-save');
 assert.equal(saved.specialSaveReceipts[0].entryId,saved.songVersions.checkpoints[0].id);
});

test('session start and finish preserve their identity across confirmed lost replies',async()=>{
 const {app,repo}=fixture(),original=repo.compareAndPut.bind(repo);
 repo.compareAndPut=async(...args)=>{await original(...args);throw Error('session reply lost')};
 const started=await app.productionSessionSave('receipts-song','start','Start');
 assert.equal(started.ok,true,started.error);
 const session=(await repo.get('receipts-song')).songVersions.sessions[0];
 const finished=await app.productionSessionSave('receipts-song','finish','End');
 assert.equal(finished.ok,true,finished.error);
 const saved=await repo.get('receipts-song');
 assert.equal(saved.songVersions.sessions.length,1);
 assert.deepEqual(saved.specialSaveReceipts.map(x=>x.action),['session-start','session-finish']);
 assert.equal(saved.specialSaveReceipts[0].entryId,session.id);
 assert.equal(saved.specialSaveReceipts[1].entryId,session.id);
 assert.equal(new Set(saved.specialSaveReceipts.map(x=>x.id)).size,2);
});

test('failed checkpoint storage does not create history or receipt and permits retry',async()=>{
 const {app,repo}=fixture(),original=repo.compareAndPut.bind(repo);
 repo.compareAndPut=async()=>{throw Error('checkpoint write refused')};
 const failed=await app.versionSave('receipts-song','Failed attempt');
 assert.equal(failed.ok,false);
 const unchanged=await repo.get('receipts-song');
 assert.equal(unchanged.songVersions?.checkpoints?.length||0,0);
 assert.equal(unchanged.specialSaveReceipts?.length||0,0);
 repo.compareAndPut=original;
 const retried=await app.versionSave('receipts-song','Retry');
 const saved=await assertSaved(retried,repo);
 assert.equal(saved.songVersions.checkpoints.length,1);
 assert.equal(saved.specialSaveReceipts.length,1);
});
