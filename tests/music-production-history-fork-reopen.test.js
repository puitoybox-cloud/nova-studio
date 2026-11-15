'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');

function runtime(repo){
 const context={console,Date,Math,JSON,Intl,Blob,ArrayBuffer,DataView,Uint8Array,Float32Array,crypto:webcrypto,location:{hash:'#music-studio'}};
 context.window=context;
 vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),context);
 const app=context.MusicStudio;
 if(repo)app.setRepository(repo);
 return app;
}
const snapshot=value=>JSON.stringify(value);

test('finished fork remains independently reopenable with provenance after application runtime restart',async()=>{
 const app=runtime();
 const song=app.makeProject({projectId:'reopen-source',projectName:'Reopen source',midiData:{ppq:480,tracks:[{id:'lead',notes:[{id:'note',pitch:60,velocity:80,startTick:0,durationTicks:480}]}]}});
 const repo=app.memoryRepository([song]);
 app.setRepository(repo);app.state.projects=[song];app.state.settings=app.defaultSettings();
 assert.equal((await app.productionSessionSave('reopen-source','start','Open source session')).ok,true);
 assert.equal((await app.productionDaySave('reopen-source','2026-11-02','Source daily note')).ok,true);
 assert.equal((await app.versionSave('reopen-source','Finished',{kind:'finished'})).ok,true);
 const original=await repo.get('reopen-source'),baseline=snapshot(original);
 const checkpoint=original.songVersions.checkpoints.find(c=>c.kind==='finished');
 assert.ok(checkpoint);
 const result=await app.finishedOpen('reopen-source',checkpoint.id);
 assert.equal(result.ok,true,result.error);
 const forkId=result.project.projectId;
 assert.notEqual(forkId,'reopen-source');
 const restarted=runtime(repo);
 restarted.state.projects=await repo.list();
 restarted.state.settings=restarted.defaultSettings();
 const source=await repo.get('reopen-source'),fork=await repo.get(forkId);
 assert.equal(snapshot(source),baseline,'opening finished fork must not alter source history');
 assert.equal(source.songVersions.sessions[0].endedAt,undefined);
 assert.ok(fork.songVersions.sessions[0].endedAt,'fork must close only copied session');
 assert.equal(snapshot(fork.songVersions.days),snapshot(source.songVersions.days));
 assert.equal(fork.songVersions.fork.sourceProjectId,'reopen-source');
 assert.equal(fork.songVersions.fork.checkpointId,checkpoint.id);
 assert.equal(restarted.validateProject(fork).valid,true);
});
