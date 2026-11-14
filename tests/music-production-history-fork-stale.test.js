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
 const song=app.makeProject({projectId:'stale-source',projectName:'Stale source',midiData:{ppq:480,tracks:[{id:'lead',notes:[{id:'note',pitch:60,velocity:80,startTick:0,durationTicks:480}]}]}});
 const repo=app.memoryRepository([song]);
 app.setRepository(repo);app.state.projects=[song];app.state.settings=app.defaultSettings();
 return {app,repo};
}
const snapshot=value=>JSON.stringify(value);

test('finished fork rejects a stale source revision without altering its newer production history',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('stale-source','start','Open source session')).ok,true);
 assert.equal((await app.productionDaySave('stale-source','2026-11-02','Original day')).ok,true);
 assert.equal((await app.versionSave('stale-source','Finished',{kind:'finished'})).ok,true);
 const original=await repo.get('stale-source'),checkpoint=original.songVersions.checkpoints.find(c=>c.kind==='finished');
 assert.ok(checkpoint);
 const newer=JSON.parse(snapshot(original));
 newer.productionNotes='Concurrent change after UI snapshot';
 newer.revision+=1;
 await repo.put(newer);
 const baseline=snapshot(await repo.get('stale-source')),list=snapshot(await repo.list());
 const result=await app.finishedOpen('stale-source',checkpoint.id);
 assert.equal(result.ok,false);
 assert.equal(snapshot(await repo.get('stale-source')),baseline,'stale fork must not overwrite newer revision');
 assert.equal(snapshot(await repo.list()),list,'stale fork must not create a partial copy');
 assert.equal(snapshot(app.state.projects),snapshot([original]),'failed fork must not publish stale copy');
});
