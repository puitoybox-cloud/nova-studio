const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');

function loadMusicStudio(){
  const classes=new Set();
  const location={hash:'#home'};
  const document={body:{classList:{toggle(name,active){active?classes.add(name):classes.delete(name)},contains:name=>classes.has(name)}}};
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

test('home explains product role, states, and host context',()=>{
  const html=loadMusicStudio().MusicStudio.homeView();
  assert.match(html,/Logic Pro X centered creative support/);
  for(const status of ['使用可能','作業中','未実装'])assert.match(html,new RegExp(status));
  assert.match(html,/Dream Architect Studioから開いています/);
  assert.match(html,/ai-music-helperの保存データを変更しません/);
});

test('standalone home is natural without the host',()=>{
  const html=loadMusicStudio().MusicStudio.homeView({standalone:true});
  assert.match(html,/Music Studioを単体で開いています/);
  assert.match(html,/Nova StudioやDream Architect Studioに接続しなくても/);
});

test('unfinished routes always render safe placeholders with return actions',()=>{
  const app=loadMusicStudio().MusicStudio;
  for(const item of app.FEATURES.filter(item=>!item.action&&!['new-project','recent-projects','settings','backup','logic-pro','midi-composer'].includes(item.id))){
    const html=app.renderRoute(`music-studio/${item.id}`);
    assert.match(html,new RegExp(item.title));
    assert.match(html,/← 戻る/);
    assert.match(html,/次へ →/);
    assert.match(html,/Music Studioホーム/);
    assert.match(html,/既存データを変更/);
  }
  assert.match(app.renderRoute('music-studio/settings'),/Music Studio設定/);
  assert.match(app.renderRoute('music-studio/backup'),/Music Studioバックアップ/);
  assert.match(app.renderRoute('music-studio/logic-pro'),/Logic ProからMIDIを取り込む/);
  assert.match(app.renderRoute('music-studio/midi-composer'),/MIDIエディター/);
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
  assert.match(css,/\.music-flow-nav\{position:relative;top:auto/);
  assert.match(css,/padding-top:env\(safe-area-inset-top\)/);
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
  assert.match(indexSource,/app\.js\?v=1\.4\.12/);
  assert.match(hostSource,/loadMusicStudioScript\('music-studio-midi'.*?\n\s*\.then\(\(\)=>loadMusicStudioScript\('music-studio-midi-parser'[\s\S]*?\n\s*\.then\(\(\)=>loadMusicStudioScript\('music-studio'/);
  assert.match(hostSource,/loadMusicStudioScript\('music-studio-midi-input'/);
  assert.match(hostSource,/loadMusicStudioScript\('music-studio-audio'/);
  assert.match(hostSource,/music-studio\.css\?v=1\.4\.14/);
  assert.match(hostSource,/music-studio-midi-input\.js\?v=1\.4\.1/);
  assert.match(hostSource,/music-studio-editor\.js\?v=1\.4\.6/);
  assert.match(hostSource,/music-studio-audio\.js\?v=1\.4\.7/);
  assert.match(hostSource,/music-studio\.js\?v=1\.4\.26/);
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
  app.state.midiEditor={part:'melody',playheadTick:0,midiData:{ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},tracks:[{part:'melody',notes:[{pitch:60,startTick:0,durationTicks:480,velocity:90}]}]}};
  await app.editorPlayMelody();context.currentTime=20.29;frame();
  assert.equal(Math.round(app.state.midiEditor.playheadTick),240);assert.equal(line.style.left,'3.125%');
  finish();assert.equal(app.state.midiEditor.playheadTick,0);assert.equal(line.style.left,'0%');assert.ok(cancelled.length>0);
  context.currentTime=30;await app.editorPlayMelody();context.currentTime=30.54;frame();assert.equal(Math.round(app.state.midiEditor.playheadTick),480);
  app.editorStopMelody(false);assert.equal(app.state.midiEditor.playheadTick,0);assert.equal(line.style.left,'0%');
});
