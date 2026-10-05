/* Synthetic offline Real Chrome generations; never opens user origin or selects storage policy. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
let browser;const reports=[];
const watchdog=setTimeout(()=>{console.error('Binary browser watchdog exceeded');process.exit(1)},90000);
async function bound(p,ms=15000){let t;try{return await Promise.race([p,new Promise((_,reject)=>t=setTimeout(()=>reject(Error('browser-timeout')),ms))])}finally{clearTimeout(t)}}
(async()=>{try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined,timeout:15000});
 for(const width of [1440,820,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),messages=[],external=[];
  page.on('console',m=>{if(['error','warning'].includes(m.type()))messages.push({type:m.type(),text:m.text()})});page.on('pageerror',e=>messages.push({type:'pageerror',text:e.message}));
  try{
   await page.route('**/*',r=>{if(r.request().url()==='http://nova-binary-isolated.test/')return r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><body>Isolated binary contract</body>'});external.push(r.request().url());return r.abort()});await page.goto('http://nova-binary-isolated.test/');
   await page.addScriptTag({path:'music-studio-binary-boundary.js'});await page.addScriptTag({path:'music-studio.js'});await page.waitForFunction(()=>MusicStudio.state.loaded,{},{timeout:15000});
   const result=await bound(page.evaluate(async()=>{
    const app=MusicStudio,boundary=MusicStudioBinaryBoundary,repo=app.memoryRepository();app.setRepository(repo);
    const p=app.makeProject({projectId:'synthetic',projectName:'binary fixture'});p.unknown={keep:true};p.audioAssets=[{assetId:'a',size:3,storage:{kind:'external',reference:'https://must-never-fetch.invalid/a.wav'}}];
    const value={format:app.BACKUP_FORMAT,version:app.BACKUP_VERSION,projects:[p],settings:app.defaultSettings(),unknown:{keep:true}},read=()=>({status:'available',bytes:new Uint8Array([1,2,3])});
    const check=(v,msg)=>{if(!v)throw Error(msg)},cases=[];
    for(const status of ['available','missing','external','permission-unavailable','reselection-required','unsupported','ambiguous']){const r=await boundary.resolve(value,{resolver:()=>({...read(),status})});check(r.dependencies[0].status===status,status);cases.push(status)}
    check(!(await boundary.resolve(value,{resolver:()=>({status:'available',bytes:new Uint8Array([1])})})).complete,'size mismatch');cases.push('byte mismatch');
    for(const mode of ['Cancel','stale']){let release;const copy=structuredClone(value),pending=app.restoreBackup(copy,{binaryMode:'complete',binaryResolver:()=>new Promise(r=>release=r)});await Promise.resolve();if(mode==='Cancel')app.cancelBackupRestore();else copy.unknown.changed=true;release(read());check(!(await pending).ok&&!(await repo.has('synthetic')),mode);cases.push(mode)}
    check(!(await app.restoreBackup(value,{binaryMode:'complete',binaryResolver:read})).ok,'metadata-only adapter bypass');
    const open=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('synthetic-binary-generation-fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('generation');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    let db=await open(),fault='';
    const adapter={metadataRepository:repo,atomicGeneration:true,restoreGeneration(g,control){return new Promise((resolve,reject)=>{
     const tx=db.transaction('generation','readwrite'),store=tx.objectStore('generation');control.abort=()=>tx.abort();
     tx.onabort=()=>reject(Error('generation-abort'));tx.onerror=()=>{try{tx.abort()}catch{}};tx.oncomplete=()=>{control.abort=null;resolve({projects:g.snapshot.projects,settings:g.settings})};
     const staged={snapshot:g.snapshot,settings:g.settings,binaries:g.binaries};
     const request=store.put(staged,'current');request.onsuccess=()=>{if(fault==='late-binary'||fault==='metadata')tx.abort();if(fault==='Cancel')app.cancelBackupRestore();if(fault==='stale')value.unknown.changed=true;if(control.reason())try{tx.abort()}catch{}};
    })}};
    const reload=async()=>{db.close();db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('generation'),r=tx.objectStore('generation').get('current');let v;r.onsuccess=()=>v=r.result;tx.oncomplete=()=>resolve(v);tx.onabort=()=>reject(Error('reload-abort'))})};
    for(const mode of ['late-binary','metadata','Cancel','stale']){
     fault=mode;const r=await app.restoreBackup(value,{binaryMode:'complete',binaryResolver:read,generationAdapter:adapter});check(!r.ok,mode+' succeeded');check(await reload()===undefined,mode+' partial publication');delete value.unknown.changed;cases.push(mode+' rollback');
    }
    fault='';const report=await boundary.resolve(value,{resolver:read}),restored=await app.restoreBackup(value,{binaryMode:'complete',binaryResolver:read,generationAdapter:adapter});check(restored.ok&&restored.outcome==='complete','retry failed');
    check((await boundary.verifyRecovery(restored.binaryPreflight,reload)).accepted,'reopen whole generation');cases.push('retry + reload recovery');
    const mismatch=await reload();mismatch.binaries[0].bytes[1]=99;check(!(await boundary.verifyRecovery(restored.binaryPreflight,async()=>mismatch)).accepted,'recovery mismatch');cases.push('recovery mismatch');
    const incomplete=await app.inspectBackupCompleteness(value),complete=await app.inspectBackupCompleteness(value,{packageResolver:read});check(!incomplete.binaryComplete&&complete.fullBackupComplete,'completeness');
    const legacy=structuredClone(value);legacy.projects[0].audioAssets=[];check((await app.restoreBackup(legacy)).outcome==='metadata-only','legacy');check((await repo.get('synthetic')).unknown.keep===true,'unknown fields');db.close();
    return{cases,pass:true};
   }));
   assert.deepEqual(messages,[]);assert.deepEqual(external,[]);reports.push({width,...result,messages,external});await page.screenshot({path:`verification/music-binary-${width}.png`});
  }finally{await bound(page.close(),5000)}
 }
 fs.writeFileSync('verification/music-binary-browser-report.json',JSON.stringify({head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),reports},null,2));
}finally{if(browser)await bound(browser.close(),5000);clearTimeout(watchdog)}})().catch(e=>{console.error(e);process.exitCode=1});
