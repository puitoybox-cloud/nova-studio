const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');

function loadMusicStudio(){
  const classes=new Set();
  const location={hash:'#home'};
  const document={body:{dataset:{},classList:{toggle(name,active){active?classes.add(name):classes.delete(name)},contains:name=>classes.has(name)}}};
  const window={addEventListener(){},location,history:{length:1},managementViewForRoute:route=>`base:${route}`,openApp:()=>{},setView(route){location.hash=`#${route}`},novaReturnHome(){},render(){}};
  window.window=window;
  vm.runInNewContext(source,{window,globalThis:window},{filename:'music-studio.js'});
  window.document=document;
  return window;
}

test('defines all 15 requested home entries and three statuses',()=>{
  const app=loadMusicStudio().MusicStudio;
  assert.equal(app.FEATURES.length,15);
  assert.deepEqual(Array.from(new Set(app.FEATURES.map(item=>item.status))).sort(),['available','planned','working']);
  for(const title of ['新しい音楽プロジェクト','最近使ったプロジェクト','Logic Pro X連携','MIDI Composer','歌詞・音符割付','AI作曲データ取り込み','楽器別MIDI','音色・プラグイン管理','ミックス支援','マスタリング支援','ファイル管理','バックアップ','Music Studio設定','Dream Architect Studioへ戻る','Nova Studioへ送る'])assert.ok(app.FEATURES.some(item=>item.title===title));
});

test('real Music Studio home route starts with project UI and has no legacy hero or Dream Architect display',()=>{
  const html=loadMusicStudio().MusicStudio.renderRoute('music-studio');
  assert.match(html,/Music Studio主要ナビゲーション/);
  assert.match(html,/新しい音楽プロジェクト/);
  assert.match(html,/プロジェクト一覧/);
  assert.match(html,/最近使ったプロジェクト/);
  for(const status of ['使用可能','作業中','未実装'])assert.match(html,new RegExp(status));
  assert.doesNotMatch(html,/class="music-hero"/);
  assert.doesNotMatch(html,/Logic Pro X centered creative support/i);
  assert.doesNotMatch(html,/MS-04 \/ Logic Pro handoff/);
  assert.doesNotMatch(html,/Dream Architect Studio/);
});

test('Music Studio 0.2 exposes beginner guides without changing project storage',()=>{
  const app=loadMusicStudio().MusicStudio,html=app.renderRoute('music-studio');
  assert.match(html,/最初の1曲を作る/);
  assert.match(html,/Music Studio Home ヘルプ/);
  for(const text of ['クラウド同期ではありません','Project全体の外部バックアップ','Logic ProからStandard MIDI File','用語を確認'])assert.match(html,new RegExp(text));
  for(const text of ['ノートの位置や長さをグリッドに合わせます','1\/4＝1拍','Export All MIDI','Fit Range','Add Measure','MIDIキーボードを選択して演奏・録音'])assert.match(source,new RegExp(text));
  assert.match(source,/function openHelp\(id\)/);assert.match(source,/function closeHelp\(id\)/);
  assert.match(source,/const DB_NAME='music-studio-projects'/);assert.match(source,/indexedDB\.open\(DB_NAME,5\)/);
});

test('first-song guide reuses one definition for dialog and named-window route',()=>{
  const window=loadMusicStudio(),app=window.MusicStudio,home=app.renderRoute('music-studio'),guide=app.renderRoute('music-studio/first-song-guide');
  assert.match(home,/ガイドを開く/);assert.match(home,/↗ 別ウィンドウで開く/);assert.match(home,/aria-label="最初の1曲ガイドを別ウィンドウで開く"/);
  for(const text of ['最初の1曲を作る','新しいProjectを作る','クラウド同期ではありません','Export Melody MIDI','Logic ProからStandard MIDI File','用語を確認']){assert.match(home,new RegExp(text));assert.match(guide,new RegExp(text))}
  for(const text of ['プロジェクト名・曲名・BPM・拍子・Keyを設定する','上部の「MIDI入力」を押して使用するMIDIキーボードを選択する','「Record（録音）」を押してMIDIキーボードを弾き、「Stop（停止）」を押して録音を確定する','Piano Rollに録音したノートが表示されたことを確認する','上部の Saved（保存済み）を確認する']){assert.match(home,new RegExp(text));assert.match(guide,new RegExp(text))}
  assert.match(guide,/Music Studio本体へ戻る/);assert.match(source,/'musicStudioFirstSongGuide'/);assert.match(source,/function firstSongGuideContent\(\)/);
  assert.doesNotMatch(source,/openFirstSongWindow[\s\S]{0,500}(repository|indexedDB|makeProject)/);
});

