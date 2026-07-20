const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','music-studio.js'),'utf8');

function loadMusicStudio(){
  const window={addEventListener(){},location:{hash:'#home'},history:{length:1},managementViewForRoute:route=>`base:${route}`,openApp:()=>{},setView(){},novaReturnHome(){},render(){}};
  window.window=window;
  vm.runInNewContext(source,{window,globalThis:window},{filename:'music-studio.js'});
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
  assert.equal(window.managementViewForRoute('storyArchive'),'base:storyArchive');
});
