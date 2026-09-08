Warning: truncated output (original token count: 61743)
Total output lines: 1416

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');
function load(navigator={}){
  const values=new Map([['novaStudio_v01','nova-safe'],['aiMusicHelperProject','ai-safe']]);
  let uuidSequence=0;const window={navigator,crypto:{randomUUID:()=>`id-${++uuidSequence}`},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},location:{hash:'#music-studio/logic-pro'},performance:{now:()=>0},addEventListener(){},setTimeout,clearTimeout,Intl,Date,Math,JSON,console,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob};window.window=window;
  const midiSource=fs.readFileSync(path.join(__dirname,'..','music-studio-midi.js'),'utf8');vm.runInNewContext(midiSource,{window,globalThis:window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,unescape,encodeURIComponent},{filename:'music-studio-midi.js'});const parserSource=fs.readFileSync(path.join(__dirname,'..','music-studio-midi-parser.js'),'utf8');vm.runInNewContext(parserSource,{window,globalThis:window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,unescape,encodeURIComponent},{filename:'music-studio-midi-parser.js'});const editorSource=fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8');vm.runInNewContext(editorSource,{window,globalThis:window},{filename:'music-studio-editor.js'});const inputSource=fs.readFileSync(path.join(__dirname,'..','music-studio-midi-input.js'),'utf8');vm.runInNewContext(inputSource,{window,globalThis:window},{filename:'music-studio-midi-input.js'});const playbackSource=fs.readFileSync(path.join(__dirname,'..','music-studio-playback.js'),'utf8');vm.runInNewContext(playbackSource,{window,globalThis:window},{filename:'music-studio-playback.js'});
  vm.runInNewContext(source,{window,globalThis:window},{filename:'music-studio.js'});return{app:window.MusicStudio,values,window};
}
function file(name,bytes,type='application/octet-stream'){const data=Uint8Array.from(bytes);return{name,size:data.length,type,async arrayBuffer(){return data.buffer},slice(start,end){const part=data.slice(start,end);return{async arrayBuffer(){return part.buffer}}}}}

