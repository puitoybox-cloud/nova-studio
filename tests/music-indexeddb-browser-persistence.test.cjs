'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {chromium}=require('playwright');
test('real Chromium IndexedDB persists production history and backup restore across browser restart',async()=>{
 const script=fs.readFileSync('music-studio.js');
 const server=http.createServer((req,res)=>{if(req.url==='/music-studio.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(script)}else{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html><body></body></html>')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const dir=fs.mkdtempSync('/tmp/nova-indexeddb-');
 let browser;
 try{
  const launch=()=>chromium.launchPersistentContext(dir,{headless:true});
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
  await browser.close();browser=null;
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
  // Simulate an abrupt Chromium renderer crash, not a graceful page close.
  // This verifies already committed IndexedDB data; it does not prove
  // atomicity of an in-flight write or a full OS/process power failure.
  const crashPage=page;
  const crashed=new Promise(resolve=>crashPage.once('crash',resolve));
  const crashSession=await browser.newCDPSession(crashPage);
  // The DevTools command may never reply after it kills its own renderer.
  // Do not await its response: wait for the observable page crash instead.
  void crashSession.send('Page.crash').catch(()=>{});
  await Promise.race([crashed,new Promise((_,reject)=>setTimeout(()=>reject(Error('Renderer did not crash within 10 seconds')),10000))]);
  const recoveredPage=await browser.newPage();
  await recoveredPage.goto(origin);
  await recoveredPage.addScriptTag({url:origin+'/music-studio.js'});
  const recovered=await recoveredPage.evaluate(async()=>{
   const repo=window.MusicStudio.indexedDbRepository();
   const projects=await repo.list();
   return projects.map(p=>({id:p.projectId,sessions:p.songVersions?.sessions,days:p.songVersions?.days,checkpoints:p.songVersions?.checkpoints?.map(x=>({id:x.id,name:x.name}))}));
  });
  assert.equal(recovered.length,2,'renderer crash must not remove committed projects');
  for(const id of [expected.sourceId,expected.importedId]){
   const item=recovered.find(p=>p.id===id);
   assert.ok(item,'project must survive renderer crash: '+id);
   assert.deepEqual(item.sessions,expected.sessions);
   assert.deepEqual(item.days,expected.days);
   assert.deepEqual(item.checkpoints,expected.checkpoints);
  }
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})}
});
