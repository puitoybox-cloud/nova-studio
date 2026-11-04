'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
test('real Chromium IndexedDB persists production history and backup restore across browser restart',{timeout:240000},async()=>{
 const script=fs.readFileSync('music-studio.js');
 const server=http.createServer((req,res)=>{if(req.url==='/music-studio.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(script)}else{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html><body></body></html>')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const dir=fs.mkdtempSync('/tmp/nova-indexeddb-');
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
  assert.ok(fs.existsSync(chromium.executablePath()),'Playwright Chromium must be installed');
  processHandle=spawn(chromium.executablePath(),['--headless','--no-sandbox','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{detached:true,stdio:'ignore'});
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
   const song=app.makeProject({projectId:'chromium-restart-history',projectName:'Browser durable history'});
   await repo.put(song);
   app.state.projects=[song];
   for(const [method,args] of [['productionSessionSave',['chromium-restart-history','start','Session']],['productionDaySave',['chromium-restart-history','2026-11-03','Day']],['versionSave',['chromium-restart-history','Checkpoint']]]){
    const result=await app[method](...args);if(!result.ok)throw Error(method+': '+JSON.stringify(result));
   }
   const project=await repo.get('chromium-restart-history');
   const backup=app.backupObject();
   const restored=await app.restoreBackup(backup,{settings:false});
   if(!restored.ok||!restored.committed)throw Error('IndexedDB restore failed: '+JSON.stringify(restored));
   const imported=(await repo.list()).filter(p=>p.projectId!=='chromium-restart-history');
   if(imported.length!==1)throw Error('Expected one imported project; got '+imported.length);
   const restoredProject=await repo.get(imported[0].projectId);
   if(!restoredProject)throw Error('Imported project missing before restart');
   return {sourceId:project.projectId,importedId:restoredProject.projectId,sessions:project.songVersions.sessions,days:project.songVersions.days,checkpoints:project.songVersions.checkpoints.map(x=>({id:x.id,name:x.name}))};
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
   const history=p=>({sessions:p.songVersions.sessions,days:p.songVersions.days,checkpoints:p.songVersions.checkpoints.map(x=>({id:x.id,name:x.name}))});
   return {sourceId:project.projectId,importedId:restored.projectId,source:history(project),imported:history(restored)};
  });
  assert.equal(actual.sourceId,expected.sourceId);
  assert.equal(actual.importedId,expected.importedId);
  for(const history of [actual.source,actual.imported]){
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
   return projects.map(p=>({id:p.projectId,sessions:p.songVersions?.sessions,days:p.songVersions?.days,checkpoints:p.songVersions?.checkpoints?.map(x=>({id:x.id,name:x.name}))}));
  });
  assert.equal(recovered.length,2,'browser SIGKILL must not remove committed projects');
  for(const id of [expected.sourceId,expected.importedId]){
   const item=recovered.find(p=>p.id===id);
   assert.ok(item,'project must survive browser SIGKILL: '+id);
   assert.deepEqual(item.sessions,expected.sessions);
   assert.deepEqual(item.days,expected.days);
   assert.deepEqual(item.checkpoints,expected.checkpoints);
  }
  // Exercise public save entries against real IDB. A successful request is held
  // inside its transaction until the test-owned browser is killed.
  let activePage=recoveredPage;
  await activePage.evaluate(async()=>{
   const app=MusicStudio,repo=app.indexedDbRepository();app.setRepository(repo);
   const p=await repo.get('chromium-restart-history');
   p.midiData={version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},totalTick:480,tracks:[{id:'lead',channel:1,notes:[{id:'n',pitch:60,startTick:0,durationTicks:480,velocity:80}]}]};
   p.revision++;await repo.put(p);app.state.projects=await repo.list();
   const r=await app.materialCapture(p.projectId,{name:'Crash fixture'});if(!r.ok)throw Error(r.error);
   const c=await app.versionSave(p.projectId,'Finished crash fixture',{kind:'finished'});if(!c.ok)throw Error(c.error);
  });
  const entries=['productionDaySave','productionSessionSave','versionSave','materialCapture','materialImport','importText','finishedOpen','restoreBackup','pcmImportLongFile'];
  async function openPage(){browser=await launch();const page=await browser.newPage();await page.goto(origin);await page.addScriptTag({url:origin+'/music-studio.js'});return page}
  async function invoke(page,entry,hold){return page.evaluate(async({entry,hold})=>{
   const app=MusicStudio,repo=app.indexedDbRepository();app.setRepository(repo);app.state.projects=await repo.list();app.state.settings=app.defaultSettings();
   const p=await repo.get('chromium-restart-history');
   if(hold)for(const method of ['put','add']){
    const original=IDBObjectStore.prototype[method];
    IDBObjectStore.prototype[method]=function(value,...args){
     const request=original.call(this,value,...args);
     if(this.name==='longWavBinaries'&&value?.id)console.log('NOVA_BINARY_ID '+value.id);
     if(value?.projectId)request.addEventListener('success',()=>{
      const store=this;const keepAlive=()=>{const next=store.get(value.projectId);next.onsuccess=keepAlive};
      keepAlive();console.log('NOVA_TRANSACTION_ACTIVE');
     });return request;
    };
   }
   const actions={
    pcmImportLongFile:()=>{app.pcmOpen(p.projectId);const file=new Blob([app.pcmEncodeWav({sampleRate:48000,channels:[Array.from({length:4800},(_,i)=>.1*Math.sin(i*.1))]})],{type:'audio/wav'});file.name='Crash-matrix.wav';return app.pcmImportLongFile(file,p.projectId)},
    productionDaySave:()=>app.productionDaySave(p.projectId,'2026-11-04','Crash matrix day'),
    productionSessionSave:()=>app.productionSessionSave(p.projectId,'finish','Crash matrix finish'),
    versionSave:()=>app.versionSave(p.projectId,'Crash matrix checkpoint'),
    materialCapture:()=>app.materialCapture(p.projectId,{name:'Crash matrix material'}),
    materialImport:()=>{const text=JSON.stringify({format:'nova-midi-library-v1',materials:[p.materialLibrary[0]]});return app.materialImport(p.projectId,{size:text.length,text:async()=>text})},
    importText:()=>app.importText(JSON.stringify(p)),
    finishedOpen:()=>app.finishedOpen(p.projectId,p.songVersions.checkpoints.find(c=>c.kind==='finished').id),
    restoreBackup:()=>app.restoreBackup(app.backupObject(),{settings:false})
   };
   const pending=actions[entry]();
   if(hold){window.pendingSave=pending;pending.then(r=>console.log('NOVA_EARLY_RESULT '+JSON.stringify(r)));return null}
   return pending;
  },{entry,hold})}
  for(const entry of entries){
   const before=await activePage.evaluate(async()=>await MusicStudio.indexedDbRepository().list());
   let timer,listener,binaryId;
   const armed=new Promise((resolve,reject)=>{
    listener=m=>{if(m.text().startsWith('NOVA_BINARY_ID '))binaryId=m.text().slice(15);if(m.text()==='NOVA_TRANSACTION_ACTIVE')resolve();if(m.text().startsWith('NOVA_EARLY_RESULT'))reject(Error(entry+': '+m.text()))};
    activePage.on('console',listener);timer=setTimeout(()=>reject(Error(entry+': transaction never active')),10000);
   });
   try{await Promise.all([armed,invoke(activePage,entry,true)])}finally{clearTimeout(timer);activePage.off('console',listener)}
   await stop('SIGKILL');activePage=await openPage();
   assert.deepEqual(await activePage.evaluate(async()=>await MusicStudio.indexedDbRepository().list()),before,entry+': interrupted transaction must retain every project and history');
   if(binaryId)assert.equal(await activePage.evaluate(async id=>(await MusicStudio.indexedDbRepository().getLongWav(id))??null,binaryId),null,entry+': aborted binary must not leak');
   const result=await invoke(activePage,entry,false);assert.equal(result.ok,true,entry+': retry failed '+JSON.stringify(result));
   const committed=await activePage.evaluate(async()=>await MusicStudio.indexedDbRepository().list());
   assert.notDeepEqual(committed,before,entry+': retry must publish a change');
   const binaryBytes=async page=>page.evaluate(async()=>{const repo=MusicStudio.indexedDbRepository(),rows=[];for(const p of await repo.list())for(const asset of p.longWavAssets||[]){const r=await repo.getLongWav(asset.id);if(!r?.blob)throw Error('Committed binary missing');rows.push({id:asset.id,bytes:Array.from(new Uint8Array(await r.blob.arrayBuffer()))})}return rows});
   const committedBytes=await binaryBytes(activePage);
   await stop('SIGKILL');activePage=await openPage();
   assert.deepEqual(await binaryBytes(activePage),committedBytes,entry+': binary bytes must survive SIGKILL');
   assert.deepEqual(await activePage.evaluate(async()=>await MusicStudio.indexedDbRepository().list()),committed,entry+': complete committed state must survive SIGKILL');
   console.log('Verified interruption, retry and committed restart: '+entry);
  }
 }finally{await stop();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})}
});
