'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function setup(){
 const context={console,Date,Math,JSON,Intl,Blob,ArrayBuffer,DataView,Uint8Array,Float32Array,crypto:webcrypto,location:{hash:'#music-studio'}};
 context.window=context;
 vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),context);
 const app=context.MusicStudio;
 const song=app.makeProject({projectId:'restore-source',projectName:'Protected source',midiData:{ppq:480,tracks:[{id:'lead',notes:[{id:'note',pitch:60,velocity:80,startTick:0,durationTicks:480}]}]}});
 const repo=app.memoryRepository([song]);
 app.setRepository(repo);app.state.projects=[song];app.state.settings=app.defaultSettings();
 return {app,repo};
}
const snapshot=value=>JSON.stringify(value);

test('failed atomic metadata restore preserves original song and production history',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('restore-source','start','Recording session')).ok,true);
 assert.equal((await app.productionDaySave('restore-source','2026-11-03','Daily note')).ok,true);
 assert.equal((await app.versionSave('restore-source','Protected checkpoint')).ok,true);
 const backup=app.backupObject();
 const baseline=snapshot(await repo.list());
 const original=repo.restoreMetadata;
 repo.restoreMetadata=async()=>{throw Error('injected-restore-transaction-failure')};
 try{
  const result=await app.restoreBackup(backup,{settings:false});
  assert.equal(result.ok,false);
  assert.equal(result.committed,false);
  assert.match(result.message,/injected-restore-transaction-failure/);
  assert.equal(snapshot(await repo.list()),baseline,'failed restore must not publish projects or change source history');
  assert.equal(snapshot(app.state.projects),baseline,'failed restore must not change in-memory projects');
 }finally{repo.restoreMetadata=original}
});

test('pre-aborted backup restore leaves durable production history unchanged',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('restore-source','start','Recording session')).ok,true);
 assert.equal((await app.productionDaySave('restore-source','2026-11-03','Daily note')).ok,true);
 const backup=app.backupObject(),baseline=snapshot(await repo.list());
 const controller=new AbortController();controller.abort();
 const result=await app.restoreBackup(backup,{settings:false,signal:controller.signal});
 assert.equal(result.ok,false);
 assert.equal(result.committed,false);
 assert.equal(snapshot(await repo.list()),baseline);
 assert.equal(snapshot(app.state.projects),baseline);
});
