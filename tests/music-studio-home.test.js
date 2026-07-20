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
  assert.match(html,/Logic Pro Xを中心/);
  for(const status of ['使用可能','作業中','未実装'])assert.match(html,new RegExp(status));
  assert.match(html,/Dream Architect Studioから開いています/);
  assert.match(html,/ai-music-helperデータは変更しません/);
});

test('standalone home is natural without the host',()=>{
  const html=loadMusicStudio().MusicStudio.homeView({standalone:true});
  assert.match(html,/Music Studioを単体で開いています/);
  assert.match(html,/Nova StudioやDream Architect Studioに接続しなくても/);
});

test('unfinished routes always render safe placeholders with return actions',()=>{
  const app=loadMusicStudio().MusicStudio;
  for(const item of app.FEATURES.filter(item=>!item.action)){
    const html=app.renderRoute(`music-studio/${item.id}`);
    assert.match(html,new RegExp(item.title));
    assert.match(html,/Music Studioホームへ戻る/);
    assert.match(html,/既存データを変更|データを作成・変更しません|プロジェクト保存はMS-02/);
  }
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
});
