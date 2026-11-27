'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');

const base=process.env.MUSIC_STUDIO_URL||'http://127.0.0.1:8765/music-studio.html';

async function run(){
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
  const page=await browser.newPage({acceptDownloads:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin===new URL(base).origin||['data:','blob:'].includes(url.protocol)?route.continue():route.abort();
  });
  try{
    await page.goto(base);
    await page.waitForFunction(()=>window.MusicStudio?.state.loaded);
    await page.evaluate(async()=>{
      const app=MusicStudio,repo=app.indexedDbRepository();
      let song=app.makeProject({projectId:'release-review',projectName:'Release review',bpm:120,midiData:{
        ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},
        tracks:[{id:'lead',channel:1,name:'Lead',notes:[{id:'n1',pitch:67,startTick:0,durationTicks:480,velocity:78}]}]
      }});
      const chord=[196,246.942,293.665].map(frequency=>Array.from({length:36000},(_,frame)=>{
        const time=frame/48000;
        return .026*Math.sin(2*Math.PI*frequency*time)*Math.min(1,time/.04,(.75-time)/.14);
      }));
      song=app.pcmImport(song,{sampleRate:48000,channels:[chord[0].map((sample,index)=>sample+chord[1][index]+chord[2][index])]},'Original chord.wav');
      song=app.pcmImport(song,{sampleRate:48000,channels:[chord[2]]},'Muted guide.wav');
      await repo.put(song);
      app.setRepository(repo);
      app.state.projects=[song];
      app.pcmOpen(song.projectId);
    });
    const panel=page.locator('.music-final-export'),routes=panel.locator('[data-final-route]');
    await routes.nth(0).locator('[name=enabled]').check();
    await routes.nth(1).locator('[name=enabled]').check();
    await routes.nth(1).locator('[name=muted]').check();
    await panel.locator('[name=midi]').check();
    await panel.getByText('配信前の権利申告',{exact:true}).click();
    await panel.getByLabel('配信用として申告を確認する').check();
    const before=await page.evaluate(async()=>JSON.stringify(await MusicStudio.indexedDbRepository().get('release-review')));
    const preview=panel.getByRole('button',{name:'Preview（ミックス候補を作成）',exact:true});
    const message=panel.locator('[data-release-status]');
    const declarations=panel.locator('[data-release-key]');
    await preview.click();
    await message.getByText(/権利申告.*Original chord/).waitFor();
    await declarations.nth(0).getByLabel('利用範囲').selectOption('internal');
    await preview.click();
    await message.getByText(/配信用に使えない素材/).waitFor();
    async function declare(row,ref){
      await row.getByLabel('利用範囲').selectOption('release');
      await row.getByLabel('許諾・出典の識別子').fill(ref);
    }
    await declare(declarations.nth(0),'fixture-original-audio');
    await preview.click();
    await message.getByText(/権利申告.*MIDI/).waitFor();
    await declare(panel.locator('[data-release-key="midi"]'),'fixture-original-midi');
    await preview.click();
    await message.getByText(/権利申告.*依存物/).waitFor();
    assert.equal(await page.evaluate(async()=>JSON.stringify(await MusicStudio.indexedDbRepository().get('release-review'))),before);
    assert.equal(await page.evaluate(()=>MusicStudio.finalExport.candidate),null);
    await declare(panel.locator('[data-release-key="dependencies"]'),'fixture-generated-pcm-no-external-assets');
    await preview.click();
    await page.waitForFunction(()=>MusicStudio.finalExport.candidate?.manifest.audit.userDeclarationsRecorded);
    const downloadPromise=page.waitForEvent('download');
    await panel.getByRole('button',{name:'Manifest.json（書き出し）',exact:true}).click();
    const download=await downloadPromise;
    const manifest=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
    assert.equal(manifest.audit.distributionReady,false);
    assert.deepEqual(Object.values(manifest.plan.releaseDeclarations).map(row=>row.reference),
      ['fixture-original-audio','fixture-original-midi','fixture-generated-pcm-no-external-assets']);
    assert.equal(manifest.audit.packageValid,true);
    assert.ok(Number.isFinite(manifest.after.lufs)&&manifest.after.truePeakDb<=-1);
    await page.waitForFunction(()=>!MusicStudio.finalExport.busy);
    await panel.getByRole('button',{name:'Save（設定・履歴を保存）',exact:true}).click();
    await page.waitForFunction(()=>MusicStudio.state.projects[0].finalExportHistory?.length===1);
    const replay=await page.evaluate(()=>{
      const app=MusicStudio,p=app.state.projects[0];
      return app.finalReplay(p.projectId,p.finalExportHistory[0].id);
    });
    assert.equal(replay.ok,false);
    assert.match(replay.error,/権利申告を再確認/);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({releaseMissingBlocked:true,internalOnlyBlocked:true,
      midiAndDependenciesRequired:true,manifestDeclarations:3,replayRequiresReview:true,
      lufs:manifest.after.lufs,truePeakDb:manifest.after.truePeakDb}));
  }finally{await browser.close()}
}
run().catch(error=>{console.error(error);process.exitCode=1});
