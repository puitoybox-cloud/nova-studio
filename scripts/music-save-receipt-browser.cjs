'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
test('real IndexedDB reconciles lost save notifications and preserves competing writes across SIGKILL',{timeout:60000},async()=>{
 const script=fs.readFileSync('music-studio.js');
 const server=http.createServer((req,res)=>{if(req.url==='/music-studio.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(script)}else{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html><body></body></html>')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const dir=fs.mkdtempSync('/tmp/nova-save-receipt-');
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
  browser=await launch();
  const interruptedPage=await browser.newPage();
  await interruptedPage.goto(origin);
  await interruptedPage.addScriptTag({url:origin+'/music-studio.js'});
  await interruptedPage.waitForFunction(()=>MusicStudio.state.loaded===true);
  await interruptedPage.evaluate(async()=>{
   const app=MusicStudio,repo=app.indexedDbRepository();
   await repo.put(app.makeProject({projectId:'chromium-restart-history',projectName:'Save receipts'}));
  });
  await interruptedPage.addScriptTag({content:fs.readFileSync('music-studio-editor.js','utf8')});
  const receipts=await interruptedPage.evaluate(async()=>{
   const app=MusicStudio, editor=MusicStudioEditor, repo=app.indexedDbRepository();
   const id='chromium-restart-history';
   app.setRepository(repo);
   app.state.projects=await repo.list();
   const originalWrite=repo.compareAndPut.bind(repo);
   let writes=0;
   const loseReceipt=async(...args)=>{
    writes++;
    await originalWrite(...args);
    throw Error('Injected loss of completion notification after IndexedDB commit');
   };

   const started=await app.productionSessionSave(id,'start','Save receipt test');
   if(!started.ok)throw Error(started.error);
   repo.compareAndPut=loseReceipt;
   const before=await repo.get(id);
   const form=document.createElement('form');
   form.id='musicProjectForm';
   for(const [name,value] of Object.entries({
    projectName:before.projectName,songTitle:before.songTitle,purpose:before.purpose,
    bpm:before.musicalSettings.bpm,timeSignature:'4/4',key:before.musicalSettings.key,
    status:before.status,productionNotes:'Saved once despite a lost notification'
   })){
    const field=document.createElement('input');
    field.name=name;
    field.value=value??'';
    form.append(field);
   }
   document.body.append(form);
   app.state.dirty=true;
   const formSave=await app.saveCurrentProject(id);
   const formRetry=await app.saveCurrentProject(id);
   if(!formSave.ok||!formRetry.skipped||writes!==1)throw Error('Project save retried a committed write');

   const formProject=await repo.get(id);
   const session=editor.createSession(formProject);
   app.state.midiEditor=session;
   editor.addNote(session,{pitch:61,startTick:480,durationTicks:120});
   if(!session.dirty)throw Error('MIDI edit fixture did not change');
   const midiSave=await app.saveMidiEditor({silent:true});
   const midiRetry=await app.saveMidiEditor({silent:true});
   if(!midiSave.ok||!midiRetry.skipped||writes!==2)throw Error('MIDI save retried a committed write');

   const saved=await repo.get(id);
   // A real competing write must still win the compare-and-put check.
   form.elements.productionNotes.value='Local draft that must survive conflict';
   app.state.dirty=true;
   let competing;
   repo.compareAndPut=async(...args)=>{
    competing={...saved,revision:saved.revision+1,productionNotes:'Concurrent save'};
    await originalWrite(competing,JSON.stringify(saved));
    return originalWrite(...args);
   };
   const conflict=await app.saveCurrentProject(id);
   if(conflict.ok||!app.state.dirty||form.elements.productionNotes.value!=='Local draft that must survive conflict')
    throw Error('Conflict was incorrectly acknowledged or lost the local draft');
   if(JSON.stringify(await repo.get(id))!==JSON.stringify(competing))throw Error('Competing write was overwritten');
   return {before,formProject,saved,competing};
  });
  assert.equal(receipts.formProject.revision,receipts.before.revision+1);
  assert.equal(receipts.saved.revision,receipts.formProject.revision+1);
  assert.deepEqual(receipts.saved.songVersions.edits.slice(0,-2),receipts.before.songVersions.edits||[]);
  assert.deepEqual(receipts.saved.songVersions.edits.slice(-2).map(edit=>edit.source),['project-editor','midi-editor']);
  const sessionId=receipts.before.songVersions.sessions.at(-1).id;
  assert.deepEqual(receipts.saved.songVersions.edits.slice(-2).map(edit=>edit.sessionId),[sessionId,sessionId]);
  assert.deepEqual(receipts.saved.songVersions.sessions,receipts.before.songVersions.sessions);
  assert.deepEqual(receipts.saved.songVersions.days,receipts.before.songVersions.days);
  await stop('SIGKILL');
  browser=await launch();
  const reopened=await browser.newPage();
  await reopened.goto(origin);
  await reopened.addScriptTag({url:origin+'/music-studio.js'});
  await reopened.waitForFunction(()=>MusicStudio.state.loaded===true);
  assert.deepEqual(await reopened.evaluate(()=>MusicStudio.indexedDbRepository().get('chromium-restart-history')),receipts.competing);
 }finally{await stop();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})}
});