test('Logic Pro route opens standalone and includes safe round-trip actions',()=>{const {app}=load();const html=app.renderRoute('music-studio/logic-pro',{standalone:true});assert.match(html,/Logic Pro X連携/);assert.match(html,/Logic ProからMIDIを取り込む/);assert.match(html,/Type 1 MIDIを書き出す/);assert.match(html,/新規または複製/);assert.match(html,/読み込み履歴/);assert.doesNotMatch(html,/← 戻る|次へ →|Back（戻る）|Next（進む）/);assert.match(html,/MIDI channel 10/);assert.match(html,/Drum Kit Designer/);assert.match(html,/Kick 36／Snare 38／Closed Hi-Hat 42/)});
test('major and placeholder routes omit the retired back and next navigation',()=>{
  const{app,values}=load(),project=app.makeProject({projectId:'nav-project',projectName:'Navigation',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[{id:'drums',part:'drums',name:'Drums',channel:10,program:null,notes:[{id:'d',pitch:36,startTick:0,durationTicks:120,velocity:100}]}]}});
  app.state.projects=[project];values.set(app.LAST_PROJECT_KEY,project.projectId);
  const routes=['music-studio','music-studio/recent-projects','music-studio/new-project',`music-studio/project/${project.projectId}`,`music-studio/midi-editor/${project.projectId}`,'music-studio/logic-pro','music-studio/settings','music-studio/backup','music-studio/lyrics-notes'];
  for(const route of routes){const html=app.renderRoute(route);assert.doesNotMatch(html,/class="music-flow-nav"|← 戻る|次へ →|Back（戻る）|Next（進む）/,route)}
  const editor=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(editor,/class="music-editor-chrome"><header class="music-editor-heading"/);
});
test('Project popup omits BPM while Current Tempo keeps editor tempo fallback and validation',async()=>{
  const{app}=load(),repo=app.memoryRepository(),withTempo=app.makeProject({projectId:'bpm-ui-tempo',projectName:'BPM UI',bpm:111,midiData:{tempo:132.5,tracks:[{part:'melody',notes:[]}]}});app.setRepository(repo);await repo.put(withTempo);app.state.projects=[withTempo];let html=app.renderRoute(`music-studio/midi-editor/${withTempo.projectId}`);
  assert.match(html,/class="music-editor-popover music-project-popover"/);assert.doesNotMatch(html,/music-project-bpm|aria-label="Project BPM"/);assert.match(html,/value="132\.5"[^>]*aria-label="Current Tempo BPM"[^>]*editorSetBpm/);
  const withoutMidi=app.makeProject({projectId:'bpm-ui-project',projectName:'Project BPM',bpm:98.4});app.state.projects=[withoutMidi];app.state.midiEditor=null;html=app.renderRoute(`music-studio/midi-editor/${withoutMidi.projectId}`);assert.doesNotMatch(html,/music-project-bpm|aria-label="Project BPM"/);assert.match(html,/value="98\.4"[^>]*aria-label="Current Tempo BPM"/);
  const session=app.state.midiEditor,undo=session.undo.length,redo=session.redo.length;assert.equal(app.editorSetBpm(19).ok,false);assert.equal(app.editorSetBpm(401).ok,false);assert.equal(session.midiData.tempo,98.4);assert.equal(session.undo.length,undo);assert.equal(session.redo.length,redo)
});
test('Project popup reuses the guarded New Project route and keeps the existing Open Project action',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'new-project-entry',projectName:'New Project entry'});app.state.projects=[project];
  const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-project-actions">[\s\S]*onclick="MusicStudio\.goNew\(\)">＋ New Project（新しいプロジェクト）<\/button>[\s\S]*onclick="MusicStudio\.openProject\('new-project-entry'\)">Open Project（プロジェクトを開く）<\/button>/);
  window.location.hash=`#music-studio/midi-editor/${project.projectId}`;app.state.midiEditor.dirty=true;app.goNew();assert.equal(window.location.hash,`#music-studio/midi-editor/${project.projectId}`);assert.match(app.state.notice,/未保存の変更/);
  app.state.midiEditor.dirty=false;app.state.notice='';app.goNew();assert.equal(window.location.hash,'music-studio/new-project');
});
test('Editor BPM sync saves the Project value and drives next playback and MIDI tempo export',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'bpm-sync',projectName:'BPM Sync',bpm:120,midiData:{ppq:480,tempo:120,tracks:[{part:'melody',notes:[{id:'n',pitch:60,startTick:0,durationTicks:480,velocity:90}]}]}});app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);const calls=[];app.state.melodyAudio.synth={context:{currentTime:10},supported:()=>true,unlock:async()=>true,stopPlayback(){},playTracks(tracks,timing){calls.push(timing);return{ok:true,noteCount:1,durationMs:1000,playbackStart:10.04,secondsPerTick:60/(timing.tempo*timing.ppq),startTick:0,endTick:480}},stopMetronome(){}};
  const session=app.state.midiEditor,undo=session.undo.length,redo=session.redo.length,result=app.editorSetBpm('137.5');assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:true,changed:true,bpm:137.5});assert.equal(session.midiData.tempo,137.5);assert.equal(session.dirty,true);assert.equal(session.undo.length,undo);assert.equal(session.redo.length,redo);await app.state.midiEditorSavePromise;const stored=await repo.get(project.projectId);assert.equal(stored.musicalSettings.bpm,137.5);assert.equal(stored.midiData.tempo,137.5);
  await app.editorPlayMelody();assert.equal(calls[0].tempo,137.5);app.editorStopMelody();const input=app.midiExportInput(stored,'melody'),made=window.MusicStudioMidi.createMidiFile(input),inspected=window.MusicStudioMidi.inspectMidiBytes(made.bytes);assert.ok(Math.abs(inspected.tracks[0].tempo-137.5)<.001);assert.equal(input.tempo,137.5);assert.equal(stored.schemaVersion,'1.0');assert.equal(app.APP_VERSION,'1.4.0')
});
test('history buttons use Japanese rounded arrows at the right of the part tabs without changing actions',()=>{
  const{app}=load(),project=app.makeProject({projectId:'button-guidance',projectName:'Button guidance'});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-part-tabs"[^>]*>[\s\S]*class="music-history-controls"[^>]*>[\s\S]*editorUndo\(\)" disabled title="元に戻す" aria-label="元に戻す"><svg class="music-history-icon"[\s\S]*<span>戻る<\/span>[\s\S]*editorRedo\(\)" disabled title="やり直す" aria-label="やり直す"><svg class="music-history-icon"[\s\S]*<span>進む<\/span>/);
  assert.equal((html.match(/editorUndo\(\)/g)||[]).length,1);assert.equal((html.match(/editorRedo\(\)/g)||[]).length,1);
  for(const part of ['Melody','Drums','Bass'])assert.match(html,new RegExp(`class="music-part-tab-group"[^>]*>[\\s\\S]*?class="music-part-tab [^"]+"[^>]*>${part}<\\/button>[\\s\\S]*?aria-label="${part} Mute">M<\\/button>[\\s\\S]*?aria-label="${part} Solo">S<\\/button>`));
  assert.equal((html.match(/aria-label="(?:Melody|Drums|Bass) Mute"/g)||[]).length,3);assert.equal((html.match(/aria-label="(?:Melody|Drums|Bass) Solo"/g)||[]).length,3);assert.doesNotMatch(html,/music-track-runtime-controls/);
  assert.doesNotMatch(html,/class="[^"]*music-history-control"|>Undo<\/span>|>Redo<\/span>/);
  app.editorPreviewCorrection();html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/editorApplyCorrection\(\)"[^>]*>Apply <span class="music-button-note">（適用）<\/span>/);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-button-note\{font-size:\.72em;font-weight:600;opacity:\.78;white-space:nowrap\}/);
  assert.match(css,/\.music-history-controls\{display:flex;gap:5px;margin-left:auto\}/);assert.match(css,/border-radius:999px/);assert.match(css,/\.music-history-icon\{width:20px;height:20px;[^}]*stroke-linecap:round;stroke-linejoin:round\}/);
  assert.match(css,/\.music-midi-editor-page \.music-part-tabs\{gap:4px;margin:4px 0 6px\}/);
});
test('Melody Correction is an overlay with complete basic controls and transient Preview Apply Cancel history',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'correction-popover',projectName:'Correction popover',midiData:{tracks:[{part:'melody',notes:[
    {id:'target',pitch:61,startTick:119,durationTicks:251,velocity:90},
    {id:'outside',pitch:64,startTick:480,durationTicks:240,velocity:90}
  ]}]}});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),core=window.MusicStudioEditor,session=app.state.midiEditor;
  assert.match(html,/<summary>Melody Correction（メロディ補正）<\/summary>/);assert.match(html,/name="key"/);assert.match(html,/Pentatonic/);assert.match(html,/name="quantize"/);assert.match(html,/>OFF<\/option>/);assert.match(html,/name="strength" type="range"/);assert.match(html,/name="swing" type="range"/);assert.match(html,/value="selected"/);assert.match(html,/value="measures"/);assert.doesNotMatch(html,/class="music-correction-tools"/);assert.match(html,/AIメロディ生成：未実装/);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');assert.match(css,/\.music-midi-editor-page \.music-correction-popover label\{font-weight:700\}/);assert.match(css,/\.music-midi-editor-page \.music-correction-grid label[^}]*color:var\(--music-violet\)/);assert.match(css,/\.music-midi-editor-page \.music-correction-target legend\{margin-left:0;padding:0 5px;background:#081421;color:var\(--music-blue\);line-height:1\.4\}/);assert.match(css,/\.music-correction-batch-grid :is\(b,label,legend\)\{color:#082032\}/);assert.match(css,/\.music-correction-batch-grid label:has\(:disabled\)[^}]*opacity:\.55/);
  assert.match(css,/input\[type=range\],input\[type=checkbox\],input\[type=radio\]\)\{accent-color:var\(--music-editor-accent\)\}/);assert.match(css,/\.music-correction-popover output\{color:var\(--music-violet\)\}/);assert.match(css,/\.music-correction-popover \.music-primary\{border-color:var\(--music-editor-accent\);background:rgba\(109,40,217,\.2\);color:var\(--music-violet\)\}/);assert.match(css,/legend\{float:none;grid-column:1\/-1;width:auto;margin:0 0 4px;padding:0;background:transparent;font-size:\.76rem;line-height:1\.25\}/);assert.match(css,/\.music-correction-popover button\{height:auto;min-height:28px;padding:3px 8px;font-size:\.74rem/);
  core.selectNote(session,'target');
  const form={elements:{key:{value:'C'},scale:{value:'Major'},quantize:{value:'1/16'},strength:{value:'100'},swing:{value:'0'},target:{value:'selected'},measureFrom:{value:'1'},measureTo:{value:'1'}}};
  window.document={querySelector:selector=>selector==='#melodyCorrectionForm'?form:null};
  const original=JSON.stringify(core.currentTrack(session).notes),result=app.editorPreviewCorrection();assert.equal(result.ok,true);assert.equal(JSON.stringify(core.currentTrack(session).notes),original);
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/is-correction-preview/);assert.match(html,/対象 1/);
  assert.equal(app.editorToggleCorrectionPreview(),'original');html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.doesNotMatch(html,/is-correction-preview/);
  app.editorCancelCorrection();assert.equal(session.correctionPreview,null);assert.equal(JSON.stringify(core.currentTrack(session).notes),original);
  app.editorPreviewCorrection();app.editorApplyCorrection();assert.equal(core.currentTrack(session).notes[0].pitch,60);assert.equal(core.currentTrack(session).notes[0].startTick,120);
  app.editorUndo();assert.equal(core.currentTrack(session).notes[0].pitch,61);app.editorRedo();assert.equal(core.currentTrack(session).notes[0].pitch,60);
});
test('Correction repaint preserves page Piano Roll and popover scroll while notices are overlay toasts',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'stable-correction-ui',projectName:'Stable correction UI',midiData:{tracks:[{part:'melody',notes:[{id:'note',pitch:61,startTick:119,durationTicks:251,velocity:90}]}]}});
  app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const viewport={scrollTop:1234,scrollLeft:567,dataset:{initialScrollTop:'0',initialScrollLeft:'0',scrollReady:'true'}};
  const pianoScroll={scrollTop:0,scrollLeft:567,dataset:{scrollReady:'true'}};
  const popover={scrollTop:321,scrollHeight:700,clientHeight:688,style:{},getBoundingClientRect(){return{top:Number.parseFloat(this.style.top)||200}}};
  const summary={getBoundingClientRect:()=>({bottom:160})};
  const menu={open:true,querySelector:selector=>selector==='summary'?summary:selector==='.music-correction-popover'?popover:null};
  const form={elements:{key:{value:'C'},scale:{value:'Major'},quantize:{value:'1/16'},strength:{value:'100'},swing:{value:'0'},target:{value:'all'},measureFrom:{value:'1'},measureTo:{value:'1'}}};
  const scrollCalls=[];window.scrollX=40;window.scrollY=260;window.innerWidth=1280;window.innerHeight=900;window.scrollTo=value=>scrollCalls.push(value);window.requestAnimationFrame=callback=>callback();
  window.document={documentElement:{clientHeight:900},querySelector(selector){if(selector==='.music-piano-viewport')return viewport;if(selector==='.music-piano-scroll')return pianoScroll;if(selector==='.music-correction-menu')return menu;if(selector==='.music-editor-chrome')return{getBoundingClientRect:()=>({bottom:44})};if(selector==='#melodyCorrectionForm')return form;return null}};
  const result=app.editorPreviewCorrection();
  assert.equal(result.ok,true);assert.equal(app.state.midiEditor.view.pitchScrollTop,1234);assert.equal(app.state.midiEditor.view.pitchScrollLeft,567);
  assert.equal(app.state.midiEditor.view.correctionMenuOpen,true);assert.equal(app.state.midiEditor.view.correctionPopoverScrollTop,321);
  assert.equal(viewport.scrollTop,1234);assert.equal(viewport.scrollLeft,567);assert.equal(pianoScroll.scrollLeft,567);assert.equal(popover.scrollTop,321);
  assert.ok(scrollCalls.length>=2);assert.equal(JSON.stringify(scrollCalls[0]),'{"left":40,"top":260,"behavior":"instant"}');
  assert.equal(popover.style.top,'calc(100% + 8px)');assert.equal(popover.style.right,'0');assert.equal(popover.style.width,'min(720px,calc(100vw - 24px))');assert.equal(popover.style.maxHeight,'688px');assert.equal(popover.style.overflowY,'auto');
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-notice\{position:fixed;z-index:1000;[^}]*right:12px/);
  assert.match(css,/\.music-correction-batch-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.music-correction-popover\{right:0;left:auto;width:min\(720px,[^}]*overscroll-behavior:contain/);
  assert.ok(source.includes('},2600)||null'));
});
test('editor chrome is compact, Melody helpers stay intact, and Correction uses a responsive overlay',()=>{
  const{app}=load(),project=app.makeProject({projectId:'compact-editor-surfaces',projectName:'Compact editor surfaces'});
  app.state.projects=[project];const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(html,/class="music-editor-chrome"><header class="music-editor-heading"/);
  assert.match(html,/class="music-editor-menu music-part-workflow music-melody-workflow"><summary><b>演奏補助<\/b>/);
  assert.ok(html.indexOf('music-part-workflow music-melody-workflow')<html.indexOf('class="music-part-tabs"'));
  assert.doesNotMatch(html,/<p class="music-kicker">Melody workflow<\/p><h2[^>]*>メロディ制作<\/h2>/);
  for(const preserved of ['melodyInputDuration','melodyInputVelocity','メロディ入力鍵盤','editorSelectMeasureRange','editorToggleLock','editorPrepareRegeneration'])assert.match(html,new RegExp(preserved));
  assert.doesNotMatch(html,/MS-RESTART-10|Editor UI shell/);
  assert.match(html,/class="music-correction-sticky-header"><button type="button" class="music-secondary music-correction-panel-close"[^>]*editorCloseCorrectionPanel/);assert.equal((html.match(/music-correction-panel-close/g)||[]).length,1);
  for(const popupClass of ['music-project-popover','music-shortcuts-popover','music-editor-transfer','music-part-workflow-popover','music-midi-input-popover']){const popup=html.match(new RegExp(`class="[^"]*${popupClass}[^"]*"[^>]*>([\\s\\S]*?)(?:<\\/div><\\/details>|<\\/details>)`))?.[1]||'';assert.equal((popup.match(/class="music-secondary music-popup-close"/g)||[]).length,1);assert.match(popup,/editorClosePopup\(this\)/)}
  assert.match(css,/\.music-editor-popover:not\(\.music-correction-popover\)\{max-height:min\(70vh,calc\(100vh - 88px\)\);overflow-y:auto\}/);assert.match(css,/\.music-popup-close-row\{position:sticky;z-index:6;top:0;display:flex;flex:0 0 100%;justify-content:flex-end;box-sizing:border-box;width:100%/);
  assert.doesNotMatch(html,/<legend>(補正対象|対象|移調方向)<\/legend>/);for(const title of ['補正対象','対象','移調方向'])assert.match(html,new RegExp(`class="music-correction-group-title">${title}<\\/div><fieldset[^>]+aria-label="${title}"`));
  assert.match(css,/--music-editor-heading-height:42px;--music-editor-menu-size:40px;--music-editor-page-top:10px/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-chrome\{min-height:var\(--music-editor-heading-height\);margin-bottom:1px\}/);
  assert.match(css,/top:calc\(var\(--music-editor-page-top\) \+ \(var\(--music-editor-heading-height\) - var\(--music-editor-menu-size\)\)\/2\)/);
  assert.match(css,/\.music-midi-editor-page:has\(\.music-correction-menu\[open\]\) \.music-editor-layout\{width:100%;min-width:0;max-width:none;transition:none\}/);
  assert.match(css,/@media\(max-width:900px\)\{\.music-editor-chrome\{grid-template-columns:auto minmax\(0,1fr\) auto/);
  assert.match(css,/\.music-midi-editor-page \.music-correction-popover\{position:absolute;top:calc\(100% \+ 8px\);right:0/);
});
test('MIDI input uses one compact selector and the part tabs omit duplicate note counts',async()=>{
  const navigator={userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.6 Safari/605.1.15',vendor:'Apple Computer, Inc.'};
  const{app}=load(navigator),project=app.makeProject({projectId:'midi-status-labels',projectName:'MIDI status labels'});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-editor-menu music-midi-input-menu"><summary aria-label="MIDI入力">MIDI入力<\/summary>/);
  assert.match(html,/class="music-midi-browser-guidance" role="status"><b>SafariではMIDI入力を利用できません<\/b><small>Mac Chromeで開いてください<\/small>/);
  assert.doesNotMatch(html,/select disabled[^>]*aria-label="MIDI Input/);
  assert.match(html,/editorToggleMidiRecording\(\)" disabled aria-disabled="true"/);
  assert.doesNotMatch(html,/MIDI未接続|music-midi-status|MIDI Devices（デバイス一覧）/);
  assert.doesNotMatch(html,/music-midi-rescan|Check Connection（接続確認）/);
  assert.equal((html.match(/editorInitializeMidi\(\)/g)||[]).length,0);
  assert.match(html,/>Melody<\/button>/);assert.match(html,/>Drums<\/button>/);assert.match(html,/>Bass<\/button>/);
  assert.doesNotMatch(html,/>Melody<span>|>Drums<span>|>Bass<span>/);
  assert.doesNotMatch(html,/music-editor-status|Melody · 0ノート · 選択 0 · コピー 0/);
  const workflow=html.match(/<details class="music-editor-menu music-part-workflow music-melody-workflow">([\s\S]*?)<\/details>/)?.[1]||'';
  assert.doesNotMatch(workflow,/editorInitializeMidi|editorStartMidiRecording|editorStopMidiRecording|MIDI Keyboard|MIDI Input|Record（録音）|Stop（停止）/);
  assert.doesNotMatch(html,/Back（戻る）|Next（進む）/);
  for(const label of ['Copy（コピー）','Paste（貼り付け）','Duplicate（複製）','Select All（全選択）','Preview（プレビュー）','Cancel（キャンセル）','Record（録音）','Play（再生）','Stop（停止）'])assert.match(html,new RegExp(label.replace(/[（）]/g,value=>`\\${value}`)));
  const keys={id:'keys',name:'Keystation Mini 32 MK3',onmidimessage:null},pads={id:'pads',name:'MPD218',onmidimessage:null};
  navigator.requestMIDIAccess=async()=>app.state.midiInput.access;
  app.state.midiInput.inputs=[keys,pads];app.state.midiInput.selectedId='keys';app.state.midiInput.access={};app.state.midiInput.recording=true;app.state.midiInput.recorder={recording:false};
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/<summary aria-label="MIDI入力">MIDI入力<\/summary>/);assert.match(html,/value="keys" selected>Keystation Mini 32 MK3/);assert.match(html,/value="pads" >MPD218/);assert.match(html,/value="__rescan__">↻ 再検出/);assert.match(html,/接続状態/);
  assert.match(html,/editorToggleMidiRecording\(\)" aria-disabled="false"/);assert.doesNotMatch(html,/editorToggleMidiRecording\(\)" disabled/);
  await app.editorSelectMidiInput('pads');assert.equal(app.state.midiInput.selectedId,'pads');assert.equal(keys.onmidimessage,null);assert.equal(typeof pads.onmidimessage,'function');
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-midi-editor-page \.music-correction-popover input\[type=radio\]\{appearance:auto;width:18px!important/);
  assert.match(css,/iPad: let the toolbar own its rendered height/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-topbar\{max-height:none;min-height:0;flex:0 0 auto;overflow:visible\}/);
  assert.match(css,/\.music-midi-editor-page \.music-part-tabs\{position:static;top:auto;z-index:auto;box-sizing:border-box;width:100%;min-height:28px;flex:0 0 28px/);
  assert.match(css,/\.music-midi-editor-page \.music-history-controls\{margin-right:0;margin-left:auto\}/);
  assert.match(css,/@media\(min-width:1181px\) and \(hover:hover\) and \(pointer:fine\)\{[\s\S]*?\.music-part-tabs>button,[\s\S]*?\.music-history-controls>button\{height:28px;min-height:28px/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-viewport\{height:clamp\(660px,calc\(100vh - 134px\),796px\)\}/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom section\{padding-top:6px\}/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom h2\{margin-bottom:3px;line-height:1\.1\}/);
  assert.match(css,/html:has\(\.music-midi-editor-page\)[^{]*\{height:100vh;height:100dvh;min-height:0;max-height:100dvh;overflow:hidden\}/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom\{box-sizing:border-box;height:clamp\(180px,30dvh,280px\);max-height:30dvh;[^}]*overflow-y:auto/);
  assert.match(css,/\.music-midi-editor-page \.music-part-workflow-popover\{right:0;left:auto;width:min\(760px,calc\(100vw - 24px\)\);[^}]*overflow-y:auto/);
  assert.match(css,/@media\(min-width:901px\)\{[\s\S]*?\.music-midi-editor-page \.music-editor-bottom\{height:clamp\(340px,43dvh,396px\);max-height:43dvh;[^}]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom>\.music-partial-edit\{grid-column:1\/span 9;grid-row:1\}/);
  assert.match(source,/function alignEditorPitchBottomToC\(viewport\)[\s\S]*?Math\.ceil\(128-\(viewport\.scrollTop\+viewport\.clientHeight-headerHeight\)\/PIANO_ROW_HEIGHT\)[\s\S]*?viewport\.scrollTop=Math\.max\(0,viewport\.scrollTop\+\(bottomPitch-targetC\)\*PIANO_ROW_HEIGHT\)/);
  assert.match(source,/addEventListener\?\.\('resize',\(\)=>\{scheduleNoteLabelLayout\(\);scheduleEditorPianoPosition\(\);root\.requestAnimationFrame\?\.\(\(\)=>alignEditorPitchBottomToC/);
  assert.match(css,/@media\(min-width:1400px\)\{[\s\S]*?\.music-midi-editor-page \.music-editor-bottom\{grid-template-columns:minmax\(250px,1\.25fr\)[^}]*grid-template-rows:max-content/);
  assert.match(css,/@media\(min-width:901px\)\{\.music-midi-editor-page \.music-part-tabs\{box-sizing:border-box;width:100%;flex-wrap:nowrap\}\}/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom h2\{color:var\(--music-violet\)\}/);
  assert.match(css,/\.music-midi-editor-page \.music-partial-edit-provider :is\(textarea\[name="instruction"\],input\[name="model"\],input\[name="apiKey"\]\)\{height:20px;min-height:20px;padding-block:0\}/);
  assert.match(css,/\.music-midi-editor-page \.music-edit-range input\{height:20px;min-height:20px;margin-top:0;padding-block:0\}/);
  assert.match(css,/\.music-partial-edit-summary>div\{padding:0;border:0;border-radius:0;background:transparent;text-align:center;overflow:visible\}/);
  assert.match(source,/music-edit-mode-group[\s\S]*?music-lock-group[\s\S]*?music-clipboard-group[\s\S]*?music-selection-group[\s\S]*?music-note-length-group[\s\S]*?music-velocity-group/);
  assert.match(source,/music-count-in-group[\s\S]*?countInBeatDisplay\(session\)[\s\S]*?music-metronome-group/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom :is\(\.music-edit-tool-group,\.music-assist-block,\.music-assist-card,\.music-edit-range-content,\.music-partial-edit-content,\.music-transport-main,\.music-count-in-group,\.music-metronome-group\)\{gap:3px;margin:0;padding:3px;border-left:2px solid rgba\(139,92,246,\.48\)/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom :is\(\.music-assist-snap,\.music-assist-quantize,\.music-assist-card,\.music-edit-range-content,\.music-partial-edit-content,\.music-count-in-group\)\{padding-right:calc\(3px - \.18rem\);padding-left:calc\(3px \+ \.18rem\)\}/);
  assert.match(source,/music-edit-range-content[\s\S]*?music-edit-range-fields[\s\S]*?Edit Range:/);
  assert.match(source,/music-partial-edit-heading[\s\S]*?music-partial-edit-content[\s\S]*?music-partial-edit-summary/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom>section\{border:0;border-radius:0;outline:0;background:transparent;box-shadow:none\}/);
  assert.doesNotMatch(source,/<span aria-hidden="true">–<\/span>/);
  assert.match(css,/\.music-midi-editor-page \.music-partial-edit-provider\{grid-template-columns:minmax\(110px,\.85fr\) minmax\(190px,1\.55fr\) minmax\(100px,\.8fr\) minmax\(130px,1fr\) minmax\(150px,1\.2fr\) auto/);
});
test('Mac Chrome with Web MIDI renders device selection instead of Safari guidance',()=>{
  const navigator={userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',vendor:'Google Inc.',requestMIDIAccess:async()=>({inputs:new Map()})};
  const{app}=load(navigator),project=app.makeProject({projectId:'chrome-midi',projectName:'Chrome MIDI'});
  app.state.projects=[project];app.state.midiInput.inputs=[{id:'keyboard',name:'MIDI Keyboard'}];app.state.midiInput.selectedId='keyboard';app.state.midiInput.status='1台のMIDI入力を検出しました。';
  const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/aria-label="MIDI機器選択"/);assert.match(html,/>↻ 再検出</);assert.match(html,/接続状態/);
  assert.doesNotMatch(html,/SafariではMIDI入力を利用できません|Mac Chromeで開いてください/);
});
test('MIDI editor auto initializes once after initial render and again in a reloaded runtime',async()=>{
  const exercise=async suffix=>{
    let requests=0;const first={id:'keys',name:'Keystation Mini 32 MK3',onmidimessage:null},second={id:'keys',name:'Keystation Mini 32 MK3',onmidimessage:null},firstAccess={inputs:new Map([['keys',first]]),onstatechange:null},secondAccess={inputs:new Map([['keys',second]]),onstatechange:null},navigator={requestMIDIAccess:async()=>++requests===1?firstAccess:secondAccess},timers=[];
    const{app,window}=load(navigator),project=app.makeProject({projectId:`auto-midi-${suffix}`,projectName:'Auto MIDI'}),route=`music-studio/midi-editor/${project.projectId}`,preview=[];
    window.document={};window.location.hash=`#${route}`;window.setTimeout=callback=>{timers.push(callback);return timers.length};app.state.projects=[project];app.state.melodyAudio.synth={supported:()=>true,unlock:()=>new Promise(()=>{}),noteOn:(pitch,velocity)=>preview.push(['on',pitch,velocity]),noteOff:pitch=>preview.push(['off',pitch])};
    app.renderRoute(route);app.renderRoute(route);assert.equal(timers.length,1);assert.equal(requests,0);timers.shift()();await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
    assert.equal(requests,1);assert.equal(app.state.midiInput.initialized,true);assert.equal(app.state.midiInput.access,firstAccess);assert.equal(app.state.midiInput.inputs.length,1);assert.equal(app.state.midiInput.inputs[0],first);assert.equal(app.state.midiInput.selectedId,'keys');assert.equal(typeof first.onmidimessage,'function');assert.equal(typeof firstAccess.onstatechange,'function');
    first.onmidimessage({data:[0x90,60,101],timeStamp:10});first.onmidimessage({data:[0x80,60,0],timeStamp:20});assert.deepEqual(preview,[['on',60,101],['off',60]]);
    app.editorSelectPart('drums');app.renderRoute(route);app.editorSelectMidiTarget('bass');app.renderRoute(route);assert.equal(requests,1);assert.equal(timers.length,0);
    await app.editorSelectMidiInput('__rescan__');assert.equal(requests,2);assert.equal(first.onmidimessage,null);assert.equal(firstAccess.onstatechange,null);assert.equal(app.state.midiInput.access,secondAccess);assert.equal(app.state.midiInput.selectedId,'keys');assert.equal(typeof second.onmidimessage,'function');assert.equal(typeof secondAccess.onstatechange,'function');
  };
  await exercise('initial');await exercise('reload');
});
test('MIDI editor auto initialization and Record fallback share one access request',async()=>{
  let requests=0;const input={id:'keys',name:'Keystation Mini 32 MK3',onmidimessage:null},access={inputs:new Map([['keys',input]]),onstatechange:null},navigator={requestMIDIAccess:async()=>{requests++;return access}},timers=[];
  const{app,window}=load(navigator),project=app.makeProject({projectId:'auto-midi-record-race',projectName:'Auto MIDI Record'}),route=`music-studio/midi-editor/${project.projectId}`;
  window.document={};window.location.hash=`#${route}`;window.setTimeout=callback=>{timers.push(callback);return timers.length};window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};app.state.projects=[project];app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,allNotesOff(){},stopPreview(){},stopPlayback(){},stopMetronome(){}};
  app.renderRoute(route);assert.equal(timers.length,1);const recording=app.editorStartMidiRecording({skipCountIn:true});timers.shift()();const result=await recording;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(result.ok,true);assert.equal(app.state.midiInput.recording,true);assert.equal(requests,1);await app.editorStopMidiRecording();
});
test('iPad Chrome without Web MIDI receives generic capability guidance',()=>{
  const navigator={userAgent:'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) CriOS/127.0.0.0 Mobile/15E148 Safari/604.1',vendor:'Apple Computer, Inc.'};
  const{app}=load(navigator),project=app.makeProject({projectId:'ipad-chrome-midi',projectName:'iPad Chrome MIDI'});
  app.state.projects=[project];const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/この環境ではWeb MIDI APIを利用できません/);assert.doesNotMatch(html,/SafariではMIDI入力を利用できません/);
});
test('Melody scale guide follows transient Correction settings and stays Melody-only',()=>{
  const{app}=load(),project=app.makeProject({projectId:'scale-guide',projectName:'Scale guide'});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/name="guideEnabled" type="checkbox" checked/);
  assert.match(html,/class="music-scale-guide" data-key="C" data-scale="Major"/);
  const form=(key,scale,guideEnabled=true)=>({elements:{key:{value:key},scale:{value:scale},guideEnabled:{checked:guideEnabled}}});
  app.editorUpdateCorrectionGuide(form('A','Minor'));html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-scale-guide" data-key="A" data-scale="Minor"/);
  app.editorUpdateCorrectionGuide(form('D','Pentatonic'));html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/data-key="D" data-scale="Pentatonic"[^>]*>[\s\S]*?<span data-pitch="62"/);assert.doesNotMatch(html,/music-scale-guide[^>]*>[\s\S]*?<span data-pitch="61"/);
  app.editorUpdateCorrectionGuide(form('D','Chromatic'));html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.doesNotMatch(html,/class="music-scale-guide"/);
  app.editorUpdateCorrectionGuide(form('C','Major',false));html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.doesNotMatch(html,/class="music-scale-guide"/);
  app.editorUpdateCorrectionGuide(form('C','Major',true));html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-scale-guide"/);
  app.editorSelectPart('drums');html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.doesNotMatch(html,/class="music-scale-guide"/);
  app.editorSelectPart('bass');html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.doesNotMatch(html,/class="music-scale-guide"/);
  app.editorSelectPart('melody');html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/data-key="C" data-scale="Major"/);
  assert.equal(Object.hasOwn(app.state.midiEditor.midiData,'correctionSettings'),false);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-scale-guide span\{[^}]*background:rgba\(250,204,21,\.12\)/);
});
test('Melody key transpose UI previews independently and Apply uses existing save history',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'transpose-ui',projectName:'Transpose UI',midiData:{tracks:[{part:'melody',notes:[{id:'note',pitch:60,startTick:120,durationTicks:240,velocity:91}]}]}});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),session=app.state.midiEditor,core=window.MusicStudioEditor;
  assert.match(html,/id="melodyTransposeTitle">キー一括移調/);
  assert.match(html,/name="transposeFromKey"/);assert.match(html,/name="transposeToKey"/);
  assert.match(html,/name="transposeTarget"/);assert.match(html,/name="transposeDirection"/);
  assert.match(html,/C → C：\+0半音/);assert.doesNotMatch(html,/キー一括移調：未実装/);
  const fields={transposeFromKey:{value:'C'},transposeToKey:{value:'D'},transposeMeasureFrom:{value:'1'},transposeMeasureTo:{value:'1'}},radios={transposeTarget:{value:'all'},transposeDirection:{value:'shortest'}};
  const panel={querySelector(selector){const name=selector.match(/name="([^"]+)"/)?.[1];return selector.includes(':checked')?radios[name]:fields[name]}};
  window.document={querySelector:selector=>selector==='#melodyTransposePanel'?panel:null};
  const original=JSON.stringify(core.currentTrack(session).notes),guide=JSON.stringify(session.correctionSettings),result=app.editorPreviewTranspose();
  assert.equal(result.ok,true);assert.equal(JSON.stringify(core.currentTrack(session).notes),original);
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/is-transpose-preview/);assert.match(html,/移調Preview/);assert.match(html,/C → D：\+2半音/);
  app.editorCancelTranspose();assert.equal(JSON.stringify(core.currentTrack(session).notes),original);
  app.editorPreviewTranspose();app.editorApplyTranspose();assert.equal(core.currentTrack(session).notes[0].pitch,62);
  assert.equal(core.currentTrack(session).notes[0].velocity,91);assert.equal(core.currentTrack(session).notes[0].startTick,120);assert.equal(core.currentTrack(session).notes[0].durationTicks,240);
  assert.equal(JSON.stringify(session.correctionSettings),guide);
  app.editorUndo();assert.equal(core.currentTrack(session).notes[0].pitch,60);app.editorRedo();assert.equal(core.currentTrack(session).notes[0].pitch,62);
  app.editorSelectPart('drums');html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.doesNotMatch(html,/melodyTransposeTitle/);
  app.editorSelectPart('bass');html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.doesNotMatch(html,/melodyTransposeTitle/);
});
test('Melody batch note length UI previews only duration and stays hidden for Drums Bass',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'note-length-ui',projectName:'Note length UI',midiData:{ppq:480,tracks:[{part:'melody',notes:[{id:'note',pitch:65,startTick:120,durationTicks:120,velocity:93}]}]}});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),session=app.state.midiEditor,core=window.MusicStudioEditor;
  assert.match(html,/id="melodyNoteLengthTitle">ノート長一括変更/);assert.match(html,/name="noteLengthValue"/);
  assert.match(html,/付点1\/4/);assert.match(html,/三連1\/16/);assert.doesNotMatch(html,/ノート長一括変更：未実装/);
  const fields={noteLengthValue:{value:'dotted-1/4'},noteLengthMeasureFrom:{value:'1'},noteLengthMeasureTo:{value:'1'}},radios={noteLengthTarget:{value:'all'}};
  const panel={querySelector(selector){const name=selector.match(/name="([^"]+)"/)?.[1];return selector.includes(':checked')?radios[name]:fields[name]}};
  window.document={querySelector:selector=>selector==='#melodyNoteLengthPanel'?panel:null};
  const original=JSON.stringify(core.currentTrack(session).notes),result=app.editorPreviewNoteLength();assert.equal(result.ok,true);assert.equal(JSON.stringify(core.currentTrack(session).notes),original);
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/is-note-length-preview/);assert.match(html,/Note Length Preview/);
  app.editorCancelNoteLength();assert.equal(JSON.stringify(core.currentTrack(session).notes),original);
  app.editorPreviewNoteLength();app.editorApplyNoteLength();const note=core.currentTrack(session).notes[0];assert.deepEqual([note.pitch,note.startTick,note.durationTicks,note.velocity],[65,120,720,93]);
  app.editorUndo();assert.equal(core.currentTrack(session).notes[0].durationTicks,120);app.editorRedo();assert.equal(core.currentTrack(session).notes[0].durationTicks,720);
  app.editorSelectPart('drums');html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.doesNotMatch(html,/melodyNoteLengthTitle/);
  app.editorSelectPart('bass');html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.doesNotMatch(html,/melodyNoteLengthTitle/);
});
test('Piano Roll includes a compact pointer-independent operation guide and visible resize handle',()=>{
  const{app}=load(),project=app.makeProject({projectId:'operation-guide',projectName:'Operation guide'});
  app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);app.editorAddNote();
  const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-editor-popover music-shortcuts-popover"/);assert.match(html,/<h3>基本操作<\/h3>/);assert.match(html,/<dt>Space<\/dt><dd>再生／停止<\/dd>/);assert.match(html,/<dt>Enter／Return<\/dt><dd>Go to Start（先頭へ戻る）<\/dd>/);assert.equal((html.match(/<dt>Enter／Return<\/dt>/g)||[]).length,1);
  assert.match(html,/<h3>編集<\/h3>/);assert.match(html,/<dt>⌘C<\/dt><dd>Copy（コピー）<\/dd>/);assert.match(html,/<h3>ノート操作<\/h3>/);
  assert.match(html,/<dt>ドラッグ<\/dt><dd>移動／右端で長さ変更<\/dd>/);assert.match(html,/<dt>音名をタップ<\/dt><dd>その音を試聴<\/dd>/);assert.match(html,/<h3>Mac<\/h3>/);assert.match(html,/<h3>iPad<\/h3>/);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-shortcuts-popover\{display:grid;width:min\(560px,calc\(100vw - 40px\)\);max-height:calc\(100vh - 110px\)/);assert.match(css,/\.music-shortcuts-popover dl>div\{display:grid;grid-template-columns:150px minmax\(0,1fr\)/);
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
  assert.match(html,/C4 \/ ド　V30/);assert.match(html,/data-pitch="60"[^>]*onpointerdown="event\.preventDefault\(\);MusicStudio\.editorPreviewPitchFromKey\(event\)"/);
  assert.match(html,/onclick="if\(event\.detail===0\)MusicStudio\.editorPreviewPitchFromKey\(event\)"/);
  assert.doesNotMatch(html,/musicPitchDiagnostic|musicNotePreviewDiagnostic|一時診断/);
  assert.match(html,/長さを揃える/);assert.match(html,/Velocityを揃える/);
  assert.match(html,/<summary title="Shortcuts（ショートカット）" aria-label="Shortcuts（ショートカット）">Shortcuts（ショートカット）<\/summary>/);assert.match(html,/画面ボタンだけでもすべて操作できます/);
  let finishUnlock,scheduledStop=null;const pitchEvents=[];window.setTimeout=callback=>{scheduledStop=callback;return 9};window.clearTimeout=()=>{};
  app.state.melodyAudio.synth={supported:()=>true,unlock:()=>new Promise(resolve=>{finishUnlock=resolve}),noteOn:(...args)=>{pitchEvents.push(['on',...args]);return true},noteOff:(...args)=>{pitchEvents.push(['off',...args]);return true}};
  const previewPromise=app.editorPreviewPitch(60);
  assert.equal(JSON.stringify(pitchEvents),'[]');
  finishUnlock(true);assert.equal(await previewPromise,true);
  assert.equal(JSON.stringify(pitchEvents),'[["off",60,"piano-roll-preview"],["on",60,100,"piano-roll-preview"]]');
  scheduledStop();assert.equal(JSON.stringify(pitchEvents.at(-1)),'["off",60,"piano-roll-preview"]');
  const keyPreview=app.editorPreviewPitchFromKey({currentTarget:{dataset:{pitch:'61'}}});finishUnlock(true);assert.equal(await keyPreview,true);assert.equal(pitchEvents.at(-2)[1],61);
  app.editorMatchDuration();app.editorMatchVelocity(111);
  assert.equal(JSON.stringify(core.selectedNotes(app.state.midiEditor).map(note=>[note.durationTicks,note.velocity])),'[[360,111],[360,111]]');
  app.editorUndo();app.editorUndo();
  assert.equal(JSON.stringify(core.selectedNotes(app.state.midiEditor).map(note=>[note.durationTicks,note.velocity])),'[[120,30],[360,120]]');
});
test('Piano Roll and Drum Pad previews select sounds by active track while Melody keeps noteOn preview',async()=>{
  const{app}=load(),project=app.makeProject({projectId:'part-preview-sounds',projectName:'Part preview sounds'});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);const events=[];app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,previewTrackNote(...args){events.push(['track',...args]);return true},noteOff(...args){events.push(['off',...args]);return true},noteOn(...args){events.push(['on',...args]);return true}};
  app.editorSelectPart('drums');app.editorDrumInput(38);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(events[0],['track','drums',38,100,.35]);assert.equal(app.state.midiEditor.midiData.tracks.find(track=>track.part==='drums').notes.at(-1).pitch,38);
  app.editorSelectPart('bass');assert.equal(await app.editorPreviewPitch(36,84),true);assert.deepEqual(events.at(-1),['track','bass',36,84,.35]);
  app.editorSelectPart('melody');assert.equal(await app.editorPreviewPitch(60,77),true);assert.equal(events.at(-1)[0],'on');assert.equal(events.at(-1)[1],60);assert.equal(events.at(-1)[2],77);
});
test('track switching clears Melody timers and stops only active preview voices on repeated switches',async()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'part-preview-cleanup',projectName:'Part preview cleanup'});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);let timerId=0;const timers=new Map(),events=[];window.setTimeout=callback=>{const id=++timerId;timers.set(id,callback);return id};window.clearTimeout=id=>timers.delete(id);app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,previewTrackNote(part,pitch){events.push(['track',part,pitch]);return true},noteOn(pitch){events.push(['on',pitch]);return true},noteOff(pitch,channel){events.push(['off',pitch,channel]);return true},stopPreview(){events.push(['stop-preview'])}};
  await app.editorPreviewPitch(60,88);assert.equal(timers.size,1);app.editorSelectPart('drums');assert.equal(timers.size,0);assert.deepEqual(events.slice(-2),[['off',60,'piano-roll-preview'],['stop-preview']]);
  await app.editorPreviewPitch(46,100);app.editorSelectPart('bass');await app.editorPreviewPitch(36,90);app.editorSelectPart('melody');app.editorSelectPart('drums');assert.equal(events.filter(item=>item[0]==='stop-preview').length,4);assert.equal(timers.size,0);
});
test('Piano Roll note labels show English pitch fixed-do solfege and velocity by rendered width',()=>{
  const{app,window}=load(),notes=[
    {id:'c3',pitch:48,startTick:0,durationTicks:120,velocity:48},{id:'c4',pitch:60,startTick:120,durationTicks:240,velocity:82},{id:'sharp',pitch:61,startTick:360,durationTicks:480,velocity:95},
    ...[[62,'d4'],[64,'e4'],[65,'f4'],[67,'g4'],[69,'a4'],[71,'b4'],[72,'c5']].map(([pitch,id],index)=>({id,pitch,startTick:960+index*240,durationTicks:240,velocity:70+index}))
  ],project=app.makeProject({projectId:'note-labels',projectName:'Note labels',midiData:{tracks:[{part:'melody',notes}]}});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),session=app.state.midiEditor,core=window.MusicStudioEditor;
  for(const [id,label] of [['c3','C3 / ド　V48'],['c4','C4 / ド　V82'],['sharp','C♯4 / ド♯　V95'],['d4','D4 / レ　V70'],['e4','E4 / ミ　V71'],['f4','F4 / ファ　V72'],['g4','G4 / ソ　V73'],['a4','A4 / ラ　V74'],['b4','B4 / シ　V75'],['c5','C5 / ド　V76']])assert.match(html,new RegExp(`data-note-id="${id}"[\\s\\S]*?music-note-label-full">${label}<`));
  assert.match(html,/music-note-label-short">C♯4<\/span><span class="music-note-label-medium">C♯4 \/ ド♯<\/span>/);
  const original=JSON.stringify(core.currentTrack(session).notes.map(note=>[note.id,note.pitch,note.velocity,note.durationTicks,note.startTick]));
  for(const zoom of [1,3,10,30]){session.view.zoom=zoom;html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,new RegExp(`music-piano-content" style="width:${zoom*100}%"`));assert.equal(JSON.stringify(core.currentTrack(session).notes.map(note=>[note.id,note.pitch,note.velocity,note.durationTicks,note.startTick])),original)}
  core.selectNote(session,'c4');app.editorMoveSelected(0,2);html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/data-note-id="c4"[\s\S]*?music-note-label-full">D4 \/ レ　V82</);
  app.editorUndo();html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/data-note-id="c4"[\s\S]*?music-note-label-full">C4 \/ ド　V82</);
  app.editorRedo();html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/data-note-id="c4"[\s\S]*?music-note-label-full">D4 \/ レ　V82</);
  core.selectNote(session,'d4');core.selectNote(session,'e4',{additive:true});app.editorMatchVelocity(99);html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.equal((html.match(/music-note-label-full">(?:D4 \/ レ|E4 \/ ミ)　V99</g)||[]).length,2);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(html,/data-note-id="d4"[\s\S]*?<span class="music-note-label" aria-hidden="true">[\s\S]*?D4 \/ レ　V99[\s\S]*?<span class="music-note-resize"/);
  const makeNote=(width,textWidths={short:16,medium:55,full:90})=>{const classes=new Set,label={querySelector:selector=>{const name=selector.match(/music-note-label-(short|medium|full)/)?.[1];return name?{scrollWidth:textWidths[name]}:null}};return{dataset:{},getBoundingClientRect:()=>({width}),querySelector:selector=>selector==='.music-note-label'?label:null,classList:{toggle(name,enabled){if(enabled)classes.add(name);else classes.delete(name)},contains:name=>classes.has(name)},classes}};
  const renderedNotes=[makeNote(10),makeNote(20),makeNote(30),makeNote(10,{short:25,medium:64,full:104}),makeNote(79),makeNote(114)];assert.equal(app.updateNoteLabelLayout({querySelectorAll:()=>renderedNotes}),6);
  for(const [index,mode] of ['short','short','short','short','medium','full'].entries()){assert.equal(renderedNotes[index].dataset.noteLabelMode,mode);assert.equal(renderedNotes[index].classes.has(`note-label-is-${mode}`),true);assert.equal([...renderedNotes[index].classes].filter(name=>name.startsWith('note-label-is-')).length,1)}
  assert.equal(app.noteLabelMode(10,{short:16,medium:55,full:90}),'short');assert.equal(app.noteLabelMode(10,{short:25,medium:64,full:104}),'short');assert.equal(app.noteLabelMode(30,{short:25,medium:64,full:104}),'short');
  assert.deepEqual([10,20,30,79,114].map(width=>app.noteLabelMode(width,{short:16,medium:55,full:90})),['short','short','short','medium','full']);
  let zoomWidth=10;const zoomNote=makeNote(zoomWidth);zoomNote.getBoundingClientRect=()=>({width:zoomWidth});const zoomModes=[];for(zoomWidth of[10,20,30,79,114,79,30,10])zoomModes.push(app.updateNoteLabelElement(zoomNote));assert.deepEqual(zoomModes,['short','short','short','medium','full','medium','short','short']);
  app.editorClearSelection();core.selectNote(session,'sharp');html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/class="music-midi-note[^\"]*is-selected[^\"]*" data-note-id="sharp"[\s\S]*?music-note-label-short">C♯4</);assert.equal((html.match(/data-note-id="sharp"[\s\S]*?<span class="music-note-label"/g)||[]).length,1);
  app.editorClearSelection();core.selectNote(session,'d4');core.selectNote(session,'e4',{additive:true});html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.equal((html.match(/class="music-midi-note[^\"]*is-selected/g)||[]).length,2);app.editorClearSelection();assert.equal(Array.from(core.selectedIds(session)).length,0);
  assert.match(css,/\.music-midi-editor-page \.music-piano-roll \.music-note-label\{[^}]*right:18px;[^}]*overflow:hidden;[^}]*pointer-events:none;white-space:nowrap/);
  assert.match(css,/\.music-note-label,\.music-midi-editor-page \.music-midi-note\.is-selected \.music-note-label\{font-weight:650;opacity:1;filter:none;transform:none\}/);
  assert.match(css,/\.music-note-label>span\{position:absolute;visibility:hidden;display:block;[^}]*max-width:100%;overflow:hidden/);
  assert.match(css,/\.note-label-is-short \.music-note-label-short\{visibility:visible;[^}]*max-width:none;overflow:visible;text-shadow:none\}/);
  assert.match(css,/\.note-label-is-short \.music-note-label\{right:0;left:1px;z-index:3;overflow:visible;font-size:\.68rem/);
  assert.match(css,/\.note-label-is-short \.music-note-resize\{width:6px;[^}]*background:rgba\(255,255,255,\.12\)/);
  assert.match(css,/\.note-label-is-medium \.music-note-label-medium\{visibility:visible\}/);
  assert.match(css,/\.note-label-is-full \.music-note-label-full\{visibility:visible\}/);
  assert.doesNotMatch(css,/@container music-note|\.music-midi-editor-page \.music-midi-note\{[^}]*container-type/);
});
test('Piano Roll selection highlights unique pitch rows and matching keys across click touch and edits',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'pitch-selection',projectName:'Pitch selection'});
  app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const core=window.MusicStudioEditor,session=app.state.midiEditor;
  core.addNotes(session,[
    {id:'a',pitch:60,startTick:0,durationTicks:120,velocity:80},
    {id:'same-pitch',pitch:60,startTick:240,durationTicks:120,velocity:90},
    {id:'b',pitch:64,startTick:480,durationTicks:120,velocity:100}
  ]);
  const roll={dataset:{totalTicks:'7680',pitchMin:'0',pitchMax:'127'},getBoundingClientRect:()=>({left:0,width:800,height:3072}),querySelectorAll:()=>[]};
  const target={style:{},closest:selector=>selector==='.music-piano-roll'?roll:null,setPointerCapture(){}};
  const tap=(id,pointerType='mouse',extra={})=>{app.editorStartNoteDrag({button:0,pointerType,currentTarget:target,clientX:100,clientY:100,pointerId:1,preventDefault(){},...extra},id);target.onpointerup()};
  const pitchRows=()=>{const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),layer=html.match(/class="music-selected-pitch-layer"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';return{html,pitches:[...layer.matchAll(/data-pitch="(\d+)"/g)].map(match=>Number(match[1]))}};

  tap('a');let view=pitchRows();assert.deepEqual(view.pitches,[60]);assert.match(view.html,/music-piano-key is-white is-selected-pitch" data-pitch="60"/);
  tap('b');view=pitchRows();assert.deepEqual(Array.from(core.selectedIds(session)),['b']);assert.deepEqual(view.pitches,[64]);assert.doesNotMatch(view.html,/is-selected-pitch" data-pitch="60"/);
  tap('same-pitch','touch');assert.deepEqual(Array.from(core.selectedIds(session)),['same-pitch']);assert.deepEqual(pitchRows().pitches,[60]);

  core.selectNote(session,'a',{additive:true});core.selectNote(session,'b',{additive:true});view=pitchRows();assert.deepEqual(view.pitches,[64,60]);
  core.selectAllNotes(session);assert.deepEqual(pitchRows().pitches,[64,60]);
  core.moveSelected(session,0,1);assert.deepEqual(pitchRows().pitches,[65,61]);
  core.undo(session);assert.deepEqual(pitchRows().pitches,[64,60]);core.redo(session);assert.deepEqual(pitchRows().pitches,[65,61]);
  core.quantizeSelectedStarts(session,'1/16');assert.deepEqual(pitchRows().pitches,[65,61]);
  core.copy(session);core.paste(session,960);assert.deepEqual(pitchRows().pitches,[65,61]);core.duplicateSelected(session);assert.deepEqual(pitchRows().pitches,[65,61]);
  core.deleteSelected(session);assert.deepEqual(pitchRows().pitches,[]);core.undo(session);assert.deepEqual(pitchRows().pitches,[65,61]);
  core.clearNoteSelection(session);view=pitchRows();assert.deepEqual(view.pitches,[]);assert.doesNotMatch(view.html,/is-selected-pitch" data-pitch=/);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');assert.match(css,/\.music-selected-pitch-layer\{position:absolute;z-index:0;inset:0;pointer-events:none\}/);assert.match(css,/\.music-piano-key\.is-selected-pitch\.is-white/);assert.match(css,/\.music-piano-key\.is-selected-pitch\.is-black/);
});
test('note drag immediately selects its target and previews destination pitch rows and keys with cancel restore',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'drag-pitch-selection',projectName:'Drag pitch selection'});
  app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const core=window.MusicStudioEditor,session=app.state.midiEditor;core.addNotes(session,[
    {id:'a',pitch:60,startTick:0,durationTicks:120,velocity:80},
    {id:'b',pitch:64,startTick:480,durationTicks:120,velocity:100}
  ]);core.selectNote(session,'a');
  const classList=(...initial)=>{const values=new Set(initial);return{toggle(name,on){on?values.add(name):values.delete(name)},contains:name=>values.has(name)}};
  const noteA={dataset:{noteId:'a'},style:{},classList:classList('music-midi-note','is-selected'),setAttribute(){}};
  const noteB={dataset:{noteId:'b'},style:{},classList:classList('music-midi-note'),setAttribute(){},setPointerCapture(){}};
  const keys=[60,63,64,66].map(pitch=>({dataset:{pitch:String(pitch)},classList:classList('music-piano-key')})),layer={innerHTML:''};
  const roll={dataset:{totalTicks:'7680',pitchMin:'0',pitchMax:'127'},getBoundingClientRect:()=>({left:0,width:800,height:3072}),querySelectorAll:selector=>selector==='.music-midi-note.is-selected'?[noteA,noteB].filter(note=>note.classList.contains('is-selected')):[]};
  noteB.closest=selector=>selector==='.music-piano-roll'?roll:null;
  window.document={querySelector:selector=>selector==='.music-selected-pitch-layer'?layer:null,querySelectorAll:selector=>selector==='.music-midi-note'?[noteA,noteB]:selector==='.music-piano-key[data-pitch]'?keys:[]};
  const pointer=(extra={})=>({button:0,pointerType:'mouse',pointerId:1,currentTarget:noteB,clientX:100…31743 tokens truncated…oom,2);assert.equal(app.state.midiEditor.view.pitchMin,37);assert.equal(app.state.midiEditor.view.pitchMax,85);assert.equal(app.state.midiEditor.view.pitchScrollTop,864);assert.equal(app.state.midiEditor.view.pitchScrollLeft,432);
  assert.match(html,/時間軸 Zoom：2x/);assert.match(html,/data-initial-scroll-top="864" data-initial-scroll-left="432"/);
  assert.equal(app.state.midiEditor.playheadTick,0);assert.equal(app.state.midiEditor.selectedNoteId,null);assert.equal(app.state.midiEditor.clipboard.length,0);assert.equal(app.state.midiEditor.correctionPreview,null);
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
  assert.match(html,/＋ Add Measure（小節を追加）/);
  const beforeNotes=app.state.midiEditor.midiData.tracks.reduce((count,track)=>count+track.notes.length,0);
  app.editorAddMeasures();await app.state.midiEditorSavePromise;
  const stored=await repo.get(project.projectId);
  assert.equal(stored.midiData.editor.measureCount,8);
  assert.equal(stored.midiData.tracks.reduce((count,track)=>count+track.notes.length,0),beforeNotes);
  app.state.midiEditor=null;app.state.projects=[stored];
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/曲の長さ：8小節/);
  assert.match(html,/Bar 8/);
  assert.equal(app.midiExportInput(stored,'all').tracks.reduce((count,track)=>count+track.notes.length,0),beforeNotes);
});
test('navigation blocks an unsaved MIDI editor without discarding notes',()=>{
  const{app,values,window}=load(),project=app.makeProject({projectId:'dirty-project',projectName:'Dirty'});app.state.projects=[project];values.set(app.LAST_PROJECT_KEY,project.projectId);
  app.renderRoute(`music-studio/midi-editor/${project.projectId}`);app.editorAddNote();const before=JSON.stringify(app.state.midiEditor.midiData),hash=window.location.hash;
  assert.equal(app.openLogicPro(project.projectId),false);assert.equal(window.location.hash,hash);assert.equal(JSON.stringify(app.state.midiEditor.midiData),before);assert.match(app.state.notice,/保存してから移動/);
});
test('stopping a MIDI recording persists its Melody notes through the existing project repository',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'recorded-project',projectName:'Recorded'});
  app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  window.performance={now:()=>1750};app.state.midiEditor.playheadTick=960;Object.assign(app.state.midiInput,{recording:true,recordingStartedAt:1000,recordingStartTick:960,recorder:{stop:time=>{assert.equal(time,1750);return[{id:'recorded-note',pitch:64,startTick:120,durationTicks:360,velocity:91,channel:1}]}}});
  const result=await app.editorStopTransport(),stored=await repo.get(project.projectId),melody=stored.midiData.tracks.find(track=>track.part==='melody');
  assert.equal(result.ok,true);assert.equal(melody.notes.length,1);assert.equal(melody.notes[0].pitch,64);assert.equal(melody.notes[0].startTick,1080);assert.equal(melody.notes[0].durationTicks,360);assert.equal(Math.round(app.state.midiEditor.playheadTick),1680);assert.equal(app.state.midiEditor.dirty,false);assert.match(app.state.midiInput.status,/保存しました/);
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
  assert.match(app.renderRoute(`music-studio/midi-editor/${project.projectId}`),/>Saved（保存済み）<\/button>/);
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
test('Drums Piano Roll and pads identify GM notes without exposing Melody-only correction',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'drum-labels',projectName:'Drum labels'});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);app.editorSelectPart('drums');
  let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/<details class="music-editor-menu music-part-workflow music-drums-workflow"><summary><b>Drum Pad・パターン候補<\/b><span>GM Note 36 \/ 38 \/ 42 \/ 46<\/span><\/summary>/);
  for(const [pitch,name] of [[35,'Acoustic Bass Drum'],[36,'Kick'],[37,'Side Stick'],[38,'Snare'],[39,'Hand Clap'],[40,'Electric Snare'],[41,'Low Floor Tom'],[42,'Closed Hi-Hat'],[43,'High Floor Tom'],[44,'Pedal Hi-Hat'],[45,'Low Tom'],[46,'Open Hi-Hat'],[47,'Low-Mid Tom'],[48,'Hi-Mid Tom'],[49,'Crash Cymbal 1'],[50,'High Tom'],[51,'Ride Cymbal 1']])assert.match(html,new RegExp(`music-drum-name">${name}<\\/span><span class="music-drum-number">${pitch}`));
  for(const [pitch,name] of [[52,'Chinese Cymbal'],[53,'Ride Bell'],[54,'Tambourine'],[55,'Splash Cymbal'],[56,'Cowbell'],[57,'Crash Cymbal 2'],[58,'Vibraslap'],[59,'Ride Cymbal 2']]){assert.equal(app.drumNoteName(pitch),name);assert.match(html,new RegExp(`music-drum-name">${name}<\\/span><span class="music-drum-number">${pitch}`))}
  assert.equal(app.drumNoteName(36),'Kick');assert.equal(app.drumNoteName(38),'Snare');assert.equal(app.drumNoteName(42),'Closed Hi-Hat');assert.equal(app.drumNoteName(46),'Open Hi-Hat');assert.equal(app.drumNoteName(61),'Note 61');assert.match(html,/music-drum-name">Note 61<\/span><span class="music-drum-number">61/);
  for(const [pitch,name] of [[36,'Kick'],[38,'Snare'],[42,'Closed Hi-Hat'],[46,'Open Hi-Hat']]){assert.match(html,new RegExp(`editorDrumInput\\(${pitch}\\).*${name}|${name}[\\s\\S]*editorDrumInput\\(${pitch}\\)`));app.editorDrumInput(pitch)}
  const core=window.MusicStudioEditor,drums=core.currentTrack(app.state.midiEditor);assert.deepEqual(Array.from(drums.notes,note=>note.pitch),[36,38,42,46]);assert.ok(drums.notes.every(note=>note.velocity===100));assert.equal(drums.channel,10);assert.equal(drums.program,null);
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);for(const [pitch,name] of [[36,'Kick'],[38,'Snare'],[42,'Closed Hi-Hat'],[46,'Open Hi-Hat']])assert.match(html,new RegExp(`${name} · Note ${pitch}`));
  app.editorDrumInput(61);const unknown=core.currentTrack(app.state.midiEditor).notes.at(-1);assert.equal(unknown.pitch,61);assert.doesNotMatch(JSON.stringify(unknown),/Note 61|drumName|drumLabel/);html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/Note 61　V100/);
  const exported=app.midiExportInput({...project,midiData:app.state.midiEditor.midiData},'drums');assert.ok(exported.tracks[0].notes.some(note=>note.pitch===61));assert.doesNotMatch(JSON.stringify(exported),/Kick|Snare|Hi-Hat|drumName|drumLabel/);
  app.state.midiInput.recording=true;app.state.midiInput.recordingPart='drums';app.state.midiInput.liveNotes=[{id:'recording-tambourine',pitch:54,startTick:0,durationTicks:120,velocity:99,active:true}];html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/recording-tambourine[\s\S]*Tambourine · Note 54/);app.state.midiInput.recording=false;app.state.midiInput.recordingPart=null;app.state.midiInput.liveNotes=[];
  assert.doesNotMatch(html,/Melody Correction（メロディ補正）|melodyTransposePanel|melodyNoteLengthPanel/);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');assert.match(css,/\.music-midi-editor-page \.music-drum-pads>button\{height:auto;min-height:44px/);
  app.editorSelectPart('melody');html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.doesNotMatch(html,/music-drum-pitch-name|music-drum-number/);assert.match(html,/Melody Correction（メロディ補正）/);
});
test('Bass Piano Roll identifies track range pitch and program without leaking to Melody or Drums',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'bass-clarity',projectName:'Bass clarity'});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);app.editorSelectPart('bass');let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-bass-track-status" role="status">Bass Track · Channel 2 · GM Program 32 · Guide E1–G3（Note 28–55）/);assert.match(html,/class="music-bass-range-guide"[^>]*--bass-guide-top:[^;]+;--bass-guide-height:[^;]+/);assert.match(html,/Bass guide E1–G3 · Note 28–55/);
  assert.match(html,/<details class="music-editor-menu music-part-workflow music-bass-workflow"><summary><b>Bass候補・参照情報<\/b><span>Channel 2 · GM Program 32<\/span><\/summary>/);assert.doesNotMatch(html,/Melody Correction（メロディ補正）|melodyTransposePanel|melodyNoteLengthPanel/);
  const session=app.state.midiEditor,core=window.MusicStudioEditor;session.playheadTick=137;app.editorAddNote();const note=core.selectedNotes(session)[0];assert.deepEqual([note.pitch,note.startTick,note.durationTicks,note.velocity],[36,137,120,100]);assert.equal(core.currentTrack(session).channel,2);assert.equal(core.currentTrack(session).program,32);
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/C2 · Note 36　V100/);assert.match(html,/C2 \/ Velocity 100 \/ Note 36 \/ 137 tick/);
  for(const part of ['melody','drums']){app.editorSelectPart(part);html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.doesNotMatch(html,/music-bass-track-status|music-bass-range-guide|music-bass-workflow|Bass guide E1–G3/)}
  app.editorSelectPart('melody');html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/Melody Correction（メロディ補正）/);
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
test('new MIDI import creates a new editable Version 1 project and metadata-only history',async()=>{const {app,window}=load(),repo=app.memoryRepository();app.setRepository(repo);const bytes=window.MusicStudioMidi.createMidiFile(window.MusicStudioMidi.createTestMidiData()).bytes;await app.inspectMidiFile(file('Logic Song.mid',bytes,'audio/midi'));const result=await app.saveMidiImport('new'),stored=await repo.get(result.project.projectId),history=await repo.listMidiImportHistory();assert.equal(result.ok,true);assert.equal(stored.schemaVersion,'1.0');assert.equal(stored.projectName,'Logic Song');assert.equal(stored.musicalSettings.bpm,120);assert.equal(stored.midiData.tempo,120);assert.equal(stored.midiData.tempoMap[0].bpm,120);assert.equal(stored.midiData.tracks.reduce((n,t)=>n+t.notes.length,0),10);assert.equal(window.location.hash.includes('music-studio/midi-editor/'),true);assert.equal(history.length,1);assert.equal(JSON.stringify(history).includes('bytes'),false);assert.equal(JSON.stringify(stored).includes('/Users/'),false)});
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
test('All MIDI keeps the complete three-track Logic contract at shared ticks and boundaries',()=>{const{app,window}=load(),project=app.makeProject({projectName:'Logic Contract',midiData:{version:1,ppq:960,tempo:137,timeSignature:{numerator:7,denominator:8},totalTick:960000,tracks:[
  {id:'melody',part:'melody',name:'Melody',channel:1,program:0,notes:[{id:'m0',pitch:0,startTick:0,durationTicks:960,velocity:1},{id:'m1',pitch:127,startTick:960,durationTicks:959040,velocity:127}]},
  {id:'drums',part:'drums',name:'Drums',channel:10,program:null,notes:[36,38,42,46].map((pitch,index)=>({id:`d${pitch}`,pitch,startTick:index?960:0,durationTicks:120,velocity:100+index}))},
  {id:'bass',part:'bass',name:'Bass',channel:2,program:32,notes:[{id:'b0',pitch:24,startTick:0,durationTicks:960,velocity:64},{id:'b1',pitch:84,startTick:960,durationTicks:1920,velocity:96}]}
]}}),summary=app.midiExportSummary(project,'all'),made=window.MusicStudioMidi.createMidiFile(summary.input),parsed=window.MusicStudioMidiParser.parseMidiFile(made.bytes),converted=window.MusicStudioMidiParser.convertParsedMidiToProjectData(parsed),tracks=Object.fromEntries(converted.tracks.filter(track=>track.part).map(track=>[track.part,track]));
  assert.equal(made.inspection.type,1);assert.equal(made.inspection.trackCount,4);assert.equal(parsed.normalized.ppq,960);assert.ok(Math.abs(parsed.normalized.tempo-137)<.001);assert.deepEqual([parsed.normalized.timeSignature.numerator,parsed.normalized.timeSignature.denominator],[7,8]);assert.equal(converted.importSource.trackAssignments.map(item=>item.part).join(','),'melody,drums,bass');assert.deepEqual([tracks.melody.name,tracks.melody.channel,tracks.melody.program],['Melody',1,0]);assert.deepEqual([tracks.drums.name,tracks.drums.channel,tracks.drums.program],['Drums',10,null]);assert.equal(tracks.drums.programChanges.length,0);assert.equal(tracks.drums.notes.map(note=>note.pitch).join(','),'36,38,42,46');assert.deepEqual([tracks.bass.name,tracks.bass.channel,tracks.bass.program],['Bass',2,32]);for(const part of ['melody','drums','bass'])assert.equal(JSON.stringify(tracks[part].notes.map(note=>[note.pitch,note.startTick,note.durationTicks,note.velocity])),JSON.stringify(summary.input.tracks.find(track=>track.part===part).notes.map(note=>[note.pitch,note.startTick,note.durationTicks,note.velocity])));
});
test('MIDI Import three-track inference is independent from runtime Input Assignment',()=>{
  const{app,window}=load(),project=app.makeProject({projectName:'Assignment Independent Import',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[{id:'melody',part:'melody',name:'Melody',channel:1,program:0,notes:[{id:'m',pitch:64,startTick:0,durationTicks:480,velocity:91}]},{id:'drums',part:'drums',name:'Drums',channel:10,program:null,notes:[{id:'d',pitch:38,startTick:240,durationTicks:120,velocity:112}]},{id:'bass',part:'bass',name:'Bass',channel:2,program:32,notes:[{id:'b',pitch:40,startTick:480,durationTicks:960,velocity:83}]}]}}),bytes=window.MusicStudioMidi.createMidiFile(app.midiExportInput(project,'all')).bytes;
  for(const targetPart of ['melody','drums','bass']){app.state.midiInput.targetPart=targetPart;const converted=window.MusicStudioMidiParser.convertParsedMidiToProjectData(window.MusicStudioMidiParser.parseMidiFile(bytes)),tracks=Object.fromEntries(converted.tracks.filter(track=>track.part).map(track=>[track.part,track]));assert.equal(converted.importSource.trackAssignments.map(item=>item.part).join(','),'melody,drums,bass');assert.deepEqual([tracks.melody.channel,tracks.drums.channel,tracks.bass.channel],[1,10,2]);assert.deepEqual([tracks.melody.notes[0].pitch,tracks.drums.notes[0].pitch,tracks.bass.notes[0].pitch],[64,38,40]);assert.equal(app.state.midiInput.targetPart,targetPart)}
});
test('All MIDI export preserves external unassigned tracks without promoting their roles',()=>{const{app,window}=load(),project=app.makeProject({projectName:'External Tracks',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[
  {id:'melody',part:'melody',name:'Melody',channel:1,program:0,notes:[]},
  {id:'drums',part:'drums',name:'Drums',channel:10,program:null,notes:[]},
  {id:'bass',part:'bass',name:'Bass',channel:2,program:32,notes:[]},
  {id:'midi-track-2',roleAssignment:'unassigned',name:'AI Vocal',channel:1,program:53,notes:[{id:'v1',pitch:67,startTick:0,durationTicks:480,velocity:91}]},
  {id:'midi-track-3',roleAssignment:'unassigned',name:'AI Strings',channel:3,program:48,notes:[{id:'s1',pitch:72,startTick:0,durationTicks:960,velocity:82}]}
]}}),all=app.midiExportInput(project,'all'),melody=app.midiExportInput(project,'melody'),made=window.MusicStudioMidi.createMidiFile(all),parsed=window.MusicStudioMidiParser.parseMidiFile(made.bytes).normalized;
  assert.deepEqual(Array.from(all.tracks.filter(track=>track.roleAssignment==='unassigned'),track=>track.id),['midi-track-2','midi-track-3']);assert.equal(melody.tracks.some(track=>track.roleAssignment==='unassigned'),false);assert.deepEqual(Array.from(parsed.tracks.filter(track=>track.noteCount),track=>track.name),['AI Vocal','AI Strings']);
});

