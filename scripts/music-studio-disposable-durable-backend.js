'use strict';
// Verification-only Linux filesystem experiment. Never loaded by product code.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createHash} = require('node:crypto');
const observation = require('../music-studio-observed-byte-verification');
const hash = value => createHash('sha256').update(value).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const owned = new Set();
function create() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-disposable-durable-'));
  fs.writeFileSync(path.join(root, 'DISPOSABLE_ONLY'), 'verification-v1');
  owned.add(root); return root;
}
function checkRoot(root) {
  if (!path.isAbsolute(root) || path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith('nova-disposable-durable-') ||
      fs.lstatSync(root).isSymbolicLink() || fs.readFileSync(path.join(root, 'DISPOSABLE_ONLY'), 'utf8') !== 'verification-v1') throw Error('not-disposable');
}
function syncDir(dir) { const fd = fs.openSync(dir, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function write(file, data) { const fd = fs.openSync(file, 'wx'); try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function generations(root) { return fs.readdirSync(root).filter(x => /^g-[0-9]{8}$/.test(x)).sort().reverse(); }
function recover(root, options = {}) {
  checkRoot(root); const rejected = [];
  for (const generation of generations(root)) {
    try {
      options.fault?.({phase: 'reload', generation});
      const dir = path.join(root, generation), commit = JSON.parse(fs.readFileSync(path.join(dir, 'COMMIT'), 'utf8'));
      const raw = fs.readFileSync(path.join(dir, 'manifest.json'));
      if (commit.digest !== hash(raw)) throw Error('manifest-mismatch');
      const manifest = JSON.parse(raw), binaries = Object.create(null);
      for (const [index, item] of manifest.records.entries()) {
        if (item.file !== `binary-${index}` || typeof item.id !== 'string' || Object.hasOwn(binaries, item.id)) throw Error('invalid-record');
        const bytes = fs.readFileSync(path.join(dir, item.file));
        if (bytes.length !== item.length || hash(bytes) !== item.digest) throw Error('binary-mismatch');
        binaries[item.id] = Array.from(bytes);
      }
      const required = manifest.review.nodes.filter(n => n.kind === 'binary' && n.coverage === 'included');
      if (required.some(n => !Object.hasOwn(binaries, n.id))) throw Error('missing-binary');
      return {outcome: 'valid-generation', generation, project: manifest.project, review: manifest.review, binaries, rejected,
        scope: 'disposable-filesystem-only', productionRecovery: 'not-established', physicalVerification: 'pending'};
    } catch (_) { rejected.push(generation); }
  }
  return {outcome: 'no-valid-generation', rejected, productionRecovery: 'not-established', physicalVerification: 'pending'};
}
async function save(root, current, read, options = {}) {
  checkRoot(root);
  const baseline = JSON.stringify(current), snapshot = copy(current), s = observation.session(current.project, current.source, current.packaged);
  let committed = false, generation;
  const boundary = () => { if (options.signal?.aborted) throw Error('cancelled'); if (JSON.stringify(current) !== baseline) throw Error('stale'); };
  const phase = async (name, detail = {}) => { await options.fault?.({phase: name, ...detail}); boundary(); };
  try {
    boundary(); const evidence = await s.observe(current, read);
    const staged = await s.simulateRecovery(current, evidence, {}, {capacityBytes: options.capacityBytes});
    if (staged.outcome !== 'complete-synthetic-success') throw Error(staged.reason);
    await phase('before-write');
    const next = Math.max(0, ...generations(root).map(x => Number(x.slice(2)))) + 1;
    if (next > 99999999) throw Error('generation-overflow');
    generation = `g-${String(next).padStart(8, '0')}`;
    const dir = path.join(root, generation); fs.mkdirSync(dir); syncDir(root);
    const records = [];
    for (const [id, values] of Object.entries(staged.state.binaries)) {
      const bytes = Buffer.from(values), file = `binary-${records.length}`, target = path.join(dir, file);
      // Actual partial file persists when interrupted here; no commit record exists.
      const fd = fs.openSync(target, 'wx');
      try { const split = Math.ceil(bytes.length / 2); fs.writeSync(fd, bytes.subarray(0, split)); fs.fsyncSync(fd);
        await phase('during-write', {id}); fs.writeSync(fd, bytes.subarray(split)); fs.fsyncSync(fd);
      } finally { fs.closeSync(fd); }
      records.push({id, file, length: bytes.length, digest: hash(bytes)});
      await phase('after-write', {id});
    }
    const raw = JSON.stringify({project: snapshot.project, review: snapshot.packaged, records});
    write(path.join(dir, 'manifest.json'), raw); syncDir(dir);
    await phase('before-commit');
    // A partially written marker is never a committed generation.
    const marker = JSON.stringify({digest: hash(raw)});
    write(path.join(dir, 'COMMIT.pending'), marker.slice(0, 10));
    await phase('during-commit');
    fs.unlinkSync(path.join(dir, 'COMMIT.pending'));
    write(path.join(dir, 'COMMIT.pending'), marker);
    await phase('before-publication');
    fs.renameSync(path.join(dir, 'COMMIT.pending'), path.join(dir, 'COMMIT')); syncDir(dir); syncDir(root); committed = true;
    // Cancel after the commit cannot promise rollback; report the durable outcome.
    await options.fault?.({phase: 'after-commit', generation});
    return {outcome: 'committed', generation, reloaded: recover(root, options), productionRecovery: 'not-established'};
  } catch (_) { return {outcome: committed ? 'committed-reload-pending' : 'not-committed', generation,
    recovered: recover(root), productionRecovery: 'not-established'}; }
}
function dispose(root) { if (!owned.has(root)) throw Error('not-owned'); checkRoot(root); fs.rmSync(root, {recursive: true}); owned.delete(root); }
module.exports = {create, save, recover, dispose};
if (require.main === module) process.stdout.write(JSON.stringify(recover(process.argv[2])));
