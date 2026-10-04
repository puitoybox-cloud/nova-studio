const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined});
for(const width of [1440,820,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});const messages=[],external=[];
 page.on('console',m=>{if(['error','warning'].includes(m.type()))messages.push(m.text())});page.on('pageerror',e=>messages.push(e.message));
 await page.route('**/*',r=>{external.push(r.request().url());return r.abort()});
 await page.goto('about:blank');await page.addScriptTag({path:path.resolve('music-studio.js')});
 // about:blank has no IndexedDB origin; use a routed synthetic origin with no network.
 await page.unroute('**/*');await page.route('**/*',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));await page.goto('http://nova-isolated.test');await page.addScriptTag({path:path.resolve('music-studio.js')});
 const result=await page.evaluate(async()=>{
 const app=MusicStudio;const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(app.DB_NAME,5);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 const native=IDBObjectStore.prototype.put;let mode='abort',successSeen=false,completeSeen=false;
 IDBObjectStore.prototype.put=function(...args){const r=native.apply(this,args),tx=this.transaction;r.addEventListener('success',()=>{successSeen=true;if(mode==='abort')tx.abort();if(mode==='error'){tx.dispatchEvent(new Event('error'))} });tx.addEventListener('complete',()=>completeSeen=true);return r};
 const repo=app.indexedDbRepository(),p=app.makeProject({projectName:'isolated',projectId:'late-abort',unknown:{keep:true}});let rejected=false;
 try{await repo.put(p)}catch(e){rejected=true}if(!rejected||!successSeen||await repo.has(p.projectId))throw Error('late abort falsely succeeded');
 mode='error';rejected=false;try{await repo.put(p)}catch(e){rejected=true}if(!rejected||await repo.has(p.projectId))throw Error('transaction error falsely succeeded');
 mode='complete';await repo.put(p);if(!completeSeen||(await repo.get(p.projectId)).unknown.keep!==true)throw Error('normal retry failed');
 app.setRepository(repo);const bad={...p,projectId:'invalid',schemaVersion:999};const backup={format:app.BACKUP_FORMAT,version:app.BACKUP_VERSION,projects:[{...p,projectId:'must-not-publish'},bad]};const restored=await app.restoreBackup(backup,{settings:false});if(restored.ok||await repo.has('must-not-publish'))throw Error('preflight published partial state');
 IDBObjectStore.prototype.put=native;db.close();return{lateAbort:true,error:true,complete:true,retry:true,preflight:true};
 });assert.equal(messages.length,0);console.log(JSON.stringify({width,result,console:messages,external}));await page.close();
}await browser.close()})().catch(e=>{console.error(e);process.exitCode=1});
