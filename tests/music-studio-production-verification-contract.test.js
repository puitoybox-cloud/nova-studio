'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const api = require('../music-studio-production-verification-contract');
function production() {const root = {console, setTimeout, clearTimeout, setInterval, clearInterval}; root.window = root; root.globalThis = root;
  vm.runInNewContext(fs.readFileSync(require.resolve('../music-studio.js'), 'utf8'), root); return root.MusicStudio;}
function fixture() {const app = production(); return app.makeProject({projectName: 'Disposable contract', future: {preserve: true}});}
const bytes = async () => Uint8Array.from([1,2,3]);
test('actual production repository snapshot and Backup feed read-only contract', async () => {
  const app = production(), project = fixture(); project.future = {preserve:true};
  const repo = app.memoryRepository([project]); app.setRepository(repo); await app.refresh();
  const before = JSON.stringify(await repo.list()), backup = app.backupObject();
  assert.equal(api.backupCompleteness(project, backup).metadataPreserved, true);
  assert.equal(api.backupCompleteness(project, backup).complete, false);
  assert.equal((await api.session(await repo.get(project.projectId), bytes).preflight()).accepted, true);
  assert.equal(JSON.stringify(await repo.list()), before);
});
test('production external references are never complete metadata Backup', async () => {
  const app = production(), p = fixture(); p.audioAssets = [{assetId:'a', storage:{kind:'external-file',reference:'local.wav'}}];
  const repo = app.memoryRepository([p]); app.setRepository(repo); await app.refresh();
  const report = api.backupCompleteness(p, app.backupObject()); assert.equal(report.complete,false);
  assert.deepEqual(report.external,['audioAssets[0]']); assert.equal(report.restorePublicationAllowed,false);
  const result = await api.session(p,bytes).verifyRecovery({capacityBytes:3}); assert.equal(result.outcome,'committed');
  assert.deepEqual(result.reloaded.binaries['audioAssets[0]'],[1,2,3]); assert.equal(result.publicationAllowed,false);
});
for (const field of ['takes','versions','checkpoints']) test(`unknown ${field} blocks rather than omitting dependencies`, async () => {
  const p=fixture();p[field]=[];assert.equal((await api.session(p,bytes).preflight()).accepted,false);
});
for (const version of [undefined,'0.9','2.0']) test(`schema ${version} refuses migration`,()=>{
  const p=fixture();p.schemaVersion=version;const before=JSON.stringify(p);assert.equal(api.compatibility(p).accepted,false);assert.equal(JSON.stringify(p),before);
});
test('opaque unknown fields preserved in disposable reload',async()=>{const p=fixture();p.future={abc:42};
  const r=await api.session(p,bytes).verifyRecovery({capacityBytes:0});assert.equal(r.outcome,'committed');assert.deepEqual(r.reloaded.project.future,p.future);});
test('Cancel and stale reject before reading',async()=>{const p=fixture(),s=api.session(p,()=>{throw Error('must not read');});p.revision++;
  assert.equal((await s.preflight()).reason,'stale');s.cancel();assert.equal((await s.verifyRecovery()).reason,'cancelled');});
for (const name of ['NotFoundError','NotAllowedError','QuotaExceededError','AbortError']) test(`${name} blocks byte acceptance and recovery`,async()=>{
  const p=fixture();p.audioAssets=[{assetId:'a',storage:{kind:'external-file',reference:'a.wav'}}];
  const read=async()=>{const e=Error();e.name=name;throw e;};const s=api.session(p,read);
  assert.equal((await s.preflight()).accepted,false);assert.equal((await s.verifyRecovery({capacityBytes:3})).outcome,'not-committed');
  assert.equal((await api.session(p,bytes).verifyRecovery({capacityBytes:3})).outcome,'committed');
});
test('stale during byte read and before commit cannot publish',async()=>{const p=fixture();p.audioAssets=[{assetId:'a',storage:{kind:'external-file',reference:'a.wav'}}];
  const s=api.session(p,async()=>{p.revision++;return bytes();});assert.equal((await s.preflight()).accepted,false);
  const r=await api.session(p,bytes).verifyRecovery({capacityBytes:3,fault:e=>{if(e.phase==='before-publication')p.revision++;}});assert.equal(r.outcome,'not-committed');});
test('Standalone evidence is capability-specific and missing distribution blocks',()=>{
  assert.equal(api.portability({issues:[]}).portable,false);
  const caps=Object.fromEntries(['browserIndexedDB','scriptStyleClosure','binaryAssets','helperRuntime','nativeComponent','hostNavigation','distribution'].map(x=>[x,'verified']));
  delete caps.distribution;assert.deepEqual(api.portability({issues:[]},caps).issues,['unverified-distribution']);
});
test('missing Backup project and changed unknown fields reject preflight',()=>{const p=fixture();
  assert.equal(api.backupCompleteness(p,{format:'music-studio-backup',version:1,projects:[]}).metadataPreserved,false);});
