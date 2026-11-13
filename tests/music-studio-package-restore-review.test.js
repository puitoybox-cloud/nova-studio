'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const api = require('../music-studio-package-restore-review');
const p = () => ({format: 'music-studio-project', schemaVersion: '1.0', version: 1, projectId: 'synthetic', future: {keep: true}});
const g = () => ({roots: ['p'], nodes: [{id: 'p', kind: 'project', coverage: 'included'},
  {id: 'take', kind: 'take', coverage: 'included'}, {id: 'checkpoint', kind: 'checkpoint', coverage: 'included'},
  {id: 'bytes', kind: 'binary', byteLength: 8, ownership: 'managed', coverage: 'included'}],
  edges: [{from: 'p', to: 'take'}, {from: 'p', to: 'checkpoint'}, {from: 'take', to: 'bytes'}, {from: 'checkpoint', to: 'bytes'}]});
const codes = r => r.issues.map(i => i.code);
test('matching declarations preserve declared closure without establishing complete Backup or Restore', () => {
  const r = api.inspect(p(), g(), g()); assert.equal(r.comparison.declaredClosurePreserved, true);
  assert.equal(r.restoreReady, false); assert.equal(r.completeBackup, 'not-established');
  assert.equal(r.binaryExistence, 'unverified'); assert.equal(r.portablePackage, 'not-established');
  assert.equal(r.capacity.sufficient, 'unverified'); assert.equal(r.capacity.packageDeclaredBinaryBytes, 8);
});
for (const [name, mutate, code] of [
  ['missing binary', x => x.nodes.pop(), 'required-node-absent-from-package-closure'],
  ['lost shared referrer edge', x => x.edges.pop(), 'required-edge-absent-from-package'],
  ['lost root', x => x.roots = ['take'], 'required-root-absent-from-package'],
  ['excluded byte', x => x.nodes[3].coverage = 'excluded', 'required-node-not-declared-included'],
  ['external byte', x => x.nodes[3].ownership = 'external', 'external-recovery-unverified'],
  ['temporary URL', x => x.nodes[3].reference = 'blob:private', 'required-temporary-reference'],
  ['permission lost', x => x.nodes[3].permission = 'unavailable', 'permission-recovery-required'],
  ['reselection', x => x.nodes[3].permission = 'requires-reselection', 'permission-recovery-required'],
  ['duplicate identity', x => x.nodes.push({...x.nodes[3]}), 'package-duplicate-identity'],
  ['changed kind', x => x.nodes[1].kind = 'audio-version', 'dependency-declaration-changed'],
  ['changed size', x => x.nodes[3].byteLength = 9, 'dependency-declaration-changed'],
  ['unsupported', x => x.nodes[3].kind = 'future', 'package-unsupported-node-kind'],
  ['unknown version', x => x.nodes[3].version = 2, 'package-version-contract-undecided'],
  ['digest mismatch', x => x.nodes[3].digestMismatch = true, 'package-declared-digest-mismatch']
]) test(name + ' blocks declared comparison', () => {
  const source = g(), packaged = g(); mutate(packaged); const before = JSON.stringify([source, packaged]);
  const r = api.inspect(p(), source, packaged); assert.ok(codes(r).includes(code));
  assert.equal(r.comparison.declaredClosurePreserved, false); assert.equal(r.restoreReady, false);
  assert.equal(JSON.stringify([source, packaged]), before); assert.ok(!JSON.stringify(r).includes('private'));
});
test('shared binary cannot lose one checkpoint reference despite bytes remaining reachable', () => {
  const packaged = g(); packaged.edges.pop(); const r = api.inspect(p(), g(), packaged);
  assert.equal(r.comparison.missingRequiredNodes.length, 0);
  assert.deepEqual(r.comparison.sharedBinaryReferences[0].missingReferrers, ['checkpoint']);
  assert.equal(r.comparison.sharedBinaryReferences[0].deletionSafe, false);
});
test('cycles terminate and additional reachable assets are disclosed', () => {
  const source = g(); source.edges.push({from: 'bytes', to: 'p'}); const packaged = structuredClone(source);
  packaged.nodes.push({id: 'extra', kind: 'binary', coverage: 'included'}); packaged.edges.push({from: 'p', to: 'extra'});
  const r = api.inspect(p(), source, packaged); assert.deepEqual(r.comparison.additionalPackageNodes, ['extra']);
  assert.equal(r.capacity.unknownBinarySizes, 1); assert.equal(r.restoreReady, false);
});
test('empty and malformed graphs never establish completeness', () => {
  for (const review of [null, {}, {nodes: [], edges: [], roots: []}]) {
    const r = api.inspect(p(), review, review); assert.equal(r.comparison.declaredClosurePreserved, false); assert.equal(r.restoreReady, false);
  }
});
test('Backup review count mismatches and same IDs across projects do not imply shared content', () => {
  const b = {format: 'music-studio-backup', version: 1, projects: [p(), {...p(), projectId: 'other'}]};
  const before = JSON.stringify(b), r = api.inspectBackup(b, [g(), g()], [g()]);
  assert.equal(r.projects.length, 2); assert.equal(r.issues[0].code, 'package-review-count-mismatch');
  assert.equal(r.crossProjectContentIdentity, 'unverified'); assert.equal(r.restoreReady, false); assert.equal(JSON.stringify(b), before);
});
test('session rejects stale source, package, Project and Cancel without writes', () => {
  const project = p(), source = g(), packaged = g(), s = api.session(project, source, packaged);
  assert.equal(s.inspect(project, source, packaged).comparison.declaredClosurePreserved, true);
  packaged.nodes[3].byteLength++; assert.equal(s.inspect(project, source, packaged).issues[0].code, 'stale-package-review');
  source.nodes[3].byteLength++; assert.equal(s.inspect(project, source, packaged).issues[0].code, 'stale-review');
  project.future.keep = false; assert.equal(s.inspect(project, source, packaged).issues[0].code, 'stale-project');
  s.cancel(); assert.equal(s.inspect(project, source, packaged).cancelled, true);
});
test('deep frozen inputs and report edits retain unknown data', () => {
  const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
  const project = freeze(p()), source = freeze(g()), packaged = freeze(g()), before = JSON.stringify([project, source, packaged]);
  const r = api.inspect(project, source, packaged); r.comparison.sharedBinaryReferences[0].requiredReferrers.pop();
  assert.equal(JSON.stringify([project, source, packaged]), before);
});
test('changed URL or content claim is disclosed without leaking opaque values', () => {
  for (const field of ['reference', 'contentClaim']) {
    const source = g(), packaged = g();
    source.nodes[3][field] = field === 'reference' ? 'file:private-source' : {algorithm: 'undecided', digest: 'private-source'};
    packaged.nodes[3][field] = field === 'reference' ? 'file:private-package' : {algorithm: 'undecided', digest: 'private-package'};
    const r = api.inspect(p(), source, packaged); assert.ok(codes(r).includes('opaque-dependency-claim-changed'));
    assert.ok(!JSON.stringify(r).includes('private-')); assert.equal(r.contentIdentity, 'unverified');
  }
});
test('declared sizes at autoBackup boundary never establish device quota sufficiency', () => {
  for (const size of [4194303, 4194304, 4194305, Number.MAX_SAFE_INTEGER]) {
    const source = g(); source.nodes[3].byteLength = size; const r = api.inspect(p(), source, source);
    assert.equal(r.capacity.packageDeclaredBinaryBytes, size); assert.equal(r.capacity.sufficient, 'unverified');
    assert.equal(r.capacity.deviceQuota, 'physical-pending');
  }
});
test('synthetic Save/Reopen JSON Backup and legacy inspections produce zero repository writes', async () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const window = {console, Date, Math, JSON, Intl, setTimeout, clearTimeout}; window.window = window;
  vm.runInNewContext(fs.readFileSync(require.resolve('../music-studio.js'), 'utf8'), {window, globalThis: window});
  const app = window.MusicStudio, repo = app.memoryRepository(); app.setRepository(repo);
  app.state.settings = app.defaultSettings('2026-10-04T00:00:00.000Z');
  const project = Object.assign(app.makeProject({projectId: 'synthetic', projectName: 'Synthetic'}), p());
  await repo.put(project); app.state.projects = await repo.list();
  const saved = JSON.stringify(await repo.get(project.projectId)), json = (await app.exportProject(project.projectId)).text;
  const backup = app.backupObject(); delete backup.metadata.createdAt; const before = JSON.stringify(backup);
  let writes = 0; for (const name of ['put', 'delete', 'putSettings', 'putAutoBackup', 'deleteAutoBackup', 'putMidiHistory', 'putMidiImportHistory']) repo[name] = async () => { writes++; throw Error('unexpected-write'); };
  api.inspect(await repo.get(project.projectId), g(), g()); api.inspect(JSON.parse(json), g(), g());
  api.inspectBackup(JSON.parse(before), [g()], [g()]); api.inspect({projectId: 'legacy', future: true}, g(), g());
  assert.equal(writes, 0); assert.equal(JSON.stringify(await repo.get(project.projectId)), saved);
  assert.equal((await app.exportProject(project.projectId)).text, json);
  const after = app.backupObject(); delete after.metadata.createdAt; assert.equal(JSON.stringify(after), before);
});