test('unfinished routes always render safe placeholders with return actions',()=>{
  const app=loadMusicStudio().MusicStudio;
  for(const item of app.FEATURES.filter(item=>!item.action&&!['new-project','recent-projects','settings','backup','logic-pro','midi-composer'].includes(item.id))){
    const html=app.renderRoute(`music-studio/${item.id}`);
    assert.match(html,new RegExp(item.title));
    assert.doesNotMatch(html,/← 戻る|次へ →|Back（戻る）|Next（進む）/);
    assert.match(html,/ホームへ戻る/);
    assert.match(html,/既存データを変更/);
  }
  assert.match(app.renderRoute('music-studio/settings'),/Music Studio設定/);
  assert.match(app.renderRoute('music-studio/backup'),/Music Studioバックアップ/);
  assert.match(app.renderRoute('music-studio/logic-pro'),/Logic ProからMIDIを取り込む/);
  app.state.loaded=true;
  const composer=app.renderRoute('music-studio/midi-composer');
  assert.match(composer,/新しい音楽プロジェクト/);
  assert.doesNotMatch(composer,/MIDIエディターを開けません/);
});

test('MIDI Composer uses the guarded project entry and distinguishes a missing editor module',()=>{
  const window=loadMusicStudio(),app=window.MusicStudio;
  assert.match(app.renderRoute('music-studio'),/onclick="MusicStudio\.openMidiEditor\(\)"/);
  assert.equal(app.openMidiEditor(),true);
  assert.equal(window.location.hash,'#music-studio/new-project');
  const project=app.makeProject({projectId:'ipad-project',projectName:'iPad project'});
  app.state.projects=[project];app.state.loaded=true;
  const html=app.renderRoute(`music-studio/midi-editor/${project.projectId}`);
  assert.match(html,/編集モジュールを読み込めませんでした/);
  assert.doesNotMatch(html,/対象のMusic Studioプロジェクトが見つかりません/);
});

test('project routes render real accessible management screens',()=>{
  const app=loadMusicStudio().MusicStudio;
  const create=app.renderRoute('music-studio/new-project');
  assert.match(create,/id="msProjectName"/);
  assert.match(create,/for="msProjectName"/);
  assert.match(create,/value="120"/);
  assert.match(create,/>4\/4</);
  assert.match(create,/>未設定</);
  const list=app.renderRoute('music-studio/recent-projects');
  assert.match(list,/JSONを読み込む/);
  assert.match(list,/プロジェクトを検索/);
  const projectsAlias=app.renderRoute('music-studio/projects');
  assert.match(projectsAlias,/JSONを読み込む/);
  assert.match(projectsAlias,/プロジェクトを検索/);
});

test('host route wrapper preserves unrelated routes',()=>{
  const window=loadMusicStudio();
  assert.equal(window.MusicStudio.installHostRoutes(),true);
  assert.match(window.managementViewForRoute('music-studio'),/Music Studio/);
  assert.equal(window.document.body.classList.contains('is-music-studio-route'),true);
  assert.equal(window.managementViewForRoute('storyArchive'),'base:storyArchive');
  assert.equal(window.document.body.classList.contains('is-music-studio-route'),false);
});

test('host chrome isolation follows home, placeholder, and Nova routes',()=>{
  const window=loadMusicStudio();
  window.MusicStudio.installHostRoutes();
  window.setView('music-studio/logic-pro');
  assert.equal(window.document.body.classList.contains('is-music-studio-route'),true);
  window.setView('home');
  assert.equal(window.document.body.classList.contains('is-music-studio-route'),false);
});

