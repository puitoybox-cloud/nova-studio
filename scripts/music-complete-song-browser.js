// Run against the production loopback host with the licensed Sinsy assets configured.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {chromium} = require('playwright');

const base = new URL(process.env.NOVA_SONG_ORIGIN || 'http://127.0.0.1:8878');
assert.equal(base.hostname, '127.0.0.1');
const title = '夜明けの窓';
const bars = 32, bpm = 104;
const lyrics = '窓を開けたら夜がほどける まだ名も知らない朝へ歩こう 風に預けた小さな願い 遠くの空にひかりが灯る';
const readings = [
  'ま ど を あ け た ら よ る が ほ ど け る',
  'ま だ な も し ら な い あ さ へ あ る こ う',
  'か ぜ に あ ず け た ち い さ な ね が い',
  'と お く の そ ら に ひ か り が と も る'
];
const lyricNotes = readings.join(' ').split(' ').length;
const sections = ['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Outro'];
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
    await panel.locator('#aiSongBpm').fill(String(bpm));
    await panel.locator('#aiSongKey').fill('C');
    await panel.locator('#aiSongBars').fill(String(bars));
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

    const id = await page.evaluate(async ({title, readings}) => {
      const app = MusicStudio, editor = MusicStudioEditor, session = app.state.midiEditor;
      const p = app.state.projects.find(p => p.projectName === title);
      const score = {melody:[],piano:[],bass:[],drums:[]};
      const add = (track, pitch, tick, duration, velocity) =>
        score[track].push({pitch, startTick:tick, durationTicks:duration, velocity});
      const C=[48,60,64,67], G=[43,59,62,67], Am=[45,57,60,64], F=[41,57,60,65],
        Dm=[50,57,62,65], Em=[52,59,64,67], G7=[43,59,62,65];
      const progression=[
        C,G,Am,F, C,Em,Am,F,Dm,Am,F,G,
        F,G,Em,Am,Dm,F,Dm,G7, C,G,Am,F,C,G,F,C,
        Am,F,G7,C
      ];
      const phrases=[
        {bar:4, pitches:[60,62,64,64,67,64,62,60,62,64,65,64,62,60]},
        {bar:8, pitches:[62,64,65,65,69,67,64,64,65,69,67,65,62,62,67]},
        {bar:12,pitches:[65,67,69,67,67,71,69,67,64,67,71,69,72,69]},
        {bar:20,pitches:[72,71,67,64,62,67,71,72,72,69,67,69,65,64]}
      ];
      const phraseTicks=[0,480,960,1440,1920,2400,2880,3360,3840,4320,4800,5280,5760,6240,6720];
      phrases.forEach(({bar,pitches},i)=>{
        if(pitches.length!==readings[i].split(' ').length)throw Error('lyric fixture length');
        pitches.forEach((pitch,j)=>{
          const duration=j===pitches.length-1?720:j%4===3?340:430;
          add('melody',pitch,bar*1920+phraseTicks[j],duration,79+(i===3?12:0)+(j%4===0?6:0));
        });
      });
      for(const [bar,[root,...voicing]] of progression.entries()){
        const tick=bar*1920, chorus=bar>=20&&bar<28, verse=bar>=4&&bar<12, sparse=bar<4||bar>=28;
        if(chorus){
          for(const offset of [0,720,1440])for(const pitch of voicing)add('piano',pitch,tick+offset,offset===1440?450:680,62);
        }else{
          const arpeggio=[0,1,2,1,0,2,1,2];
          for(let step=0;step<(bar===31?4:8);step++)add('piano',voicing[arpeggio[step]],tick+step*240,320,step%2?47:58);
        }
        for(const offset of sparse?[0]:chorus?[0,720,960,1440]:[0,960])
          add('bass',root,tick+offset,offset===0&&sparse?1840:offset===0&&!chorus?880:220,chorus?79:67);
        if(!sparse){
          for(let step=0;step<8;step++)add('drums',42,tick+step*240,130,(step%2?42:59)+(chorus?10:0));
          for(const offset of chorus?[0,720,960]:[0,960])add('drums',36,tick+offset,150,chorus?92:76);
          for(const offset of [480,1440])add('drums',verse?37:38,tick+offset,160,chorus?87:66);
        }
      }
      for(const [track,notes] of Object.entries(score))editor.addNotesToTrack(session,track,notes);
      const r = await app.saveMidiEditor();
      if (!r.ok) throw Error(r.error || r.message);
      return p.projectId;
    }, {title,readings});
    await page.evaluate(async id => {await MusicStudio.productionOpenAction('assistant',id)},id);
    await page.locator('#musicAIInstruction').fill('曲を完成させる手順');
    await panel.getByRole('button', {name: 'Preview（確認）', exact: true}).click();
    const guide = page.locator('.music-ai-production-guide');
    await guide.getByRole('status').filter({hasText:/歌詞の読み/}).waitFor();
    await guide.getByRole('button', {name: '日本語歌詞を割り付ける'}).click();
    await page.locator('#musicLyricsForm [name=trackId]').selectOption('melody');
    await page.locator('#musicLyricsForm [name=toNote]').fill(String(lyricNotes));
    await page.locator('#musicLyricsForm [name=text]').fill(lyrics);
    await page.locator('#musicLyricsForm [name=reading]').fill(readings.join(' '));
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
    console.error('MIDI and lyric playback verified. Rendering vocals and final audio.');
    const report = await page.evaluate(async ({id,bars,bpm}) => {
      const app = MusicStudio, project = () => app.state.projects.find(p => p.projectId === id);
      const ok = r => {if (!r?.ok) throw Error(r?.error || r?.message || JSON.stringify(r));return r};
      const stats = async blob => {
        let frames=0,rate=0,peak=0;
        for await(const pcm of app.pcmDecodeWavStream(blob)){
          rate=pcm.sampleRate;
          frames+=pcm.channels[0].length;
          for(const channel of pcm.channels)for(const sample of channel)peak=Math.max(peak,Math.abs(sample));
        }
        if (peak <= .001) throw Error('silent audio');
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),
          n => n.toString(16).padStart(2,'0')).join('');
        return {hash,peak,bytes:blob.size,frames,rate};
      };
      const record = project().syllableAssignments[0];
      const {assetId} = ok(await app.generateLocalScoreVocal(id,record.id));
      const take = project().longWavAssets.find(a => a.id === assetId);
      const source=await app.pcmLoadLongWav(id,assetId);
      const introFrames = Math.round(take.sampleRate * 4 * 4 * 60 / bpm);
      let vocalFrame=0,verseAudible=false;
      for await(const chunk of app.pcmDecodeWavStream(source)){
        for(const sample of chunk.channels[0]){
          if(vocalFrame<introFrames-take.sampleRate&&Math.abs(sample)>.01)throw Error('vocal covers the intro');
          if(vocalFrame>=introFrames&&vocalFrame<introFrames+take.sampleRate&&Math.abs(sample)>.01)verseAudible=true;
          vocalFrame++;
        }
        if(vocalFrame>=introFrames+take.sampleRate)break;
      }
      if(!verseAudible)throw Error('vocal missed the first verse');
      const end = Math.min(take.frames,Math.round(take.sampleRate * bars * 4 * 60 / bpm));
      ok(await app.vocalEdit(id,assetId,{...take.vocalTake.edits[0],gainDb:-3,end}));
      const vocal = await stats((await app.vocalRender(id,assetId)).blob);
      const effects = [];
      for(const kind of ['double']){
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
      const readers=['Mix.wav','Vocal-Stem.wav','Instrumental.wav'].map(name=>app.pcmDecodeWavStream(file(name)));
      for(;;){
        const [mixChunk,voiceChunk,instrumentChunk]=await Promise.all(readers.map(reader=>reader.next()));
        if(mixChunk.done&&voiceChunk.done&&instrumentChunk.done)break;
        if(mixChunk.done||voiceChunk.done||instrumentChunk.done)throw Error('stem length mismatch');
        mixChunk.value.channels.forEach((channel,c)=>{
          if(!channel.every((sample,n)=>Math.abs(sample-voiceChunk.value.channels[c][n]-instrumentChunk.value.channels[c][n])<=2/32768))
            throw Error('vocal and instruments do not sum to mix');
        });
      }
      ok(await app.finalListen(id,'Master.wav'));
      await new Promise(resolve => setTimeout(resolve,180));
      if (!app.finalExport.audio || app.finalExport.audio.currentTime<=0) throw Error('master transport did not advance');
      app.finalStop();
      if(master.frames/master.rate < bars*4*60/bpm-0.5)throw Error('short master');
      const midi = new Uint8Array(await file('Song.mid').arrayBuffer());
      const parsed = MusicStudioMidiParser.parseMidiFile(midi.buffer);
      if (!parsed.validation.ok) throw Error('invalid MIDI output');
      ok(await app.finalSave(id));
      return {vocal,effects,instruments,master,mix,vocalStem,instrumental,
        midiBytes:midi.length,midiTracks:project().midiData.tracks.map(t=>({id:t.id,notes:t.notes.length})),
        metrics:candidate.manifest.after,revision:project().revision};
    }, {id,bars,bpm});
    console.error('Final audio rendered. Verifying delivery, restart and recovery.');
    const downloadPromise = page.waitForEvent('download');
    const delivery = await page.evaluate(id => MusicStudio.finalDownload(id,'Master.wav'),id);
    assert.equal(delivery.ok,true,delivery.error);
    const download = await downloadPromise;
    const output = await fs.readFile(await download.path());
    assert.equal(require('node:crypto').createHash('sha256').update(output).digest('hex'),report.master.hash);
    if(process.env.NOVA_SONG_OUTPUT) await fs.writeFile(process.env.NOVA_SONG_OUTPUT,output);
    await context.close();
    page = await open('#music-studio/mixing-export/'+id);
    const recovery = await page.evaluate(async ({id,report,lyricNotes}) => {
      const app = MusicStudio, p = app.state.projects.find(p => p.projectId === id);
      if (!p || p.revision<report.revision || p.syllableAssignments[0]?.assignments.length!==lyricNotes ||
          !p.finalExportDeliveries?.length || p.longWavAssets.length!==6) throw Error('restart lost song state');
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
    },{id,report,lyricNotes});
    assert.deepEqual(pageErrors,[]);
    assert.deepEqual(external,[]);
    console.log(JSON.stringify({title, bpm, key:'C', bars, sections, playbackTracks, report, recovery},null,2));
  } finally {
    await context?.close();
    await fs.rm(profile,{recursive:true,force:true});
  }
}
run().catch(error => { console.error(error); process.exitCode=1; });