test('MIDI export keeps the existing empty-track policy',()=>{const{app,window}=load(),project=app.makeProject({projectName:'Empty Track Policy',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[
  {id:'melody',part:'melody',name:'Melody',channel:1,program:0,notes:[{id:'m',pitch:60,startTick:0,durationTicks:480,velocity:90}]},
  {id:'drums',part:'drums',name:'Drums',channel:10,program:null,notes:[]},{id:'bass',part:'bass',name:'Bass',channel:2,program:32,notes:[]}
]}}),all=app.midiExportSummary(project,'all'),made=window.MusicStudioMidi.createMidiFile(all.input);
  assert.equal(all.validation.ok,true);assert.equal(all.validation.data.tracks.length,3);assert.equal(all.validation.trackCount,1);assert.equal(made.inspection.trackCount,2);assert.equal(app.midiExportSummary(project,'drums').validation.ok,false);assert.equal(app.midiExportSummary(project,'bass').validation.ok,false);
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

test('Overdub preserves locked and unlocked existing notes while recording an unlocked note',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),existingLocked={id:'locked-existing',pitch:60,startTick:0,durationTicks:480,velocity:72,locked:true,meta:'keep'},existingOpen={id:'open-existing',pitch:64,startTick:480,durationTicks:240,velocity:74},project=app.makeProject({projectId:'locked-overdub',projectName:'Locked overdub',midiData:{tracks:[{part:'melody',notes:[existingLocked,existingOpen]}]}});app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);app.state.midiInput.recording=true;app.state.midiInput.recordingPart='melody';app.state.midiInput.recorder={stop:()=>[{id:'recorded-c',pitch:67,startTick:720,durationTicks:240,velocity:101,channel:1}]};const result=await app.editorStopMidiRecording(),notes=window.MusicStudioEditor.currentTrack(app.state.midiEditor).notes;assert.equal(result.ok,true);assert.deepEqual(JSON.parse(JSON.stringify(notes.find(note=>note.id==='locked-existing'))),existingLocked);assert.deepEqual(JSON.parse(JSON.stringify(notes.find(note=>note.id==='open-existing'))),existingOpen);const added=notes.find(note=>!['locked-existing','open-existing'].includes(note.id));assert.equal(added.pitch,67);assert.equal(added.locked,false);assert.equal((await repo.get(project.projectId)).midiData.tracks.find(track=>track.part==='melody').notes.length,3);
});

