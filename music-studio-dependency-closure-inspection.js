/* Explicit review input only. Not a manifest/package/Project schema or a byte verifier. */
'use strict';
const storage = require('./music-studio-storage-contract-inspection');
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const string = v => typeof v === 'string' && v.trim().length > 0;
const kinds = new Set(['project', 'asset', 'binary', 'take', 'audio-version', 'checkpoint', 'external-file', 'model', 'plugin', 'audio-helper', 'native-midi-bridge', 'host-navigation']);
const ownerships = new Set(['managed', 'external', 'unknown']);
const coverages = new Set(['included', 'excluded', 'external', 'missing', 'unverified']);
const permissions = new Set(['unverified', 'unavailable', 'requires-reselection']);
function inspect(project, review) {
  const existing = storage.inspect(project), issues = [], nodes = [], edges = [];
  const issue = (code, path) => issues.push({code, path});
  // Existing logical assets have no known binary mapping. URL and assetId prove no bytes.
  const observedAssets = existing.dependencies.map(d => ({...d, logicalAssetId: d.identity,
    binaryPresence: 'unverified', permission: 'unverified', contentIdentity: 'unverified'}));
  if (!object(review)) issue('unmodeled-dependency-closure', '$review');
  else {
    if (!Array.isArray(review.nodes)) issue('malformed-nodes', 'nodes');
    if (!Array.isArray(review.edges)) issue('malformed-edges', 'edges');
    if (!Array.isArray(review.roots) || !review.roots.length) issue('missing-roots', 'roots');
    for (const [i, n] of (Array.isArray(review.nodes) ? review.nodes : []).entries()) {
      const path = `nodes[${i}]`;
      if (!object(n) || !string(n.id)) { issue('malformed-node', path); continue; }
      if (!kinds.has(n.kind)) issue('unsupported-node-kind', path);
      if (n.version !== undefined) issue('version-contract-undecided', path);
      if (n.ownership !== undefined && !ownerships.has(n.ownership)) issue('unknown-ownership', path);
      if (n.coverage !== undefined && !coverages.has(n.coverage)) issue('unknown-coverage', path);
      if (n.permission !== undefined && !permissions.has(n.permission)) issue('unknown-permission', path);
      if (n.byteLength !== undefined && (!Number.isSafeInteger(n.byteLength) || n.byteLength < 0)) issue('malformed-byte-length', path);
      if (n.contentClaim !== undefined && (!object(n.contentClaim) || !string(n.contentClaim.algorithm) || !string(n.contentClaim.digest))) issue('malformed-content-claim', path);
      if (n.contentClaim !== undefined) issue('content-unverified', path);
      if (n.digestMismatch === true) issue('declared-digest-mismatch', path);
      const temporary = typeof n.reference === 'string' && /^(blob:|data:)/i.test(n.reference);
      if (n.reference !== undefined && !string(n.reference)) issue('malformed-reference', path);
      if (temporary) issue('temporary-reference', path);
      const external = n.kind === 'external-file' || n.ownership === 'external';
      if (n.kind === 'external-file' && n.ownership === 'managed') issue('ownership-conflict', path);
      if (n.permission === 'unavailable') issue('permission-unavailable', path);
      if (n.permission === 'requires-reselection') issue('requires-reselection', path);
      if (n.coverage === 'missing') issue('declared-missing', path);
      nodes.push({id: n.id, kind: kinds.has(n.kind) ? n.kind : 'unsupported', path,
        logicalAssetId: n.kind === 'asset' && string(n.logicalAssetId) ? n.logicalAssetId : null,
        ownershipClaim: ownerships.has(n.ownership) ? n.ownership : 'unknown', ownershipVerification: 'unverified',
        coverageClaim: coverages.has(n.coverage) ? n.coverage : 'unverified',
        permission: permissions.has(n.permission) ? n.permission : 'unverified',
        binaryPresence: n.coverage === 'missing' ? 'declared-missing' : 'unverified',
        contentIdentity: 'unverified', contentClaimPresent: n.contentClaim !== undefined,
        declaredByteLength: Number.isSafeInteger(n.byteLength) && n.byteLength >= 0 ? n.byteLength : null,
        portability: temporary ? 'non-portable' : external ? 'external-unverified' : 'unverified',
        runtimeVerification: 'unverified', physicalVerification: 'pending'});
    }
    for (const [i, e] of (Array.isArray(review.edges) ? review.edges : []).entries()) {
      if (!object(e) || !string(e.from) || !string(e.to)) issue('malformed-edge', `edges[${i}]`);
      else edges.push({from: e.from, to: e.to, path: `edges[${i}]`});
    }
  }
  const byId = new Map();
  for (const n of nodes) { const matches = byId.get(n.id) || []; matches.push(n); byId.set(n.id, matches); }
  for (const matches of byId.values()) if (matches.length > 1) for (const n of matches) issue('duplicate-identity', n.path);
  const resolve = (id, path) => {
    if (!string(id)) { issue('malformed-dependency', path); return false; }
    const matches = byId.get(id);
    if (!matches) { issue('missing-dependency', path); return false; }
    if (matches.length !== 1) { issue('ambiguous-dependency', path); return false; }
    return true;
  };
  const adjacency = new Map(), seenEdges = new Set();
  for (const e of edges) {
    const from = resolve(e.from, e.path), to = resolve(e.to, e.path), token = JSON.stringify([e.from, e.to]);
    if (seenEdges.has(token)) issue('duplicate-edge', e.path); seenEdges.add(token);
    if (from && to) { const list = adjacency.get(e.from) || []; list.push(e.to); adjacency.set(e.from, list); }
  }
  const reachable = new Set(), queue = [];
  for (const [i, id] of (Array.isArray(review?.roots) ? review.roots : []).entries()) if (resolve(id, `roots[${i}]`)) queue.push(id);
  // Iterative, cycle-safe traversal; ambiguous identities never bind to the first match.
  while (queue.length) { const id = queue.pop(); if (reachable.has(id)) continue; reachable.add(id); for (const target of adjacency.get(id) || []) queue.push(target); }
  const dependencies = nodes.map(n => ({...n, reachable: reachable.has(n.id) && byId.get(n.id).length === 1}));
  for (const n of dependencies) if (!n.reachable) issue('excluded-from-closure', n.path);
  for (const a of observedAssets) {
    const matches = dependencies.filter(n => n.kind === 'asset' && n.logicalAssetId === a.logicalAssetId && n.reachable);
    if (!a.logicalAssetId || matches.length !== 1) issue(matches.length > 1 ? 'ambiguous-asset-mapping' : 'unmodeled-asset-dependency', a.path);
    else if (!(adjacency.get(matches[0].id) || []).some(id => ['binary', 'external-file'].includes(byId.get(id)?.[0]?.kind))) issue('unmodeled-binary-dependency', a.path);
  }
  const closure = dependencies.filter(n => n.reachable), declaredSizes = closure.filter(n => n.kind === 'binary').map(n => n.declaredByteLength);
  let declaredBytes = 0;
  for (const size of declaredSizes) { if (size === null) continue; if (!Number.isSafeInteger(declaredBytes + size)) { issue('declared-size-overflow', 'capacity'); declaredBytes = null; break; } declaredBytes += size; }
  return {valid: existing.inventory.valid && issues.length === 0, existing, observedAssets, dependencies, edges, issues,
    closure: {scope: 'caller-declared-review-only', reachableCount: closure.length, exhaustive: 'unverified'},
    capacity: {declaredBinaryBytes: declaredBytes, unknownBinarySizes: declaredSizes.filter(v => v === null).length,
      actualBinaryBytes: 'unverified', memoryPeak: 'unmeasured', deviceQuota: 'physical-pending',
      deduplication: 'not-established', lifetime: 'undecided', pin: 'undecided', gc: 'undecided',
      binaryReferrers: closure.filter(n => n.kind === 'binary').map(n => ({id: n.id,
        referrers: [...new Set(edges.filter(e => e.to === n.id && reachable.has(e.from) && byId.get(e.from)?.length === 1).map(e => e.from))],
        retention: 'undecided', presence: 'unverified'}))},
    backup: {currentContract: 'metadata-only', complete: 'not-established',
      coverage: closure.map(n => ({id: n.id, claim: n.coverageClaim, verification: 'unverified', permission: n.permission}))},
    recovery: {execution: 'not-performed', ready: false, gate: 'blocked-unverified-closure-and-bytes',
      atomicity: 'not-established', failures: ['partial-failure', 'missing-binary', 'unknown-version', 'unsupported-version', 'duplicate-identity', 'digest-mismatch', 'external-unavailable', 'permission-unavailable']},
    standalone: {portability: 'not-established', metadataOpening: 'unverified',
      runtimeDependencies: closure.filter(n => ['model', 'plugin', 'audio-helper', 'native-midi-bridge', 'host-navigation', 'external-file'].includes(n.kind)).map(n => ({id: n.id, kind: n.kind, verification: 'unverified'})), physicalVerification: 'pending'},
    policySelection: 'undecided', resolution: 'not-performed', physicalVerification: 'pending'};
}
function inspectBackup(backup, reviews) {
  const existing = storage.inspectBackup(backup);
  const projects = Array.isArray(backup?.projects) ? backup.projects.map((p, i) => inspect(p, Array.isArray(reviews) ? reviews[i] : undefined)) : [];
  return {existing, projects, completeBackup: 'not-established', restoreReady: false, resolution: 'not-performed'};
}
function session(project, review) {
  const guard = storage.session(project); let active = true, baseline;
  try { baseline = JSON.stringify(review); } catch (_) { baseline = null; }
  return {inspect(current, currentReview) {
    if (!active) return {valid: false, cancelled: true};
    const checked = guard.inspect(current);
    if (checked.cancelled || checked.issues?.some(i => i.code === 'stale-project')) return checked;
    let signature; try { signature = JSON.stringify(currentReview); } catch (_) { signature = null; }
    if (baseline === null || signature === null) return {valid: false, issues: [{code: 'malformed-review'}]};
    if (signature !== baseline) return {valid: false, issues: [{code: 'stale-review'}]};
    return inspect(current, currentReview);
  }, cancel() { active = false; return guard.cancel(); }};
}
module.exports = {inspect, inspectBackup, session};
