'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const api = require('../music-studio-dependency-closure-inspection');
const project = () => ({format: 'music-studio-project', schemaVersion: '1.0', version: 1,
  projectId: 'synthetic', audioAssets: [{assetId: 'voice', storage: {kind: 'external-file', reference: 'voice.wav'}}], future: {keep: true}});
const review = () => ({roots: ['p'], nodes: [{id: 'p', kind: 'project'},
  {id: 'a', kind: 'asset', logicalAssetId: 'voice'},
  {id: 'b', kind: 'binary', ownership: 'managed', coverage: 'included', byteLength: 8}],
  edges: [{from: 'p', to: 'a'}, {from: 'a', to: 'b'}]});
const codes = r => r.issues.map(i => i.code);
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
test('normal declarations are not verified bytes, complete Backup, or runtime PASS', () => {
  const p = freeze(project()), g = freeze(review()), before = JSON.stringify([p, g]);
  const r = api.inspect(p, g); assert.equal(r.valid, true); assert.equal(r.closure.reachableCount, 3);
  assert.equal(r.capacity.declaredBinaryBytes, 8); assert.equal(r.capacity.actualBinaryBytes, 'unverified');
  assert.equal(r.dependencies[2].binaryPresence, 'unverified'); assert.equal(r.dependencies[2].ownershipVerification, 'unverified');
  assert.equal(r.observedAssets[0].permission, 'unverified'); assert.equal(r.backup.complete, 'not-established');
  assert.equal(r.recovery.ready, false); assert.equal(r.standalone.physicalVerification, 'pending');
  r.dependencies[0].id = 'changed'; assert.equal(JSON.stringify([p, g]), before);
});
for (const [name, mutate, expected] of [
  ['missing', g => g.edges.push({from: 'a', to: 'gone'}), 'missing-dependency'],
  ['duplicate', g => g.nodes.push({...g.nodes[2]}), 'duplicate-identity'],
  ['unknown-kind', g => g.nodes[2].kind = 'future', 'unsupported-node-kind'],
  ['unknown-version', g => g.nodes[2].version = 99, 'version-contract-undecided'],
  ['temporary', g => g.nodes[2].reference = 'blob:secret', 'temporary-reference'],
  ['reselection', g => g.nodes[2].permission = 'requires-reselection', 'requires-reselection'],
  ['permission', g => g.nodes[2].permission = 'unavailable', 'permission-unavailable'],
  ['declared-missing', g => g.nodes[2].coverage = 'missing', 'declared-missing'],
  ['identity-claim', g => g.nodes[2].contentClaim = {algorithm: 'not-selected', digest: 'secret'}, 'content-unverified'],
  ['mismatch', g => g.nodes[2].digestMismatch = true, 'declared-digest-mismatch'],
  ['malformed-node', g => g.nodes.push(null), 'malformed-node'],
  ['malformed-edge', g => g.edges.push({to: 'b'}), 'malformed-edge'],
  ['malformed-size', g => g.nodes[2].byteLength = -1, 'malformed-byte-length'],
  ['malformed-content', g => g.nodes[2].contentClaim = {}, 'malformed-content-claim'],
  ['ownership', g => g.nodes[2].ownership = 'auto', 'unknown-ownership'],
  ['coverage', g => g.nodes[2].coverage = 'verified', 'unknown-coverage'],
  ['permission-claim', g => g.nodes[2].permission = 'granted', 'unknown-permission'],
  ['duplicate-edge', g => g.edges.push({...g.edges[1]}), 'duplicate-edge'],
  ['unreachable', g => g.nodes.push({id: 'orphan', kind: 'binary'}), 'excluded-from-closure'],
  ['missing-root', g => g.roots = [], 'missing-roots'],
  ['binary-mapping', g => g.edges.pop(), 'unmodeled-binary-dependency'],
  ['asset-mapping', g => delete g.nodes[1].logicalAssetId, 'unmodeled-asset-dependency']
]) test(name + ' fails closed without writes', () => {
  const g = review(); mutate(g); const before = JSON.stringify(g), r = api.inspect(project(), g);
  assert.ok(codes(r).includes(expected)); assert.equal(r.valid, false); assert.equal(r.recovery.ready, false);
  assert.equal(JSON.stringify(g), before); assert.ok(!JSON.stringify(r).includes('secret'));
});
test('ambiguous target never binds the first duplicate', () => {
  const g = review(); g.nodes.push({...g.nodes[2]}); const r = api.inspect(project(), g);
  assert.ok(codes(r).includes('ambiguous-dependency')); assert.equal(r.dependencies.filter(n => n.id === 'b' && n.reachable).length, 0);
});
test('file-reference identity never silently binds to the same logical asset ID', () => {
  const p = project(), g = review(); p.fileReferences = [{id: 'voice', storage: {kind: 'external-file', reference: 'voice.wav'}}];
  assert.ok(codes(api.inspect(p, g)).includes('unmodeled-asset-dependency'));
  g.nodes.push({id: 'external', kind: 'external-file', fileReferenceId: 'voice'});
  g.edges.push({from: 'p', to: 'external'}); const r = api.inspect(p, g);
  assert.equal(r.valid, true); assert.equal(r.observedAssets[1].logicalAssetId, null);
  assert.equal(r.observedAssets[1].fileReferenceId, 'voice');
});
test('external URL does not establish managed ownership, permission, moved/deleted/offline cause', () => {
  const g = review(); Object.assign(g.nodes[2], {kind: 'external-file', ownership: 'external', coverage: 'external', reference: 'https://example.invalid/secret'});
  const r = api.inspect(project(), g); assert.equal(r.dependencies[2].portability, 'external-unverified');
  assert.equal(r.dependencies[2].permission, 'unverified'); assert.equal(r.dependencies[2].binaryPresence, 'unverified');
  assert.ok(!JSON.stringify(r).includes('secret')); g.nodes[2].ownership = 'managed';
  assert.ok(codes(api.inspect(project(), g)).includes('ownership-conflict'));
});
test('Take / Version / Checkpoint sharing and cycles terminate, no content dedup inference', () => {
  const g = review(); for (const kind of ['take', 'audio-version', 'checkpoint']) {
    g.nodes.push({id: kind, kind}); g.edges.push({from: 'p', to: kind}, {from: kind, to: 'b'});
  }
  g.edges.push({from: 'b', to: 'p'}); const r = api.inspect(project(), g);
  assert.equal(r.closure.reachableCount, 6); assert.equal(r.capacity.declaredBinaryBytes, 8);
  assert.deepEqual(r.capacity.binaryReferrers[0].referrers, ['a', 'take', 'audio-version', 'checkpoint']);
  assert.equal(r.capacity.deduplication, 'not-established'); assert.equal(r.capacity.gc, 'undecided');
});
test('included / excluded / external / missing / unverified coverage stays declarative', () => {
  for (const coverage of ['included', 'excluded', 'external', 'missing', 'unverified']) {
    const g = review(); g.nodes[2].coverage = coverage; const r = api.inspect(project(), g);
    assert.equal(r.backup.coverage[2].claim, coverage); assert.equal(r.backup.coverage[2].verification, 'unverified');
    assert.equal(r.recovery.ready, false);
  }
});
test('declared size overflow and missing sizes never fabricate capacity', () => {
  const g = review(); g.nodes[2].byteLength = Number.MAX_SAFE_INTEGER;
  g.nodes.push({id: 'b2', kind: 'binary', byteLength: 1}, {id: 'b3', kind: 'binary'});
  g.edges.push({from: 'p', to: 'b2'}, {from: 'p', to: 'b3'});
  const r = api.inspect(project(), g); assert.ok(codes(r).includes('declared-size-overflow'));
  assert.equal(r.capacity.declaredBinaryBytes, null); assert.equal(r.capacity.unknownBinarySizes, 1);
});
test('runtime Model / Plugin / Helper / native / host dependencies remain pending', () => {
  const g = review(); for (const kind of ['model', 'plugin', 'audio-helper', 'native-midi-bridge', 'host-navigation']) {
    g.nodes.push({id: kind, kind}); g.edges.push({from: 'p', to: kind});
  }
  const r = api.inspect(project(), g); assert.equal(r.standalone.runtimeDependencies.length, 5);
  assert.ok(r.standalone.runtimeDependencies.every(n => n.verification === 'unverified'));
});
test('malformed, legacy and unknown Project fields remain unchanged', () => {
  for (const p of [null, {}, {unknown: {x: 1}}, {...project(), schemaVersion: 'future'}]) {
    const before = JSON.stringify(p), r = api.inspect(p); assert.equal(r.recovery.ready, false);
    assert.equal(JSON.stringify(p), before); assert.ok(codes(r).includes('unmodeled-dependency-closure'));
  }
  assert.ok(codes(api.inspect(project(), {nodes: {}, edges: {}, roots: [null]})).includes('malformed-nodes'));
});
test('stale review, stale Project, Cancel and cyclic review rejection', () => {
  const p = project(), g = review(), s = api.session(p, g); assert.equal(s.inspect(p, g).valid, true);
  g.nodes[2].byteLength++; assert.equal(s.inspect(p, g).issues[0].code, 'stale-review');
  p.future.keep = false; assert.equal(s.inspect(p, g).issues[0].code, 'stale-project');
  s.cancel(); assert.equal(s.inspect(p, g).cancelled, true);
  const cyclic = {}; cyclic.self = cyclic; assert.equal(api.session(p, cyclic).inspect(p, cyclic).issues[0].code, 'malformed-review');
});
test('Backup reports retain metadata-only even with included claims or unsupported version', () => {
  for (const version of [1, 2, undefined]) {
    const b = {format: 'music-studio-backup', version, projects: [project()], metadata: {binariesIncluded: false}};
    const before = JSON.stringify(b), r = api.inspectBackup(b, [review()]);
    assert.equal(r.completeBackup, 'not-established'); assert.equal(r.restoreReady, false); assert.equal(JSON.stringify(b), before);
  }
  assert.equal(api.inspectBackup(null).restoreReady, false);
});
test('synthetic repository Save/Reopen / JSON / Backup / legacy zero-write', async () => {
  const window = {console, Date, Math, JSON, Intl, setTimeout, clearTimeout}; window.window = window;
  vm.runInNewContext(fs.readFileSync(require.resolve('../music-studio.js'), 'utf8'), {window, globalThis: window});
  const app = window.MusicStudio, repo = app.memoryRepository(); app.setRepository(repo);
  app.state.settings = app.defaultSettings('2026-10-04T00:00:00.000Z');
  const p = Object.assign(app.makeProject({projectId: 'synthetic', projectName: 'Synthetic'}), project());
  await repo.put(p); app.state.projects = await repo.list();
  const before = JSON.stringify(await repo.get(p.projectId)), json = (await app.exportProject(p.projectId)).text;
  const b = app.backupObject(); delete b.metadata.createdAt; const backup = JSON.stringify(b);
  let writes = 0; for (const name of ['put', 'delete', 'putSettings', 'putAutoBackup', 'deleteAutoBackup', 'putMidiHistory', 'putMidiImportHistory']) repo[name] = async () => { writes++; throw Error('unexpected-write'); };
  const g = review(); api.inspect(p, g); api.session(p, g).inspect(p, g); api.inspect(JSON.parse(json), g);
  api.inspectBackup(JSON.parse(backup), [g]); api.inspect({projectId: 'legacy', unknown: {keep: true}});
  assert.equal(writes, 0); assert.equal(JSON.stringify(await repo.get(p.projectId)), before);
  assert.equal((await app.exportProject(p.projectId)).text, json); const after = app.backupObject(); delete after.metadata.createdAt;
  assert.equal(JSON.stringify(after), backup);
});