test('Lock Unlock participates in dirty autosave successful save and failed save lifecycle',async()=>{
  const{app,window}=load(),base=app.memoryRepository(),project=app.makeProject({projectId:'lock-save-lifecycle',projectName:'Lock save',midiData:{tracks:[{part:'melody',notes:[{id:'n',pitch:60,startTick:0,durationTicks:480,velocity:80}]}]}});await base.put(project);app.setRepository(base);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);const core=window.MusicStudioEditor,session=app.state.midiEditor;core.selectNote(session,'n');assert.equal(session.dirty,false);assert.equal(app.editorLockSelectedNotes(),true);assert.equal(session.dirty,true);assert.ok(app.state.midiEditorSavePromise);await app.state.midiEditorSavePromise;assert.equal(session.dirty,false);assert.equal((await base.get(project.projectId)).midiData.tracks.find(track=>track.part==='melody').notes[0].locked,true);assert.equal(app.editorUnlockSelectedNotes(),true);assert.equal(session.dirty,true);await app.state.midiEditorSavePromise;assert.equal(session.dirty,false);
  const failingProject=await base.get(project.projectId);core.selectNote(session,'n');app.setRepository({...base,async put(){throw Error('storage unavailable')}});const originalError=console.error;console.error=()=>{};let failed;try{app.editorLockSelectedNotes();failed=await app.state.midiEditorSavePromise}finally{console.error=originalError}assert.equal(failed.ok,false);assert.equal(session.dirty,true);assert.equal(failingProject.midiData.tracks.find(track=>track.part==='melody').notes[0].locked,false);
});

