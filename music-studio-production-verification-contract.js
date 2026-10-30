'use strict';
// Explicit verification only: no loader, production write, fetch or migration.
const inventory = require('./music-studio-dependency-inspection');
const observation = require('./music-studio-observed-byte-verification');
const durable = require('./scripts/music-studio-disposable-durable-backend');
const fs = require('node:fs'), vm = require('node:vm');
let validator;
function productionValidator() {
  if (!validator) {
    const isolated = {}; isolated.window = isolated; isolated.globalThis = isolated;
    for (const module of ['./music-studio-ai-workflow', './music-studio'])
      vm.runInNewContext(fs.readFileSync(require.resolve(module), 'utf8'), isolated);
    validator = isolated.MusicStudio.validateProject;
  }
  return validator;
}
const copy = x => JSON.parse(JSON.stringify(x));
const signature = x => JSON.stringify(x);
function compatibility(project) {
  const issues = [];
  if (!project || typeof project !== 'object' || Array.isArray(project)) issues.push('malformed-project');
  else {
    const checked = productionValidator()(project);
    if (!checked.valid) issues.push('production-project-validation-failed');
    if (project.format !== 'music-studio-project') issues.push('unknown-or-legacy-format');
    if (typeof project.projectId !== 'string' || !project.projectId.trim()) issues.push('missing-project-id');
    if (!Number.isInteger(project.revision) || project.revision < 1) issues.push('invalid-revision');
    if (project.schemaVersion !== '1.0') issues.push('schema-version-mismatch');
    for (const field of ['takes', 'versions', 'checkpoints']) if (Object.hasOwn(project, field)) issues.push(`unsupported-${field}-contract`);
    if (project.aiWorkspace && project.aiWorkspace.version !== 1) issues.push('workspace-version-unverified');
  }
  return {accepted: !issues.length, issues, migrationPerformed: false, unknownFields: 'preserved-in-detached-snapshot', productionMigration: 'not-established'};
}
function resolve(project) {
  const report = inventory.inspect(project), issues = [...report.issues.map(x => x.code), ...compatibility(project).issues];
  const nodes = [{id: 'project', kind: 'project', coverage: 'included'}], edges = [], bindings = new Map();
  for (const asset of report.assets) {
    const id = asset.path;
    if (asset.kind === 'fileReferences') {
      nodes.push({id, kind: 'external-file', fileReferenceId: asset.identity, coverage: 'included', ownership: 'external'});
      edges.push({from: 'project', to: id});
    } else {
      nodes.push({id: id + ':asset', kind: 'asset', logicalAssetId: asset.identity, coverage: 'included'});
      nodes.push({id, kind: 'binary', coverage: 'included'});
      edges.push({from: 'project', to: id + ':asset'}, {from: id + ':asset', to: id});
    }
    bindings.set(id, {path: asset.path, logicalIdentity: asset.identity, kind: asset.kind});
  }
  for (const field of ['audioAssets', 'midiAssets']) for (const asset of Array.isArray(project?.[field]) ? project[field] : []) {
    if (asset.derivedFromAssetId == null) continue;
    const source = report.assets.find(a => a.kind === field && a.identity === asset.assetId);
    const target = report.assets.filter(a => a.kind !== 'fileReferences' && a.identity === asset.derivedFromAssetId);
    if (source && target.length === 1) edges.push({from: source.path + ':asset', to: target[0].path + ':asset'});
  }
  return {accepted: !issues.length, issues, graph: {roots: ['project'], nodes, edges}, bindings,
    inlineMidi: Object.hasOwn(project || {}, 'midiData'), binaryResolver: 'explicit-offline-reader-required'};
}
function backupCompleteness(project, backup) {
  const issues = [...resolve(project).issues];
  const candidates = backup?.projects?.filter(p => p.projectId === project.projectId) || [];
  if (backup?.format !== 'music-studio-backup' || backup?.version !== 1) issues.push('unsupported-backup');
  if (candidates.length !== 1) issues.push('missing-or-ambiguous-project');
  else {
    // Current export changes only external reselection metadata. Every other field must survive.
    const expected = copy(project);
    for (const field of ['audioAssets', 'midiAssets', 'fileReferences']) expected[field] = (expected[field] || []).map(a => ({...a, storage: {...a.storage, requiresReselection: true}}));
    if (signature(expected) !== signature(candidates[0])) issues.push('project-snapshot-mismatch');
  }
  const assets = inventory.inspect(project).assets;
  if (assets.length) issues.push('external-binaries-not-in-current-backup');
  return {complete: false, metadataPreserved: !issues.length, issues, scope: 'current-metadata-backup',
    binariesIncluded: false, external: assets.map(a => a.path), reselection: assets.map(a => a.path),
    fullBinaryBackup: 'not-established', restorePublicationAllowed: false};
}
function portability(inventoryReport, capabilities = {}) {
  const issues = [...(inventoryReport?.issues || []).map(x => x.code)];
  if (inventoryReport?.valid !== true) issues.push('missing-or-invalid-static-inventory');
  for (const field of ['browserIndexedDB', 'scriptStyleClosure', 'binaryAssets', 'helperRuntime', 'nativeComponent', 'hostNavigation', 'distribution'])
    if (capabilities[field] !== 'verified') issues.push(`unverified-${field}`);
  return {portable: !issues.length, issues, physicalAcceptance: 'pending'};
}
function session(project, read) {
  const baseline = signature(project), resolved = resolve(project); let cancelled = false;
  const current = {project: copy(project), source: resolved.graph, packaged: copy(resolved.graph)};
  const reader = async (side, id) => {
    if (cancelled || signature(project) !== baseline) throw Error('stale-or-cancelled');
    if (!resolved.bindings.has(id) || typeof read !== 'function') throw Error('missing-resolver');
    const value = await read(side, copy(resolved.bindings.get(id)));
    if (cancelled || signature(project) !== baseline) throw Error('stale-or-cancelled');
    return value;
  };
  const guard = () => cancelled ? 'cancelled' : signature(project) !== baseline ? 'stale' : !resolved.accepted ? 'unsupported-production-contract' : null;
  return {cancel() {cancelled = true;}, async preflight() {
    const reason = guard(); if (reason) return {accepted: false, reason, publicationAllowed: false};
    const result = await observation.session(current.project, current.source, current.packaged).observe(current, reader);
    return {...result, accepted: result.accepted && !guard(), publicationAllowed: false, productionAtomicRestore: 'not-established'};
  }, async verifyRecovery(options = {}) {
    const reason = guard(); if (reason) return {outcome: 'blocked', reason, publicationAllowed: false};
    const root = durable.create();
    try {
      const result = await durable.save(root, current, reader, {...options, fault: async event => {
        await options.fault?.(event); const failure = guard(); if (failure) throw Error(failure);
      }});
      return {...result, publicationAllowed: false, scope: 'production-snapshot-disposable-backend'};
    } finally {durable.dispose(root);}
  }};
}
module.exports = {compatibility, resolve, backupCompleteness, portability, session};
