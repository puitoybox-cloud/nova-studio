'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function setup(){const c={console:{...console,warn(){}},Date,Math,JSON,Intl,Blob,ArrayBuffer,DataView,Uint8Array,Float32Array,crypto:webcrypto,location:{hash:'#music-studio'}};c.window=c;vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),c);const app=c.MusicStudio,repo=app.memoryRepository();app.setRepository(repo);app.state.settings=app.normalizeSettings({backup:{automaticEnabled:true,intervalHours:1,maxCopies:1}});app.state.projects=[app.makeProject({projectId:'song',projectName:'Protected song'})];return{app,repo,window:c}}
async function seed(repo){await repo.putAutoBackup({backupId:'old',createdAt:'2026-11-01T00:00:00Z',signature:'old',snapshot:{protected:true}})}
test('repository switch during backup publication preserves old copies and does not refresh another repository',async()=>{const{app,repo}=setup();await seed(repo);const other=app.memoryRepository();let reads=0;other.listAutoBackups=async()=>{reads++;return[]};const put=repo.putAutoBackup;repo.putAutoBackup=async record=>{const result=await put(record);app.setRepository(other);return result};const r=await app.runAutoBackupCheck('2026-11-04T00:00:00Z');assert.equal(r.created,true);assert.equal(r.ok,true);assert.equal(r.cleanupWarning,'backup-state-conflict');assert.equal((await repo.listAutoBackups()).length,2);assert.equal(reads,0)});
test('retention change while backup commits cannot prune copies under a different policy',async()=>{const{app,repo}=setup();await seed(repo);const put=repo.putAutoBackup;repo.putAutoBackup=async record=>{const result=await put(record);app.state.settings.backup.maxCopies=10;return result};const r=await app.runAutoBackupCheck('2026-11-04T00:00:00Z');assert.equal(r.created,true);assert.equal(r.cleanupWarning,'backup-state-conflict');assert.ok((await repo.listAutoBackups()).some(x=>x.backupId==='old'))});
test('pruning failure reports the committed backup accurately and preserves recoverable copies',async()=>{const{app,repo}=setup();await seed(repo);repo.deleteAutoBackup=async()=>{throw Error('delete-failed')};const r=await app.runAutoBackupCheck('2026-11-04T00:00:00Z');assert.equal(r.ok,true);assert.equal(r.created,true);assert.equal(r.cleanupWarning,'delete-failed');assert.equal((await repo.listAutoBackups()).length,2);assert.ok((await repo.listAutoBackups()).some(x=>x.backupId===r.backup.backupId))});
test('failed publication never prunes the last good backup',async()=>{const{app,repo}=setup();await seed(repo);repo.putAutoBackup=async()=>{throw Error('quota')};let deletes=0;repo.deleteAutoBackup=async()=>{deletes++};const r=await app.runAutoBackupCheck('2026-11-04T00:00:00Z');assert.equal(r.created,false);assert.equal(deletes,0);assert.equal((await repo.listAutoBackups())[0].backupId,'old')});
test('unchanged policy prunes only after successful publication',async()=>{const{app,repo}=setup();await seed(repo);const r=await app.runAutoBackupCheck('2026-11-04T00:00:00Z');assert.equal(r.created,true);assert.equal(r.cleanupWarning,undefined);const saved=await repo.listAutoBackups();assert.equal(saved.length,1);assert.equal(saved[0].backupId,r.backup.backupId)});
test('late backup list from a previous repository cannot replace the current restore choices',async()=>{const{app,repo}=setup();let release;repo.listAutoBackups=()=>new Promise(r=>{release=r});const pending=app.loadAutoBackups();const other=app.memoryRepository();app.setRepository(other);await other.putAutoBackup({backupId:'current',createdAt:'2026-11-04T00:00:00Z'});await app.loadAutoBackups();release([{backupId:'foreign',createdAt:'2026-11-01T00:00:00Z'}]);await pending;assert.equal(app.state.autoBackups[0].backupId,'current')});
test('late read failure cannot clear current repository backup choices',async()=>{const{app,repo}=setup();let reject;repo.listAutoBackups=()=>new Promise((_,r)=>{reject=r});const pending=app.loadAutoBackups();const other=app.memoryRepository();app.setRepository(other);await other.putAutoBackup({backupId:'current',createdAt:'2026-11-04T00:00:00Z'});await app.loadAutoBackups();reject(Error('old database closed'));await pending;assert.equal(app.state.autoBackups[0].backupId,'current')});
test('repository switch during final journal read cannot publish a foreign snapshot',async()=>{const{app,repo}=setup();await seed(repo);let reads=0;repo.listVocalJournals=async()=>{if(++reads===2){const other=app.memoryRepository();app.setRepository(other);app.state.projects=[app.makeProject({projectId:'foreign',projectName:'Another repository'})]}return[]};const r=await app.runAutoBackupCheck('2026-11-04T00:00:00Z');assert.equal(r.created,false);assert.equal(r.reason,'backup-state-conflict');assert.equal((await repo.listAutoBackups()).length,1);assert.equal((await repo.listAutoBackups())[0].backupId,'old')});

test('lost backup acknowledgement after destination switch keeps both copies until a guarded cleanup retry',async()=>{
 const {app,repo}=setup();
 await seed(repo);
 const other=app.memoryRepository(),put=repo.putAutoBackup;
 repo.putAutoBackup=async(...args)=>{
  await put(...args);
  app.setRepository(other);
  throw Error('lost acknowledgement');
 };
 const first=await app.runAutoBackupCheck('2026-11-04T00:00:00Z');
 assert.equal(first.created,true);
 assert.equal(first.cleanupWarning,'backup-state-conflict');
 assert.equal((await other.listAutoBackups()).length,0);
 assert.equal((await repo.listAutoBackups()).length,2);
 app.setRepository(repo);
 const retry=await app.runAutoBackupCheck('2026-11-04T00:01:00Z');
 assert.equal(retry.reason,'not-due');
 assert.equal(retry.created,false);
 assert.deepEqual(Array.from(await repo.listAutoBackups(),copy=>copy.backupId),[first.backup.backupId]);
});

test('a policy change while pruning is queued protects the old generation',async()=>{
 const {app,repo}=setup();
 await seed(repo);
 const remove=repo.deleteAutoBackup.bind(repo);
 repo.deleteAutoBackup=async(id,guard)=>{
  app.state.settings.backup.maxCopies=10;
  return remove(id,guard);
 };
 const result=await app.runAutoBackupCheck('2026-11-04T00:00:00Z');
 assert.equal(result.created,true);
 assert.equal(result.cleanupWarning,'backup-state-conflict');
 assert.deepEqual(Array.from(await repo.listAutoBackups(),copy=>copy.backupId).sort(),[result.backup.backupId,'old'].sort());
});

test('generation lookup cannot restore a previous repository snapshot after a switch',async()=>{
 const {app,repo,window}=setup();
 window.confirm=()=>true;
 const result=await app.runAutoBackupCheck('2026-11-04T00:00:00Z');
 assert.equal(result.created,true);
 const other=app.memoryRepository(),read=repo.getAutoBackup;
 repo.getAutoBackup=async id=>{
  const record=await read(id);
  app.setRepository(other);
  return record;
 };
 await app.loadAutoBackups();
 await app.restoreAutoBackup(result.backup.backupId);
 assert.equal(app.state.autoBackups.length,0);
 assert.equal((await other.list()).length,0);
 assert.equal(app.archiveTransfer.preview,null);
});
