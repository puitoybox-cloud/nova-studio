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
 const native=IDBObjectStore.prototype.put;let mode='abort',successSeen=false,completeSeen=false,completeResolve;const observedComplete=new Promise(resolve=>{completeResolve=resolve});
 IDBObjectStore.prototype.put=function(...args){const r=native.apply(this,args),tx=this.transaction;r.addEventListener('success',()=>{successSeen=true;if(mode==='abort')tx.abort();if(mode==='error'){tx.dispatchEvent(new Event('error'))} });tx.addEventListener('complete',()=>{completeSeen=true;completeResolve()});return r};
 const repo=app.indexedDbRepository(),p=app.makeProject({projectName:'isolated',projectId:'late-abort'});p.unknown={keep:true};let rejected=false;try{
 try{await repo.put(p)}catch(e){rejected=true}if(!rejected||!successSeen||await repo.has(p.projectId))throw Error('late abort falsely succeeded');
 mode='error';rejected=false;try{await repo.put(p)}catch(e){rejected=true}if(!rejected||await repo.has(p.projectId))throw Error('transaction error falsely succeeded');
 mode='complete';const completionTiming={};await Promise.all([repo.put(p).then(()=>{completionTiming.observerAtProductionResolution=completeSeen}),observedComplete]);completionTiming.observerAfterExplicitWait=completeSeen;if(!completeSeen||(await repo.get(p.projectId)).unknown.keep!==true)throw Error('normal retry failed');
 app.setRepository(repo);const bad={...p,projectId:'invalid',schemaVersion:999};const backup={format:app.BACKUP_FORMAT,version:app.BACKUP_VERSION,projects:[{...p,projectId:'must-not-publish'},bad]};const restored=await app.restoreBackup(backup,{settings:false});if(restored.ok||await repo.has('must-not-publish'))throw Error('preflight published partial state');
  const atomicResults=[];
 const originalAdd=IDBObjectStore.prototype.add,originalPut=IDBObjectStore.prototype.put;
 try{
   const oldSettings=app.defaultSettings();oldSettings.projectDefaults.bpm=89;oldSettings.unknown={old:true};await repo.putSettings(oldSettings);
   for(const fault of ['abort','error','native-request-error','late-settings-error','Cancel','signal-Cancel','stale-input','superseded','synchronous-error']){
     const first={...p,projectId:`${fault}-first`},second={...p,projectId:`${fault}-second`};
     const value={format:app.BACKUP_FORMAT,version:app.BACKUP_VERSION,projects:[first,second],settings:{...app.defaultSettings(),unknown:{restored:true}}};
     const before=JSON.stringify({projects:await repo.list(),settings:await repo.getSettings()}),controller=new AbortController();let writes=0,successes=0,newer;
     function intercept(original){return function(...args){
       writes++;const tx=this.transaction;
       if(fault==='synchronous-error'&&writes===2)throw Error('injected-late-enqueue-failure');
       if(fault==='native-request-error'&&writes===2)args[0]={...args[0],projectId:p.projectId};
       const request=original.apply(this,args);
       request.addEventListener('success',()=>{
         successes++;
         if(successes===(fault==='late-settings-error'?3:2)){
           if(fault==='abort')tx.abort();
           if(fault==='error'||fault==='late-settings-error')tx.dispatchEvent(new Event('error'));
           if(fault==='Cancel')app.cancelBackupRestore();
           if(fault==='signal-Cancel')controller.abort();
           if(fault==='stale-input')value.projects[0].projectName='Changed during transaction';
           if(fault==='superseded')newer=app.restoreBackup({format:app.BACKUP_FORMAT,version:app.BACKUP_VERSION,projects:[]},{settings:false});
         }
       });return request;
     }}
     IDBObjectStore.prototype.add=intercept(originalAdd);IDBObjectStore.prototype.put=intercept(originalPut);
     const outcome=await app.restoreBackup(value,{signal:controller.signal});
     IDBObjectStore.prototype.add=originalAdd;IDBObjectStore.prototype.put=originalPut;
     if(outcome.ok||outcome.added!==0||outcome.committed!==false)throw Error('atomic fault falsely succeeded: '+fault);
     if(newer&&!(await newer).ok)throw Error('superseding operation failed');
     if(JSON.stringify({projects:await repo.list(),settings:await repo.getSettings()})!==before)throw Error('partial metadata publication: '+fault);
     const retry=await app.restoreBackup(value);if(!retry.ok||!retry.atomicMetadata||retry.added!==2)throw Error('atomic retry failed: '+fault);
     if((await repo.get(first.projectId)).unknown.keep!==true||(await repo.getSettings()).unknown.restored!==true)throw Error('atomic unknown fields lost');
     atomicResults.push({fault,failedClosed:true,noPartialPublication:true,retry:true,successesBeforeFailure:successes});
   }
   const badMidi={...p,projectId:'invalid-midi',midiData:{ppq:480,tracks:[{muted:true,notes:[{pitch:128,startTick:0,durationTicks:480,velocity:90}]}]}};
   const badDependency={...p,projectId:'invalid-dependency',audioAssets:[{assetId:'derived',derivedFromAssetId:'missing'}]};
   for(const bad of [badMidi,badDependency]){
     const before=JSON.stringify({projects:await repo.list(),settings:await repo.getSettings()});
     const outcome=await app.restoreBackup({format:app.BACKUP_FORMAT,version:app.BACKUP_VERSION,projects:[{...p,projectId:'no-partial'},bad],settings:app.defaultSettings()});
     if(outcome.ok||JSON.stringify({projects:await repo.list(),settings:await repo.getSettings()})!==before)throw Error('invalid second item partially published');
   }
   const externalProject={...p,projectId:'external-metadata',midiData:{editor:{view:{snapEnabled:false}}},audioAssets:[{assetId:'file',storage:{kind:'external',reference:'offline.wav'}},{assetId:'lost',missing:true},{assetId:'select',storage:{requiresReselection:true}},{assetId:'future',storage:{kind:'future'}}],legacy:{extensions:{keep:true}}};
   const externalOutcome=await app.restoreBackup({format:app.BACKUP_FORMAT,version:app.BACKUP_VERSION,projects:[externalProject]},{settings:false});
   if(!externalOutcome.ok||externalOutcome.preflight.completeBinaryBackup||externalOutcome.preflight.dependencies.some(d=>d.present!=='unverified'))throw Error('binary completeness falsely claimed');
   if(JSON.stringify(externalOutcome.preflight.dependencies.map(d=>d.status))!==JSON.stringify(['external','missing','reselection-required','unsupported']))throw Error('binary states collapsed');
   const loaded=await repo.get(externalProject.projectId);if(!loaded.legacy.extensions.keep||loaded.midiData.editor.view.snapEnabled!==false)throw Error('legacy lost');
 }finally{IDBObjectStore.prototype.add=originalAdd;IDBObjectStore.prototype.put=originalPut;if(app.state.intervalTimer)clearInterval(app.state.intervalTimer)}
 return{completionTiming,requestSuccess:successSeen,lateAbort:true,error:true,complete:true,retry:true,preflight:true,atomicResults,invalidSecondMidi:true,invalidSecondDependency:true,binaryStates:true,legacy:true};
 }finally{IDBObjectStore.prototype.put=native;db.close();await repo.close?.()}
 }), 'IndexedDB regression '+width);assert.deepEqual(messages,[]);assert.deepEqual(external,[]);const report={width,result,console:messages,external};reports.push(report);console.log(JSON.stringify(report));
 }finally{await bounded(page.close(),'page close',5000)}
}
 }finally{if(browser)await bounded(browser.close(),'browser close',5000);clearTimeout(deadline);fs.mkdirSync('verification',{recursive:true});fs.writeFileSync('verification/music-transaction-browser-report.json',JSON.stringify({head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),reports},null,2))}
})().catch(e=>{console.error(e);process.exitCode=1});
