/* Explicit offline verification. No loader, repository, file resolver or persistent schema. */
'use strict';
const {createHash} = require('node:crypto');
const review = require('./music-studio-package-restore-review');
const signature = value => { try { return JSON.stringify(value); } catch (_) { return null; } };
const clone = value => JSON.parse(JSON.stringify(value));
const bytes = value => {
  if (!(value instanceof Uint8Array)) throw Error('unreadable-bytes');
  // Copy immediately: subsequent mutation of a resolver-owned buffer cannot change evidence.
  return Uint8Array.from(value);
};
const digest = value => createHash('sha256').update(value).digest('hex');
const errorCode = error => ({QuotaExceededError: 'capacity-insufficient', NotAllowedError: 'permission-unavailable',
  PermissionLostError: 'permission-lost', ReselectionRequiredError: 'reselection-required',
  NotFoundError: 'missing-byte', AbortError: 'interrupted'})[error?.name] || 'byte-read-failed';
function session(project, source, packaged) {
  const guard = review.session(project, source, packaged);
  const baseline = signature([project, source, packaged]);
  let cancelled = false, generation = 0;
  const accepted = new WeakMap();
  const boundary = current => {
    if (cancelled) return 'cancelled';
    if (signature([current.project, current.source, current.packaged]) !== baseline) return 'stale-state';
    const checked = guard.inspect(current.project, current.source, current.packaged);
    if (!checked.comparison?.declaredClosurePreserved) return 'invalid-dependency-review';
    return null;
  };
  const run = async (current, read) => {
    const attempt = ++generation, records = [], issues = [];
    const stopped = () => boundary(current) || (attempt !== generation ? 'superseded-attempt' : null);
    const report = () => ({scope: 'observed-byte-verification-only', accepted: issues.length === 0,
      records: clone(records), issues: clone(issues), contentIdentity: 'unverified',
      digestPurpose: 'verification-only-sha256', completeBackup: 'not-established', restoreReady: false,
      atomicRestore: 'not-established', policySelection: 'undecided', physicalVerification: 'pending'});
    const fail = (code, id = null) => issues.push({code, id});
    let reason = stopped();
    if (reason) { fail(reason); return report(); }
    if (typeof read !== 'function') { fail('missing-byte-reader'); return report(); }
    const checked = review.inspect(current.project, current.source, current.packaged);
    const required = checked.source.dependencies.filter(n => n.reachable && ['binary', 'external-file'].includes(n.kind));
    const captured = new Map();
    for (const node of required) {
      try {
        // Read both sides. Matching logical IDs/lengths are never substituted for content comparison.
        const original = bytes(await read('source', node.id));
        reason = stopped(); if (reason) { fail(reason, node.id); break; }
        const candidate = bytes(await read('package', node.id));
        reason = stopped(); if (reason) { fail(reason, node.id); break; }
        const sourceDigest = digest(original), packageDigest = digest(candidate);
        const sizeMatches = node.declaredByteLength === null || node.declaredByteLength === original.byteLength;
        const equal = sourceDigest === packageDigest && original.byteLength === candidate.byteLength;
        records.push({id: node.id, sourceReadable: true, packageReadable: true,
          sourceByteLength: original.byteLength, packageByteLength: candidate.byteLength,
          declarationSizeMatches: sizeMatches, verificationDigestMatches: equal,
          sourceDigest, packageDigest, logicalContentIdentity: 'unverified'});
        if (!sizeMatches) fail('declared-size-mismatch', node.id);
        if (!equal) fail('observed-content-mismatch', node.id);
        captured.set(node.id, candidate);
      } catch (error) { fail(stopped() || errorCode(error), node.id); break; }
    }
    reason = stopped(); if (reason && !issues.some(i => i.code === reason)) fail(reason);
    const result = report();
    if (result.accepted) accepted.set(result, {attempt, captured});
    return result;
  };
  return {observe: run, cancel() { cancelled = true; generation++; guard.cancel(); return {cancelled: true}; },
    // Synthetic transaction only. Never calls a production adapter or changes caller-owned state.
    async simulateRecovery(current, evidence, originalState, options = {}) {
      const initial = clone(originalState), entry = accepted.get(evidence), events = [];
      const reject = reason => ({outcome: 'original-retained', reason, state: clone(initial), events,
        partialPublished: false, productionAtomicity: 'not-established', physicalVerification: 'pending'});
      const check = () => boundary(current) || (!entry || entry.attempt !== generation ? 'stale-or-untrusted-evidence' : null);
      let reason = check(); if (reason) return reject(reason);
      if (!Number.isSafeInteger(options.capacityBytes) || options.capacityBytes < 0) return reject('capacity-unverified');
      const total = [...entry.captured.values()].reduce((sum, b) => sum + b.byteLength, 0);
      if (!Number.isSafeInteger(total) || total > options.capacityBytes) return reject('capacity-insufficient');
      const candidate = {project: clone(current.project), review: clone(current.packaged),
        binaries: {}, unknownOriginalFields: clone(initial)};
      try {
        for (const [id, value] of entry.captured) {
          candidate.binaries[id] = Array.from(value); events.push({phase: 'stage', id});
          if (typeof options.fault === 'function') await options.fault({phase: 'stage', id});
          reason = check(); if (reason) return reject(reason);
        }
        events.push({phase: 'precommit'});
        if (typeof options.fault === 'function') await options.fault({phase: 'precommit'});
        reason = check(); if (reason) return reject(reason);
        // Single publication of a detached result, only after every dependency is staged.
        return {outcome: 'complete-synthetic-success', state: candidate, events: [...events, {phase: 'commit'}],
          partialPublished: false, productionAtomicity: 'not-established', physicalVerification: 'pending'};
      } catch (error) { return reject(errorCode(error)); }
    }};
}
module.exports = {session};
