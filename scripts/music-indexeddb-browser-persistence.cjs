'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
test('real Chromium IndexedDB persists production history and backup restore across browser restart',{timeout:120000},async()=>{
 const script=fs.readFileSync('music-studio.js');
 const server=http.createServer((req,res)=>{if(req.url==='/music-studio.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(script)}else{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html><body></body></html>')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const dir=fs.mkdtempSync('/tmp/nova-indexeddb-');
 const executable=process.env.CHROME_EXECUTABLE||chromium.executablePath();
 let browser,processHandle;
 async function stop(signal='SIGTERM'){
  if(!processHandle)return;
  const child=processHandle;processHandle=null;
  if(child.exitCode!==null||child.signalCode!==null)return;
  const exited=once(child,'exit');
  process.kill(-child.pid,signal);
  const [,actualSignal]=await exited;
  if(signal==='SIGKILL')assert.equal(actualSignal,'SIGKILL','must observe actual process termination');
  browser=null;
 }
 async function launch(){
  fs.rmSync(dir+'/DevToolsActivePort',{force:true});
  assert.ok(fs.existsSync(executable),'Playwright Chromium must be installed');
  processHandle=spawn(executable,['--headless','--no-sandbox','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{detached:true,stdio:'ignore'});
  let launchError;processHandle.on('error',error=>{launchError=error});
  const deadline=Date.now()+15000;
  while(!fs.existsSync(dir+'/DevToolsActivePort')){
   if(launchError)throw launchError;
   if(processHandle.exitCode!==null||Date.now()>deadline)throw Error('Chromium failed to start');
   await new Promise(resolve=>setTimeout(resolve,25));
  }
  const port=fs.readFileSync(dir+'/DevToolsActivePort','utf8').split('\n')[0];
  const connection=await chromium.connectOverCDP('http://127.0.0.1:'+port);
  return connection.contexts()[0];
 }
 try{
  browser=await launch();
  let page=await browser.newPage();
  const errors=[];
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Runtime.enable');
  cdp.on('Runtime.exceptionThrown',({exceptionDetails:d})=>errors.push('CDP '+d.text+' '+(d.url||'')+':'+(d.lineNumber+1)+':'+(d.columnNumber+1)+' '+(d.exception?.description||'')));
  page.on('pageerror',error=>errors.push(error.stack||error.message));
  await page.goto(origin);
  await page.addScriptTag({url:origin+'/music-studio.js'});
  assert.equal(await page.evaluate(()=>typeof window.MusicStudio),'object','MusicStudio failed to load: '+errors.join(' | '));
  const expected=await page.evaluate(async()=>{
   const app=window.MusicStudio;
   const repo=app.indexedDbRepository();
   app.setRepository(repo);
   const song=app.makeProject({projectId:'chromium-restart-history',projectName:'Browser durable history',midiData:{ppq:480,tempo:120,totalTick:480,tracks:[{id:'lead',notes:[{id:'n',pitch:60,velocity:80,startTick:0,durationTicks:480}]}]}});
   await repo.put(song);
   app.state.projects=[song];
   for(const [method,args] of [['productionSessionSave',['chromium-restart-history','start','Session']],['productionDaySave',['chromium-restart-history','2026-11-03','Day']],['versionSave',['chromium-restart-history','Checkpoint']]]){
    const result=await app[method](...args);if(!result.ok)throw Error(method+': '+JSON.stringify(result));
   }
   for(const name of ['Material before restart']){const r=await app.materialCapture(song.projectId,{name});if(!r.ok)throw Error(r.error)}
   const materials=app.materialExport(song.projectId).text;
   const importedMaterials=await app.materialImport(song.projectId,{size:materials.length,text:async()=>materials});if(!importedMaterials.ok)throw Error(importedMaterials.error);
   const project=await repo.get('chromium-restart-history');
   const backup=app.backupObject();
   const restored=await app.restoreBackup(backup,{settings:false});
   if(!restored.ok||!restored.committed)throw Error('IndexedDB restore failed: '+JSON.stringify(restored));
   const imported=(await repo.list()).filter(p=>p.projectId!=='chromium-restart-history');
   if(imported.length!==1)throw Error('Expected one imported project; got '+imported.length);
   const restoredProject=await repo.get(imported[0].projectId);
   if(!restoredProject)throw Error('Imported project missing before restart');
   return {sourceId:project.projectId,importedId:restoredProject.projectId,edits:project.songVersions.edits,materials:project.materialLibrary,sessions:project.songVersions.sessions,days:project.songVersions.days,checkpoints:project.songVersions.checkpoints.map(x=>({id:x.id,name:x.name}))};
  });
  await stop();
  browser=await launch();
  page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin);await page.addScriptTag({url:origin+'/music-studio.js'});
  assert.equal(await page.evaluate(()=>typeof window.MusicStudio),'object','MusicStudio failed to reload: '+errors.join(' | '));
  const actual=await page.evaluate(async()=>{
   const app=window.MusicStudio;const repo=app.indexedDbRepository();
   const project=await repo.get('chromium-restart-history');
   if(!project)throw Error('IndexedDB source missing after Chromium restart');
   const imported=(await repo.list()).filter(p=>p.projectId!=='chromium-restart-history');
   if(imported.length!==1)throw Error('Imported project missing or duplicated after restart');
   const restored=await repo.get(imported[0].projectId);
   if(!restored)throw Error('IndexedDB restored project missing after restart');
   const history=p=>({edits:p.songVersions.edits,materials:p.materialLibrary,sessions:p.songVersions.sessions,days:p.songVersions.days,checkpoints:p.songVersions.checkpoints.map(x=>({id:x.id,name:x.name}))});
   return {sourceId:project.projectId,importedId:restored.projectId,source:history(project),imported:history(restored)};
  });
  assert.equal(actual.sourceId,expected.sourceId);
  assert.equal(actual.importedId,expected.importedId);
  for(const history of [actual.source,actual.imported]){
   assert.deepEqual(history.edits,expected.edits);
   assert.deepEqual(history.materials,expected.materials);
   assert.deepEqual(history.sessions,expected.sessions);
   assert.deepEqual(history.days,expected.days);
   assert.deepEqual(history.checkpoints,expected.checkpoints);
  }
  // Kill the owned browser process group; no renderer event or graceful close.
  await stop('SIGKILL');
  browser=await launch();
  const recoveredPage=await browser.newPage();
  await recoveredPage.goto(origin);
  await recoveredPage.addScriptTag({url:origin+'/music-studio.js'});
  const recovered=await recoveredPage.evaluate(async()=>{
   const repo=window.MusicStudio.indexedDbRepository();
   const projects=await repo.list();
   return projects.map(p=>({id:p.projectId,edits:p.songVersions?.edits,materials:p.materialLibrary,sessions:p.songVersions?.sessions,days:p.songVersions?.days,checkpoints:p.songVersions?.checkpoints?.map(x=>({id:x.id,name:x.name}))}));
  });
  assert.equal(recovered.length,2,'browser SIGKILL must not remove committed projects');
  for(const id of [expected.sourceId,expected.importedId]){
   const item=recovered.find(p=>p.id===id);
   assert.ok(item,'project must survive browser SIGKILL: '+id);
   assert.deepEqual(item.edits,expected.edits);
   assert.deepEqual(item.materials,expected.materials);
   assert.deepEqual(item.sessions,expected.sessions);
   assert.deepEqual(item.days,expected.days);
   assert.deepEqual(item.checkpoints,expected.checkpoints);
  }
  // Interrupt daily history and both material publications after the put
  // request succeeds but before its transaction can commit. Keep the transaction
  // active with real IDB requests; do not replace the repository with a mock.
  let interruptedPage=recoveredPage;
  for(const entry of ['runAutoBackupCheck','productionDaySave','materialCapture','materialImport','recoverMissingBinary','createAIProject','duplicateProject']){
   if(entry==='recoverMissingBinary')await interruptedPage.evaluate(async()=>{
    const repo=MusicStudio.indexedDbRepository(),p=await repo.get('chromium-restart-history');
    const blob=new Blob(['durable-original']),hashes=[Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('')];
    p.fileReferences=[{name:'source.wav',binary:{format:'nova-reference-binary-v1',id:'crash-recovery-binary',name:'source.wav',size:blob.size,type:'audio/wav',hashes}}];p.revision++;await repo.put(p);
   });
   if(entry==='runAutoBackupCheck')await interruptedPage.evaluate(async()=>{await MusicStudio.indexedDbRepository().putAutoBackup({backupId:'last-good',createdAt:'2026-11-01T00:00:00Z',signature:'old',snapshot:{protected:true}})});
   const beforeProjects=await interruptedPage.evaluate(async()=>await MusicStudio.indexedDbRepository().list());
   const beforeBackups=await interruptedPage.evaluate(async()=>await MusicStudio.indexedDbRepository().listAutoBackups());
   const beforeIds=await interruptedPage.evaluate(async()=>(await MusicStudio.indexedDbRepository().list()).map(p=>p.projectId).sort());
   const before=await interruptedPage.evaluate(async()=>await MusicStudio.indexedDbRepository().get('chromium-restart-history'));
   const armed=new Promise(resolve=>interruptedPage.on('console',m=>{if(m.text()==='NOVA_TRANSACTION_ACTIVE')resolve()}));
   await interruptedPage.evaluate(entry=>{
    for(const method of ['put','add']){const original=IDBObjectStore.prototype[method];
    IDBObjectStore.prototype[method]=function(value,...args){
     const request=original.call(this,value,...args);
     if((entry==='runAutoBackupCheck'&&value?.backupId)||value?.projectId&&(value.projectId==='chromium-restart-history'||['createAIProject','duplicateProject'].includes(entry))){
      request.addEventListener('success',()=>{
       const store=this;
       const keepAlive=()=>{const next=store.get(value.projectId||value.backupId);next.onsuccess=keepAlive};
       keepAlive();console.log('NOVA_TRANSACTION_ACTIVE');
      });
     }
     return request;
    };}
    const app=MusicStudio;app.setRepository(app.indexedDbRepository());
    window.pendingSave=app.indexedDbRepository().get('chromium-restart-history').then(p=>{
     app.state.projects=[p];
     if(entry==='runAutoBackupCheck'){app.state.settings=app.normalizeSettings({backup:{automaticEnabled:true,intervalHours:1,maxCopies:1}});return app.runAutoBackupCheck('2026-11-04T00:00:00Z')}
     if(entry==='createAIProject')return app.createAIProject({projectInput:{projectId:'crash-new-ai',projectName:'Interrupted new song'},midiData:{ppq:480,tracks:[]}});
     if(entry==='duplicateProject')return app.duplicateProject(p.projectId);
     if(entry==='recoverMissingBinary')return app.recoverMissingBinary(p.projectId,'crash-recovery-binary',new Blob(['durable-original']));
     if(entry==='materialCapture')return app.materialCapture(p.projectId,{name:'Interrupted material'});
     if(entry==='materialImport'){const text=app.materialExport(p.projectId).text;return app.materialImport(p.projectId,{size:text.length,text:async()=>text})}
     return app.productionDaySave(p.projectId,'2026-11-04','Must not partially publish');
    });
    window.pendingSave.then(()=>console.log('NOVA_UNEXPECTED_COMMIT'));
   },entry);
   let timer;
   try{await Promise.race([armed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('write transaction never became active')),10000)})])}finally{clearTimeout(timer)}
   await stop('SIGKILL');browser=await launch();
   const resumed=await browser.newPage();await resumed.goto(origin);await resumed.addScriptTag({url:origin+'/music-studio.js'});
   assert.deepEqual(await resumed.evaluate(async()=>await MusicStudio.indexedDbRepository().get('chromium-restart-history')),before,'interrupted transaction must preserve the complete prior project and history');
   assert.deepEqual(await resumed.evaluate(async()=>(await MusicStudio.indexedDbRepository().list()).map(p=>p.projectId).sort()),beforeIds,'interrupted create or fork must not publish a partial project');
   assert.deepEqual(await resumed.evaluate(async()=>await MusicStudio.indexedDbRepository().listAutoBackups()),beforeBackups,'interrupted publication must preserve previous backup copies');
   assert.equal(await resumed.evaluate(async entry=>{
    const app=MusicStudio,repo=app.indexedDbRepository();app.setRepository(repo);app.state.projects=await repo.list();const id='chromium-restart-history';
    if(entry==='runAutoBackupCheck'){app.state.settings=app.normalizeSettings({backup:{automaticEnabled:true,intervalHours:1,maxCopies:1}});return (await app.runAutoBackupCheck('2026-11-04T00:00:00Z')).created}
    if(entry==='createAIProject')return Boolean((await app.createAIProject({projectInput:{projectId:'crash-new-ai',projectName:'Retried new song'},midiData:{ppq:480,tracks:[]}})).projectId);
    if(entry==='duplicateProject')return (await app.duplicateProject(id)).ok;
    if(entry==='recoverMissingBinary'){if(await repo.getLongWav('crash-recovery-binary'))throw Error('uncommitted binary survived');return (await app.recoverMissingBinary(id,'crash-recovery-binary',new Blob(['durable-original']))).ok}
    if(entry==='materialCapture')return (await app.materialCapture(id,{name:'Retry material'})).ok;
    if(entry==='materialImport'){const text=app.materialExport(id).text;return (await app.materialImport(id,{size:text.length,text:async()=>text})).ok}
    return (await app.productionDaySave(id,'2026-11-04','Retry after crash')).ok;
   },entry),true,entry+' retry must work after restart');
   const retried=await resumed.evaluate(async()=>await MusicStudio.indexedDbRepository().get('chromium-restart-history'));
   if(entry==='runAutoBackupCheck'){assert.deepEqual(retried,before);const copies=await resumed.evaluate(async()=>await MusicStudio.indexedDbRepository().listAutoBackups());assert.equal(copies.length,1);assert.notEqual(copies[0].backupId,'last-good');assert.deepEqual(copies[0].snapshot.projects,beforeProjects)}
   else if(['createAIProject','duplicateProject'].includes(entry)){assert.deepEqual(retried,before,'creation/fork must preserve source history');const saved=await resumed.evaluate(async entry=>(await MusicStudio.indexedDbRepository().list()).filter(p=>p.projectId==='crash-new-ai'||p.productionHistory?.at(-1)?.type==='project-duplicate'),entry);assert.equal(saved.length,entry==='duplicateProject'?2:1);assert.ok(saved.some(p=>p.productionHistory.at(-1)?.type===(entry==='createAIProject'?'project-create':'project-duplicate')))}
   else if(entry==='productionDaySave')assert.equal(retried.songVersions.days.find(d=>d.day==='2026-11-04')?.note,'Retry after crash');
   else if(entry==='recoverMissingBinary'){assert.equal(retried.songVersions.edits.length,before.songVersions.edits.length+1);assert.equal(retried.songVersions.edits.at(-1).source,'dependency-recovery');assert.equal(retried.songVersions.edits.at(-1).sessionId,before.songVersions.sessions[0].id);assert.equal(await resumed.evaluate(async()=>await (await MusicStudio.indexedDbRepository().getLongWav('crash-recovery-binary')).blob.text()),'durable-original')}
   else{assert.equal(retried.materialLibrary.length,before.materialLibrary.length+(entry==='materialImport'?before.materialLibrary.length:1));assert.equal(retried.songVersions.edits.length,before.songVersions.edits.length+1);assert.equal(retried.songVersions.edits.at(-1).source,'material-library')}
   interruptedPage=resumed;
  }
 }finally{await stop();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})}
});

