// Offline synthetic audio in real Chrome. Physical acceptance remains separate.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),report=[];
const server=http.createServer((req,res)=>{const file=path.resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'music-studio.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res)});
const deadline=setTimeout(()=>{console.error('Final export browser deadline');process.exit(1)},240000);
(async()=>{let browser;try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required'],...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
for(const width of [1440,820,390]){const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true}),page=await context.newPage(),consoleMessages=[],external=[];const monitor=p=>{p.on('console',m=>{if(['error','warning'].includes(m.type()))consoleMessages.push(m.text())});p.on('pageerror',e=>consoleMessages.push(e.message));p.on('requestfailed',r=>consoleMessages.push(r.url()+': '+r.failure()?.errorText))};monitor(page);await context.route('**/*',r=>{if(r.request().url().startsWith(base+'/')||/^(data:|blob:)/.test(r.request().url()))return r.continue();external.push(r.request().url());return r.abort()});await page.goto(base+'/music-studio.html');await page.waitForFunction(()=>MusicStudio.state.loaded);
await page.evaluate(async()=>{const a=MusicStudio;let p=a.makeProject({projectId:'final-export-browser',projectName:'楽曲書き出し',bpm:120,midiData:{ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[{id:'lead',channel:1,name:'Piano',notes:[{id:'n1',pitch:60,startTick:0,durationTicks:480,velocity:80}]}]}});const tone=amp=>({sampleRate:48000,channels:[Array.from({length:24000},(_,i)=>amp*Math.sin(2*Math.PI*997*i/48000))]});p=a.pcmImport(p,tone(.02),'Piano.wav');const repo=a.indexedDbRepository();a.setRepository(repo);await repo.put(p);a.state.projects=[p];a.pcmOpen(p.projectId);const wav=a.pcmEncodeWav(tone(.01));const r=await a.pcmImportLongFile(new File([wav],'Voice.wav',{type:'audio/wav'}),p.projectId);if(!r.ok)throw Error(r.error);a.pcmOpen(p.projectId)});
const panel=page.locator('.music-final-export'),rows=panel.locator('[data-final-route]');assert.equal(await rows.count(),2);for(let i=0;i<2;i++)await rows.nth(i).locator('[name=enabled]').check();await rows.nth(1).locator('[name=role]').selectOption('vocal');await rows.nth(1).locator('[name=start]').fill('.125');await panel.locator('[name=midi]').check();await panel.getByRole('button',{name:'Preview（ミックス候補を作成）',exact:true}).click();await page.waitForFunction(()=>!MusicStudio.finalExport.busy);const evidence=await page.evaluate(async()=>{const a=MusicStudio,c=a.finalExport.candidate;if(!c)throw Error(a.finalExport.message);if(c.manifest.frames!==30000)throw Error('frame-mismatch');const midi=c.files.find(f=>f.name==='Song.mid');if(!midi||!MusicStudioMidi.inspectMidiBytes(new Uint8Array(await midi.blob.arrayBuffer())).ok)throw Error('invalid-midi');return{frames:c.manifest.frames,files:c.files.map(f=>f.name),before:c.manifest.before,after:c.manifest.after,zipSize:c.zip.size}});assert.ok(evidence.after.truePeakDb<=-1+.002);
await panel.getByRole('button',{name:'Before（元ミックス試聴）',exact:true}).click();await page.waitForFunction(()=>MusicStudio.finalExport.audio&&!MusicStudio.finalExport.audio.paused&&MusicStudio.finalExport.audio.readyState>=2);await panel.getByRole('button',{name:'After（仕上げ試聴）',exact:true}).click();await page.waitForFunction(()=>MusicStudio.finalExport.audio&&!MusicStudio.finalExport.audio.paused&&MusicStudio.finalExport.audio.readyState>=2);await panel.getByRole('button',{name:'Stop（試聴停止）',exact:true}).click();await panel.getByRole('button',{name:'Save（設定・履歴を保存）',exact:true}).click();await page.waitForFunction(()=>!MusicStudio.finalExport.busy&&MusicStudio.state.projects.find(p=>p.projectId==='final-export-browser').finalExportHistory?.length===1);
const downloadPromise=page.waitForEvent('download');await panel.getByRole('button',{name:'ZIP（まとめて書き出し）',exact:true}).click();const download=await downloadPromise;await page.waitForFunction(()=>!MusicStudio.finalExport.busy&&MusicStudio.state.projects.find(p=>p.projectId==='final-export-browser').finalExportDeliveries?.length===1);assert.equal(await download.failure(),null);const file=await download.path();const zip=fs.readFileSync(file);assert.equal(zip.readUInt32LE(0),0x04034b50);assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);assert.equal(zip.length,evidence.zipSize);
await panel.getByText('History（作成履歴・直近100件）',{exact:true}).click();await panel.getByText('Delivery（書き出し履歴・直近100件）',{exact:true}).click();const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,buttons:[...document.querySelectorAll('.music-final-export button')].every(b=>b.getBoundingClientRect().height>=44),japanese:document.querySelector('.music-final-export').textContent.includes('楽曲ミックス')}));assert.equal(metrics.overflow,false);assert.equal(metrics.buttons,true);assert.equal(metrics.japanese,true);await page.screenshot({path:`verification/music-final-export-${width}.png`,fullPage:true});
const recovery=await page.evaluate(async()=>{const a=MusicStudio,c=a.finalExport.candidate,expected=await Promise.all(c.files.filter(f=>f.name!=='Manifest.json').map(async f=>({name:f.name,bytes:Array.from(new Uint8Array(await f.blob.arrayBuffer()))}))),archive=await a.createLongWavArchive(),r=await a.restoreLongWavArchive(archive,{settings:false});if(!r.ok)throw Error(r.error);const restored=r.projects.find(p=>p.finalExportPlan);if(!restored)throw Error('restore-plan');if(restored.finalExportDeliveries?.[0]?.completion!=='browser-download-requested')throw Error('restore-delivery-history');const result=await a.finalReplay(restored.projectId,restored.finalExportHistory[0].id);if(!result.ok)throw Error(result.error);const actual=result.candidate.files.filter(f=>f.name.endsWith('.wav'));const before=c.files.filter(f=>f.name.endsWith('.wav'));for(let i=0;i<before.length;i++)if(JSON.stringify(Array.from(new Uint8Array(await before[i].blob.arrayBuffer())))!==JSON.stringify(Array.from(new Uint8Array(await actual[i].blob.arrayBuffer()))))throw Error('restore-audio-diff');return{archive:true,remappedPlan:true,identicalAudio:true,expected}});
await page.close();const reopen=await context.newPage();monitor(reopen);await reopen.goto(base+'/music-studio.html#music-studio/mixing/final-export-browser');await reopen.waitForFunction(()=>MusicStudio.state.projects.some(p=>p.projectId==='final-export-browser'));await reopen.locator('.music-final-export').getByText('History（作成履歴・直近100件）',{exact:true}).click();await reopen.getByRole('button',{name:'Retry（この設定で再作成）',exact:true}).click();await reopen.waitForFunction(()=>!MusicStudio.finalExport.busy&&!!MusicStudio.finalExport.candidate);const bytes=await reopen.evaluate(async()=>{const a=MusicStudio,p=a.state.projects.find(p=>p.projectId==='final-export-browser');if(p.finalExportHistory.length!==1)throw Error('history-reopen');if(p.finalExportDeliveries?.[0]?.completion!=='browser-download-requested')throw Error('delivery-reopen');if(!a.finalExport.message.includes('現在の保存済み音声'))throw Error('replay-disclosure');return Promise.all(a.finalExport.candidate.files.filter(f=>f.name!=='Manifest.json').map(async f=>({name:f.name,bytes:Array.from(new Uint8Array(await f.blob.arrayBuffer()))})))});assert.deepEqual(bytes,recovery.expected);assert.deepEqual(consoleMessages,[]);assert.deepEqual(external,[]);report.push({width,...evidence,...metrics,archive:true,reopenIdentical:true,remappedPlan:true,downloadVerified:true,deliveryHistoryRestored:true,historyReplayIdenticalAudio:true,console:consoleMessages,external});await context.close();}
const profile=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'nova-mixed-export-'));
let mixedContext;
const launchMixed=()=>chromium.launchPersistentContext(profile,{headless:true,
  ...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
try {
mixedContext=await launchMixed();
const mixed=await mixedContext.newPage();
await mixed.goto(base+'/music-studio.html');
await mixed.waitForFunction(()=>MusicStudio.state.loaded);
const mixedSources = await mixed.evaluate(async()=>{
  const app=MusicStudio,repo=app.indexedDbRepository(),id='whole-song-mixed-sources';
  const requireOk=result=>{if(!result.ok)throw Error(result.error);return result};
  const wave=(amplitude,frames=24000)=>({sampleRate:48000,channels:[Array.from({length:frames},(_,i)=>((i%40<20?1:-1)*amplitude)/32768)]});
  const project=app.pcmImport(app.makeProject({projectId:id,projectName:'Whole song mixed sources',bpm:120,midiData:{ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[{id:'lead',channel:1,name:'Piano',notes:[{id:'n1',pitch:60,startTick:0,durationTicks:480,velocity:70}]}]}}),wave(240),'PCM.wav');
  app.setRepository(repo);
  await repo.put(project);
  app.state.projects=[project];
  app.pcmOpen(id);
  const imported=requireOk(await app.pcmImportLongFile(new File([app.pcmEncodeWav(wave(320))],'Long.wav'),id));
  const midi=requireOk(await app.midiRenderForMix(id,'lead'));
  const recorded=app.vocalWav(wave(480).channels,48000);
  const digest=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),byte=>byte.toString(16).padStart(2,'0')).join('');
  const take={id:'take',name:'Take.wav',size:recorded.blob.size,frames:recorded.frames,sampleRate:48000,channels:1,
    hashes:[await digest(recorded.blob)],vocalTake:{format:'nova-vocal-take-v1',recordedAt:new Date().toISOString(),captureMime:'audio/wav',clippedSamples:0,waveform:recorded.waveform,cursor:0,
      edits:[{first:1200,end:19200,gainDb:0,startTick:480,latencyMs:100}]}};
  const baseline=await repo.get(id);
  const saved={...baseline,longWavAssets:[...baseline.longWavAssets,take]};
  await repo.putLongWav(saved,{id:take.id,blob:recorded.blob,hashes:take.hashes},JSON.stringify(baseline),()=>{});
  app.state.projects=[saved];
  const plan={format:'nova-final-export-plan-v1',targetLufs:-18,ceilingDb:-1,includeMidi:true,
    routes:[
      {key:'pcm:'+project.pcmMix.assets[0].id,role:'instrument',startSeconds:0,gainDb:0,muted:false},
      {key:'wav:'+imported.assetId,role:'instrument',startSeconds:.125,gainDb:0,muted:false},
      {key:'wav:'+midi.assetId,role:'instrument',startSeconds:.25,gainDb:0,muted:false},
      {key:'wav:'+take.id,role:'vocal',startSeconds:.125,gainDb:0,muted:false}
    ]};
  const expectedStarts=[0,6000,12000,26400];
  const midiBlob=await app.pcmLoadLongWav(id,midi.assetId);
  const midiAudio=app.pcmDecodeWav(await midiBlob.arrayBuffer()).channels;
  const candidate=requireOk(await app.finalPreview(id,plan)).candidate;
  if(JSON.stringify(candidate.manifest.handoff.stems.map(s=>s.sourceStartFrame))!==JSON.stringify(expectedStarts))throw Error('mixed-placement');
  const frames=12000+midiAudio[0].length;
  if(candidate.manifest.frames!==frames)throw Error('mixed-duration');
  const mix=candidate.files.find(file=>file.name==='Mix.wav').blob;
  const pcm=new DataView(await mix.arrayBuffer());
  const signal=(index,frames,amplitude)=>index>=0&&index<frames?((index%40<20?1:-1)*amplitude):0;
  for(let i=0;i<frames;i++){
    const mono=signal(i,24000,240)+signal(i-6000,24000,320)+signal(i-26400,18000,480);
    for(let c=0;c<2;c++){
      const reference=mono+(midiAudio[c][i-12000]??0)*32768;
      if(pcm.getInt16(44+(i*2+c)*2,true)!==reference)throw Error('mixed-sample '+i+' channel '+c);
    }
  }
  requireOk(await app.finalSave(id));

  const autoRoutes=plan.routes.map((route,i)=>({
    ...route,key:i===2?'midi:lead':route.key,role:['piano','strings','bass','vocal'][i]
  }));
  const prepared=requireOk(await app.autoFinishPrepare(id,autoRoutes));
  if(prepared.frames!==frames||prepared.stems.length!==4)throw Error('auto-finish-mixed-frames');
  const savedBaseline=JSON.stringify(await repo.get(id));
  const cancelled=await app.autoFinishPrepare(id,autoRoutes,()=>true);
  if(cancelled.ok||cancelled.stems||cancelled.error!=='auto-finish-preparation-cancelled')throw Error('auto-finish-cancel');
  const readBinary=repo.getLongWav;
  try {
    for(const corrupted of [false,true]){
      repo.getLongWav=async key=>{
        const record=await readBinary(key);
        if(key!==imported.assetId)return record;
        return corrupted?{...record,blob:new Blob([new Uint8Array(record.blob.size)])}:undefined;
      };
      const rejected=await app.autoFinishPrepare(id,autoRoutes);
      if(rejected.ok||rejected.stems||!rejected.error.includes('long-wav-corrupt-or-missing'))throw Error('auto-finish-damaged-source');
      if(JSON.stringify(await repo.get(id))!==savedBaseline)throw Error('auto-finish-mutated-project');
    }
  } finally { repo.getLongWav=readBinary; }
  return {id,frames,starts:expectedStarts,hash:await digest(mix),autoFinishMixed:true,cancelled:true,missingAndCorruptRejected:true};
});
await mixedContext.close();
mixedContext=await launchMixed();
const reopened=await mixedContext.newPage();
await reopened.goto(base+'/music-studio.html');
await reopened.waitForFunction(id=>MusicStudio.state.projects.some(p=>p.projectId===id),mixedSources.id);
const restartedHash=await reopened.evaluate(async id=>{
  const app=MusicStudio,project=app.state.projects.find(p=>p.projectId===id);
  const result=await app.finalReplay(id,project.finalExportHistory[0].id);
  if(!result.ok)throw Error(result.error);
  const blob=result.candidate.files.find(file=>file.name==='Mix.wav').blob;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),byte=>byte.toString(16).padStart(2,'0')).join('');
},mixedSources.id);
assert.equal(restartedHash,mixedSources.hash);

fs.writeFileSync(path.join(root,'verification/music-final-export-browser.json'),JSON.stringify({head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),report,mixedSources:{...mixedSources,reopenIdentical:true}},null,2));console.log(JSON.stringify({report,mixedSources}));
}finally{await mixedContext?.close();fs.rmSync(profile,{recursive:true,force:true});}
}finally{clearTimeout(deadline);await browser?.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
