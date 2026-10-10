'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'nova-bundled-midi-'));
execFileSync('python3',[path.join(__dirname,'music-stage-native-web.py'),root]);
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1),file=path.resolve(root,name);if(!file.startsWith(root+'/')||!fs.existsSync(file)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res)});
async function verify(browser,base,width){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),messages=[],external=[],expectedStorageErrors=[];let injectingStorageFailure=false;
 page.on('console',m=>{if(['error','warning'].includes(m.type()))(injectingStorageFailure?expectedStorageErrors:messages).push(m.text())});page.on('pageerror',e=>messages.push(e.message));page.on('response',r=>{if(r.status()>=400)console.log('BUNDLED_HTTP_ERROR',r.status(),r.url())});
 await page.route('**/*',route=>{const u=route.request().url();if(u.startsWith(base+'/')||u.startsWith('data:'))return route.continue();external.push(u);return route.abort()});
 await context.addInitScript(()=>{
  const input={id:'virtual-keys',name:'Controlled virtual MIDI',state:'connected',type:'input',onmidimessage:null},access={inputs:new Map([[input.id,input]]),onstatechange:null};
  window.__midi={input,access,permissions:0};
  Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>{__midi.permissions++;if(__midi.defer)return new Promise(resolve=>{__midi.resolve=()=>resolve(access)});return access}});
 });
 await page.goto(base+'/music-studio.html#music-studio',{waitUntil:'networkidle'});await page.waitForFunction(()=>MusicStudio?.state.loaded);
 await page.evaluate(async()=>{const app=MusicStudio,repo=app.indexedDbRepository();window.__repo=repo;app.setRepository(repo);const p=app.makeProject({projectId:'virtual-midi',projectName:'Virtual MIDI verification',midiData:{ppq:480,tempo:400,timeSignature:{numerator:1,denominator:4},editor:{measureCount:4,transport:{countInEnabled:true,metronomeEnabled:true}},tracks:[{id:'melody',part:'melody',notes:[]},{id:'bass',part:'bass',notes:[{id:'untouched',pitch:48,startTick:0,durationTicks:120,velocity:91}]},{id:'drums',part:'drums',notes:[]}]}});await repo.put(p);app.state.projects=[p];location.hash='music-studio/midi-editor/virtual-midi'});
 await page.waitForSelector('.music-midi-editor-page');await page.waitForFunction(()=>MusicStudio.state.midiInput.initialized);
 const other=await page.evaluate(()=>JSON.stringify(MusicStudio.state.midiEditor.midiData.tracks.filter(t=>t.id!=='melody')));
 await page.locator('[onclick*="editorToggleMidiRecording"]').first().click();
 await page.waitForFunction(()=>MusicStudio.state.midiInput.countingIn||MusicStudio.state.midiInput.recording);
 await page.waitForFunction(()=>MusicStudio.state.midiInput.recording);
 assert.ok(await page.evaluate(()=>__midi.permissions>0));
 await page.evaluate(()=>__midi.input.onmidimessage({data:[0x90,64,100],timeStamp:performance.now()}));await page.waitForTimeout(80);
 await page.evaluate(()=>__midi.input.onmidimessage({data:[0x80,64,0],timeStamp:performance.now()}));
 assert.equal((await page.evaluate(()=>MusicStudio.editorStopTransport())).ok,true);
 const notes=await page.evaluate(()=>structuredClone(MusicStudio.state.midiEditor.midiData.tracks.find(t=>t.id==='melody').notes));assert.equal(notes.length,1);assert.equal(notes[0].pitch,64);assert.ok(notes[0].durationTicks>0);
 assert.equal(await page.evaluate(()=>JSON.stringify(MusicStudio.state.midiEditor.midiData.tracks.filter(t=>t.id!=='melody'))),other);
 await page.reload({waitUntil:'networkidle'});await page.waitForSelector('.music-midi-editor-page');await page.waitForFunction(()=>MusicStudio.state.midiEditor?.midiData?.tracks.some(t=>t.notes.some(n=>n.pitch===64)));
 assert.deepEqual(await page.evaluate(()=>structuredClone(MusicStudio.state.midiEditor.midiData.tracks.find(t=>t.id==='melody').notes)),notes);
 await page.evaluate(()=>{MusicStudio.state.midiEditor.playheadTick=0;return MusicStudio.editorToggleMelodyPlayback()});await page.waitForFunction(()=>MusicStudio.state.melodyAudio.playing);assert.ok(await page.evaluate(()=>MusicStudio.state.melodyAudio.synth.diagnostics.oscillatorsCreated>0));await page.evaluate(()=>MusicStudio.editorStopTransport());
 await page.evaluate(id=>{MusicStudioEditor.selectNote(MusicStudio.state.midiEditor,id);MusicStudio.editorDeleteNote()},notes[0].id);await page.evaluate(()=>MusicStudio.saveMidiEditor({silent:true}));
 assert.equal(await page.evaluate(()=>JSON.stringify(MusicStudio.state.midiEditor.midiData.tracks.filter(t=>t.id!=='melody'))),other);
 // Deferred audio uses the production synth with a controlled unlock gate.
 await page.evaluate(()=>{const synth=MusicStudio.state.melodyAudio.synth;window.__unlock=synth.unlock;synth.unlock=()=>new Promise(r=>window.__releaseAudio=r);window.__start=MusicStudio.editorStartMidiRecording()});
 await page.waitForFunction(()=>MusicStudio.state.midiInput.starting);await page.evaluate(()=>MusicStudio.editorStopTransport());await page.evaluate(async()=>{__releaseAudio(true);await __start;MusicStudio.state.melodyAudio.synth.unlock=__unlock});assert.equal(await page.evaluate(()=>MusicStudio.state.midiInput.recording),false);
 // Permission pending Stop and route cancellation, on real page event loop.
 for(const route of [false,true]){
  await page.evaluate(()=>{MusicStudio.state.midiInput.initialized=false;MusicStudio.state.midiInput.access=null;__midi.defer=true;window.__start=MusicStudio.editorStartMidiRecording()});await page.waitForFunction(()=>typeof __midi.resolve==='function');
  if(route){await page.evaluate(()=>MusicStudio.goHome());await page.waitForFunction(()=>!document.querySelector('.music-midi-editor-page'))}else await page.evaluate(()=>MusicStudio.editorStopTransport());
  await page.evaluate(async()=>{__midi.resolve();await __start;__midi.defer=false;delete __midi.resolve});assert.equal(await page.evaluate(()=>MusicStudio.state.midiInput.recording),false);
  if(route){await page.evaluate(()=>location.hash='music-studio/midi-editor/virtual-midi');await page.waitForSelector('.music-midi-editor-page')}
 }
 await page.evaluate(()=>{MusicStudio.state.midiEditor.midiData.editor.transport.countInEnabled=true;window.__start=MusicStudio.editorStartMidiRecording()});await page.waitForFunction(()=>MusicStudio.state.midiInput.countingIn);await page.evaluate(()=>MusicStudio.editorStopTransport());await page.evaluate(()=>__start);assert.equal(await page.evaluate(()=>MusicStudio.state.midiInput.recording),false);
 // Disconnect closes held notes, preserves exact Track and permits reconnect.
 await page.evaluate(()=>{MusicStudio.state.midiEditor.midiData.editor.transport.countInEnabled=false;MusicStudio.state.midiEditor.playheadTick=0;return MusicStudio.editorStartMidiRecording()});await page.waitForFunction(()=>MusicStudio.state.midiInput.recording);
 await page.evaluate(()=>__midi.input.onmidimessage({data:[0x90,67,100],timeStamp:performance.now()}));await page.waitForTimeout(80);
 await page.evaluate(()=>{__midi.access.inputs.clear();__midi.access.onstatechange({port:__midi.input})});await page.waitForFunction(()=>!MusicStudio.state.midiInput.recording&&!MusicStudio.state.midiInput.stopping);
 assert.ok(await page.evaluate(()=>MusicStudio.state.midiEditor.midiData.tracks.find(t=>t.id==='melody').notes.some(n=>n.pitch===67)));
 await page.evaluate(()=>{__midi.access.inputs.set(__midi.input.id,__midi.input);__midi.access.onstatechange({port:__midi.input})});
 assert.equal(await page.evaluate(()=>MusicStudio.state.midiInput.selectedId),'virtual-keys');
 // Repeated starts are rejected while a recording session is active.
 await page.evaluate(()=>{MusicStudio.state.midiEditor.playheadTick=0;return MusicStudio.editorStartMidiRecording()});await page.waitForFunction(()=>MusicStudio.state.midiInput.recording);
 assert.equal((await page.evaluate(()=>MusicStudio.editorStartMidiRecording())).ok,false);
 await page.evaluate(()=>__midi.input.onmidimessage({data:[0x90,69,100],timeStamp:performance.now()}));await page.waitForTimeout(60);await page.evaluate(()=>__midi.input.onmidimessage({data:[0x80,69,0],timeStamp:performance.now()}));
 // Actual IndexedDB write transaction abort, not a memory repository replacement.
 injectingStorageFailure=true;
 await page.evaluate(()=>{window.__transaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...args){const tx=__transaction.call(this,stores,mode,...args);if(mode==='readwrite'&&(stores==='projects'||Array.isArray(stores)&&stores.includes('projects')))queueMicrotask(()=>tx.abort());return tx}});
 const failed=await page.evaluate(()=>MusicStudio.editorStopTransport());assert.equal(failed.ok,false);assert.equal(await page.evaluate(()=>MusicStudio.state.midiEditor.dirty),true);
 await page.evaluate(()=>{IDBDatabase.prototype.transaction=__transaction});injectingStorageFailure=false;
 assert.equal((await page.evaluate(()=>MusicStudio.saveMidiEditor({silent:true}))).ok,true);
 await page.reload({waitUntil:'networkidle'});await page.waitForSelector('.music-midi-editor-page');await page.waitForFunction(()=>MusicStudio.state.midiEditor?.midiData?.tracks.find(t=>t.id==='melody')?.notes.some(n=>n.pitch===69));
 assert.equal(await page.evaluate(()=>JSON.stringify(MusicStudio.state.midiEditor.midiData.tracks.filter(t=>t.id!=='melody'))),other);
 assert.ok(expectedStorageErrors.length>0);
 assert.deepEqual(messages,[]);assert.deepEqual(external,[]);await context.close();return{width,virtualPermission:true,countIn:true,indexedDBSaveReopen:true,realWebAudioScheduling:true,oneNoteEditOtherTracksPreserved:true,pendingAudioStop:true,pendingPermissionStopAndRoute:true,countInStop:true,disconnectReconnect:true,duplicateStartRejected:true,indexedDBAbortRetryReopen:true,expectedStorageErrors,console:messages,external};
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined,args:['--autoplay-policy=no-user-gesture-required']});try{const results=[];for(const width of [1440,820,390])results.push(await verify(browser,base,width));fs.mkdirSync('verification',{recursive:true});fs.writeFileSync('verification/music-bundled-midi-browser.json',JSON.stringify({scope:'CONTROLLED_VIRTUAL_MIDI_CHROME_NOT_PHYSICAL_OR_WKWEBVIEW',results},null,2));console.log(JSON.stringify(results))}finally{await browser.close();server.close();fs.rmSync(root,{recursive:true,force:true})}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
