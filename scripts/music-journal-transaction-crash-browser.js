// Start SIGKILL only after the real write request succeeds and before its
// transaction can commit. Chained reads keep that specific transaction open.
const { setTimeout: delay } = require('node:timers/promises');
async function killDuringWrite(page, child, storeName, operation, method = 'add') {
  let writeReached;
  const writing = new Promise(resolve => { writeReached = resolve; });
  await page.exposeBinding('novaWriteReached', (_source, key) => writeReached(key));
  await page.evaluate(({ name, method }) => {
    const original = IDBObjectStore.prototype[method];
    IDBObjectStore.prototype[method] = function (value, ...args) {
      const request = original.call(this, value, ...args);
      if (this.name === name && (method !== 'put' || value.closed === true)) {
        IDBObjectStore.prototype[method] = original;
        request.addEventListener('success', () => {
          const hold = () => this.count(request.result).addEventListener('success', hold, { once: true });
          hold();
          window.novaWriteReached(request.result);
        }, { once: true });
      }
      return request;
    };
  }, { name: storeName, method });
  const completed = operation?.();
  let timer;
  let key;
  try {
    key = await Promise.race([
      writing,
      ...(completed ? [completed.then(result => {
        throw Error('operation-ended-before-write: ' + JSON.stringify(result));
      })] : []),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('write-boundary-timeout')), 45000); })
    ]);
  } finally {
    clearTimeout(timer);
  }
  const exited = new Promise(resolve => child.once('exit', (_code, signal) => resolve(signal)));
  child.kill('SIGKILL');
  const signal = await exited;
  if (signal !== 'SIGKILL') throw Error('expected-chromium-sigkill');
  await completed?.catch(() => {});
  return key;
}

