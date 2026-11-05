'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
test('MIDI project and import history commit or roll back together across SIGKILL and retry',{timeout:120000},async()=>{
 const scripts=new Map(['music-studio.js','music-studio-midi.js','music-studio-midi-parser.js'].map(name=>['/'+name,fs.readFileSync(name)]));
 const server=http.createServer((req,res)=>{if(scripts.has(req.url)){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(scripts.get(req.url))}else{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html><body></body></html>')}});
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
 try{
  browser=await launch();let page=await browser.newPage();
  const open=async()=>{await page.goto(origin);for(const name of ['music-studio-midi.js','music-studio-midi-parser.js','music-studio.js'])await page.addScriptTag({url:origin+'/'+name})};await open();
  const result=await page.evaluate(async()=>{
   const app=MusicStudio,repo=app.indexedDbRepository(),source=app.makeProject({projectId:'source',projectName:'Original'});await repo.put(source);
   const value=app.makeProject({projectId:'imported',projectName:'MIDI'}),history={id:'receipt',projectId:value.projectId,success:true};
   // Collision of the second store request must roll back the already queued project add.
   await repo.putMidiImportHistory({...history,projectId:'protected'});
   let rejected=false;try{await repo.commitMidiImport(value,history)}catch(e){rejected=true}
   if(!rejected||await repo.get(value.projectId))throw Error('partial project survived history collision');
   if((await repo.listMidiImportHistory())[0].projectId!=='protected')throw Error('existing history overwritten');
   let calls=0;rejected=false;try{await repo.commitMidiImport(value,{...history,id:'aborted'},null,null,()=>{if(++calls>=3)throw Error('cancel-after-request')})}catch(e){rejected=true}
   if(!rejected||await repo.get(value.projectId)||(await repo.listMidiImportHistory()).length!==1)throw Error('aborted transaction leaked');
   const baseline=JSON.stringify(source);rejected=false;try{await repo.commitMidiImport(value,{...history,id:'stale'},'source','wrong')}catch(e){rejected=true}
   if(!rejected||await repo.get(value.projectId))throw Error('stale source fork survived');
   await repo.commitMidiImport(value,{...history,id:'committed'},'source',baseline);
   return{baseline,value:JSON.stringify(value)};
  });
  // Exercise the public import action using the real IndexedDB transaction.
  // Lose its completion notification and make reconciliation temporarily unreadable.
  const imported=await page.evaluate(async()=>{
   const app=MusicStudio,repo=app.indexedDbRepository();app.setRepository(repo);await app.refresh();
   const bytes=MusicStudioMidi.createMidiFile(MusicStudioMidi.createTestMidiData()).bytes;
   const before=(await repo.list()).length;
   await app.inspectMidiFile(new File([bytes],'uncertain.mid',{type:'audio/midi'}));
   const write=repo.commitMidiImport,read=repo.listMidiImportHistory;let blocked=false,writes=0;
   repo.listMidiImportHistory=async()=>{if(blocked)throw Error('temporary read failure');return read()};
   repo.commitMidiImport=async(...args)=>{writes++;await write(...args);blocked=true;throw Error('completion notification lost')};
   const first=await app.saveMidiImport('new');if(first.ok||!app.state.midiImportPreview)throw Error('uncertain save discarded preview');
   blocked=false;const retry=await app.saveMidiImport('new');
   if(!retry.ok||writes!==1||(await repo.list()).length!==before+1)throw Error('public retry duplicated project');
   const rows=await read(),receipt=rows.find(r=>r.id===retry.history.id);
   if(!receipt||retry.project.productionHistory.filter(e=>e.id===receipt.id).length!==1)throw Error('public retry lost provenance');
   return{project:JSON.stringify(retry.project),id:retry.project.projectId,receipt:JSON.stringify(receipt)};
  });
  await stop('SIGKILL');browser=await launch();page=await browser.newPage();await open();
  await page.evaluate(async expected=>{
   const repo=MusicStudio.indexedDbRepository();
   if(JSON.stringify(await repo.get('source'))!==expected.baseline||JSON.stringify(await repo.get('imported'))!==expected.value)throw Error('restart changed project');
   const rows=await repo.listMidiImportHistory();if(rows.length!==3||!rows.some(r=>r.id==='committed'&&r.projectId==='imported'))throw Error('restart lost receipt');
   let rejected=false;try{await repo.commitMidiImport(await repo.get('imported'),{id:'retry',projectId:'imported'})}catch(e){rejected=true}
   if(!rejected||(await repo.listMidiImportHistory()).length!==3)throw Error('retry overwrote existing project');
  },result);
  await page.evaluate(async expected=>{
   const repo=MusicStudio.indexedDbRepository(),p=await repo.get(expected.id),rows=await repo.listMidiImportHistory();
   if(JSON.stringify(p)!==expected.project||!rows.some(r=>JSON.stringify(r)===expected.receipt))throw Error('SIGKILL lost reconciled import');
  },imported);
 }finally{await stop();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})}
});
