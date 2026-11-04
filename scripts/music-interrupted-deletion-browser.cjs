'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
test('SIGKILL during Archive restore, recording deletion and backup pruning retains committed data',{timeout:180000},async()=>{
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
 async function open(){browser=await launch();const page=await browser.newPage();await page.goto(origin);await page.addScriptTag({url:origin+'/music-studio.js'});await page.evaluate(async()=>{const a=MusicStudio,r=a.indexedDbRepository();a.setRepository(r);window.repo=r;a.state.projects=await r.list();a.state.settings=await r.getSettings()||a.defaultSettings();window.confirm=()=>true});return page}
 async function snapshot(page){return page.evaluate(async()=>{const r=repo,hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join('');const projects=await r.list(),journals=await r.listVocalJournals(),chunks=[];for(const m of journals)for(let i=0;i<m.next;i++){const c=await r.getVocalJournalChunk(m.id+':'+i);chunks.push({id:c.id,hash:await hash(c.bytes)})}const binaries=[];for(const p of projects)for(const a of p.longWavAssets||[]){const b=await r.getLongWav(a.id);binaries.push({id:a.id,hash:await hash(await b.blob.arrayBuffer())})}return{projects,journals,chunks,binaries,settings:await r.getSettings(),backups:await r.listAutoBackups()}})}
 try{
  let page=await open();
  await page.evaluate(async()=>{
   const a=MusicStudio,p=a.makeProject({projectId:'protected',projectName:'Interruption safety',midiData:{ppq:480,tempo:120,tracks:[{id:'lead',notes:[{id:'n1',pitch:60,startTick:0,durationTicks:480,velocity:90,metadata:{keep:'original'}}]}]}});await repo.put(p);a.state.projects=[p];await repo.putSettings(a.state.settings);
   for(const r of [await a.productionSessionSave(p.projectId,'start','Active work'),await a.productionDaySave(p.projectId,'2026-11-05','Protected daily note'),await a.versionSave(p.projectId,'Before interruption')])if(!r.ok)throw Error(r.error);
   const wav=new ArrayBuffer(52),v=new DataView(wav),tag=(at,text)=>[...text].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt()));tag(0,'RIFF');v.setUint32(4,44,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);tag(36,'data');v.setUint32(40,8,true);v.setInt16(44,1234,true);const file=new Blob([wav],{type:'audio/wav'});file.name='protected.wav';a.pcmOpen(p.projectId);const imported=await a.pcmImportLongFile(file,p.projectId);if(!imported.ok)throw Error(imported.error);
   const bytes=new Uint8Array([1,2,3,4]).buffer,hash=[Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('')];
   await repo.createVocalJournal({format:'nova-vocal-journal-v1',id:'recording',owner:p.projectId,rate:8000,next:0,frames:0,consumed:0,startTick:0,latencyMs:0,closed:false,updatedAt:1});await repo.appendVocalJournal('recording',0,bytes,hash);await repo.sealVocalJournal('recording',await repo.getVocalJournal('recording'));
   await repo.putAutoBackup({backupId:'old',createdAt:'2026-11-01T00:00:00Z',snapshot:{protected:true}});await repo.putAutoBackup({backupId:'new',createdAt:'2026-11-05T00:00:00Z',snapshot:{replacement:true}});
  });
  const outcomes=[];
  for(const scenario of ['archive','journal','backup']){
   const expected=await snapshot(page);assert.equal(expected.binaries.length,1);
   if(scenario==='archive')await page.evaluate(async()=>{window.archive=await MusicStudio.createLongWavArchive()});
   await page.evaluate(scenario=>{
    const native=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(names,mode,...rest){const tx=native.call(this,names,mode,...rest),list=Array.from(tx.objectStoreNames);if(mode!=='readwrite')return tx;
     const target=scenario==='archive'?'projects':scenario==='journal'?'vocalJournals':'autoBackups';if(!list.includes(target))return tx;
     const objectStore=tx.objectStore.bind(tx);tx.objectStore=name=>{const store=objectStore(name);if(name!==target)return store;const method=scenario==='archive'?'add':'delete',original=store[method].bind(store);store[method]=(...args)=>{const request=original(...args);request.addEventListener('success',()=>{window.held=true;const keep=()=>{try{const q=objectStore(target).get('__hold__');q.onsuccess=keep}catch(_){}};keep()});return request};return store};return tx};
    window.pending=(async()=>{const a=MusicStudio;if(scenario==='archive')return a.restoreLongWavArchive(archive,{settings:false});if(scenario==='journal')return a.vocalJournalAction('recording',true);const rows=await repo.listAutoBackups();return repo.deleteAutoBackupIfCurrent(rows.find(x=>x.backupId==='old'),rows.find(x=>x.backupId==='new'),()=>{})})();window.pending.catch(()=>{});
   },scenario);
   await page.waitForFunction(()=>window.held===true);await stop('SIGKILL');page=await open();assert.deepEqual(await snapshot(page),expected,scenario+' must retain exact committed state');
   outcomes.push({scenario,kill:'SIGKILL',uncommittedRequestObserved:true,reopenedExact:true});
  }
  const retry=await page.evaluate(async()=>{const a=MusicStudio,archive=await a.createLongWavArchive(),restored=await a.restoreLongWavArchive(archive,{settings:false});if(!restored.ok)throw Error(restored.error);const deleted=await a.vocalJournalAction('recording',true);if(!deleted.ok)throw Error(deleted.error);const rows=await repo.listAutoBackups();await repo.deleteAutoBackupIfCurrent(rows.find(x=>x.backupId==='old'),rows.find(x=>x.backupId==='new'),()=>{});return{restored:restored.projects.length,journals:(await repo.listVocalJournals()).length,backupIds:(await repo.listAutoBackups()).map(x=>x.backupId)}});
  assert.equal(retry.restored,1);assert.equal(retry.journals,1);assert.deepEqual(retry.backupIds,['new']);
  const after=await snapshot(page);assert.equal(after.binaries.length,2);assert.equal(after.binaries[0].hash,after.binaries[1].hash);assert.deepEqual(after.projects[0].songVersions.sessions,after.projects[1].songVersions.sessions);assert.deepEqual(after.projects[0].songVersions.days,after.projects[1].songVersions.days);assert.equal(after.projects[1].songVersions.days[0].sessionId,after.projects[1].songVersions.sessions[0].id);
  console.log(JSON.stringify({date:new Date().toISOString(),outcomes,retry,physicalPowerLossTested:false}));
 }finally{await stop('SIGTERM');await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true})}
});
