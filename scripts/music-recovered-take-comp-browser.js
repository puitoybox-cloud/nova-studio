// Called by both journal crash scenarios after the original recording has been recovered.
const assert = require('node:assert/strict');

async function replaceCompTake(page, projectId, assetId) {
  return page.evaluate(async ({ projectId, assetId }) => {
    const studio = MusicStudio;
    const getProject = () => studio.state.projects.find(project => project.projectId === projectId);
    const recovered = getProject().longWavAssets.find(asset => asset.id === assetId);
    const { sessions, days } = getProject().songVersions;
    const recoveryEvent = getProject().productionHistory.find(event =>
      event.type === 'recording-recovery' && event.assetId === assetId);
    if (!sessions?.length || !days?.length || !recoveryEvent) throw Error('missing-recovery-history');
    const verify = result => {
      if (!result.ok) throw Error(result.error);
      return result;
    };
    const hash = async blob => Array.from(new Uint8Array(await crypto.subtle.digest(
      'SHA-256', await blob.arrayBuffer()
    )), byte => byte.toString(16).padStart(2, '0')).join('');
    const load = id => studio.pcmLoadLongWav(projectId, id);
    const original = await load(assetId);
    const first = 480;
    const end = 4800;
    const segment = { hashes: recovered.hashes, first, end };
    // Save a distinct, attenuated Take to replace in the Comp.
    verify(await studio.vocalCompEdit(projectId, {
      crossfadeMs: 0,
      segments: [{ ...segment, edit: { first, end, gainDb: -12, startTick: 0, latencyMs: 0 } }]
    }));
    const reference = verify(await studio.vocalCompSave(projectId));
    const referenceAsset = reference.project.longWavAssets.find(asset => asset.id === reference.assetId);
    const referenceBlob = await load(reference.assetId);
    const before = {
      crossfadeMs: 0,
      segments: [{ hashes: referenceAsset.hashes, first: 0, end: end - first }]
    };
    verify(await studio.vocalCompEdit(projectId, before));
    const beforeHash = await hash((await studio.vocalCompRender(projectId)).blob);
    const replacement = verify(await studio.vocalCompEdit(projectId, {
      ...before, segments: [segment]
    }));
    const after = (await studio.vocalCompRender(projectId)).blob;
    const afterHash = await hash(after);
    if (afterHash === beforeHash) throw Error('comp-replacement-did-not-change-audio');
    const expected = new DataView(await original.slice(
      44 + first * recovered.channels * 2, 44 + end * recovered.channels * 2
    ).arrayBuffer());
    const actual = new DataView(await after.slice(44).arrayBuffer());
    if (expected.byteLength !== actual.byteLength) throw Error('comp-replacement-frame-count');
    let maxSampleDelta = 0;
    for (let offset = 0; offset < actual.byteLength; offset += 2) {
      maxSampleDelta = Math.max(maxSampleDelta,
        Math.abs(actual.getInt16(offset, true) - expected.getInt16(offset, true)));
    }
    if (maxSampleDelta > 1) throw Error('comp-replacement-source-mismatch');
    const savedComp = verify(await studio.vocalCompSave(projectId));
    const compHash = await hash(await load(savedComp.assetId));
    if (compHash !== afterHash) throw Error('comp-replacement-save-mismatch');
    return {
      projectId, assetId, recoveryEvent, sessions, days, beforeHash, afterHash, maxSampleDelta,
      referenceId: reference.assetId, referenceHash: await hash(referenceBlob),
      originalHash: await hash(original), compId: savedComp.assetId,
      comp: savedComp.project.vocalComp,
      replacementEdit: replacement.project.songVersions.edits.at(-1),
      compSaveEdit: savedComp.project.songVersions.edits.at(-1)
    };
  }, { projectId, assetId });
}

async function verifyReopenedComp(page, expected) {
  const reopened = await page.evaluate(async ({ projectId, assetId, referenceId, compId }) => {
    const studio = MusicStudio;
    const project = studio.state.projects.find(item => item.projectId === projectId);
    const hash = async blob => Array.from(new Uint8Array(await crypto.subtle.digest(
      'SHA-256', await blob.arrayBuffer()
    )), byte => byte.toString(16).padStart(2, '0')).join('');
    const hashTake = async id => hash(await studio.pcmLoadLongWav(projectId, id));
    const currentHash = await hash((await studio.vocalCompRender(projectId)).blob);
    const undo = await studio.vocalCompEdit(projectId, null, -1);
    if (!undo.ok) throw Error(undo.error);
    const undoHash = await hash((await studio.vocalCompRender(projectId)).blob);
    const redo = await studio.vocalCompEdit(projectId, null, 1);
    if (!redo.ok) throw Error(redo.error);
    return {
      currentHash, undoHash,
      redoHash: await hash((await studio.vocalCompRender(projectId)).blob),
      originalHash: await hashTake(assetId), referenceHash: await hashTake(referenceId),
      savedHash: await hashTake(compId), comp: project.vocalComp,
      versions: project.songVersions,
      events: project.productionHistory.filter(event => event.type === 'recording-recovery' && event.assetId === assetId)
    };
  }, expected);
  assert.equal(reopened.currentHash, expected.afterHash);
  assert.equal(reopened.savedHash, expected.afterHash);
  assert.equal(reopened.redoHash, expected.afterHash);
  assert.equal(reopened.undoHash, expected.beforeHash);
  assert.equal(reopened.originalHash, expected.originalHash);
  assert.equal(reopened.referenceHash, expected.referenceHash);
  assert.deepEqual(reopened.comp, expected.comp);
  assert.deepEqual(reopened.events, [expected.recoveryEvent]);
  assert.deepEqual(reopened.versions.sessions, expected.sessions);
  assert.deepEqual(reopened.versions.days, expected.days);
  const sessionId = expected.sessions.find(session => !session.endedAt).id;
  for (const editId of [expected.recoveryEvent.editId, expected.replacementEdit.id, expected.compSaveEdit.id]) {
    const edits = reopened.versions.edits.filter(edit => edit.id === editId);
    assert.equal(edits.length, 1);
    assert.equal(edits[0].sessionId, sessionId);
    assert.ok(edits[0].groups.includes('audio'));
  }
  return { beforeHash: expected.beforeHash, afterHash: expected.afterHash,
    maxSampleDelta: expected.maxSampleDelta, restarted: true, undoRedo: true,
    savedCompAndBothSourcesIdentical: true, sessionDayAndEditHistory: true };
}

module.exports = { replaceCompTake, verifyReopenedComp };
