const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');
function load(){
  const values=new Map([['novaStudio_v01','nova-safe'],['aiMusicHelperProject','ai-safe']]);
  const window={crypto:{randomUUID:()=>`id-1`},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},location:{hash:'#music-studio/logic-pro'},addEventListener(){},setTimeout,clearTimeout,Intl,Date,Math,JSON,console,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob};window.window=window;
  const midiSource=fs.readFileSync(path.join(__dirname,'..','music-studio-midi.js'),'utf8');vm.runInNewContext(midiSource,{window,globalThis:window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,unescape,encodeURIComponent},{filename:'music-studio-midi.js'});const parserSource=fs.readFileSync(path.join(__dirname,'..','music-studio-midi-parser.js'),'utf8');vm.runInNewContext(parserSource,{window,globalThis:window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,unescape,encodeURIComponent},{filename:'music-studio-midi-parser.js'});const editorSource=fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8');vm.runInNewContext(editorSource,{window,globalThis:window},{filename:'music-studio-editor.js'});
  vm.runInNewContext(source,{window,globalThis:window},{filename:'music-studio.js'});return{app:window.MusicStudio,values,window};
}
function file(name,bytes,type='application/octet-stream'){const data=Uint8Array.from(bytes);return{name,size:data.length,type,async arrayBuffer(){return data.buffer},slice(start,end){const part=data.slice(start,end);return{async arrayBuffer(){return part.buffer}}}}}

