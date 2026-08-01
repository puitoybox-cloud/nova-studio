const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');
function load(){
  const values=new Map([['novaStudio_v01','nova-safe'],['aiMusicHelperProject','ai-safe']]);
  const window={crypto:{randomUUID:()=>`id-1`},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},location:{hash:'#music-studio/logic-pro'},performance:{now:()=>0},addEventListener(){},setTimeout,clearTimeout,Intl,Date,Math,JSON,console,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob};window.window=window;
  const midiSource=fs.readFileSync(path.join(__dirname,'..','music-studio-midi.js'),'utf8');vm.runInNewContext(midiSource,{window,globalThis:window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,unescape,encodeURIComponent},{filename:'music-studio-midi.js'});const parserSource=fs.readFileSync(path.join(__dirname,'..','music-studio-midi-parser.js'),'utf8');vm.runInNewContext(parserSource,{window,globalThis:window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,unescape,encodeURIComponent},{filename:'music-studio-midi-parser.js'});const editorSource=fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8');vm.runInNewContext(editorSource,{window,globalThis:window},{filename:'music-studio-editor.js'});const inputSource=fs.readFileSync(path.join(__dirname,'..','music-studio-midi-input.js'),'utf8');vm.runInNewContext(inputSource,{window,globalThis:window},{filename:'music-studio-midi-input.js'});
  vm.runInNewContext(source,{window,globalThis:window},{filename:'music-studio.js'});return{app:window.MusicStudio,values,window};
}
function file(name,bytes,type='application/octet-stream'){const data=Uint8Array.from(bytes);return{name,size:data.length,type,async arrayBuffer(){return data.buffer},slice(start,end){const part=data.slice(start,end);return{async arrayBuffer(){return part.buffer}}}}}

