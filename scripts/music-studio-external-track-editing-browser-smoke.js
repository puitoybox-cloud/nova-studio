#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const{chromium}=require('playwright');
const baseUrl=process.env.SMOKE_BASE_URL||'http://127.0.0.1:8765';
const viewports=[{width:1440,height:900},{width:820,height:900},{width:390,height:844}];
const externalIds=['external-melody','external-drums','external-bass'];
const coreIds=['melody','drums','bass'];

async function selectTrack(page,trackId){assert.equal(await page.evaluate(id=>MusicStudio.editorSelectTrack(id),trackId),true);await page.waitForFunction(id=>MusicStudio.resolveCurrentTrackSelection().id===id,trackId);assert.equal(await page.locator('.music-midi-editor-page').getAttribute('data-current-track-can-edit-notes'),'true')}
async function clickAction(page,name){const control=page.locator(`[onclick="MusicStudio.${name}()"]`).first();await control.scrollIntoViewIfNeeded();assert.equal(await control.isDisabled(),false,`${name} should be enabled`);await control.click()}
async function snapshot(page){return page.evaluate(()=>Object.fromEntries(MusicStudio.state.midiEditor.midiData.tracks.map(track=>[track.id,JSON.parse(JSON.stringify(track.notes||[]))])))}
async function assertOtherTracksUnchanged(page,target,before){const after=await snapshot(page);for(const[id,notes]of Object.entries(before))if(id!==target)assert.deepEqual(after[id],notes,`${target} edit changed ${id}`);return after}

async function editTrack(page,trackId){
  await selectTrack(page,trackId);const before=await snapshot(page),initialCount=before[trackId].length;
  await clickAction(page,'editorAddNote');assert.equal((await snapshot(page))[trackId].length,initialCount+1);await assertOtherTracksUnchanged(page,trackId,before);
  const noteId=await page.evaluate(()=>MusicStudioEditor.currentTrack(MusicStudio.state.midiEditor).notes.find(note=>!note.locked).id);
  await page.locator(`.music-midi-note[data-note-id="${noteId}"]`).dispatchEvent('pointerdown',{button:0,pointerId:11,pointerType:'mouse'});await page.waitForFunction(id=>MusicStudioEditor.selectedIds(MusicStudio.state.midiEditor).includes(id),noteId);
  await clickAction(page,'editorLockSelectedNotes');assert.equal(await page.evaluate(id=>MusicStudioEditor.currentTrack(MusicStudio.state.midiEditor).notes.find(note=>note.id===id).locked,noteId),true);
  await clickAction(page,'editorUnlockSelectedNotes');assert.equal(await page.evaluate(id=>MusicStudioEditor.currentTrack(MusicStudio.state.midiEditor).notes.find(note=>note.id===id).locked,noteId),false);
  await clickAction(page,'editorSelectAllNotes');assert.equal(await page.evaluate(()=>MusicStudioEditor.selectedIds(MusicStudio.state.midiEditor).length),initialCount+1);
  await page.evaluate(()=>{const session=MusicStudio.state.midiEditor,notes=MusicStudioEditor.currentTrack(session).notes;notes.forEach((note,index)=>{note.durationTicks=120+index*30;note.velocity=60+index});session.selectedNoteId=notes.at(-1).id;session.selectedNoteIds=notes.map(note=>note.id)});
  await clickAction(page,'editorMatchDuration');await clickAction(page,'editorMatchVelocity');const matched=await page.evaluate(()=>{const notes=MusicStudioEditor.currentTrack(MusicStudio.state.midiEditor).notes;return{durations:[...new Set(notes.map(note=>note.durationTicks))],velocities:[...new Set(notes.map(note=>note.velocity))]}});assert.equal(matched.durations.length,1);assert.equal(matched.velocities.length,1);
  await clickAction(page,'editorCopy');await clickAction(page,'editorPaste');const afterPaste=await snapshot(page);assert.equal(new Set(afterPaste[trackId].map(note=>note.id)).size,afterPaste[trackId].length);await assertOtherTracksUnchanged(page,trackId,before);
  await clickAction(page,'editorDuplicate');const afterDuplicate=await snapshot(page);assert.equal(new Set(afterDuplicate[trackId].map(note=>note.id)).size,afterDuplicate[trackId].length);await assertOtherTracksUnchanged(page,trackId,before);
  const eraseId=await page.evaluate(()=>MusicStudioEditor.selectedIds(MusicStudio.state.midiEditor)[0]);await page.locator(`.music-midi-note[data-note-id="${eraseId}"]`).dispatchEvent('pointerdown',{button:0,pointerId:12,pointerType:'mouse'});const countBeforeErase=(await snapshot(page))[trackId].length;await clickAction(page,'editorDeleteNote');assert.equal((await snapshot(page))[trackId].length,countBeforeErase-1);await assertOtherTracksUnchanged(page,trackId,before)
}

