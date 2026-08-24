const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');
function load(navigator={}){
  const values=new Map([['novaStudio_v01','nova-safe'],['aiMusicHelperProject','ai-safe']]);
  let uuidSequence=0;const window={navigator,crypto:{randomUUID:()=>`id-${++uuidSequence}`},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},location:{hash:'#music-studio/logic-pro'},performance:{now:()=>0},addEventListener(){},setTimeout,clearTimeout,Intl,Date,Math,JSON,console,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob};window.window=window;
  const midiSource=fs.readFileSync(path.join(__dirname,'..','music-studio-midi.js'),'utf8');vm.runInNewContext(midiSource,{window,globalThis:window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,unescape,encodeURIComponent},{filename:'music-studio-midi.js'});const parserSource=fs.readFileSync(path.join(__dirname,'..','music-studio-midi-parser.js'),'utf8');vm.runInNewContext(parserSource,{window,globalThis:window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,unescape,encodeURIComponent},{filename:'music-studio-midi-parser.js'});const editorSource=fs.readFileSync(path.join(__dirname,'..','music-studio-editor.js'),'utf8');vm.runInNewContext(editorSource,{window,globalThis:window},{filename:'music-studio-editor.js'});const inputSource=fs.readFileSync(path.join(__dirname,'..','music-studio-midi-input.js'),'utf8');vm.runInNewContext(inputSource,{window,globalThis:window},{filename:'music-studio-midi-input.js'});
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
  assert.match(html,/class="music-part-workflow music-melody-workflow"><summary><b>MIDI入力・演奏補助<\/b>/);
  assert.doesNotMatch(html,/<p class="music-kicker">Melody workflow<\/p><h2[^>]*>メロディ制作<\/h2>/);
  for(const preserved of ['melodyInputDuration','melodyInputVelocity','メロディ入力鍵盤','editorSelectMeasureRange','editorToggleLock','editorPrepareRegeneration'])assert.match(html,new RegExp(preserved));
  assert.doesNotMatch(html,/MS-RESTART-10|Editor UI shell/);
  assert.match(html,/class="music-secondary music-correction-panel-close"[^>]*editorCloseCorrectionPanel/);
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
  const workflow=html.match(/<details class="music-part-workflow music-melody-workflow">([\s\S]*?)<\/details>/)?.[1]||'';
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
});
test('Mac Chrome with Web MIDI renders device selection instead of Safari guidance',()=>{
  const navigator={userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',vendor:'Google Inc.',requestMIDIAccess:async()=>({inputs:new Map()})};
  const{app}=load(navigator),project=app.makeProject({projectId:'chrome-midi',projectName:'Chrome MIDI'});
  app.state.projects=[project];app.state.midiInput.inputs=[{id:'keyboard',name:'MIDI Keyboard'}];app.state.midiInput.selectedId='keyboard';app.state.midiInput.status='1台のMIDI入力を検出しました。';
  const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/aria-label="MIDI機器選択"/);assert.match(html,/>↻ 再検出</);assert.match(html,/接続状態/);
  assert.doesNotMatch(html,/SafariではMIDI入力を利用できません|Mac Chromeで開いてください/);
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
  const pointer=(extra={})=>({button:0,pointerType:'mouse',pointerId:1,currentTarget:noteB,clientX:100,clientY:100,preventDefault(){},...extra});
  const highlighted=()=>[...layer.innerHTML.matchAll(/data-pitch="(\d+)"/g)].map(match=>Number(match[1])),notePitches=()=>Array.from(core.currentTrack(session).notes,note=>[note.id,note.pitch]);

  app.editorStartNoteDrag(pointer(),'b');assert.deepEqual(Array.from(core.selectedIds(session)),['b']);assert.equal(noteA.classList.contains('is-selected'),false);assert.equal(noteB.classList.contains('is-selected'),true);assert.deepEqual(highlighted(),[64]);
  noteB.onpointermove(pointer({clientY:52}));assert.deepEqual(highlighted(),[66]);assert.equal(keys.find(key=>key.dataset.pitch==='66').classList.contains('is-selected-pitch'),true);assert.equal(keys.find(key=>key.dataset.pitch==='64').classList.contains('is-selected-pitch'),false);assert.equal(noteA.style.translate,undefined);
  noteB.onpointerup();assert.deepEqual(notePitches(),[['a',60],['b',66]]);assert.deepEqual(Array.from(core.selectedIds(session)),['b']);
  core.undo(session);assert.equal(core.currentTrack(session).notes.find(note=>note.id==='b').pitch,64);core.redo(session);assert.equal(core.currentTrack(session).notes.find(note=>note.id==='b').pitch,66);

  core.selectNote(session,'a');noteA.classList.toggle('is-selected',true);noteB.classList.toggle('is-selected',false);app.editorStartNoteDrag(pointer(),'b');noteB.onpointermove(pointer({clientY:76}));assert.deepEqual(highlighted(),[67]);noteB.onpointercancel();assert.deepEqual(Array.from(core.selectedIds(session)),['a']);assert.deepEqual(highlighted(),[60]);assert.equal(core.currentTrack(session).notes.find(note=>note.id==='b').pitch,66);

  for(const modifier of [{shiftKey:true},{metaKey:true},{ctrlKey:true}]){core.selectNote(session,'a');noteA.classList.toggle('is-selected',true);noteB.classList.toggle('is-selected',false);app.editorStartNoteDrag(pointer(modifier),'b');assert.deepEqual(Array.from(core.selectedIds(session)),['a','b']);noteB.onpointercancel();assert.deepEqual(Array.from(core.selectedIds(session)),['a'])}
  core.selectAllNotes(session);noteA.classList.toggle('is-selected',true);noteB.classList.toggle('is-selected',true);app.editorStartNoteDrag(pointer(),'b');noteB.onpointermove(pointer({clientY:124}));noteB.onpointerup();assert.deepEqual(notePitches(),[['a',59],['b',65]]);
  core.undo(session);assert.deepEqual(notePitches(),[['a',60],['b',66]]);core.redo(session);assert.deepEqual(notePitches(),[['a',59],['b',65]]);

  core.selectNote(session,'b');noteA.classList.toggle('is-selected',false);noteB.classList.toggle('is-selected',true);app.editorStartNoteDrag(pointer({pointerType:'touch'}),'b');noteB.onpointermove(pointer({pointerType:'touch',clientY:148}));noteB.onpointerup();assert.equal(core.currentTrack(session).notes.find(note=>note.id==='b').pitch,63);assert.deepEqual(Array.from(core.selectedIds(session)),['b']);
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
  app.editorStartNoteDrag(pointer({ctrlKey:true}),'first');noteTarget.onpointerup();await flushPreview();
  assert.equal(JSON.stringify(core.selectedIds(app.state.midiEditor)),'["second","first"]');
  app.editorStartNoteDrag(pointer({ctrlKey:true}),'first');noteTarget.onpointerup();await flushPreview();
  assert.equal(JSON.stringify(core.selectedIds(app.state.midiEditor)),'["second"]');
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
  drag({ctrlKey:true});assert.deepEqual(Array.from(core.selectedIds(session)),['third','first','second']);
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
  let e=event('ArrowRight');assert.equal(app.editorHandleShortcut(e),true);assert.equal(note().startTick,120);assert.equal(e.prevented,false);
  app.editorHandleShortcut(event('ArrowUp',{shiftKey:true}));assert.equal(note().pitch,72);
  app.editorHandleShortcut(event('ArrowRight',{altKey:true}));assert.equal(note().durationTicks,240);
  app.editorHandleShortcut(event('c',{metaKey:true}));assert.equal(app.state.midiEditor.clipboard.length,1);
  app.editorHandleShortcut(event('v',{metaKey:true}));assert.equal(core.currentTrack(app.state.midiEditor).notes.length,2);
  const selectAllEvent=event('a',{metaKey:true});assert.equal(app.editorHandleShortcut(selectAllEvent),true);assert.equal(selectAllEvent.prevented,false);
  app.editorHandleShortcut(event('z',{metaKey:true}));assert.equal(core.currentTrack(app.state.midiEditor).notes.length,1);
  app.editorHandleShortcut(event('z',{metaKey:true,shiftKey:true}));assert.equal(core.currentTrack(app.state.midiEditor).notes.length,2);
  app.editorHandleShortcut(event('+',{metaKey:true}));assert.equal(app.state.midiEditor.view.zoom,2);
  app.editorHandleShortcut(event('0',{metaKey:true}));assert.equal(app.state.midiEditor.view.zoom,1);
  app.editorHandleShortcut(event('4'));assert.equal(app.state.midiEditor.view.snap,'1/32');
  app.editorHandleShortcut(event('n'));assert.equal(core.currentTrack(app.state.midiEditor).notes.length,3);
  app.state.midiEditor.playheadTick=480;const goToStart=event('Enter');assert.equal(app.editorHandleShortcut(goToStart),true);assert.equal(app.state.midiEditor.playheadTick,0);assert.equal(goToStart.prevented,false);
  window.location.hash='#music-studio/midi-composer';app.state.midiEditor.playheadTick=480;assert.equal(app.editorHandleShortcut(event('Enter')),true);assert.equal(app.state.midiEditor.playheadTick,0);
  app.state.midiEditor.playheadTick=480;const safariEnter=event('Unidentified',{code:'Enter',target:{closest:()=>null}});assert.equal(app.editorHandleShortcut(safariEnter),true);assert.equal(app.state.midiEditor.playheadTick,0);app.state.midiEditor.playheadTick=480;assert.equal(app.editorHandleShortcut(event('Unidentified',{code:'NumpadEnter'})),true);assert.equal(app.state.midiEditor.playheadTick,0);
  let played=0,stopped=0;app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,stopPlayback(){stopped++},playNotes(){played++;return{ok:true,noteCount:1,durationMs:10000,playbackStart:0,secondsPerTick:1/960,endTick:480}}};
  const safariSpace=event('Unidentified',{code:'Space',target:{closest:()=>null}});assert.equal(app.editorHandleShortcut(safariSpace),true);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(app.state.melodyAudio.playing,true);assert.equal(safariSpace.prevented,true);app.editorStopTransport();
  app.editorHandleShortcut(event(' '));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(app.state.melodyAudio.playing,true);assert.equal(played,2);
  app.state.midiEditor.playheadTick=240;app.editorHandleShortcut(event(' '));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(app.state.melodyAudio.playing,false);assert.equal(app.state.midiEditor.playheadTick,240);assert.ok(stopped>0);
  app.editorHandleShortcut(event(' '));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(app.state.melodyAudio.playing,true);assert.equal(played,3);app.editorStopTransport();
  app.editorHandleShortcut(event('Escape'));assert.equal(core.selectedIds(app.state.midiEditor).length,0);
  core.selectAllNotes(app.state.midiEditor);app.editorHandleShortcut(event('Delete'));assert.equal(core.currentTrack(app.state.midiEditor).notes.length,0);
  assert.match(source,/addEventListener\?\.\('keydown',editorHandleShortcut,true\)/);assert.match(source,/removeEventListener\?\.\('keydown',editorHandleShortcut,true\)/);assert.match(source,/code==='NumpadEnter'/);
});
test('playback target selection accepts one or multiple canonical tracks without changing their order',()=>{
  const{app}=load(),project=app.makeProject({projectId:'playback-targets',projectName:'Playback targets'});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);const session=app.state.midiEditor,before=JSON.stringify(session.midiData.tracks);
  assert.deepEqual(Array.from(app.editorPlaybackTracks(session,'melody'),track=>track.part),['melody']);
  assert.deepEqual(Array.from(app.editorPlaybackTracks(session,['drums','bass']),track=>[track.id,track.part,track.channel,track.program]),[['drums','drums',10,null],['bass','bass',2,32]]);
  assert.deepEqual(Array.from(app.editorPlaybackTracks(session,[session.midiData.tracks[2],'melody','bass']),track=>track.part),['bass','melody']);
  assert.equal(JSON.stringify(session.midiData.tracks),before);
});
test('R toggles the existing MIDI recording path without stealing reload typing repeat or IME',async()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'record-shortcut',projectName:'Record shortcut'}),input={id:'keys',name:'Keys',onmidimessage:null};app.state.projects=[project];window.location.hash='#music-studio/midi-editor/record-shortcut';app.renderRoute('music-studio/midi-editor/record-shortcut');
  app.state.midiEditor.midiData.editor.transport.countInEnabled=false;
  let clock=1000,frame=null;window.performance={now:()=>clock};window.requestAnimationFrame=callback=>{frame=callback;return 7};window.cancelAnimationFrame=()=>{};app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,noteOn(){},noteOff(){},allNotesOff(){},stopPlayback(){}};Object.assign(app.state.midiInput,{initialized:true,supported:true,access:{},inputs:[input],selectedId:'keys'});await app.editorSelectMidiInput('keys');
  const event=(key,extra={})=>{let prevented=false;return{key,target:{closest:()=>null},preventDefault(){prevented=true},get prevented(){return prevented},...extra}};
  for(const blocked of [event('r',{metaKey:true}),event('r',{ctrlKey:true}),event('r',{repeat:true}),event('r',{isComposing:true}),event('r',{target:{closest:()=>({})}})]){assert.equal(app.editorHandleShortcut(blocked),false);assert.equal(blocked.prevented,false)}
  const safariStart=event('Unidentified',{code:'KeyR',target:{closest:()=>null}});assert.equal(app.editorHandleShortcut(safariStart),true);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(app.state.midiInput.recording,true);await app.editorToggleMidiRecording();
  const start=event('r');assert.equal(app.editorHandleShortcut(start),true);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(start.prevented,false);assert.equal(app.state.midiInput.recording,true);assert.equal(typeof frame,'function');
  app.state.midiEditor.playheadTick=240;clock=1250;const stop=event('r');assert.equal(app.editorHandleShortcut(stop),true);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(app.state.midiInput.recording,false);assert.equal(app.state.midiInput.liveNotes.length,0);assert.equal(app.state.midiEditor.playheadTick,240);
  const restart=event('r');assert.equal(app.editorHandleShortcut(restart),true);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(app.state.midiInput.recording,true);await app.editorToggleMidiRecording();assert.equal(app.state.midiInput.recording,false);
  assert.match(app.renderRoute('music-studio/midi-editor/record-shortcut'),/onclick="MusicStudio\.editorToggleMidiRecording\(\)"[^>]*aria-pressed="false"/);
});
test('one-bar count-in excludes early notes and starts existing playback with recording at Bar 1',async()=>{
  const existing={id:'existing',pitch:67,startTick:0,durationTicks:480,velocity:76},projectInput={projectId:'count-in-recording',projectName:'Count-in',bpm:120,timeSignature:'4/4',midiData:{tracks:[{part:'melody',notes:[existing]}]}}, {app,window}=load(),repo=app.memoryRepository(),project=app.makeProject(projectInput),input={id:'keys',name:'Keys',onmidimessage:null};app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  let clock=1000,timerId=0,frame=null;const timers=new Map();window.performance={now:()=>clock};window.setTimeout=(callback,delay=0)=>{const id=++timerId;timers.set(id,{callback,at:clock+Number(delay||0)});return id};window.clearTimeout=id=>timers.delete(id);window.requestAnimationFrame=callback=>{frame=callback;return 7};window.cancelAnimationFrame=()=>{frame=null};const advanceTo=async target=>{for(;;){const due=[...timers.entries()].filter(([,job])=>job.at<=target).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!due)break;timers.delete(due[0]);clock=due[1].at;due[1].callback();await Promise.resolve()}clock=target;await Promise.resolve()};
  const clicks=[],preview=[],playback=[];app.state.melodyAudio.synth={context:{currentTime:10,state:'running'},supported:()=>true,unlock:async()=>true,noteOn(pitch){preview.push(['on',pitch])},noteOff(pitch){preview.push(['off',pitch])},allNotesOff(){},stopPlayback(){},playNotes(notes,options){playback.push({time:clock,notes:JSON.parse(JSON.stringify(notes)),options:{...options}});return{ok:true,noteCount:notes.length,startTick:options.startTick,endTick:options.endTick,playbackStart:options.startTime}},metronomeClick(accent){clicks.push({time:clock,accent})},stopMetronome(){}};Object.assign(app.state.midiInput,{initialized:true,supported:true,access:{},inputs:[input],selectedId:'keys'});await app.editorSelectMidiInput('keys');
  const pending=app.editorStartMidiRecording();await new Promise(resolve=>setImmediate(resolve));assert.equal(app.state.midiInput.countingIn,true);assert.equal(app.state.midiInput.recording,false);assert.equal(app.state.midiInput.countInBeat,1);
  input.onmidimessage({data:[0x90,55,90],timeStamp:1100});input.onmidimessage({data:[0x80,55,0],timeStamp:1200});assert.deepEqual(preview,[['on',55],['off',55]]);assert.equal(app.state.midiInput.recorder,null);
  assert.equal(playback.length,1);assert.equal(playback[0].time,1000);assert.equal(playback[0].options.startTime,12);assert.equal(playback[0].options.leadSeconds,undefined);assert.equal(playback[0].notes.length,1);assert.equal(playback[0].notes[0].id,'existing');
  await advanceTo(3000);const started=await pending;assert.equal(started.recording,true);assert.equal(app.state.midiInput.countingIn,false);assert.equal(app.state.midiInput.recordingStartedAt,3000);assert.equal(playback.length,1);assert.deepEqual(clicks.slice(0,5).map(click=>click.time),[1000,1500,2000,2500,3000]);assert.deepEqual(clicks.slice(0,5).map(click=>click.accent),[true,false,false,false,true]);
  input.onmidimessage({data:[0x90,60,100],timeStamp:3000});input.onmidimessage({data:[0x80,60,0],timeStamp:3500});clock=3500;const result=await app.editorStopTransport(),notes=window.MusicStudioEditor.currentTrack(app.state.midiEditor).notes;assert.equal(result.ok,true);assert.equal(notes.length,2);assert.deepEqual(JSON.parse(JSON.stringify(notes.find(note=>note.id==='existing'))),existing);const added=notes.find(note=>note.id!=='existing');assert.equal(added.pitch,60);assert.equal(added.startTick,0);assert.equal(added.durationTicks,480);assert.equal(frame,null);assert.equal((await repo.get(project.projectId)).midiData.tracks.find(track=>track.part==='melody').notes.length,2);
});
test('real Record audio path keeps Melody and Metronome nodes through the Count-in boundary until Stop',async()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'real-audio-count-in',projectName:'Real audio count-in',bpm:120,midiData:{tracks:[{part:'melody',notes:[{id:'existing',pitch:60,startTick:0,durationTicks:480,velocity:80}]}]}}),input={id:'keys',name:'Keys',onmidimessage:null};app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  let clock=1000,timerId=0,frame=null;const timers=new Map();window.performance={now:()=>clock};window.setTimeout=(callback,delay=0)=>{const id=++timerId;timers.set(id,{callback,at:clock+Number(delay||0)});return id};window.clearTimeout=id=>timers.delete(id);window.requestAnimationFrame=callback=>{frame=callback;return 1};window.cancelAnimationFrame=()=>{frame=null};const advanceTo=async target=>{for(;;){const due=[...timers.entries()].filter(([,job])=>job.at<=target).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!due)break;timers.delete(due[0]);clock=due[1].at;due[1].callback();await Promise.resolve()}clock=target;await Promise.resolve()};
  class Param{constructor(){this.value=0}setValueAtTime(value){this.value=value}linearRampToValueAtTime(value){this.value=value}exponentialRampToValueAtTime(value){this.value=value}cancelScheduledValues(){}cancelAndHoldAtTime(){}}class AudioNode{constructor(){this.connections=[]}connect(target){this.connections.push(target)}}class Oscillator extends AudioNode{constructor(){super();this.frequency=new Param();this.started=[];this.stopped=[];this.type=''}start(time){this.started.push(time)}stop(time){this.stopped.push(time)}}class Gain extends AudioNode{constructor(){super();this.gain=new Param()}}class Context{constructor(){this.state='suspended';this.destination={};this.oscillators=[];this.gains=[]}get currentTime(){return clock/1000}createOscillator(){const node=new Oscillator();this.oscillators.push(node);return node}createGain(){const node=new Gain();this.gains.push(node);return node}async resume(){this.state='running'}}
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-audio.js'),'utf8'),{window,globalThis:window},{filename:'music-studio-audio.js'});const synth=window.MusicStudioAudio.createSynth({AudioContext:Context});app.state.melodyAudio.synth=synth;Object.assign(app.state.midiInput,{initialized:true,supported:true,access:{},inputs:[input],selectedId:'keys'});await app.editorSelectMidiInput('keys');const pending=app.editorStartMidiRecording();await new Promise(resolve=>setImmediate(resolve));assert.equal(synth.context.state,'running');assert.equal(synth.playingVoices,1);const melody=synth.context.oscillators.find(node=>node.type==='sine');assert.equal(melody.started[0],3);assert.equal(melody.connections[0].connections[0],synth.context.gains[0]);assert.equal(synth.context.gains[0].connections[0],synth.context.destination);
  await advanceTo(3000);await pending;const boundaryClicks=synth.context.oscillators.filter(node=>node.type==='square'&&node.started[0]===3);assert.equal(app.state.midiInput.recording,true);assert.equal(synth.context.state,'running');assert.equal(synth.playingVoices,1);assert.equal(boundaryClicks.length,1);assert.equal(melody.stopped[0],3.63);assert.notEqual(app.state.melodyAudio.metronomeTimer,null);
  clock=3250;await app.editorStopTransport();assert.equal(synth.playingVoices,0);assert.equal(app.state.melodyAudio.metronomeTimer,null);assert.equal(frame,null);
});
test('Record overdubs without replacing overlaps and one Undo Redo step preserves persistence and JSON data',async()=>{
  const existing={id:'kept',pitch:60,startTick:0,durationTicks:480,velocity:72}, {app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'overdub-history',projectName:'Overdub history',midiData:{tracks:[{part:'melody',notes:[existing]}]}}),input={id:'keys',name:'Keys',onmidimessage:null};app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);app.state.midiEditor.midiData.editor.transport.countInEnabled=false;app.state.midiEditor.midiData.editor.transport.metronomeEnabled=false;
  let clock=1000,frame=null;const playback=[],stops=[];window.performance={now:()=>clock};window.requestAnimationFrame=callback=>{frame=callback;return 1};window.cancelAnimationFrame=()=>{frame=null};app.state.melodyAudio.synth={context:{currentTime:5,state:'running'},supported:()=>true,unlock:async()=>true,noteOn(){},noteOff(){},allNotesOff(){stops.push('all')},stopPlayback(){stops.push('playback')},playNotes(notes,options){playback.push({notes:JSON.parse(JSON.stringify(notes)),options:{...options}});return{ok:true,noteCount:notes.length,startTick:options.startTick,endTick:options.endTick,playbackStart:options.startTime}}};Object.assign(app.state.midiInput,{initialized:true,supported:true,access:{},inputs:[input],selectedId:'keys'});await app.editorSelectMidiInput('keys');
  await app.editorStartMidiRecording();assert.equal(playback.length,1);assert.equal(playback[0].options.startTick,0);assert.equal(playback[0].options.startTime,5);assert.deepEqual(playback[0].notes,[existing]);input.onmidimessage({data:[0x90,60,101],timeStamp:1000});input.onmidimessage({data:[0x80,60,0],timeStamp:1250});clock=1250;await app.editorStopTransport();const core=window.MusicStudioEditor,notes=core.currentTrack(app.state.midiEditor).notes;assert.equal(notes.length,2);assert.deepEqual(JSON.parse(JSON.stringify(notes.find(note=>note.id==='kept'))),existing);const added=notes.find(note=>note.id!=='kept');assert.equal(added.pitch,60);assert.equal(added.startTick,0);assert.equal(added.durationTicks,240);assert.equal(added.velocity,101);assert.ok(stops.includes('playback'));assert.ok(stops.includes('all'));assert.equal(frame,null);
  const stored=await repo.get(project.projectId);assert.equal(stored.midiData.tracks.find(track=>track.part==='melody').notes.length,2);assert.equal(JSON.parse(JSON.stringify(stored)).midiData.tracks.find(track=>track.part==='melody').notes.some(note=>note.velocity===101),true);app.editorUndo();assert.deepEqual(Array.from(core.currentTrack(app.state.midiEditor).notes,note=>note.id),['kept']);app.editorRedo();assert.equal(core.currentTrack(app.state.midiEditor).notes.length,2);
  clock=2000;await app.editorStartMidiRecording();assert.equal(playback.length,2);clock=2100;await app.editorStopTransport();assert.equal(app.state.midiInput.recordingPlayback,null);assert.equal(frame,null);assert.equal(core.currentTrack(app.state.midiEditor).notes.length,2);
});
test('Web MIDI timestamps use the scheduled count boundary even when its timer callback is delayed',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'hardware-boundary',projectName:'Hardware boundary',bpm:120,timeSignature:'4/4'}),input={id:'keystation',name:'Keystation Mini 32 MK3',onmidimessage:null};app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  let clock=1000,timerId=0;const timers=new Map();window.performance={timeOrigin:1700000000000,now:()=>clock};window.setTimeout=(callback,delay=0)=>{const id=++timerId;timers.set(id,{callback,at:clock+Number(delay||0)});return id};window.clearTimeout=id=>timers.delete(id);window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,noteOn(){},noteOff(){},allNotesOff(){},stopPlayback(){},metronomeClick(){},stopMetronome(){}};app.state.midiEditor.view.snapEnabled=true;app.state.midiEditor.view.snap='1/16';Object.assign(app.state.midiInput,{initialized:true,supported:true,access:{},inputs:[input],selectedId:'keystation'});await app.editorSelectMidiInput('keystation');
  const pending=app.editorStartMidiRecording();await new Promise(resolve=>setImmediate(resolve));assert.equal(app.state.midiInput.recordRequestedAt,1000);assert.equal(app.state.midiInput.countInStartedAt,1000);assert.equal(app.state.midiInput.recordingScheduledAt,3000);assert.equal(app.state.midiInput.recording,false);input.onmidimessage({data:[0x90,48,80],timeStamp:2999});input.onmidimessage({data:[0x80,48,0],timeStamp:2999.5});
  clock=3120;input.onmidimessage({data:[0x90,60,91],timeStamp:3000});const started=await pending;assert.equal(started.recording,true);assert.equal(app.state.midiInput.recordingStartedAt,3000);assert.equal(app.state.midiInput.recordingActivatedAt,3120);assert.equal(app.state.midiInput.countingIn,false);
  input.onmidimessage({data:[0x80,60,0],timeStamp:3250});input.onmidimessage({data:[0x90,62,92],timeStamp:3505});input.onmidimessage({data:[0x80,62,0],timeStamp:3755});input.onmidimessage({data:[0x90,64,93],timeStamp:4000});input.onmidimessage({data:[0x80,64,0],timeStamp:4250});input.onmidimessage({data:[0x90,65,94],timeStamp:window.performance.timeOrigin+4500});input.onmidimessage({data:[0x80,65,0],timeStamp:window.performance.timeOrigin+4750});clock=4800;await app.editorStopTransport();const notes=window.MusicStudioEditor.currentTrack(app.state.midiEditor).notes;assert.deepEqual(Array.from(notes,note=>note.pitch),[60,62,64,65]);assert.deepEqual(Array.from(notes,note=>note.startTick),[0,485,960,1440]);assert.deepEqual(Array.from(notes,note=>note.durationTicks),[240,240,240,240]);assert.deepEqual(Array.from(notes,note=>note.velocity),[91,92,93,94]);assert.notEqual(app.state.midiEditor.view.snapEnabled,false);assert.equal(app.state.midiEditor.view.snap,'1/16');assert.equal(notes[1].startTick,485);
});
test('Snap OFF and Count-in OFF keep timestamp timing while changed BPM and 3/4 use project timing',async()=>{
  const record=async({id,bpm,timeSignature,countIn,snap,eventTimes})=>{const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:id,projectName:id,bpm,timeSignature}),input={id:'keys',name:'Keys',onmidimessage:null};app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${id}`);let clock=7000;window.performance={timeOrigin:1700000000000,now:()=>clock};window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,noteOn(){},noteOff(){},allNotesOff(){},stopPlayback(){},metronomeClick(){},stopMetronome(){}};Object.assign(app.state.midiInput,{initialized:true,supported:true,access:{},inputs:[input],selectedId:'keys'});await app.editorSelectMidiInput('keys');app.state.midiEditor.midiData.editor.transport.countInEnabled=countIn;app.state.midiEditor.view.snapEnabled=snap;const pending=app.editorStartMidiRecording();await new Promise(resolve=>setImmediate(resolve));const boundary=app.state.midiInput.recordingScheduledAt;for(const [pitch,on,off] of eventTimes){clock=boundary+on;input.onmidimessage({data:[0x90,pitch,88],timeStamp:boundary+on});input.onmidimessage({data:[0x80,pitch,0],timeStamp:boundary+off})}await pending;clock=boundary+Math.max(...eventTimes.map(item=>item[2]))+10;await app.editorStopTransport();return{notes:window.MusicStudioEditor.currentTrack(app.state.midiEditor).notes,boundary,session:app.state.midiEditor}};
  const noCount=await record({id:'no-count-snap-off',bpm:120,timeSignature:'4/4',countIn:false,snap:false,eventTimes:[[60,3,253]]});assert.equal(noCount.boundary,7000);assert.equal(noCount.notes[0].startTick,3);assert.equal(noCount.notes[0].durationTicks,240);assert.equal(noCount.session.view.snapEnabled,false);
  const threeFour=await record({id:'changed-bpm-three-four',bpm:90,timeSignature:'3/4',countIn:true,snap:true,eventTimes:[[60,0,250],[62,60000/90,60000/90+250],[64,120000/90,120000/90+250]]});assert.ok(Math.abs(threeFour.boundary-9000)<.001);assert.deepEqual(Array.from(threeFour.notes,note=>note.startTick),[0,480,960]);assert.deepEqual(Array.from(threeFour.notes,note=>note.durationTicks),[180,180,180]);
});
test('Stop cancels count-in before recording and 3/4 follows project BPM and beat count',async()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'cancel-count-in',projectName:'Cancel count-in',bpm:90,timeSignature:'3/4'}),input={id:'keys',name:'Keys',onmidimessage:null};app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);let clock=500,timerId=0;const delays=[],timers=new Map();window.performance={now:()=>clock};window.setTimeout=(callback,delay=0)=>{delays.push(Number(delay));const id=++timerId;timers.set(id,callback);return id};window.clearTimeout=id=>timers.delete(id);app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,noteOn(){},noteOff(){},allNotesOff(){},stopPlayback(){},metronomeClick(){},stopMetronome(){}};Object.assign(app.state.midiInput,{initialized:true,supported:true,access:{},inputs:[input],selectedId:'keys'});await app.editorSelectMidiInput('keys');const pending=app.editorStartMidiRecording();await new Promise(resolve=>setImmediate(resolve));const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.equal((html.match(/music-count-in-display is-counting/g)||[]).length,1);assert.equal((html.match(/<span class="(?:is-current)?">[123]<\/span>/g)||[]).length,3);assert.ok(delays.some(delay=>Math.abs(delay-60000/90)<.001));const stopped=await app.editorStopTransport(),started=await pending;assert.equal(stopped.countInCancelled,true);assert.equal(started.countInCancelled,true);assert.equal(app.state.midiInput.recording,false);assert.equal(app.state.midiInput.recorder,null);assert.equal(timers.size,0);
});
test('Play metronome follows the transport setting without changing Melody or Loop playback',async()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'play-metronome',projectName:'Play metronome',bpm:100,midiData:{tracks:[{part:'melody',notes:[{id:'n',pitch:60,startTick:0,durationTicks:480,velocity:90}]}]}});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);let clock=1000,timerId=0;const timers=new Map(),clicks=[];window.performance={now:()=>clock};window.setTimeout=(callback,delay=0)=>{const id=++timerId;timers.set(id,{callback,delay:Number(delay)});return id};window.clearTimeout=id=>timers.delete(id);window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};const synth={context:{currentTime:10},supported:()=>true,unlock:async()=>true,stopPlayback(){},playNotes(){return{ok:true,noteCount:1,durationMs:10000,playbackStart:10.04,secondsPerTick:60/(100*480),startTick:0,endTick:480}},metronomeClick(accent){clicks.push(accent)},stopMetronome(){}};app.state.melodyAudio.synth=synth;
  const loop=app.state.midiEditor.midiData.editor;loop.loopStart=0;loop.loopEnd=480;loop.loopEnabled=true;await app.editorPlayMelody();const clickTimer=[...timers.values()].sort((a,b)=>a.delay-b.delay)[0];assert.ok(Math.abs(clickTimer.delay-40)<1);clickTimer.callback();assert.deepEqual(clicks,[true]);app.editorStopTransport();assert.equal(loop.loopEnabled,true);
  app.state.midiEditor.midiData.editor.transport.metronomeEnabled=false;timers.clear();await app.editorPlayMelody();assert.equal(timers.size,1);assert.deepEqual(clicks,[true]);app.editorStopTransport();
});
test('Loop Play stops after one pass without scheduling a second segment and can play again',async()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'one-pass-loop',projectName:'One pass loop',bpm:120,midiData:{editor:{measureCount:4,loopEnabled:true,loopStart:480,loopEnd:960,transport:{metronomeEnabled:true}},tracks:[{part:'melody',notes:[{id:'loop-note',pitch:60,startTick:480,durationTicks:240,velocity:90}]}]}});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  let timerId=0,playCalls=0,stopPlaybackCalls=0,stopMetronomeCalls=0;const timers=new Map();window.setTimeout=(callback,delay=0)=>{const id=++timerId;timers.set(id,{delay:Number(delay),callback:()=>{timers.delete(id);callback()}});return id};window.clearTimeout=id=>timers.delete(id);window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};
  app.state.melodyAudio.synth={context:{currentTime:10},supported:()=>true,unlock:async()=>true,playNotes(notes,options){playCalls++;return{ok:true,noteCount:notes.length,durationMs:900,playbackStart:10,secondsPerTick:.001,startTick:options.startTick,endTick:options.endTick}},stopPlayback(){stopPlaybackCalls++},metronomeClick(){},stopMetronome(){stopMetronomeCalls++}};
  const session=app.state.midiEditor;session.playheadTick=0;await app.editorPlayMelody();assert.equal(playCalls,1);assert.equal(app.state.melodyAudio.playing,true);assert.equal(session.playheadTick,480);const onePass=[...timers.values()].find(timer=>timer.delay===480);assert.ok(onePass);onePass.callback();assert.equal(playCalls,1);assert.equal(app.state.melodyAudio.playing,false);assert.equal(app.state.melodyAudio.playbackTimer,null);assert.equal(app.state.melodyAudio.metronomeTimer,null);assert.equal(timers.size,0);assert.equal(session.playheadTick,0);assert.ok(stopPlaybackCalls>=2);assert.ok(stopMetronomeCalls>=1);assert.equal(session.midiData.editor.loopEnabled,true);assert.equal(session.midiData.editor.loopStart,480);assert.equal(session.midiData.editor.loopEnd,960);
  await app.editorPlayMelody();assert.equal(playCalls,2);assert.equal(app.state.melodyAudio.playing,true);app.editorStopTransport();assert.equal(app.state.melodyAudio.playing,false);assert.equal(timers.size,0);
  session.midiData.editor.loopEnabled=false;await app.editorPlayMelody();assert.equal(playCalls,3);const normalEnd=[...timers.values()].find(timer=>timer.delay===900);assert.ok(normalEnd);normalEnd.callback();assert.equal(playCalls,3);assert.equal(app.state.melodyAudio.playing,false);
  app.editorClearLoop();assert.equal(session.midiData.editor.loopEnabled,false);assert.equal(session.midiData.editor.loopStart,null);assert.equal(session.midiData.editor.loopEnd,null);
});
test('Count-in and Metronome preferences save and restore through the existing project repository',async()=>{
  const{app}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'transport-prefs',projectName:'Transport prefs'});app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.equal(app.state.midiEditor.midiData.editor.transport.countInEnabled,true);assert.equal(app.state.midiEditor.midiData.editor.transport.metronomeEnabled,true);assert.equal(app.editorToggleCountIn(),false);await app.state.midiEditorSavePromise;assert.equal(app.editorToggleMetronome(),false);await app.state.midiEditorSavePromise;const stored=await repo.get(project.projectId);assert.equal(stored.midiData.editor.transport.countInEnabled,false);assert.equal(stored.midiData.editor.transport.metronomeEnabled,false);app.state.projects=[stored];app.state.midiEditor=null;app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.equal(app.state.midiEditor.midiData.editor.transport.countInEnabled,false);assert.equal(app.state.midiEditor.midiData.editor.transport.metronomeEnabled,false);
});
test('recording previews noteOn chords growth noteOff and Stop without duplicate committed notes',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'live-recording',projectName:'Live recording'}),input={id:'keys',name:'Keys',onmidimessage:null};app.setRepository(repo);await repo.put(project);app.state.projects=[project];window.location.hash='#music-studio/midi-editor/live-recording';app.renderRoute('music-studio/midi-editor/live-recording');
  const liveElements=new Map(),inserted=[];const layer={_html:'',insertAdjacentHTML(_position,markup){inserted.push(markup);const id=markup.match(/data-recording-note-id="([^"]+)/)?.[1];if(id){const attributes=new Map([['data-live-note-id',id]]),classes=new Set(['is-held']);liveElements.set(id,{style:{},classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)},removeAttribute:name=>attributes.delete(name),setAttribute:(name,value)=>attributes.set(name,value),hasAttribute:name=>attributes.has(name)})}},set innerHTML(value){this._html=value;if(!value)liveElements.clear()},get innerHTML(){return this._html}};window.document={body:{dataset:{}},querySelector(selector){if(selector==='.music-midi-editor-page .music-live-note-layer')return layer;const id=selector.match(/data-recording-note-id="([^"]+)/)?.[1];return id?liveElements.get(id)||null:null},addEventListener(){}};
  let clock=1000,frame=null;window.performance={now:()=>clock};window.requestAnimationFrame=callback=>{frame=callback;return 9};window.cancelAnimationFrame=()=>{};app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,noteOn(){},noteOff(){},allNotesOff(){},stopPlayback(){},stopMetronome(){}};Object.assign(app.state.midiInput,{initialized:true,supported:true,access:{},inputs:[input],selectedId:'keys'});await app.editorSelectMidiInput('keys');await app.editorStartMidiRecording({skipCountIn:true});
  input.onmidimessage({data:[0x90,60,90],timeStamp:1000});input.onmidimessage({data:[0x90,64,100],timeStamp:1000});assert.equal(app.state.midiInput.liveNotes.length,2);assert.equal(app.state.midiInput.liveNotes.filter(note=>note.active).length,2);assert.equal(inserted.length,2);assert.match(inserted[0],/data-live-note-id="live-midi-note-1"/);assert.match(inserted[0],/width:0\.45%/);assert.match(inserted[0],/--pitch-y:1215px/);let html=app.renderRoute('music-studio/midi-editor/live-recording');assert.equal((html.match(/data-live-note-id=/g)||[]).length,2);assert.match(html,/--pitch-y:1215px/);assert.match(html,/--pitch-y:1143px/);
  clock=1500;frame();assert.ok(app.state.midiInput.liveNotes.every(note=>note.durationTicks===480));assert.ok(Number.parseFloat(liveElements.get('live-midi-note-1').style.width)>.45);input.onmidimessage({data:[0x80,60,0],timeStamp:1500});assert.equal(app.state.midiInput.liveNotes.find(note=>note.pitch===60).active,false);assert.equal(liveElements.get('live-midi-note-1').hasAttribute('data-live-note-id'),false);input.onmidimessage({data:[0x90,64,0],timeStamp:1750});
  clock=2000;const result=await app.editorStopMidiRecording();const notes=window.MusicStudioEditor.currentTrack(app.state.midiEditor).notes;assert.equal(result.ok,true);assert.equal(notes.length,2);assert.equal(new Set(notes.map(note=>note.pitch)).size,2);assert.equal(app.state.midiInput.liveNotes.length,0);assert.equal(app.state.midiEditor.playheadTick,960);html=app.renderRoute('music-studio/midi-editor/live-recording');assert.equal((html.match(/data-live-note-id=/g)||[]).length,0);assert.equal((html.match(/data-note-id=/g)||[]).length,2);assert.equal((await repo.get('live-recording')).midiData.tracks.find(track=>track.part==='melody').notes.length,2);
});
test('Loop recording stops once at the end and commits its held note once',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'loop-recording',projectName:'Loop recording'}),input={id:'keys',name:'Keys',onmidimessage:null};app.setRepository(repo);await repo.put(project);app.state.projects=[project];window.location.hash='#music-studio/midi-editor/loop-recording';app.renderRoute('music-studio/midi-editor/loop-recording');
  const core=window.MusicStudioEditor,session=app.state.midiEditor;core.setLoopRange(session,480,960,true);session.playheadTick=0;
  let clock=1000,frame=null;window.performance={now:()=>clock};window.requestAnimationFrame=callback=>{frame=callback;return 11};window.cancelAnimationFrame=()=>{frame=null};app.state.melodyAudio.synth={supported:()=>true,unlock:async()=>true,noteOn(){},noteOff(){},allNotesOff(){},stopPlayback(){},stopMetronome(){}};Object.assign(app.state.midiInput,{initialized:true,supported:true,access:{},inputs:[input],selectedId:'keys'});await app.editorSelectMidiInput('keys');await app.editorStartMidiRecording({skipCountIn:true});assert.equal(session.playheadTick,480);
  assert.equal(app.editorStartLoopRange({preventDefault(){throw Error('recording loop edit should be ignored')}}),false);
  input.onmidimessage({data:[0x90,60,90],timeStamp:1000});clock=1500;frame();await new Promise(resolve=>setTimeout(resolve,0));const notes=core.currentTrack(session).notes;assert.equal(notes.length,1);assert.equal(notes[0].startTick,480);assert.equal(notes[0].durationTicks,480);assert.equal(session.playheadTick,960);assert.equal(app.state.midiInput.recording,false);assert.equal(app.state.midiInput.liveNotes.length,0);assert.equal(frame,null);assert.equal((await repo.get(project.projectId)).midiData.tracks.find(track=>track.part==='melody').notes.length,1);
  clock=2000;assert.equal(await app.editorStopMidiRecording(),undefined);assert.equal(core.currentTrack(session).notes.length,1);
  assert.doesNotMatch(source,/continueLoopRecording|heldNotes/);
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
test('Add Note handler creates four distinct notes at the current Grid across repaints',()=>{
  const steps={'1/4':480,'1/8':240,'1/16':120,'1/32':60};
  for(const [grid,step] of Object.entries(steps)){
    const{app,window}=load(),project=app.makeProject({projectId:`add-${grid}`,projectName:`Add ${grid}`});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
    const core=window.MusicStudioEditor,session=app.state.midiEditor;app.editorSetSnap(grid);session.playheadTick=37;
    for(let press=0;press<4;press++){assert.equal(app.editorAddNote(),true);app.renderRoute(`music-studio/midi-editor/${project.projectId}`)}
    const notes=core.currentTrack(session).notes;assert.deepEqual(Array.from(notes,note=>note.startTick),[37,37+step,37+step*2,37+step*3]);assert.equal(new Set(notes.map(note=>note.startTick)).size,4);
    assert.deepEqual(Array.from(notes,note=>[note.pitch,note.durationTicks,note.velocity]),Array(4).fill([60,step,100]));assert.deepEqual(Array.from(core.selectedIds(session)),[notes[3].id]);
    const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/class="music-selected-pitch-layer"[^>]*><span data-pitch="60"/);assert.match(html,/class="music-piano-key is-white is-selected-pitch" data-pitch="60"/);assert.match(html,/music-note-label-short">C4<\/span><span class="music-note-label-medium">C4 \/ ド<\/span>/);assert.doesNotMatch(JSON.stringify(session.midiData),/addNoteSequence/);
  }
  const{app,window}=load(),project=app.makeProject({projectId:'add-snap-off',projectName:'Add Snap OFF'});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const core=window.MusicStudioEditor,session=app.state.midiEditor;app.editorSetSnap('1/8');app.editorToggleSnap();session.playheadTick=137;assert.equal(app.editorAddNote(),true);app.editorMoveSelected(0,2);assert.equal(app.editorAddNote(),true);assert.equal(app.editorAddNote(),true);
  assert.deepEqual(Array.from(core.currentTrack(session).notes,note=>[note.startTick,note.pitch,note.durationTicks,note.velocity]),[[137,62,480,100],[377,62,480,100],[617,62,480,100]]);
});
test('Add Note stops at the configured song end, resumes after Add Measure, and follows Undo safely',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'add-boundary',projectName:'Add boundary'});app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const core=window.MusicStudioEditor,session=app.state.midiEditor;app.editorSetSnap('1/16');session.playheadTick=7560;
  assert.equal(app.editorAddNote(),true);const first=core.selectedNotes(session)[0];assert.equal(first.startTick,7560);assert.equal(app.editorAddNote(),false);assert.match(app.state.notice,/小節を追加してください/);assert.equal(core.currentTrack(session).notes.length,1);
  app.editorAddMeasures();assert.equal(session.midiData.editor.measureCount,8);assert.equal(app.editorAddNote(),true);let notes=core.currentTrack(session).notes;assert.deepEqual(Array.from(notes,note=>note.startTick),[7560,7680]);
  app.editorUndo();assert.deepEqual(Array.from(core.currentTrack(session).notes,note=>note.startTick),[7560]);app.editorRedo();assert.deepEqual(Array.from(core.currentTrack(session).notes,note=>note.startTick),[7560,7680]);
  app.editorUndo();assert.equal(app.editorAddNote(),true);notes=core.currentTrack(session).notes;assert.deepEqual(Array.from(notes,note=>note.startTick),[7560,7680]);
  app.editorCopy();session.playheadTick=9000;app.editorPaste();app.editorDuplicate();assert.equal(app.editorAddNote(),true);assert.equal(core.currentTrack(session).notes.some(note=>note.startTick===7800),true);
  await app.saveMidiEditor({silent:true});const stored=await repo.get(project.projectId);assert.deepEqual(Array.from(stored.midiData.tracks.find(track=>track.part==='melody').notes.filter(note=>note.startTick<8000),note=>note.startTick),[7560,7680,7800]);
  app.state.projects=[stored];app.state.midiEditor=null;app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.equal(window.MusicStudioEditor.currentTrack(app.state.midiEditor).notes.some(note=>note.startTick===7800),true);assert.equal(app.state.midiAddNoteSequence.session,app.state.midiEditor);assert.deepEqual(Array.from(app.state.midiAddNoteSequence.noteIds),[]);
});
test('Remove Measure updates UI bounds Add Note history persistence JSON and MIDI export without changing notes',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'remove-measure',projectName:'Remove Measure',midiData:{editor:{measureCount:16},tracks:[{part:'melody',notes:[{id:'kept',pitch:64,startTick:120,durationTicks:360,velocity:88}]},{part:'drums',channel:10,notes:[]},{part:'bass',notes:[]}]}});app.setRepository(repo);await repo.put(project);app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),session=app.state.midiEditor,core=window.MusicStudioEditor;
  assert.match(html,/editorAddMeasures\(\).*editorRemoveMeasures\(\)/);assert.match(html,/aria-label="Remove Measure（1小節削除）"/);session.playheadTick=30000;core.setLoopRange(session,26000,30000,true);
  let removed=app.editorRemoveMeasures();assert.equal(removed.measureCount,15);assert.equal(session.playheadTick,28800);assert.equal(session.midiData.editor.loopStart,26000);assert.equal(session.midiData.editor.loopEnd,28800);assert.match(app.state.notice,/1小節削除/);
  removed=app.editorRemoveMeasures();assert.equal(removed.measureCount,14);removed=app.editorRemoveMeasures();assert.equal(removed.measureCount,13);app.editorUndo();assert.equal(session.midiData.editor.measureCount,14);await app.state.midiEditorSavePromise;let stored=await repo.get(project.projectId);assert.equal(stored.midiData.editor.measureCount,14);
  app.editorRedo();await app.state.midiEditorSavePromise;stored=await repo.get(project.projectId);assert.equal(stored.midiData.editor.measureCount,13);assert.deepEqual(Array.from(stored.midiData.tracks.find(track=>track.part==='melody').notes,note=>[note.id,note.pitch,note.startTick,note.durationTicks,note.velocity]),[['kept',64,120,360,88]]);
  app.state.projects=[stored];app.state.midiEditor=null;html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);session=app.state.midiEditor;assert.equal(session.midiData.editor.measureCount,13);assert.match(html,/曲の長さ：13小節/);assert.doesNotMatch(html,/aria-label="Bar 14/);
  let json=await app.exportProject(project.projectId);assert.equal(JSON.parse(json.text).midiData.editor.measureCount,13);let backup=app.backupObject();assert.equal(backup.projects.find(item=>item.projectId===project.projectId).midiData.editor.measureCount,13);
  session.playheadTick=24480;app.editorSetSnap('1/16');assert.equal(app.editorAddNote(),true);assert.equal(app.editorAddNote(),true);assert.equal(app.editorAddNote(),true);assert.equal(app.editorAddNote(),true);assert.equal(app.editorAddNote(),false);assert.match(app.state.notice,/小節を追加してください/);app.editorAddMeasures();assert.equal(session.midiData.editor.measureCount,17);assert.equal(app.editorAddNote(),true);
  const exported=app.midiExportInput({...stored,midiData:session.midiData},'all'),midi=window.MusicStudioMidi.createMidiFile(exported);assert.equal(exported.editor.measureCount,17);assert.equal(exported.totalTick,32640);assert.equal(midi.inspection.totalTick,32640);assert.deepEqual(Array.from(exported.tracks.find(track=>track.part==='melody').notes.filter(note=>note.id==='kept'),note=>[note.pitch,note.startTick,note.durationTicks,note.velocity]),[[64,120,360,88]]);
  await app.state.midiEditorSavePromise;json=await app.exportProject(project.projectId);assert.equal(JSON.parse(json.text).midiData.editor.measureCount,17);backup=app.backupObject();assert.equal(backup.projects.find(item=>item.projectId===project.projectId).midiData.editor.measureCount,17);
});
test('Remove Measure blocks notes in Melody Drums or Bass and reports the four-measure minimum',()=>{
  for(const part of ['melody','drums','bass']){const{app,window}=load(),project=app.makeProject({projectId:`remove-${part}`,projectName:`Remove ${part}`,midiData:{editor:{measureCount:8},tracks:[{part:'melody',notes:[]},{part:'drums',channel:10,notes:[]},{part:'bass',notes:[]}]}});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);window.MusicStudioEditor.selectPart(app.state.midiEditor,part);window.MusicStudioEditor.addNote(app.state.midiEditor,{startTick:13440,durationTicks:120});assert.equal(app.editorRemoveMeasures(),undefined);assert.match(app.state.notice,/削除する小節にノートがあります/);assert.equal(app.state.midiEditor.midiData.editor.measureCount,8)}
  const{app}=load(),project=app.makeProject({projectId:'remove-minimum',projectName:'Remove minimum'});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.equal(app.editorRemoveMeasures(),undefined);assert.match(app.state.notice,/これ以上小節を減らせません/);assert.equal(app.state.midiEditor.undo.length,0);
});
test('selected-note Quantize is independent from Snap and persists through the existing save path',async()=>{
  const{app,window}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'selected-quantize',projectName:'Selected Quantize',midiData:{tracks:[{part:'melody',notes:[{id:'early',pitch:60,startTick:115,durationTicks:251,velocity:91},{id:'late',pitch:64,startTick:125,durationTicks:377,velocity:73},{id:'untouched',pitch:67,startTick:181,durationTicks:480,velocity:88}]}]}});app.setRepository(repo);await repo.put(project);app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),session=app.state.midiEditor,core=window.MusicStudioEditor;assert.match(html,/aria-pressed="false">Quantize OFF/);assert.match(html,/<option value="1\/16" selected>1\/16<\/option>/);assert.match(html,/Snap＝手動編集、Quantize＝録音済み／既存ノートの後補正/);assert.equal(session.view.quantizeEnabled,false);assert.equal(session.view.quantize,'1/16');
  app.editorToggleSnap();assert.equal(session.view.snapEnabled,false);app.editorToggleQuantize();await app.state.midiEditorSavePromise;const before=JSON.stringify(core.currentTrack(session).notes);assert.equal(app.editorApplyQuantize(),undefined);assert.equal(JSON.stringify(core.currentTrack(session).notes),before);assert.match(app.state.notice,/ノートを選択してください/);
  core.selectNote(session,'early');core.selectNote(session,'late',{additive:true});const applied=app.editorApplyQuantize();assert.equal(applied.changed,true);await app.state.midiEditorSavePromise;assert.deepEqual(Array.from(core.currentTrack(session).notes,note=>[note.id,note.startTick,note.durationTicks,note.pitch,note.velocity]),[['early',120,251,60,91],['late',120,377,64,73],['untouched',181,480,67,88]]);app.editorUndo();assert.deepEqual(Array.from(core.currentTrack(session).notes,note=>note.startTick),[115,125,181]);app.editorRedo();await app.state.midiEditorSavePromise;
  const stored=await repo.get(project.projectId);assert.equal(stored.midiData.editor.view.quantizeEnabled,true);assert.equal(stored.midiData.editor.view.quantize,'1/16');app.state.projects=[stored];app.state.midiEditor=null;html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.equal(app.state.midiEditor.view.quantizeEnabled,true);assert.equal(app.state.midiEditor.view.quantize,'1/16');assert.deepEqual(Array.from(core.currentTrack(app.state.midiEditor).notes,note=>note.startTick),[120,120,181]);assert.match(html,/aria-pressed="true">Quantize ON/);
});
test('Snap ON OFF and Grid persist independently with Quantize Count-in and Metronome',async()=>{
  for(const [snapEnabled,grid] of [[false,'1/16'],[true,'1/4']]){
    const{app}=load(),repo=app.memoryRepository(),id=`saved-snap-${snapEnabled}-${grid}`,project=app.makeProject({projectId:id,projectName:id,midiData:{editor:{transport:{countInEnabled:false,metronomeEnabled:false},view:{quantizeEnabled:true,quantize:'1/8'}}}});app.setRepository(repo);await repo.put(project);app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${id}`);
    if(!snapEnabled)app.editorToggleSnap();app.editorSetSnap(grid);await app.state.midiEditorSavePromise;
    const stored=await repo.get(id);assert.equal(stored.midiData.editor.view.snapEnabled,snapEnabled);assert.equal(stored.midiData.editor.view.snap,grid);assert.equal(stored.midiData.editor.view.quantizeEnabled,true);assert.equal(stored.midiData.editor.view.quantize,'1/8');assert.equal(stored.midiData.editor.transport.countInEnabled,false);assert.equal(stored.midiData.editor.transport.metronomeEnabled,false);
    app.state.projects=[stored];app.state.midiEditor=null;app.renderRoute(`music-studio/midi-editor/${id}`);assert.equal(app.state.midiEditor.view.snapEnabled,snapEnabled);assert.equal(app.state.midiEditor.view.snap,grid);assert.equal(app.state.midiEditor.view.quantizeEnabled,true);assert.equal(app.state.midiEditor.view.quantize,'1/8');assert.equal(app.state.midiEditor.midiData.editor.transport.countInEnabled,false);assert.equal(app.state.midiEditor.midiData.editor.transport.metronomeEnabled,false);
  }
});
test('project JSON import and backup restore preserve Snap OFF and ON without a separate format',async()=>{
  for(const snapEnabled of [false,true]){
    const{app}=load(),repo=app.memoryRepository(),id=`snap-json-${snapEnabled}`,project=app.makeProject({projectId:id,projectName:id,midiData:{editor:{view:{snapEnabled,snap:snapEnabled?'1/4':'1/16',quantizeEnabled:true,quantize:'1/8'}}}});app.setRepository(repo);await repo.put(project);app.state.projects=[project];
    const exported=await app.exportProject(id),parsed=JSON.parse(exported.text);assert.equal(parsed.midiData.editor.view.snapEnabled,snapEnabled);assert.equal(parsed.midiData.editor.view.snap,snapEnabled?'1/4':'1/16');
    const imported=await app.importText(exported.text);assert.equal(imported.ok,true);app.state.midiEditor=null;app.state.projects=[imported.project];app.renderRoute(`music-studio/midi-editor/${imported.project.projectId}`);assert.equal(app.state.midiEditor.view.snapEnabled,snapEnabled);assert.equal(app.state.midiEditor.view.snap,snapEnabled?'1/4':'1/16');
    const backup=app.backupObject(),backedUp=backup.projects.find(item=>item.projectId===imported.project.projectId);assert.equal(backedUp.midiData.editor.view.snapEnabled,snapEnabled);assert.equal(backedUp.midiData.editor.view.snap,snapEnabled?'1/4':'1/16');
    const restored=await app.restoreBackup(backup,{settings:false,projects:true});assert.equal(restored.ok,true);const restoredProject=(await repo.list()).find(item=>item.projectName.includes('（復元）')&&item.midiData.editor.view.snapEnabled===snapEnabled);assert.ok(restoredProject);app.state.midiEditor=null;app.state.projects=[restoredProject];app.renderRoute(`music-studio/midi-editor/${restoredProject.projectId}`);assert.equal(app.state.midiEditor.view.snapEnabled,snapEnabled);
  }
});
test('loop ruler supports reverse creation, handle resize, locked-length move, save and clear',async()=>{
  const{app}=load(),repo=app.memoryRepository(),project=app.makeProject({projectId:'loop-range',projectName:'Loop range'});app.setRepository(repo);await repo.put(project);app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-loop-ruler is-disabled" data-loop-enabled="false"[^>]*editorStartLoopRange/);assert.doesNotMatch(html,/music-loop-lane-label|Loop Range（ループ範囲）/);assert.match(html,/空きレーンをドラッグして作成/);assert.doesNotMatch(html,/class="music-loop-bar"|小節選択とは別の再生範囲|\d+–\d+ tick/);assert.match(html,/editorToggleMeasure\(1\)/);
  let selection=null,captured=null,released=null;const ruler={dataset:{totalTicks:'7680'},getBoundingClientRect:()=>({left:0,width:800}),querySelector:()=>selection,insertAdjacentHTML(){selection={style:{}}},setPointerCapture(id){captured=id},hasPointerCapture:id=>captured===id,releasePointerCapture(id){released=id;captured=null}};
  const target=part=>({closest:selector=>selector==='[data-loop-part]'&&part?{dataset:{loopPart:part}}:null});
  app.editorStartLoopRange({button:0,currentTarget:ruler,target:target(null),clientX:700,pointerId:1,preventDefault(){},stopPropagation(){}});ruler.onpointermove({clientX:200});ruler.onpointerup();await app.state.midiEditorSavePromise;
  let loop=app.state.midiEditor.midiData.editor;assert.equal(loop.loopEnabled,true);assert.equal(loop.loopStart,1920);assert.equal(loop.loopEnd,6720);assert.equal(released,1);html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/music-loop-ruler is-enabled" data-loop-enabled="true"/);assert.match(html,/music-loop-selection is-enabled[^>]*data-loop-enabled="true"[^>]*onpointerdown="MusicStudio\.editorStartLoopRange\(event,'move'\)"/);assert.match(html,/music-loop-handle is-start[^>]*onpointerdown="MusicStudio\.editorStartLoopRange\(event,'start'\)"/);assert.match(html,/music-loop-handle is-end[^>]*onpointerdown="MusicStudio\.editorStartLoopRange\(event,'end'\)"/);assert.match(html,/Loop ON（ループ）/);
  selection={style:{}};app.editorStartLoopRange({button:0,currentTarget:ruler,target:target('move'),clientX:500,clientY:10,pointerId:10,preventDefault(){},stopPropagation(){}});ruler.onpointerup({clientX:502,clientY:12,pointerId:10});await app.state.midiEditorSavePromise;loop=app.state.midiEditor.midiData.editor;assert.equal(loop.loopEnabled,false);assert.equal(loop.loopStart,1920);assert.equal(loop.loopEnd,6720);html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/music-loop-ruler is-disabled" data-loop-enabled="false"/);assert.match(html,/aria-pressed="false">Loop OFF（ループOFF）/);
  selection={style:{}};app.editorStartLoopRange({button:0,currentTarget:ruler,target:target('move'),clientX:500,clientY:10,pointerId:11,preventDefault(){},stopPropagation(){}});ruler.onpointerup({clientX:500,clientY:10,pointerId:11});await app.state.midiEditorSavePromise;loop=app.state.midiEditor.midiData.editor;assert.equal(loop.loopEnabled,true);html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/music-loop-ruler is-enabled" data-loop-enabled="true"/);assert.match(html,/aria-pressed="true">Loop ON（ループON）/);
  app.editorToggleLoop();await app.state.midiEditorSavePromise;html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.match(html,/music-loop-ruler is-disabled" data-loop-enabled="false"/);assert.match(html,/music-loop-selection is-disabled[^>]*data-loop-enabled="false"/);assert.match(html,/Loop OFF（ループ）/);assert.match(html,/style="left:25%;width:62\.5%"/);app.editorToggleLoop();await app.state.midiEditorSavePromise;
  selection={style:{}};const touchStartHandle={closest:selector=>selector==='.music-loop-ruler'?ruler:null};app.editorStartLoopRange({button:0,pointerType:'touch',currentTarget:touchStartHandle,target:target('start'),clientX:200,pointerId:2,preventDefault(){},stopPropagation(){}},'start');ruler.onpointermove({pointerType:'touch',clientX:300});ruler.onpointerup({pointerType:'touch'});await app.state.midiEditorSavePromise;
  loop=app.state.midiEditor.midiData.editor;assert.equal(loop.loopStart,2880);assert.equal(loop.loopEnd,6720);
  selection={style:{}};app.editorStartLoopRange({button:0,currentTarget:ruler,target:target('move'),clientX:500,pointerId:3,preventDefault(){},stopPropagation(){}});ruler.onpointermove({clientX:600});ruler.onpointerup();await app.state.midiEditorSavePromise;
  loop=app.state.midiEditor.midiData.editor;assert.equal(loop.loopStart,3840);assert.equal(loop.loopEnd,7680);assert.equal(loop.loopEnabled,true);
  const stored=await repo.get(project.projectId);assert.equal(stored.midiData.editor.loopEnabled,true);assert.equal(stored.midiData.editor.loopStart,3840);assert.equal(stored.midiData.editor.loopEnd,7680);
  app.editorToggleSnap();selection=null;app.editorStartLoopRange({button:0,currentTarget:ruler,target:target(null),clientX:101,pointerId:4,preventDefault(){},stopPropagation(){}});ruler.onpointermove({clientX:203});ruler.onpointerup();await app.state.midiEditorSavePromise;
  loop=app.state.midiEditor.midiData.editor;assert.equal(loop.loopStart,970);assert.equal(loop.loopEnd,1949);
  app.editorClearLoop();await app.state.midiEditorSavePromise;loop=app.state.midiEditor.midiData.editor;assert.equal(loop.loopEnabled,false);assert.equal(loop.loopStart,null);assert.equal(loop.loopEnd,null);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');assert.match(css,/\.music-loop-selection,\.music-loop-handle\{pointer-events:auto\}/);assert.match(css,/\.music-loop-handle\{z-index:12;display:block/);assert.match(css,/\.music-loop-handle\.is-start\{left:2px\}/);assert.match(css,/\.music-loop-handle\.is-end\{right:2px\}/);assert.match(css,/\.music-loop-ruler\.is-enabled \.music-loop-selection\{border-color:#d8b4fe/);assert.match(css,/\.music-loop-ruler\.is-disabled \.music-loop-selection\{border-color:#596579/);assert.match(css,/\.music-loop-selection-label\{[^}]*height:100%;max-height:100%;min-width:0[^}]*overflow:hidden;white-space:nowrap;text-overflow:ellipsis/);assert.match(css,/@container\(max-width:100px\)/);assert.match(css,/@container\(max-width:48px\)/);
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
  assert.match(html,/class="music-loop-ruler is-disabled"/);assert.doesNotMatch(html,/class="music-loop-bar"/);
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
  assert.match(css,/\.music-editor-chrome\{display:flex;min-height:48px;align-items:center;justify-content:center/);
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
  assert.match(css,/\.music-piano-viewport\{height:508px;overflow-x:hidden;overflow-y:auto/);
  assert.match(html,/music-piano-frame" style="--music-piano-row-height:18px;--music-piano-roll-height:2304px/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-roll\{height:var\(--music-piano-roll-height\)/);
  for(const [pitch,y] of [[127,9],[64,1143],[60,1215],[0,2295]]){
    assert.equal(app.pianoYToPitch(app.pianoPitchY(pitch)),pitch);
    assert.match(html,new RegExp(`class="music-midi-note[^>]*data-note-id="[^"]+" data-pitch="${pitch}" style="--pitch-y:${y}px;top:var\\(--pitch-y\\)`));
  }
  for(const pitch of [48,60,61,62,69,72])assert.equal(app.pianoYToPitch(app.pianoPitchY(pitch)),pitch);
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
  assert.match(html,/class="music-piano-key-layer"/);assert.match(html,/class="music-pitch-name-layer"/);assert.match(html,/class="music-pitch-hit-layer"/);
  assert.match(html,/class="music-piano-key is-white" data-pitch="60" style="--pitch-y:1215px"/);assert.match(html,/class="music-piano-key is-black" data-pitch="61" style="--pitch-y:1197px"/);
  const hits=[...html.matchAll(/class="music-pitch-hit" data-pitch="(\d+)" style="--pitch-y:([\d.]+)px"[^>]*editorPreviewPitchFromKey\(event\)/g)].map(match=>({pitch:Number(match[1]),y:Number(match[2])}));assert.equal(hits.length,128);hits.forEach((key,index)=>{assert.equal(key.pitch,127-index);assert.equal(key.y,(index+.5)*18)});
  const visuals=[...html.matchAll(/class="music-piano-key (is-white|is-black)" data-pitch="(\d+)" style="--pitch-y:([\d.]+)px"/g)].map(match=>({kind:match[1],pitch:Number(match[2]),y:Number(match[3])}));assert.equal(visuals.length,128);visuals.forEach((key,index)=>{assert.equal(key.pitch,127-index);assert.equal(key.y,(index+.5)*18);assert.equal(key.kind,[1,3,6,8,10].includes(key.pitch%12)?'is-black':'is-white')});
  assert.match(html,/data-pitch="60"[^>]*><span class="music-pitch-solfege">ド<\/span><span class="music-pitch-separator">／<\/span><span class="music-pitch-note-name"><span class="music-pitch-class">C<\/span><span class="music-pitch-octave">4<\/span>/);assert.match(html,/data-pitch="61"[^>]*><span class="music-pitch-solfege">ド♯<\/span><span class="music-pitch-separator">／<\/span><span class="music-pitch-note-name"><span class="music-pitch-class">C♯<\/span><span class="music-pitch-octave">4<\/span>/);assert.match(html,/data-pitch="69"[^>]*><span class="music-pitch-solfege">ラ<\/span><span class="music-pitch-separator">／<\/span><span class="music-pitch-note-name"><span class="music-pitch-class">A<\/span><span class="music-pitch-octave">4<\/span>/);
  assert.match(css,/\.music-midi-editor-page \.music-pitch-name\{width:70px;max-width:none;min-width:0;gap:0;flex-direction:row;align-items:center;justify-content:center;overflow:hidden;padding:0 2px;font-size:10px/);
  assert.match(css,/\.music-midi-editor-page \.music-pitch-labels \.music-pitch-hit\{top:var\(--pitch-y\)\}/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-key\.is-white\{border-right-color:#9ca3af;border-bottom-color:#cbd5e1;background:linear-gradient\(90deg,#fffef9 0,#f8fafc 76%,#e5e7eb 100%\)/);
  assert.match(css,/\.music-midi-editor-page \.music-pitch-name\.is-white\{background:rgba\(255,254,249,\.94\);color:#111827/);assert.match(css,/\.music-midi-editor-page \.music-pitch-name\.is-black\{background:rgba\(7,12,19,\.92\);color:#f8fafc/);
  assert.doesNotMatch(html,/music-piano-key is-black" data-pitch="(?:60|62|64|65|67|69|71)"/);
  assert.match(html,/>Bar 1<\/button>/);assert.doesNotMatch(html,/>小節 1<\/button>/);
  assert.match(css,/\.music-midi-editor-page\{--music-editor-surface:#0b141f/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-frame\{grid-template-columns:112px minmax\(0,1fr\)\}/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-key-layer,[^}]*\.music-pitch-hit-layer\{position:absolute;top:0/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-key\{position:absolute;top:var\(--pitch-y\);right:auto;left:0/);assert.match(css,/\.music-midi-editor-page \.music-piano-key\.is-white\{z-index:1;width:calc\(100% - 8px\);height:var\(--music-piano-row-height\)/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-key\.is-black\{z-index:2;left:6px;width:60%;height:calc\(var\(--music-piano-row-height\) - 4px\)/);
  assert.match(css,/\.music-midi-editor-page \.music-pitch-hit\{position:absolute;top:var\(--pitch-y\);right:0;left:0;width:100%;height:var\(--music-piano-row-height\)/);
  assert.doesNotMatch(css,/music-piano-key\.(?:is-white|is-black)\.key-/);
  assert.match(css,/\.music-midi-editor-page \.music-midi-note\.is-recording\{z-index:6;min-width:18px;pointer-events:none;border-color:#fca5a5/);assert.match(css,/content:'R';font-size:\.64rem/);assert.match(css,/Record \/ Stop Recording/);
  assert.match(css,/\.music-midi-editor-page \.music-scale-guide span\{background:rgba\(99,102,241,\.09\)\}/);
  assert.match(css,/\.music-midi-editor-page \.music-midi-note\.velocity-high\{[^}]*background:linear-gradient\(180deg,#5b5fe8,#4338ca\)/);
  assert.match(css,/\.music-midi-editor-page \.music-midi-note\.is-selected\{[^}]*background:linear-gradient\(180deg,#c4b5fd,#a78bfa\)/);
  assert.match(css,/@media\(max-width:900px\)\{[^}]*\.music-midi-editor-page \.music-editor-topbar\{gap:7px;padding:7px\}/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-menu\{display:flex;align-items:center;margin:0;padding:0;border:0;background:transparent;box-shadow:none\}/);
  assert.match(css,/@media\(min-width:901px\)\{\.music-midi-editor-page \.music-editor-topbar\{display:flex;align-items:center/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-topbar>\.music-editor-menu,\.music-midi-editor-page \.music-editor-topbar>\.music-editor-save\{width:max-content;max-width:100%;flex:0 0 auto\}/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom section\{min-height:124px;margin:0;padding:14px;border-color:var\(--music-editor-border\);border-radius:12px/);
  assert.match(css,/\.music-midi-editor-page \.music-editor-bottom section>div>button\{flex:0 0 auto;max-width:100%\}/);
  assert.match(html,/<span class="music-record-dot" aria-hidden="true">●<\/span> Record（録音）/);
  for(const label of ['Clear Loop（ループ解除）','Play（再生）','Stop（停止）','Snap ON（スナップON）','Fit Range（音域を表示）','Add Measure（小節を追加）','Select（選択）','Add Note（ノート追加）','Eraser（消しゴム）','Copy（コピー）','Paste（貼り付け）','Duplicate（複製）','Select All（全選択）','Match Length（長さを揃える）','Match Velocity（Velocityを揃える）'])assert.ok(html.includes(label));
  for(const label of ['Project（プロジェクト情報）','Shortcuts（ショートカット）','Import / Export（読み込み／書き出し）','Melody Correction（メロディ補正）','Saved（保存済み）','MIDI入力'])assert.ok(html.includes(label));
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
  assert.match(css,/\.music-piano-corner,\.music-piano-header-scroll\{position:sticky;[^}]*top:0/);
  assert.doesNotMatch(css,/--music-piano-scroll-top/);
});
test('Piano Roll position bar uses the canonical scrollLeft and reports every partially visible measure',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'piano-position',projectName:'Piano position',midiData:{editor:{measureCount:32}}});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),session=app.state.midiEditor;
  const fourMeasures=window.MusicStudioEditor.createSession(app.makeProject({projectId:'four-bars',projectName:'Four bars'}));assert.equal(app.editorVisibleBarRange(fourMeasures,{scrollLeft:0,clientWidth:800,scrollWidth:800}).label,'Bar 1–4 / 4');
  assert.match(html,/class="music-piano-bar-range" aria-live="polite">Bar 1–32 \/ 32<\/output>/);
  assert.match(html,/class="music-piano-scrollbar" tabindex="0" role="scrollbar" aria-label="Piano Roll横スクロール"/);
  assert.equal(app.editorVisibleBarRange(session,{scrollLeft:0,clientWidth:800,scrollWidth:800}).label,'Bar 1–32 / 32');
  assert.equal(app.editorVisibleBarRange(session,{scrollLeft:0,clientWidth:800,scrollWidth:3200}).label,'Bar 1–8 / 32');
  assert.equal(app.editorVisibleBarRange(session,{scrollLeft:800,clientWidth:800,scrollWidth:3200}).label,'Bar 9–16 / 32');
  assert.equal(app.editorVisibleBarRange(session,{scrollLeft:2400,clientWidth:800,scrollWidth:3200}).label,'Bar 25–32 / 32');
  assert.equal(app.editorVisibleBarRange(session,{scrollLeft:750,clientWidth:700,scrollWidth:3200}).label,'Bar 8–15 / 32');
  app.editorZoom(1);assert.equal(app.editorVisibleBarRange(session,{scrollLeft:0,clientWidth:800,scrollWidth:1600}).label,'Bar 1–16 / 32');
  app.editorZoom(-1);assert.equal(app.editorVisibleBarRange(session,{scrollLeft:0,clientWidth:800,scrollWidth:800}).label,'Bar 1–32 / 32');
  app.editorAddMeasures();assert.equal(app.editorVisibleBarRange(session,{scrollLeft:0,clientWidth:800,scrollWidth:800}).label,'Bar 1–36 / 36');
  app.editorRemoveMeasures();assert.equal(app.editorVisibleBarRange(session,{scrollLeft:0,clientWidth:800,scrollWidth:800}).label,'Bar 1–35 / 35');
  const viewport={scrollTop:420,scrollLeft:0,dataset:{initialScrollTop:'0',scrollReady:'true'}},pianoScroll={scrollTop:0,scrollLeft:800,clientWidth:800,scrollWidth:3200,dataset:{scrollReady:'true'},classList:{contains:name=>name==='music-piano-scroll'}},header={scrollLeft:0},attributes={},scrollbar={scrollLeft:0,clientWidth:800,scrollWidth:3200,setAttribute(name,value){attributes[name]=value}},rangeOutput={textContent:''};
  window.requestAnimationFrame=callback=>callback();window.document={querySelector(selector){if(selector==='.music-piano-viewport')return viewport;if(selector==='.music-piano-scroll')return pianoScroll;if(selector==='.music-piano-header-scroll')return header;if(selector==='.music-piano-scrollbar')return scrollbar;if(selector==='.music-piano-bar-range')return rangeOutput;return null}};
  app.editorZoom(0);assert.equal(header.scrollLeft,800);assert.equal(scrollbar.scrollLeft,800);assert.equal(rangeOutput.textContent,'Bar 9–18 / 35');
  pianoScroll.scrollLeft=1600;pianoScroll.onscroll();assert.equal(header.scrollLeft,1600);assert.equal(scrollbar.scrollLeft,1600);assert.equal(session.view.pitchScrollLeft,1600);assert.equal(rangeOutput.textContent,'Bar 18–27 / 35');
  scrollbar.scrollLeft=2400;scrollbar.onscroll();assert.equal(pianoScroll.scrollLeft,2400);assert.equal(header.scrollLeft,2400);assert.equal(session.view.pitchScrollLeft,2400);assert.equal(rangeOutput.textContent,'Bar 27–35 / 35');assert.equal(attributes['aria-valuenow'],'2400');
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');assert.match(css,/\.music-midi-editor-page \.music-piano-position\{display:grid;grid-template-columns:112px minmax\(0,1fr\)/);assert.match(css,/\.music-midi-editor-page \.music-piano-scrollbar\{height:15px;[^}]*overflow-x:auto;overflow-y:hidden/);assert.match(css,/@media\(pointer:coarse\)\{[^}]*\.music-midi-editor-page \.music-piano-position\{padding-block:4px\}/);assert.match(css,/\.music-midi-editor-page \.music-piano-position\{grid-template-columns:94px minmax\(0,1fr\)\}/);assert.match(source,/addEventListener\?\.\('resize',\(\)=>\{scheduleNoteLabelLayout\(\);scheduleEditorPianoPosition\(\)\}/);assert.doesNotMatch(source,/--music-piano-scroll-top/);
});
test('Piano Roll keeps the keyboard fixed horizontally while only the timeline scrolls',()=>{
  const{app}=load(),project=app.makeProject({projectId:'fixed-piano-keyboard',projectName:'Fixed piano keyboard'});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(html,/class="music-piano-frame"[^>]*><div class="music-piano-corner"[^>]*><\/div><div class="music-piano-header-scroll"[\s\S]*?<div class="music-pitch-labels">[\s\S]*?<\/div><div class="music-piano-scroll"><div class="music-piano-content"/);
  assert.match(css,/\.music-piano-viewport\{height:508px;overflow-x:hidden;overflow-y:auto/);
  assert.match(css,/\.music-piano-scroll\{grid-column:2;grid-row:2;min-width:0;overflow-x:auto;overflow-y:clip/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-frame\{grid-template-columns:112px minmax\(0,1fr\)\}/);
  assert.match(css,/\.music-midi-editor-page \.music-piano-frame\{grid-template-columns:94px minmax\(0,1fr\)\}/);
  for(const zoom of [1,2,3,6,10,30]){
    app.state.midiEditor.view.zoom=zoom;
    html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
    assert.match(html,new RegExp(`class="music-piano-content" style="width:${zoom*100}%"`));
    assert.equal((html.match(/class="music-pitch-hit"/g)||[]).length,128);
  }
  const vertical={scrollTop:1215,scrollLeft:0,classList:{contains:name=>name==='music-piano-viewport'}};
  const horizontal={scrollTop:0,scrollLeft:720,classList:{contains:name=>name==='music-piano-scroll'}};
  app.editorRememberPitchScroll(vertical);
  assert.equal(app.state.midiEditor.view.pitchScrollTop,1215);
  assert.equal(app.state.midiEditor.view.pitchScrollLeft,0);
  app.editorRememberPitchScroll(horizontal);
  assert.equal(app.state.midiEditor.view.pitchScrollTop,1215);
  assert.equal(app.state.midiEditor.view.pitchScrollLeft,720);
  horizontal.scrollLeft=5040;
  app.editorRememberPitchScroll(horizontal);
  assert.equal(app.state.midiEditor.view.pitchScrollTop,1215);
  assert.equal(app.state.midiEditor.view.pitchScrollLeft,5040);
  assert.match(html,/class="music-loop-ruler [^"]*"[^>]*data-total-ticks="/);
  assert.match(html,/class="music-playhead" style="left:[^"]+%"/);
});
test('iPad keeps primary editing transport and part controls at safe touch height',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  const marker='/* iPad: restore safe touch targets only for primary editing, transport, and part navigation. */';
  const rule=css.slice(css.indexOf(marker),css.indexOf('/* Keep the timeline',css.indexOf(marker)));
  assert.match(rule,/@media\(min-width:601px\) and \(max-width:1180px\)/);
  assert.match(rule,/\.music-editor-bottom>section:not\(\.music-display-assist\) button/);
  assert.match(rule,/\.music-part-tabs>button,[\s\S]*?\.music-history-controls>button\{height:36px;min-height:36px;padding-block:5px\}/);
  assert.match(rule,/\.music-part-tabs\{min-height:40px;flex-basis:40px\}/);
  assert.doesNotMatch(rule,/\.music-display-assist\s+button/);
});
test('Piano Roll keeps Loop and Bar rulers fixed vertically while they follow horizontal time scrolling',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'fixed-time-ruler',projectName:'Fixed time ruler',midiData:{editor:{measureCount:4,loopEnabled:true,loopStart:480,loopEnd:1440},tracks:[{part:'melody',notes:[{id:'selected',pitch:60,startTick:480,durationTicks:240,velocity:90}]}]}});
  app.state.projects=[project];let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),session=app.state.midiEditor;
  window.MusicStudioEditor.selectNote(session,'selected');
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/\.music-piano-corner,\.music-piano-header-scroll\{position:sticky;[^}]*top:0/);
  assert.match(css,/\.music-piano-header-scroll\{grid-column:2;grid-row:1;min-width:0;overflow:hidden/);
  assert.match(css,/\.music-piano-scroll\{grid-column:2;grid-row:2;min-width:0;overflow-x:auto/);
  assert.match(css,/\.music-loop-ruler\+\.music-measure-row\{top:0\}/);
  assert.doesNotMatch(css,/--music-piano-scroll-top|translateY\(var\(--music-piano-scroll-top/);
  assert.doesNotMatch(source,/style\?\.setProperty\?\.\('--music-piano-scroll-top'/);
  const vertical={scrollTop:0,scrollLeft:0,dataset:{initialScrollTop:'0',scrollReady:'true'},classList:{contains:name=>name==='music-piano-viewport'}};
  const horizontal={scrollTop:0,scrollLeft:0,dataset:{scrollReady:'true'},classList:{contains:name=>name==='music-piano-scroll'}};
  const header={scrollLeft:0};
  window.document={querySelector(selector){if(selector==='.music-piano-viewport')return vertical;if(selector==='.music-piano-scroll')return horizontal;if(selector==='.music-piano-header-scroll')return header;return null}};
  window.requestAnimationFrame=callback=>callback();app.editorZoom(0);
  for(const scrollTop of [0,24,96,384,1536,512,0]){vertical.scrollTop=scrollTop;app.editorRememberPitchScroll(vertical);assert.equal(header.scrollLeft,0)}
  horizontal.scrollLeft=2400;horizontal.onscroll();assert.equal(session.view.pitchScrollLeft,2400);assert.equal(header.scrollLeft,2400);
  for(const zoom of [1,10,30]){
    session.view.zoom=zoom;html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
    assert.match(html,new RegExp(`class="music-piano-content" style="width:${zoom*100}%"`));
    assert.match(html,new RegExp(`class="music-piano-header-content" style="width:${zoom*100}%"`));
    assert.match(html,/class="music-measure has-label [^"]*" style="left:0%;width:25%"[^>]*>Bar 1<\/button>/);
    assert.match(html,/class="music-measure has-label [^"]*" style="left:25%;width:25%"[^>]*>Bar 2<\/button>/);
    assert.match(html,/class="music-loop-selection is-enabled" style="left:6\.25%;width:12\.5%"/);
    assert.match(html,/class="music-playhead" style="left:0%"/);
    assert.match(html,/class="music-selected-pitch-layer"[^>]*><span data-pitch="60"/);
    assert.match(html,/class="music-piano-key is-white is-selected-pitch" data-pitch="60"/);
  }
});
test('long timelines thin measure text by Zoom without removing measure controls or grid geometry',()=>{
  const{app}=load(),project=app.makeProject({projectId:'long-ruler',projectName:'Long ruler',midiData:{editor:{measureCount:93},tracks:[{part:'melody',notes:[]}]}});app.state.projects=[project];
  let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`),labels=[...html.matchAll(/class="music-measure has-label[^>]*>(Bar \d+)<\/button>/g)].map(match=>match[1]);
  assert.equal((html.match(/class="music-measure /g)||[]).length,93);assert.deepEqual(labels.slice(0,5),['Bar 1','Bar 5','Bar 9','Bar 13','Bar 17']);assert.equal(labels.length,24);
  app.editorZoom(1);html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);labels=[...html.matchAll(/class="music-measure has-label[^>]*>(Bar \d+)<\/button>/g)].map(match=>match[1]);
  assert.deepEqual(labels.slice(0,5),['Bar 1','Bar 3','Bar 5','Bar 7','Bar 9']);assert.equal((html.match(/class="music-measure /g)||[]).length,93);
  for(let step=0;step<3;step++)app.editorZoom(1);html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);labels=[...html.matchAll(/class="music-measure has-label[^>]*>(Bar \d+)<\/button>/g)].map(match=>match[1]);
  assert.deepEqual(labels.slice(0,5),['Bar 1','Bar 2','Bar 3','Bar 4','Bar 5']);assert.equal(labels.length,93);assert.match(html,/--measure-size:[^;]+%;--beat-size:[^;]+%;--subdivision-size:/);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');assert.match(css,/\.music-measure\{height:30px;overflow:visible;[^}]*white-space:nowrap/);assert.match(css,/\.music-measure\.has-label\{z-index:1\}/);
});
test('Logic import track assignment uses unified light-surface contrast colors',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','nova-unified-ui.css'),'utf8');
  assert.match(css,/\.is-studio-route \.music-logic-page \.music-import-preview details\{color:var\(--nova-text-body\)\}/);
  assert.match(css,/details :is\(summary,th,dt\)\{color:var\(--nova-text-heading\)\}/);
  assert.match(css,/details :is\(p,td,dd,\.music-help\)\{color:var\(--nova-text-body\)\}/);
});
test('project save restores Zoom, Fit Range, and Piano Roll scroll with legacy defaults',async()=>{
  const{app}=load(),repo=app.memoryRepository(),legacy=app.makeProject({projectId:'saved-editor-view',projectName:'Saved editor view',musicalSettings:{bars:12},midiData:{editor:{measureCount:12,loopEnabled:true,loopStart:0,loopEnd:1920},tracks:[{part:'melody',notes:[{id:'low',pitch:40,startTick:0,durationTicks:480,velocity:90},{id:'high',pitch:82,startTick:960,durationTicks:240,velocity:105}]}]}});
  app.setRepository(repo);await repo.put(legacy);app.state.projects=[legacy];app.renderRoute(`music-studio/midi-editor/${legacy.projectId}`);
  assert.deepEqual(JSON.parse(JSON.stringify(app.state.midiEditor.view)),{zoom:1,pitchMin:37,pitchMax:85,pitchScrollTop:null,pitchScrollLeft:0,snapEnabled:true,snap:'1/16',quantizeEnabled:false,quantize:'1/16'});
  app.editorZoom(1);await app.state.midiEditorSavePromise;
  app.state.midiEditor.view.pitchMin=48;app.state.midiEditor.view.pitchMax=72;
  app.editorFitPitchRange();await app.state.midiEditorSavePromise;
  app.editorRememberPitchScroll({scrollTop:864,scrollLeft:432});await new Promise(resolve=>setTimeout(resolve,350));if(app.state.midiEditorSavePromise)await app.state.midiEditorSavePromise;
  const stored=await repo.get(legacy.projectId);
  assert.deepEqual(JSON.parse(JSON.stringify(stored.midiData.editor.view)),{zoom:2,pitchMin:37,pitchMax:85,pitchScrollTop:864,pitchScrollLeft:432,snapEnabled:true,snap:'1/16',quantizeEnabled:false,quantize:'1/16'});
  assert.equal(stored.midiData.editor.measureCount,12);assert.equal(stored.midiData.editor.loopEnabled,true);assert.equal(stored.midiData.tracks.find(track=>track.part==='melody').notes.length,2);assert.equal(stored.musicalSettings.bars,12);
  app.state.midiEditor=null;app.state.projects=[stored];let html=app.renderRoute(`music-studio/midi-editor/${legacy.projectId}`);
  assert.equal(app.state.midiEditor.view.zoom,2);assert.equal(app.state.midiEditor.view.pitchMin,37);assert.equal(app.state.midiEditor.view.pitchMax,85);assert.equal(app.state.midiEditor.view.pitchScrollTop,864);assert.equal(app.state.midiEditor.view.pitchScrollLeft,432);
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
  assert.match(html,/<details class="music-part-workflow music-drums-workflow"><summary><b>Drum Pad・パターン候補<\/b><span>GM Note 36 \/ 38 \/ 42 \/ 46<\/span><\/summary>/);
  for(const [pitch,name] of [[35,'Acoustic Bass Drum'],[36,'Kick'],[37,'Side Stick'],[38,'Snare'],[39,'Hand Clap'],[40,'Electric Snare'],[41,'Low Floor Tom'],[42,'Closed Hi-Hat'],[43,'High Floor Tom'],[44,'Pedal Hi-Hat'],[45,'Low Tom'],[46,'Open Hi-Hat'],[47,'Low-Mid Tom'],[48,'Hi-Mid Tom'],[49,'Crash Cymbal 1'],[50,'High Tom'],[51,'Ride Cymbal 1']])assert.match(html,new RegExp(`music-drum-name">${name}<\\/span><span class="music-drum-number">${pitch}`));
  for(const [pitch,name] of [[36,'Kick'],[38,'Snare'],[42,'Closed Hi-Hat'],[46,'Open Hi-Hat']]){assert.match(html,new RegExp(`editorDrumInput\\(${pitch}\\).*${name}|${name}[\\s\\S]*editorDrumInput\\(${pitch}\\)`));app.editorDrumInput(pitch)}
  const core=window.MusicStudioEditor,drums=core.currentTrack(app.state.midiEditor);assert.deepEqual(Array.from(drums.notes,note=>note.pitch),[36,38,42,46]);assert.ok(drums.notes.every(note=>note.velocity===100));assert.equal(drums.channel,10);assert.equal(drums.program,null);
  html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);for(const [pitch,name] of [[36,'Kick'],[38,'Snare'],[42,'Closed Hi-Hat'],[46,'Open Hi-Hat']])assert.match(html,new RegExp(`${name} · Note ${pitch}`));
  assert.doesNotMatch(html,/Melody Correction（メロディ補正）|melodyTransposePanel|melodyNoteLengthPanel/);
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');assert.match(css,/\.music-midi-editor-page \.music-drum-pads>button\{height:auto;min-height:44px/);
  app.editorSelectPart('melody');html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);assert.doesNotMatch(html,/music-drum-pitch-name|music-drum-number/);assert.match(html,/Melody Correction（メロディ補正）/);
});
test('Bass Piano Roll identifies track range pitch and program without leaking to Melody or Drums',()=>{
  const{app,window}=load(),project=app.makeProject({projectId:'bass-clarity',projectName:'Bass clarity'});app.state.projects=[project];app.renderRoute(`music-studio/midi-editor/${project.projectId}`);app.editorSelectPart('bass');let html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/class="music-bass-track-status" role="status">Bass Track · Channel 2 · GM Program 32 · Guide E1–G3（Note 28–55）/);assert.match(html,/class="music-bass-range-guide"[^>]*--bass-guide-top:[^;]+;--bass-guide-height:[^;]+/);assert.match(html,/Bass guide E1–G3 · Note 28–55/);
  assert.match(html,/<details class="music-part-workflow music-bass-workflow"><summary><b>Bass候補・参照情報<\/b><span>Channel 2 · GM Program 32<\/span><\/summary>/);assert.doesNotMatch(html,/Melody Correction（メロディ補正）|melodyTransposePanel|melodyNoteLengthPanel/);
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