test('Logic Pro route opens standalone and includes safe round-trip actions',()=>{const {app}=load();const html=app.renderRoute('music-studio/logic-pro',{standalone:true});assert.match(html,/Logic Pro X連携/);assert.match(html,/Logic ProからMIDIを取り込む/);assert.match(html,/Type 1 MIDIを書き出す/);assert.match(html,/新規または複製/);assert.match(html,/読み込み履歴/);assert.match(html,/← 戻る/);assert.match(html,/次へ →/);assert.match(html,/Music Studio設定/);assert.match(html,/MIDI channel 10/);assert.match(html,/Drum Kit Designer/);assert.match(html,/Kick 36／Snare 38／Closed Hi-Hat 42/)});
test('every major and placeholder route has one unified back and next navigation',()=>{
  const{app,values}=load(),project=app.makeProject({projectId:'nav-project',projectName:'Navigation',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[{id:'drums',part:'drums',name:'Drums',channel:10,program:null,notes:[{id:'d',pitch:36,startTick:0,durationTicks:120,velocity:100}]}]}});
  app.state.projects=[project];values.set(app.LAST_PROJECT_KEY,project.projectId);
  const routes=['music-studio','music-studio/recent-projects','music-studio/new-project',`music-studio/project/${project.projectId}`,`music-studio/midi-editor/${project.projectId}`,'music-studio/logic-pro','music-studio/settings','music-studio/backup','music-studio/lyrics-notes'];
  for(const route of routes){const html=app.renderRoute(route),navs=html.match(/class="music-flow-nav"/g)||[];assert.equal(navs.length,1,route);if(route.includes('/midi-editor/')){assert.match(html,/Back（戻る）/);assert.match(html,/Next（進む）/)}else{assert.match(html,/← 戻る/);assert.match(html,/次へ →/)}}
  const editor=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(editor,/MIDI書き出し・Logic Pro連携/);assert.match(editor,new RegExp(`openLogicPro\\('${project.projectId}'\\)`));
});
test('history buttons use Japanese rounded arrows at the right of the part tabs without changing actions',()=>{
  const{app}=load(),project=app.makeProject({projectId:'button-guidance',projectName:'Button guidance'});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-part-tabs"[^>]*>[\s\S]*class="music-history-controls"[^>]*>[\s\S]*editorUndo\(\)" disabled title="元に戻す" aria-label="元に戻す"><svg class="music-history-icon"[\s\S]*<span>戻る<\/span>[\s\S]*editorRedo\(\)" disabled title="やり直す" aria-label="やり直す"><svg class="music-history-icon"[\s\S]*<span>進む<\/span>/);
  assert.equal((html.match(/editorUndo\(\)/g)||[]).length,1);assert.equal((html.match(/editorRedo\(\)/g)||[]).length,1);
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
  const popover={scrollTop:321,scrollHeight:700,clientHeight:688,style:{},getBoundingClientRect(){return{top:Number.parseFloat(this.style.top)||200}}};
  const summary={getBoundingClientRect:()=>({bottom:160})};
  const menu={open:true,querySelector:selector=>selector==='summary'?summary:selector==='.music-correction-popover'?popover:null};
  const form={elements:{key:{value:'C'},scale:{value:'Major'},quantize:{value:'1/16'},strength:{value:'100'},swing:{value:'0'},target:{value:'all'},measureFrom:{value:'1'},measureTo:{value:'1'}}};
  const scrollCalls=[];window.scrollX=40;window.scrollY=260;window.innerWidth=1280;window.innerHeight=900;window.scrollTo=value=>scrollCalls.push(value);window.requestAnimationFrame=callback=>callback();
  window.document={documentElement:{clientHeight:900},querySelector(selector){if(selector==='.music-piano-viewport')return viewport;if(selector==='.music-correction-menu')return menu;if(selector==='.music-editor-chrome')return{getBoundingClientRect:()=>({bottom:44})};if(selector==='#melodyCorrectionForm')return form;return null}};
  const result=app.editorPreviewCorrection();
  assert.equal(result.ok,true);assert.equal(app.state.midiEditor.view.pitchScrollTop,1234);assert.equal(app.state.midiEditor.view.pitchScrollLeft,567);
  assert.equal(app.state.midiEditor.view.correctionMenuOpen,true);assert.equal(app.state.midiEditor.view.correctionPopoverScrollTop,321);
  assert.equal(viewport.scrollTop,1234);assert.equal(viewport.scrollLeft,567);assert.equal(popover.scrollTop,321);
  assert.ok(scrollCalls.length>=2);assert.equal(JSON.stringify(scrollCalls[0]),'{"left":40,"top":260,"behavior":"instant"}');
  assert.equal(popover.style.top,'46px');assert.equal(popover.style.maxHeight,'842px');assert.equal(popover.style.overflowY,'auto');
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-notice\{position:fixed;z-index:1000;[^}]*right:12px/);
  assert.match(css,/\.music-correction-batch-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.music-correction-popover\{right:0;left:auto;width:min\(720px,[^}]*overscroll-behavior:contain/);
  assert.ok(source.includes('},2600)||null'));
});
test('editor chrome is compact, Melody helpers stay intact, and Correction uses responsive side surfaces',()=>{
  const{app}=load(),project=app.makeProject({projectId:'compact-editor-surfaces',projectName:'Compact editor surfaces'});
  app.state.projects=[project];const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(html,/class="music-editor-chrome"><nav class="music-flow-nav"/);
  assert.match(html,/class="music-part-workflow music-melody-workflow"><summary><b>MIDI入力・演奏補助<\/b>/);
  assert.doesNotMatch(html,/<p class="music-kicker">Melody workflow<\/p><h2[^>]*>メロディ制作<\/h2>/);
  for(const preserved of ['melodyInputDuration','melodyInputVelocity','メロディ入力鍵盤','editorSelectMeasureRange','editorToggleLock','editorPrepareRegeneration'])assert.match(html,new RegExp(preserved));
  assert.doesNotMatch(html,/MS-RESTART-10|Editor UI shell/);
  assert.match(html,/class="music-secondary music-correction-panel-close"[^>]*editorCloseCorrectionPanel/);
  assert.match(css,/\.music-editor-chrome\{display:grid;grid-template-columns:auto minmax\(120px,1fr\) auto/);
  assert.match(css,/\.music-midi-editor-page:has\(\.music-correction-menu\[open\]\) \.music-editor-layout\{width:calc\(100% - 416px\)/);
  assert.match(css,/@media\(max-width:900px\)\{\.music-editor-chrome\{grid-template-columns:auto minmax\(0,1fr\) auto/);
  assert.match(css,/\.music-correction-popover\{position:fixed;z-index:80;width:min\(400px/);
});
test('MIDI input uses one compact selector and the part tabs omit duplicate note counts',async()=>{
  const{app}=load(),project=app.makeProject({projectId:'midi-status-labels',projectName:'MIDI status labels'});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/MIDI Input（MIDI入力）<select[^>]*><option value="" selected>MIDI入力機器なし<\/option><option value="__rescan__"[^>]*>↻ 再検出<\/option>/);
  assert.match(html,/editorToggleMidiRecording\(\)" disabled aria-disabled="true"/);
  assert.doesNotMatch(html,/MIDI未接続|music-midi-status|MIDI Devices（デバイス一覧）/);
  assert.doesNotMatch(html,/music-midi-rescan|Check Connection（接続確認）/);
  assert.equal((html.match(/editorInitializeMidi\(\)/g)||[]).length,0);
  assert.match(html,/>Melody<\/button>/);assert.match(html,/>Drums<\/button>/);assert.match(html,/>Bass<\/button>/);
  assert.doesNotMatch(html,/>Melody<span>|>Drums<span>|>Bass<span>/);
  assert.doesNotMatch(html,/music-editor-status|Melody · 0ノート · 選択 0 · コピー 0/);
  const workflow=html.match(/<details class="music-part-workflow music-melody-workflow">([\s\S]*?)<\/details>/)?.[1]||'';
  assert.doesNotMatch(workflow,/editorInitializeMidi|editorStartMidiRecording|editorStopMidiRecording|MIDI Keyboard|MIDI Input|Record（録音）|Stop（停止）/);
  for(const label of ['Back（戻る）','Next（進む）','Copy（コピー）','Paste（貼り付け）','Duplicate（複製）','Select All（全選択）','Preview（プレビュー）','Cancel（キャンセル）','Record（録音）','Play（再生）','Stop（停止）'])assert.match(html,new RegExp(label.replace(/[（）]/g,value=>`\\${value}`)));
  const keys={id:'keys',name:'Keystation Mini 32 MK3',onmidimessage:null},pads={id:'pads',name:'MPD218',onmidimessage:null};
  app.state.midiInput.inputs=[keys,pads];app.state.midiInput.selectedId='keys';app.state.midiInput.access={};app.state.midiInput.recording=true;app.state.midiInput.recorder={recording:false};
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/MIDI Input（MIDI入力）/);assert.match(html,/value="keys" selected>Keystation Mini 32 MK3/);assert.match(html,/value="pads" >MPD218/);assert.match(html,/value="__rescan__" >↻ 再検出/);
  assert.match(html,/editorToggleMidiRecording\(\)" aria-disabled="false"/);assert.doesNotMatch(html,/editorToggleMidiRecording\(\)" disabled/);
  await app.editorSelectMidiInput('pads');assert.equal(app.state.midiInput.selectedId,'pads');assert.equal(keys.onmidimessage,null);assert.equal(typeof pads.onmidimessage,'function');
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-midi-editor-page:has\(\.music-correction-menu\[open\]\) \.music-editor-layout\{width:calc\(100% - 416px\);min-width:calc\(100% - 416px\);max-width:calc\(100% - 416px\);transition:none\}/);
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
  assert.match(html,/data-key="D" data-scale="Pentatonic"/);assert.match(html,/data-pitch="62"/);assert.doesNotMatch(html,/data-pitch="61"/);
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
  assert.match(html,/class="music-editor-popover music-shortcuts-popover"/);assert.match(html,/<h3>基本操作<\/h3>/);assert.match(html,/<dt>Space<\/dt><dd>再生／停止<\/dd>/);
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
  assert.match(html,/C4 · V30/);assert.match(html,/onpointerdown="event\.preventDefault\(\);MusicStudio\.editorPreviewPitch\(60\)"/);
  assert.match(html,/onclick="if\(event\.detail===0\)MusicStudio\.editorPreviewPitch\(60\)"/);
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
test('Piano Roll shortcuts share button actions and never fire from an input',async()=>{
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
  let played=0,stopped=0;app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,stopPlayback(){stopped++},playNotes(){played++;return{ok:true,noteCount:1,durationMs:10000,playbackStart:0,secondsPerTick:1/960,endTick:480}}};
  app.editorHandleShortcut(event(' '));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(app.state.melodyAudio.playing,true);assert.equal(played,1);
  app.state.midiEditor.playheadTick=240;app.editorHandleShortcut(event(' '));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(app.state.melodyAudio.playing,false);assert.equal(app.state.midiEditor.playheadTick,240);assert.ok(stopped>0);
  app.editorHandleShortcut(event(' '));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(app.state.melodyAudio.playing,true);assert.equal(played,2);app.editorStopTransport();
  app.editorHandleShortcut(event('Escape'));assert.equal(core.selectedIds(app.state.midiEditor).length,0);
  core.selectAllNotes(app.state.midiEditor);app.editorHandleShortcut(event('Delete'));assert.equal(core.currentTrack(app.state.midiEditor).notes.length,0);
});
test('R toggles the existing MIDI recording path without stealing reload typing repeat or IME',async()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'record-shortcut',projectName:'Record shortcut'}),input={id:'keys',name:'Keys',onmidimessage:null};app.state.projects=[project];window.location.hash='#music-studio/midi-editor/record-shortcut';app.renderRoute('music-studio/midi-editor/record-shortcut');
  let clock=1000,frame=null;window.performance={now:()=>clock};window.requestAnimationFrame=callback=>{frame=callback;return 7};window.cancelAnimationFrame=()=>{};app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,noteOn(){},noteOff(){},allNotesOff(){},stopPlayback(){}};Object.assign(app.state.midiInput,{initialized:true,supported:true,access:{},inputs:[input],selectedId:'keys'});await app.editorSelectMidiInput('keys');
  const event=(key,extra={})=>{let prevented=false;return{key,target:{closest:()=>null},preventDefault(){prevented=true},get prevented(){return prevented},...extra}};
  for(const blocked of [event('r',{metaKey:true}),event('r',{ctrlKey:true}),event('r',{repeat:true}),event('r',{isComposing:true}),event('r',{target:{closest:()=>({})}})]){assert.equal(app.editorHandleShortcut(blocked),false);assert.equal(blocked.prevented,false)}
  const start=event('r');assert.equal(app.editorHandleShortcut(start),true);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(start.prevented,true);assert.equal(app.state.midiInput.recording,true);assert.equal(typeof frame,'function');
  app.state.midiEditor.playheadTick=240;clock=1250;const stop=event('r');assert.equal(app.editorHandleShortcut(stop),true);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(app.state.midiInput.recording,false);assert.equal(app.state.midiInput.liveNotes.length,0);assert.equal(app.state.midiEditor.playheadTick,240);
  const restart=event('r');assert.equal(app.editorHandleShortcut(restart),true);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(app.state.midiInput.recording,true);await app.editorToggleMidiRecording();assert.equal(app.state.midiInput.recording,false);
  assert.match(app.renderRoute('music-studio/midi-editor/record-shortcut'),/onclick="MusicStudio\.editorToggleMidiRecording\(\)"[^>]*aria-pressed="false"/);
});
test('recording previews noteOn chords growth noteOff and Stop without duplicate committed notes',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'live-recording',projectName:'Live recording'}),input={id:'keys',name:'Keys',onmidimessage:null};app.setRepository(repo);await repo.put(project);app.state.projects=[project];window.location.hash='#music-studio/midi-editor/live-recording';app.renderRoute('music-studio/midi-editor/live-recording');
  let clock=1000,frame=null;window.performance={now:()=>clock};window.requestAnimationFrame=callback=>{frame=callback;return 9};window.cancelAnimationFrame=()=>{};app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,noteOn(){},noteOff(){},allNotesOff(){},stopPlayback(){}};Object.assign(app.state.midiInput,{initialized:true,supported:true,access:{},inputs:[input],selectedId:'keys'});await app.editorSelectMidiInput('keys');await app.editorStartMidiRecording();
  input.onmidimessage({data:[0x90,60,90],timeStamp:1000});input.onmidimessage({data:[0x90,64,100],timeStamp:1000});assert.equal(app.state.midiInput.liveNotes.length,2);assert.equal(app.state.midiInput.liveNotes.filter(note=>note.active).length,2);let html=app.renderRoute('music-studio/midi-editor/live-recording');assert.equal((html.match(/data-live-note-id=/g)||[]).length,2);assert.match(html,/--pitch-y:1215px/);assert.match(html,/--pitch-y:1143px/);
  clock=1500;frame();assert.ok(app.state.midiInput.liveNotes.every(note=>note.durationTicks===480));input.onmidimessage({data:[0x80,60,0],timeStamp:1500});assert.equal(app.state.midiInput.liveNotes.find(note=>note.pitch===60).active,false);input.onmidimessage({data:[0x90,64,0],timeStamp:1750});
  clock=2000;const result=await app.editorStopMidiRecording();const notes=window.MusicStudioEditor.currentTrack(app.state.midiEditor).notes;assert.equal(result.ok,true);assert.equal(notes.length,2);assert.equal(new Set(notes.map(note=>note.pitch)).size,2);assert.equal(app.state.midiInput.liveNotes.length,0);assert.equal(app.state.midiEditor.playheadTick,960);html=app.renderRoute('music-studio/midi-editor/live-recording');assert.equal((html.match(/data-live-note-id=/g)||[]).length,0);assert.equal((html.match(/data-note-id=/g)||[]).length,2);assert.equal((await repo.get('live-recording')).midiData.tracks.find(track=>track.part==='melody').notes.length,2);
});
test('Loop recording commits each pass once, carries held notes, and keeps recording',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'loop-recording',projectName:'Loop recording'}),input={id:'keys',name:'Keys',onmidimessage:null};app.setRepository(repo);await repo.put(project);app.state.projects=[project];window.location.hash='#music-studio/midi-editor/loop-recording';app.renderRoute('music-studio/midi-editor/loop-recording');
  const core=window.MusicStudioEditor,session=app.state.midiEditor;core.setLoopRange(session,480,960,true);session.playheadTick=0;
  let clock=1000,frame=null;window.performance={now:()=>clock};window.requestAnimationFrame=callback=>{frame=callback;return 11};window.cancelAnimationFrame=()=>{};app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,noteOn(){},noteOff(){},allNotesOff(){},stopPlayback(){}};Object.assign(app.state.midiInput,{initialized:true,supported:true,access:{},inputs:[input],selectedId:'keys'});await app.editorSelectMidiInput('keys');await app.editorStartMidiRecording();assert.equal(session.playheadTick,480);
  assert.equal(app.editorStartLoopRange({preventDefault(){throw Error('recording loop edit should be ignored')}}),false);
  input.onmidimessage({data:[0x90,60,90],timeStamp:1000});clock=1500;frame();let notes=core.currentTrack(session).notes;assert.equal(notes.length,1);assert.equal(notes[0].startTick,480);assert.equal(notes[0].durationTicks,480);assert.equal(session.playheadTick,480);assert.equal(app.state.midiInput.recording,true);assert.equal(app.state.midiInput.liveNotes.length,1);
  input.onmidimessage({data:[0x80,60,0],timeStamp:1750});clock=2000;frame();notes=core.currentTrack(session).notes;assert.equal(notes.length,2);assert.deepEqual(Array.from(notes,note=>note.startTick),[480,480]);assert.deepEqual(Array.from(notes,note=>note.durationTicks),[480,240]);assert.equal(new Set(notes.map(note=>note.id)).size,2);assert.equal(app.state.midiInput.recording,true);assert.equal(session.playheadTick,480);assert.equal(app.state.midiInput.liveNotes.length,0);
  clock=2125;await app.editorStopMidiRecording();assert.equal(app.state.midiInput.recording,false);assert.equal(session.playheadTick,600);await new Promise(resolve=>setTimeout(resolve,0));assert.equal((await repo.get(project.projectId)).midiData.tracks.find(track=>track.part==='melody').notes.length,2);
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
test('loop ruler supports reverse creation, handle resize, locked-length move, save and clear',async()=>{
  const{app}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'loop-range',projectName:'Loop range'});app.setRepository(repo);await repo.put(project);app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-loop-ruler"[^>]*editorStartLoopRange/);assert.match(html,/class="music-loop-lane-label">Loop Range/);assert.match(html,/空きレーンをドラッグして作成/);assert.doesNotMatch(html,/class="music-loop-bar"|小節選択とは別の再生範囲|\d+–\d+ tick/);assert.match(html,/editorToggleMeasure\(1\)/);
  let selection=null,captured=null,released=null;const ruler={dataset:{totalTicks:'7680'},getBoundingClientRect:()=>({left:0,width:800}),querySelector:()=>selection,insertAdjacentHTML(){selection={style:{}}},setPointerCapture(id){captured=id},hasPointerCapture:id=>captured===id,releasePointerCapture(id){released=id;captured=null}};
  const target=part=>({closest:selector=>selector==='[data-loop-part]'&&part?{dataset:{loopPart:part}}:null});
  app.editorStartLoopRange({button:0,currentTarget:ruler,target:target(null),clientX:700,pointerId:1,preventDefault(){},stopPropagation(){}});ruler.onpointermove({clientX:200});ruler.onpointerup();await app.state.midiEditorSavePromise;
  let loop=app.state.midiEditor.midiData.editor;assert.equal(loop.loopEnabled,true);assert.equal(loop.loopStart,1920);assert.equal(loop.loopEnd,6720);assert.equal(released,1);html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/music-loop-selection[^>]*onpointerdown="MusicStudio\.editorStartLoopRange\(event,'move'\)"/);assert.match(html,/music-loop-handle is-start[^>]*onpointerdown="MusicStudio\.editorStartLoopRange\(event,'start'\)"/);assert.match(html,/music-loop-handle is-end[^>]*onpointerdown="MusicStudio\.editorStartLoopRange\(event,'end'\)"/);assert.match(html,/Loop Range（ループ範囲）/);
  selection={style:{}};const touchStartHandle={closest:selector=>selector==='.music-loop-ruler'?ruler:null};app.editorStartLoopRange({button:0,pointerType:'touch',currentTarget:touchStartHandle,target:target('start'),clientX:200,pointerId:2,preventDefault(){},stopPropagation(){}},'start');ruler.onpointermove({pointerType:'touch',clientX:300});ruler.onpointerup({pointerType:'touch'});await app.state.midiEditorSavePromise;
  loop=app.state.midiEditor.midiData.editor;assert.equal(loop.loopStart,2880);assert.equal(loop.loopEnd,6720);
  selection={style:{}};app.editorStartLoopRange({button:0,currentTarget:ruler,target:target('move'),clientX:500,pointerId:3,preventDefault(){},stopPropagation(){}});ruler.onpointermove({clientX:600});ruler.onpointerup();await app.state.midiEditorSavePromise;
  loop=app.state.midiEditor.midiData.editor;assert.equal(loop.loopStart,3840);assert.equal(loop.loopEnd,7680);
  const stored=await repo.get(project.projectId);assert.equal(stored.midiData.editor.loopEnabled,true);assert.equal(stored.midiData.editor.loopStart,3840);assert.equal(stored.midiData.editor.loopEnd,7680);
  app.editorToggleSnap();selection=null;app.editorStartLoopRange({button:0,currentTarget:ruler,target:target(null),clientX:101,pointerId:4,preventDefault(){},stopPropagation(){}});ruler.onpointermove({clientX:203});ruler.onpointerup();await app.state.midiEditorSavePromise;
  loop=app.state.midiEditor.midiData.editor;assert.equal(loop.loopStart,970);assert.equal(loop.loopEnd,1949);
  app.editorClearLoop();await app.state.midiEditorSavePromise;loop=app.state.midiEditor.midiData.editor;assert.equal(loop.loopEnabled,false);assert.equal(loop.loopStart,null);assert.equal(loop.loopEnd,null);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');assert.match(css,/\.music-loop-selection,\.music-loop-handle\{pointer-events:auto\}/);assert.match(css,/\.music-loop-handle\{z-index:12;display:block/);assert.match(css,/\.music-loop-handle\.is-start\{left:2px\}/);assert.match(css,/\.music-loop-handle\.is-end\{right:2px\}/);
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
  assert.match(html,/class="music-loop-ruler"/);assert.doesNotMatch(html,/class="music-loop-bar"/);
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
test('editor layout prioritizes a compact header and a wide moderate-height Piano Roll without changing controls',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-midi-editor-page\{width:100%;max-width:none;padding:10px 16px 18px\}/);
  assert.match(css,/\.music-midi-editor-page \.music-flow-nav\{[^}]*margin:0 0 3px/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-heading h1\{font-size:clamp\(1\.1rem,1\.7vw,1\.3rem\)/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-topbar>button,[^}]*min-height:30px/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-save\{margin-left:0/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-viewport\{height:clamp\(560px,calc\(100vh - 224px\),780px\)/);
  assert.match(css,/body\.is-management-route \.management-main>\.music-midi-editor-page\{box-sizing:border-box;width:100%;max-width:none;margin:0;padding:10px 16px 18px\}/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-viewport\{height:clamp\(400px,calc\(100vh - 440px\),500px\)\}/);
  assert.match(css,/\.music-midi-editor-page \.music-loop-ruler\{height:28px\}/);assert.match(css,/\.music-midi-editor-page \.music-measure-row,\.music-midi-editor-page \.music-measure\{height:32px\}/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-frame\{--music-piano-header-height:60px\}/);assert.match(css,/\.music-midi-editor-page \.music-piano-viewport\{height:clamp\(428px,calc\(100vh - 412px\),528px\)\}/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-viewport\{height:clamp\(620px,calc\(100vh - 192px\),740px\)\}/);assert.match(css,/@media\(max-width:900px\)\{\.music-midi-editor-page \.music-piano-viewport\{height:clamp\(540px,calc\(100vh - 364px\),640px\)\}\}/);
  assert.match(css,/@media\(pointer:coarse\)\{\.music-midi-editor-page \.music-loop-ruler\{height:40px\}[\s\S]*?\.music-midi-editor-page \.music-piano-frame\{--music-piano-header-height:76px\}/);
  assert.match(css,/\.music-midi-editor-page \.music-loop-ruler\{height:22px\}/);assert.match(css,/\.music-midi-editor-page \.music-loop-handle::before\{[^}]*width:10px;height:16px/);assert.match(css,/\.music-midi-editor-page \.music-measure-row,\.music-midi-editor-page \.music-measure\{height:24px\}/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-frame\{--music-piano-header-height:46px\}/);assert.match(css,/\.music-midi-editor-page \.music-piano-viewport\{height:clamp\(634px,calc\(100vh - 178px\),754px\)\}/);
  assert.match(css,/@media\(pointer:coarse\)\{\.music-midi-editor-page \.music-loop-ruler\{height:28px\}[\s\S]*?\.music-midi-editor-page \.music-piano-frame\{--music-piano-header-height:56px\}/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom section\{display:flex;min-height:104px/);
  assert.match(css,/@media\(max-width:900px\)\{\.music-midi-editor-page\{padding:8px 10px 14px\}/);
  assert.match(css,/@media\(max-width:900px\)\{body\.is-management-route \.management-main>\.music-midi-editor-page\{padding:8px 10px 14px\}/);
});
test('Piano Roll renders MIDI Note 0 through 127 in a vertically scrollable range',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'full-pitch-range',projectName:'Full pitch range'});
  app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  window.MusicStudioEditor.addNote(app.state.midiEditor,{id:'low-note',pitch:0,startTick:0,durationTicks:120,velocity:90});
  window.MusicStudioEditor.addNote(app.state.midiEditor,{id:'middle-c-note',pitch:60,startTick:120,durationTicks:120,velocity:90});
  window.MusicStudioEditor.addNote(app.state.midiEditor,{id:'middle-e-note',pitch:64,startTick:240,durationTicks:120,velocity:90});
  window.MusicStudioEditor.addNote(app.state.midiEditor,{id:'high-note',pitch:127,startTick:480,durationTicks:120,velocity:100});
  const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-piano-viewport"[^>]*onscroll="MusicStudio\.editorRememberPitchScroll\(this\)"/);
  assert.match(html,/data-pitch-min="0" data-pitch-max="127"/);
  assert.match(html,/Note 0 \/ 0 tick/);
  assert.match(html,/Note 127 \/ 480 tick/);
  assert.match(html,/data-pitch-min="0" data-pitch-max="127"/);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-piano-viewport\{height:508px;overflow:auto/);
  assert.match(html,/music-piano-frame" style="--music-piano-row-height:18px;--music-piano-roll-height:2304px/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-roll\{height:var\(--music-piano-roll-height\)/);
  for(const [pitch,y] of [[127,9],[64,1143],[60,1215],[0,2295]])assert.match(html,new RegExp(`class="music-midi-note[^>]*data-note-id="[^"]+" style="--pitch-y:${y}px;top:var\\(--pitch-y\\)`));
  assert.match(css,/\.music-midi-editor-page \.music-pitch-labels button,\.music-midi-editor-page \.music-piano-roll \.music-midi-note\{margin:0\}/);
  assert.match(css,/\.music-midi-editor-page \.music-midi-note\.velocity-high\{box-sizing:border-box;height:14px;padding:0 4px;font-size:\.62rem;line-height:12px\}/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-roll \.music-midi-note\.is-selected\{box-sizing:border-box!important;height:12px!important;min-height:12px!important;max-height:12px!important;block-size:12px!important/);assert.match(css,/\.music-midi-editor-page \.music-piano-roll \.music-midi-note\.is-selected\{box-shadow:inset 0 0 0 1px/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-roll \.music-midi-note\.is-selected\{height:16px!important;min-height:16px!important;max-height:16px!important;block-size:16px!important;line-height:14px!important\}/);
  app.editorRememberPitchScroll({scrollTop:1234,scrollLeft:567});
  assert.equal(app.state.midiEditor.view.pitchScrollTop,1234);
  assert.equal(app.state.midiEditor.view.pitchScrollLeft,567);
});
test('Melody Editor visual polish keeps semantic controls while styling piano keys and workspace surfaces',()=>{
  const{app}=load(),project=app.makeProject({projectId:'visual-polish',projectName:'Visual polish'});app.state.projects=[project];
  const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(html,/class="is-white key-c"[^>]*aria-label="C4を試聴"/);assert.match(html,/class="is-black key-cs"[^>]*aria-label="C♯4を試聴"/);
  assert.match(html,/class="is-white key-c" style="--pitch-y:1215px"[^>]*aria-label="C4を試聴"/);assert.match(html,/class="is-black key-cs" style="--pitch-y:1197px"[^>]*aria-label="C♯4を試聴"/);assert.match(html,/class="is-white key-d" style="--pitch-y:1179px"[^>]*aria-label="D4を試聴"/);
  for(const pitchClass of ['cs','ds','fs','gs','as'])assert.match(html,new RegExp(`class="is-black key-${pitchClass}"`));
  for(const pitchClass of ['c','d','e','f','g','a','b'])assert.match(html,new RegExp(`class="is-white key-${pitchClass}"`));
  assert.doesNotMatch(html,/class="is-black key-(?:c|d|e|f|g|a|b)"/);
  const keys=[...html.matchAll(/class="(?:is-white|is-black) key-[^"]+" style="--pitch-y:([\d.]+)px"[^>]*editorPreviewPitch\((\d+)\)/g)].map(match=>({y:Number(match[1]),pitch:Number(match[2])}));assert.equal(keys.length,128);keys.forEach((key,index)=>{assert.equal(key.pitch,127-index);assert.equal(key.y,(index+.5)*18)});
  assert.match(html,/>Bar 1<\/button>/);assert.doesNotMatch(html,/>小節 1<\/button>/);
  assert.match(css,/\.music-midi-editor-page\{--music-editor-surface:#0b141f/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-frame\{grid-template-columns:112px minmax\(0,1fr\)\}/);
  assert.match(css,/\.music-midi-editor-page \.music-pitch-labels button\.is-white::before\{width:74px;background:linear-gradient/);
  assert.match(css,/\.music-midi-editor-page \.music-pitch-labels button\.is-black::before\{top:3px;bottom:3px;width:44px/);
  assert.match(css,/\.music-midi-editor-page \.music-pitch-labels button\{top:calc\(var\(--music-piano-header-height\) \+ var\(--pitch-y\)\);height:var\(--music-piano-row-height\)/);
  assert.match(css,/button\.is-white::before\{z-index:1;top:50%;bottom:auto;left:0;width:calc\(100% - 8px\);height:30px;border:0;border-right:1px/);
  assert.match(css,/button\.is-white::before,[^}]*button\.is-white\.key-d::before[^}]*button\.is-white\.key-g::before[^}]*button\.is-white\.key-a::before[^}]*button\.is-white\.key-b::before\{top:50%;bottom:auto;height:30px;transform:translateY\(-50%\)\}/);
  assert.doesNotMatch(css,/button\.is-white\.key-(?:d|g|a)::before\{top:-9px;bottom:auto;height:36px\}/);
  assert.match(css,/\.music-midi-editor-page \.music-pitch-labels button\.is-black::before\{z-index:3;top:2px;bottom:2px;left:6px;width:60%/);assert.match(css,/button\.is-black>span\{right:calc\(40% \+ 8px\)\}/);
  assert.match(css,/\.music-midi-editor-page \.music-pitch-labels button\{height:var\(--music-piano-row-height\)!important;min-height:var\(--music-piano-row-height\)!important;max-height:var\(--music-piano-row-height\)!important\}/);
  assert.match(css,/\.music-midi-editor-page \.music-midi-note\.is-recording\{pointer-events:none;border-color:#fca5a5/);assert.match(css,/content:'R';font-size:\.64rem/);assert.match(css,/Record \/ Stop Recording/);
  assert.match(css,/\.music-midi-editor-page \.music-scale-guide span\{background:rgba\(99,102,241,\.09\)\}/);
  assert.match(css,/\.music-midi-editor-page \.music-midi-note\.velocity-high\{[^}]*background:linear-gradient\(180deg,#5b5fe8,#4338ca\)/);
  assert.match(css,/\.music-midi-editor-page \.music-midi-note\.is-selected\{[^}]*background:linear-gradient\(180deg,#c4b5fd,#a78bfa\)/);
  assert.match(css,/@media\(max-width:900px\)\{[^}]*\.music-midi-editor-page \.music-editor-topbar\{gap:7px;padding:7px\}/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-menu\{display:flex;align-items:center;margin:0;padding:0;border:0;background:transparent;box-shadow:none\}/);
  assert.match(css,/@media\(min-width:901px\)\{\.music-midi-editor-page \.music-editor-topbar\{display:grid;grid-template-columns:1fr 1fr 1\.35fr 1\.45fr \.9fr 1\.9fr/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom section\{min-height:124px;margin:0;padding:14px;border-color:var\(--music-editor-border\);border-radius:12px/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom section>div>button\{flex:0 0 auto;max-width:100%\}/);
  assert.match(html,/<span class="music-record-dot" aria-hidden="true">●<\/span> Record（録音）/);
  for(const label of ['Loop Range（ループ範囲）','Clear Loop（ループ解除）','Play（再生）','Stop（停止）','Snap ON（スナップON）','Fit Range（音域を表示）','Add Measure（小節を追加）','Select（選択）','Add Note（ノート追加）','Eraser（消しゴム）','Copy（コピー）','Paste（貼り付け）','Duplicate（複製）','Select All（全選択）','Match Length（長さを揃える）','Match Velocity（Velocityを揃える）'])assert.ok(html.includes(label));
  for(const label of ['Project（プロジェクト情報）','Shortcuts（ショートカット）','Import / Export（読み込み／書き出し）','Melody Correction（メロディ補正）','Saved（保存済み）','MIDI Input（MIDI入力）'])assert.ok(html.includes(label));
  assert.match(html,/onclick="MusicStudio\.editorStopTransport\(\)"/);
  const transport=html.match(/<div class="music-transport-controls">([\s\S]*?)<\/div>/)?.[1]||'',transportLabels=['Record（録音）','Play（再生）','Stop（停止）','Loop ','Clear Loop（ループ解除）'];
  transportLabels.reduce((previous,label)=>{const index=transport.indexOf(label);assert.ok(index>previous,`${label} should follow the previous transport control`);return index},-1);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom \.music-transport-controls\{display:flex;flex-wrap:wrap/);
  assert.match(css,/\.music-midi-editor-page \.music-record-dot\{color:#ef4444/);
  assert.match(css,/summary\[aria-label\^="Project"\]::before\{content:'ⓘ'\}/);assert.match(css,/button\[onclick\*="editorAddNote"\]::before\{content:'♩'\}/);
  for(const action of ['editorSelectPart','editorUndo','editorRedo','editorAddNote','editorCopy','editorPaste','editorToggleMidiRecording','editorToggleMelodyPlayback'])assert.match(html,new RegExp(action));
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