test('Logic Pro route opens standalone and includes safe round-trip actions',()=>{const {app}=load();const html=app.renderRoute('music-studio/logic-pro',{standalone:true});assert.match(html,/Logic Pro X連携/);assert.match(html,/Logic ProからMIDIを取り込む/);assert.match(html,/Type 1 MIDIを書き出す/);assert.match(html,/新規または複製/);assert.match(html,/読み込み履歴/);assert.match(html,/← 戻る/);assert.match(html,/次へ →/);assert.match(html,/Music Studio設定/);assert.match(html,/MIDI channel 10/);assert.match(html,/Drum Kit Designer/);assert.match(html,/Kick 36／Snare 38／Closed Hi-Hat 42/)});
test('every major and placeholder route has one unified back and next navigation',()=>{
  const{app,values}=load(),project=app.makeProject({projectId:'nav-project',projectName:'Navigation',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[{id:'drums',part:'drums',name:'Drums',channel:10,program:null,notes:[{id:'d',pitch:36,startTick:0,durationTicks:120,velocity:100}]}]}});
  app.state.projects=[project];values.set(app.LAST_PROJECT_KEY,project.projectId);
  const routes=['music-studio','music-studio/recent-projects','music-studio/new-project',`music-studio/project/${project.projectId}`,`music-studio/midi-editor/${project.projectId}`,'music-studio/logic-pro','music-studio/settings','music-studio/backup','music-studio/lyrics-notes'];
  for(const route of routes){const html=app.renderRoute(route),navs=html.match(/class="music-flow-nav"/g)||[];assert.equal(navs.length,1,route);assert.match(html,/← 戻る/);assert.match(html,/次へ →/)}
  const editor=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(editor,/MIDI書き出し・Logic Pro連携/);assert.match(editor,new RegExp(`openLogicPro\\('${project.projectId}'\\)`));
});
test('correction and history buttons add smaller Japanese guidance without changing actions',()=>{
  const{app}=load(),project=app.makeProject({projectId:'button-guidance',projectName:'Button guidance'});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/editorUndo\(\)" disabled>Undo <span class="music-button-note">（元に戻す）<\/span>/);
  assert.match(html,/editorRedo\(\)" disabled>Redo <span class="music-button-note">（やり直す）<\/span>/);
  app.editorPreviewCorrection();html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/editorApplyCorrection\(\)">Apply <span class="music-button-note">（適用）<\/span>/);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-button-note\{font-size:\.72em;font-weight:600;opacity:\.78;white-space:nowrap\}/);
});
test('Piano Roll includes a compact pointer-independent operation guide and visible resize handle',()=>{
  const{app}=load(),project=app.makeProject({projectId:'operation-guide',projectName:'Operation guide'});
  app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);app.editorAddNote();
  const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/？ ショートカット \/ 操作ガイド/);
  assert.match(html,/ノート本体ドラッグ：移動／右端 ↔：長さ変更/);
  assert.match(html,/左の音名をタップ：その音を試聴/);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-note-resize\{[^}]*width:16px/);
  assert.match(css,/\.music-note-resize::after\{[^}]*content:'↔'/);
});
test('Piano Roll helper UI exposes Snap, velocity colors, pitch preview, matching, and Mac help',async()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'helpers',projectName:'Helpers'});
  app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const core=window.MusicStudioEditor;
  core.addNotes(app.state.midiEditor,[
    {id:'quiet',pitch:60,startTick:0,durationTicks:120,velocity:30},
    {id:'medium',pitch:62,startTick:480,durationTicks:240,velocity:70},
    {id:'loud',pitch:64,startTick:960,durationTicks:360,velocity:120}
  ]);
  core.selectNote(app.state.midiEditor,'quiet');
  core.selectNote(app.state.midiEditor,'loud',{additive:true});
  let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/aria-pressed="true">Snap ON/);
  for(const value of ['measure','1/2','1/4','1/8','1/16','1/32'])assert.match(html,new RegExp(`value="${value}"`));
  assert.match(html,/velocity-low/);assert.match(html,/velocity-medium/);assert.match(html,/velocity-high/);
  assert.match(html,/C4 · V30/);assert.match(html,/onpointerdown="event\.preventDefault\(\);MusicStudio\.editorPreviewPitch\(60\)"/);
  assert.match(html,/onclick="if\(event\.detail===0\)MusicStudio\.editorPreviewPitch\(60\)"/);
  assert.doesNotMatch(html,/musicPitchDiagnostic|musicNotePreviewDiagnostic|一時診断/);
  assert.match(html,/長さを揃える/);assert.match(html,/Velocityを揃える/);
  assert.match(html,/<summary>ショートカット<\/summary>/);assert.match(html,/画面ボタンだけでもすべて操作できます/);
  let finishUnlock,scheduledStop=null;const pitchEvents=[];window.setTimeout=callback=>{scheduledStop=callback;return 9};window.clearTimeout=()=>{};
  app.state.melodyAudio.synth={supported:()=>true,unlock:()=>new Promise(resolve=>{finishUnlock=resolve}),noteOn:(...args)=>{pitchEvents.push(['on',...args]);return true},noteOff:(...args)=>{pitchEvents.push(['off',...args]);return true}};
  const previewPromise=app.editorPreviewPitch(60);
  assert.equal(JSON.stringify(pitchEvents),'[]');
  finishUnlock(true);assert.equal(await previewPromise,true);
  assert.equal(JSON.stringify(pitchEvents),'[["off",60,"piano-roll-preview"],["on",60,100,"piano-roll-preview"]]');
  scheduledStop();assert.equal(JSON.stringify(pitchEvents.at(-1)),'["off",60,"piano-roll-preview"]');
  app.editorMatchDuration();app.editorMatchVelocity(111);
  assert.equal(JSON.stringify(core.selectedNotes(app.state.midiEditor).map(note=>[note.durationTicks,note.velocity])),'[[360,111],[360,111]]');
  app.editorUndo();app.editorUndo();
  assert.equal(JSON.stringify(core.selectedNotes(app.state.midiEditor).map(note=>[note.durationTicks,note.velocity])),'[[120,30],[360,120]]');
});
test('Piano Roll note body previews only a simple click while drag resize and cancel stay silent',async()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'note-preview',projectName:'Note preview'});
  app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const core=window.MusicStudioEditor;
  core.addNotes(app.state.midiEditor,[
    {id:'first',pitch:60,startTick:0,durationTicks:240,velocity:37},
    {id:'second',pitch:64,startTick:480,durationTicks:240,velocity:91}
  ]);
  const audioEvents=[];
  app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>{audioEvents.push(['unlock']);return true},noteOn:(...args)=>{audioEvents.push(['on',...args]);return true},noteOff:(...args)=>{audioEvents.push(['off',...args]);return true}};
  window.setTimeout=()=>9;window.clearTimeout=()=>{};
  const flushPreview=()=>new Promise(resolve=>setImmediate(resolve));
  const roll={dataset:{totalTicks:'7680',pitchMin:'0',pitchMax:'127'},getBoundingClientRect:()=>({left:0,width:800,height:3072}),querySelectorAll:()=>[]};
  const noteTarget={style:{},closest:selector=>selector==='.music-piano-roll'?roll:null,setPointerCapture(){}};
  const pointer=(extra={})=>({button:0,currentTarget:noteTarget,clientX:100,clientY:100,pointerId:1,preventDefault(){},...extra});

  app.editorStartNoteDrag(pointer(),'first');noteTarget.onpointerup();await flushPreview();
  assert.equal(JSON.stringify(audioEvents),'[["unlock"],["off",60,"piano-roll-preview"],["on",60,37,"piano-roll-preview"]]');
  assert.equal(JSON.stringify(core.selectedIds(app.state.midiEditor)),'["first"]');

  const previewCount=audioEvents.length,startTick=core.currentTrack(app.state.midiEditor).notes[0].startTick;
  app.editorStartNoteDrag(pointer(),'first');noteTarget.onpointermove({clientX:125,clientY:100});noteTarget.onpointerup();await flushPreview();
  assert.equal(audioEvents.length,previewCount);
  assert.notEqual(core.currentTrack(app.state.midiEditor).notes[0].startTick,startTick);

  app.editorStartNoteDrag(pointer(),'first');noteTarget.onpointercancel();await flushPreview();
  assert.equal(audioEvents.length,previewCount);

  const noteElement={style:{width:'10%'}},resizeTarget={style:{},closest:selector=>selector==='.music-midi-note'?noteElement:selector==='.music-piano-roll'?roll:null,setPointerCapture(){}};
  app.editorStartNoteResize({button:0,currentTarget:resizeTarget,clientX:100,pointerId:2,preventDefault(){},stopPropagation(){}},'first');
  resizeTarget.onpointermove({clientX:125});resizeTarget.onpointerup();await flushPreview();
  assert.equal(audioEvents.length,previewCount);

  core.selectNote(app.state.midiEditor,'second',{additive:true});
  app.editorStartNoteDrag(pointer({shiftKey:true}),'first');noteTarget.onpointerup();await flushPreview();
  assert.equal(JSON.stringify(core.selectedIds(app.state.midiEditor)),'["second"]');
  assert.equal(JSON.stringify(audioEvents.slice(-3)),'[["unlock"],["off",60,"piano-roll-preview"],["on",60,37,"piano-roll-preview"]]');
});
test('mouse marquee replaces adds and toggles intersecting notes without competing with note drag',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'marquee',projectName:'Marquee'});
  app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const core=window.MusicStudioEditor,session=app.state.midiEditor;
  core.addNotes(session,[
    {id:'first',pitch:60,startTick:0,durationTicks:120,velocity:90},
    {id:'second',pitch:62,startTick:240,durationTicks:120,velocity:90},
    {id:'third',pitch:64,startTick:480,durationTicks:120,velocity:90}
  ]);
  const note=(id,left,top)=>({dataset:{noteId:id},getBoundingClientRect:()=>({left,right:left+20,top,bottom:top+20})});
  const notes=[note('first',20,20),note('second',60,60),note('third',140,140)],children=[];
  const roll={dataset:{totalTicks:'1920'},ownerDocument:{createElement:()=>({style:{},setAttribute(){},remove(){children.pop()}})},getBoundingClientRect:()=>({left:0,right:200,top:0,bottom:200,width:200,height:200}),querySelectorAll:selector=>selector==='.music-midi-note'?notes:[],appendChild:item=>children.push(item),setPointerCapture(){}};
  const pointer=(extra={})=>({button:0,pointerType:'mouse',pointerId:1,target:{closest:()=>null},currentTarget:roll,clientX:5,clientY:5,preventDefault(){this.prevented=true},...extra});
  const drag=(extra={})=>{app.editorStartMarqueeSelection(pointer(extra));roll.onpointermove(pointer({...extra,clientX:85,clientY:85}));assert.equal(children.length,1);roll.onpointerup(pointer({...extra,clientX:85,clientY:85}))};
  drag();assert.deepEqual(Array.from(core.selectedIds(session)),['first','second']);
  core.selectNote(session,'third');drag({shiftKey:true});assert.deepEqual(Array.from(core.selectedIds(session)),['third','first','second']);
  drag({metaKey:true});assert.deepEqual(Array.from(core.selectedIds(session)),['third']);
  const before=core.selectedIds(session);roll.onpointermove=null;app.editorStartMarqueeSelection(pointer({target:{closest:selector=>selector==='.music-midi-note'?notes[0]:null}}));assert.equal(roll.onpointermove,null);assert.deepEqual(core.selectedIds(session),before);
});
test('marquee threshold preserves empty click clearing and coarse-pointer scrolling path',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'marquee-safety',projectName:'Marquee safety'});
  app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const core=window.MusicStudioEditor,session=app.state.midiEditor;
  core.addNote(session,{id:'selected',pitch:60,startTick:0,durationTicks:120,velocity:90});core.selectNote(session,'selected');
  const roll={dataset:{totalTicks:'1920'},getBoundingClientRect:()=>({left:0,right:200,top:0,bottom:200,width:200,height:200}),querySelectorAll:()=>[],setPointerCapture(){}};
  const pointer=(extra={})=>({button:0,pointerType:'mouse',pointerId:1,target:{closest:()=>null},currentTarget:roll,clientX:100,clientY:100,preventDefault(){},...extra});
  app.editorStartMarqueeSelection(pointer());roll.onpointermove(pointer({clientX:103,clientY:103}));roll.onpointerup(pointer({clientX:103,clientY:103}));
  assert.equal(core.selectedIds(session).length,0);assert.equal(session.playheadTick,960);
  core.selectNote(session,'selected');app.editorStartMarqueeSelection(pointer({pointerType:'touch',clientX:50}));
  assert.deepEqual(Array.from(core.selectedIds(session)),['selected']);assert.equal(roll.onpointermove,null);assert.equal(session.playheadTick,480);
  const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(html,/onpointerdown="MusicStudio\.editorStartMarqueeSelection\(event\)"/);
  assert.match(html,/data-note-id="selected"/);
  assert.match(css,/\.music-selection-marquee\{[^}]*background:rgba\(56,189,248,\.16\)/);
  assert.match(css,/\.music-piano-viewport\{[^}]*touch-action:pan-x pan-y/);
});
test('Piano Roll shortcuts share button actions and never fire from an input',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'shortcuts',projectName:'Shortcuts'});
  app.state.projects=[project];window.location.hash='#music-studio/midi-editor/shortcuts';
  app.renderRoute('music-studio/midi-editor/shortcuts');
  app.editorAddNote();const core=window.MusicStudioEditor,note=()=>core.currentTrack(app.state.midiEditor).notes[0];
  const event=(key,extra={})=>{let prevented=false;return{key,target:{closest:()=>null},preventDefault(){prevented=true},get prevented(){return prevented},...extra}};
  const inputEvent=event('Backspace',{target:{closest:()=>({})}});
  assert.equal(app.editorHandleShortcut(inputEvent),false);assert.equal(inputEvent.prevented,false);
  let e=event('ArrowRight');assert.equal(app.editorHandleShortcut(e),true);assert.equal(note().startTick,120);assert.equal(e.prevented,true);
  app.editorHandleShortcut(event('ArrowUp',{shiftKey:true}));assert.equal(note().pitch,72);
  app.editorHandleShortcut(event('ArrowRight',{altKey:true}));assert.equal(note().durationTicks,240);
  app.editorHandleShortcut(event('c',{metaKey:true}));assert.equal(app.state.midiEditor.clipboard.length,1);
  app.editorHandleShortcut(event('v',{metaKey:true}));assert.equal(core.currentTrack(app.state.midiEditor).notes.length,2);
  const selectAllEvent=event('a',{metaKey:true});assert.equal(app.editorHandleShortcut(selectAllEvent),true);assert.equal(selectAllEvent.prevented,true);
  app.editorHandleShortcut(event('z',{metaKey:true}));assert.equal(core.currentTrack(app.state.midiEditor).notes.length,1);
  app.editorHandleShortcut(event('z',{metaKey:true,shiftKey:true}));assert.equal(core.currentTrack(app.state.midiEditor).notes.length,2);
  app.editorHandleShortcut(event('+',{metaKey:true}));assert.equal(app.state.midiEditor.view.zoom,2);
  app.editorHandleShortcut(event('0',{metaKey:true}));assert.equal(app.state.midiEditor.view.zoom,1);
  app.editorHandleShortcut(event('4'));assert.equal(app.state.midiEditor.view.snap,'1/32');
  app.editorHandleShortcut(event('n'));assert.equal(core.currentTrack(app.state.midiEditor).notes.length,3);
  let stopped=false;app.state.melodyAudio.synth={stopPlayback(){stopped=true}};app.state.melodyAudio.playing=true;
  app.editorHandleShortcut(event(' '));assert.equal(stopped,true);assert.equal(app.state.melodyAudio.playing,false);
  app.editorHandleShortcut(event('Escape'));assert.equal(core.selectedIds(app.state.midiEditor).length,0);
  core.selectAllNotes(app.state.midiEditor);app.editorHandleShortcut(event('Delete'));assert.equal(core.currentTrack(app.state.midiEditor).notes.length,0);
});
test('copy paste duplicate and select all use the current part and playhead',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'basic-editing',projectName:'Basic editing'});
  app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const core=window.MusicStudioEditor,session=app.state.midiEditor;
  core.addNotes(session,[{id:'first',pitch:60,startTick:0,durationTicks:240},{id:'second',pitch:64,startTick:240,durationTicks:240}]);
  app.editorSelectAllNotes();assert.equal(core.selectedIds(session).length,2);
  app.editorCopy();session.playheadTick=1920;app.editorPaste();await app.state.midiEditorSavePromise;
  assert.deepEqual(Array.from(core.selectedNotes(session),note=>note.startTick),[1920,2160]);
  app.editorDuplicate();await app.state.midiEditorSavePromise;
  assert.deepEqual(Array.from(core.currentTrack(session).notes.filter(note=>note.startTick>=2400),note=>note.startTick),[2400,2640]);
  app.editorUndo();assert.equal(core.currentTrack(session).notes.length,4);
  app.editorRedo();assert.equal(core.currentTrack(session).notes.length,6);
  core.selectPart(session,'drums');assert.equal(core.selectedIds(session).length,0);
});
test('Snap toggles grid alignment for add move and resize without changing the visible grid',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'snap-toggle',projectName:'Snap toggle'});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const core=window.MusicStudioEditor,session=app.state.midiEditor;
  assert.match(html,/aria-pressed="true">Snap ON/);
  assert.match(html,/class="music-time-grid"/);
  app.editorToggleSnap();assert.equal(session.view.snapEnabled,false);
  session.playheadTick=137;app.editorAddNote();
  let note=core.selectedNotes(session)[0];assert.equal(note.startTick,137);assert.equal(note.durationTicks,session.midiData.ppq);
  app.editorMoveSelected(13,0);app.editorResizeSelected(17);
  note=core.selectedNotes(session)[0];assert.equal(note.startTick,150);assert.equal(note.durationTicks,session.midiData.ppq+17);
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/aria-pressed="false">Snap OFF/);
  assert.match(html,/class="music-time-grid"/);
  assert.match(html,/onchange="MusicStudio\.editorSetSnap\(this\.value\)" disabled/);
  app.editorToggleSnap();assert.equal(session.view.snapEnabled,true);
});
test('Piano Roll tap moves the red playhead and Add Note uses the same position',async()=>{
  const{app}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'insert-point',projectName:'Insert point'});
  app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const roll={dataset:{totalTicks:'7680'},getBoundingClientRect:()=>({left:0,width:800})};
  app.editorSetPlayheadPosition({target:{closest:()=>null},currentTarget:roll,clientX:250});
  assert.equal(app.state.midiEditor.playheadTick,2400);
  app.editorSetPlayheadPosition({target:{closest:()=>({})},currentTarget:roll,clientX:500});
  assert.equal(app.state.midiEditor.playheadTick,2400);
  app.editorAddNote();await app.state.midiEditorSavePromise;
  const stored=await repo.get(project.projectId),note=stored.midiData.tracks.find(track=>track.part==='melody').notes[0];
  assert.equal(note.startTick,2400);
  const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/onpointerdown="MusicStudio\.editorStartMarqueeSelection\(event\)"/);
  assert.match(html,/赤い再生ライン：再生・ノート追加位置/);
  assert.doesNotMatch(html,/music-insert-marker|次のノート追加位置/);
});
test('editor shell removes the persistent note inspector and keeps a full-width responsive Piano Roll',()=>{
  const{app}=load(),project=app.makeProject({projectId:'new-shell',projectName:'New shell'});
  app.state.projects=[project];
  const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.doesNotMatch(html,/class="music-note-inspector"/);
  assert.match(html,/class="music-editor-topbar"/);
  assert.match(html,/class="music-loop-bar"/);
  assert.match(html,/class="music-editor-bottom"/);
  assert.match(html,/<h2>編集ツール<\/h2>/);
  assert.match(html,/<h2>表示・編集補助<\/h2>/);
  assert.match(html,/<h2>再生<\/h2>/);
  assert.match(css,/\.music-editor-layout\{[^}]*grid-template-columns:minmax\(0,1fr\);/);
  assert.match(css,/\.music-editor-popover\{position:absolute/);
  assert.match(css,/@media\(max-width:900px\)\{\.music-editor-bottom\{grid-template-columns:1fr 1fr\}/);
  assert.match(css,/@media\(max-width:600px\)\{\.music-editor-bottom\{grid-template-columns:1fr\}/);
  assert.match(css,/@media\(pointer:coarse\)\{\.music-midi-note\{height:44px;min-width:44px\}/);
  assert.match(source,/querySelectorAll\?\.\('\.music-midi-note\.is-selected'\)/);
  assert.match(source,/dragElements\.forEach\(element=>\{element\.style\.translate=/);
});
test('editor layout prioritizes a compact header and a tall Piano Roll without changing controls',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-midi-editor-page\{width:100%;max-width:none;padding:10px 16px 18px\}/);
  assert.match(css,/\.music-midi-editor-page \.music-flow-nav\{[^}]*margin:0 0 3px/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-heading h1\{font-size:clamp\(1\.1rem,1\.7vw,1\.3rem\)/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-topbar>button,[^}]*min-height:32px/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-save\{margin-left:0/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-viewport\{height:clamp\(560px,calc\(100vh - 250px\),760px\)/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom section\{display:flex;min-height:104px/);
  assert.match(css,/@media\(max-width:900px\)\{\.music-midi-editor-page\{padding:8px 10px 14px\}/);
});
test('Piano Roll renders MIDI Note 0 through 127 in a vertically scrollable range',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'full-pitch-range',projectName:'Full pitch range'});
  app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  window.MusicStudioEditor.addNote(app.state.midiEditor,{id:'low-note',pitch:0,startTick:0,durationTicks:120,velocity:90});
  window.MusicStudioEditor.addNote(app.state.midiEditor,{id:'high-note',pitch:127,startTick:480,durationTicks:120,velocity:100});
  const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-piano-viewport"[^>]*onscroll="MusicStudio\.editorRememberPitchScroll\(this\)"/);
  assert.match(html,/data-pitch-min="0" data-pitch-max="127"/);
  assert.match(html,/Note 0 \/ 0 tick/);
  assert.match(html,/Note 127 \/ 480 tick/);
  assert.match(html,/data-pitch-min="0" data-pitch-max="127"/);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-piano-viewport\{height:508px;overflow:auto/);
  assert.match(css,/\.music-piano-roll\{position:relative;height:3072px/);
  app.editorRememberPitchScroll({scrollTop:1234,scrollLeft:567});
  assert.equal(app.state.midiEditor.view.pitchScrollTop,1234);
  assert.equal(app.state.midiEditor.view.pitchScrollLeft,567);
});
test('time-axis Zoom expands the roll horizontally and preserves two-axis scroll state',()=>{
  const{app}=load(),project=app.makeProject({projectId:'time-zoom',projectName:'Time zoom'});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/時間軸 Zoom：1x/);
  assert.match(html,/class="music-piano-content" style="width:100%"/);
  app.editorZoom(1);html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/時間軸 Zoom：2x/);
  assert.match(html,/class="music-piano-content" style="width:200%"/);
  for(let step=0;step<35;step++)app.editorZoom(1);
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/時間軸 Zoom：30x/);
  assert.match(html,/class="music-piano-content" style="width:3000%"/);
  assert.match(html,/onclick="MusicStudio\.editorZoom\(1\)" disabled/);
  for(let step=0;step<35;step++)app.editorZoom(-1);
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/時間軸 Zoom：1x/);
  assert.match(html,/onclick="MusicStudio\.editorZoom\(-1\)" disabled/);
  assert.match(html,/時間軸 Zoom：1x/);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-piano-viewport\{[^}]*touch-action:pan-x pan-y/);
  assert.match(css,/\.music-pitch-labels\{position:sticky;[^}]*left:0/);
  assert.match(css,/\.music-measure-row\{position:sticky;[^}]*top:0/);
});
test('Piano Roll shows beat and zoom-sensitive subdivision grid',()=>{
  const{app}=load(),project=app.makeProject({projectId:'time-grid',projectName:'Time grid',timeSignature:'4/4'});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-time-grid"/);
  assert.doesNotMatch(html,/class="music-time-grid is-detailed"/);
  assert.match(html,/--measure-size:25%;--beat-size:6\.25%;--subdivision-size:1\.5625%/);
  for(let step=0;step<4;step++)app.editorZoom(1);
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-time-grid is-detailed"/);
  for(let step=0;step<20;step++)app.editorZoom(1);
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-time-grid is-detailed is-ultra"/);
  assert.match(html,/--micro-size:0\.78125%/);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-time-grid\{[^}]*--measure-size/);
  assert.match(css,/\.music-time-grid\.is-detailed\{[^}]*--subdivision-size/);
  assert.match(css,/\.music-time-grid\.is-ultra\{[^}]*--micro-size/);
});
test('time ruler moves and drags the playhead without changing note insertion point',()=>{
  const{app}=load(),project=app.makeProject({projectId:'playhead-ruler',projectName:'Playhead ruler'});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const ruler={dataset:{totalTicks:'7680'},getBoundingClientRect:()=>({left:0,width:800}),setPointerCapture(){}};
  app.editorStartPlayheadMove({button:0,currentTarget:ruler,clientX:200,pointerId:1,preventDefault(){}});
  assert.equal(app.state.midiEditor.playheadTick,1920);
  ruler.onpointermove({clientX:600});
  assert.equal(app.state.midiEditor.playheadTick,5760);
  assert.equal(app.state.midiEditor.playheadTick,5760);
  ruler.onpointerup();
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-time-ruler"[^>]*onpointerdown="MusicStudio\.editorStartPlayheadMove\(event\)"/);
  assert.match(html,/ルーラーや空き位置で移動/);
  assert.match(html,/class="music-playhead" style="left:75%"/);
  assert.match(html,/class="music-playhead-handle" style="left:75%"/);
});
test('adding empty measures persists song length without inventing MIDI notes',async()=>{
  const{app}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'empty-measures',projectName:'Empty measures'});
  app.setRepository(repo);await repo.put(project);app.state.projects=[project];
  let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/曲の長さ：4小節/);
  assert.match(html,/＋ 小節を追加/);
  const beforeNotes=app.state.midiEditor.midiData.tracks.reduce((count,track)=>count+track.notes.length,0);
  app.editorAddMeasures();await app.state.midiEditorSavePromise;
  const stored=await repo.get(project.projectId);
  assert.equal(stored.midiData.editor.measureCount,8);
  assert.equal(stored.midiData.tracks.reduce((count,track)=>count+track.notes.length,0),beforeNotes);
  app.state.midiEditor=null;app.state.projects=[stored];
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/曲の長さ：8小節/);
  assert.match(html,/小節 8/);
  assert.equal(app.midiExportInput(stored,'all').tracks.reduce((count,track)=>count+track.notes.length,0),beforeNotes);
});
test('navigation blocks an unsaved MIDI editor without discarding notes',()=>{
  const{app,values,window}=load(),project=app.makeProject({projectId:'dirty-project',projectName:'Dirty'});app.state.projects=[project];values.set(app.LAST_PROJECT_KEY,project.projectId);
  app.renderRoute(`music-studio/midi-editor/${project.projectId}`);app.editorAddNote();const before=JSON.stringify(app.state.midiEditor.midiData),hash=window.location.hash;
  assert.equal(app.openLogicPro(project.projectId),false);assert.equal(window.location.hash,hash);assert.equal(JSON.stringify(app.state.midiEditor.midiData),before);assert.match(app.state.notice,/保存してから移動/);
});
test('stopping a MIDI recording persists its Melody notes through the existing project repository',async()=>{
  const{app}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'recorded-project',projectName:'Recorded'});
  app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  app.state.midiInput.recording=true;app.state.midiInput.recorder={stop:()=>[{id:'recorded-note',pitch:64,startTick:120,durationTicks:360,velocity:91,channel:1}]};
  const result=await app.editorStopMidiRecording(),stored=await repo.get(project.projectId),melody=stored.midiData.tracks.find(track=>track.part==='melody');
  assert.equal(result.ok,true);assert.equal(melody.notes.length,1);assert.equal(melody.notes[0].pitch,64);assert.equal(melody.notes[0].durationTicks,360);assert.equal(app.state.midiEditor.dirty,false);assert.match(app.state.midiInput.status,/保存しました/);
});
test('recorded Melody correction survives save and editor reload',async()=>{
  const{app}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'correction-reload',projectName:'Correction reload'});
  app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  app.state.midiInput.recording=true;app.state.midiInput.recorder={stop:()=>[{id:'played',pitch:64,startTick:119,durationTicks:251,velocity:91,channel:1}]};
  await app.editorStopMidiRecording();
  app.editorPreviewCorrection();app.editorApplyCorrection();
  assert.equal(app.state.midiEditor.dirty,true);
  await app.saveMidiEditor();
  const stored=await repo.get(project.projectId),storedNote=stored.midiData.tracks.find(track=>track.part==='melody').notes[0];
  assert.equal(storedNote.startTick,120);assert.equal(storedNote.durationTicks,240);
  app.state.projects=[stored];app.state.midiEditor=null;app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const reloaded=app.state.midiEditor.midiData.tracks.find(track=>track.part==='melody').notes[0];
  assert.equal(reloaded.startTick,120);assert.equal(reloaded.durationTicks,240);assert.equal(app.state.midiEditor.dirty,false);
});
test('MIDI edits made while save is pending remain dirty after the older save completes',async()=>{
  const{app}=load(),base=app.memoryRepository(),project=app.makeProject({projectId:'save-race',projectName:'Save race'});await base.put(project);
  let release;const repo={...base,async put(value){await new Promise(resolve=>{release=resolve});return base.put(value)}};app.setRepository(repo);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  app.editorAddNote();const saving=app.state.midiEditorSavePromise;await Promise.resolve();await Promise.resolve();
  app.editorAddNote();release();
  const result=await saving,stored=await base.get(project.projectId);
  assert.equal(result.stale,true);assert.equal(app.state.midiEditor.dirty,true);
  assert.equal(stored.midiData.tracks.find(track=>track.part==='melody').notes.length,1);
  assert.equal(app.state.midiEditor.midiData.tracks.find(track=>track.part==='melody').notes.length,2);
});
test('confirmed MIDI editing starts IndexedDB persistence without a debounce window',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'immediate-save',projectName:'Immediate save'}),timers=[];
  app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  window.setTimeout=(fn,delay)=>{timers.push({fn,delay});return timers.length};window.clearTimeout=()=>{};
  app.editorAddNote();const saving=app.state.midiEditorSavePromise;
  assert.ok(saving);assert.equal(timers.length,0);
  await saving;const stored=await repo.get(project.projectId);
  assert.equal(app.state.midiEditor.dirty,false);
  assert.equal(stored.midiData.tracks.find(track=>track.part==='melody').notes.length,1);
  assert.match(app.renderRoute(`music-studio/midi-editor/${project.projectId}`),/>保存済み<\/button>/);
  assert.match(source,/addEventListener\?\.\('pagehide'.*flushMidiEditorAutosave/);
  assert.match(source,/addEventListener\?\.\('visibilitychange'.*flushMidiEditorAutosave/);
});
test('Drums input and persisted editor measure state also save immediately',async()=>{
  const{app}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'all-durable-edits',projectName:'All durable edits'});
  app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  app.editorToggleMeasure(2);await app.state.midiEditorSavePromise;await Promise.resolve();
  app.editorSelectPart('drums');app.editorDrumInput(38);await app.state.midiEditorSavePromise;await Promise.resolve();
  const stored=await repo.get(project.projectId),drums=stored.midiData.tracks.find(track=>track.part==='drums');
  assert.equal(drums.notes.length,1);assert.equal(drums.notes[0].pitch,38);
  assert.deepEqual(Array.from(stored.midiData.editor.parts.melody.selectedMeasures),[2]);
});
test('an edit during immediate save is serialized and the final state is persisted',async()=>{
  const{app}=load(),base=app.memoryRepository(),project=app.makeProject({projectId:'immediate-race',projectName:'Immediate race'});await base.put(project);
  let release,puts=0;const repo={...base,async put(value){puts++;if(puts===1)await new Promise(resolve=>{release=resolve});return base.put(value)}};
  app.setRepository(repo);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  app.editorAddNote();const firstSave=app.state.midiEditorSavePromise;await Promise.resolve();await Promise.resolve();
  app.editorAddNote();release();await firstSave;await Promise.resolve();await Promise.resolve();
  const finalSave=app.state.midiEditorSavePromise;if(finalSave)await finalSave;
  const stored=await base.get(project.projectId);
  assert.equal(stored.midiData.tracks.find(track=>track.part==='melody').notes.length,2);
  assert.equal(app.state.midiEditor.dirty,false);
});
test('immediate MIDI save failure keeps the edited notes dirty in memory',async()=>{
  const{app}=load(),base=app.memoryRepository(),project=app.makeProject({projectId:'immediate-failure',projectName:'Immediate failure'});await base.put(project);
  app.setRepository({...base,async put(){throw Error('storage unavailable')}});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const originalError=console.error;console.error=()=>{};let result;try{app.editorAddNote();result=await app.state.midiEditorSavePromise}finally{console.error=originalError}
  assert.equal(result.ok,false);assert.equal(app.state.midiEditor.dirty,true);
  assert.equal(app.state.midiEditor.midiData.tracks.find(track=>track.part==='melody').notes.length,1);
  assert.equal((await base.get(project.projectId)).midiData,undefined);
});
test('Apply is reflected in latest unsaved MIDI export input without touching other parts',()=>{
  const{app}=load(),project=app.makeProject({projectId:'latest-export',projectName:'Latest export',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[
    {id:'melody',part:'melody',name:'Melody',channel:1,notes:[{id:'m',pitch:60,startTick:119,durationTicks:251,velocity:90}]},
    {id:'drums',part:'drums',name:'Drums',channel:10,notes:[{id:'d',pitch:36,startTick:0,durationTicks:120,velocity:100}]},
    {id:'bass',part:'bass',name:'Bass',channel:2,notes:[{id:'b',pitch:36,startTick:0,durationTicks:480,velocity:80}]}
  ]}});
  app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  app.editorPreviewCorrection();app.editorApplyCorrection();
  const summary=app.midiExportSummary({...project,midiData:app.state.midiEditor.midiData},'all');
  assert.equal(summary.input.tracks.find(track=>track.part==='melody').notes[0].startTick,120);
  assert.equal(summary.input.tracks.find(track=>track.part==='drums').notes[0].startTick,0);
  assert.equal(summary.input.tracks.find(track=>track.part==='bass').notes[0].durationTicks,480);
});
test('a failed recording autosave keeps the recorded notes dirty and available for manual retry',async()=>{
  const{app}=load(),base=app.memoryRepository(),project=app.makeProject({projectId:'failed-recording',projectName:'Failed recording'});await base.put(project);
  const repo={...base,async put(value){if(value.midiData)throw Error('storage unavailable');return base.put(value)}};app.setRepository(repo);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  app.state.midiInput.recording=true;app.state.midiInput.recorder={stop:()=>[{id:'unsaved-note',pitch:67,startTick:0,durationTicks:240,velocity:88,channel:1}]};
  const originalError=console.error;console.error=()=>{};let result;try{result=await app.editorStopMidiRecording()}finally{console.error=originalError}
  const stored=await base.get(project.projectId),melody=app.state.midiEditor.midiData.tracks.find(track=>track.part==='melody');
  assert.equal(result.ok,false);assert.equal(melody.notes.length,1);assert.equal(app.state.midiEditor.dirty,true);assert.equal(stored.midiData,undefined);assert.match(app.state.midiInput.status,/保存できませんでした/);
});
test('unsaved-change detection includes MIDI editor changes for reload protection',()=>{
  const{app}=load();assert.equal(app.hasUnsavedChanges(),false);app.state.midiEditor={dirty:true};assert.equal(app.hasUnsavedChanges(),true);app.state.midiEditor.dirty=false;app.state.dirty=true;assert.equal(app.hasUnsavedChanges(),true);
});
test('route reads normalized project data without mutating settings',()=>{const {app}=load();app.state.settings=app.normalizeSettings({midi:{fileType:0,ppq:960,channel:3,autoChannel:false},fileNaming:{template:'{projectName}_{type}'}});const before=JSON.stringify(app.state.settings),html=app.logicProView();assert.match(html,/Type 0／1読み込み/);assert.equal(JSON.stringify(app.state.settings),before)});
test('no MIDI data produces an explanation and no download',()=>{const {app}=load();assert.equal(app.requestMidiExport().validation.ok,false);assert.match(app.state.notice,/書き出せません/)});
test('MIDI boundary trusts content over extension and rejects broken files',async()=>{const {app,window}=load(),generated=window.MusicStudioMidi.createMidiFile(window.MusicStudioMidi.createTestMidiData()).bytes;assert.equal((await app.inspectMidiFile(file('safe.mid',generated))).ok,true);assert.equal((await app.inspectMidiFile(file('wrong.txt',generated))).ok,true);assert.equal((await app.inspectMidiFile(file('broken.mid',[0,1,2,3]))).ok,false);assert.equal((await app.inspectMidiFile()).cancelled,true)});
test('audio reference records no body and rejects unsupported formats',()=>{const {app}=load();assert.equal(app.inspectAudioReference(file('mix.wav',[1,2,3],'audio/wav')).ok,true);assert.equal(app.inspectAudioReference(file('mix.mp3',[1,2,3],'audio/mpeg')).ok,false);assert.equal(app.inspectAudioReference().cancelled,true)});
test('existing project and other application data remain unchanged',async()=>{const {app,values,window}=load();const repo=app.memoryRepository();app.setRepository(repo);const project=app.makeProject({projectName:'Safe'});await repo.put(project);const generated=window.MusicStudioMidi.createMidiFile(window.MusicStudioMidi.createTestMidiData()).bytes;await app.inspectMidiFile(file('return.mid',generated));assert.deepEqual(await repo.get(project.projectId),project);assert.equal(values.get('novaStudio_v01'),'nova-safe');assert.equal(values.get('aiMusicHelperProject'),'ai-safe')});
test('new MIDI import creates a new editable Version 1 project and metadata-only history',async()=>{const {app,window}=load(),repo=app.memoryRepository();app.setRepository(repo);const bytes=window.MusicStudioMidi.createMidiFile(window.MusicStudioMidi.createTestMidiData()).bytes;await app.inspectMidiFile(file('Logic Song.mid',bytes,'audio/midi'));const result=await app.saveMidiImport('new'),stored=await repo.get(result.project.projectId),history=await repo.listMidiImportHistory();assert.equal(result.ok,true);assert.equal(stored.schemaVersion,'1.0');assert.equal(stored.projectName,'Logic Song');assert.equal(stored.midiData.tracks.reduce((n,t)=>n+t.notes.length,0),10);assert.equal(window.location.hash.includes('music-studio/midi-editor/'),true);assert.equal(history.length,1);assert.equal(JSON.stringify(history).includes('bytes'),false);assert.equal(JSON.stringify(stored).includes('/Users/'),false)});
test('duplicate MIDI import leaves the source project byte-for-byte unchanged',async()=>{const {app,window}=load(),repo=app.memoryRepository(),source=app.makeProject({projectId:'source',projectName:'Original',productionNotes:'keep'});app.setRepository(repo);await repo.put(source);app.state.projects=[source];const before=JSON.stringify(await repo.get('source')),bytes=window.MusicStudioMidi.createMidiFile(window.MusicStudioMidi.createTestMidiData()).bytes;await app.inspectMidiFile(file('duplicate.mid',bytes));const result=await app.saveMidiImport('duplicate');assert.equal(result.ok,true);assert.notEqual(result.project.projectId,'source');assert.equal(JSON.stringify(await repo.get('source')),before);assert.equal(result.project.importSource.fileName,'duplicate.mid');assert.equal(result.project.integrations.logicPro[0].sourceProjectId,'source')});
test('history failure does not roll back an imported project',async()=>{const {app,window}=load(),base=app.memoryRepository(),repo={...base,async putMidiImportHistory(){throw Error('history unavailable')}};app.setRepository(repo);const bytes=window.MusicStudioMidi.createMidiFile(window.MusicStudioMidi.createTestMidiData()).bytes;await app.inspectMidiFile(file('history.mid',bytes));const result=await app.saveMidiImport('new');assert.equal(result.ok,true);assert.ok(await repo.get(result.project.projectId));assert.match(result.history.historyWarning,/履歴/) });
test('cancelled import clears preview without writing',async()=>{const {app}=load(),repo=app.memoryRepository();app.setRepository(repo);app.state.midiImportPreview={error:'test'};app.cancelMidiImport();assert.equal(app.state.midiImportPreview,null);assert.equal((await repo.list()).length,0)});
test('responsive CSS stacks integration sections below tablet width',()=>{const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');const tablet=css.slice(css.indexOf('@media(max-width:900px)'));assert.match(tablet,/\.music-integration-grid\{grid-template-columns:1fr\}/)});
test('part and All exports keep tempo, PPQ, note timing, velocity and channel through round trip',()=>{
  const{app,window}=load(),project=app.makeProject({projectName:'NOVA / MIDI:*Test',midiData:{version:1,ppq:960,tempo:132,timeSignature:{numerator:6,denominator:8},tracks:[
    {id:'melody',part:'melody',name:'Melody',channel:1,program:0,notes:[{id:'m1',pitch:67,startTick:240,durationTicks:720,velocity:93}]},
    {id:'drums',part:'drums',name:'Drums',channel:10,program:null,notes:[{id:'d1',pitch:38,startTick:480,durationTicks:120,velocity:111}]},
    {id:'bass',part:'bass',name:'Bass',channel:2,program:32,notes:[{id:'b1',pitch:40,startTick:0,durationTicks:1440,velocity:82}]}
  ]}});
  for(const [scope,expected] of [['melody',{pitch:67,startTick:240,durationTicks:720,velocity:93,channel:1}],['drums',{pitch:38,startTick:480,durationTicks:120,velocity:111,channel:10}],['bass',{pitch:40,startTick:0,durationTicks:1440,velocity:82,channel:2}]]){
    const summary=app.midiExportSummary(project,scope),parsed=window.MusicStudioMidiParser.parseMidiFile(window.MusicStudioMidi.createMidiFile(summary.input).bytes).normalized,track=parsed.tracks.find(item=>item.noteCount);
    assert.equal(summary.validation.ok,true);assert.match(summary.filename,new RegExp(`_${scope[0].toUpperCase()+scope.slice(1)}\\.mid$`));assert.equal(parsed.ppq,960);assert.ok(Math.abs(parsed.tempo-132)<.001);assert.equal(`${parsed.timeSignature.numerator}/${parsed.timeSignature.denominator}`,'6/8');assert.equal(track.channel,expected.channel);assert.equal(track.notes[0].pitch,expected.pitch);assert.equal(track.notes[0].startTick,expected.startTick);assert.equal(track.notes[0].durationTicks,expected.durationTicks);assert.equal(track.notes[0].velocity,expected.velocity);
  }
  const all=app.midiExportSummary(project,'all'),roundTrip=window.MusicStudioMidiParser.parseMidiFile(window.MusicStudioMidi.createMidiFile(all.input).bytes).normalized;
  assert.equal(all.filename,'NOVA-MIDI-Test_All.mid');assert.equal(all.validation.trackCount,3);assert.equal(roundTrip.tracks.filter(track=>track.noteCount).length,3);assert.equal(roundTrip.totalNotes,3);
});
test('Drums editor export uses its explicit project instead of stale Piano project data',async()=>{
  const{app,values,window}=load(),repo=app.memoryRepository();app.setRepository(repo);
  const piano=app.makeProject({projectId:'piano-project',projectName:'Old Piano',midiData:window.MusicStudioMidi.createTestMidiData()});
  const drums=app.makeProject({projectId:'drums-project',projectName:'MS-RESTART-06 Drums Test',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[
    {id:'drums',part:'drums',name:'Drums',channel:10,program:null,notes:[
      {id:'kick',pitch:36,startTick:0,durationTicks:240,velocity:108},
      {id:'snare',pitch:38,startTick:480,durationTicks:240,velocity:100},
      {id:'hat',pitch:42,startTick:0,durationTicks:120,velocity:86}
    ]}
  ]}});
  await repo.put(piano);await repo.put(drums);app.state.projects=[piano,drums];values.set(app.LAST_PROJECT_KEY,piano.projectId);
  app.state.midiEditor={projectId:drums.projectId,part:'drums',midiData:drums.midiData};
  window.URL={createObjectURL:()=>`blob:test`,revokeObjectURL(){}};
  window.document={body:{dataset:{},appendChild(){}},createElement:()=>({click(){},remove(){}})};
  const exported=await app.performMidiExport('drums',drums.projectId);
  const parsed=window.MusicStudioMidiParser.parseMidiFile(exported.bytes).normalized,track=parsed.tracks.find(item=>item.noteCount);
  assert.equal(exported.ok,true);assert.equal(exported.history.projectId,drums.projectId);assert.equal(exported.filename,'MS-RESTART-06-Drums-Test_Drums.mid');
  assert.equal(track.name,'Drums');assert.equal(track.channel,10);assert.equal(track.drumCandidate,true);assert.deepEqual([...new Set(track.notes.map(note=>note.pitch))].sort((a,b)=>a-b),[36,38,42]);assert.equal(track.programChanges.length,0);
});
