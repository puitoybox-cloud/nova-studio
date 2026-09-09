#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const{chromium}=require('playwright');
const baseUrl=process.env.SMOKE_BASE_URL||'http://127.0.0.1:8765';
const viewports=[{width:1440,height:900},{width:820,height:900},{width:390,height:844}];
async function sendNote(page,pitch,velocity=100){
  await page.evaluate(({pitch,velocity})=>__fakeMidiInput.onmidimessage({data:[0x90,pitch,velocity],timeStamp:performance.now()}),{pitch,velocity});
  await page.waitForTimeout(30);
  const live=await page.evaluate(()=>({recording:MusicStudio.state.midiInput.recording,stateLive:MusicStudio.state.midiInput.liveNotes.some(note=>note.active),domLive:Boolean(document.querySelector('[data-live-note-id]'))}));
  assert.equal(live.recording,true,'recording must remain active after note-on');
  assert.equal(live.stateLive,true,'existing live-note state must contain the held note');
  assert.equal(live.domLive,true,'existing live-note DOM path must render the held note');
  await page.evaluate(({pitch})=>__fakeMidiInput.onmidimessage({data:[0x80,pitch,0],timeStamp:performance.now()+125}),{pitch});
}
async function selectTrack(page,trackId){
  await page.locator(`.music-dynamic-track-group[data-track-id="${trackId}"] .music-dynamic-track-button`).click();
  await page.waitForFunction(id=>MusicStudio.resolveCurrentTrackSelection().id===id,trackId)
}
async function recordTrack(page,trackId,pitch){
  await selectTrack(page,trackId);
  const record=page.locator('[onclick*="editorToggleMidiRecording"]');
  assert.equal(await record.isDisabled(),false,`${trackId}: record must be enabled`);
  await record.click();
  await page.waitForFunction(()=>MusicStudio.state.midiInput.recording===true);
  assert.equal(await page.evaluate(()=>MusicStudio.state.midiInput.recordingTrackId),trackId);
  await sendNote(page,pitch);
  await page.locator('[onclick*="editorStopTransport"]').click();
  await page.waitForFunction(()=>MusicStudio.state.midiInput.recording===false)
}
async function verifyKeyboardShortcuts(page){
  await selectTrack(page,'melody');
  await page.keyboard.press('r');await page.waitForFunction(()=>MusicStudio.state.midiInput.recording===true);
  assert.equal(await page.evaluate(()=>MusicStudio.state.midiInput.recordingTrackId),'melody','Core R must start Core Melody recording');
  await page.keyboard.press('r');await page.waitForFunction(()=>MusicStudio.state.midiInput.recording===false);
  await page.evaluate(()=>{MusicStudio.state.midiEditor.playheadTick=240});await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>MusicStudio.state.midiEditor.playheadTick),0,'Core Enter must return playhead to start');

  await selectTrack(page,'external-b');
  await page.keyboard.press('r');await page.waitForFunction(()=>MusicStudio.state.midiInput.recording===true);
  assert.equal(await page.evaluate(()=>MusicStudio.state.midiInput.recordingTrackId),'external-b','External R must start exact selected Track recording');
  await page.keyboard.press('r');await page.waitForFunction(()=>MusicStudio.state.midiInput.recording===false);
  await page.evaluate(()=>{MusicStudio.state.midiEditor.playheadTick=240;window.__playedTrackIds=[]});await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>MusicStudio.state.midiEditor.playheadTick),0,'External Enter must return playhead to start');
  await page.keyboard.press('Space');await page.waitForTimeout(30);
  assert.deepEqual(await page.evaluate(()=>window.__playedTrackIds||[]),['external-b'],'External Space must use exact selected Track playback');
  await page.keyboard.press('Space');await page.waitForTimeout(20)
}
async function verify(browser,viewport){
  const page=await browser.newPage({viewport});const messages=[];
  page.on('console',m=>messages.push({type:m.type(),text:m.text()}));page.on('pageerror',e=>messages.push({type:'error',text:e.message}));
  await page.addInitScript(()=>{const input={id:'keys',name:'Keystation Mini 32 MK3',manufacturer:'M-Audio',onmidimessage:null};const access={inputs:new Map([['keys',input]]),onstatechange:null};Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>access});window.__fakeMidiInput=input});
  await page.goto(`${baseUrl}/music-studio.html#music-studio`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.MusicStudio?.state?.loaded===true);
  await page.evaluate(async()=>{const app=MusicStudio,project=app.makeProject({projectId:'dynamic-record-smoke',projectName:'Dynamic Record Smoke',midiData:{ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},editor:{measureCount:4,transport:{countInEnabled:false,metronomeEnabled:false}},tracks:[{id:'melody',part:'melody',name:'Melody',notes:[]},{id:'drums',part:'drums',name:'Drums',channel:10,notes:[]},{id:'bass',part:'bass',name:'Bass',notes:[]},{id:'external-a',name:'Duplicate',trackType:'midi-melodic',roleAssignment:'strings',notes:[{id:'a',pitch:72,startTick:0,durationTicks:120,velocity:70}]},{id:'external-b',name:'Duplicate',trackType:'midi-melodic',roleAssignment:'strings',notes:[{id:'b',pitch:74,startTick:0,durationTicks:120,velocity:71}]},{id:'external-drums',name:'External Drums',trackType:'midi-drums',roleAssignment:'unassigned',channel:10,notes:[{id:'d',pitch:36,startTick:0,durationTicks:120,velocity:100}]}]}});const repo=app.memoryRepository();app.setRepository(repo);await repo.put(project);app.state.projects=[project];location.hash='music-studio/midi-editor/dynamic-record-smoke'});
  await page.waitForSelector('.music-midi-editor-page');await page.waitForFunction(()=>MusicStudio.state.midiInput.initialized===true);
  await page.evaluate(()=>{MusicStudio.state.melodyAudio.synth={context:{currentTime:0,state:'running'},supported:()=>true,unlock:async()=>true,noteOn(){return true},noteOff(){return true},previewTrackNote(){return true},allNotesOff(){},stopPreview(){},stopPlayback(){},stopMetronome(){},playTracks(tracks,timing){window.__playedTrackIds=tracks.map(t=>t.id);return{ok:true,noteCount:tracks.flatMap(t=>t.notes||[]).length,durationMs:10000,timelineDurationSeconds:10,playbackStart:0,secondsPerTick:.001,startTick:timing.startTick||0,endTick:timing.endTick||1920,tempoMap:[]}}}});
  await verifyKeyboardShortcuts(page);
  await recordTrack(page,'external-b',67);
  await recordTrack(page,'external-drums',38);
  await selectTrack(page,'external-b');
  await page.locator('[onclick*="editorToggleMelodyPlayback"]').click();await page.waitForTimeout(30);
  const played=await page.evaluate(()=>window.__playedTrackIds||[]);assert.deepEqual(played,['external-b'],`${viewport.width}: playback must stay on exact selected Track ID`);
  await page.evaluate(()=>MusicStudio.editorStopMelody(false,false));
  const state=await page.evaluate(()=>{const tracks=MusicStudio.state.midiEditor.midiData.tracks,page=document.querySelector('.music-midi-editor-page');return{current:MusicStudio.resolveCurrentTrackSelection().id,a:tracks.find(t=>t.id==='external-a').notes.length,b:tracks.find(t=>t.id==='external-b').notes.length,core:tracks.find(t=>t.id==='melody').notes.length,externalDrums:tracks.find(t=>t.id==='external-drums').notes.length,coreDrums:tracks.find(t=>t.id==='drums').notes.length,recordingId:page.dataset.currentTrackRecordingId,gate:page.dataset.recordingCapabilityGate,correctionEnabled:[...document.querySelectorAll('.music-correction-menu button,.music-correction-menu input,.music-correction-menu select')].some(c=>!c.disabled),partialEnabled:[...document.querySelectorAll('.music-partial-edit button,.music-partial-edit input,.music-partial-edit select,.music-partial-edit textarea')].some(c=>!c.disabled),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,assetVersion:MusicStudio.__dynamicTrackRecordingVersion}});
  assert.equal(state.current,'external-b');assert.equal(state.a,1);assert.equal(state.b,2);assert.equal(state.core,0);assert.equal(state.externalDrums,2);assert.equal(state.coreDrums,0);assert.equal(state.recordingId,'external-b');assert.equal(state.gate,'open');assert.equal(state.correctionEnabled,false);assert.equal(state.partialEnabled,false);assert.ok(state.overflow<=1,`${viewport.width}: horizontal overflow ${state.overflow}`);assert.equal(state.assetVersion,'1.0.1');
  const unexpected=messages.filter(m=>['error','warning'].includes(m.type)&&!m.text.includes('favicon'));assert.deepEqual(unexpected,[],`${viewport.width}: unexpected console output`);
  await page.close();return{viewport:viewport.width,exactTrackId:true,externalMelodicRecord:true,externalDrumRecord:true,coreRecordShortcut:true,externalRecordShortcut:true,goToStartShortcut:true,playbackShortcut:true,liveNote:true,stopCommit:true,playback:true,correctionGate:true,partialEditGate:true,horizontalOverflow:false,consoleErrors:0,consoleWarnings:0}
}
(async()=>{const browser=await chromium.launch({headless:true});try{const results=[];for(const viewport of viewports)results.push(await verify(browser,viewport));console.log(JSON.stringify(results,null,2))}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
