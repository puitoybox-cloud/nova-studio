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

test('JSON project import collision preserves production history and original checkpoint provenance',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('history-song','start','Original imported session')).ok,true);
 assert.equal((await app.productionDaySave('history-song','2026-11-02','Original imported day')).ok,true);
 assert.equal((await app.versionSave('history-song','Import checkpoint')).ok,true);
 assert.equal((await app.productionSessionSave('history-song','finish','Original session finished')).ok,true);
 const initial=await repo.get('history-song'),original=snapshot(initial),day=snapshot(initial.songVersions.days);
 const result=await app.importText(original);
 assert.equal(result.ok,true,result.message);
 assert.equal(result.duplicated,true);
 assert.notEqual(result.project.projectId,initial.projectId);
 assert.equal(snapshot(await repo.get('history-song')),original,'JSON import must not modify original history');
 const copied=await repo.get(result.project.projectId);
 assert.equal(snapshot(copied.songVersions.days),day,'daily history lost in JSON collision import');
 assert.equal(copied.songVersions.sessions[0].endNote,'Original session finished');
 assert.equal(copied.songVersions.checkpoints.length,1);
 assert.equal(copied.songVersions.checkpoints[0].snapshot.projectId,copied.projectId);
 assert.equal(app.validateProject(copied).valid,true);
});

test('active production session survives a fresh application runtime and finished fork closes only its copy',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('history-song','start','Started before restart')).ok,true);
 assert.equal((await app.productionDaySave('history-song','2026-11-02','Daily note before restart')).ok,true);
 assert.equal((await app.versionSave('history-song','Finished while active',{kind:'finished'})).ok,true);
 const original=await repo.get('history-song'),before=snapshot(original),sessionId=original.songVersions.sessions[0].id;
 const context={console,Date,Math,JSON,Intl,Blob,ArrayBuffer,DataView,Uint8Array,Float32Array,crypto:webcrypto,location:{hash:'#music-studio'}};
 context.window=context;
 vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),context);
 const restarted=context.MusicStudio;
 restarted.setRepository(repo);
 restarted.state.projects=await repo.list();
 restarted.state.settings=restarted.defaultSettings();
 const reloaded=await repo.get('history-song');
 assert.equal(reloaded.songVersions.sessions[0].id,sessionId);
 assert.equal(reloaded.songVersions.sessions[0].endedAt,undefined);
 assert.equal(reloaded.songVersions.days[0].note,'Daily note before restart');
 const finished=reloaded.songVersions.checkpoints.find(c=>c.kind==='finished');
 const result=await restarted.finishedOpen('history-song',finished.id);
 assert.equal(result.ok,true,result.error);
 const fork=await repo.get(result.project.projectId);
 assert.equal(fork.songVersions.sessions[0].id,sessionId);
 assert.ok(fork.songVersions.sessions[0].endedAt,'fork must close its copy of the active session');
 assert.equal(fork.songVersions.days[0].note,'Daily note before restart');
 assert.equal(snapshot(await repo.get('history-song')),before,'fork may not finish or modify the original active session');
 assert.equal((await restarted.productionSessionSave('history-song','finish','Finished after restart')).ok,true);
 const completed=await repo.get('history-song');
 assert.equal(completed.songVersions.sessions[0].endNote,'Finished after restart');
 assert.equal(fork.songVersions.sessions[0].endNote,undefined,'later source session completion must not affect the finished fork');
});
test('malformed project JSON import is rejected without touching existing production history',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('history-song','start','Protected working session')).ok,true);
 assert.equal((await app.productionDaySave('history-song','2026-11-02','Protected daily note')).ok,true);
 const before=snapshot(await repo.get('history-song'));
 for(const raw of ['{broken json',JSON.stringify({...JSON.parse(before),songVersions:{checkpoints:[{id:'bad'}]}})]){
  const result=await app.importText(raw);
  assert.equal(result.ok,false);
  assert.equal(snapshot(await repo.get('history-song')),before);
  assert.equal((await repo.list()).length,1,'rejected import may not publish a new project');
 }
});

test('cancelled special history entry and concurrently changed source refuse to commit',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('history-song','start','Protected session')).ok,true);
 assert.equal((await app.productionDaySave('history-song','2026-11-02','Protected day')).ok,true);
 const saved=await repo.get('history-song'),baseline=snapshot(saved);
 for(const action of [
  ()=>app.productionDaySave('history-song','2026-11-03','Cancelled day',{signal:{aborted:true}}),
  ()=>app.productionSessionSave('history-song','finish','Cancelled finish',{signal:{aborted:true}}),
  ()=>app.versionSave('history-song','Cancelled checkpoint',{signal:{aborted:true}})
 ]){
  let result;
  try{result=await action()}catch(error){result={ok:false,error:error.message}}
  assert.equal(result.ok,false);
  assert.equal(snapshot(await repo.get('history-song')),baseline);
 }
 await repo.put({...saved,productionNotes:'Concurrent edit',revision:saved.revision+1});
 const changed=snapshot(await repo.get('history-song'));
 const result=await app.productionDaySave('history-song','2026-11-03','Stale day');
 assert.equal(result.ok,false);
 assert.equal(snapshot(await repo.get('history-song')),changed,'concurrent write must not lose the newer song');
});
test('invalid history in an additive backup is rejected atomically without affecting existing daily or session records',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('history-song','start','Protected backup session')).ok,true);
 assert.equal((await app.productionDaySave('history-song','2026-11-02','Protected backup day')).ok,true);
 const baseline=snapshot(await repo.get('history-song'));
 const backup=app.backupObject();
 backup.projects[0].songVersions.days.push({...backup.projects[0].songVersions.days[0],note:'Tampered duplicate history'});
 const result=await app.restoreBackup(backup,{settings:false});
 assert.equal(result.ok,false);
 assert.equal(snapshot(await repo.get('history-song')),baseline,'invalid backup must not overwrite production history');
 assert.equal((await repo.list()).length,1,'invalid backup must not create partial copies');
});

