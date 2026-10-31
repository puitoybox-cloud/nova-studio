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
test('whole-song transpose changes all melodic tracks together and includes core bass and excludes drums',()=>{const core=load(),s=core.createSession(project()),before=plain(s.midiData);const p=core.previewSongTranspose(s,{fromKey:'C',toKey:'D',direction:'shortest'});assert.equal(p.ok,true);assert.equal(p.preview.semitones,2);assert.deepEqual(plain(p.preview.targetTrackIds),['core-melody','core-bass','vocal','bass-ext','guitar']);assert.deepEqual(plain(s.midiData),before);const a=core.applySongTranspose(s);assert.deepEqual({tracks:a.trackCount,notes:a.noteCount},{tracks:5,notes:5});assert.equal(track(s,'core-melody').notes[0].pitch,62);assert.equal(track(s,'vocal').notes[0].pitch,66);assert.equal(track(s,'bass-ext').notes[0].pitch,45);assert.equal(track(s,'guitar').notes[0].pitch,69);assert.equal(track(s,'core-drums').notes[0].pitch,36);assert.equal(track(s,'core-bass').notes[0].pitch,42);assert.equal(track(s,'drums-ext').notes[0].pitch,38)});
test('whole-song transpose is one undo/redo operation',()=>{const core=load(),s=core.createSession(project()),before=plain(s.midiData);core.previewSongTranspose(s,{fromKey:'C',toKey:'B',direction:'shortest'});core.applySongTranspose(s);assert.equal(track(s,'vocal').notes[0].pitch,63);core.undo(s);assert.deepEqual(plain(s.midiData),before);core.redo(s);assert.equal(track(s,'core-melody').notes[0].pitch,59);assert.equal(track(s,'guitar').notes[0].pitch,66)});
test('whole-song apply rejects stale preview without mutation',()=>{const core=load(),s=core.createSession(project());core.previewSongTranspose(s,{fromKey:'C',toKey:'D'});track(s,'guitar').notes[0].pitch=68;const before=plain(s.midiData),r=core.applySongTranspose(s);assert.equal(r.ok,false);assert.deepEqual(plain(s.midiData),before)});
test('whole-song preview rejects MIDI boundary overflow atomically',()=>{const core=load(),source=project();source.midiData.tracks.find(t=>t.id==='vocal').notes[0].pitch=127;const s=core.createSession(source),before=plain(s.midiData),r=core.previewSongTranspose(s,{fromKey:'C',toKey:'D',direction:'up'});assert.equal(r.ok,false);assert.ok(r.outOfRange.length);assert.deepEqual(plain(s.midiData),before)});
test('whole-song transpose synchronizes project minor key, slash chords and MIDI modulation with exact undo',()=>{
 const core=load(),p=project();p.musicalSettings={key:'Cm'};p.chordProgressions=[{measure:1,chord:'Cm7/G',memo:'retain'},{id:'progression',chords:['Abmaj7','Bb7','N.C.','iv']}];p.midiData.keySignature={tick:0,sharps:-3,minor:true};p.midiData.keySignatureMap=[{tick:0,sharps:-3,minor:true},{tick:1920,sharps:1,minor:false,track:0}];const s=core.createSession(p),before=plain(s.midiData),harmony=plain(s.songHarmony);
 assert.equal(core.previewSongTranspose(s,{fromKey:'C',toKey:'D'}).ok,true);assert.deepEqual(plain(s.songHarmony),harmony);assert.equal(core.applySongTranspose(s).ok,true);
 assert.equal(s.songHarmony.key,'Dm');assert.deepEqual(plain(s.songHarmony.chordProgressions),[{measure:1,chord:'Dm7/A',memo:'retain'},{id:'progression',chords:['A#maj7','C7','N.C.','iv']}]);assert.equal(s.midiData.keySignature.sharps,-1);assert.equal(s.midiData.keySignatureMap[1].sharps,3);assert.equal(s.midiData.keySignatureMap[1].tick,1920);
 const after=plain(s.midiData),afterHarmony=plain(s.songHarmony);assert.equal(s.undo.length,1);core.undo(s);assert.deepEqual(plain(s.midiData),before);assert.deepEqual(plain(s.songHarmony),harmony);core.redo(s);assert.deepEqual(plain(s.midiData),after);assert.deepEqual(plain(s.songHarmony),afterHarmony);
});
test('whole-song transpose rejects fixed notes, core bass overflow, invalid chords and stale metadata without partial mutation',()=>{
 for(const mode of ['locked','overflow','chord','stale','retry']){const core=load(),p=project();p.musicalSettings={key:'C'};p.chordProgressions=[{chord:'C'}];if(mode==='locked')p.midiData.tracks[2].notes[0].locked=true;if(mode==='overflow')p.midiData.tracks[2].notes[0].pitch=0;if(mode==='chord')p.chordProgressions=[{unrecognized:'keep'}];const s=core.createSession(p);if(mode==='stale'){assert.equal(core.previewSongTranspose(s,{fromKey:'C',toKey:'B'}).ok,true);s.songHarmony.key='F';}if(mode==='retry'){assert.equal(core.previewSongTranspose(s,{fromKey:'C',toKey:'D'}).ok,true);track(s,'core-bass').notes[0].pitch=0;}
 const before=plain(s.midiData),harmony=plain(s.songHarmony),r=mode==='stale'?core.applySongTranspose(s):core.previewSongTranspose(s,{fromKey:'C',toKey:'B'});assert.equal(r.ok,false,mode);assert.deepEqual(plain(s.midiData),before);assert.deepEqual(plain(s.songHarmony),harmony);assert.equal(s.undo.length,0);if(mode==='retry')assert.equal(s.songTransposePreview,null);
 }
});
test('whole-song apply refuses modified candidate metadata and MIDI before creating history',()=>{
 for(const field of ['notes','key']){const core=load(),s=core.createSession(project()),before=plain(s.midiData);assert.equal(core.previewSongTranspose(s,{fromKey:'C',toKey:'D'}).ok,true);if(field==='key')s.songTransposePreview.harmony.key='F';else s.songTransposePreview.nextMidi.tracks[0].notes[0].pitch=99;assert.equal(core.applySongTranspose(s).ok,false);assert.deepEqual(plain(s.midiData),before);assert.equal(s.undo.length,0)}assert.equal(load().previewSongTranspose(null,{}).ok,false);
});
