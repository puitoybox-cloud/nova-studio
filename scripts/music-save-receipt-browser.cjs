'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
// Drive the form submit, idle autosave timer and MIDI editor through their
// production entry points with the same edit after a process restart.
async function saveEditorEntry(entry, project) {
 const app=MusicStudio;
 const id=project.projectId;
 if(entry==='midiEditorSave'){
  const editor=MusicStudioEditor;
  const session=editor.createSession(project);
  app.state.midiEditor=session;
  editor.addNote(session,{pitch:72,startTick:960,durationTicks:120});
  return app.saveMidiEditor({silent:true});
 }
 const form=document.createElement('form');
 form.id='musicProjectForm';
 for(const [name,value] of Object.entries({
  projectName:project.projectName,songTitle:project.songTitle,purpose:project.purpose,
  bpm:project.musicalSettings.bpm,timeSignature:'4/4',key:project.musicalSettings.key,
  status:project.status,productionNotes:'Retried '+entry
 })){
  const input=document.createElement('input');
  input.name=name;
  input.value=value??'';
  form.append(input);
 }
 document.querySelector('#musicProjectForm')?.remove();
 document.body.append(form);
 if(entry==='manualSave'){
  app.state.dirty=true;
  return app.submitEdit(null,id);
 }
 history.replaceState(null,'','#music-studio/project/'+encodeURIComponent(id));
 const periodic=entry==='periodicAutosave';
 app.state.settings=app.normalizeSettings({autosave:{enabled:true,idleDelaySeconds:periodic?30:1,intervalSeconds:15}});
 app.markDirty();
 if(periodic){
  app.cancelScheduledSave();
  app.configureAutosave();
 }
}

const editorEntries=['manualSave','timerAutosave','midiEditorSave','periodicAutosave'];

