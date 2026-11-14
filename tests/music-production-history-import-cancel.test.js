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
 const song=app.makeProject({projectId:'cancel-import-source',projectName:'Protected source',midiData:{ppq:480,tracks:[{id:'lead',notes:[{id:'note',pitch:60,velocity:80,startTick:0,durationTicks:480}]}]}});
 const repo=app.memoryRepository([song]);
 app.setRepository(repo);app.state.projects=[song];app.state.settings=app.defaultSettings();
 return {app,repo};
}
const snapshot=value=>JSON.stringify(value);

test('cancelled JSON import retains active production history and creates no duplicate',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('cancel-import-source','start','Open session')).ok,true);
 assert.equal((await app.productionDaySave('cancel-import-source','2026-11-03','Protected daily history')).ok,true);
 assert.equal((await app.versionSave('cancel-import-source','Protected checkpoint')).ok,true);
 const baseline=snapshot(await repo.get('cancel-import-source'));
 const before=snapshot(await repo.list());
 await assert.rejects(()=>app.importText(baseline,{check:()=>{throw Error('import-cancelled')}}),/import-cancelled/);
 assert.equal(snapshot(await repo.get('cancel-import-source')),baseline);
 assert.equal(snapshot(await repo.list()),before);
 assert.equal(snapshot(app.state.projects),before);
});