test('noncolliding JSON transfer into a fresh repository retains session, day and checkpoint provenance',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('history-song','start','Transfer session')).ok,true);
 assert.equal((await app.productionDaySave('history-song','2026-11-02','Transfer day')).ok,true);
 assert.equal((await app.versionSave('history-song','Transfer checkpoint')).ok,true);
 assert.equal((await app.productionSessionSave('history-song','finish','Transfer done')).ok,true);
 const source=await repo.get('history-song'),serialized=snapshot(source);
 const context={console,Date,Math,JSON,Intl,Blob,ArrayBuffer,DataView,Uint8Array,Float32Array,crypto:webcrypto,location:{hash:'#music-studio'}};
 context.window=context;vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),context);
 const other=context.MusicStudio,empty=other.memoryRepository([]);
 other.setRepository(empty);other.state.projects=[];other.state.settings=other.defaultSettings();
 const result=await other.importText(serialized);
 assert.equal(result.ok,true,result.message);
 assert.equal(result.duplicated,false);
 const transferred=await empty.get('history-song');
 assert.ok(transferred);
 assert.equal(snapshot(transferred.songVersions.days),snapshot(source.songVersions.days));
 assert.equal(snapshot(transferred.songVersions.sessions),snapshot(source.songVersions.sessions));
 assert.equal(transferred.songVersions.checkpoints.length,source.songVersions.checkpoints.length);
 assert.equal(other.validateProject(transferred).valid,true);
 assert.equal(snapshot(await repo.get('history-song')),serialized,'transfer must not touch original repository');
});
test('atomic backup restoration failure leaves active session, daily notes and repository intact',async()=>{
 const {app,repo}=setup();
 assert.equal((await app.productionSessionSave('history-song','start','Protected before failed restore')).ok,true);
 assert.equal((await app.productionDaySave('history-song','2026-11-02','Protected daily history')).ok,true);
 const before=snapshot(await repo.get('history-song')),backup=app.backupObject();
 const originalRestore=repo.restoreMetadata;
 repo.restoreMetadata=async()=>{throw Error('injected-transaction-abort')};
 const result=await app.restoreBackup(backup,{settings:false});
 assert.equal(result.ok,false);
 assert.match(result.message,/injected-transaction-abort/);
 assert.equal(snapshot(await repo.get('history-song')),before);
 assert.equal((await repo.list()).length,1);
 repo.restoreMetadata=originalRestore;
});

test('checkpoint adoption and Undo/Redo record the acting session while preserving daily links',async()=>{
 const {app,repo}=setup();
 await app.productionSessionSave('history-song','start','Original session');
 await app.productionDaySave('history-song','2026-11-05','Original daily entry');
 await app.versionSave('history-song','Before notes');
 const original=await repo.get('history-song'),checkpoint=original.songVersions.checkpoints[0];
 await app.productionSessionSave('history-song','finish','Done');
 await app.productionSessionSave('history-song','start','Acting session');
 await app.productionDaySave('history-song','2026-11-05','Current daily entry');
 await change(repo,app,p=>{p.productionNotes='edited notes'});
 const before=await repo.get('history-song'),active=before.songVersions.sessions.find(s=>!s.endedAt),days=snapshot(before.songVersions.days);
 assert.equal(app.versionPreview('history-song',checkpoint.id,['notes']).ok,true);
 assert.equal((await app.versionApply('history-song')).ok,true);
 for(const direction of [-1,1])assert.equal((await app.versionUndoRedo('history-song',direction)).ok,true);
 const saved=await repo.get('history-song');
 assert.equal(saved.songVersions.operations.at(-1).sessionId,active.id);
 const edits=saved.songVersions.edits.filter(e=>e.source==='checkpoint-history');
 assert.equal(edits.length,3);
 assert.ok(edits.every(e=>e.sessionId===active.id));
 assert.equal(snapshot(saved.songVersions.days),days);
 assert.equal(saved.songVersions.checkpoints[0].sessionId,original.songVersions.sessions[0].id);
 const bad=JSON.parse(snapshot(saved));bad.songVersions.operations[0].sessionId='missing-session';
 assert.equal(app.validateProject(bad).valid,false);
 const text=snapshot(saved),imported=await app.importText(text);
 assert.equal(imported.ok,true,imported.message);
 assert.equal(snapshot(imported.project.songVersions.edits),snapshot(saved.songVersions.edits));
});
