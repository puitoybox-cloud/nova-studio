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
  // The production material entry refuses work until initial IndexedDB refresh completes.
  await page.waitForFunction(()=>window.MusicStudio?.state.loaded===true);
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
  // The production material entry refuses work until initial IndexedDB refresh completes.
  await page.waitForFunction(()=>window.MusicStudio?.state.loaded===true);
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
  await recoveredPage.addScriptTag({url:origin+'/music-studio.js'});await recoveredPage.waitForFunction(()=>MusicStudio.state.loaded===true);
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
  for(const entry of ['runAutoBackupCheck','productionDaySave','materialCapture','materialImport','recoverMissingBinary','createAIProject','duplicateProject','materialCreate','versionSave','versionApply','versionUndo','versionRedo','pcmApply','pcmImportLongFile','saveLyricsAssignment','productionSessionSave']){
   if(entry==='pcmApply')await interruptedPage.evaluate(async()=>{const a=MusicStudio,r=a.indexedDbRepository();let p=await r.get('chromium-restart-history');p=a.pcmImport(p,{sampleRate:48000,channels:[[0,.5,-.5,0]]},'Crash-safe PCM');await r.put(p);a.state.projects=[p]});
   if(entry==='versionApply')await interruptedPage.evaluate(async()=>{const a=MusicStudio,r=a.indexedDbRepository(),p=await r.get('chromium-restart-history');p.productionNotes='Before interrupted adoption';p.revision++;await r.put(p);a.state.projects=[p]});
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
     if((entry==='runAutoBackupCheck'&&value?.backupId)||value?.projectId&&(value.projectId==='chromium-restart-history'||['createAIProject','duplicateProject','materialCreate'].includes(entry))){
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
     if(entry==='materialCreate')return app.materialCreate(p.projectId,p.materialLibrary[0].id);
     if(entry==='versionSave')return app.versionSave(p.projectId,'Interrupted checkpoint');
     if(entry==='versionApply'){const preview=app.versionPreview(p.projectId,p.songVersions.checkpoints.at(-1).id,['notes']);if(!preview.ok)throw Error(preview.error);return app.versionApply(p.projectId)}
     if(entry==='versionUndo'||entry==='versionRedo')return app.versionUndoRedo(p.projectId,entry==='versionUndo'?-1:1);
     if(entry==='pcmApply'){app.pcmOpen(p.projectId);app.pcmEditor.preview=app.pcmPreview(p,p.pcmMix.assets.at(-1).id,-6);return app.pcmApply(p.projectId)}
     if(entry==='pcmImportLongFile'){app.pcmOpen(p.projectId);const blob=new Blob([app.pcmEncodeWav({sampleRate:48000,channels:[[0,.25,-.25,0]]})],{type:'audio/wav'});blob.name='Interrupted.wav';return app.pcmImportLongFile(blob,p.projectId)}
     if(entry==='saveLyricsAssignment'){app.lyricsAssignmentView(p.projectId);app.lyricsEditor.preview=app.lyricsAssignmentPreview(p,{trackId:'lead',fromNote:1,toNote:1,text:'君',reading:'きみ'});return app.saveLyricsAssignment(p.projectId)}
     if(entry==='productionSessionSave')return app.productionSessionSave(p.projectId,'finish','Interrupted finish');
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
   const resumed=await browser.newPage();await resumed.goto(origin);await resumed.addScriptTag({url:origin+'/music-studio.js'});await resumed.waitForFunction(()=>MusicStudio.state.loaded===true);
   assert.deepEqual(await resumed.evaluate(async()=>await MusicStudio.indexedDbRepository().get('chromium-restart-history')),before,'interrupted transaction must preserve the complete prior project and history');
   assert.deepEqual(await resumed.evaluate(async()=>(await MusicStudio.indexedDbRepository().list()).map(p=>p.projectId).sort()),beforeIds,'interrupted create or fork must not publish a partial project');
   assert.deepEqual(await resumed.evaluate(async()=>await MusicStudio.indexedDbRepository().listAutoBackups()),beforeBackups,'interrupted publication must preserve previous backup copies');
   assert.equal(await resumed.evaluate(async entry=>{
    const app=MusicStudio,repo=app.indexedDbRepository();app.setRepository(repo);app.state.projects=await repo.list();const id='chromium-restart-history';
    if(entry==='runAutoBackupCheck'){app.state.settings=app.normalizeSettings({backup:{automaticEnabled:true,intervalHours:1,maxCopies:1}});return (await app.runAutoBackupCheck('2026-11-04T00:00:00Z')).created}
    if(entry==='createAIProject')return Boolean((await app.createAIProject({projectInput:{projectId:'crash-new-ai',projectName:'Retried new song'},midiData:{ppq:480,tracks:[]}})).projectId);
    if(entry==='duplicateProject')return (await app.duplicateProject(id)).ok;
    if(entry==='materialCreate')return (await app.materialCreate(id,app.state.projects.find(p=>p.projectId===id).materialLibrary[0].id)).ok;
    if(entry==='versionSave')return (await app.versionSave(id,'Retry checkpoint')).ok;
    if(entry==='versionApply'){const p=app.state.projects.find(p=>p.projectId===id),preview=app.versionPreview(id,p.songVersions.checkpoints.at(-1).id,['notes']);if(!preview.ok)throw Error(preview.error);return (await app.versionApply(id)).ok}
    if(entry==='versionUndo'||entry==='versionRedo')return (await app.versionUndoRedo(id,entry==='versionUndo'?-1:1)).ok;
    if(entry==='pcmApply'){const p=app.state.projects.find(p=>p.projectId===id);app.pcmOpen(id);app.pcmEditor.preview=app.pcmPreview(p,p.pcmMix.assets.at(-1).id,-6);return (await app.pcmApply(id)).ok}
    if(entry==='pcmImportLongFile'){app.pcmOpen(id);const blob=new Blob([app.pcmEncodeWav({sampleRate:48000,channels:[[0,.25,-.25,0]]})],{type:'audio/wav'});blob.name='Retried.wav';return (await app.pcmImportLongFile(blob,id)).ok}
    if(entry==='saveLyricsAssignment'){const p=app.state.projects.find(p=>p.projectId===id);app.lyricsAssignmentView(id);app.lyricsEditor.preview=app.lyricsAssignmentPreview(p,{trackId:'lead',fromNote:1,toNote:1,text:'君',reading:'きみ'});return (await app.saveLyricsAssignment(id)).ok}
    if(entry==='productionSessionSave')return (await app.productionSessionSave(id,'finish','Retried finish')).ok;
    if(entry==='recoverMissingBinary'){if(await repo.getLongWav('crash-recovery-binary'))throw Error('uncommitted binary survived');return (await app.recoverMissingBinary(id,'crash-recovery-binary',new Blob(['durable-original']))).ok}
    if(entry==='materialCapture')return (await app.materialCapture(id,{name:'Retry material'})).ok;
    if(entry==='materialImport'){const text=app.materialExport(id).text;return (await app.materialImport(id,{size:text.length,text:async()=>text})).ok}
    return (await app.productionDaySave(id,'2026-11-04','Retry after crash')).ok;
   },entry),true,entry+' retry must work after restart');
   const retried=await resumed.evaluate(async()=>await MusicStudio.indexedDbRepository().get('chromium-restart-history'));
   if(entry==='runAutoBackupCheck'){assert.deepEqual(retried,before);const copies=await resumed.evaluate(async()=>await MusicStudio.indexedDbRepository().listAutoBackups());assert.equal(copies.length,1);assert.notEqual(copies[0].backupId,'last-good');assert.deepEqual(copies[0].snapshot.projects,beforeProjects)}
   else if(['createAIProject','duplicateProject'].includes(entry)){assert.deepEqual(retried,before,'creation/fork must preserve source history');const saved=await resumed.evaluate(async entry=>(await MusicStudio.indexedDbRepository().list()).filter(p=>p.projectId==='crash-new-ai'||p.productionHistory?.at(-1)?.type==='project-duplicate'),entry);assert.equal(saved.length,entry==='duplicateProject'?2:1);assert.ok(saved.some(p=>p.productionHistory.at(-1)?.type===(entry==='createAIProject'?'project-create':'project-duplicate')))}
   else if(entry==='materialCreate'){assert.deepEqual(retried,before);const copies=await resumed.evaluate(async()=>(await MusicStudio.indexedDbRepository().list()).filter(p=>p.productionHistory?.at(-1)?.type==='material-create'));assert.equal(copies.length,1);assert.equal(copies[0].productionHistory.at(-1).sourceProjectId,before.projectId);assert.deepEqual(copies[0].midiData.tracks.map(t=>t.notes.map(n=>n.pitch)),before.materialLibrary[0].midiData.tracks.map(t=>t.notes.map(n=>n.pitch)))}
   else if(entry==='versionSave'){assert.equal(retried.songVersions.checkpoints.length,before.songVersions.checkpoints.length+1);assert.equal(retried.songVersions.checkpoints.at(-1).name,'Retry checkpoint');assert.equal(retried.songVersions.checkpoints.at(-1).sessionId,before.songVersions.sessions[0].id)}
   else if(['versionApply','versionUndo','versionRedo'].includes(entry)){assert.equal(retried.songVersions.edits.length,before.songVersions.edits.length+1);assert.equal(retried.songVersions.edits.at(-1).source,'checkpoint-history');assert.equal(retried.songVersions.edits.at(-1).sessionId,before.songVersions.sessions[0].id);assert.deepEqual(retried.songVersions.days,before.songVersions.days);assert.equal(retried.songVersions.cursor,before.songVersions.cursor+(entry==='versionUndo'?-1:1));if(entry==='versionUndo')assert.equal(retried.productionNotes,'Before interrupted adoption');else assert.equal(retried.productionNotes,before.songVersions.checkpoints.at(-1).snapshot.productionNotes)}
   else if(['pcmApply','pcmImportLongFile'].includes(entry)){assert.equal(retried.songVersions.edits.length,before.songVersions.edits.length+1);assert.equal(retried.songVersions.edits.at(-1).source,'audio-editor');assert.equal(retried.songVersions.edits.at(-1).sessionId,before.songVersions.sessions[0].id);assert.deepEqual(retried.songVersions.days,before.songVersions.days);if(entry==='pcmApply'){assert.deepEqual(retried.pcmMix.assets.at(-1).original,before.pcmMix.assets.at(-1).original);assert.equal(retried.pcmMix.assets.at(-1).cursor,1);assert.equal(retried.pcmMix.assets.at(-1).gains[1],-6)}else{assert.equal(retried.longWavAssets.length,(before.longWavAssets||[]).length+1);assert.deepEqual(await resumed.evaluate(async assetId=>{const a=MusicStudio,r=a.indexedDbRepository(),actual=await r.getLongWav(assetId);return Array.from(new Uint8Array(await actual.blob.arrayBuffer()))},retried.longWavAssets.at(-1).id),await resumed.evaluate(()=>Array.from(new Uint8Array(MusicStudio.pcmEncodeWav({sampleRate:48000,channels:[[0,.25,-.25,0]]})))))} }
   else if(entry==='saveLyricsAssignment'){assert.equal(retried.songVersions.edits.length,before.songVersions.edits.length+1);assert.equal(retried.songVersions.edits.at(-1).source,'lyrics-editor');assert.equal(retried.songVersions.edits.at(-1).sessionId,before.songVersions.sessions[0].id);assert.deepEqual(retried.songVersions.days,before.songVersions.days);assert.deepEqual(retried.midiData,before.midiData);assert.equal(retried.syllableAssignments.length,(before.syllableAssignments||[]).length+1);assert.equal(retried.syllableAssignments.at(-1).assignments[0].token,'きみ')}
   else if(entry==='productionSessionSave'){assert.ok(retried.songVersions.sessions.at(-1).endedAt);assert.equal(retried.songVersions.sessions.at(-1).endNote,'Retried finish')}
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
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||chromium.executablePath()});const page=await browser.newPage();page.on('pageerror',e=>console.error('LYRIC_PAGE_ERROR',e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({url:'http://127.0.0.1:'+server.address().port+'/music-studio.js'});
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
test('real IndexedDB committed checkpoint actions preserve replacement views',{timeout:60000},async()=>{
 const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':req.url==='/app.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8'});res.end(req.url==='/app.js'?fs.readFileSync('music-studio.js'):'<!doctype html><body></body>')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||chromium.executablePath(),args:['--no-sandbox']});
  const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({url:'http://127.0.0.1:'+server.address().port+'/app.js'});
  const results=await page.evaluate(async()=>{
   const a=MusicStudio,results=[];
   for(const action of ['save','apply','undo','redo','fork','session','day'])for(const mode of ['repository','view','cancel']){
    const repo=a.indexedDbRepository(),id='context-'+action+'-'+mode;let p=a.makeProject({projectId:id,projectName:id,productionNotes:'original'});await repo.put(p);a.setRepository(repo);a.state.projects=[p];a.state.settings=a.defaultSettings();
    const requireOK=r=>{if(!r.ok)throw Error(r.error);return r};requireOK(await a.versionSave(id,'Finished',{kind:'finished'}));p=await repo.get(id);p.productionNotes='edited';p.revision++;await repo.put(p);a.state.projects=[p];const checkpoint=p.songVersions.checkpoints[0].id;
    if(['apply','undo','redo'].includes(action))requireOK(a.versionPreview(id,checkpoint,['notes']));
    if(['undo','redo'].includes(action))requireOK(await a.versionApply(id));if(action==='redo')requireOK(await a.versionUndoRedo(id,-1));
    const before=JSON.stringify(await repo.get(id)),replacement=a.makeProject({projectId:'other',projectName:'Other'}),other=a.memoryRepository([replacement]),method=action==='fork'?'compareAndFork':'compareAndPut',original=repo[method].bind(repo);let expected;
    repo[method]=async(...args)=>{await original(...args);if(mode==='repository')a.setRepository(other);if(mode==='cancel')a.versionCancel();a.state.projects=[replacement];a.versionPanel.message='new view';expected=JSON.stringify(a.state.projects)};
    const result=requireOK(await(action==='save'?a.versionSave(id,'New'):action==='apply'?a.versionApply(id):action==='fork'?a.finishedOpen(id,checkpoint):action==='session'?a.productionSessionSave(id,'start','Session'):action==='day'?a.productionDaySave(id,'2026-11-07','Day'):a.versionUndoRedo(id,action==='undo'?-1:1)));
    if(!result.committed||!result.refreshPending||JSON.stringify(a.state.projects)!==expected||a.versionPanel.message!=='new view')throw Error(action+'/'+mode+' replaced new view');
    const saved=await a.indexedDbRepository().get(result.project.projectId);if(JSON.stringify(saved)!==JSON.stringify(result.project))throw Error('committed receipt mismatch');
    if((await other.list()).length!==1)throw Error('replacement storage was written');if(action==='fork'&&JSON.stringify(await a.indexedDbRepository().get(id))!==before)throw Error('fork changed source');
    results.push(action+'/'+mode);
   }return results;
  });assert.equal(results.length,21);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
});

test('real IndexedDB durable duplication defers publication into changed contexts',{timeout:60000},async()=>{
 const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':req.url==='/app.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8'});res.end(req.url==='/app.js'?fs.readFileSync('music-studio.js'):'<!doctype html><body></body>')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||chromium.executablePath(),args:['--no-sandbox']});
  const context=await browser.newContext(),page=await context.newPage(),origin='http://127.0.0.1:'+server.address().port;await page.goto(origin);await page.addScriptTag({url:origin+'/app.js'});await page.waitForFunction(()=>MusicStudio.state.loaded);
  const receipts=await page.evaluate(async()=>{
   const a=MusicStudio,receipts=[];
   for(const phase of ['commit','refresh'])for(const mode of ['repository','view','dirty','midi','route','read-failure']){
    location.hash='#music-studio';a.state.dirty=false;a.state.midiEditor=null;
    const repo=a.indexedDbRepository(),id='duplicate-'+phase+'-'+mode,p=a.makeProject({projectId:id,projectName:id});await repo.put(p);a.setRepository(repo);a.state.projects=[p];
    const other=a.memoryRepository(),replacement=a.makeProject({projectId:'other',projectName:'Other'});await other.put(replacement);
    const list=repo.list.bind(repo),fork=repo.compareAndFork.bind(repo);let expected;
    const change=()=>{if(mode==='read-failure')throw Error('read-failed');if(mode==='repository')a.setRepository(other);if(['repository','view'].includes(mode))a.state.projects=[replacement];if(mode==='dirty')a.state.dirty=true;if(mode==='midi')a.state.midiEditor={projectId:'other',sentinel:'new editor'};if(mode==='route')location.hash='#music-studio/current';expected=JSON.stringify(a.state.projects)};
    if(phase==='commit')repo.compareAndFork=async(...args)=>{await fork(...args);if(mode==='read-failure')repo.list=async()=>{throw Error('read-failed')};else change()};else repo.list=async()=>{change();return list()};
    const r=await a.duplicateProject(id);if(!r.ok||!r.committed||!r.refreshPending)throw Error(phase+'/'+mode+': '+JSON.stringify(r));
    if(expected&&JSON.stringify(a.state.projects)!==expected)throw Error('view replaced');if(location.hash!==(mode==='route'?'#music-studio/current':'#music-studio'))throw Error('route replaced');if(mode==='dirty'&&!a.state.dirty)throw Error('dirty cleared');if(mode==='midi'&&a.state.midiEditor?.sentinel!=='new editor')throw Error('editor replaced');
    if(JSON.stringify(await repo.get(id))!==JSON.stringify(p))throw Error('source changed');if(JSON.stringify(await repo.get(r.project.projectId))!==JSON.stringify(r.project))throw Error('receipt mismatch');if((await other.list()).length!==1)throw Error('replacement repository changed');receipts.push({source:id,copy:r.project.projectId});
   }
   a.state.dirty=false;a.state.midiEditor=null;return receipts;
  });assert.equal(receipts.length,12);
  await page.close();const reopened=await context.newPage();await reopened.goto(origin);await reopened.addScriptTag({url:origin+'/app.js'});await reopened.waitForFunction(()=>MusicStudio.state.loaded);
  assert.equal(await reopened.evaluate(async receipts=>{const repo=MusicStudio.indexedDbRepository();for(const r of receipts){const source=await repo.get(r.source),copy=await repo.get(r.copy);if(!source||copy?.productionHistory?.at(-1)?.sourceProjectId!==r.source||copy.productionHistory.at(-1).sourceRevision!==source.revision)return false}return true},receipts),true);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
});
