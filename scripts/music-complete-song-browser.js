// Run against the production loopback host with the licensed Sinsy assets configured.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {chromium} = require('playwright');

const base = new URL(process.env.NOVA_SONG_ORIGIN || 'http://127.0.0.1:8878');
assert.equal(base.hostname, '127.0.0.1');
const title = '光の向こうへ';
const bars = 40, bpm = 128;
const verses = [
  [
    "風が止んだ交差点",
    "か ぜ が や ん だ こ う さ て ん ~"
  ],
  [
    "握りしめた地図をひらく",
    "に ぎ り し め た ち ず を ひ ら く ~"
  ],
  [
    "消えかけた星が呼んでる",
    "き え か け た ほ し が よ ん で る ~"
  ],
  [
    "靴の底で夜を蹴った",
    "く つ の そ こ で よ る を け っ た ~"
  ],
  [
    "傷だらけのこの両手で",
    "き ず だ ら け の こ の りょ う て で ~"
  ],
  [
    "こぼれそうな夢を集め",
    "こ ぼ れ そ う な ゆ め を あ つ め ~ ~"
  ],
  [
    "君の声が届くほうへ",
    "き み の こ え が と ど く ほ う へ ~"
  ],
  [
    "怖いままで走り出すよ",
    "こ わ い ま ま で は し り だ す よ ~ ~"
  ],
  [
    "光の向こうへ駆けて",
    "ひ か り の む こ う へ か け て ~ ~"
  ],
  [
    "涙も連れてゆくから",
    "な み だ も つ れ て ゆ く か ら ~ ~"
  ],
  [
    "ふたりで描いた空を",
    "ふ た り で え が い た そ ら を ~ ~"
  ],
  [
    "この手で明日へつなぐよ",
    "こ の て で あ し た へ つ な ぐ よ ~ ~"
  ],
  [
    "光の向こうへ駆けて",
    "ひ か り の む こ う へ か け て ~ ~"
  ],
  [
    "もう一度君に会うまで",
    "も う い ち ど き み に あ う ま で ~"
  ],
  [
    "何度でも風を追い越す",
    "な ん ど で も か ぜ を お い こ す ~"
  ],
  [
    "いま僕らの朝が始まる",
    "い ま ぼ く ら の あ さ が は じ ま る ~"
  ],
  [
    "ほどけた夜の片隅に",
    "ほ ど け た よ る の か た す み に ~"
  ],
  [
    "君の名前を残した",
    "き み の な ま え を の こ し た ~ ~"
  ]
];
const readings = verses.map(([,reading]) => reading);
const lyricNotes = readings.join(' ').split(' ').length;
const harmonyVerses = verses.slice(8,16);
const sections = ['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Final chorus', 'Outro'];
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
    await panel.locator('#aiSongKey').fill('D');
    await panel.locator('#aiSongBars').fill(String(bars));
    await panel.locator('#aiSongTracks').fill('melody, drums, bass, piano, strings, harmony');
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
      const score = {melody:[],piano:[],bass:[],drums:[],strings:[],harmony:[]};
      const add = (track, pitch, tick, duration, velocity) =>
        score[track].push({pitch, startTick:tick, durationTicks:duration, velocity});
      const chords = {
        D:[38,57,62,66], A:[45,57,61,64], Bm:[47,54,59,62],
        G:[43,55,59,62], Em:[40,55,59,64], Fsm:[42,54,57,61],
        Gm:[43,55,58,62], Asus:[45,57,62,64]
      };
      const progression = [
        'D','A','Bm','G',
        'Bm','G','D','A','Bm','G','Em','A',
        'G','A','Fsm','Bm','Em','G','Asus','A',
        'D','A','Bm','G','D','A','G','A',
        'D','A','Bm','G','Em','Fsm','G','A',
        'Bm','G','Gm','D'
      ];
      // Each pair is [beat within the bar, MIDI pitch]. Motif returns in the second chorus.
      const phrases = [
        [4,[[0,66],[.5,66],[1,64],[1.5,62],[2.5,66],[3,69]],[[0,67],[.5,66],[1,62],[2,59],[2.5,62],[3,64]]],
        [6,[[.5,66],[1,69],[1.5,66],[2,64],[2.5,62],[3,66]],[[0,64],[.5,61],[1,64],[1.5,66],[2,69],[2.5,64],[3,61]]],
        [8,[[0,66],[.5,66],[1,64],[1.5,62],[2.5,66],[3,69]],[[0,67],[.5,66],[1,62],[1.5,64],[2,67],[2.5,69],[3,71]]],
        [10,[[.5,71],[1,67],[1.5,64],[2,67],[2.5,69],[3,71]],[[0,73],[.5,71],[1,69],[1.5,66],[2,64],[2.5,66],[3,69]]],
        [12,[[0,67],[.5,69],[1,71],[1.5,74],[2.5,71],[3,69]],[[0,69],[.5,71],[1,73],[1.5,76],[2,73],[2.5,71],[3,69]]],
        [14,[[0,69],[.5,73],[1,76],[1.5,73],[2,69],[2.5,71],[3,73]],[[0,74],[.5,73],[1,71],[1.5,69],[2,66],[2.5,69],[3,71]]],
        [16,[[0,71],[.5,67],[1,64],[1.5,67],[2.5,71],[3,74]],[[0,74],[.5,71],[1,67],[1.5,69],[2,71],[2.5,74],[3,76]]],
        [18,[[0,76],[.5,74],[1,72],[1.5,74],[2,76],[2.5,74],[3,71]],[[0,73],[.5,71],[1,69],[1.5,71],[2,73],[2.5,76],[3,76]]],
        [20,[[0,78],[1,76],[1.5,74],[2,73],[2.5,74],[3,76]],[[0,76],[.5,73],[1,69],[1.5,71],[2,73],[2.5,74],[3,76]]],
        [22,[[0,78],[1,76],[1.5,74],[2,71],[2.5,74],[3,76]],[[0,74],[.5,71],[1,67],[1.5,69],[2,71],[2.5,74],[3,76]]],
        [24,[[0,78],[1,76],[1.5,74],[2,73],[2.5,74],[3,76]],[[0,81],[.5,78],[1,76],[1.5,73],[2,76],[2.5,78],[3,76]]],
        [26,[[0,74],[.5,71],[1,67],[1.5,69],[2,71],[2.5,74],[3,76]],[[0,76],[.5,74],[1,73],[1.5,71],[2,73],[2.5,76],[3,78]]],
        [28,[[0,78],[1,76],[1.5,74],[2,73],[2.5,74],[3,76]],[[0,76],[.5,73],[1,69],[1.5,71],[2,73],[2.5,74],[3,76]]],
        [30,[[0,78],[1,76],[1.5,74],[2,71],[2.5,74],[3,76]],[[0,74],[.5,71],[1,67],[1.5,69],[2,71],[2.5,74],[3,76]]],
        [32,[[0,79],[1,78],[1.5,76],[2,74],[2.5,76],[3,78]],[[0,81],[.5,78],[1,76],[1.5,73],[2,76],[2.5,78],[3,81]]],
        [34,[[0,79],[.5,78],[1,74],[1.5,71],[2,74],[2.5,76],[3,78]],[[0,76],[.5,74],[1,73],[1.5,71],[2,69],[2.5,71],[3,73]]],
        [36,[[0,74],[1,71],[1.5,69],[2,66],[2.5,69],[3,71]],[[0,74],[.5,71],[1,67],[1.5,69],[2,71],[2.5,74],[3,74]]],
        [38,[[0,74],[1,70],[1.5,67],[2,69],[2.5,70],[3,74]],[[0,74],[.5,73],[1,69],[1.5,66],[2,64],[2.5,66],[3,62]]]
      ];
      phrases.forEach(([bar,...measures],i)=>{
        if(measures.flat().length!==readings[i].split(' ').length)throw Error('lyric fixture length at phrase '+(i+1));
        measures.forEach((notes, offset)=>notes.forEach(([beat,pitch],j)=>{
          const tick=(bar+offset)*1920+beat*480;
          const duration=Math.round(((notes[j+1]?.[0]??4)-beat)*480)-(j===notes.length-1?72:28);
          add('melody',pitch,tick,duration,(bar>=20?88:76)+(beat%1===0?6:0));
          if(bar>=20&&bar<36){
            const majorScale=[1,2,4,6,7,9,11],thirdBelow=majorScale.includes((pitch-3)%12)?pitch-3:pitch-4;
            add('harmony',thirdBelow,tick,duration,68);
          }
        }));
      });
      for(const [bar,name] of progression.entries()){
        const [root,...voicing]=chords[name],tick=bar*1920,chorus=bar>=20&&bar<36,verse=bar>=4&&bar<12;
        if(chorus){
          for(const offset of [0,720,1440])for(const pitch of voicing)
            add('piano',pitch+12,tick+offset,offset===1440?420:580,offset===0?72:61);
        }else{
          const arpeggio=[0,1,2,1,0,2,1,2];
          for(let step=0;step<(bar===39?4:8);step++)
            add('piano',voicing[arpeggio[step]]+12,tick+step*240,300,step%2?47:59);
        }
        if(bar>=12&&bar<38) for(const pitch of voicing)
          add('strings',pitch,tick+30,1820,chorus?58:43);
        for(const offset of chorus?[0,720,960,1440,1680]:bar<4||bar>=38?[0]:[0,960,1440])
          add('bass',offset===1680?root+12:root,tick+offset,chorus?210:offset===0?820:400,chorus?84:68);
        if(bar>=4&&bar<38){
          if([12,20,28,32].includes(bar))add('drums',49,tick,390,92);
          for(let step=0;step<8;step++)add('drums',step===7&&chorus?46:42,tick+step*240,120,(step%2?42:61)+(chorus?10:0));
          for(const offset of chorus?[0,720,960,1680]:[0,960])add('drums',36,tick+offset,150,chorus?94:75);
          for(const offset of [480,1440])add('drums',verse?37:38,tick+offset,155,chorus?91:66);
          if([11,19,27,35].includes(bar))for(const [i,pitch] of [45,47,50].entries())
            add('drums',pitch,tick+1560+i*120,104,66+i*7);
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
    async function assignLyrics(trackId, lines){
      const form = page.locator('#musicLyricsForm');
      const reading = lines.map(([,value]) => value).join(' ');
      await form.locator('[name=trackId]').selectOption(trackId);
      await form.locator('[name=fromNote]').fill('1');
      await form.locator('[name=toNote]').fill(String(reading.split(' ').length));
      await form.locator('[name=text]').fill(lines.map(([text]) => text).join(' '));
      await form.locator('[name=reading]').fill(reading);
      await page.getByRole('button', {name: 'Preview（割付を確認）'}).click();
      await page.getByRole('button', {name: 'Apply / Save（採用・保存）'}).click();
      await page.waitForFunction(({id,trackId}) => MusicStudio.state.projects.find(p => p.projectId === id)
        .syllableAssignments.some(record => record.trackId === trackId), {id,trackId});
    }
    await assignLyrics('melody',verses);
    await assignLyrics('harmony',harmonyVerses);

    await page.evaluate(id => MusicStudio.openMidiEditor(id),id);
    await page.waitForFunction(id => MusicStudio.state.midiEditor?.projectId === id,id);
    const playbackTracks = await page.evaluate(async () => {
      const playback = await MusicStudio.editorPlayMelody();
      if (!playback.ok || !playback.scheduledNotes.length) throw Error('MIDI playback unavailable');
      const ids = [...new Set(playback.scheduledNotes.filter(note=>note.audible).map(note=>note.trackId))];
      MusicStudio.editorStopMelody();
      return ids.sort();
    });
    assert.deepEqual(playbackTracks,['bass','drums','harmony','melody','piano','strings']);
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
      const record = project().syllableAssignments.find(row=>row.trackId==='melody');
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
      const harmonyRecord = project().syllableAssignments.find(row=>row.trackId==='harmony');
      const harmony = ok(await app.generateLocalScoreVocal(id,harmonyRecord.id,{startMeasure:21,endMeasure:36}));
      const effects = [{kind:'score-harmony',id:harmony.assetId,...await stats((await app.vocalRender(id,harmony.assetId)).blob)}];
      const stems = ok(await app.midiRenderStems(id,['drums','bass','piano','strings'])).completed;
      const instruments = [];
      for (const stem of stems) instruments.push({...stem,...await stats(await app.pcmLoadLongWav(id,stem.assetId))});
      const route = (id,role,gainDb,balance=0) => ({key:'wav:'+id,role,gainDb,balance,startSeconds:0,muted:false});
      const settings = {drums:[-7,0],bass:[-6,0],piano:[-9,-.32],strings:[-12,.38]};
      const plan = {format:'nova-final-export-plan-v1',includeMidi:true,targetLufs:-15,ceilingDb:-1,routes:[
        route(harmony.assetId,'vocal',-13,.25),route(assetId,'vocal',0),
        ...stems.map(s => route(s.assetId,'instrument',...settings[s.trackId]))
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
      if(Math.abs(master.frames/master.rate-bars*4*60/bpm)>3)throw Error('unexpected master duration');
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
      if (!p || p.revision<report.revision || p.syllableAssignments.find(record=>record.trackId==='melody')?.assignments.length!==lyricNotes ||
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
    console.log(JSON.stringify({title, bpm, key:'D', bars, sections, playbackTracks, report, recovery},null,2));
  } finally {
    await context?.close();
    await fs.rm(profile,{recursive:true,force:true});
  }
}
run().catch(error => { console.error(error); process.exitCode=1; });
