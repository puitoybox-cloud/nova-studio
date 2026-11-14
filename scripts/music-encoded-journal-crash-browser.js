// Synthetic microphone, real Chromium process SIGKILL and persistent IndexedDB.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),{chromium}=require('playwright'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'nova-encoded-crash-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));let child,browser;
const server=http.createServer((req,res)=>{const file=path.resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'music-studio.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res)});
async function launch(){let launchError;const portFile=path.join(profile,'DevToolsActivePort');fs.rmSync(portFile,{force:true});child=spawn(process.env.CHROME_EXECUTABLE||chromium.executablePath(),['--headless','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0','--user-data-dir='+profile,'--autoplay-policy=no-user-gesture-required','about:blank'],{stdio:'ignore'});child.once('error',e=>{launchError=e});for(let i=0;i<200;i++){if(launchError)throw launchError;if(child.exitCode!==null)throw Error('chromium-exited');if(fs.existsSync(portFile))break;await delay(100)}const port=fs.readFileSync(portFile,'utf8').split('\n')[0];browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);return browser.contexts()[0]}
const syntheticMicrophone=()=>{window.AudioWorkletNode=undefined;navigator.mediaDevices.getUserMedia=async()=>{const c=new AudioContext({sampleRate:48000}),s=c.createOscillator(),g=c.createGain(),d=c.createMediaStreamDestination();s.frequency.value=220;g.gain.value=.1;s.connect(g);g.connect(d);s.start();await c.resume();return d.stream}};
(async()=>{try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/music-studio.html`;let context=await launch(),page=await context.newPage();await page.addInitScript(syntheticMicrophone);
await page.goto(url);await page.bringToFront();console.log('recording-page-loaded');await page.waitForFunction(()=>window.MusicStudio?.state.loaded);await page.evaluate(async()=>{const a=MusicStudio,p=a.makeProject({projectId:'crash-journal',projectName:'SIGKILL MediaRecorder'}),r=a.indexedDbRepository();a.setRepository(r);await r.put(p);a.state.projects=[p];const result=await a.vocalStart(p.projectId);if(!result.ok)throw Error(result.error)});
console.log('capture-started');
const minimumSeconds=60;
const captureStarted=Date.now();
const captureDeadline=captureStarted+120000;
let ready=false;
while(Date.now()<captureDeadline){const progress=await page.evaluate(async()=>{const r=MusicStudio.indexedDbRepository(),m=(await r.listVocalJournals())[0];await r.close();return{next:m?.next||0,phase:MusicStudio.vocal.phase,message:MusicStudio.vocal.message}});if(progress.next>=3&&Date.now()-captureStarted>=minimumSeconds*1000){ready=true;break}if(!['permission','recording','armed'].includes(progress.phase))throw Error(JSON.stringify(progress));await delay(100)}assert.equal(ready,true,'MediaRecorder did not maintain capture and journal commits for 60 seconds');
const captured=await page.evaluate(async()=>{const r=MusicStudio.indexedDbRepository(),m=(await r.listVocalJournals())[0];await r.close();return{id:m.id,committedBytes:m.encodedBytes,rate:m.rate,phase:MusicStudio.vocal.phase,assets:MusicStudio.state.projects[0].longWavAssets?.length||0}});assert.ok(captured.committedBytes>0);assert.equal(captured.phase,'recording');assert.equal(captured.assets,0);
console.log('committed-before-kill',JSON.stringify(captured));const exited=new Promise(r=>child.once('exit',r));child.kill('SIGKILL');await exited;browser=null;
context=await launch();page=await context.newPage();await page.goto(url);console.log('fresh-process-loaded');await page.waitForFunction(()=>window.MusicStudio?.state.loaded);await page.waitForFunction(()=>MusicStudio.vocalRecovery.items.length>0);const discovered=await page.evaluate(()=>MusicStudio.vocalRecovery.items.map(x=>({id:x.id,encodedBytes:x.encodedBytes,updatedAt:x.updatedAt,closed:x.closed})));const m=discovered.find(x=>x.id===captured.id);assert.ok(m);assert.ok(m.encodedBytes>=captured.committedBytes);assert.equal(m.closed,false);
// Real 30-second heartbeat expiry; no timestamp or application-memory injection.
await delay(Math.max(0,31000-(Date.now()-m.updatedAt)));
const result=await page.evaluate(async id=>{const a=MusicStudio,r=a.indexedDbRepository(),m=await r.getVocalJournal(id),pieces=[];for(let i=0;i<m.next;i++)pieces.push((await r.getVocalJournalChunk(id+':'+i)).bytes);const hash=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join(''),encoded=new Blob(pieces,{type:m.encoding}),decoder=new AudioContext({sampleRate:m.rate}),buffer=await decoder.decodeAudioData(await encoded.arrayBuffer()),expected=await hash(a.vocalWav(Array.from({length:Math.min(2,buffer.numberOfChannels)},(_,c)=>buffer.getChannelData(c)),buffer.sampleRate).blob.slice(44));await decoder.close();a.state.settings=a.normalizeSettings({...a.state.settings,backup:{...a.state.settings.backup,automaticEnabled:true,intervalHours:1}});await r.putSettings(a.state.settings);const automatic=await a.runAutoBackupCheck('2099-10-30T00:00:00Z');if(!automatic.created||!automatic.backup.archive)throw Error('unfinished-automatic-backup-failed:'+JSON.stringify(automatic));const unfinished=automatic.backup.archive,migration=await a.restoreLongWavArchive(unfinished,{settings:false});if(!migration.ok)throw Error(migration.error);const imported=(await r.listVocalJournals()).find(j=>j.id!==id),migrated=await a.vocalRecoverJournal(imported.id);if(!migrated.ok)throw Error(migrated.error);const moved=await a.pcmLoadLongWav(migrated.project.projectId,migrated.assetId);if(await hash(moved.slice(44))!==expected)throw Error('unfinished-migration-PCM-differs');const saved=await a.vocalRecoverJournal(id);if(!saved.ok)throw Error(saved.error);const asset=saved.project.longWavAssets[0],wav=await a.pcmLoadLongWav(saved.project.projectId,asset.id),actual=await hash(wav.slice(44));if(expected!==actual)throw Error('committed-PCM-differs');
const events=saved.project.productionHistory.filter(e=>e.type==='recording-recovery'&&e.journalId===id);
const event=events[0],marker=await r.getVocalJournal(id);
if(events.length!==1||event.projectId!==saved.project.projectId||event.journalConsumed!==m.consumed||
 event.journalNext!==m.next||event.assetId!==asset.id||event.frames!==asset.frames||
 JSON.stringify(event.wavHashes)!==JSON.stringify(asset.hashes)||
 !saved.project.songVersions.edits.some(edit=>edit.id===event.editId)||
 marker.recoveredFrames!==asset.frames)throw Error('encoded-recovery-provenance-mismatch');
const archive=await a.createLongWavArchive(),restored=await a.restoreLongWavArchive(archive,{settings:false});if(!restored.ok)throw Error(restored.error);const p=restored.projects.find(p=>p.projectId!==saved.project.projectId&&p.longWavAssets?.length),copy=await a.pcmLoadLongWav(p.projectId,p.longWavAssets[0].id);if(await hash(copy)!==await hash(wav))throw Error('archive-bytes-differ');const repeated=await a.vocalRecoverJournal(id);const retained=await r.listVocalJournals();if(retained.some(m=>m.recoveredAt===undefined||!m.recoveredFrames))throw Error('recovered-source-marker-missing');const sourceParts=[];for(let i=0;i<m.next;i++)sourceParts.push((await r.getVocalJournalChunk(id+':'+i)).bytes);if(await hash(new Blob(sourceParts))!==await hash(encoded))throw Error('retained-container-differs');const projectId=saved.project.projectId;
const first=480,end=4800;
const comp=await a.vocalCompEdit(projectId,{crossfadeMs:0,segments:[{hashes:asset.hashes,first,end}]});
if(!comp.ok)throw Error(comp.error);
const compiled=await a.vocalCompRender(projectId);
const sourcePCM=new DataView(await wav.slice(44+first*asset.channels*2,44+end*asset.channels*2).arrayBuffer());
const compPCM=new DataView(await compiled.blob.slice(44).arrayBuffer());
if(compPCM.byteLength!==sourcePCM.byteLength)throw Error('recovered-comp-frame-count');
let compMaxSampleDelta=0;
for(let i=0;i<sourcePCM.byteLength;i+=2)compMaxSampleDelta=Math.max(compMaxSampleDelta,
 Math.abs(sourcePCM.getInt16(i,true)-compPCM.getInt16(i,true)));
if(compMaxSampleDelta>1)throw Error('recovered-comp-PCM-differs');
const storedComp=await r.get(projectId);
if(JSON.stringify(storedComp.vocalComp)!==JSON.stringify(comp.project.vocalComp)||
   !storedComp.productionHistory.some(item=>item.id===event.id))throw Error('recovered-comp-history-differs');
await r.close();return{compFromRecoveredTake:true,compMaxSampleDelta,frames:asset.frames,sampleRate:asset.sampleRate,hash:actual,decodedCommittedContainerIdentical:true,unfinishedArchiveMigrationIdentical:true,automaticUnfinishedBackup:true,archiveIdentical:true,repeatRejected:!repeated.ok,retainedContainersIdentical:true,recoveryMarkersAtomic:true,recoveryEventId:event.id,recoveryJournalId:event.journalId,remainingJournals:(await a.vocalDiscoverRecovery()).length}},captured.id);
await page.close();
const switchedPage=await context.newPage();
await switchedPage.addInitScript(syntheticMicrophone);
await switchedPage.goto(url);
await switchedPage.bringToFront();
await switchedPage.waitForFunction(()=>window.MusicStudio?.state.loaded);
const switchRecovery=await switchedPage.evaluate(async()=>{
  const a=MusicStudio,id='recording-repository-switch';
  const source=a.indexedDbRepository(),project=a.makeProject({projectId:id,projectName:'MediaRecorder repository switch'});
  a.setRepository(source);
  await source.put(project);
  await a.refresh();
  const started=await a.vocalStart(id);
  if(!started.ok)throw Error(started.error);
  const journalId=a.vocal.recorder.journalId,completion=a.vocal.completion;
  await new Promise((resolve,reject)=>{
    const deadline=Date.now()+10000;
    const poll=async()=>{
      if((await source.getVocalJournal(journalId))?.next>=2){resolve();return}
      if(Date.now()>=deadline){reject(Error('no-encoded-journal-chunks'));return}
      setTimeout(()=>poll().catch(reject),100);
    };
    poll().catch(reject);
  });
  const replacement=a.memoryRepository([project]);
  a.setRepository(replacement);
  a.setRepository(source);
  const stopped=await completion;
  const journal=await source.getVocalJournal(journalId);
  if(stopped.ok||!journal.closed||journal.next<2||
     JSON.stringify(await source.get(id))!==JSON.stringify(project)||
     JSON.stringify(await replacement.get(id))!==JSON.stringify(project))throw Error('repository-switch-wrote-project-or-lost-journal');
  const recovered=await a.vocalRecoverJournal(journalId);
  if(!recovered.ok||recovered.project.longWavAssets.length!==1)throw Error(recovered.error||'repository-switch-recovery-count');
  const asset=recovered.project.longWavAssets[0];
  const wav=await a.pcmLoadLongWav(id,asset.id);
  if(wav.size!==asset.size||!(await source.getVocalJournal(journalId)).recoveredFrames)throw Error('repository-switch-recovery-incomplete');
  return{durableChunks:journal.next,frames:asset.frames,switchedBackBeforeStop:true};
});
result.repositorySwitch=switchRecovery;
assert.equal(result.sampleRate,captured.rate);assert.ok(result.frames/result.sampleRate>=minimumSeconds-5,JSON.stringify({captured,result}));assert.equal(result.remainingJournals,4);assert.equal(result.retainedContainersIdentical,true);assert.equal(result.recoveryMarkersAtomic,true);assert.equal(result.repeatRejected,true);const report={date:new Date().toISOString(),syntheticMicrophone:true,physicalPowerLossTested:false,processKill:'SIGKILL',freshChromiumSameProfile:true,captured,discovered,result,sourceSHA256:createHash('sha256').update(fs.readFileSync(path.join(root,'music-studio.js'))).digest('hex')};fs.writeFileSync(path.join(root,'verification/music-encoded-journal-crash-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){console.error('Encoded crash scenario failed:',e);throw e}finally{await browser?.close().catch(()=>{});if(child&&child.exitCode===null&&child.signalCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill('SIGKILL');await exited}await new Promise(r=>server.close(r));try{await fs.promises.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200})}catch(e){console.warn('Temporary profile cleanup:',e.message)}}})().catch(e=>{console.error(e);process.exitCode=1});
