const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const reports=[];let browser;
const deadline=setTimeout(()=>{console.error('Transaction regression exceeded 90 seconds');process.exit(1)},90000);
async function bounded(work,label,ms=15000){let timer;try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms)})])}finally{clearTimeout(timer)}}
(async()=>{try{browser=await chromium.launch({headless:true,timeout:15000,executablePath:process.env.CHROME_EXECUTABLE||undefined});
for(const width of [1440,820,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});const messages=[],external=[];
 page.on('console',m=>{if(['error','warning'].includes(m.type()))messages.push({type:m.type(),text:m.text()})});page.on('pageerror',e=>messages.push({type:'pageerror',text:e.message}));
 try{
 await page.route('**/*',r=>{if(r.request().url()==='http://nova-isolated.test/')return r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body></body></html>'});external.push(r.request().url());return r.abort()});
 await page.goto('http://nova-isolated.test');await page.addScriptTag({path:path.resolve('music-studio.js')});
 const result=await bounded(page.evaluate(async()=>{
 const app=MusicStudio;const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(app.DB_NAME,5);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('fixture DB blocked'))});
 const native=IDBObjectStore.prototype.put;let mode='abort',successSeen=false,completeSeen=false;
 IDBObjectStore.prototype.put=function(...args){const r=native.apply(this,args),tx=this.transaction;r.addEventListener('success',()=>{successSeen=true;if(mode==='abort')tx.abort();if(mode==='error'){tx.dispatchEvent(new Event('error'))} });tx.addEventListener('complete',()=>completeSeen=true);return r};
 const repo=app.indexedDbRepository(),p=app.makeProject({projectName:'isolated',projectId:'late-abort'});p.unknown={keep:true};let rejected=false;try{
 try{await repo.put(p)}catch(e){rejected=true}if(!rejected||!successSeen||await repo.has(p.projectId))throw Error('late abort falsely succeeded');
 mode='error';rejected=false;try{await repo.put(p)}catch(e){rejected=true}if(!rejected||await repo.has(p.projectId))throw Error('transaction error falsely succeeded');
 mode='complete';await repo.put(p);if(!completeSeen||(await repo.get(p.projectId)).unknown.keep!==true)throw Error('normal retry failed');
 app.setRepository(repo);const bad={...p,projectId:'invalid',schemaVersion:999};const backup={format:app.BACKUP_FORMAT,version:app.BACKUP_VERSION,projects:[{...p,projectId:'must-not-publish'},bad]};const restored=await app.restoreBackup(backup,{settings:false});if(restored.ok||await repo.has('must-not-publish'))throw Error('preflight published partial state');
 return{requestSuccess:successSeen,lateAbort:true,error:true,complete:true,retry:true,preflight:true};
 }finally{IDBObjectStore.prototype.put=native;db.close();await repo.close?.()}
 }), 'IndexedDB regression '+width);assert.deepEqual(messages,[]);assert.deepEqual(external,[]);const report={width,result,console:messages,external};reports.push(report);console.log(JSON.stringify(report));
 }finally{await bounded(page.close(),'page close',5000)}
}
 }finally{if(browser)await bounded(browser.close(),'browser close',5000);clearTimeout(deadline);fs.mkdirSync('verification',{recursive:true});fs.writeFileSync('verification/music-transaction-browser-report.json',JSON.stringify({head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),reports},null,2))}
})().catch(e=>{console.error(e);process.exitCode=1});
