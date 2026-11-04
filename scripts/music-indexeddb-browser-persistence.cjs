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
  // Deterministically interrupt a production daily-history save after the put
  // request succeeds but before its transaction can commit. Keep the transaction
  // active with real IDB requests; do not replace the repository with a mock.
  const before=await recoveredPage.evaluate(async()=>await MusicStudio.indexedDbRepository().get('chromium-restart-history'));
  const armed=new Promise(resolve=>recoveredPage.on('console',m=>{if(m.text()==='NOVA_TRANSACTION_ACTIVE')resolve()}));
  await recoveredPage.evaluate(()=>{
   const original=IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put=function(value,...args){
    const request=original.call(this,value,...args);
    if(value?.projectId==='chromium-restart-history'){
     request.addEventListener('success',()=>{
      const store=this;
      const keepAlive=()=>{const next=store.get(value.projectId);next.onsuccess=keepAlive};
      keepAlive();console.log('NOVA_TRANSACTION_ACTIVE');
     });
    }
    return request;
   };
   const app=MusicStudio;app.setRepository(app.indexedDbRepository());
   window.pendingSave=app.indexedDbRepository().get('chromium-restart-history').then(p=>{
    app.state.projects=[p];return app.productionDaySave(p.projectId,'2026-11-04','Must not partially publish');
   });
   window.pendingSave.then(()=>console.log('NOVA_UNEXPECTED_COMMIT'));
  });
  let timer;
  try{await Promise.race([armed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('write transaction never became active')),10000)})])}finally{clearTimeout(timer)}
  await stop('SIGKILL');browser=await launch();
  const resumed=await browser.newPage();await resumed.goto(origin);await resumed.addScriptTag({url:origin+'/music-studio.js'});
  assert.deepEqual(await resumed.evaluate(async()=>await MusicStudio.indexedDbRepository().get('chromium-restart-history')),before,'interrupted transaction must preserve the complete prior project and history');
  assert.equal(await resumed.evaluate(async()=>{const app=MusicStudio,repo=app.indexedDbRepository();app.setRepository(repo);app.state.projects=await repo.list();return (await app.productionDaySave('chromium-restart-history','2026-11-04','Retry after crash')).ok}),true,'save must work after process restart');
  assert.equal(await resumed.evaluate(async()=> (await MusicStudio.indexedDbRepository().get('chromium-restart-history')).songVersions.days.find(d=>d.day==='2026-11-04')?.note),'Retry after crash');
 }finally{await stop();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})}
});
