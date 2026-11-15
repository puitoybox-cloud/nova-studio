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
 const song=app.makeProject({projectId:'cancel-source',projectName:'Cancel protected',midiData:{ppq:480,tracks:[{id:'lead',notes:[{id:'note',pitch:60,velocity:80,startTick:0,durationTicks:480}]}]}});
 const repo=app.memoryRepository([song]);
 app.setRepository(repo);app.state.projects=[song];app.state.settings=app.defaultSettings();
 return {app,repo};
}
const snapshot=value=>JSON.stringify(value);

test('cancelled finished-version fork preserves source production history and publishes no copy',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('cancel-source','start','Session before cancellation')).ok,true);
 assert.equal((await app.productionDaySave('cancel-source','2026-11-02','Day before cancellation')).ok,true);
 assert.equal((await app.versionSave('cancel-source','Finished version',{kind:'finished'})).ok,true);
 const source=await repo.get('cancel-source'),checkpoint=source.songVersions.checkpoints.find(c=>c.kind==='finished');
 assert.ok(checkpoint);
 const baseline=snapshot(source),list=snapshot(await repo.list());
 const result=await app.finishedOpen('cancel-source',checkpoint.id,{signal:{aborted:true}});
 assert.equal(result.ok,false);
 assert.equal(snapshot(await repo.get('cancel-source')),baseline);
 assert.equal(snapshot(await repo.list()),list);
 assert.equal(snapshot(app.state.projects),list);
});
