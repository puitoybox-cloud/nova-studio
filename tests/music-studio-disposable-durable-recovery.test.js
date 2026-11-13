'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), {spawnSync} = require('node:child_process');
const api = require('../scripts/music-studio-disposable-durable-backend');
const modulePath = require.resolve('../scripts/music-studio-disposable-durable-backend');
function fixture(label = 'new') {
  const project = {projectId: 'disposable', label, future: {keep: true}};
  const source = {roots: ['p'], nodes: [{id: 'p', kind: 'project', coverage: 'included'},
    ...['take-a', 'take-b', 'version', 'checkpoint'].map(id => ({id, kind: id.startsWith('take') ? 'take' : id === 'version' ? 'audio-version' : 'checkpoint', coverage: 'included'})),
    {id: 'shared', kind: 'binary', byteLength: 4, coverage: 'included', ownership: 'managed'},
    {id: 'second', kind: 'binary', byteLength: 4, coverage: 'included', ownership: 'managed'}],
    edges: [...['take-a', 'take-b', 'version', 'checkpoint'].flatMap(id => [{from: 'p', to: id}, {from: id, to: 'shared'}]), {from: 'p', to: 'second'}]};
  return {project, source, packaged: structuredClone(source)};
}
const reader = async () => Uint8Array.from([1, 2, 3, 4]);
const fresh = root => { const r = spawnSync(process.execPath, [modulePath, root], {encoding: 'utf8'}); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
async function setup(t) { const root = api.create(); t.after(() => api.dispose(root));
  assert.equal((await api.save(root, fixture('old'), reader, {capacityBytes: 8})).outcome, 'committed'); return root; }
test('actual fsync/save/commit and fresh process reload preserve full candidate and shared edges', async t => {
  const root = await setup(t), f = fixture(), original = JSON.stringify(f);
  const result = await api.save(root, f, reader, {capacityBytes: 8}); assert.equal(result.outcome, 'committed');
  const r = fresh(root); assert.deepEqual(r.project, f.project); assert.deepEqual(r.review, f.packaged);
  assert.deepEqual(Object.keys(r.binaries).sort(), ['second', 'shared']); assert.deepEqual(r.binaries.shared, [1, 2, 3, 4]);
  assert.equal(JSON.stringify(f), original); assert.equal(r.productionRecovery, 'not-established');
});
for (const phase of ['before-write', 'during-write', 'after-write', 'before-commit', 'during-commit', 'before-publication']) {
  for (const failure of ['interruption', 'permission', 'capacity', 'cancel']) test(`${phase}: ${failure} preserves old and retry works`, async t => {
    const root = await setup(t), signal = new AbortController();
    const r = await api.save(root, fixture(), reader, {capacityBytes: 8, signal: signal.signal, fault(e) {
      if (e.phase === phase) { if (failure === 'cancel') signal.abort(); else throw Error(failure); }
    }});
    assert.equal(r.outcome, 'not-committed'); assert.equal(fresh(root).project.label, 'old');
    assert.equal((await api.save(root, fixture(), reader, {capacityBytes: 8})).outcome, 'committed');
    assert.equal(fresh(root).project.label, 'new');
  });
  test(`${phase}: abrupt child exit leaves recoverable old generation`, async t => {
    const root = await setup(t);
    const code = `const api=require(${JSON.stringify(modulePath)}); api.save(${JSON.stringify(root)},${JSON.stringify(fixture())},async()=>Uint8Array.from([1,2,3,4]),{capacityBytes:8,fault(e){if(e.phase===${JSON.stringify(phase)})process.exit(77)}});`;
    const child = spawnSync(process.execPath, ['-e', code]); assert.equal(child.status, 77);
    assert.equal(fresh(root).project.label, 'old');
  });
}
test('abrupt exit after commit before reload yields complete new generation', async t => {
  const root = await setup(t);
  const code = `const api=require(${JSON.stringify(modulePath)}); api.save(${JSON.stringify(root)},${JSON.stringify(fixture())},async()=>Uint8Array.from([1,2,3,4]),{capacityBytes:8,fault(e){if(e.phase==='after-commit')process.exit(77)}});`;
  assert.equal(spawnSync(process.execPath, ['-e', code]).status, 77); assert.equal(fresh(root).project.label, 'new');
});
test('after commit fault and Cancel report committed instead of claiming rollback', async t => {
  const root = await setup(t), controller = new AbortController();
  const r = await api.save(root, fixture(), reader, {capacityBytes: 8, signal: controller.signal, fault(e) {
    if (e.phase === 'after-commit') { controller.abort(); throw Error('reload-interrupted'); }
  }});
  assert.equal(r.outcome, 'committed-reload-pending'); assert.equal(fresh(root).project.label, 'new');
});
for (const damage of ['missing', 'corrupt', 'truncated', 'manifest', 'marker']) test(`reload rejects ${damage} and preserves old shared references`, async t => {
  const root = await setup(t), saved = await api.save(root, fixture(), reader, {capacityBytes: 8}), dir = path.join(root, saved.generation);
  if (damage === 'missing') fs.unlinkSync(path.join(dir, 'binary-0'));
  if (damage === 'corrupt') fs.writeFileSync(path.join(dir, 'binary-0'), Buffer.from([1, 2, 9, 4]));
  if (damage === 'truncated') fs.writeFileSync(path.join(dir, 'binary-1'), Buffer.from([1]));
  if (damage === 'manifest') fs.writeFileSync(path.join(dir, 'manifest.json'), '{}');
  if (damage === 'marker') fs.writeFileSync(path.join(dir, 'COMMIT'), '{');
  const r = fresh(root); assert.equal(r.project.label, 'old'); assert.deepEqual(r.binaries.shared, [1, 2, 3, 4]);
  assert.equal(r.review.edges.filter(e => e.to === 'shared').length, 4); assert.ok(r.rejected.includes(saved.generation));
});
test('reload injected permission failure does not return partial new state', async t => {
  const root = await setup(t), result = await api.save(root, fixture(), reader, {capacityBytes: 8});
  const r = api.recover(root, {fault(e) { if (e.generation === result.generation) throw Error('permission-unavailable'); }});
  assert.equal(r.project.label, 'old'); assert.equal(fresh(root).project.label, 'new');
});
for (const capacityBytes of [0, 7, 8, 9]) test(`capacity ${capacityBytes} counts shared binary once`, async t => {
  const root = await setup(t); const r = await api.save(root, fixture(), reader, {capacityBytes});
  assert.equal(r.outcome, capacityBytes < 8 ? 'not-committed' : 'committed');
  assert.equal(fresh(root).project.label, capacityBytes < 8 ? 'old' : 'new');
});
test('missing package bytes and omitted shared referrer never write new generation', async t => {
  const root = await setup(t), f = fixture();
  const r = await api.save(root, f, async side => { if (side === 'package') throw Error('missing'); return reader(); }, {capacityBytes: 8});
  assert.equal(r.outcome, 'not-committed');
  f.packaged.edges = f.packaged.edges.filter(e => e.from !== 'take-a');
  assert.equal((await api.save(root, f, reader, {capacityBytes: 8})).outcome, 'not-committed');
  assert.equal(fresh(root).review.edges.filter(e => e.to === 'shared').length, 4);
  assert.equal(fs.readdirSync(root).filter(x => x.startsWith('g-')).length, 1);
});
test('stale snapshot during write refuses commit', async t => {
  const root = await setup(t), f = fixture();
  const r = await api.save(root, f, reader, {capacityBytes: 8, fault(e) { if (e.phase === 'during-write') f.project.label = 'changed'; }});
  assert.equal(r.outcome, 'not-committed'); assert.equal(fresh(root).project.label, 'old');
});
test('dispose refuses unowned locations and product loaders never reference backend', () => {
  assert.throws(() => api.dispose('/tmp'), /not-owned/);
  for (const name of ['app.js', 'music-studio.html', 'music-studio.js']) assert.ok(!fs.readFileSync(path.join(__dirname, '..', name), 'utf8').includes('disposable-durable-backend'));
});
