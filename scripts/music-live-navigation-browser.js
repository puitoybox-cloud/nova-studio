'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const server = http.createServer((request, response) => {
  const file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end();
    return;
  }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(response);
});

async function gateRepository(page, method) {
  await page.evaluate(method => {
    const repo = window.navigationRepository;
    const original = repo[method];
    repo[method] = async (...args) => {
      repo[method] = original;
      await new Promise(resolve => { window.releaseNavigationOperation = resolve; });
      return original(...args);
    };
  }, method);
}

async function checkNavigation(page, phase) {
  const route = new URL(page.url()).hash;
  await page.evaluate(() => {
    for (const action of ['midi', 'assistant', 'lyrics', 'vocal', 'mix', 'harmony', 'master', 'long-master', 'export', 'settings', 'backup']) {
      if (MusicStudio.openWorkAction(action, 'source') !== false) throw Error('workspace navigation accepted: ' + action);
    }
    if (MusicStudio.openLyricsAssignment('source') !== false) throw Error('lyrics navigation accepted');
    if (MusicStudio.pcmOpen('source') !== false) throw Error('PCM navigation accepted');
  });
  assert.equal(new URL(page.url()).hash, route, phase);
  await page.locator('.nova-menu-toggle').click();
  await page.locator('.nova-menu-panel [data-route="projects"]').click();
  assert.equal(new URL(page.url()).hash, route, phase);
  const toggle = page.locator('.nova-menu-toggle');
  await toggle.focus();
  await page.evaluate(() => {
    window.historyEvents = 0;
    addEventListener('hashchange', () => window.historyEvents++, { once: true });
    history.back();
  });
  await page.waitForFunction(route => window.historyEvents && location.hash === route, route);
  assert.equal(await toggle.evaluate(element => element === document.activeElement), true, phase);
}

async function verifyOperation(page, phase, method, start) {
  await gateRepository(page, method);
  await page.evaluate(start);
  await page.waitForFunction(() => typeof window.releaseNavigationOperation === 'function');
  await checkNavigation(page, phase);
  const result = await finishOperation(page);
  assert.equal(result.ok, true, phase + ': ' + result.error);
  return result;
}

async function finishOperation(page) {
  return page.evaluate(async () => {
    const release = window.releaseNavigationOperation;
    delete window.releaseNavigationOperation;
    release();
    const result = await window.navigationOperation;
    return { ok: result.ok, error: result.error?.message || result.error, projectId: result.project?.projectId };
  });
}

