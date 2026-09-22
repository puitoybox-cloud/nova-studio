'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ctx={};ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-scoped-midi-repair.js'),'utf8'),ctx);
const repair=ctx.MusicStudioScopedMidiRepair;
const plain=v=>JSON.parse(JSON.stringify(v));
const note=(id,startTick,durationTicks=120,locked=false)=>({id,pitch:60,startTick,durationTicks,velocity:80,locked});
function project(){return{midiData:{ppq:480,timeSignature:{numerator:4,denominator:4},tracks:[{id:'ext-piano',notes:[note('before',120),note('move',1930),note('duplicate',1930),note('locked',1950,120,true),note('outside',3840)]},{id:'ext-bass',notes:[note('bass',1930)]}]}}}
test('repair only the selected track and measures; preserve input and locked notes',()=>{
 const p=project(),original=plain(p),result=repair.preview(p,{trackId:'ext-piano',measureFrom:2,measureTo:2,toleranceTicks:20});
 assert.equal(result.ok,true);assert.deepEqual(plain(p),original);
 assert.equal(result.afterNotes.find(n=>n.id==='move').startTick,1920);
 assert.equal(result.afterNotes.some(n=>n.id==='duplicate'),false);
 assert.equal(result.afterNotes.find(n=>n.id==='locked').startTick,1950);
 assert.equal(result.afterNotes.find(n=>n.id==='before').startTick,120);
 assert.equal(result.afterNotes.find(n=>n.id==='outside').startTick,3840);
 const applied=repair.apply(p,result);assert.equal(applied.ok,true);
 assert.deepEqual(plain(p),original);assert.deepEqual(plain(applied.project.midiData.tracks[1]),original.midiData.tracks[1]);
});
test('reject stale preview and invalid measure range',()=>{
 const p=project(),result=repair.preview(p,{trackId:'ext-piano',measureFrom:2,measureTo:2});
 p.midiData.tracks[0].notes[0].pitch=61;
 assert.equal(repair.apply(p,result).reason,'stale-preview');
 assert.equal(repair.preview(p,{trackId:'ext-piano',measureFrom:3,measureTo:2}).reason,'invalid-range');
});
test('short notes are suggestions, not automatically deleted',()=>{
 const p=project();p.midiData.tracks[0].notes.push(note('short',2000,8));
 const result=repair.preview(p,{trackId:'ext-piano',measureFrom:2,measureTo:2});
 assert.equal(result.afterNotes.some(n=>n.id==='short'),true);
 assert.equal(result.suggestions.some(s=>s.noteId==='short'),true);
});

test('core apply creates one Undo and preserves other external tracks',()=>{
 const window={crypto:{randomUUID:(()=>{let id=0;return()=>String(++id)})()}};window.window=window;window.globalThis=window;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);
 const core=window.MusicStudioEditor,p=project();p.projectId='scoped-repair';
 p.midiData.tracks[0].trackType='midi-melodic';p.midiData.tracks[1].trackType='midi-melodic';
 const session=core.createSession(p);core.selectTrackById(session,'ext-piano');
 const other=plain(session.midiData.tracks[1]),original=plain(core.currentTrack(session).notes);
 const result=repair.preview({midiData:session.midiData},{trackId:'ext-piano',measureFrom:2,measureTo:2,toleranceTicks:20});
 assert.equal(result.ok,true);
 const applied=core.applyScopedMidiRepair(session,result);
 assert.equal(applied.ok,true);assert.equal(session.undo.length,1);
 assert.deepEqual(plain(session.midiData.tracks[1]),other);
 core.undo(session);
 assert.deepEqual(plain(core.currentTrack(session).notes),original);
});
test('core refuses forged changes outside the selected measure',()=>{
 const window={crypto:{randomUUID:()=> 'id'}};window.window=window;window.globalThis=window;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);
 const core=window.MusicStudioEditor,p=project();p.projectId='scoped-repair';
 p.midiData.tracks[0].trackType='midi-melodic';p.midiData.tracks[1].trackType='midi-melodic';
 const session=core.createSession(p);core.selectTrackById(session,'ext-piano');
 const result=repair.preview({midiData:session.midiData},{trackId:'ext-piano',measureFrom:2,measureTo:2});
 result.afterNotes.find(n=>n.id==='before').pitch=61;
 assert.equal(core.applyScopedMidiRepair(session,result).reason,'out-of-range');
 assert.equal(session.undo.length,0);
});

test('nearby distinct original notes are not deleted when timing snaps together',()=>{
 const p=project();p.midiData.tracks[0].notes.push(note('nearby',1935));
 const result=repair.preview(p,{trackId:'ext-piano',measureFrom:2,measureTo:2,toleranceTicks:20});
 assert.equal(result.ok,true);
 assert.equal(result.afterNotes.some(n=>n.id==='nearby'),true);
});
test('notes crossing the requested measure end remain unchanged',()=>{
 const p=project();p.midiData.tracks[0].notes.push(note('crossing',3810,200));
 const result=repair.preview(p,{trackId:'ext-piano',measureFrom:2,measureTo:2,toleranceTicks:20});
 assert.equal(result.ok,true);
 assert.deepEqual(plain(result.afterNotes.find(n=>n.id==='crossing')),plain(p.midiData.tracks[0].notes.find(n=>n.id==='crossing')));
});