test('a selected locked note remains previewable through the existing voice path',async()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'locked-preview',projectName:'Locked preview',midiData:{tracks:[{part:'melody',notes:[{id:'locked',pitch:62,startTick:0,durationTicks:480,velocity:91,locked:true}]}]}}),calls=[];app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);window.MusicStudioEditor.selectNote(app.state.midiEditor,'locked');app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,noteOff(...args){calls.push(['off',...args])},noteOn(...args){calls.push(['on',...args]);return true}};assert.equal(await app.editorPreviewPitch(62,91),true);assert.equal(calls.some(call=>call[0]==='on'&&call[1]===62&&call[2]===91),true);assert.equal(window.MusicStudioEditor.selectedNotes(app.state.midiEditor)[0].locked,true);
});

test('Edit Range UI persists a project-wide range without changing Loop Selection playback or track data',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'edit-range-ui',projectName:'Edit Range UI',midiData:{editor:{measureCount:8,loopEnabled:true,loopStart:0,loopEnd:1920},tracks:[{part:'melody',notes:[{id:'m',pitch:60,startTick:1920,durationTicks:480,velocity:90,locked:true}]},{part:'drums',notes:[{id:'d',pitch:36,startTick:1920,durationTicks:120,velocity:100}]},{part:'bass',notes:[{id:'b',pitch:36,startTick:1920,durationTicks:480,velocity:88}]}]}});app.setRepository(repo);await repo.put(project);app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),session=app.state.midiEditor,core=window.MusicStudioEditor,before=JSON.stringify(session.midiData.tracks);
  assert.match(html,/aria-label="編集対象の開始小節"/);assert.match(html,/aria-label="編集対象の終了小節"/);assert.match(html,/Edit Range: Measure 1–1/);
  app.editorSetEditRange(2,null);app.editorSetEditRange(null,4);await app.state.midiEditorSavePromise;assert.deepEqual(JSON.parse(JSON.stringify(session.editRange)),{startMeasure:2,endMeasure:4});assert.equal(session.midiData.editor.loopStart,0);assert.equal(session.midiData.editor.loopEnd,1920);assert.equal(JSON.stringify(session.midiData.tracks),before);
  core.selectPart(session,'drums');assert.deepEqual(JSON.parse(JSON.stringify(session.editRange)),{startMeasure:2,endMeasure:4});assert.deepEqual(Array.from(core.notesInRange(session),note=>note.id),['d']);core.selectPart(session,'bass');assert.deepEqual(Array.from(core.notesInRange(session),note=>note.id),['b']);
  const stored=await repo.get(project.projectId);assert.deepEqual(JSON.parse(JSON.stringify(stored.midiData.editor.editRange)),{startMeasure:2,endMeasure:4});
});

