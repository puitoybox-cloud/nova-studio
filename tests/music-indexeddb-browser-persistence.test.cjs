'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {chromium}=require('playwright');
test('real Chromium IndexedDB persists production sessions, days and checkpoints across browser restart',async()=>{
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
   return {sessions:project.songVersions.sessions,days:project.songVersions.days,checkpoints:project.songVersions.checkpoints.map(x=>({id:x.id,name:x.name}))};
  });
  await browser.close();browser=null;
  browser=await launch();
  page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin);await page.addScriptTag({url:origin+'/music-studio.js'});
  assert.equal(await page.evaluate(()=>typeof window.MusicStudio),'object','MusicStudio failed to reload: '+errors.join(' | '));
  const actual=await page.evaluate(async()=>{
   const app=window.MusicStudio;const project=await app.indexedDbRepository().get('chromium-restart-history');
   if(!project)throw Error('IndexedDB project missing after Chromium restart');
   return {sessions:project.songVersions.sessions,days:project.songVersions.days,checkpoints:project.songVersions.checkpoints.map(x=>({id:x.id,name:x.name}))};
  });
  assert.deepEqual(actual,expected);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})}
});
