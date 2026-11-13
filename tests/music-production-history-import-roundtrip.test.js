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
 const song=app.makeProject({projectId:'roundtrip-source',projectName:'Protected source',midiData:{ppq:480,tracks:[{id:'lead',notes:[{id:'note',pitch:60,velocity:80,startTick:0,durationTicks:480}]}]}});
 const repo=app.memoryRepository([song]);
 app.setRepository(repo);app.state.projects=[song];app.state.settings=app.defaultSettings();
 return {app,repo};
}
const snapshot=value=>JSON.stringify(value);

test('JSON collision import retains original production history and persists an independent copy',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('roundtrip-source','start','Original active session')).ok,true);
 assert.equal((await app.productionDaySave('roundtrip-source','2026-11-03','Original day')).ok,true);
 assert.equal((await app.versionSave('roundtrip-source','Original checkpoint')).ok,true);
 const source=await repo.get('roundtrip-source');
 const baseline=snapshot(source);
 const result=await app.importText(baseline);
 assert.equal(result.ok,true);
 assert.equal(result.duplicated,true);
 assert.notEqual(result.project.projectId,'roundtrip-source');
 assert.equal(snapshot(await repo.get('roundtrip-source')),baseline,'source must be unchanged');
 const copied=await repo.get(result.project.projectId);
 assert.ok(copied,'imported copy must be persisted');
 assert.equal(copied.projectId,result.project.projectId);
 assert.equal(copied.projectName,'Protected source（読み込み）');
 assert.equal(snapshot(copied.productionHistory),snapshot(source.productionHistory),'production history must survive import');
 assert.equal(copied.songVersions.checkpoints.length,source.songVersions.checkpoints.length,'checkpoints must survive import');
 assert.equal(app.validateProject(copied).valid,true);
});