test('lyric follow scrolls active saved assignments after rerender and clears stopped playback',{timeout:30000},async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/music-studio.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(req.url==='/music-studio.js'?fs.readFileSync('music-studio.js'):'<!doctype html><html><body></body></html>')});
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});const page=await browser.newPage();page.on('pageerror',e=>console.error('LYRIC_PAGE_ERROR',e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({url:'http://127.0.0.1:'+server.address().port+'/music-studio.js'});
  await page.evaluate(()=>{
   const a=MusicStudio;let p=a.makeProject({projectId:'lyrics-scroll',projectName:'Lyrics',midiData:{ppq:480,tempoMap:[{tick:0,bpm:120},{tick:480,bpm:60}],tracks:[{id:'lead',notes:Array.from({length:12},(_,i)=>({id:'n'+i,pitch:60,startTick:i*480,durationTicks:480,velocity:90}))}]}});
   p=a.adoptLyricsAssignment(p,a.lyricsAssignmentPreview(p,{trackId:'lead',fromNote:1,toNote:12,text:'あいうえおかきくけこさし',reading:'あ い う え お か き く け こ さ し'}));
   const repo=a.indexedDbRepository();a.setRepository(repo);window.song=p;window.clock=0;a.vocal.projectId=p.projectId;a.vocal.lyricTrackId='lead';a.vocal.lyricRows=a.vocalLyricRows(p,'lead');
   window.paintLyrics=()=>{document.body.innerHTML=a.vocalLyricView(p);const panel=document.querySelector('[data-vocal-lyrics]');panel.style.cssText='height:60px;overflow:auto;position:relative';for(const item of panel.children)item.style.cssText='display:block;height:30px'};
   paintLyrics();a.vocalLyricFollow(a.vocalLyricRows(p,'lead'),()=>clock);
  });
  await page.evaluate(()=>{clock=7.6});
  await page.waitForFunction(()=>document.querySelector('[aria-current]')?.dataset.lyricIndex==='8');
  assert.ok(await page.evaluate(()=>document.querySelector('[data-vocal-lyrics]').scrollTop)>0);
  await page.evaluate(()=>paintLyrics());
  await page.waitForFunction(()=>document.querySelector('[data-vocal-lyrics]').scrollTop>0);
  await page.evaluate(()=>{clock=-1});await page.waitForFunction(()=>!document.querySelector('[aria-current]'));
  assert.equal(await page.locator('[data-lyric-clock]').textContent(),'録音開始待ち');
  await page.evaluate(()=>{clock=.1});await page.waitForFunction(()=>document.querySelector('[aria-current]')?.dataset.lyricIndex==='0');
  await page.evaluate(()=>MusicStudio.vocalLyricStop());
  assert.equal(await page.locator('[aria-current]').count(),0);assert.equal(await page.locator('.is-current').count(),0);
  await page.evaluate(async()=>{await MusicStudio.indexedDbRepository().put(song);const p=await MusicStudio.indexedDbRepository().get(song.projectId);if(JSON.stringify(MusicStudio.vocalLyricRows(p,'lead'))!==JSON.stringify(MusicStudio.vocalLyricRows(song,'lead')))throw Error('saved lyric timing changed')});
 }finally{await browser?.close();await new Promise(r=>server.close(r))}
});
