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
 const song=app.makeProject({projectId:'fork-source',projectName:'Protected source',midiData:{ppq:480,tracks:[{id:'lead',notes:[{id:'note',pitch:60,velocity:80,startTick:0,durationTicks:480}]}]}});
 const repo=app.memoryRepository([song]);
 app.setRepository(repo);app.state.projects=[song];app.state.settings=app.defaultSettings();
 return {app,repo};
}
const snapshot=value=>JSON.stringify(value);

test('failed finished-version fork leaves source session, day, checkpoint and repository unchanged',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('fork-source','start','Active source session')).ok,true);
 assert.equal((await app.productionDaySave('fork-source','2026-11-02','Source daily history')).ok,true);
 assert.equal((await app.versionSave('fork-source','Finished checkpoint',{kind:'finished'})).ok,true);
 const source=await repo.get('fork-source');
 const checkpoint=source.songVersions.checkpoints.find(c=>c.kind==='finished');
 assert.ok(checkpoint);
 const baseline=snapshot(source),beforeList=snapshot(await repo.list());
 const original=repo.compareAndFork;
 repo.compareAndFork=async()=>{throw Error('injected-fork-transaction-failure')};
 try{
  const result=await app.finishedOpen('fork-source',checkpoint.id);
  assert.equal(result.ok,false);
  assert.match(result.error,/injected-fork-transaction-failure/);
  assert.equal(snapshot(await repo.get('fork-source')),baseline,'failed fork must not finish source session');
  assert.equal(snapshot(await repo.list()),beforeList,'failed fork must not create a partial copy');
  assert.equal(snapshot(app.state.projects),beforeList,'failed fork must not publish an in-memory copy');
 }finally{repo.compareAndFork=original}
});