async function verifyStopWriteCrash(context, child, launch, url, microphone, switchRepository = false) {
  const assert = require('node:assert/strict');
  let page = await context.newPage();
  await page.addInitScript(microphone);
  await page.goto(url);
  await page.bringToFront();
  await page.waitForFunction(() => window.MusicStudio?.state.loaded);
  const fixture = await page.evaluate(async switchRepository => {
    const studio = MusicStudio;
    const repository = studio.indexedDbRepository();
    studio.setRepository(repository);
    const id = switchRepository ? 'switch-write-crash' : 'stop-write-crash';
    window.novaRecordingRepository = repository;
    const project = studio.makeProject({ projectId: id, projectName: 'Stop transaction crash' });
    await repository.put(project);
    await studio.refresh();
    const session = await studio.productionSessionSave(id, 'start', 'Stop and recover');
    if (!session.ok) throw Error(session.error);
    const day = await studio.productionDaySave(id, new Date().toISOString().slice(0, 10), 'Stop write');
    if (!day.ok) throw Error(day.error);
    const started = await studio.vocalStart(id);
    if (!started.ok) throw Error(started.error);
    return { id, journalId: studio.vocal.recorder.journalId, before: await repository.get(id) };
  }, switchRepository);
  const minimumSeconds = 60;
  const deadline = Date.now() + 115000;
  let progress;
  do {
    progress = await page.evaluate(async journalId => {
      const repo = MusicStudio.indexedDbRepository();
      const journal = await repo.getVocalJournal(journalId);
      await repo.close();
      return {
        next: journal?.next,
        phase: MusicStudio.vocal.phase,
        seconds: journal?.encoding
          ? (Date.now() - MusicStudio.vocal.startedAt) / 1000
          : (journal?.frames || 0) / (journal?.rate || 1)
      };
    }, fixture.journalId);
    if (progress.next >= 3 && progress.phase === 'recording' && progress.seconds >= minimumSeconds) break;
    if (!['permission', 'armed', 'recording'].includes(progress.phase)) {
      throw Error('capture-ended-before-stop-fixture: ' + JSON.stringify(progress));
    }
    await delay(250);
  } while (Date.now() < deadline);
  if (!(progress.next >= 3 && progress.phase === 'recording' && progress.seconds >= minimumSeconds)) {
    throw Error('capture-did-not-reach-stop-fixture: ' + JSON.stringify(progress));
  }
  console.log('stop-crash-capture-ready', JSON.stringify({ switchRepository, ...progress }));
  if (switchRepository) {
    await killDuringWrite(page, child, 'vocalJournals', () => page.evaluate(async before => {
      const studio = MusicStudio;
      const done = studio.vocal.completion;
      studio.setRepository(studio.memoryRepository([before]));
      studio.setRepository(window.novaRecordingRepository);
      return done;
    }, fixture.before), 'put');
  } else {
    await killDuringWrite(page, child, 'longWavBinaries', () => page.evaluate(() => MusicStudio.vocalStop()));
  }
  context = await launch();
  page = await context.newPage();
  await page.goto(url);
  await page.waitForFunction(() => window.MusicStudio?.state.loaded);
  const recovered = await page.evaluate(async ({ id, journalId, before, switchRepository }) => {
    const studio = MusicStudio;
    const repo = studio.indexedDbRepository();
    const journal = await repo.getVocalJournal(journalId);
    if (!journal || journal.closed === switchRepository || journal.next < 3) {
      throw Error('stop-write-journal-mismatch: ' + JSON.stringify({ switchRepository, journal }));
    }
    if (JSON.stringify(await repo.get(id)) !== JSON.stringify(before)) {
      throw Error('stop-write-published-project-before-commit');
    }
    const chunks = [];
    for (let index = 0; index < journal.next; index++) {
      chunks.push((await repo.getVocalJournalChunk(journalId + ':' + index)).bytes);
    }
    const hash = async blob => Array.from(new Uint8Array(await crypto.subtle.digest(
      'SHA-256', await blob.arrayBuffer()
    )), byte => byte.toString(16).padStart(2, '0')).join('');
    let expected = new Blob(chunks);
    if (journal.encoding) {
      const decoder = new AudioContext({ sampleRate: journal.rate });
      try {
        const pcm = await decoder.decodeAudioData(await expected.arrayBuffer());
        expected = studio.vocalWav(Array.from({ length: pcm.numberOfChannels },
          (_, channel) => pcm.getChannelData(channel)), pcm.sampleRate).blob.slice(44);
      } finally {
        await decoder.close();
      }
    }
    if (!journal.closed) {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 31000 - (Date.now() - journal.updatedAt))));
    }
    if (switchRepository) {
      studio.setRepository(repo);
      const alternate = studio.memoryRepository([before]);
      const put = IDBObjectStore.prototype.put;
      let switched = false;
      IDBObjectStore.prototype.put = function (value, ...args) {
        const request = put.call(this, value, ...args);
        if (this.name === 'vocalJournals' && value.id === journalId && value.closed) {
          request.addEventListener('success', () => {
            switched = true;
            studio.setRepository(alternate);
            studio.setRepository(repo);
          }, { once: true });
        }
        return request;
      };
      let stale;
      try {
        stale = await studio.vocalRecoverJournal(journalId);
      } finally {
        IDBObjectStore.prototype.put = put;
      }
      if (!switched || stale.error !== 'vocal-recovery-conflict' ||
          JSON.stringify(await repo.getVocalJournal(journalId)) !== JSON.stringify(journal) ||
          JSON.stringify(await repo.get(id)) !== JSON.stringify(before) ||
          JSON.stringify(await alternate.get(id)) !== JSON.stringify(before)) {
        throw Error('repository-switch-recovery-seal-was-not-rolled-back');
      }
    }
    const result = await studio.vocalRecoverJournal(journalId);
    if (!result.ok) throw Error(result.error);
    const wav = await studio.pcmLoadLongWav(id, result.assetId);
    const project = await repo.get(id);
    const matches = project.productionHistory.filter(event => event.journalId === journalId);
    const edit = project.songVersions.edits.find(edit => edit.id === matches[0]?.editId);
    if (project.longWavAssets.length !== 1 || matches.length !== 1 || matches[0].assetId !== result.assetId ||
        edit?.sessionId !== before.songVersions.sessions[0].id ||
        JSON.stringify(project.songVersions.days) !== JSON.stringify(before.songVersions.days)) {
      throw Error('stop-crash-recovery-history-mismatch');
    }
    const repeated = await studio.vocalRecoverJournal(journalId);
    return { expected: await hash(expected), actual: await hash(wav.slice(44)),
      repeated: repeated.ok, chunks: chunks.length };
  }, { ...fixture, switchRepository });
  assert.equal(recovered.actual, recovered.expected);
  assert.equal(recovered.repeated, false);
  await page.close();
  return { context, evidence: { rolledBackBeforeCommit: true, confirmedOnRestart: true,
    recoveredAudioHash: recovered.actual, journalChunks: recovered.chunks, captureSeconds: progress.seconds,
    duplicateRejected: true, ...(switchRepository ? { staleRecoverySealRolledBack: true } : {}) } };
}

module.exports = { killDuringWrite, verifyStopWriteCrash };
