// Run against the production loopback host with the licensed Sinsy assets configured.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {chromium} = require('playwright');

const base = new URL(process.env.NOVA_SONG_ORIGIN || 'http://127.0.0.1:8878');
assert.equal(base.hostname, '127.0.0.1');
const title = '朝のひかり';
const launchOptions = {
  headless: true, viewport: {width: 1440, height: 1000},
  args: ['--autoplay-policy=no-user-gesture-required'],
  ...(process.env.CHROME_EXECUTABLE ? {executablePath: process.env.CHROME_EXECUTABLE} : {})
};

async function run() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'nova-song-'));
  let context;
  const external = [], pageErrors = [];
  async function open(hash = '') {
    context = await chromium.launchPersistentContext(profile, launchOptions);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === base.origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
      external.push(url.href);
      return route.abort();
    });
    const page = context.pages()[0];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(new URL('/music-studio.html' + hash, base).href);
    await page.waitForFunction(() => MusicStudio.state.loaded);
    return page;
  }
  try {
    let page = await open('#music-studio/new-project');
    await page.locator('#msProjectName').fill('制作工程テストの作業場');
    await page.getByRole('button', {name: '作成して保存', exact: true}).click();
    await page.waitForFunction(() => MusicStudio.state.projects.some(p => p.projectName === '制作工程テストの作業場'));
    const seed = await page.evaluate(() =>
      MusicStudio.state.projects.find(p => p.projectName === '制作工程テストの作業場').projectId);
    await page.goto(new URL('/music-studio.html#music-studio/ai-editor/'+seed,base).href);
    const newSong = page.locator('.music-ai-panel').getByRole('button', {name:'New Song（新しい曲）'});
    await newSong.click({timeout:5000}).catch(async error => {
      console.error(await page.evaluate(()=>({hash:location.hash,body:document.body.innerText.slice(0,2600),panel:!!window.MusicStudioAIAssistantPanel,
        editor:MusicStudio.state.midiEditor?.projectId,projects:MusicStudio.state.projects.map(p=>p.projectId)})));
      throw error;
    });
    const panel = page.locator('.music-ai-panel');
    await panel.locator('#aiSongTitle').fill(title);
    await panel.locator('#aiSongBpm').fill('120');
    await panel.locator('#aiSongKey').fill('C');
    await panel.locator('#aiSongBars').fill('2');
    await panel.locator('#aiSongTracks').fill('melody, drums, bass, piano');
    await panel.getByRole('button', {name: 'Preview（確認）', exact: true}).click();
    const request = panel.getByRole('button', {name: 'Confirmして新規作成'});
    const approval = panel.getByRole('group', {name: '実行前の承認'});
    await request.click();
    await approval.getByRole('button', {name: '拒否', exact: true}).click();
    assert.equal(await page.evaluate(async () => (await MusicStudio.indexedDbRepository().list()).length), 1);
    await panel.getByRole('button', {name: 'Preview（確認）', exact: true}).click();
    await request.click();
    await approval.getByRole('button', {name: '取消', exact: true}).click();
    assert.equal(await page.evaluate(async () => (await MusicStudio.indexedDbRepository().list()).length), 1);
    await request.click();
    await approval.getByRole('button', {name: '承認して実行'}).click();
    await page.waitForFunction(name => MusicStudio.state.projects.some(p => p.projectName === name &&
      MusicStudio.state.midiEditor?.projectId === p.projectId), title);

    const id = await page.evaluate(async name => {
      const app = MusicStudio, editor = MusicStudioEditor, session = app.state.midiEditor;
      const p = app.state.projects.find(p => p.projectName === name);
      const add = (trackId, pitch, startTick, durationTicks, velocity) =>
        editor.addNotesToTrack(session, trackId, [{pitch, startTick, durationTicks, velocity}]);
      [60,64,67,64,65,64,62,60].forEach((pitch, i) => add('melody', pitch, i*480, 480, 80));
      [[60,64,67],[65,69,72],[55,59,62],[60,64,67]].forEach((chord, i) => {
        for (const pitch of chord) add('piano', pitch, i*960, 900, 55);
        add('bass', chord[0]-24, i*960, 860, 70);
      });
      session.candidates.drums = editor.makeDrumCandidate(session, 'basic', 2);
      editor.applyCandidate(session, 'drums');
      const r = await app.saveMidiEditor();
      if (!r.ok) throw Error(r.error || r.message);
      return p.projectId;
    }, title);
    await page.evaluate(async id => {await MusicStudio.productionOpenAction('assistant',id)},id);
    await page.locator('#musicAIInstruction').fill('曲を完成させる手順');
    await panel.getByRole('button', {name: 'Preview（確認）', exact: true}).click();
    const guide = page.locator('.music-ai-production-guide');
    await guide.getByRole('status').filter({hasText:/歌詞の読み/}).waitFor();
    await guide.getByRole('button', {name: '日本語歌詞を割り付ける'}).click();
    await page.locator('#musicLyricsForm [name=trackId]').selectOption('melody');
    await page.locator('#musicLyricsForm [name=toNote]').fill('8');
    await page.locator('#musicLyricsForm [name=text]').fill('朝の光だよ');
    await page.locator('#musicLyricsForm [name=reading]').fill('あ さ の ひ か り だ よ');
    await page.getByRole('button', {name: 'Preview（割付を確認）'}).click();
    await page.getByRole('button', {name: 'Apply / Save（採用・保存）'}).click();
    await page.waitForFunction(id => MusicStudio.state.projects.find(p => p.projectId === id).syllableAssignments.length === 1, id);

    await page.evaluate(id => MusicStudio.openMidiEditor(id),id);
    await page.waitForFunction(id => MusicStudio.state.midiEditor?.projectId === id,id);
    const playbackTracks = await page.evaluate(async () => {
      const playback = await MusicStudio.editorPlayMelody();
      if (!playback.ok || !playback.scheduledNotes.length) throw Error('MIDI playback unavailable');
      const ids = [...new Set(playback.scheduledNotes.filter(note=>note.audible).map(note=>note.trackId))];
      MusicStudio.editorStopMelody();
      return ids.sort();
    });
    assert.deepEqual(playbackTracks,['bass','drums','melody','piano']);
    const report = await page.evaluate(async id => {
      const app = MusicStudio, project = () => app.state.projects.find(p => p.projectId === id);
      const ok = r => {if (!r?.ok) throw Error(r?.error || r?.message || JSON.stringify(r));return r};
      const stats = async blob => {
        const bytes = await blob.arrayBuffer(), audio = app.pcmDecodeWav(bytes);
        const peak = audio.channels.reduce((max, c) => c.reduce((m,s) => Math.max(m,Math.abs(s)),max),0);
        if (peak <= .001) throw Error('silent audio');
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
          n => n.toString(16).padStart(2,'0')).join('');
        return {hash,peak,bytes:bytes.byteLength,frames:audio.channels[0].length,rate:audio.sampleRate};
      };
      const record = project().syllableAssignments[0];
      const {assetId} = ok(await app.generateLocalScoreVocal(id,record.id));
      const take = project().longWavAssets.find(a => a.id === assetId);
      const source = app.pcmDecodeWav(await (await app.pcmLoadLongWav(id,assetId)).arrayBuffer());
      const early = source.channels[0].slice(0,Math.round(take.sampleRate*.4));
      if (!early.some(sample => Math.abs(sample)>.01)) throw Error('vocal starts after the first beat');
      const end = Math.min(take.frames,Math.round(take.sampleRate*4.15));
      ok(await app.vocalEdit(id,assetId,{...take.vocalTake.edits[0],gainDb:-3,end}));
      const vocal = await stats((await app.vocalRender(id,assetId)).blob);
      const effects = [];
      for(const kind of ['harmony','double','chorus']){
        const layer = ok(await app.vocalLayerSave(id,assetId,kind,4));
        effects.push({kind,id:layer.assetId,...await stats((await app.vocalRender(id,layer.assetId)).blob)});
      }
      const stems = ok(await app.midiRenderStems(id,['melody','drums','bass','piano'])).completed;
      const instruments = [];
      for (const stem of stems) instruments.push({...stem,...await stats(await app.pcmLoadLongWav(id,stem.assetId))});
      const route = (id,role,gainDb) => ({key:'wav:'+id,role,gainDb,startSeconds:0,muted:false});
      const plan = {format:'nova-final-export-plan-v1',includeMidi:true,targetLufs:-18,ceilingDb:-1,routes:[
        ...effects.map(e => route(e.id,'vocal',-17)),route(assetId,'vocal',-3),
        ...stems.map(s => route(s.assetId,'instrument',s.trackId==='melody'?-15:-9))
      ]};
      const candidate = ok(await app.finalPreview(id,plan)).candidate;
      const file = name => candidate.files.find(f => f.name === name).blob;
      const master = await stats(file('Master.wav')), mix = await stats(file('Mix.wav'));
      const vocalStem = await stats(file('Vocal-Stem.wav')), instrumental = await stats(file('Instrumental.wav'));
      const decode = async name => app.pcmDecodeWav(await file(name).arrayBuffer()).channels[0];
      const [m,v,i] = await Promise.all(['Mix.wav','Vocal-Stem.wav','Instrumental.wav'].map(decode));
      if (!m.every((sample, n) => Math.abs(sample-v[n]-i[n])<=2/32768)) throw Error('vocal and instruments do not sum to mix');
      ok(await app.finalListen(id,'Master.wav'));
      await new Promise(resolve => setTimeout(resolve,180));
      if (!app.finalExport.audio || app.finalExport.audio.currentTime<=0) throw Error('master transport did not advance');
      app.finalStop();
      const midi = new Uint8Array(await file('Song.mid').arrayBuffer());
      const parsed = MusicStudioMidiParser.parseMidiFile(midi.buffer);
      if (!parsed.validation.ok) throw Error('invalid MIDI output');
      ok(await app.finalSave(id));
      return {vocal,effects,instruments,master,mix,vocalStem,instrumental,
        midiBytes:midi.length,midiTracks:project().midiData.tracks.map(t=>({id:t.id,notes:t.notes.length})),
        metrics:candidate.manifest.after,revision:project().revision};
    }, id);
    const downloadPromise = page.waitForEvent('download');
    const delivery = await page.evaluate(id => MusicStudio.finalDownload(id,'Master.wav'),id);
    assert.equal(delivery.ok,true,delivery.error);
    const download = await downloadPromise;
    const output = await fs.readFile(await download.path());
    assert.equal(require('node:crypto').createHash('sha256').update(output).digest('hex'),report.master.hash);
    if(process.env.NOVA_SONG_OUTPUT) await fs.writeFile(process.env.NOVA_SONG_OUTPUT,output);
    await context.close();
    page = await open('#music-studio/mixing-export/'+id);
    const recovery = await page.evaluate(async ({id,report}) => {
      const app = MusicStudio, p = app.state.projects.find(p => p.projectId === id);
      if (!p || p.revision<report.revision || p.syllableAssignments[0]?.assignments.length!==8 ||
          !p.finalExportDeliveries?.length || p.longWavAssets.length!==8) throw Error('restart lost song state');
      const archive = await app.createLongWavArchive();
      const restored = await app.restoreLongWavArchive(archive,{settings:false});
      if (!restored.ok) throw Error(restored.error);
      const copy = restored.projects.find(x => x.projectId!==id && x.songTitle===p.songTitle);
      if (!copy || JSON.stringify(copy.midiData)!==JSON.stringify(p.midiData)) throw Error('archive lost MIDI');
      const candidate = await app.finalPreview(copy.projectId,copy.finalExportPlan);
      if (!candidate.ok) throw Error(candidate.error);
      const master = candidate.candidate.files.find(f=>f.name==='Master.wav').blob;
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await master.arrayBuffer())),
        n=>n.toString(16).padStart(2,'0')).join('');
      if (hash!==report.master.hash) throw Error('restored master differs');
      return {archiveBytes:archive.size,hash,assets:copy.longWavAssets.length};
    },{id,report});
    assert.deepEqual(pageErrors,[]);
    assert.deepEqual(external,[]);
    console.log(JSON.stringify({title, bpm:120, key:'C', bars:2, playbackTracks, report, recovery},null,2));
  } finally {
    await context?.close();
    await fs.rm(profile,{recursive:true,force:true});
  }
}
run().catch(error => { console.error(error); process.exitCode=1; });
