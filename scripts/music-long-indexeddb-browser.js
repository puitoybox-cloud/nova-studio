// Consume only the successful real-model 480-second fixture from this CI HEAD.
// A persistent browser profile proves browser-process restart, not device restart.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
const fixture=JSON.parse(fs.readFileSync(process.env.NOVA_WHOLE_SONG_FIXTURE,'utf8'));
assert.equal(fixture.testedCommit,process.env.NOVA_TESTED_HEAD);assert.ok(fixture.testedCommit);
assert.equal(fixture.project.aiWorkspace.candidateSets.at(-1).candidates.length,3);
const base='http://127.0.0.1:8769',profile=fs.mkdtempSync(path.join(os.tmpdir(),'nova-long-idb-')),report={testedCommit:fixture.testedCommit,seconds:480,bars:144,physicalRestart:false,completed:false,measurements:[],messages:[],external:[]};
const host=spawn(process.env.PYTHON||'python',['tools/music-local-generation/serve.py','--port','8769','--weights',process.env.NOVA_MODEL_WEIGHTS||'/missing-model'],{stdio:['ignore','pipe','pipe']});
let browser;
async function open(){browser=await chromium.launchPersistentContext(profile,{headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{}),viewport:{width:1180,height:820}});const page=await browser.newPage();page.on('console',m=>{if(['error','warning'].includes(m.type()))report.messages.push(m.text())});page.on('pageerror',e=>report.messages.push(e.message));await page.route('**/*',r=>{if(r.request().url().startsWith(base+'/')||/^(blob:|data:)/.test(r.request().url()))return r.continue();report.external.push(r.request().url());return r.abort()});await page.goto(base+'/music-studio.html');await page.waitForFunction(()=>MusicStudio.state.loaded);return page}
(async()=>{try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/music-studio.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,50));if(i===99)throw Error('static host not ready')}
 let page=await open();
 await page.evaluate(async f=>{const a=MusicStudio;a.setRepository(a.indexedDbRepository());const r=await a.restoreBackup(f.midpointBackup,{settings:false,projects:true});if(!r.ok)throw Error(r.error)},fixture);
 await browser.close();browser=null;page=await open();
 report.measurements.push(await page.evaluate(async f=>{
  const a=MusicStudio,repo=a.indexedDbRepository();a.setRepository(repo);const p=await repo.get(f.project.projectId);
  if(p?.aiWorkspace?.wholeSongCheckpoint?.results.length!==72)throw Error('midpoint restart mismatch');
  a.state.projects=[p];a.openMidiEditor(p.projectId);
  const waitStart=performance.now();while(a.state.midiEditor?.projectId!==p.projectId){if(performance.now()-waitStart>10000)throw Error('editor not ready');await new Promise(r=>setTimeout(r,20))}
  const original=JSON.stringify(a.state.midiEditor.midiData),nativeFetch=window.fetch.bind(window),calls=[];
  window.fetch=async(...args)=>{const response=await nativeFetch(...args);if(String(args[0]).endsWith('/compose')&&response.ok)calls.push((await response.clone().json()).performance);return response};
  const start=performance.now();await MusicStudioAIAssistantPanel.generateWholeSong(p.projectId,true,true);window.fetch=nativeFetch;
  const record=MusicStudioAIAssistantPanel._states.get(p.projectId),set=record.state.workspace.candidateSets.at(-1);
  if(!set||set.candidates.length!==3||record.state.workspace.wholeSongCheckpoint)throw Error(record.message);
  if(calls.length!==72)throw Error('Resume regenerated completed bars: '+calls.length);
  if(JSON.stringify(a.state.midiEditor.midiData)!==original||JSON.stringify(a.state.midiEditor.midiData)!==JSON.stringify(f.sourceMidi))throw Error('Resume changed original MIDI');
  const stored=await repo.get(p.projectId);if(stored.aiWorkspace.candidateSets.at(-1).candidates.length!==3)throw Error('Resume final save missing');
  return{operation:'browser-restart-resume',milliseconds:performance.now()-start,requests:calls.length,completedBars:144,candidates:3,originalMidiUnchanged:true,onnxCalls:calls.reduce((n,p)=>n+p.onnxCalls.base+p.onnxCalls.token,0),pythonPeakRssBytes:Math.max(...calls.map(p=>p.memoryAfter.processPeakRssBytes))};
 },fixture));
 report.resumeInBrowser=true;

 report.measurements.push(await page.evaluate(async f=>{const a=MusicStudio,repo=a.indexedDbRepository();a.setRepository(repo);if(repo.kind!=='indexeddb')throw Error('real IndexedDB required');const start=performance.now();await repo.put(f.project);const saved=await repo.get(f.project.projectId);if(JSON.stringify(saved)!==JSON.stringify(f.project))throw Error('saved candidate mismatch');a.state.projects=[saved];const backup=a.backupObject();return{operation:'save-and-read',milliseconds:performance.now()-start,projectBytes:new TextEncoder().encode(JSON.stringify(saved)).length,backupBytes:new TextEncoder().encode(JSON.stringify(backup)).length}},fixture));
 await page.reload();await page.waitForFunction(()=>MusicStudio.state.loaded);
 assert.equal(await page.evaluate(async f=>JSON.stringify(await MusicStudio.indexedDbRepository().get(f.project.projectId))===JSON.stringify(f.project),fixture),true);
 await browser.close();browser=null;page=await open();
 report.measurements.push(await page.evaluate(async f=>{const a=MusicStudio,repo=a.indexedDbRepository();a.setRepository(repo);const start=performance.now(),saved=await repo.get(f.project.projectId);if(JSON.stringify(saved)!==JSON.stringify(f.project))throw Error('restart candidate mismatch');a.state.projects=[saved];const backup=JSON.parse(JSON.stringify(a.backupObject()));const result=await a.restoreBackup(backup,{settings:false,projects:true});if(!result.ok)throw Error(result.error);const restored=(await repo.list()).find(p=>p.projectId!==saved.projectId&&p.aiWorkspace?.candidateSets?.length);if(!restored)throw Error('restored project missing');if(JSON.stringify(restored.midiData)!==JSON.stringify(saved.midiData))throw Error('restored MIDI mismatch');const originalCandidates=saved.aiWorkspace.candidateSets.at(-1).candidates,restoredCandidates=restored.aiWorkspace.candidateSets.at(-1).candidates;if(JSON.stringify(originalCandidates.map(c=>c.value))!==JSON.stringify(restoredCandidates.map(c=>c.value)))throw Error('restored candidate values mismatch');return{operation:'restart-read-backup-restore',milliseconds:performance.now()-start,candidates:restoredCandidates.length,originalRetained:JSON.stringify(await repo.get(saved.projectId))===JSON.stringify(saved)}},fixture));
 // Retain the real midpoint checkpoint through the same profile and a second restart.
 await page.evaluate(async f=>{const a=MusicStudio;a.setRepository(a.indexedDbRepository());const r=await a.restoreBackup(f.midpointBackup,{settings:false,projects:true});if(!r.ok)throw Error(r.error);const rows=await a.indexedDbRepository().list();if(!rows.some(p=>p.aiWorkspace?.wholeSongCheckpoint?.results.length===72))throw Error('midpoint checkpoint missing')},fixture);
 await browser.close();browser=null;page=await open();assert.equal(await page.evaluate(async()=> (await MusicStudio.indexedDbRepository().list()).some(p=>p.aiWorkspace?.wholeSongCheckpoint?.results.length===72)),true);
 assert.deepEqual(report.messages,[]);assert.deepEqual(report.external,[]);report.completed=true;report.reload=true;report.browserProcessRestart=true;report.midpointRestart=true;
 }finally{await browser?.close();host.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});fs.writeFileSync(process.env.NOVA_LONG_IDB_REPORT||'verification/music-long-indexeddb-browser.json',JSON.stringify(report,null,2)+'\n')}})().catch(e=>{console.error(e);process.exitCode=1});
