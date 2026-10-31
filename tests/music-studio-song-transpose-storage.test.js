'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const plain=v=>JSON.parse(JSON.stringify(v));
function load(){
 const errors=[],values=new Map(),w={crypto:{randomUUID:(()=>{let n=0;return()=>`shutdown-${++n}`})()},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},location:{hash:'#music-studio/midi-editor/song'},setTimeout,clearTimeout,console:{...console,error:e=>errors.push(String(e))},TextEncoder};w.window=w;
 for(const file of ['music-studio-meter-map.js','music-studio-measure-locks.js','music-studio-editor.js','music-studio-playback.js','music-studio-midi-input.js','music-studio.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),w,{filename:file});
 const app=w.MusicStudio,core=w.MusicStudioEditor,repo=app.memoryRepository();app.setRepository(repo);
 return{w,app,core,repo,errors,values};
}
async function fixture(){const h=load(),p=h.app.makeProject({projectId:'song',projectName:'Transpose fixture',key:'Cm',chordProgressions:[{chord:'Cm/G'}],midiData:{ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[{id:'melody',part:'melody',notes:[]},{id:'bass',part:'bass',notes:[{id:'safe',pitch:36,startTick:0,durationTicks:240,velocity:90}]}]}});await h.repo.put(p);h.app.state.projects=[p];h.app.state.midiEditor=h.core.createCoordinatedSession(p);return{...h,p,session:h.app.state.midiEditor};}
function add(h,pitch=64){h.core.addNote(h.session,{pitch,startTick:0,durationTicks:240,velocity:90});}
function pauseWrite(repo){const original=repo.compareAndPut;let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);repo.compareAndPut=async(...args)=>{enter();await gate;return original(...args)};return{entered,release,restore(){repo.compareAndPut=original}};}
function transpose(h,fromKey='C',toKey='D'){assert.equal(h.core.previewSongTranspose(h.session,{fromKey,toKey}).ok,true);assert.equal(h.core.applySongTranspose(h.session).ok,true)}
test('whole-song key chords bass save reopen backup and undo persist as one transaction',async()=>{
 const h=await fixture();add(h);h.core.markSaved(h.session);h.session.undo=[];const original=plain(h.session.midiData);transpose(h);
 assert.equal((await h.app.saveMidiEditor({silent:true})).ok,true);let p=await h.repo.get('song');assert.equal(p.musicalSettings.key,'Dm');assert.equal(p.chordProgressions[0].chord,'Dm/A');assert.equal(p.midiData.tracks.find(t=>t.part==='bass').notes[0].pitch,38);assert.equal(h.session.dirty,false);
 const reopened=h.core.createCoordinatedSession(p);assert.deepEqual(plain(reopened.songHarmony),plain(h.session.songHarmony));assert.equal(h.app.backupObject().projects[0].musicalSettings.key,'Dm');assert.equal(JSON.parse((await h.app.exportProject('song')).text).chordProgressions[0].chord,'Dm/A');
 h.core.undo(h.session);assert.equal(h.session.dirty,true);assert.deepEqual(plain(h.session.midiData),original);assert.equal((await h.app.saveMidiEditor({silent:true})).ok,true);p=await h.repo.get('song');assert.equal(p.musicalSettings.key,'Cm');assert.equal(p.chordProgressions[0].chord,'Cm/G');h.core.redo(h.session);assert.equal((await h.app.prepareForShutdown()).ok,true);assert.equal((await h.repo.get('song')).musicalSettings.key,'Dm');
});
test('whole-song save failure and concurrent harmony edits preserve source and pending transaction',async()=>{
 const h=await fixture();transpose(h);const original=h.repo.compareAndPut;h.repo.compareAndPut=async()=>{throw Error('disk-full')};assert.equal((await h.app.saveMidiEditor({silent:true})).ok,false);assert.equal((await h.repo.get('song')).musicalSettings.key,'Cm');assert.equal(h.session.dirty,true);h.repo.compareAndPut=original;
 const competing=await h.repo.get('song');competing.chordProgressions=[{chord:'F'}];await h.repo.put(competing);assert.equal((await h.app.saveMidiEditor({silent:true})).ok,false);assert.equal((await h.repo.get('song')).chordProgressions[0].chord,'F');assert.equal(h.session.songHarmony.chordProgressions[0].chord,'Dm/A');
});
test('whole-song save captures harmony snapshot and retains newer transpose while write waits',async()=>{
 const h=await fixture();transpose(h);const gate=pauseWrite(h.repo),saving=h.app.saveMidiEditor({silent:true});await gate.entered;transpose(h,'D','E');gate.release();assert.equal((await saving).stale,true);assert.equal(h.session.dirty,true);assert.equal((await h.repo.get('song')).musicalSettings.key,'Dm');assert.equal((await h.app.saveMidiEditor({silent:true})).ok,true);assert.equal((await h.repo.get('song')).musicalSettings.key,'Em');assert.equal(h.session.dirty,false);
});
test('whole-song coordinated measure locks reject transpose before metadata or notes change',async()=>{
 const h=await fixture();h.core.selectPart(h.session,'bass');h.core.setSelectedMeasures(h.session,[1]);h.core.toggleLockSelected(h.session);const before=plain(h.session.midiData),harmony=plain(h.session.songHarmony);assert.equal(h.core.previewSongTranspose(h.session,{fromKey:'C',toKey:'D'}).ok,false);assert.deepEqual(plain(h.session.midiData),before);assert.deepEqual(plain(h.session.songHarmony),harmony);
});
