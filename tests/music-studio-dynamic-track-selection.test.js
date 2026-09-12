const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function load(){const window={crypto:{randomUUID:(()=>{let i=0;return()=>`id-${++i}`})()}};window.window=window;window.globalThis=window;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8'),window);vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.js'),'utf8'),window);return{core:window.MusicStudioEditor,selection:window.MusicStudioDynamicTrackSelection}}
const plain=value=>JSON.parse(JSON.stringify(value));
function project(){return{projectId:'dynamic-selection',midiData:{tracks:[{id:'core-melody',part:'melody',name:'Melody',channel:1,program:0,muted:false,notes:[{id:'m',pitch:60,startTick:0,durationTicks:480,velocity:90}]},{id:'core-drums',part:'drums',name:'Drums',channel:10,program:null,muted:false,notes:[{id:'d',pitch:36,startTick:0,durationTicks:120,velocity:100}]},{id:'core-bass',part:'bass',name:'Bass',channel:2,program:32,muted:false,notes:[{id:'b',pitch:40,startTick:0,durationTicks:960,velocity:80}]},{id:'ext-a',name:'Strings',trackType:'midi-melodic',roleAssignment:'strings',channel:3,program:48,order:4,custom:{keep:'a'},notes:[{id:'a',pitch:72,startTick:0,durationTicks:480,velocity:70}]},{id:'ext-b',name:'Strings',trackType:'midi-melodic',roleAssignment:'strings',channel:4,program:49,order:5,custom:{keep:'b'},notes:[{id:'b2',pitch:74,startTick:480,durationTicks:480,velocity:71}]},{id:'audio-ref',name:'Audio',trackType:'audio',roleAssignment:'vocal',notes:[]}]}}}
test('Core Melody Drums Bass are first-class selection targets in compatibility order',()=>{const{core,selection}=load(),session=core.createSession(project()),model=selection.createSelectionModel(session,core);assert.deepEqual(Array.from(model.slice(0,3),item=>[item.id,item.coreSlot,item.kind]),[['core-melody','melody','core'],['core-drums','drums','core'],['core-bass','bass','core']]);assert.equal(model[0].selected,true)});
test('External MIDI Tracks are selectable while audio is excluded from MIDI Track selection',()=>{const{core,selection}=load(),session=core.createSession(project()),model=selection.createSelectionModel(session,core);assert.deepEqual(Array.from(model,item=>item.id),['core-melody','core-drums','core-bass','ext-a','ext-b']);assert.equal(model.find(item=>item.id==='ext-a').kind,'external');assert.equal(model.some(item=>item.id==='audio-ref'),false)});
test('Core and External display labels are stable UI-only values independent from Track identity',()=>{const{core,selection}=load(),session=core.createSession(project()),before=plain(session.midiData),model=selection.createSelectionModel(session,core);assert.deepEqual(Array.from(model,item=>item.label),['C Melody','C Drums','C Bass','E1 Strings','E2 Strings']);assert.deepEqual(Array.from(model,item=>item.id),['core-melody','core-drums','core-bass','ext-a','ext-b']);assert.equal(model[3].name,'Strings');assert.equal(model[4].name,'Strings');assert.deepEqual(plain(session.midiData),before)});
test('Track selection uses exact Track ID even when names and roleAssignment are identical',()=>{const{core,selection}=load(),session=core.createSession(project());assert.equal(core.selectTrackById(session,'ext-b'),true);const current=selection.resolveCurrentSelection(session,core);assert.equal(current.id,'ext-b');assert.equal(current.name,'Strings');assert.equal(current.role,'strings');assert.equal(selection.createSelectionModel(session,core).find(item=>item.id==='ext-a').selected,false)});
test('Current Track resolves by selected Track ID and invalid runtime IDs safely fall back to Core Track',()=>{const{core,selection}=load(),session=core.createSession(project());core.selectTrackById(session,'ext-a');assert.equal(selection.resolveCurrentSelection(session,core).id,'ext-a');session.selectedTrackId='missing';assert.equal(core.currentTrack(session).id,'core-melody');assert.equal(selection.resolveCurrentSelection(session,core).id,'core-melody')});
test('External selection preserves Track data roleAssignment Core Tracks and note identity without copies',()=>{const{core,selection}=load(),session=core.createSession(project()),before=plain(session.midiData),api={state:{midiEditor:session,partialEditSession:{kept:true},midiMultiSelect:true}};assert.equal(selection.selectTrack('ext-b',api,core,null),true);assert.equal(session.selectedTrackId,'ext-b');assert.deepEqual(plain(session.midiData),before);assert.equal(session.midiData.tracks.find(track=>track.id==='ext-b').roleAssignment,'strings');assert.deepEqual(Array.from(session.midiData.tracks.find(track=>track.id==='ext-b').notes,note=>note.id),['b2']);assert.deepEqual(Array.from(session.midiData.tracks.find(track=>track.id==='core-melody').notes,note=>note.id),['m']);assert.deepEqual(Array.from(session.midiData.tracks.find(track=>track.id==='core-drums').notes,note=>note.id),['d']);assert.deepEqual(Array.from(session.midiData.tracks.find(track=>track.id==='core-bass').notes,note=>note.id),['b'])});
test('invalid Track ID selection is rejected without any session mutation',()=>{const{core,selection}=load(),session=core.createSession(project()),api={state:{midiEditor:session}},before=JSON.stringify(session);assert.equal(selection.selectTrack('missing',api,core,null),false);assert.equal(JSON.stringify(session),before)});
test('runtime Track selection does not persist and Save Reload data remains byte-equivalent',()=>{const{core}=load(),session=core.createSession(project()),saved=JSON.stringify(session.midiData);core.selectTrackById(session,'ext-a');assert.equal(JSON.stringify(session.midiData),saved);const reloaded=core.createSession({projectId:'reload',midiData:JSON.parse(saved)});assert.equal(reloaded.selectedTrackId,'core-melody');assert.equal(JSON.stringify(reloaded.midiData),saved)});
test('Capability Registry is carried into UI model without promoting External roles to Core slots',()=>{const{core,selection}=load(),session=core.createSession(project()),external=selection.createSelectionModel(session,core).find(item=>item.id==='ext-a');assert.equal(external.capabilities.canEditNotes,true);assert.equal(external.capabilities.canPlayMidi,true);assert.equal(external.capabilities.supportsPartialEdit,false);assert.equal(external.coreSlot,null)});
test('Mute Solo integration uses existing exact Track-ID handlers for every Core and External control',()=>{const source=fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.js'),'utf8');assert.match(source,/editorSetTrackMuted\(item\.id,!muted\)/);assert.match(source,/editorSetTrackSolo\(item\.id,!solo\)/);assert.doesNotMatch(source,/if\(item\.kind==='core'\).*editorSetTrackMuted/);assert.doesNotMatch(source,/api\.editorSetTrackMuted\s*=/);assert.doesNotMatch(source,/api\.editorSetTrackSolo\s*=/)});
test('Review Assignment UI remains separate from Selection UI',()=>{const app=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8'),selection=fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.js'),'utf8');assert.match(app,/External Track Review \/ Assignment/);assert.match(app,/editorApplyExternalTrackAssignments/);assert.doesNotMatch(selection,/roleAssignment\s*=/);assert.doesNotMatch(selection,/applyExternalTrackAssignments/)});
test('External selection enables Quantize Transpose Note Length scoped note and pointer editing while Correction and Partial Edit remain gated',()=>{const source=fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.js'),'utf8'),app=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8'),blocked=source.match(/const BLOCKED_EXTERNAL_ACTIONS=\[([\s\S]*?)\];/)?.[1]||'',disabled=source.match(/const actionNames=\[([^\]]*)\]/)?.[1]||'';for(const action of ['editorToggleMelodyPlayback','editorStartPartialEdit','editorPreviewCorrection'])assert.ok(blocked.includes(`'${action}'`));for(const action of ['editorAddNote','editorCopy','editorPaste','editorDuplicate','editorSelectAllNotes','editorLockSelectedNotes','editorUnlockSelectedNotes','editorMatchDuration','editorMatchVelocity'])assert.match(source,new RegExp(`editActions=\\[[^\\]]*'${action}'`));for(const action of ['editorApplyQuantize','editorPreviewTranspose','editorApplyTranspose','editorPreviewNoteLength','editorApplyNoteLength'])assert.doesNotMatch(blocked,new RegExp(action));assert.doesNotMatch(disabled,/editorApplyQuantize/);assert.match(source,/\.music-transpose-panel button/);assert.match(source,/\.music-note-length-panel button/);assert.match(source,/button:not\(\.music-correction-panel-close\)/);assert.match(app,/correction=melody\|\|externalMidi\?melodyCorrectionPopover/);assert.match(app,/function externalTrackBatchPopover/);assert.ok(!source.includes("'editorToggleMidiRecording'"));assert.doesNotMatch(source,/BLOCKED_EXTERNAL_ACTIONS=.*editorStartNoteResize/);assert.match(source,/validPinnedGesture/);assert.match(source,/__externalPointerGesture/);assert.match(source,/unsupported-external-edit/);assert.match(source,/supportsPartialEdit/)});
test('External batch menu is not hidden by CSS while the Melody workflow remains hidden',()=>{const css=fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.css'),'utf8');assert.match(css,/is-external-track-selected \.music-part-workflow\{\s*display:none !important/);assert.doesNotMatch(css,/is-external-track-selected \.music-correction-menu\s*\{[^}]*display\s*:\s*none/s)});
test('All MIDI Export path remains all-track based and is not rewritten as roleAssignment selection',()=>{const app=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');assert.match(app,/scope==='all'\|\|track\.part===scope/);assert.match(app,/const MIDI_EXPORT_SCOPES=\{melody:'Melody',drums:'Drums',bass:'Bass',all:'All'\}/)});
test('responsive Track strip is one row at 1440 820 and 390 boundaries without vertical Track stacking',()=>{const css=fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.css'),'utf8');assert.match(css,/\.music-dynamic-track-nav\{[^}]*flex-wrap:nowrap/s);assert.match(css,/\.music-dynamic-track-strip\{[^}]*flex-wrap:nowrap/s);assert.match(css,/overflow-x:auto/);assert.match(css,/@media \(max-width:820px\)/);assert.match(css,/@media \(max-width:390px\)/);assert.doesNotMatch(css,/flex-direction\s*:\s*column/)});
test('standalone HTML loads current Dynamic Selection CSS and JS after the existing editor stack',()=>{const html=fs.readFileSync(path.join(__dirname,'..','music-studio.html'),'utf8');assert.match(html,/music-studio-dynamic-track-selection\.css\?v=1\.0\.7/);assert.match(html,/music-studio-dynamic-track-selection\.js\?v=1\.0\.10/);assert.ok(html.indexOf('music-studio.js?v=1.4.101')<html.indexOf('music-studio-dynamic-track-selection.js?v=1.0.10'))});
test('Nova Studio host loads current Dynamic Selection assets without changing Music Studio APP_VERSION or schemaVersion',()=>{const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),app=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');assert.match(html,/music-studio-dynamic-track-selection\.css\?v=1\.0\.7/);assert.match(html,/music-studio-dynamic-track-selection\.js\?v=1\.0\.10/);assert.match(app,/const APP_VERSION='1\.4\.0'/);assert.match(app,/const SCHEMA_VERSION='1\.0'/)});

function deletionHarness({onSelectNote,doc=null}={}){
  const{core,selection}=load(),source=project();
  source.midiData.tracks.find(track=>track.id==='ext-a').notes.push({id:'shared',pitch:73,startTick:480,durationTicks:240,velocity:72},{id:'locked-a',pitch:75,startTick:960,durationTicks:240,velocity:72,locked:true});
  source.midiData.tracks.find(track=>track.id==='ext-b').notes.push({id:'shared',pitch:76,startTick:960,durationTicks:240,velocity:73});
  const session=core.createSession(source),api={state:{midiEditor:session,midiMultiSelect:false,partialEditSession:null},editorHandleShortcut(){return true},editorStartNoteDrag(){return'core-drag'},editorSelectNote(id,additive){onSelectNote?.(api,id);core.selectNote(session,id,{additive});return true},editorDeleteNote(){const before=core.editableNotes(core.selectedNotes(session)).length;if(!before)return false;core.deleteSelected(session);return true},editorUndo(){core.undo(session);return true},editorAddNote(){return true},editorCopy(){return true},editorPaste(){return true},editorDuplicate(){return true},editorSelectAllNotes(){return true},editorLockSelectedNotes(){return true},editorUnlockSelectedNotes(){return true},editorMatchDuration(){return true},editorMatchVelocity(){return true},editorApplyQuantize(){return true}};
  assert.equal(selection.install(api,core,doc),true);
  return{core,selection,session,api,track:id=>session.midiData.tracks.find(item=>item.id===id)}
}

function pointerTarget(){const roll={dataset:{totalTicks:'1920',pitchMin:'0',pitchMax:'127'},getBoundingClientRect(){return{width:960,height:1280}},querySelectorAll(){return[]}},target={style:{translate:''},closest(selector){return selector==='.music-piano-roll'?roll:null},setPointerCapture(){}};return{roll,target,event:{button:0,currentTarget:target,clientX:0,clientY:0,pointerId:1,preventDefault(){}}}}

test('External pointer selection captures exact Track ID without routing through the repainting UI selector',()=>{
  let repaintingSelectorCalls=0;
  const h=deletionHarness(),beforeB=plain(h.track('ext-b').notes);h.api.editorSelectNote=()=>{repaintingSelectorCalls+=1};
  h.core.selectTrackById(h.session,'ext-a');
  const pointer=pointerTarget();assert.equal(h.api.editorStartNoteDrag(pointer.event,'a'),true);pointer.target.onpointerup();
  assert.equal(repaintingSelectorCalls,0);
  assert.equal(h.api.__externalNoteSelectionTrackId,'ext-a');
  assert.deepEqual(Array.from(h.core.selectedIds(h.session)),['a']);
  assert.equal(h.api.editorDeleteNote(),true);
  assert.equal(h.track('ext-a').notes.some(note=>note.id==='a'),false);
  assert.deepEqual(plain(h.track('ext-b').notes),beforeB)
});

test('External rendered note pointerdown keeps its DOM target alive through selection before the real Eraser action',()=>{
  const classes=new Set(),roll={dataset:{totalTicks:'1920',pitchMin:'0',pitchMax:'127'},getBoundingClientRect(){return{width:960,height:1280}},querySelectorAll(selector){return selector==='.music-midi-note.is-selected'?[note]:[]}},note={isConnected:true,dataset:{noteId:'a'},style:{translate:''},classList:{toggle(name,on){on?classes.add(name):classes.delete(name)}},setAttribute(){},setPointerCapture(){},closest(selector){return selector==='.music-piano-roll'?roll:null}},eraser={disabled:true,setAttribute(){},removeAttribute(){},click(){if(!this.disabled)h.api.editorDeleteNote()}},page={querySelectorAll(selector){return selector==='.music-midi-note'?[note]:selector==='[onclick*="editorDeleteNote"]'?[eraser]:[]}};let exposePage=false;
  const doc={querySelector(selector){return exposePage&&selector==='.music-midi-editor-page'?page:null}},h=deletionHarness({doc});exposePage=true;
  h.core.selectTrackById(h.session,'ext-a');
  h.api.editorSelectNote=(id,additive)=>{h.core.selectNote(h.session,id,{toggle:additive});note.isConnected=false};
  assert.equal(h.api.editorStartNoteDrag({button:0,currentTarget:note,clientX:0,clientY:0,pointerId:1,preventDefault(){}},'a'),true);
  assert.equal(note.isConnected,true,'pointerdown selection must not repaint away the active rendered note');
  assert.equal(classes.has('is-selected'),true);note.onpointerup();
  assert.equal(eraser.disabled,false);eraser.click();
  assert.equal(h.track('ext-a').notes.some(item=>item.id==='a'),false)
});

test('External rendered marquee selection records Track provenance before the real Eraser action',()=>{
  const h=deletionHarness(),roll={};
  h.api.editorStartMarqueeSelection=event=>{event.currentTarget.onpointerup=()=>{h.core.clearNoteSelection(h.session);h.core.selectNote(h.session,'a')}};
  // Install the production wrapper after the real UI entry point exists.
  h.api.__dynamicTrackSelectionInstalled=false;
  assert.equal(h.selection.install(h.api,h.core,null),true);
  h.core.selectTrackById(h.session,'ext-a');
  h.api.editorStartMarqueeSelection({button:0,currentTarget:roll,preventDefault(){}});
  roll.onpointerup({pointerId:7});
  assert.deepEqual(Array.from(h.core.selectedIds(h.session)),['a']);
  const eraser={click:()=>h.api.editorDeleteNote()};eraser.click();
  assert.equal(h.track('ext-a').notes.some(item=>item.id==='a'),false)
});

test('External pointer selection aborts without mutation when the current Track changes during selection',()=>{
  const h=deletionHarness(),selectNote=h.core.selectNote;h.core.selectNote=(session,id,options)=>{selectNote(session,id,options);h.core.selectTrackById(session,'ext-b')};
  h.core.selectTrackById(h.session,'ext-a');
  const before=plain(h.session.midiData),undo=h.session.undo.length;
  assert.equal(h.api.editorStartNoteDrag({button:0,preventDefault(){}},'a'),false);
  assert.equal(h.api.editorDeleteNote(),false);
  assert.deepEqual(plain(h.session.midiData),before);
  assert.equal(h.session.undo.length,undo)
});

test('External delete is exact-Track-ID scoped and Undo restores only that Track',()=>{
  const h=deletionHarness(),coreBefore=plain(h.session.midiData.tracks.slice(0,3)),bBefore=plain(h.track('ext-b').notes);
  assert.equal(h.core.selectTrackById(h.session,'ext-a'),true);
  h.api.editorStartNoteDrag({button:0,preventDefault(){}},'shared');
  assert.equal(h.api.editorDeleteNote(),true);
  assert.deepEqual(Array.from(h.track('ext-a').notes,note=>note.id),['a','locked-a']);
  assert.deepEqual(plain(h.track('ext-b').notes),bBefore);
  assert.deepEqual(plain(h.session.midiData.tracks.slice(0,3)),coreBefore);
  h.api.editorUndo();
  assert.deepEqual(Array.from(h.track('ext-a').notes,note=>note.id),['a','shared','locked-a']);
  assert.deepEqual(plain(h.track('ext-b').notes),bBefore);
  assert.deepEqual(plain(h.session.midiData.tracks.slice(0,3)),coreBefore)
});

test('stale External selection cannot delete a same-ID note after Track switch',()=>{
  const h=deletionHarness();
  h.core.selectTrackById(h.session,'ext-a');
  h.api.editorStartNoteDrag({button:0,preventDefault(){}},'shared');
  h.core.selectTrackById(h.session,'ext-b');
  h.session.selectedNoteId='shared';h.session.selectedNoteIds=['shared'];
  const before=plain(h.track('ext-b').notes),undo=h.session.undo.length;
  assert.equal(h.api.editorDeleteNote(),false);
  assert.deepEqual(plain(h.track('ext-b').notes),before);
  assert.equal(h.session.undo.length,undo);
  assert.equal(h.session.selectedNoteId,null);assert.deepEqual(Array.from(h.session.selectedNoteIds),[])
});

test('External delete preserves locked notes and Core Delete Undo remain unchanged',()=>{
  const h=deletionHarness();
  h.core.selectTrackById(h.session,'ext-a');
  h.api.editorStartNoteDrag({button:0,preventDefault(){}},'locked-a');
  assert.equal(h.api.editorDeleteNote(),false);assert.equal(h.track('ext-a').notes.some(note=>note.id==='locked-a'),true);
  h.core.selectPart(h.session,'melody');h.core.selectNote(h.session,'m');
  assert.equal(h.api.editorDeleteNote(),true);assert.equal(h.track('core-melody').notes.length,0);
  h.api.editorUndo();assert.deepEqual(Array.from(h.track('core-melody').notes,note=>note.id),['m'])
});

test('External keyboard editing is routed through guarded API methods instead of lexical editor closures',()=>{const source=fs.readFileSync(path.join(__dirname,'..','music-studio-dynamic-track-selection.js'),'utf8');assert.match(source,/if\(!isExternalSelection\(api,core\)\)return shortcut\.call/);assert.match(source,/key==='Delete'\|\|key==='Backspace'/);for(const action of ['editorCopy','editorPaste','editorDuplicate','editorSelectAllNotes','editorDeleteNote','editorAddNote'])assert.match(source,new RegExp(`action=api\\.${action}`))});

function editingHarness(){
  const h=deletionHarness(),{core,session,api}=h;
  Object.assign(api,{
    editorAddNote(){core.addNote(session,{pitch:79,startTick:1440,durationTicks:120,velocity:88});return true},
    editorCopy(){core.copy(session);return true},editorPaste(){core.paste(session,1920);return true},editorDuplicate(){core.duplicateSelected(session);return true},
    editorSelectAllNotes(){core.selectAllNotes(session);return true},editorLockSelectedNotes(){core.lockSelectedNotes(session);return true},editorUnlockSelectedNotes(){core.unlockSelectedNotes(session);return true},
    editorMatchDuration(){core.matchSelectedDuration(session);return true},editorMatchVelocity(){core.matchSelectedVelocity(session);return true}
  });
  api.__dynamicTrackSelectionInstalled=false;assert.equal(h.selection.install(api,core,null),true);return h
}

test('External editing routes Add Select All Copy Paste Duplicate only to the exact Track ID with collision-free Note IDs',()=>{
  const h=editingHarness(),coreBefore=plain(h.session.midiData.tracks.slice(0,3)),otherBefore=plain(h.track('ext-b').notes);h.core.selectTrackById(h.session,'ext-a');
  const initialIds=new Set(h.session.midiData.tracks.flatMap(track=>track.notes.map(note=>note.id)));assert.equal(h.api.editorAddNote(),true);assert.equal(h.track('ext-a').notes.length,4);assert.deepEqual(plain(h.track('ext-b').notes),otherBefore);
  assert.equal(h.api.editorSelectAllNotes(),true);assert.deepEqual(new Set(h.core.selectedIds(h.session)),new Set(h.track('ext-a').notes.map(note=>note.id)));
  assert.equal(h.api.editorCopy(),true);assert.equal(h.api.editorPaste(),true);const afterPaste=h.track('ext-a').notes.filter(note=>!initialIds.has(note.id));assert.ok(afterPaste.length>=4);assert.equal(new Set(afterPaste.map(note=>note.id)).size,afterPaste.length);
  const beforeDuplicateIds=new Set(h.session.midiData.tracks.flatMap(track=>track.notes.map(note=>note.id)));assert.equal(h.api.editorDuplicate(),true);const generated=h.track('ext-a').notes.filter(note=>!beforeDuplicateIds.has(note.id));assert.ok(generated.length>0);assert.equal(new Set(generated.map(note=>note.id)).size,generated.length);assert.deepEqual(plain(h.track('ext-b').notes),otherBefore);assert.deepEqual(plain(h.session.midiData.tracks.slice(0,3)),coreBefore)
});

test('External Lock Unlock Match Length and Match Velocity affect selected notes on the current Track only',()=>{
  const h=editingHarness(),coreBefore=plain(h.session.midiData.tracks.slice(0,3)),otherBefore=plain(h.track('ext-b').notes);h.core.selectTrackById(h.session,'ext-a');h.core.selectNote(h.session,'a');h.core.selectNote(h.session,'shared',{additive:true});h.api.__externalNoteSelectionTrackId='ext-a';
  assert.equal(h.api.editorLockSelectedNotes(),true);assert.equal(h.track('ext-a').notes.find(note=>note.id==='a').locked,true);assert.equal(h.track('ext-a').notes.find(note=>note.id==='shared').locked,true);assert.equal(h.api.editorUnlockSelectedNotes(),true);
  h.track('ext-a').notes.find(note=>note.id==='a').durationTicks=777;h.track('ext-a').notes.find(note=>note.id==='a').velocity=66;h.session.selectedNoteIds=['shared','a'];h.session.selectedNoteId='a';assert.equal(h.api.editorMatchDuration(),true);assert.equal(h.api.editorMatchVelocity(),true);assert.equal(h.track('ext-a').notes.find(note=>note.id==='shared').durationTicks,777);assert.equal(h.track('ext-a').notes.find(note=>note.id==='shared').velocity,66);assert.deepEqual(plain(h.track('ext-b').notes),otherBefore);assert.deepEqual(plain(h.session.midiData.tracks.slice(0,3)),coreBefore)
});

test('stale External editing provenance cannot modify a same-ID note after Track switch',()=>{
  const h=editingHarness();h.core.selectTrackById(h.session,'ext-a');h.api.editorStartNoteDrag({button:0,preventDefault(){}},'shared');h.core.selectTrackById(h.session,'ext-b');h.session.selectedNoteId='shared';h.session.selectedNoteIds=['shared'];const before=plain(h.session.midiData),undo=h.session.undo.length;assert.equal(h.api.editorDuplicate(),false);assert.deepEqual(plain(h.session.midiData),before);assert.equal(h.session.undo.length,undo);assert.deepEqual(Array.from(h.session.selectedNoteIds),[])
});

test('External edit result survives MIDI data Save Reload without losing or duplicating Tracks',()=>{
  const h=editingHarness();h.core.selectTrackById(h.session,'ext-a');h.api.editorAddNote();const saved=JSON.stringify(h.session.midiData),reloaded=h.core.createSession({projectId:'reloaded',midiData:JSON.parse(saved)});assert.equal(JSON.stringify(reloaded.midiData),saved);assert.deepEqual(Array.from(reloaded.midiData.tracks,track=>track.id),Array.from(h.session.midiData.tracks,track=>track.id));assert.equal(reloaded.midiData.tracks.find(track=>track.id==='ext-a').notes.length,h.track('ext-a').notes.length)
});
