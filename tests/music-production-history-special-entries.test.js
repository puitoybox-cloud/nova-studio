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
 const song=app.makeProject({projectId:'history-song',projectName:'History coverage',productionNotes:'before',midiData:{ppq:480,tracks:[{id:'lead',notes:[{id:'note',pitch:60,velocity:80,startTick:0,durationTicks:480}]}]}});
 const repo=app.memoryRepository([song]);
 app.setRepository(repo);app.state.projects=[song];app.state.settings=app.defaultSettings();
 return {app,repo};
}
const snapshot=value=>JSON.stringify(value);
async function change(repo,app,callback){
 const p=await repo.get('history-song');callback(p);p.revision++;await repo.put(p);app.state.projects=[p];
}
test('session and daily production history survive selective checkpoint, undo, redo, finished fork and additive backup',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('history-song','start','Session from creation')).ok,true);
 assert.equal((await app.productionDaySave('history-song','2026-11-02','Daily history from recording')).ok,true);
 const first=await repo.get('history-song');
 const expectedDay=snapshot(first.songVersions.days),sessionId=first.songVersions.sessions[0].id;
 assert.equal((await app.versionSave('history-song','Before edit')).ok,true);
 await change(repo,app,p=>{p.productionNotes='new work';p.midiData.tracks[0].notes[0].pitch=72});
 const p=await repo.get('history-song'),checkpointId=p.songVersions.checkpoints[0].id;
 let result=app.versionPreview('history-song',checkpointId,['notes']);
 assert.equal(result.ok,true,result.error);
 result=await app.versionApply('history-song');
 assert.equal(result.ok,true,result.error);
 for(const action of [-1,1]){
  result=await app.versionUndoRedo('history-song',action);
  assert.equal(result.ok,true,result.error);
  const saved=await repo.get('history-song');
  assert.equal(snapshot(saved.songVersions.days),expectedDay);
  assert.equal(saved.songVersions.sessions[0].id,sessionId);
  assert.equal(saved.songVersions.sessions[0].note,'Session from creation');
 }
 assert.equal((await app.productionSessionSave('history-song','finish','Session completed')).ok,true);
 assert.equal((await app.versionSave('history-song','Finished with history',{kind:'finished'})).ok,true);
 const source=await repo.get('history-song'),baseline=snapshot(source);
 const finished=source.songVersions.checkpoints.find(c=>c.kind==='finished');
 assert.ok(finished);
 result=await app.finishedOpen('history-song',finished.id);
 assert.equal(result.ok,true,result.error);
 assert.equal(snapshot(await repo.get('history-song')),baseline,'finished fork must not alter source');
 const copy=await repo.get(result.project.projectId);
 assert.equal(snapshot(copy.songVersions.days),expectedDay);
 assert.equal(copy.songVersions.sessions[0].id,sessionId);
 assert.equal(copy.songVersions.sessions[0].endNote,'Session completed');
 result=await app.restoreBackup(app.backupObject(),{settings:false});
 assert.equal(result.ok,true,result.message);
 const restored=(await repo.list()).filter(p=>p.projectId!=='history-song'&&p.projectId!==copy.projectId);
 assert.ok(restored.length>=2);
 for(const song of restored){
  assert.equal(snapshot(song.songVersions.days),expectedDay);
  assert.equal(song.songVersions.sessions[0].id,sessionId);
  assert.equal(song.songVersions.sessions[0].endNote,'Session completed');
  assert.equal(app.validateProject(song).valid,true);
 }
});
test('failed special save cannot overwrite an existing day or active production session',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('history-song','start','Original session')).ok,true);
 assert.equal((await app.productionDaySave('history-song','2026-11-02','Original daily note')).ok,true);
 const original=snapshot(await repo.get('history-song'));
 repo.compareAndPut=async()=>{throw Error('QuotaExceededError')};
 assert.equal((await app.productionDaySave('history-song','2026-11-02','Rejected overwrite')).ok,false);
 assert.equal((await app.productionSessionSave('history-song','finish','Rejected session finish')).ok,false);
 assert.equal(snapshot(await repo.get('history-song')),original,'failed persistence must not change saved production history');
});
