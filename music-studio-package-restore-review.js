/* Caller-declared evidence comparison only; no package schema, I/O or restore. */
'use strict';
const closure = require('./music-studio-dependency-closure-inspection');
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function inspect(project, sourceReview, packageReview) {
  const source = closure.inspect(project, sourceReview), packaged = closure.inspect(project, packageReview);
  const issues = [];
  const add = (code, id) => issues.push({code, id});
  for (const [side, report] of [['source', source], ['package', packaged]]) {
    for (const issue of report.issues) issues.push({code: side + '-' + issue.code, path: issue.path});
    if (!report.existing.inventory.valid) add(side + '-invalid-project', null);
  }
  const required = source.dependencies.filter(n => n.reachable);
  const available = packaged.dependencies.filter(n => n.reachable);
  const byId = new Map(available.map(n => [n.id, n]));
  const missing = [], changed = [];
  for (const n of required) {
    const target = byId.get(n.id);
    if (!target) { missing.push(n.id); add('required-node-absent-from-package-closure', n.id); continue; }
    for (const field of ['kind', 'logicalAssetId', 'fileReferenceId', 'declaredByteLength']) {
      if (n[field] !== target[field]) { changed.push({id: n.id, field}); add('dependency-declaration-changed', n.id); }
    }
    if (target.coverageClaim !== 'included') add('required-node-not-declared-included', n.id);
    if (target.portability === 'non-portable') add('required-temporary-reference', n.id);
    if (target.ownershipClaim === 'external' || target.kind === 'external-file') add('external-recovery-unverified', n.id);
    if (target.permission !== 'unverified') add('permission-recovery-required', n.id);
  }
  const reachable = new Set(required.map(n => n.id));
  const token = e => JSON.stringify([e.from, e.to]);
  const packageEdges = new Set(packaged.edges.map(token));
  const missingEdges = source.edges.filter(e => reachable.has(e.from) && reachable.has(e.to) && !packageEdges.has(token(e))).map(e => ({from: e.from, to: e.to}));
  for (const e of missingEdges) add('required-edge-absent-from-package', e.from);
  const sourceRoots = Array.isArray(sourceReview?.roots) ? sourceReview.roots : [];
  const packageRoots = Array.isArray(packageReview?.roots) ? packageReview.roots : [];
  for (const id of sourceRoots) if (!packageRoots.includes(id)) add('required-root-absent-from-package', id);
  // Compare opaque claims without publishing URLs or digest values, or treating them as verified.
  for (const n of required) {
    const a = sourceReview?.nodes?.find(v => v?.id === n.id);
    const matches = Array.isArray(packageReview?.nodes) ? packageReview.nodes.filter(v => v?.id === n.id) : [];
    if (matches.length !== 1) continue;
    for (const field of ['reference', 'contentClaim']) if (JSON.stringify(a?.[field]) !== JSON.stringify(matches[0][field])) {
      changed.push({id: n.id, field}); add('opaque-dependency-claim-changed', n.id);
    }
  }
  const extra = available.filter(n => !reachable.has(n.id)).map(n => n.id);
  const shared = source.capacity.binaryReferrers.filter(n => n.referrers.length > 1).map(n => ({id: n.id,
    requiredReferrers: [...n.referrers], missingReferrers: n.referrers.filter(from => !packageEdges.has(token({from, to: n.id}))),
    deletionSafe: false, retention: 'undecided', contentIdentity: 'unverified'}));
  return {issues, source, packaged, comparison: {
    scope: 'caller-declared-review-only', declaredClosurePreserved: issues.length === 0,
    missingRequiredNodes: missing, missingRequiredEdges: missingEdges, changedDeclarations: changed,
    additionalPackageNodes: extra, sharedBinaryReferences: shared, exhaustive: 'unverified'},
    capacity: {sourceDeclaredBinaryBytes: source.capacity.declaredBinaryBytes,
      packageDeclaredBinaryBytes: packaged.capacity.declaredBinaryBytes,
      unknownBinarySizes: packaged.capacity.unknownBinarySizes,
      deviceQuota: 'physical-pending', sufficient: 'unverified', stagingPeak: 'unmeasured'},
    completeBackup: 'not-established', restoreReady: false, atomicRestore: 'not-established',
    portablePackage: 'not-established', binaryExistence: 'unverified', contentIdentity: 'unverified',
    policySelection: 'undecided', execution: 'not-performed', physicalVerification: 'pending'};
}
function inspectBackup(backup, sourceReviews, packageReviews) {
  const existing = closure.inspectBackup(backup, sourceReviews);
  const projects = Array.isArray(backup?.projects) ? backup.projects.map((p, i) => ({projectIndex: i,
    report: inspect(p, sourceReviews?.[i], packageReviews?.[i])})) : [];
  const issues = [];
  for (const [name, reviews] of [['source', sourceReviews], ['package', packageReviews]]) {
    if (!Array.isArray(reviews) || reviews.length !== projects.length) issues.push({code: name + '-review-count-mismatch'});
  }
  // No cross-project identity/content deduplication is inferred from matching IDs.
  return {existing, projects, issues, crossProjectContentIdentity: 'unverified',
    completeBackup: 'not-established', restoreReady: false, execution: 'not-performed'};
}
function session(project, sourceReview, packageReview) {
  const guard = closure.session(project, sourceReview); let active = true, baseline;
  try { baseline = JSON.stringify(packageReview); } catch (_) { baseline = null; }
  return {inspect(current, source, packaged) {
    if (!active) return {restoreReady: false, cancelled: true};
    const checked = guard.inspect(current, source);
    if (checked.cancelled || checked.issues?.some(i => ['stale-project', 'stale-review', 'malformed-review'].includes(i.code))) return {...checked, restoreReady: false};
    let signature; try { signature = JSON.stringify(packaged); } catch (_) { signature = null; }
    if (!object(packaged) || baseline === null || signature === null || signature !== baseline) return {restoreReady: false, issues: [{code: signature !== baseline ? 'stale-package-review' : 'malformed-package-review'}]};
    return inspect(current, source, packaged);
  }, cancel() { active = false; guard.cancel(); return {cancelled: true, restoreReady: false}; }};
}
module.exports = {inspect, inspectBackup, session};