async function scenario(browser, base, width) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, permissions: ['microphone'] });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => MusicStudio.state.loaded);
    await page.evaluate(async () => {
      const app = MusicStudio;
      const repo = window.navigationRepository = app.indexedDbRepository();
      app.setRepository(repo);
      const project = app.makeProject({ projectId: 'source', projectName: 'Navigation source' });
      const channels = [Array.from({ length: 24000 }, (_, i) => 0.2 * Math.sin(i * Math.PI / 50))];
      await repo.put(app.pcmImport(project, { sampleRate: 48000, channels }, 'Source PCM'));
      await repo.put(app.makeProject({ projectId: 'other', projectName: 'Untouched' }));
      await app.refresh();
      window.navigationMidi = new File([MusicStudioMidi.createMidiFile(MusicStudioMidi.createTestMidiData()).bytes], 'navigation.mid', { type: 'audio/midi' });
      app.pcmOpen('source');
    });
    const before = await page.evaluate(async () => JSON.stringify(await navigationRepository.get('other')));
    await verifyOperation(page, 'PCM apply', 'compareAndPut', () => {
      const app = MusicStudio, p = app.state.projects.find(p => p.projectId === 'source');
      app.pcmEditor.preview = app.pcmPreview(p, p.pcmMix.assets[0].id, -6);
      window.navigationOperation = app.pcmApply('source');
    });
    await verifyOperation(page, 'final render', 'get', () => {
      const app = MusicStudio, p = app.state.projects.find(p => p.projectId === 'source');
      const routes = app.finalSources(p).map(s => ({ key: s.key, role: 'instrument', startSeconds: 0, gainDb: 0, muted: false }));
      window.navigationOperation = app.finalPreview('source', { format: 'nova-final-export-plan-v1', routes, targetLufs: -14, ceilingDb: -1, includeMidi: false, mixMasterOnly: true });
    });
    await verifyOperation(page, 'final save', 'compareAndPut', () => {
      window.navigationOperation = MusicStudio.finalSave('source');
    });
    const wave = page.waitForEvent('download');
    await verifyOperation(page, 'final download', 'get', () => {
      window.navigationOperation = MusicStudio.finalDownload('source', 'Master.wav');
    });
    const download = await wave;
    const wav = fs.readFileSync(await download.path());
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');

    await page.evaluate(() => MusicStudio.openWorkAction('vocal', 'source'));
    await page.evaluate(() => {
      const devices = navigator.mediaDevices;
      const getUserMedia = devices.getUserMedia.bind(devices);
      devices.getUserMedia = async constraints => {
        await new Promise(resolve => { window.releaseMicrophone = resolve; });
        return getUserMedia(constraints);
      };
    });
    await page.getByRole('button', { name: 'Record Vocal（録音開始）', exact: true }).click();
    await page.waitForFunction(() => MusicStudio.vocal.phase === 'permission' && window.releaseMicrophone);
    await checkNavigation(page, 'microphone permission');
    await page.evaluate(() => window.releaseMicrophone());
    await page.waitForFunction(() => MusicStudio.vocal.phase === 'recording' && MusicStudio.vocal.level?.peak > 0);
    await checkNavigation(page, 'recording');
    assert.equal(await page.evaluate(() => MusicStudio.vocal.phase), 'recording');
    await gateRepository(page, 'putLongWav');
    await page.evaluate(() => {
      const recorder = MusicStudio.vocal.recorder;
      const onstop = recorder.onstop;
      recorder.onstop = async (...args) => {
        await new Promise(resolve => { window.releaseRecorderStop = resolve; });
        return onstop.apply(recorder, args);
      };
      window.navigationOperation = MusicStudio.vocalStop();
    });
    await page.waitForFunction(() => MusicStudio.vocal.phase === 'stopping' && window.releaseRecorderStop);
    await checkNavigation(page, 'recording stop');
    await page.evaluate(() => window.releaseRecorderStop());
    await page.waitForFunction(() => MusicStudio.vocal.phase === 'saving' && window.releaseNavigationOperation);
    await checkNavigation(page, 'recording save after stop');
    const recorded = await finishOperation(page);
    assert.equal(recorded.ok, true, recorded.error);

    await page.evaluate(() => MusicStudio.openWorkAction('backup', 'source'));
    const archiveDownload = page.waitForEvent('download');
    await verifyOperation(page, 'Archive export', 'list', () => {
      window.navigationOperation = MusicStudio.exportLongWavArchive();
    });
    const archiveBytes = fs.readFileSync(await (await archiveDownload).path());
    await page.evaluate(bytes => {
      window.navigationArchive = new File([new Uint8Array(bytes)], 'navigation.nova');
    }, Array.from(archiveBytes));
    await verifyOperation(page, 'Archive restore', 'restoreLongArchive', () => {
      window.navigationOperation = MusicStudio.restoreLongWavArchive(window.navigationArchive, { settings: false });
    });

    await page.evaluate(() => {
      MusicStudio.goProjects();
      const file = window.navigationMidi;
      const arrayBuffer = file.arrayBuffer.bind(file);
      file.arrayBuffer = async () => {
        await new Promise(resolve => { window.releaseNavigationOperation = resolve; });
        return arrayBuffer();
      };
      window.navigationOperation = MusicStudio.inspectMidiFile(file);
    });
    await page.waitForFunction(() => typeof window.releaseNavigationOperation === 'function');
    await checkNavigation(page, 'MIDI file analysis');
    const inspected = await finishOperation(page);
    assert.equal(inspected.ok, true, inspected.error);
    await page.evaluate(() => { delete window.navigationMidi.arrayBuffer; });
    const midi = await verifyOperation(page, 'MIDI import', 'commitMidiImport', () => {
      window.navigationOperation = MusicStudio.importMidiAsNew();
    });
    const external = await verifyOperation(page, 'external song import', 'compareAndPut', () => {
      window.navigationOperation = MusicStudio.importExternalSongFile(window.navigationMidi);
    });

    const snapshot = await page.evaluate(async () => {
      const repo = window.navigationRepository;
      return JSON.stringify([await repo.list(), await repo.listMidiImportHistory()]);
    });
    const reopened = await context.newPage();
    await reopened.goto(base);
    await reopened.waitForFunction(() => MusicStudio.state.loaded);
    const saved = await reopened.evaluate(async ({ midi, external }) => {
      const repo = MusicStudio.indexedDbRepository();
      const source = await repo.get('source');
      return {
        snapshot: JSON.stringify([await repo.list(), await repo.listMidiImportHistory()]),
        other: JSON.stringify(await repo.get('other')),
        gain: source.pcmMix.assets[0].gains.at(-1),
        exports: source.finalExportHistory.length,
        deliveries: source.finalExportDeliveries.length,
        editSources: source.songVersions.edits.map(edit => edit.source),
        midiReceipts: (await repo.listMidiImportHistory()).filter(receipt => receipt.projectId === midi).length,
        externalCreationEvents: (await repo.get(external)).productionHistory.filter(event => event.source === 'external-song-import').length,
        vocalBytes: (await repo.getLongWav(source.longWavAssets[0].id)).blob.size,
        midiTracks: (await repo.get(midi)).midiData.tracks.length,
        externalTracks: (await repo.get(external)).midiData.tracks.length,
      };
    }, { midi: midi.projectId, external: external.projectId });
    assert.equal(saved.snapshot, snapshot);
    assert.equal(saved.other, before);
    assert.equal(saved.gain, -6);
    assert.equal(saved.exports, 1);
    assert.equal(saved.deliveries, 1);
    assert.ok(saved.vocalBytes > 44);
    assert.ok(saved.editSources.includes('audio-editor'));
    assert.ok(saved.editSources.includes('final-export'));
    assert.ok(saved.editSources.includes('vocal-editor'));
    assert.equal(saved.midiReceipts, 1);
    assert.equal(saved.externalCreationEvents, 1);
    assert.ok(saved.midiTracks && saved.externalTracks);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, phases: 13, navigationAttempts: 195, wavBytes: wav.length, archiveBytes: archiveBytes.length, indexedDbReopened: true }));
  } finally {
    await context.close();
  }
}

(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({
      executablePath: process.env.CHROME_EXECUTABLE,
      args: ['--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    });
    const base = 'http://127.0.0.1:' + server.address().port + '/music-studio.html';
    for (const width of [1440, 1180, 820, 390]) await scenario(browser, base, width);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