test('real IndexedDB reconciles lost save notifications and preserves competing writes across SIGKILL',{timeout:180000},async()=>{
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
   app.state.dirty=false;
   app.state.projects=await repo.list();
   repo.compareAndPut=loseReceipt;
   const checkpoint=await app.versionSave(id,'Finished once',{kind:'finished'});
   if(!checkpoint.ok)throw Error(checkpoint.error);
   const day=await app.productionDaySave(id,'2026-11-12','Durable daily record');
   if(!day.ok)throw Error(day.error);

   // Change the live notes so the finished checkpoint offers an adoption.
   const live=await repo.get(id);
   app.state.projects=await repo.list();
   form.elements.productionNotes.value='Notes after checkpoint';
   app.state.dirty=true;
   if(!(await app.saveCurrentProject(id)).ok)throw Error('Post-checkpoint notes were not saved');
   const checkpointId=checkpoint.project.songVersions.checkpoints.at(-1).id;
   const adoptionBase=await repo.get(id);
   const previewAdoption=()=>app.versionPreview(id,checkpointId,['notes']);
   if(!previewAdoption().ok)throw Error('Checkpoint preview failed');

   // Simulate a storage conflict without advancing the visible preview.
   let competingCheckpoint;
   repo.compareAndPut=async(...args)=>{
    competingCheckpoint={...adoptionBase,revision:adoptionBase.revision+1,productionNotes:'Competing checkpoint notes'};
    await originalWrite(competingCheckpoint,JSON.stringify(adoptionBase));
    return originalWrite(...args);
   };
   const rejected=await app.versionApply(id);
   if(rejected.ok||JSON.stringify(await repo.get(id))!==JSON.stringify(competingCheckpoint))
    throw Error('Adoption overwrote the competing write');
   app.state.projects=await repo.list();
   repo.compareAndPut=loseReceipt;
   if(!previewAdoption().ok)throw Error('Checkpoint retry preview failed');
   const writesBeforeHistory=writes;
   const adopted=await app.versionApply(id);
   if(!adopted.ok)throw Error(adopted.error);
   const material=await app.materialCapture(id,{name:'Captured after adoption'});
   if(!material.ok)throw Error(material.error);
   const materialFile=app.materialExport(id).text;
   const imported=await app.materialImport(id,{size:materialFile.length,text:async()=>materialFile});
   if(!imported.ok)throw Error(imported.error);
   const withMaterial=await repo.get(id);
   const undone=await app.versionUndoRedo(id,-1);
   if(!undone.ok)throw Error(undone.error);
   const redone=await app.versionUndoRedo(id,1);
   if(!redone.ok)throw Error(redone.error);
   if(writes-writesBeforeHistory!==5)throw Error('Special saves repeated a committed write');
   const special={live,competingCheckpoint,adopted:adopted.project,withMaterial,undone:undone.project,redone:redone.project,material:material.material};

   const archive=await app.createLongWavArchive();
   const restore=repo.restoreLongArchive;
   repo.restoreLongArchive=async(...args)=>{
    await restore(...args);
    throw Error('Injected loss of Archive notification after IndexedDB commit');
   };
   const preview=await app.previewLongWavArchive(archive);
   if(!preview.ok)throw Error(preview.error);
   app.setArchiveRestoreSettings(false);
   const restored=await app.restorePreviewedArchive();
   if(!restored.ok||!restored.committed||restored.projects.length!==1)
    throw Error(restored.error||'Archive receipt lost');
   if((await app.restorePreviewedArchive()).error!=='archive-preview-required')
    throw Error('Committed Archive still offered a retry');
   const restoredProject=await repo.get(restored.projects[0].projectId);
   if(JSON.stringify(restoredProject)!==JSON.stringify(restored.projects[0]))
    throw Error('Archive result differs from the committed project');
   const fork=repo.compareAndFork.bind(repo);
   let forkWrites=0;
   repo.compareAndFork=async(...args)=>{
    forkWrites++;
    await fork(...args);
    throw Error('Injected loss of fork notification after IndexedDB commit');
   };
   const source=await repo.get(id);
   const finished=await app.finishedOpen(id,checkpoint.project.songVersions.checkpoints.at(-1).id);
   if(!finished.ok)throw Error(finished.error);
   const duplicate=await app.duplicateProject(id);
   if(!duplicate.ok||!duplicate.committed||forkWrites!==2)
    throw Error(duplicate.error||'Lost fork notification triggered another write');
   return {before,formProject,saved,special,source,restored:restoredProject,finished:finished.project,duplicate:duplicate.project};
  });
  assert.equal(receipts.formProject.revision,receipts.before.revision+1);
  assert.equal(receipts.saved.revision,receipts.formProject.revision+1);
  assert.deepEqual(receipts.saved.songVersions.edits.slice(0,-2),receipts.before.songVersions.edits||[]);
  assert.deepEqual(receipts.saved.songVersions.edits.slice(-2).map(edit=>edit.source),['project-editor','midi-editor']);
  const sessionId=receipts.before.songVersions.sessions.at(-1).id;
  assert.deepEqual(receipts.saved.songVersions.edits.slice(-2).map(edit=>edit.sessionId),[sessionId,sessionId]);
  assert.deepEqual(receipts.saved.songVersions.sessions,receipts.before.songVersions.sessions);
  assert.deepEqual(receipts.saved.songVersions.days,receipts.before.songVersions.days);
  const {special}=receipts;
  const {adopted,withMaterial,undone,redone}=special;
  const operation=adopted.songVersions.operations.at(-1);
  assert.equal(operation.checkpointId,special.live.songVersions.checkpoints[0].id);
  assert.equal(operation.sessionId,sessionId);
  assert.equal(adopted.songVersions.operations.length,1);
  assert.deepEqual([adopted,undone,redone].map(p=>p.songVersions.cursor),[1,0,1]);
  assert.deepEqual([adopted,undone,redone].map(p=>p.productionNotes),[
   special.live.productionNotes,special.competingCheckpoint.productionNotes,special.live.productionNotes
  ]);
  const capture=withMaterial.productionHistory.at(-2);
  const imported=withMaterial.productionHistory.at(-1);
  assert.equal(capture.type,'material-capture');
  assert.equal(capture.materialId,special.material.id);
  assert.equal(imported.type,'material-import');
  assert.deepEqual(imported.materialIds,[withMaterial.materialLibrary.at(-1).id]);
  const edits=[adopted.songVersions.edits.at(-1),...withMaterial.songVersions.edits.slice(-2),
   undone.songVersions.edits.at(-1),redone.songVersions.edits.at(-1)];
  assert.deepEqual(edits.map(e=>e.source),['checkpoint-history','material-library','material-library','checkpoint-history','checkpoint-history']);
  assert.equal(new Set(edits.map(e=>e.id)).size,edits.length);
  assert.deepEqual([capture.editId,imported.editId],edits.slice(1,3).map(e=>e.id));
  assert.deepEqual(redone.songVersions.edits.slice(-5),edits);
  for(const edit of edits)assert.equal(edit.sessionId,sessionId);
  for(const project of [withMaterial,undone,redone]){
   assert.deepEqual(project.songVersions.days,special.live.songVersions.days);
   assert.deepEqual(project.songVersions.sessions,special.live.songVersions.sessions);
   assert.deepEqual(project.materialLibrary,withMaterial.materialLibrary);
   assert.deepEqual(project.productionHistory,withMaterial.productionHistory);
   for(const event of [capture,imported])assert.equal(project.productionHistory.filter(e=>e.id===event.id).length,1);
  }
  await stop('SIGKILL');
  browser=await launch();
  const reopened=await browser.newPage();
  await reopened.goto(origin);
  await reopened.addScriptTag({url:origin+'/music-studio.js'});
  await reopened.waitForFunction(()=>MusicStudio.state.loaded===true);
  const projects=await reopened.evaluate(()=>MusicStudio.indexedDbRepository().list());
  assert.equal(projects.length,4);
  assert.deepEqual(projects.find(project=>project.projectId===receipts.source.projectId),receipts.source);
  assert.deepEqual(projects.find(project=>project.projectId===receipts.restored.projectId),receipts.restored);
  assert.deepEqual(projects.find(project=>project.projectId===receipts.finished.projectId),receipts.finished);
  const duplicate=projects.find(project=>project.projectId===receipts.duplicate.projectId);
  assert.deepEqual(duplicate,receipts.duplicate);
  assert.deepEqual(duplicate.productionHistory.slice(0,-1),receipts.source.productionHistory);
  const duplicateEvent=duplicate.productionHistory.at(-1);
  assert.equal(duplicateEvent.type,'project-duplicate');
  assert.equal(duplicateEvent.sourceProjectId,receipts.source.projectId);
  assert.equal(duplicateEvent.sourceRevision,receipts.source.revision);
  assert.equal(duplicate.productionHistory.filter(event=>event.id===duplicateEvent.id).length,1);
  assert.equal(receipts.finished.songVersions.fork.sourceProjectId,receipts.source.projectId);
  assert.equal(receipts.finished.songVersions.fork.checkpointId,receipts.source.songVersions.checkpoints[0].id);
  for(const project of projects){
   const ledger=project.songVersions;
   assert.equal(ledger.checkpoints.length,1);
   assert.equal(ledger.checkpoints[0].id,receipts.source.songVersions.checkpoints[0].id);
   assert.equal(ledger.days.length,1);
   assert.equal(ledger.days[0].id,receipts.source.songVersions.days[0].id);
   assert.equal(ledger.days[0].sessionId,sessionId);
   assert.deepEqual(ledger.edits.map(edit=>edit.id),receipts.source.songVersions.edits.map(edit=>edit.id));
  }
  await reopened.evaluate(({id,checkpointId})=>{
   const app=MusicStudio;
   const add=IDBObjectStore.prototype.add;
   IDBObjectStore.prototype.add=function(value,...args){
    const request=add.call(this,value,...args);
    if(value?.songVersions?.fork?.checkpointId===checkpointId)request.addEventListener('success',()=>{
     const keepAlive=()=>{this.get(value.projectId).onsuccess=keepAlive};
     keepAlive();
     window.finishedForkPending=true;
    });
    return request;
   };
   void app.finishedOpen(id,checkpointId);
  },{id:receipts.source.projectId,checkpointId:receipts.finished.songVersions.fork.checkpointId});
  await reopened.waitForFunction(()=>window.finishedForkPending===true,{},{timeout:10000});
  await stop('SIGKILL');
  browser=await launch();
  const retriedPage=await browser.newPage();
  await retriedPage.goto(origin);
  await retriedPage.addScriptTag({url:origin+'/music-studio.js'});
  await retriedPage.waitForFunction(()=>MusicStudio.state.loaded===true);
  const afterCrash=await retriedPage.evaluate(()=>MusicStudio.indexedDbRepository().list());
  assert.deepEqual(afterCrash,projects,'interrupted fork must preserve every saved project and history');
  const retry=await retriedPage.evaluate(({id,checkpointId})=>MusicStudio.finishedOpen(id,checkpointId),{
   id:receipts.source.projectId,checkpointId:receipts.finished.songVersions.fork.checkpointId
  });
  assert.equal(retry.ok,true,retry.error);
  const afterRetry=await retriedPage.evaluate(()=>MusicStudio.indexedDbRepository().list());
  assert.deepEqual(afterRetry.filter(project=>project.projectId!==retry.project.projectId),projects);
  assert.equal(afterRetry.length,projects.length+1);
  const savedFork=afterRetry.find(project=>project.projectId===retry.project.projectId);
  assert.deepEqual(savedFork,retry.project);
  assert.equal(savedFork.songVersions.fork.sourceProjectId,receipts.source.projectId);
  assert.equal(savedFork.songVersions.fork.checkpointId,receipts.finished.songVersions.fork.checkpointId);
  assert.deepEqual(savedFork.songVersions.sessions.map(session=>session.id),receipts.source.songVersions.sessions.map(session=>session.id));
  assert.ok(savedFork.songVersions.sessions.at(-1).endedAt);
  let editorPage=retriedPage;
  for(const entry of editorEntries){
   const id=receipts.source.projectId;
   const baseline=await editorPage.evaluate(()=>MusicStudio.indexedDbRepository().list());
   const before=baseline.find(project=>project.projectId===id);
   await editorPage.addScriptTag({content:saveEditorEntry.toString()});
   if(entry==='midiEditorSave')await editorPage.addScriptTag({content:fs.readFileSync('music-studio-editor.js','utf8')});
   await editorPage.evaluate(({entry,id,before})=>{
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,...args){
     const request=put.call(this,value,...args);
     if(value?.projectId===id&&value.revision===before.revision+1)request.addEventListener('success',()=>{
      const keepAlive=()=>{this.get(id).onsuccess=keepAlive};
      keepAlive();
      window.editorWritePending=true;
     });
     return request;
    };
    void saveEditorEntry(entry,before);
   },{entry,id,before});
   await editorPage.waitForFunction(()=>window.editorWritePending===true,{},{timeout:25000});
   await stop('SIGKILL');
   browser=await launch();
   editorPage=await browser.newPage();
   await editorPage.goto(origin);
   await editorPage.addScriptTag({url:origin+'/music-studio.js'});
   await editorPage.waitForFunction(()=>MusicStudio.state.loaded===true);
   assert.deepEqual(await editorPage.evaluate(()=>MusicStudio.indexedDbRepository().list()),baseline,entry+' must roll back');
   await editorPage.addScriptTag({content:saveEditorEntry.toString()});
   if(entry==='midiEditorSave')await editorPage.addScriptTag({content:fs.readFileSync('music-studio-editor.js','utf8')});
   await editorPage.evaluate(({entry,before})=>saveEditorEntry(entry,before),{entry,before});
   await editorPage.waitForFunction(({id,revision})=>MusicStudio.state.projects.some(project=>project.projectId===id&&project.revision===revision),
    {id,revision:before.revision+1},{timeout:25000});
   const after=await editorPage.evaluate(()=>MusicStudio.indexedDbRepository().list());
   assert.deepEqual(after.filter(project=>project.projectId!==id),baseline.filter(project=>project.projectId!==id));
   const saved=after.find(project=>project.projectId===id);
   assert.equal(saved.revision,before.revision+1);
   const {edits,...history}=saved.songVersions;
   const {edits:priorEdits,...priorHistory}=before.songVersions;
   assert.deepEqual(history,priorHistory);
   assert.deepEqual(edits.slice(0,-1),priorEdits);
   assert.equal(edits.at(-1).sessionId,before.songVersions.sessions[0].id);
   assert.equal(edits.filter(event=>event.id===edits.at(-1).id).length,1);
   assert.equal(edits.at(-1).source,entry==='midiEditorSave'?'midi-editor':'project-editor');
   if(entry==='midiEditorSave')assert.ok(saved.midiData.tracks.some(track=>track.notes.some(note=>note.pitch===72)));
   else assert.equal(saved.productionNotes,'Retried '+entry);
  }
 }finally{await stop();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})}
});
