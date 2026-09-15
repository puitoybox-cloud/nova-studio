const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function load(){const window={crypto:{randomUUID:(()=>{let value=0;return()=>`cleanup-note-${++value}`})()}};window.window=window;window.globalThis=window;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);return window.MusicStudioEditor}
const plain=value=>JSON.parse(JSON.stringify(value));
function project(){return{projectId:'cleanup',midiData:{ppq:480,editor:{measureCount:4},tracks:[
  {id:'core-melody',part:'melody',name:'Melody',notes:[{id:'core',pitch:60,startTick:101,durationTicks:240,velocity:80}]},
  {id:'core-drums',part:'drums',name:'Drums',notes:[]},
  {id:'core-bass',part:'bass',name:'Bass',notes:[]},
  {id:'external-vocals',name:'Vocals',trackType:'midi-melodic',roleAssignment:'vocal',channel:5,program:53,metadata:{source:'stem'},notes:[
    {id:'first',pitch:64,startTick:121,durationTicks:400,velocity:91,meta:{keep:true}},
    {id:'duplicate',pitch:64,startTick:121,durationTicks:400,velocity:91},
    {id:'next',pitch:64,startTick:481,durationTicks:240,velocity:92},
    {id:'locked',pitch:67,startTick:179,durationTicks:111,velocity:70,locked:true}
  ]},
  {id:'external-drums',name:'Drums',trackType:'midi-drums',roleAssignment:'drums',channel:10,order:7,notes:[{id:'kick',pitch:36,startTick:61,durationTicks:60,velocity:100}]}
]}}}
function track(session,id){return session.midiData.tracks.find(item=>item.id===id)}

test('cleanup Preview is non-mutating and targets only External MIDI Track IDs',()=>{const core=load(),session=core.createSession(project()),before=plain(session.midiData),result=core.previewGeneratedMidiCleanup(session);assert.equal(result.ok,true);assert.deepEqual(plain(result.preview.tracks.map(item=>item.trackId)),['external-vocals','external-drums']);assert.deepEqual(plain(session.midiData),before);assert.equal(result.preview.summary.duplicatesRemoved,1);assert.equal(result.preview.summary.overlapsTrimmed,1)})

test('safe default preserves pitch timing metadata locked notes and Track metadata',()=>{const core=load(),session=core.createSession(project()),coreBefore=plain(track(session,'core-melody')),trackMeta=plain({...track(session,'external-vocals'),notes:undefined});core.previewGeneratedMidiCleanup(session);const result=core.applyGeneratedMidiCleanup(session),vocals=track(session,'external-vocals');assert.equal(result.ok,true);assert.deepEqual(plain(vocals.notes.map(note=>note.id)),['first','locked','next']);assert.equal(vocals.notes.find(note=>note.id==='first').durationTicks,360);assert.deepEqual(plain(vocals.notes.find(note=>note.id==='locked')),{id:'locked',pitch:67,startTick:179,durationTicks:111,velocity:70,locked:true});assert.deepEqual(plain({...vocals,notes:undefined}),trackMeta);assert.deepEqual(plain(track(session,'core-melody')),coreBefore)})

test('optional Quantize changes only unlocked External notes',()=>{const core=load(),session=core.createSession(project());core.previewGeneratedMidiCleanup(session,{quantize:'1/16',removeDuplicates:false,cleanShortOverlaps:false});core.applyGeneratedMidiCleanup(session);assert.equal(track(session,'external-vocals').notes.find(note=>note.id==='first').startTick,120);assert.equal(track(session,'external-vocals').notes.find(note=>note.id==='locked').startTick,179);assert.equal(track(session,'core-melody').notes[0].startTick,101)})

test('Apply is one Undo Redo unit and stale Preview is rejected',()=>{const core=load(),session=core.createSession(project()),before=plain(session.midiData);core.previewGeneratedMidiCleanup(session);core.applyGeneratedMidiCleanup(session);assert.equal(session.undo.length,1);core.undo(session);assert.deepEqual(plain(session.midiData),before);core.redo(session);assert.equal(track(session,'external-vocals').notes.length,3);core.previewGeneratedMidiCleanup(session);track(session,'external-vocals').notes[0].velocity=1;const stale=core.applyGeneratedMidiCleanup(session);assert.equal(stale.ok,false);assert.match(stale.reason,/Previewを作り直/);assert.equal(session.undo.length,1)})

test('UI exposes Preview Apply Cancel without changing app or schema versions',()=>{const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');assert.match(source,/Generated MIDI Cleanup（一括整理）/);assert.match(source,/editorPreviewGeneratedMidiCleanup/);assert.match(source,/editorApplyGeneratedMidiCleanup/);assert.match(source,/editorCancelGeneratedMidiCleanup/);assert.match(source,/const APP_VERSION='1\.4\.0'/);assert.match(source,/const SCHEMA_VERSION='1\.0'/)});

test('cleanup fixed popover has an explicit viewport top at desktop width',()=>{const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');const rule=css.match(/\.music-cleanup-popover\{([^}]+)\}/)?.[1]||'';assert.match(rule,/position:fixed/);assert.match(rule,/top:max\(76px,env\(safe-area-inset-top\)\)/);assert.doesNotMatch(rule,/top:calc\(100%/)});

test('cleanup menu open state survives editor repaint',()=>{const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');assert.match(source,/generatedCleanupMenuOpen=cleanupMenu\.open/);assert.match(source,/preview\|\|session\.view\?\.generatedCleanupMenuOpen\?'open':''/);assert.match(source,/cleanupMenu\.ontoggle=\(\)=>\{view\.generatedCleanupMenuOpen=cleanupMenu\.open/)});

test('cleanup Cancel discards only Preview while Close remains the panel action',()=>{const core=load(),session=core.createSession(project()),before=plain(session.midiData);core.previewGeneratedMidiCleanup(session);const result=core.cancelGeneratedMidiCleanup(session);assert.deepEqual(plain(result),{ok:true,cancelled:true});assert.equal(session.generatedCleanupPreview,null);assert.deepEqual(plain(session.midiData),before);const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');assert.match(source,/Cancel Preview（確認を取り消す）/);assert.equal((source.match(/class="music-secondary music-cleanup-panel-close"/g)||[]).length,1)});

test('Cleanup and Correction fixed panels are mutually exclusive',()=>{const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');assert.match(source,/cleanupMenu\.open=false;view\.generatedCleanupMenuOpen=false/);assert.match(source,/menu\.open=false;view\.correctionMenuOpen=false/)});
