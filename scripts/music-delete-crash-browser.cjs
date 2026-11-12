'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),{spawn}=require('node:child_process'),{once}=require('node:events'),{chromium}=require('playwright');
test('journal and backup deletions roll back on SIGKILL and commit completely on retry',{timeout:120000},async()=>{
 const source=fs.readFileSync('music-studio.js'),server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':req.url==='/app.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8'});res.end(req.url==='/app.js'?source:'<!doctype html><body>Delete recovery</body>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,dir=fs.mkdtempSync('/tmp/nova-delete-crash-');let child,connection;
 async function stop(){if(!child)return;if(child.exitCode!==null||child.signalCode!==null){child=null;return}const exit=once(child,'exit');process.kill(-child.pid,'SIGKILL');const result=await exit;assert.equal(result[1],'SIGKILL');child=null;connection=null}
 async function open(){fs.rmSync(dir+'/DevToolsActivePort',{force:true});const executable=process.env.CHROME_EXECUTABLE||chromium.executablePath();assert.ok(fs.existsSync(executable),'Chromium executable missing');child=spawn(executable,['--headless','--no-sandbox','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{detached:true,stdio:'ignore'});const deadline=Date.now()+15000;while(!fs.existsSync(dir+'/DevToolsActivePort')){if(Date.now()>deadline)throw Error('browser-start-timeout');await new Promise(r=>setTimeout(r,25))}connection=await chromium.connectOverCDP('http://127.0.0.1:'+fs.readFileSync(dir+'/DevToolsActivePort','utf8').split('\n')[0]);const page=await connection.contexts()[0].newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.addScriptTag({url:origin+'/app.js'});assert.equal(await page.evaluate(()=>typeof window.MusicStudio),'object',errors.join(' | '));await page.evaluate(()=>{window.app=window.MusicStudio;window.repo=app.indexedDbRepository();app.setRepository(repo)});return page}
 try{
  let page=await open();
  await page.evaluate(async()=>{const meta={id:'journal',owner:'song',next:0,consumed:0,frames:0,rate:48000,updatedAt:1,closed:false};await repo.createVocalJournal(meta);await repo.appendVocalJournal('journal',0,new Int16Array([11,-22,33]).buffer,{test:'bytes'});const m=await repo.getVocalJournal('journal');await repo.sealVocalJournal('journal',m);await repo.putAutoBackup({backupId:'protected',createdAt:'2026-11-05T00:00:00Z',snapshot:{sentinel:'retained'}})});
  const expected=await page.evaluate(async()=>({meta:await repo.getVocalJournal('journal'),bytes:Array.from(new Uint8Array((await repo.getVocalJournalChunk('journal:0')).bytes)),backups:await repo.listAutoBackups()}));
  for(const kind of ['journal','backup']){
   await page.evaluate(kind=>{const original=IDBObjectStore.prototype.delete;IDBObjectStore.prototype.delete=function(key){const request=original.call(this,key),store=this;if(!window.deleteHeld){window.deleteHeld=true;const loop=()=>{const q=store.get(key);q.onsuccess=loop};loop()}return request};window.pendingDelete=kind==='journal'?repo.getVocalJournal('journal').then(m=>repo.deleteVocalJournal('journal',m)):repo.deleteAutoBackup('protected');},kind);
   await page.waitForFunction(()=>window.deleteHeld===true);await stop();page=await open();
   const actual=await page.evaluate(async()=>({meta:await repo.getVocalJournal('journal'),bytes:Array.from(new Uint8Array((await repo.getVocalJournalChunk('journal:0')).bytes)),backups:await repo.listAutoBackups()}));assert.deepEqual(actual,expected,kind+' interrupted transaction must restore exact metadata, bytes and backup');
  }
  // An in-transaction guard must abort before any journal chunk is deleted.
  assert.equal(await page.evaluate(async()=>{const m=await repo.getVocalJournal('journal');try{await repo.deleteVocalJournal('journal',m,()=>{throw Error('repository-switched')});return false}catch(e){return e.message==='repository-switched'&&!!await repo.getVocalJournalChunk('journal:0')}}),true);
  await page.evaluate(async()=>{await repo.deleteVocalJournal('journal',await repo.getVocalJournal('journal'));await repo.deleteAutoBackup('protected')});await stop();page=await open();
  assert.deepEqual(await page.evaluate(async()=>({meta:await repo.getVocalJournal('journal')||null,chunk:await repo.getVocalJournalChunk('journal:0')||null,backups:await repo.listAutoBackups()})),{meta:null,chunk:null,backups:[]});

  // Exercise the production Archive route against physical IndexedDB. Hold the
  // real add transaction only after a request succeeds, then kill the process.
  const archiveBytes=await page.evaluate(async()=>{
   await repo.putSettings(app.defaultSettings('2026-11-12T00:00:00.000Z'));
   const p=app.makeProject({projectId:'archive-source',projectName:'Protected Archive'});await repo.put(p);app.state.projects=[p];
   for(const [method,args] of [['productionSessionSave',[p.projectId,'start','Archive session']],['productionDaySave',[p.projectId,'2026-11-05','Archive day']]]){const r=await app[method](...args);if(!r.ok)throw Error(r.error)}
   const b=new ArrayBuffer(244),v=new DataView(b),tag=(at,text)=>Array.from(text).forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
   tag(0,'RIFF');v.setUint32(4,236,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);tag(36,'data');v.setUint32(40,200,true);for(let i=0;i<100;i++)v.setInt16(44+i*2,i*31-1500,true);
   app.pcmOpen(p.projectId);const file=new Blob([b],{type:'audio/wav'});file.name='archive-source.wav';const r=await app.pcmImportLongFile(file,p.projectId);if(!r.ok)throw Error(r.error);
   const bytes=new Int16Array([11,-22,33]).buffer,hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
   await repo.createVocalJournal({id:'archive-journal',format:'nova-vocal-journal-v1',owner:p.projectId,rate:48000,startTick:0,latencyMs:0,next:0,frames:0,consumed:0,updatedAt:1,closed:false});
   await repo.appendVocalJournal('archive-journal',0,bytes,[hash]);await repo.sealVocalJournal('archive-journal',await repo.getVocalJournal('archive-journal'));
   return Array.from(new Uint8Array(await (await app.createLongWavArchive()).arrayBuffer()));
  });
  async function snapshot(page){return page.evaluate(async()=>{
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(app.DB_NAME);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
   async function encode(x){if(x instanceof Blob)return{blob:Array.from(new Uint8Array(await x.arrayBuffer())),type:x.type};if(x instanceof ArrayBuffer)return{bytes:Array.from(new Uint8Array(x))};if(ArrayBuffer.isView(x))return{bytes:Array.from(new Uint8Array(x.buffer,x.byteOffset,x.byteLength))};if(Array.isArray(x))return Promise.all(x.map(encode));if(x&&typeof x==='object')return Object.fromEntries(await Promise.all(Object.entries(x).map(async([k,v])=>[k,await encode(v)])));return x}
   try{return Object.fromEntries(await Promise.all(Array.from(db.objectStoreNames).map(async name=>{const rows=await new Promise((resolve,reject)=>{const r=db.transaction(name).objectStore(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return[name,await encode(rows)]})))}finally{db.close()}
  })}
  const archiveBaseline=await snapshot(page);
  await page.evaluate(()=>{
   const read=repo.getLongWav.bind(repo);
   repo.getLongWav=async(...args)=>{
    const record=await read(...args);
    window.archiveExportRead=true;
    await new Promise(()=>{});
    return record;
   };
   void app.exportLongWavArchive();
  });
  await page.waitForFunction(()=>window.archiveExportRead===true);
  await stop();page=await open();
  await page.evaluate(()=>app.refresh());
  assert.deepEqual(await snapshot(page),archiveBaseline,'interrupted export must leave IndexedDB untouched');
  const switched=await page.evaluate(async()=>{
   const read=repo.getLongWav.bind(repo);
   const other=app.memoryRepository();
   repo.getLongWav=async(...args)=>{
    const record=await read(...args);
    app.setRepository(other);
    return record;
   };
   try{return await app.exportLongWavArchive()}
   finally{repo.getLongWav=read;app.setRepository(repo)}
  });
  assert.equal(switched.ok,false,'stale Archive must not reach the download');
  await page.evaluate(()=>app.refresh());
  const interruptedDownload=page.waitForEvent('download',{timeout:10000});
  await page.evaluate(()=>{void app.exportLongWavArchive()});
  await interruptedDownload;
  await stop();page=await open();
  assert.deepEqual(await snapshot(page),archiveBaseline,'killing Chromium at download notification must leave IndexedDB untouched');
  await page.evaluate(()=>app.refresh());
  const downloadReady=page.waitForEvent('download',{timeout:10000});
  const exported=await page.evaluate(()=>app.exportLongWavArchive());
  assert.equal(exported.ok,true,exported.error);
  const download=await downloadReady;
  const file=dir+'/retried.nova';
  await download.saveAs(file);
  const downloaded=fs.readFileSync(file);
  assert.deepEqual(downloaded,Buffer.from(archiveBytes),'retried real Archive must match the original manifest and binary bytes');
  await stop();page=await open();
  assert.deepEqual(await snapshot(page),archiveBaseline,'successful export must leave IndexedDB untouched across restart');

  await page.evaluate(bytes=>{
   const original=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(value,...args){const request=original.call(this,value,...args),store=this;if(store.name==='projects')request.addEventListener('success',()=>{const loop=()=>{const q=store.get(value.projectId);q.onsuccess=loop};loop();window.archiveHeld=true});return request};
   window.pendingArchive=app.restoreLongWavArchive(new Blob([new Uint8Array(bytes)]));
  },Array.from(downloaded));
  await page.waitForFunction(()=>window.archiveHeld===true);await stop();page=await open();
  assert.deepEqual(await snapshot(page),archiveBaseline,'Archive SIGKILL must roll back every store including WAV, journal, settings and history');
  const receipt=await page.evaluate(async bytes=>{app.state.projects=await repo.list();return app.restoreLongWavArchive(new Blob([new Uint8Array(bytes)]))},Array.from(downloaded));
  assert.equal(receipt.ok,true,receipt.error);assert.equal(receipt.committed,true);assert.equal(receipt.projects.length,1);
  const restoredId=receipt.projects[0].projectId,afterRestore=await snapshot(page);
  assert.equal(afterRestore.projects.length,2);assert.equal(afterRestore.longWavBinaries.length,2);assert.equal(afterRestore.vocalJournals.length,2);assert.equal(afterRestore.vocalJournalChunks.length,2);
  const src=afterRestore.projects.find(p=>p.projectId==='archive-source'),copy=afterRestore.projects.find(p=>p.projectId===restoredId);
  assert.deepEqual(copy.songVersions,src.songVersions,'Archive must retain session, daily and automatic edit links');
  assert.equal(copy.songVersions.days[0].sessionId,copy.songVersions.sessions[0].id);
  assert.deepEqual(afterRestore.longWavBinaries[0].blob||afterRestore.longWavBinaries[0].parts,afterRestore.longWavBinaries[1].blob||afterRestore.longWavBinaries[1].parts);
  await stop();page=await open();assert.deepEqual(await snapshot(page),afterRestore,'retried Archive must persist completely across SIGKILL');

  const retained=await page.evaluate(async()=>{
   await app.refresh();
   app.state.settings=app.normalizeSettings({backup:{automaticEnabled:true,intervalHours:1,maxCopies:1}});
   const prior={backupId:'previous-generation',createdAt:'2026-11-01T00:00:00Z',signature:'old',snapshot:{protected:true}};
   await repo.putAutoBackup(prior);
   const remove=IDBObjectStore.prototype.delete;
   IDBObjectStore.prototype.delete=function(key){
    const request=remove.call(this,key);
    if(key===prior.backupId)request.addEventListener('success',()=>{app.state.settings.backup.maxCopies=2});
    return request;
   };
   const receipt=await app.runAutoBackupCheck('2026-11-12T00:00:00Z');
   if(!receipt.created||receipt.cleanupWarning!=='backup-state-conflict')throw Error(JSON.stringify(receipt));
   const stored=await repo.getAutoBackup(receipt.backup.backupId);
   if(JSON.stringify(await repo.getAutoBackup(prior.backupId))!==JSON.stringify(prior))throw Error('retention change did not abort deletion');
   const bytes=async blob=>Array.from(new Uint8Array(await blob.arrayBuffer()));
   const expected=await bytes(receipt.backup.archive);
   if(JSON.stringify(await bytes(stored.archive))!==JSON.stringify(expected))throw Error('published backup differs from receipt');
   return {prior,created:stored.backupId,bytes:expected};
  });
  await stop();page=await open();
  const persisted=await page.evaluate(async ({prior,created})=>{
   const copy=await repo.getAutoBackup(created);
   return {prior:await repo.getAutoBackup(prior.backupId),created:copy.backupId,bytes:Array.from(new Uint8Array(await copy.archive.arrayBuffer()))};
  },retained);
  assert.deepEqual(persisted,retained,'both backup generations must survive restart after the retention conflict');
  async function configurePruning(page){
   await page.evaluate(async()=>{
    await app.refresh();
    app.state.settings=app.normalizeSettings({backup:{automaticEnabled:true,intervalHours:1,maxCopies:1}});
   });
  }
  await configurePruning(page);
  await page.evaluate(async()=>{
   await repo.putAutoBackup({backupId:'older-generation',createdAt:'2026-10-31T00:00:00Z',snapshot:{older:true}});
   const remove=IDBObjectStore.prototype.delete;
   IDBObjectStore.prototype.delete=function(key){
    const request=remove.call(this,key);
    if(key==='older-generation')request.addEventListener('success',()=>{
     const hold=()=>{this.get(key).onsuccess=hold};
     hold();
     window.pruningHeld=true;
    });
    return request;
   };
   void app.runAutoBackupCheck('2026-11-12T00:01:00Z');
  });
  await page.waitForFunction(()=>window.pruningHeld===true);
  await stop();page=await open();
  const ids=()=>page.evaluate(async()=>(await repo.listAutoBackups()).map(copy=>copy.backupId).sort());
  assert.deepEqual(await ids(),[retained.created,'older-generation'].sort(),'earlier deletion committed, active deletion rolled back');
  await configurePruning(page);
  const cleanup=await page.evaluate(()=>app.runAutoBackupCheck('2026-11-12T00:02:00Z'));
  assert.equal(cleanup.reason,'not-due');
  assert.equal(cleanup.created,false);
  assert.equal(cleanup.cleanupWarning,undefined);
  await stop();page=await open();
  assert.deepEqual(await ids(),[retained.created]);
  const remaining=await page.evaluate(async id=>Array.from(new Uint8Array(await (await repo.getAutoBackup(id)).archive.arrayBuffer())),retained.created);
  assert.deepEqual(remaining,retained.bytes);

  const generations=await page.evaluate(async bytes=>{
   await app.refresh();
   window.confirm=()=>true;
   const source=app.state.projects.find(project=>project.projectId==='archive-source');
   await app.loadSettings();
   const jsonSong=app.makeProject({projectId:'json-generation-song',projectName:'JSON generation'});
   app.state.projects=[jsonSong];
   const snapshot=app.backupObject();
   await app.refresh();
   await repo.putAutoBackup({backupId:'json-generation',createdAt:'2026-11-10T00:00:00Z',snapshot});
   await repo.putAutoBackup({backupId:'archive-generation',createdAt:'2026-11-11T00:00:00Z',snapshot,archive:new Blob([new Uint8Array(bytes)])});
   await app.loadAutoBackups();
   const read=repo.getAutoBackup;
   const other=app.memoryRepository();
   repo.getAutoBackup=async id=>{
    const record=await read(id);
    app.setRepository(other);
    return record;
   };
   await app.restoreAutoBackup('json-generation');
   if((await other.list()).length||app.archiveTransfer.preview)throw Error('backup crossed storage switch');
   repo.getAutoBackup=read;
   app.setRepository(repo);
   await app.loadAutoBackups();
   const json=await app.restoreAutoBackup('json-generation');
   if(!json||json.failed||!(await repo.list()).some(project=>project.projectName==='JSON generation'))throw Error('JSON generation restore failed');
   for(const restoreSettings of [false,true]){
    const destinationSettings={...app.defaultSettings(),acceptanceMarker:'destination'};
    await repo.putSettings(destinationSettings);
    await app.loadSettings();
    const preview=await app.restoreAutoBackup('archive-generation');
    if(!preview?.ok)throw Error('generation preview failed');
    app.setArchiveRestoreSettings(restoreSettings);
    const write=repo.restoreLongArchive;
    const before=await repo.list();
    repo.restoreLongArchive=async(...args)=>{
     app.setRepository(other);
     return write(...args);
    };
    const aborted=await app.restorePreviewedArchive();
    if(aborted.ok||JSON.stringify(await repo.list())!==JSON.stringify(before))throw Error('stale Archive generation committed');
    repo.restoreLongArchive=write;
    app.setRepository(repo);
    await app.loadAutoBackups();
    if(!(await app.restoreAutoBackup('archive-generation'))?.ok)throw Error('generation retry preview failed');
    app.setArchiveRestoreSettings(restoreSettings);
    const restored=await app.restorePreviewedArchive();
    if(!restored.ok||!restored.committed||restored.projects.length!==1)throw Error('Archive generation retry failed');
    const persistedSettings=await repo.getSettings();
    if((persistedSettings.acceptanceMarker==='destination')===restoreSettings)throw Error('Archive settings choice was ignored');
    const project=await repo.get(restored.projects[0].projectId);
    const wav=await app.pcmLoadLongWav(project.projectId,project.longWavAssets[0].id);
    const sourceWav=await app.pcmLoadLongWav(source.projectId,source.longWavAssets[0].id);
    if(JSON.stringify(Array.from(new Uint8Array(await wav.arrayBuffer())))!==JSON.stringify(Array.from(new Uint8Array(await sourceWav.arrayBuffer()))))throw Error('Archive generation WAV mismatch');
    const event=project.productionHistory.at(-1);
    const digest=await crypto.subtle.digest('SHA-256',new Uint8Array(bytes));
    const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(event.sourceProjectId!==source.projectId||event.projectId!==project.projectId||event.archiveHashes[0]!==hash||
      JSON.stringify(project.songVersions)!==JSON.stringify(source.songVersions))throw Error('Archive generation provenance mismatch');
   }
   return (await repo.listAutoBackups()).map(record=>record.backupId).sort();
  },Array.from(downloaded));
  assert.deepEqual(generations,[retained.created,'archive-generation','json-generation'].sort());
  const generationState=await snapshot(page);
  await stop();page=await open();
  assert.deepEqual(await snapshot(page),generationState,'restored generations and histories must survive restart');

 }finally{await stop();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true})}
});
