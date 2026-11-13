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
 const song=app.makeProject({projectId:'import-source',projectName:'Protected source',midiData:{ppq:480,tracks:[{id:'lead',notes:[{id:'note',pitch:60,velocity:80,startTick:0,durationTicks:480}]}]}});
 const repo=app.memoryRepository([song]);
 app.setRepository(repo);app.state.projects=[song];app.state.settings=app.defaultSettings();
 return {app,repo};
}
const snapshot=value=>JSON.stringify(value);

test('atomic JSON collision import failure retains source production history without a partial copy',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('import-source','start','Active source session')).ok,true);
 assert.equal((await app.productionDaySave('import-source','2026-11-03','Source day')).ok,true);
 assert.equal((await app.versionSave('import-source','Source checkpoint')).ok,true);
 const source=await repo.get('import-source'),baseline=snapshot(source),before=snapshot(await repo.list());
 const original=repo.compareAndPut;
 repo.compareAndPut=async()=>{throw Error('injected-import-transaction-failure')};
 try{
  await assert.rejects(()=>app.importText(baseline),/injected-import-transaction-failure/);
  assert.equal(snapshot(await repo.get('import-source')),baseline,'source must remain unchanged');
  assert.equal(snapshot(await repo.list()),before,'failed import must not publish a partial duplicate');
  assert.equal(snapshot(app.state.projects),before,'failed import must not publish in-memory duplicate');
 }finally{repo.compareAndPut=original}
});