test('Edit Range does not filter playback preview or All MIDI export',async()=>{
  const notes=[{id:'outside',pitch:60,startTick:0,durationTicks:480,velocity:91,locked:true},{id:'inside',pitch:64,startTick:1920,durationTicks:240,velocity:83}],{app,window}=load(),project=app.makeProject({projectId:'range-media',projectName:'Range media',midiData:{editor:{measureCount:8,editRange:{startMeasure:2,endMeasure:4},loopEnabled:true,loopStart:1920,loopEnd:3840},tracks:[{part:'melody',notes},{part:'drums',notes:[{id:'kick-outside',pitch:36,startTick:0,durationTicks:120,velocity:100}]},{part:'bass',notes:[{id:'bass-outside',pitch:36,startTick:0,durationTicks:480,velocity:88}]}]}}),calls=[];app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);const session=app.state.midiEditor,beforeLoop=JSON.stringify([session.midiData.editor.loopEnabled,session.midiData.editor.loopStart,session.midiData.editor.loopEnd]);
  assert.deepEqual(Array.from(app.editorPlaybackTracks(session,'melody')[0].notes,note=>note.id),['outside','inside']);app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,noteOff(){},noteOn(pitch,velocity){calls.push([pitch,velocity]);return true}};assert.equal(await app.editorPreviewPitch(60,91),true);assert.deepEqual(calls,[[60,91]]);assert.equal(JSON.stringify([session.midiData.editor.loopEnabled,session.midiData.editor.loopStart,session.midiData.editor.loopEnd]),beforeLoop);
  const input=app.midiExportSummary({...project,midiData:session.midiData},'all').input,file=window.MusicStudioMidi.createMidiFile(input),parsed=window.MusicStudioMidiParser.parseMidiFile(file.bytes).normalized,exportedNotes=parsed.tracks.flatMap(track=>track.notes||[]);assert.equal(exportedNotes.length,4);assert.ok(exportedNotes.some(note=>note.pitch===60&&note.startTick===0&&note.durationTicks===480&&note.velocity===91));assert.doesNotMatch(Buffer.from(file.bytes).toString('latin1'),/editRange|startMeasure|endMeasure/);
});