async function verify(browser,viewport){
  const page=await browser.newPage({viewport}),messages=[];page.on('console',message=>messages.push({type:message.type(),text:message.text()}));page.on('pageerror',error=>messages.push({type:'error',text:error.message}));
  await page.goto(`${baseUrl}/music-studio.html#music-studio`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.MusicStudio?.state?.loaded===true);
  await page.evaluate(async()=>{const n=(id,pitch,startTick=0,extra={})=>({id,pitch,startTick,durationTicks:120,velocity:80,...extra}),tracks=[{id:'melody',part:'melody',name:'Melody',notes:[n('same-note',60)]},{id:'drums',part:'drums',name:'Drums',channel:10,notes:[n('same-note',36)]},{id:'bass',part:'bass',name:'Bass',notes:[n('same-note',48)]},{id:'external-melody',name:'External Melody',trackType:'midi-melodic',roleAssignment:'melody',notes:[n('same-note',72),n('em-2',74,240)]},{id:'external-drums',name:'External Drums',trackType:'midi-drums',roleAssignment:'drums',channel:10,notes:[n('same-note',38),n('ed-2',42,240)]},{id:'external-bass',name:'External Bass',trackType:'midi-melodic',roleAssignment:'bass',notes:[n('same-note',43),n('eb-2',45,240)]}],project=MusicStudio.makeProject({projectId:'external-edit-smoke',projectName:'External Edit Smoke',midiData:{ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},editor:{measureCount:8},tracks}}),repo=MusicStudio.memoryRepository();window.__externalEditRepo=repo;MusicStudio.setRepository(repo);await repo.put(project);MusicStudio.state.projects=[project];location.hash='music-studio/midi-editor/external-edit-smoke'});
  await page.waitForSelector('.music-midi-editor-page');const coreBefore=await page.evaluate(ids=>Object.fromEntries(MusicStudio.state.midiEditor.midiData.tracks.filter(track=>ids.includes(track.id)).map(track=>[track.id,JSON.parse(JSON.stringify(track.notes))])),coreIds);
  for(const trackId of externalIds)await editTrack(page,trackId);
  assert.deepEqual(await page.evaluate(ids=>Object.fromEntries(MusicStudio.state.midiEditor.midiData.tracks.filter(track=>ids.includes(track.id)).map(track=>[track.id,JSON.parse(JSON.stringify(track.notes))])),coreIds),coreBefore);
  const saved=await page.evaluate(async()=>{const result=await MusicStudio.saveMidiEditor({silent:true}),project=await window.__externalEditRepo.get('external-edit-smoke');return{result,project}});assert.equal(saved.result.ok,true);assert.deepEqual(saved.project.midiData.tracks.map(track=>track.id),[...coreIds,...externalIds]);
  const exportIds=await page.evaluate(project=>MusicStudio.midiExportInput(project,'all').tracks.map(track=>track.id),saved.project);assert.deepEqual(exportIds,[...coreIds,...externalIds]);assert.equal(new Set(exportIds).size,exportIds.length);
  const restrictions=await page.evaluate(()=>({correction:[...document.querySelectorAll('.music-correction-menu button,.music-correction-menu input,.music-correction-menu select')].every(control=>control.disabled),partial:[...document.querySelectorAll('.music-partial-edit button,.music-partial-edit input,.music-partial-edit select,.music-partial-edit textarea')].every(control=>control.disabled),resize:[...document.querySelectorAll('.music-note-resize')].every(handle=>handle.style.pointerEvents==='none'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));assert.equal(restrictions.correction,true);assert.equal(restrictions.partial,true);assert.equal(restrictions.resize,true);assert.ok(restrictions.overflow<=1);
  const unexpected=messages.filter(message=>message.type==='error'||message.type==='warning');assert.deepEqual(unexpected,[]);await page.close();return{viewport:viewport.width,externalTracks:3,editing:true,isolation:true,saveReload:true,allMidiExport:true,consoleErrors:0,consoleWarnings:0}
}

(async()=>{const browser=await chromium.launch({headless:true});try{const results=[];for(const viewport of viewports)results.push(await verify(browser,viewport));console.log(JSON.stringify(results,null,2))}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
