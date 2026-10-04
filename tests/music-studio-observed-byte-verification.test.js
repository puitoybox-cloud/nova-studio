'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const api = require('../music-studio-observed-byte-verification');
const fixture = () => {
  const project = {format: 'music-studio-project', schemaVersion: '1.0', version: 1, projectId: 'synthetic', future: {keep: true}};
  const source = {roots: ['p'], nodes: [{id: 'p', kind: 'project', coverage: 'included'},
    ...['take-a', 'take-b', 'version', 'checkpoint'].map(id => ({id, kind: id.startsWith('take') ? 'take' : id === 'version' ? 'audio-version' : 'checkpoint', coverage: 'included'})),
    {id: 'shared', kind: 'binary', byteLength: 4, coverage: 'included', ownership: 'managed'}],
    edges: ['take-a', 'take-b', 'version', 'checkpoint'].flatMap(id => [{from: 'p', to: id}, {from: id, to: 'shared'}])};
  return {project, source, packaged: structuredClone(source)};
};
const read = async () => new Uint8Array([0, 1, 2, 255]);
const fault = name => { const e = Error('private-location'); e.name = name; throw e; };
const original = () => ({saved: ['old'], unknown: {keep: true}, binaries: {shared: [9]}});
const codes = r => r.issues.map(i => i.code);
test('actual source/package reads and digest comparison do not claim production identity', async () => {
  const f = fixture(), before = JSON.stringify(f), calls = [], s = api.session(f.project, f.source, f.packaged);
  const r = await s.observe(f, async (side, id) => { calls.push([side, id]); return read(); });
  assert.equal(r.accepted, true); assert.deepEqual(calls, [['source', 'shared'], ['package', 'shared']]);
  assert.equal(r.records[0].verificationDigestMatches, true); assert.equal(r.contentIdentity, 'unverified');
  assert.equal(r.restoreReady, false); assert.equal(r.completeBackup, 'not-established'); assert.equal(JSON.stringify(f), before);
});
for (const [name, code] of [['QuotaExceededError', 'capacity-insufficient'], ['NotAllowedError', 'permission-unavailable'],
  ['PermissionLostError', 'permission-lost'], ['ReselectionRequiredError', 'reselection-required'],
  ['NotFoundError', 'missing-byte'], ['AbortError', 'interrupted'], ['Error', 'byte-read-failed']]) {
  for (const side of ['source', 'package']) test(`${side} ${name} fails without leaking error or accepting partial evidence`, async () => {
    const f = fixture(), s = api.session(f.project, f.source, f.packaged);
    const r = await s.observe(f, async which => which === side ? fault(name) : read());
    assert.equal(r.accepted, false); assert.ok(codes(r).includes(code)); assert.ok(!JSON.stringify(r).includes('private-location'));
    const state = original(); const recovery = await s.simulateRecovery(f, r, state, {capacityBytes: 4});
    assert.equal(recovery.outcome, 'original-retained'); assert.deepEqual(recovery.state, state);
  });
}
for (const value of [undefined, null, 'abcd', [0, 1, 2, 255], new ArrayBuffer(4)]) test('non-byte input is not readable evidence: ' + String(value), async () => {
  const f = fixture(); const r = await api.session(f.project, f.source, f.packaged).observe(f, async () => value);
  assert.equal(r.accepted, false); assert.ok(codes(r).includes('byte-read-failed'));
});
test('same size different content fails; missing size never implies content identity', async () => {
  const f = fixture(); const s = api.session(f.project, f.source, f.packaged);
  const r = await s.observe(f, async side => side === 'source' ? read() : new Uint8Array([0, 1, 3, 255]));
  assert.ok(codes(r).includes('observed-content-mismatch')); assert.equal(r.accepted, false);
  delete f.source.nodes[5].byteLength; delete f.packaged.nodes[5].byteLength;
  const unknown = await api.session(f.project, f.source, f.packaged).observe(f, read);
  assert.equal(unknown.accepted, true); assert.equal(unknown.contentIdentity, 'unverified');
});
test('declared byte length mismatch fails despite matching source/package bytes', async () => {
  const f = fixture(); f.source.nodes[5].byteLength = f.packaged.nodes[5].byteLength = 5;
  const r = await api.session(f.project, f.source, f.packaged).observe(f, read);
  assert.ok(codes(r).includes('declared-size-mismatch')); assert.equal(r.accepted, false);
});
for (const target of ['project', 'source', 'packaged']) test('async ' + target + ' change refuses stale byte acceptance', async () => {
  const f = fixture(), s = api.session(f.project, f.source, f.packaged);
  const r = await s.observe(f, async () => { f[target].future = true; return read(); });
  assert.equal(r.accepted, false); assert.ok(codes(r).includes('stale-state'));
});
test('Cancel during read is terminal; retry uses fresh session and fresh reads', async () => {
  const f = fixture(), s = api.session(f.project, f.source, f.packaged);
  const r = await s.observe(f, async () => { s.cancel(); return read(); });
  assert.ok(codes(r).includes('cancelled')); assert.equal((await s.observe(f, read)).accepted, false);
  assert.equal((await api.session(f.project, f.source, f.packaged).observe(f, read)).accepted, true);
});
test('overlapping attempts supersede older results', async () => {
  const f = fixture(), s = api.session(f.project, f.source, f.packaged); let release;
  const old = s.observe(f, () => new Promise(resolve => { release = resolve; }));
  const latest = await s.observe(f, read); release(new Uint8Array([0, 1, 2, 255]));
  assert.ok(codes(await old).includes('superseded-attempt'));
  assert.equal((await s.simulateRecovery(f, latest, original(), {capacityBytes: 4})).outcome, 'complete-synthetic-success');
});
for (const capacityBytes of [undefined, -1, 3, 4, 5]) test('deterministic capacity boundary ' + capacityBytes, async () => {
  const f = fixture(), s = api.session(f.project, f.source, f.packaged), e = await s.observe(f, read), state = original();
  const r = await s.simulateRecovery(f, e, state, {capacityBytes});
  assert.equal(r.outcome, capacityBytes >= 4 ? 'complete-synthetic-success' : 'original-retained');
  if (!(capacityBytes >= 4)) assert.deepEqual(r.state, state);
  assert.deepEqual(state, original()); assert.equal(r.productionAtomicity, 'not-established');
});
for (const phase of ['stage', 'precommit']) for (const name of ['QuotaExceededError', 'PermissionLostError', 'AbortError']) {
  test(phase + ' ' + name + ' keeps complete original and supports retry', async () => {
    const f = fixture(), s = api.session(f.project, f.source, f.packaged), e = await s.observe(f, read), state = original();
    const r = await s.simulateRecovery(f, e, state, {capacityBytes: 4, fault: async event => { if (event.phase === phase) fault(name); }});
    assert.equal(r.outcome, 'original-retained'); assert.deepEqual(r.state, state); assert.equal(r.partialPublished, false);
    assert.ok(!r.events.some(x => x.phase === 'commit'));
    const retry = await s.simulateRecovery(f, e, state, {capacityBytes: 4});
    assert.equal(retry.outcome, 'complete-synthetic-success'); assert.deepEqual(state, original());
    assert.deepEqual(retry.state.review.edges, f.source.edges); assert.deepEqual(retry.state.binaries.shared, [0, 1, 2, 255]);
  });
}
for (const phase of ['stage', 'precommit']) for (const action of ['cancel', 'stale']) test(phase + ' ' + action + ' never commits', async () => {
  const f = fixture(), s = api.session(f.project, f.source, f.packaged), e = await s.observe(f, read), state = original();
  const r = await s.simulateRecovery(f, e, state, {capacityBytes: 4, fault: async event => {
    if (event.phase === phase) { if (action === 'cancel') s.cancel(); else f.project.future.keep = false; }
  }});
  assert.equal(r.outcome, 'original-retained'); assert.deepEqual(r.state, state); assert.equal(r.partialPublished, false);
});
test('forged or modified public report cannot supply bytes or bypass private evidence', async () => {
  const f = fixture(), s = api.session(f.project, f.source, f.packaged), e = await s.observe(f, read);
  assert.equal((await s.simulateRecovery(f, structuredClone(e), original(), {capacityBytes: 4})).outcome, 'original-retained');
  e.records[0].sourceByteLength = 0; e.accepted = false;
  assert.equal((await s.simulateRecovery(f, e, original(), {capacityBytes: 3})).outcome, 'original-retained');
});
test('resolver-owned bytes and returned candidate are detached from later retry', async () => {
  const f = fixture(), s = api.session(f.project, f.source, f.packaged), buffer = new Uint8Array([0, 1, 2, 255]);
  const e = await s.observe(f, async () => buffer); buffer.fill(9);
  const a = await s.simulateRecovery(f, e, original(), {capacityBytes: 4}); a.state.binaries.shared.fill(7);
  const b = await s.simulateRecovery(f, e, original(), {capacityBytes: 4}); assert.deepEqual(b.state.binaries.shared, [0, 1, 2, 255]);
});
for (const mode of ['edge', 'exclude', 'missing']) test('shared Take/Version/Checkpoint ' + mode + ' cannot damage other refs', async () => {
  const f = fixture(); if (mode === 'edge') f.packaged.edges.pop();
  if (mode === 'exclude') f.packaged.nodes[1].coverage = 'excluded';
  if (mode === 'missing') f.packaged.nodes.pop();
  const before = JSON.stringify(f), s = api.session(f.project, f.source, f.packaged); let reads = 0;
  const e = await s.observe(f, async () => { reads++; return read(); });
  assert.equal(e.accepted, false); assert.equal(reads, 0); assert.equal(JSON.stringify(f), before);
  assert.deepEqual((await s.simulateRecovery(f, e, original(), {capacityBytes: 4})).state, original());
});
test('retry after a failed fresh read invalidates previous evidence', async () => {
  const f = fixture(), s = api.session(f.project, f.source, f.packaged), e = await s.observe(f, read);
  await s.observe(f, async () => fault('NotFoundError'));
  assert.equal((await s.simulateRecovery(f, e, original(), {capacityBytes: 4})).reason, 'stale-or-untrusted-evidence');
});
test('real temporary file bytes read on both sides; removal invalidates fresh observation', async () => {
  const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nova-byte-verification-'));
  try {
    const f = fixture(), s = api.session(f.project, f.source, f.packaged);
    for (const side of ['source', 'package']) await fs.writeFile(path.join(dir, side), new Uint8Array([0, 1, 2, 255]));
    const reader = async side => { try { return await fs.readFile(path.join(dir, side)); } catch (_) { return fault('NotFoundError'); } };
    assert.equal((await s.observe(f, reader)).accepted, true);
    await fs.unlink(path.join(dir, 'package'));
    assert.ok(codes(await s.observe(f, reader)).includes('missing-byte'));
  } finally { await fs.rm(dir, {recursive: true, force: true}); }
});
test('partial staging of multiple binaries never publishes first byte on later failure', async () => {
  const f = fixture(); for (const graph of [f.source, f.packaged]) {
    graph.nodes.push({id: 'second', kind: 'binary', byteLength: 4, coverage: 'included'});
    graph.edges.push({from: 'p', to: 'second'});
  }
  const s = api.session(f.project, f.source, f.packaged), e = await s.observe(f, read), state = original();
  const r = await s.simulateRecovery(f, e, state, {capacityBytes: 8, fault: async event => { if (event.id === 'second') fault('AbortError'); }});
  assert.equal(r.events.filter(x => x.phase === 'stage').length, 2);
  assert.deepEqual(r.state, state); assert.equal(r.partialPublished, false);
  assert.equal((await s.simulateRecovery(f, e, state, {capacityBytes: 7})).reason, 'capacity-insufficient');
  const retry = await s.simulateRecovery(f, e, state, {capacityBytes: 8});
  assert.deepEqual(Object.keys(retry.state.binaries), ['shared', 'second']);
});
test('Save Reopen JSON Backup legacy unknown fields stay unchanged with byte verification', async () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const window = {console, Date, Math, JSON, Intl, setTimeout, clearTimeout}; window.window = window;
  vm.runInNewContext(fs.readFileSync(require.resolve('../music-studio.js'), 'utf8'), {window, globalThis: window});
  const app = window.MusicStudio, repo = app.memoryRepository(); app.setRepository(repo);
  app.state.settings = app.defaultSettings('2026-10-04T00:00:00.000Z');
  const f = fixture(), project = Object.assign(app.makeProject({projectId: 'synthetic', projectName: 'Synthetic'}), f.project);
  await repo.put(project); app.state.projects = await repo.list();
  const saved = JSON.stringify(await repo.get(project.projectId)), json = (await app.exportProject(project.projectId)).text;
  const backup = app.backupObject(); delete backup.metadata.createdAt; const before = JSON.stringify(backup);
  let writes = 0;
  for (const name of ['put', 'delete', 'putSettings', 'putAutoBackup', 'deleteAutoBackup', 'putMidiHistory', 'putMidiImportHistory']) repo[name] = async () => { writes++; throw Error('unexpected-write'); };
  for (const candidate of [await repo.get(project.projectId), JSON.parse(json), JSON.parse(before).projects[0], {projectId: 'legacy', future: true}]) {
    const current = {...f, project: candidate}, s = api.session(candidate, f.source, f.packaged), snapshot = JSON.stringify(candidate);
    const e = await s.observe(current, read);
    await s.simulateRecovery(current, e, original(), {capacityBytes: 4});
    s.cancel(); assert.equal(JSON.stringify(candidate), snapshot);
  }
  assert.equal(writes, 0); assert.equal(JSON.stringify(await repo.get(project.projectId)), saved);
  assert.equal((await app.exportProject(project.projectId)).text, json);
  const after = app.backupObject(); delete after.metadata.createdAt; assert.equal(JSON.stringify(after), before);
});
