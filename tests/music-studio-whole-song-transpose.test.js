const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function load(){const window={crypto:{randomUUID:(()=>{let n=0;return()=>`song-transpose-${++n}`})()}};window.window=window;window.globalThis=window;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);return window.MusicStudioEditor}
const plain=v=>JSON.parse(JSON.stringify(v));
function project(){return{projectId:'whole-song',midiData:{ppq:480,timeSignature:{numerator:4,denominator:4},editor:{measureCount:4},tracks:[
{id:'core-melody',part:'melody',name:'Melody',notes:[{id:'m',pitch:60,startTick:0,durationTicks:240,velocity:80}]},
{id:'core-drums',part:'drums',name:'Drums',channel:10,notes:[{id:'d',pitch:36,startTick:0,durationTicks:120,velocity:100}]},
{id:'core-bass',part:'bass',name:'Bass',channel:2,notes:[{id:'b',pitch:40,startTick:0,durationTicks:480,velocity:75}]},
{id:'vocal',name:'Vocals',trackType:'midi-melodic',roleAssignment:'vocal',notes:[{id:'v',pitch:64,startTick:0,durationTicks:333,velocity:91}]},
{id:'bass-ext',name:'Bass Stem',trackType:'midi-melodic',roleAssignment:'bass',notes:[{id:'be',pitch:43,startTick:0,durationTicks:480,velocity:80}]},
{id:'guitar',name:'Guitar',trackType:'midi-melodic',roleAssignment:'guitar',notes:[{id:'g',pitch:67,startTick:0,durationTicks:240,velocity:82}]},
{id:'drums-ext',name:'Drums Stem',trackType:'midi-drums',roleAssignment:'drums',notes:[{id:'de',pitch:38,startTick:0,durationTicks:120,velocity:99}]}
]}}}
function track(s,id){return s.midiData.tracks.find(t=>t.id===id)}
test('whole-song transpose changes all melodic tracks together and excludes drums/core bass',()=>{const core=load(),s=core.createSession(project()),before=plain(s.midiData);const p=core.previewSongTranspose(s,{fromKey:'C',toKey:'D',direction:'shortest'});assert.equal(p.ok,true);assert.equal(p.preview.semitones,2);assert.deepEqual(plain(p.preview.targetTrackIds),['core-melody','vocal','bass-ext','guitar']);assert.deepEqual(plain(s.midiData),before);const a=core.applySongTranspose(s);assert.deepEqual({tracks:a.trackCount,notes:a.noteCount},{tracks:4,notes:4});assert.equal(track(s,'core-melody').notes[0].pitch,62);assert.equal(track(s,'vocal').notes[0].pitch,66);assert.equal(track(s,'bass-ext').notes[0].pitch,45);assert.equal(track(s,'guitar').notes[0].pitch,69);assert.equal(track(s,'core-drums').notes[0].pitch,36);assert.equal(track(s,'core-bass').notes[0].pitch,40);assert.equal(track(s,'drums-ext').notes[0].pitch,38)});
test('whole-song transpose is one undo/redo operation',()=>{const core=load(),s=core.createSession(project()),before=plain(s.midiData);core.previewSongTranspose(s,{fromKey:'C',toKey:'B',direction:'shortest'});core.applySongTranspose(s);assert.equal(track(s,'vocal').notes[0].pitch,63);core.undo(s);assert.deepEqual(plain(s.midiData),before);core.redo(s);assert.equal(track(s,'core-melody').notes[0].pitch,59);assert.equal(track(s,'guitar').notes[0].pitch,66)});
test('whole-song apply rejects stale preview without mutation',()=>{const core=load(),s=core.createSession(project());core.previewSongTranspose(s,{fromKey:'C',toKey:'D'});track(s,'guitar').notes[0].pitch=68;const before=plain(s.midiData),r=core.applySongTranspose(s);assert.equal(r.ok,false);assert.deepEqual(plain(s.midiData),before)});
test('whole-song preview rejects MIDI boundary overflow atomically',()=>{const core=load(),source=project();source.midiData.tracks.find(t=>t.id==='vocal').notes[0].pitch=127;const s=core.createSession(source),before=plain(s.midiData),r=core.previewSongTranspose(s,{fromKey:'C',toKey:'D',direction:'up'});assert.equal(r.ok,false);assert.ok(r.outOfRange.length);assert.deepEqual(plain(s.midiData),before)});