test('Edit Range does not constrain Melody Drums or Bass recording targets',async()=>{
  const{app}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'range-record',projectName:'Range record',midiData:{editor:{measureCount:8,editRange:{startMeasure:2,endMeasure:4}}}});app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  for(const [part,pitch,channel]of[['melody',60,1],['drums',36,10],['bass',36,2]]){app.state.midiInput.recording=true;app.state.midiInput.recordingPart=part;app.state.midiInput.recorder={stop:()=>[{id:`${part}-outside`,pitch,startTick:0,durationTicks:120,velocity:99,channel}]};const result=await app.editorStopMidiRecording();assert.equal(result.ok,true);assert.equal(result.targetPart,part);const note=app.state.midiEditor.midiData.tracks.find(track=>track.part===part).notes.find(item=>item.pitch===pitch);assert.ok(note);assert.equal(note.startTick,0);assert.equal(note.locked,false);assert.deepEqual(JSON.parse(JSON.stringify(app.state.midiEditor.editRange)),{startMeasure:2,endMeasure:4})}
});

test('failed Edit Range autosave keeps dirty state and leaves stored project unchanged',async()=>{
  const{app}=load(),base=app.memoryRepository(),project=app.makeProject({projectId:'range-save-failure',projectName:'Range failure',midiData:{editor:{measureCount:8,editRange:{startMeasure:1,endMeasure:1}}}});await base.put(project);app.setRepository(base);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);const session=app.state.midiEditor;app.setRepository({...base,async put(){throw Error('storage unavailable')}});const originalError=console.error;console.error=()=>{};let failed;try{app.editorSetEditRange(2,4);assert.equal(session.dirty,true);failed=await app.state.midiEditorSavePromise}finally{console.error=originalError}assert.equal(failed.ok,false);assert.equal(session.dirty,true);assert.deepEqual(JSON.parse(JSON.stringify(session.editRange)),{startMeasure:2,endMeasure:4});assert.deepEqual(JSON.parse(JSON.stringify((await base.get(project.projectId)).midiData.editor.editRange)),{startMeasure:1,endMeasure:1});
});

test('Partial Edit UI creates a transient preview and applies it as one Undo Redo step',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'partial-edit-ui',projectName:'Partial Edit UI',midiData:{tracks:[{part:'melody',notes:[{id:'open',pitch:60,startTick:0,durationTicks:480,velocity:90},{id:'locked',pitch:64,startTick:480,durationTicks:480,velocity:80,locked:true}]}]}});app.setRepository(repo);await repo.put(project);app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),core=window.MusicStudioEditor,session=app.state.midiEditor,before=JSON.stringify(session.midiData);
  assert.match(html,/id="partialEditTitle">Partial Edit/);assert.match(html,/Start Edit/);assert.match(html,/Pitch \+1 Preview/);assert.match(html,/Updated[\s\S]*Added[\s\S]*Deleted[\s\S]*Unchanged/);assert.equal(app.state.partialEditSession,null);
  core.selectNote(session,'open');const partial=app.editorStartPartialEdit();assert.equal(partial.status,'created');assert.equal(JSON.stringify(session.midiData),before);assert.equal(session.dirty,false);assert.doesNotMatch(JSON.stringify(project),/partialEditSession/);
  const preview=app.editorPreviewPartialEditPitchUp();assert.equal(preview.summary.updated,1);assert.equal(preview.summary.unchanged,1);assert.equal(JSON.stringify(session.midiData),before);assert.equal(session.undo.length,0);assert.equal(JSON.stringify(preview.beforeNotes.find(note=>note.id==='locked')),JSON.stringify(preview.afterNotes.find(note=>note.id==='locked')));
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/preview-ready/);assert.match(html,/<dt>Updated<\/dt><dd>1<\/dd>/);
  const applied=app.editorApplyPartialEdit();assert.equal(applied.applied,true);assert.equal(core.currentTrack(session).notes.find(note=>note.id==='open').pitch,61);assert.equal(core.currentTrack(session).notes.find(note=>note.id==='locked').pitch,64);assert.equal(session.undo.length,1);assert.equal(session.dirty,true);const doubleApply=app.editorApplyPartialEdit();assert.equal(doubleApply.applied,false);assert.equal(doubleApply.reason,'already-applied');assert.equal(session.undo.length,1);
  app.editorUndo();assert.equal(core.currentTrack(session).notes.find(note=>note.id==='open').pitch,60);app.editorRedo();assert.equal(core.currentTrack(session).notes.find(note=>note.id==='open').pitch,61);await app.state.midiEditorSavePromise;const stored=await repo.get(project.projectId);assert.equal(stored.midiData.tracks.find(track=>track.part==='melody').notes.find(note=>note.id==='open').pitch,61);assert.doesNotMatch(JSON.stringify(stored),/partialEditSession|preview-ready/);assert.doesNotMatch(JSON.stringify(app.backupObject()),/partialEditSession|preview-ready/);
});

