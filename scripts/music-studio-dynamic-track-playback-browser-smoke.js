#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const{chromium}=require('playwright');

const baseUrl=process.env.SMOKE_BASE_URL||'http://127.0.0.1:8765';
const viewports=[{width:1440,height:900},{width:820,height:900},{width:390,height:844}];

async function verifyViewport(browser,viewport){
  const page=await browser.newPage({viewport});
  const consoleMessages=[];
  page.on('console',message=>consoleMessages.push({type:message.type(),text:message.text()}));
  page.on('pageerror',error=>consoleMessages.push({type:'error',text:error.message}));
  await page.goto(`${baseUrl}/music-studio.html#music-studio`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.MusicStudio?.state?.loaded===true);
  await page.evaluate(()=>{
    const app=window.MusicStudio;
    const project=app.makeProject({projectId:'dynamic-browser-smoke',projectName:'Dynamic Browser Smoke',midiData:{ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},editor:{measureCount:4,loopEnabled:true,loopStart:0,loopEnd:960,transport:{countInEnabled:true,metronomeEnabled:true}},tracks:[
      {id:'core-melody',part:'melody',name:'Melody',notes:[{id:'core-m',pitch:60,startTick:0,durationTicks:480,velocity:90}]},
      {id:'core-drums',part:'drums',name:'Drums',notes:[{id:'core-d',pitch:36,startTick:0,durationTicks:120,velocity:100}]},
      {id:'core-bass',part:'bass',name:'Bass',notes:[{id:'core-b',pitch:40,startTick:0,durationTicks:480,velocity:85}]},
      {id:'external-other',name:'Melody',trackType:'midi-melodic',roleAssignment:'unassigned',notes:[{id:'other-note',pitch:72,startTick:0,durationTicks:480,velocity:70}]},
      {id:'external-target',name:'Melody',trackType:'midi-melodic',roleAssignment:'unassigned',notes:Array.from({length:12},(_,index)=>({id:`target-${index}`,pitch:64+index%4,startTick:index*60,durationTicks:60,velocity:90}))},
      {id:'external-drums',name:'Drums',trackType:'midi-drums',roleAssignment:'unassigned',notes:[{id:'external-drum-note',pitch:38,startTick:0,durationTicks:120,velocity:100}]}
    ]}});
    app.state.projects=[project];
    location.hash='music-studio/midi-editor/dynamic-browser-smoke';
  });
  await page.waitForSelector('.music-midi-editor-page');
  await page.locator('.music-dynamic-track-group[data-track-id="external-target"] .music-dynamic-track-button').click();
  await page.waitForFunction(()=>window.MusicStudio?.resolveCurrentTrackSelection?.().id==='external-target');
  await page.evaluate(()=>{
    window.__dynamicScheduled=[];
    window.MusicStudio.state.melodyAudio.synth={context:{currentTime:0},supported:()=>true,unlock:async()=>true,stopPlayback(){},stopMetronome(){},playTracks(tracks,timing){window.__dynamicScheduled.push(tracks.map(track=>({id:track.id,noteIds:track.notes.map(note=>note.id)})));return{ok:true,noteCount:tracks.reduce((sum,track)=>sum+track.notes.length,0),durationMs:10000,timelineDurationSeconds:10,playbackStart:0,secondsPerTick:.001,startTick:timing.startTick||0,endTick:timing.endTick||1920,tempoMap:[]}}};
  });
  const play=page.locator('[onclick*="editorToggleMelodyPlayback"]');
  assert.equal(await play.isDisabled(),false,`${viewport.width}: Play button must be enabled`);
  await play.click();
  await page.waitForFunction(()=>window.__dynamicScheduled.length===1);
  let state=await page.evaluate(()=>({current:MusicStudio.resolveCurrentTrackSelection(),selectedTrackId:MusicStudio.state.midiEditor.selectedTrackId,pianoNotes:[...document.querySelectorAll('.music-midi-note')].map(note=>note.dataset.noteId),scheduled:window.__dynamicScheduled,activeIds:MusicStudio.state.melodyAudio.transport?.activePlaybackTrackIds||[],mode:document.querySelector('.music-midi-editor-page')?.dataset.currentTrackMode,recordDisabled:document.querySelector('[onclick*="editorToggleMidiRecording"]')?.disabled,correctionEnabled:[...document.querySelectorAll('.music-correction-menu button,.music-correction-menu input,.music-correction-menu select')].some(control=>!control.disabled),partialEnabled:[...document.querySelectorAll('.music-partial-edit button,.music-partial-edit input,.music-partial-edit select,.music-partial-edit textarea')].some(control=>!control.disabled),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,roll:document.querySelector('.music-piano-roll')?.getBoundingClientRect().toJSON(),firstNote:document.querySelector('.music-midi-note')?.getBoundingClientRect().toJSON(),assetVersion:MusicStudio.__dynamicTrackPlaybackVersion,resourceNames:performance.getEntriesByType('resource').map(item=>item.name)}));
  assert.equal(state.current.id,'external-target');assert.equal(state.selectedTrackId,'external-target');assert.equal(state.pianoNotes.length,12);assert.deepEqual(state.scheduled[0].map(track=>track.id),['external-target']);assert.equal(state.scheduled[0][0].noteIds.length,12);assert.deepEqual(state.activeIds,['external-target']);assert.equal(state.mode,'playback');assert.equal(state.recordDisabled,true);assert.equal(state.correctionEnabled,false);assert.equal(state.partialEnabled,false);assert.ok(state.overflow<=1,`${viewport.width}: horizontal overflow ${state.overflow}`);assert.ok(state.firstNote.x>=state.roll.x-1&&state.firstNote.right<=state.roll.right+1,`${viewport.width}: Piano Roll note outside roll`);assert.equal(state.assetVersion,'1.0.1');assert.ok(state.resourceNames.some(name=>name.includes('music-studio-dynamic-track-playback.js?v=1.0.1')));
  await page.locator('[onclick*="editorStopTransport"]').click();
  await page.waitForFunction(()=>MusicStudio.state.melodyAudio.playing===false);
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.__dynamicScheduled.length===2);
  state=await page.evaluate(()=>({scheduled:window.__dynamicScheduled,playing:MusicStudio.state.melodyAudio.playing,activeIds:MusicStudio.state.melodyAudio.transport?.activePlaybackTrackIds||[]}));
  assert.deepEqual(state.scheduled[1].map(track=>track.id),['external-target']);assert.equal(state.playing,true);assert.deepEqual(state.activeIds,['external-target']);
  await page.keyboard.press('Space');await page.waitForFunction(()=>MusicStudio.state.melodyAudio.playing===false);
  const unexpected=consoleMessages.filter(message=>['error','warning'].includes(message.type)&&!message.text.includes('favicon'));
  assert.deepEqual(unexpected,[],`${viewport.width}: unexpected console output`);
  await page.close();
  return{viewport:viewport.width,currentTrackId:'external-target',notes:12,buttonPlayback:true,shortcutPlayback:true,stop:true,recordingGate:true,correctionGate:true,partialEditGate:true,horizontalOverflow:false,consoleErrors:0,consoleWarnings:0};
}

(async()=>{const browser=await chromium.launch({headless:true});try{const results=[];for(const viewport of viewports)results.push(await verifyViewport(browser,viewport));process.stdout.write(`${JSON.stringify(results,null,2)}\n`)}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
