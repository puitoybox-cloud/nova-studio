const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require('playwright');

async function verify() {
  const profile = await mkdtemp(join(tmpdir(), 'nova-production-browser-'));
  const errors = [];
  const external = [];
  const url = process.env.MUSIC_STUDIO_URL || 'http://127.0.0.1:8765/music-studio.html';
  const origin = new URL(url).origin;
  let context;
  async function openProfile() {
    context = await chromium.launchPersistentContext(profile, {
      executablePath: process.env.CHROME_EXECUTABLE,
      args: ['--no-sandbox']
    });
    await context.route('**/*', route => {
      const target = new URL(route.request().url());
      if (target.origin === origin || ['blob:', 'data:'].includes(target.protocol)) return route.continue();
      external.push(target.origin);
      return route.abort();
    });
    const page = context.pages()[0];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(url);
    await page.waitForFunction(() => window.MusicStudio?.state.loaded);
    return page;
  }
  try {
    let page = await openProfile();
    await page.evaluate(async () => {
      const app=MusicStudio,repo=app.indexedDbRepository();
      const project=app.makeProject({projectId:'layer-browser',projectName:'Vocal layers'});
      await repo.put(project);
      await app.refresh();
      app.goSettings();
    });
    let voice = page.locator('#ms-setting-managed-voices');
    const billing = page.locator('#ms-setting-managed-billing');
    await voice.getByLabel('モデル名').fill('本人声テスト');
    await voice.getByLabel('モデル識別子').fill('local-voice-fixture');
    await voice.getByRole('button', {name: 'モデルを登録'}).click();
    const model = voice.locator('details').first();
    await model.locator('summary').click();
    await model.getByLabel('同意対象の作品').selectOption('layer-browser');
    await model.getByLabel('同意の証跡').fill('consent-fixture-01');
    await model.getByLabel('生成', {exact: true}).check();
    await model.getByLabel('本人の明示同意と上記の許諾範囲を確認した').check();
    await model.getByRole('button', {name: '同意を記録'}).click();
    await page.waitForFunction(() => MusicStudio.state.settings.productionManagement.models[0]?.consent);
    const oldSettings = await page.evaluate(() => JSON.stringify(MusicStudio.state.settings));
    const permission = () => page.evaluate(() => {
      const id = MusicStudio.state.settings.productionManagement.models[0].id;
      return ['train', 'generate'].map(scope => MusicStudio.managedVoicePermission(id, scope, MusicStudio.state.settings, 'layer-browser'));
    });
    assert.deepEqual(await permission(), [false, true]);
    assert.equal(await page.evaluate(() => {
      const app=MusicStudio,model=app.state.settings.productionManagement.models[0];
      return app.managedVoicePermission(model.id,'generate',app.state.settings,'other-project');
    }),false);
    if (!(await model.locator('summary').evaluate(el => el.parentElement.open))) await model.locator('summary').click();
    await model.getByRole('button', {name: '同意を撤回'}).click();
    await page.waitForFunction(() => MusicStudio.state.settings.productionManagement.revocations.length === 1);
    assert.deepEqual(await permission(), [false, false]);
    const restore = await page.evaluate(text => MusicStudio.importSettingsText(text), oldSettings);
    assert.equal(restore.ok, true);
    assert.deepEqual(await permission(), [false, false]);

    await billing.getByLabel('テストプロバイダーの単価（円／回）').fill('4');
    await billing.getByLabel('テスト月額上限（円）').fill('8');
    await billing.getByLabel('作曲', {exact: true}).selectOption('test-provider');
    await billing.getByRole('button', {name: '料金と機能別設定を保存'}).click();
    await page.waitForFunction(() => MusicStudio.state.settings.productionManagement.billing.limit === 8);
    const quote = () => billing.getByRole('button', {name: 'テスト料金を見積もる'}).click();
    const approve = () => billing.getByRole('button', {name: '見積もりを承認して予約'}).click();
    const waitHistory = size => page.waitForFunction(n =>
      MusicStudio.state.settings.productionManagement.billing.history.length === n, size);
    const run = () => billing.getByRole('button', {name: '予約済みテストを実行'}).first().click();
    await quote();
    await approve();
    await waitHistory(1);
    await page.reload();
    await page.waitForFunction(() => window.MusicStudio?.state.loaded);
    await page.evaluate(() => MusicStudio.goSettings());
    await billing.getByText(/予約額 4 円/).waitFor();
    await billing.getByLabel('テスト応答').selectOption('failed');
    await quote();
    await approve();
    await waitHistory(2);
    await quote();
    await approve();
    await page.getByText('月額上限を超えるため実行できません。').waitFor();
    await run();
    await run();
    await billing.getByText(/予約額 0 円/).waitFor();
    await billing.getByRole('button', {name: '取り消す', exact: true}).click();
    await waitHistory(3);
    await quote();
    await approve();
    await waitHistory(4);
    await run();
    await billing.getByText(/利用額 8 円/).waitFor();
    await page.reload();
    await page.waitForFunction(() => window.MusicStudio?.state.loaded);
    assert.deepEqual(await permission(), [false, false]);
    const history = await page.evaluate(() => MusicStudio.state.settings.productionManagement.billing.history);
    assert.deepEqual(history.map(entry => [entry.outcome, entry.amount]), [
      ['completed', 4], ['failed', 0], ['cancelled', 0], ['completed', 4]
    ]);
    assert.equal(new Set(history.map(entry => entry.id)).size, history.length);
    const fixture = await page.evaluate(async () => {
      const app = MusicStudio;
      const repo = app.indexedDbRepository();
      app.setRepository(repo);
      const putLongWav = repo.putLongWav.bind(repo);
      repo.putLongWav = async (...args) => {
        await putLongWav(...args);
        if (args[0].longWavAssets.at(-1).vocalTake?.layerSource) {
          throw Error('completion response lost');
        }
      };
      let project = app.makeProject({projectId: 'layer-browser', projectName: 'Vocal layers',
        midiData: {ppq: 480, tempo: 120, tracks: [{id: 'lead', part: 'melody',
          notes: [{id: 'n1', pitch: 57, startTick: 480, durationTicks: 480}]}]}});
      project = app.adoptLyricsAssignment(project, app.lyricsAssignmentPreview(project,
        {trackId: 'lead', fromNote: 1, toNote: 1, text: 'あ', reading: 'あ'}));
      await repo.put(project);
      app.state.projects = [project];
      const samples = Array.from({length: 8000}, (_, i) => .3 * Math.sin(2 * Math.PI * 220 * i / 8000));
      const file = new File([app.pcmEncodeWav({sampleRate: 8000, channels: [samples]})],
        'vocal-source.wav', {type: 'audio/wav'});
      const result = await app.importScoreVocal(file, project.projectId, project.syllableAssignments[0].id, 'first-note');
      if (!result.ok) throw Error(result.error);
      await app.openScoreVocalTake(project.projectId, result.assetId);
      return result.assetId;
    });
    const sourceHash = await page.evaluate(async assetId => {
      const wav = await MusicStudio.pcmLoadLongWav('layer-browser', assetId);
      return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await wav.arrayBuffer())));
    }, fixture);
    const layers = page.locator('.music-vocal-layers');
    for (const kind of ['harmony', 'double', 'chorus']) {
      const summary = layers.locator('summary');
      if (!(await summary.evaluate(el => el.parentElement.open))) await summary.click();
      await layers.getByLabel('加工元のテイク').selectOption(fixture);
      await layers.getByLabel('加工する声部').selectOption(kind);
      await layers.getByRole('button', {name: '声部をレンダーして保存'}).click();
      await page.waitForFunction(key => MusicStudio.state.projects.find(p => p.projectId === 'layer-browser')
        ?.longWavAssets.some(a => a.vocalTake?.layerSource?.kind === key), kind);
    }
    const layerSnapshot = () => page.evaluate(async () => {
      const project = MusicStudio.state.projects.find(p => p.projectId === 'layer-browser');
      const assets = await Promise.all(project.longWavAssets.map(async asset => {
        const wav = await MusicStudio.pcmLoadLongWav(project.projectId, asset.id);
        const bytes = await crypto.subtle.digest('SHA-256', await wav.arrayBuffer());
        return [asset.id, Array.from(new Uint8Array(bytes)), asset.vocalTake.layerSource ?? null];
      }));
      return {assets, edits: project.songVersions.edits.map(edit => edit.id)};
    });
    const published = await layerSnapshot();
    assert.equal(published.assets.length, 4);
    assert.deepEqual(published.assets[0][1], sourceHash);
    assert.equal(new Set(published.assets.map(asset => JSON.stringify(asset[1]))).size, 4);
    assert.deepEqual(published.assets.slice(1).map(asset => asset[2].kind), ['harmony', 'double', 'chorus']);
    assert.equal(new Set(published.edits).size, published.edits.length);
    await context.close();
    page = await openProfile();
    assert.deepEqual(await layerSnapshot(), published);
    await page.evaluate(() => MusicStudio.goSettings());
    voice = page.locator('#ms-setting-managed-voices');
    await voice.getByLabel('モデル名', {exact: true}).first().fill('録音解析');
    await voice.getByLabel('モデル識別子', {exact: true}).first().fill('local-analysis');
    await voice.getByRole('button', {name: 'モデルを登録'}).click();
    const analysisModel = voice.locator('details').filter({hasText: '録音解析'});
    const openAnalysis = async () => {
      const summary = analysisModel.locator('summary');
      if (!(await summary.evaluate(el => el.parentElement.open))) await summary.click();
    };
    await openAnalysis();
    await analysisModel.getByLabel('同意対象の作品').selectOption('layer-browser');
    await analysisModel.getByLabel('同意の証跡').fill('recording-analysis-consent');
    await analysisModel.getByLabel('学習', {exact: true}).check();
    await analysisModel.getByLabel('本人の明示同意と上記の許諾範囲を確認した').check();
    await analysisModel.getByRole('button', {name: '同意を記録'}).click();
    await page.waitForFunction(() => MusicStudio.state.settings.productionManagement.models.find(m => m.engine === 'local-analysis')?.consent);
    await openAnalysis();
    await analysisModel.getByLabel('学習用録音').selectOption(JSON.stringify(['layer-browser', fixture]));
    await analysisModel.getByRole('button', {name: '学習素材に登録'}).click();
    await page.waitForFunction(() => MusicStudio.state.settings.productionManagement.models.find(m => m.engine === 'local-analysis')?.materials.length === 1);
    await openAnalysis();
    await analysisModel.getByRole('button', {name: '録音を解析'}).click();
    await page.waitForFunction(() => MusicStudio.state.settings.productionManagement.models.find(m => m.engine === 'local-analysis')?.materials[0]?.analysis?.medianHz > 219);
    await openAnalysis();
    await analysisModel.getByText(/検出ピッチ中央値.*Hz/).waitFor();
    const restoredLayers = await page.evaluate(async () => {
      const app = MusicStudio;
      const archive = await app.createLongWavArchive();
      const result = await app.restoreLongWavArchive(archive, {settings: false});
      if (!result.ok) throw Error(result.error);
      const project = result.projects.find(p => p.longWavAssets?.some(a => a.vocalTake?.layerSource));
      return Promise.all(project.longWavAssets.filter(a => a.vocalTake.layerSource).map(async asset => {
        const rendered = await app.vocalRender(project.projectId, asset.id);
        const wav = await app.pcmLoadLongWav(project.projectId, asset.id);
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await wav.arrayBuffer())));
        return [asset.vocalTake.layerSource.kind, rendered.frames, rendered.blob.size, rendered.startSeconds, hash];
      }));
    });
    assert.deepEqual(restoredLayers, [
      ['harmony', 8000, 16044, .5, published.assets[1][1]],
      ['double', 8152, 16348, .5, published.assets[2][1]],
      ['chorus', 8328, 16700, .5, published.assets[3][1]]
    ]);
    const referenceWave=await page.evaluate(async()=>{
      const app=MusicStudio,repo=app.indexedDbRepository();
      const samples=Array.from({length:16000},(_,index)=>.15*Math.sin(2*Math.PI*220*index/8000));
      const wave=app.pcmEncodeWav({sampleRate:8000,channels:[samples]});
      const digest=await crypto.subtle.digest('SHA-256',wave);
      const sourceSha256=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
      const source=app.makeProject({projectId:'transcription-review',projectName:'Transcription review',bpm:120,key:'C',
        midiData:{ppq:480,tempo:120,totalTick:1920,tempoMap:[{tick:0,bpm:120},{tick:960,bpm:90}],
          keySignatureMap:[{tick:0,sharps:0,minor:false},{tick:960,sharps:1,minor:false}],
          tracks:[{id:'detected',roleAssignment:'unassigned',channel:1,name:'Detected',
            notes:[{id:'note-1',startTick:480,durationTicks:240,pitch:60,velocity:80}]}]},
        importSource:{transcription:{model:'basic-pitch',mode:'monophonic',sourceSha256,sourceFileName:'reference.wav',
          detection:{noteCount:1,minimumVelocity:80,maximumVelocity:80}}}});
      await repo.put(source);
      await app.refresh();
      app.openMidiEditor(source.projectId);
      return Array.from(new Uint8Array(wave));
    });
    await page.waitForSelector('.music-external-track-review-menu summary');
    await page.evaluate(()=>{
      const session=MusicStudio.state.midiEditor;
      MusicStudioEditor.selectTrackById(session,'detected');
      MusicStudioEditor.selectNote(session,'note-1');
    });
    await page.locator('.music-external-track-review-menu summary').click();
    const review=page.locator('#externalTrackReviewPopover');
    await review.getByLabel('比較する元音声').setInputFiles({name:'reference.wav',mimeType:'audio/wav',buffer:Buffer.from(referenceWave)});
    await review.getByText('元音声を確認しました。').waitFor();
    await page.waitForFunction(()=>Number.isFinite(document.querySelector('#externalTrackReviewPopover audio')?.duration));
    await review.getByRole('button',{name:'選択音符の位置から原音を試聴'}).click();
    await review.getByText('元音声 0.50 秒から再生しています。').waitFor();
    await page.waitForFunction(()=>document.querySelector('#externalTrackReviewPopover audio')?.currentTime>=.5);
    await page.locator('.music-external-track-review-menu summary').click();
    await page.waitForFunction(()=>!document.querySelector('#externalTrackReviewPopover audio')?.hasAttribute('src'));

    const material=await page.evaluate(async()=>{
      const app=MusicStudio,id='transcription-review';
      const result=await app.materialCapture(id,{name:'Tempo and key material',endTick:1920});
      if(!result.ok)throw Error(result.error);
      app.openProject(id);
      return result.material?.id??result.item?.id??app.state.projects.find(p=>p.projectId===id).materialLibrary.at(-1).id;
    });
    const inventory=page.locator('details').filter({has:page.getByText('診断・素材・AI料金',{exact:true})});
    await page.getByText('診断・素材・AI料金',{exact:true}).evaluate(summary=>{
      for(let node=summary.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
    });
    const materialForm=inventory.locator('form').filter({has:page.getByText('別プロジェクトを作成',{exact:true})});
    await materialForm.getByLabel('BPM（新しい曲のテンポ）').fill('100');
    await materialForm.getByLabel('合わせるKey（同じ長調・短調のみ）').selectOption('D');
    await materialForm.getByRole('button',{name:'別プロジェクトを作成'}).click();
    await page.waitForFunction(materialId=>MusicStudio.state.projects.some(project=>
      project.productionHistory.at(-1)?.materialId===materialId&&project.productionHistory.at(-1)?.type==='material-create'),material);
    await context.close();
    page=await openProfile();
    const reopened=await page.evaluate(async()=>{
      const app=MusicStudio,repo=app.indexedDbRepository(),projects=await repo.list();
      const source=projects.find(item=>item.projectId==='transcription-review');
      const revised=projects.find(item=>item.productionHistory.at(-1)?.type==='material-create');
      const output=MusicStudioMidi.createMidiFile(app.midiExportInput(revised));
      const decoded=MusicStudioMidiParser.parseMidiFile(Uint8Array.from(output.bytes).buffer);
      return {
        sourceNotes:source.midiData.tracks.flatMap(track=>track.notes.map(note=>note.pitch)),
        sourceMaterialNotes:source.materialLibrary[0].midiData.tracks.flatMap(track=>track.notes.map(note=>note.pitch)),
        notes:revised.midiData.tracks.flatMap(track=>track.notes.map(note=>note.pitch)),
        tempo:revised.midiData.tempoMap.map(event=>event.bpm),
        keys:revised.midiData.keySignatureMap.map(event=>event.sharps),
        exportedKeys:decoded.normalized.keySignatureMap?.map(event=>event.sharps)
      };
    });
    assert.deepEqual(reopened,{sourceNotes:[60],sourceMaterialNotes:[60],notes:[62],tempo:[100,75],keys:[2,3],exportedKeys:[2,3]},
      'material Key/BPM and modulation survive restart and MIDI export');

    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('Chromium: consent scopes, revocation across restore/reload, reservations, settlements, monthly cap and 3 vocal layers across archive restore verified');
  } finally {
    try {
      await context?.close();
    } finally {
      await rm(profile, {recursive: true, force: true});
    }
  }
}

verify().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