test('Music Studio CSS hides only host chrome on Music Studio routes',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8');
  assert.match(css,/body\.is-music-studio-route \.management-bottom/);
  assert.match(css,/body\.is-music-studio-route \.management-header/);
  assert.doesNotMatch(css,/(^|\n)\.management-bottom\s*\{[^}]*display\s*:\s*none/);
  assert.match(css,/body\.is-music-studio-route \.nova-wordmark\{display:none!important\}/);
  assert.match(css,/\.music-editor-chrome\{display:flex;min-height:56px;align-items:center;justify-content:center;[^}]*background:transparent/);
  assert.match(css,/\.music-editor-chrome \.music-editor-heading\{position:static;display:flex;[^}]*align-items:center;justify-content:center;[^}]*background:transparent/);
});

test('all host Music Studio entrances ignore a configured legacy URL and open the new home',()=>{
  const hostSource=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  assert.match(hostSource,/if\(appId==='musicStudio'&&!urlOverride\)return setView\('music-studio'\)/);
  assert.doesNotMatch(hostSource,/\['promptStudio','musicStudio'\]\.includes\(appId\).*\.url\)return setView\(appId\)/);
});

test('host router renders new Music Studio routes and preserves unrelated routes',()=>{
  const hostSource=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const match=hostSource.match(/function musicStudioHostRouteView[\s\S]*?\n\}/);
  assert.ok(match,'Music Studio host route dispatcher is defined');
  const window={};window.window=window;
  vm.runInNewContext(`${match[0]};window.routeView=musicStudioHostRouteView`,{window,globalThis:window});
  const studio={renderRoute:route=>`music:${route}`};
  assert.equal(window.routeView('music-studio',studio),'music:music-studio');
  assert.equal(window.routeView('music-studio/logic-pro',studio),'music:music-studio/logic-pro');
  assert.equal(window.routeView('storyArchive',studio),null);
  assert.match(window.routeView('music-studio'),/data-music-studio-loading="true"/);
  assert.match(hostSource,/const musicStudioView=musicStudioHostRouteView\(v\)/);
});