test('Partial Edit UI cancel and stale rejection leave Project history and persistence unchanged',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'partial-edit-safety',projectName:'Partial Edit safety',midiData:{editor:{measureCount:8},tracks:[{part:'melody',notes:[{id:'target',pitch:60,startTick:0,durationTicks:480,velocity:90}]}]}});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);const core=window.MusicStudioEditor,session=app.state.midiEditor;core.selectNote(session,'target');app.editorStartPartialEdit();app.editorPreviewPartialEditPitchUp();const before=JSON.stringify(session.midiData),undo=session.undo.length;const cancelled=app.editorCancelPartialEdit();assert.equal(cancelled.cancelled,true);assert.equal(app.state.partialEditSession.status,'cancelled');assert.equal(JSON.stringify(session.midiData),before);assert.equal(session.undo.length,undo);assert.equal(session.dirty,false);assert.equal(app.editorApplyPartialEdit().reason,'cancelled');
  app.editorStartPartialEdit();app.editorPreviewPartialEditPitchUp();core.lockSelectedNotes(session);const dirtyBefore=session.dirty,stale=app.editorApplyPartialEdit();assert.equal(stale.applied,false);assert.equal(stale.reason,'stale-project');assert.equal(app.state.partialEditSession.status,'preview-ready');assert.equal(core.currentTrack(session).notes[0].pitch,60);assert.equal(session.undo.length,1);assert.equal(session.dirty,dirtyBefore);assert.match(app.state.notice,/NoteまたはLockが変更/);
});

test('Partial Edit UI shares one contract across Melody Drums and Bass without cross-track changes',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'partial-edit-tracks',projectName:'Partial Edit tracks',midiData:{tracks:[{part:'melody',notes:[{id:'m',pitch:60,startTick:0,durationTicks:480,velocity:90}]},{part:'drums',notes:[{id:'d',pitch:36,startTick:0,durationTicks:120,velocity:100}]},{part:'bass',notes:[{id:'b',pitch:36,startTick:0,durationTicks:480,velocity:88}]}]}});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);const core=window.MusicStudioEditor,session=app.state.midiEditor;
  for(const [part,id,pitch]of[['melody','m',60],['drums','d',36],['bass','b',36]]){core.selectPart(session,part);core.selectNote(session,id);const beforeOther=JSON.stringify(session.midiData.tracks.filter(track=>track.part!==part));const partial=app.editorStartPartialEdit();assert.equal(partial.request.part,part);assert.deepEqual(Array.from(partial.request.targetNoteIds),[id]);assert.equal(app.editorPreviewPartialEditPitchUp().summary.updated,1);assert.equal(app.editorApplyPartialEdit().applied,true);assert.equal(core.currentTrack(session).notes[0].pitch,pitch+1);assert.equal(JSON.stringify(session.midiData.tracks.filter(track=>track.part!==part)),beforeOther)}
});

test('Partial Edit provider UI routes OpenAI and Gemini through the existing execution boundary without retaining credentials',async()=>{
  for(const provider of ['openai','gemini']){
    const{app,window}=load(),project=app.makeProject({projectId:`provider-ui-${provider}`,projectName:'Provider UI',midiData:{tracks:[{part:'melody',notes:[{id:'target',pitch:60,startTick:0,durationTicks:480,velocity:90},{id:'locked',pitch:64,startTick:480,durationTicks:480,velocity:80,locked:true},{id:'outside',pitch:67,startTick:1920,durationTicks:480,velocity:80}]}]}});app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),core=window.MusicStudioEditor,session=app.state.midiEditor,before=JSON.stringify(session.midiData),credential=String.fromCharCode(114,117,110,116,105,109,101),captured;
    assert.match(html,/id="partialEditProviderForm"/);assert.match(html,/OpenAI/);assert.match(html,/Gemini/);assert.match(html,/type="password" value=""/);assert.match(html,/Pitch \+1 Preview（Local）/);
    core.selectNote(session,'target');app.editorStartPartialEdit();const partial=app.state.partialEditSession,output={version:1,trackId:partial.request.trackId,part:partial.request.part,range:partial.request.range,updates:[{id:'target',pitch:62,startTick:0,durationTicks:480,velocity:90}],adds:[],deletes:[]},originalExecute=core.executePartialEditProviderRequest;
    core.executePartialEditProviderRequest=async(...args)=>{captured=args;return{version:1,provider,status:'success',output,error:null}};
    const form={elements:{provider:{value:provider},model:{value:`${provider}-model`},apiKey:{value:credential},intent:{value:'simpler'},instruction:{value:'Keep timing'}}};window.document={querySelector:selector=>selector==='#partialEditProviderForm'?form:null};
    const result=await app.editorRunPartialEditProvider();core.executePartialEditProviderRequest=originalExecute;assert.equal(result.ok,true);assert.equal(captured[0],provider);assert.equal(captured[1].provider,provider);assert.equal(captured[2].config.provider,provider);assert.equal(captured[2].config.model,`${provider}-model`);assert.equal(form.elements.apiKey.value,'');assert.equal(JSON.stringify(session.midiData),before);assert.equal(session.undo.length,0);assert.equal(app.state.partialEditSession.status,'preview-ready');assert.equal(app.state.partialEditSession.preview.summary.updated,1);assert.doesNotMatch(JSON.stringify(app.state),new RegExp(credential));assert.doesNotMatch(JSON.stringify(project),new RegExp(credential));assert.doesNotMatch(JSON.stringify(app.backupObject()),new RegExp(credential));
    const applied=app.editorApplyPartialEdit();assert.equal(applied.applied,true);assert.equal(core.currentTrack(session).notes.find(note=>note.id==='target').pitch,62);assert.equal(core.currentTrack(session).notes.find(note=>note.id==='locked').pitch,64);assert.equal(core.currentTrack(session).notes.find(note=>note.id==='outside').pitch,67);assert.equal(session.undo.length,1);app.editorUndo();assert.equal(core.currentTrack(session).notes.find(note=>note.id==='target').pitch,60);app.editorRedo();assert.equal(core.currentTrack(session).notes.find(note=>note.id==='target').pitch,62)
  }
});

test('Partial Edit provider UI keeps failures, timeout, malformed output, loading duplicates and stale responses safe',async()=>{
  const setup=()=>{const loaded=load(),{app,window}=loaded,project=app.makeProject({projectId:'provider-safety',projectName:'Provider safety',midiData:{tracks:[{part:'melody',notes:[{id:'target',pitch:60,startTick:0,durationTicks:480,velocity:90}]}]}});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);window.MusicStudioEditor.selectNote(app.state.midiEditor,'target');app.editorStartPartialEdit();const form={elements:{provider:{value:'openai'},model:{value:'offline-model'},apiKey:{value:String.fromCharCode(101,112,104,101,109,101,114,97,108)},intent:{value:'simpler'},instruction:{value:''}}};window.document={querySelector:selector=>selector==='#partialEditProviderForm'?form:null};return{...loaded,form,project,before:JSON.stringify(app.state.midiEditor.midiData)}};
  for(const execution of [
    {version:1,provider:'openai',status:'error',output:null,error:{code:'provider-error',message:'safe',category:'authentication-failure'}},
    {version:1,provider:'openai',status:'error',output:null,error:{code:'timeout',message:'safe'}},
    {version:1,provider:'openai',status:'success',output:{version:1,trackId:'wrong',part:'melody',range:{startMeasure:1,endMeasure:1,startTick:0,endTick:1920},updates:[],adds:[],deletes:[]},error:null}
  ]){const{app,window,before}=setup(),core=window.MusicStudioEditor;core.executePartialEditProviderRequest=async()=>execution;const result=await app.editorRunPartialEditProvider();assert.equal(result.ok,false);assert.equal(JSON.stringify(app.state.midiEditor.midiData),before);assert.equal(app.state.midiEditor.undo.length,0);assert.notEqual(app.state.partialEditProvider.status,'success')}
  const{app,window,form,before}=setup(),core=window.MusicStudioEditor;let resolveExecution;core.executePartialEditProviderRequest=()=>new Promise(resolve=>{resolveExecution=resolve});const first=app.editorRunPartialEditProvider();assert.equal(app.state.partialEditProvider.status,'loading');form.elements.apiKey.value='';const duplicate=await app.editorRunPartialEditProvider();assert.equal(duplicate.ok,false);assert.equal(duplicate.reason,'loading');const oldPartial=app.state.partialEditSession;app.editorCancelPartialEdit();app.editorStartPartialEdit();resolveExecution({version:1,provider:'openai',status:'error',output:null,error:{code:'timeout',message:'safe'}});const stale=await first;assert.equal(stale.ok,false);assert.equal(stale.reason,'stale-response');assert.notEqual(app.state.partialEditSession,oldPartial);assert.equal(app.state.partialEditSession.status,'created');assert.equal(JSON.stringify(app.state.midiEditor.midiData),before)
});

test('Melody Tempo UI synchronizes initial BPM and applies removes saves and exports tempo changes outside note Undo',async()=>{const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'tempo-change',projectName:'Tempo Change',bpm:120,midiData:{ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},editor:{measureCount:4},tracks:[{id:'melody',part:'melody',channel:1,program:0,notes:[{id:'n',pitch:60,startTick:0,durationTicks:3840,velocity:90}]}]}});app.setRepository(repo);await repo.put(project);app.state.projects=[project];const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/id="melodyTempoPanel"/);assert.match(html,/Current Tempo/);assert.match(html,/name="tempoChangeMeasure"/);assert.match(html,/min="20" max="400" step="0\.1"/);const session=app.state.midiEditor,undo=session.undo.length;assert.equal(app.editorSetBpm(19).ok,false);assert.equal(app.editorSetBpm(401).ok,false);assert.equal(app.editorSetBpm(137.5).ok,true);assert.equal(session.midiData.tempo,137.5);assert.equal(session.midiData.tempoMap[0].bpm,137.5);assert.equal(app.state.projects[0].musicalSettings.bpm,137.5);session.tempoChangeDraft={measure:2,bpm:90.5};assert.equal(app.editorPreviewTempoChange().ok,true);const applied=app.editorApplyTempoChange();assert.equal(applied.ok,true);assert.equal(JSON.stringify(session.midiData.tempoMap.map(item=>[item.tick,item.bpm])),JSON.stringify([[0,137.5],[1920,90.5]]));assert.equal(session.undo.length,undo);await app.state.midiEditorSavePromise;const stored=await repo.get(project.projectId);assert.equal(JSON.stringify(stored.midiData.tempoMap.map(item=>[item.tick,item.bpm])),JSON.stringify([[0,137.5],[1920,90.5]]));const made=window.MusicStudioMidi.createMidiFile(app.midiExportInput(stored,'melody'));assert.equal(JSON.stringify(made.inspection.tracks[0].tempoMap.map(item=>item.tick)),JSON.stringify([0,1920]));assert.ok(Math.abs(made.inspection.tracks[0].tempoMap[1].bpm-90.5)<.001);assert.equal(app.editorRemoveTempoChange().ok,true);assert.equal(JSON.stringify(session.midiData.tempoMap.map(item=>item.tick)),JSON.stringify([0]));session.tempoChangeDraft={measure:5,bpm:90};assert.equal(app.editorApplyTempoChange().ok,false);assert.equal(stored.schemaVersion,'1.0');assert.equal(app.APP_VERSION,'1.4.0')});