test('Music Studio dependencies load sequentially without querying detached scripts',()=>{
  const hostSource=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const indexSource=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const standaloneSource=fs.readFileSync(path.join(__dirname,'..','music-studio.html'),'utf8');
  assert.match(indexSource,/app\.js\?v=1\.5\.26/);
  assert.match(hostSource,/loadMusicStudioScript\('music-studio-midi'.*?\n\s*\.then\(\(\)=>loadMusicStudioScript\('music-studio-midi-parser'[\s\S]*?\n\s*\.then\(\(\)=>loadMusicStudioScript\('music-studio'/);
  assert.match(hostSource,/loadMusicStudioScript\('music-studio-midi-input'/);
  assert.match(hostSource,/loadMusicStudioScript\('music-studio-audio'/);
  assert.match(hostSource,/music-studio\.css\?v=1\.4\.88/);assert.match(standaloneSource,/music-studio\.css\?v=1\.4\.88/);
  assert.match(fs.readFileSync(path.join(__dirname,'..','music-studio.css'),'utf8'),/@media\(min-width:1181px\) and \(max-width:1366px\) and \(orientation:landscape\) and \(hover:none\) and \(pointer:coarse\)/);
  assert.match(standaloneSource,/nova-menu\.css\?v=1\.1\.3/);assert.match(standaloneSource,/nova-menu\.js\?v=1\.0\.2/);
  assert.match(hostSource,/music-studio-midi-input\.js\?v=1\.4\.2/);
  assert.match(hostSource,/music-studio-editor\.js\?v=1\.4\.9/);assert.match(standaloneSource,/music-studio-editor\.js\?v=1\.4\.9/);
  assert.match(hostSource,/music-studio-audio\.js\?v=1\.4\.12/);assert.match(standaloneSource,/music-studio-audio\.js\?v=1\.4\.12/);
  assert.match(hostSource,/music-studio\.js\?v=1\.4\.71/);assert.match(standaloneSource,/music-studio\.js\?v=1\.4\.71/);
  assert.doesNotMatch(hostSource,/const parserScript=document\.querySelector\('script\[data-music-studio-midi-parser\]'\)/);
  assert.match(hostSource,/console\.error\('Music Studio scripts could not be initialized',error\)/);
});

test('Web MIDI state changes keep a stable three-device list and selected input',async()=>{
  const window=loadMusicStudio(),app=window.MusicStudio,inputs=[
    {id:'ur22c-1',name:'Steinberg UR22C ポート1'},
    {id:'ur22c-2',name:'Steinberg UR22C ポート2'},
    {id:'keyboard',name:'MIDI Keyboard'}
  ],access={inputs:new Map(inputs.map(input=>[input.id,input]))};
  let requests=0,paints=0;window.render=()=>{paints++};window.navigator={};window.document.body.dataset={};
  window.MusicStudioMidiInput={isSupported:()=>true,requestAccess:async()=>{requests++;return{supported:true,access,inputs}}};
  await app.editorInitializeMidi();
  assert.equal(requests,1);assert.equal(app.state.midiInput.inputs.length,3);assert.equal(app.state.midiInput.selectedId,'ur22c-1');
  app.editorSelectMidiInput('keyboard');
  const paintsAfterSelection=paints;
  assert.equal(app.state.midiInput.selectedId,'keyboard');
  await app.editorSelectMidiInput('__rescan__');
  assert.equal(requests,1);assert.equal(app.state.midiInput.selectedId,'keyboard');
  access.onstatechange();
  assert.equal(requests,1);assert.equal(paints,paintsAfterSelection+1);assert.equal(app.state.midiInput.selectedId,'keyboard');
  const staleKeyboard=inputs[2],replacementKeyboard={id:'keyboard',name:'MIDI Keyboard'};
  access.inputs.set('keyboard',replacementKeyboard);access.onstatechange();
  assert.equal(staleKeyboard.onmidimessage,null);
  assert.equal(typeof replacementKeyboard.onmidimessage,'function');
  assert.equal(paints,paintsAfterSelection+1);
  access.inputs.delete('ur22c-2');access.onstatechange();
  assert.equal(app.state.midiInput.inputs.length,2);assert.equal(app.state.midiInput.selectedId,'keyboard');assert.equal(paints,paintsAfterSelection+2);
});

test('Record starts for a connected MIDI input and Stop ends the active recording',async()=>{
  const window=loadMusicStudio(),app=window.MusicStudio,input={id:'keystation',name:'Keystation Mini 32 MK3',onmidimessage:null};
  window.document.body.dataset={};window.MusicStudioAudio={createSynth:()=>({supported:()=>true,unlock:async()=>true,allNotesOff(){},stopPlayback(){}})};
  let clock=1000,frame=null,started=0,stopped=0,startTime=0,stopTime=0;window.performance={now:()=>clock};window.requestAnimationFrame=callback=>{frame=callback;return 7};window.cancelAnimationFrame=()=>{frame=null};window.MusicStudioMidiInput={createMessageGate:()=>({reset(){},accept:()=>true}),createRecorder:()=>({start(time){started++;startTime=time},stop(time){stopped++;stopTime=time;return[]}})};
  app.state.midiEditor={part:'melody',playheadTick:960,midiData:{ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},editor:{measureCount:4},tracks:[{part:'melody',name:'Melody',notes:[]}]},view:{}};
  Object.assign(app.state.midiInput,{initialized:true,supported:true,access:{},inputs:[input],selectedId:'keystation',recording:false});
  await app.editorStartMidiRecording({skipCountIn:true});assert.equal(started,1);assert.equal(startTime,1000);assert.equal(app.state.midiInput.recording,true);assert.equal(typeof input.onmidimessage,'function');
  clock=1500;frame();assert.equal(Math.round(app.state.midiEditor.playheadTick),1440);
  assert.equal(typeof app.editorStopTransport,'function');
  clock=1750;await app.editorStopTransport();assert.equal(stopped,1);assert.equal(stopTime,1750);assert.equal(Math.round(app.state.midiEditor.playheadTick),1680);assert.equal(app.state.midiInput.recording,false);assert.equal(frame,null);assert.match(app.state.midiInput.status,/録音を停止/);
});

test('concurrent Melody play requests schedule the note array only once',async()=>{
  const window=loadMusicStudio(),app=window.MusicStudio;
  window.document.body.dataset={};
  let releaseUnlock,playCalls=0,stopCalls=0;
  const unlockGate=new Promise(resolve=>{releaseUnlock=resolve}),synth={
    supported:()=>true,unlock:()=>unlockGate,
    playNotes(notes){playCalls++;assert.equal(notes.length,1);return{ok:true,noteCount:1,durationMs:500}},
    stopPlayback(){stopCalls++}
  };
  window.MusicStudioAudio={createSynth:()=>synth};
  app.state.midiEditor={playheadTick:0,midiData:{ppq:480,tempo:120,tracks:[{part:'melody',notes:[{pitch:60,startTick:0,durationTicks:240,velocity:90}]}]}};
  const first=app.editorPlayMelody(),second=await app.editorPlayMelody();
  assert.equal(second.reason,'already-playing');
  releaseUnlock(true);await first;
  assert.equal(playCalls,1);
  app.editorStopMelody(false);
  assert.equal(stopCalls,2);
});

test('Melody playhead follows AudioContext time and resets on natural end and manual stop',async()=>{
  const window=loadMusicStudio(),app=window.MusicStudio,line={style:{left:'0%'}},context={currentTime:20};
  let frame=null,frameId=0,finish=null,cancelled=[];
  window.document.body.dataset={};window.document.querySelector=selector=>selector==='.music-playhead'?line:null;
  window.requestAnimationFrame=callback=>{frame=callback;return++frameId};window.cancelAnimationFrame=id=>cancelled.push(id);
  window.setTimeout=callback=>{finish=callback;return 9};window.clearTimeout=()=>{};
  const synth={context,supported:()=>true,unlock:async()=>true,stopPlayback(){},playNotes(){return{ok:true,noteCount:1,durationMs:690,playbackStart:context.currentTime+.04,secondsPerTick:60/(120*480),endTick:480}}};
  window.MusicStudioAudio={createSynth:()=>synth};
  app.state.midiEditor={part:'melody',playheadTick:0,midiData:{ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},editor:{transport:{metronomeEnabled:false}},tracks:[{part:'melody',notes:[{pitch:60,startTick:0,durationTicks:480,velocity:90}]}]}};
  await app.editorPlayMelody();context.currentTime=20.29;frame();
  assert.equal(Math.round(app.state.midiEditor.playheadTick),240);assert.equal(line.style.left,'3.125%');
  finish();assert.equal(app.state.midiEditor.playheadTick,0);assert.equal(line.style.left,'0%');assert.ok(cancelled.length>0);
  context.currentTime=30;await app.editorPlayMelody();context.currentTime=30.54;frame();assert.equal(Math.round(app.state.midiEditor.playheadTick),480);
  app.editorStopMelody(false);assert.equal(app.state.midiEditor.playheadTick,0);assert.equal(line.style.left,'0%');
});

test('display assist controls are grouped without changing their actions',()=>{
  for(const className of ['music-assist-snap-controls','music-assist-zoom','music-assist-range-grid'])assert.match(source,new RegExp(className));
  for(const handler of ['editorToggleSnap()','editorSetSnap(this.value)','editorZoom(1)','editorZoom(-1)','editorFitPitchRange()','editorAddMeasures()'])assert.ok(source.includes(`MusicStudio.${handler}`));
  assert.ok(source.indexOf('editorZoom(1)')<source.indexOf('music-assist-zoom-value'));
  assert.ok(source.indexOf('music-assist-zoom-value')<source.indexOf('editorZoom(-1)'));
});
