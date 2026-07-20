const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','nova-studio-sections.js'),'utf8');

function loadShell(stored={},selection={}){
  const values=new Map(Object.entries(stored));
  const sandbox={
    window:{homeView:()=>'<main></main>',managementViewForRoute:()=>'<p>base</p>',addEventListener(){},location:{hash:''}},
    location:{hash:''},history:{length:1,back(){}},
    localStorage:{getItem:key=>values.has(key)?values.get(key):null},
    state:{apps:[],projects:[],episodes:[],activeContext:{}},
    currentProject:()=>selection.project||null,currentEpisode:()=>selection.episode||null,
    esc:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),
    render(){}
  };
  sandbox.window.window=sandbox.window;
  vm.runInNewContext(source,sandbox,{filename:'nova-studio-sections.js'});
  return sandbox;
}

test('13 app entries are defined once',()=>{
  const shell=loadShell();
  assert.equal(shell.window.DREAM_ARCHITECT_APPS.length,13);
  assert.equal(new Set(shell.window.DREAM_ARCHITECT_APPS.map(app=>app.id)).size,13);
});

test('no selected work shows a safe guidance message',()=>{
  const shell=loadShell();
  const html=shell.window.managementViewForRoute('dream-architect');
  assert.match(html,/Nova Studioから作品が選択されていません/);
  assert.match(html,/外部アプリは未接続です/);
});

test('v2 shared data displays work, episode and counts',()=>{
  const payload={project:{id:'project_1',name:'共有作品'},episode:{id:'episode_2',name:'第2話'},characters:[{characterId:'c1'}],assets:[{assetId:'a1'},{assetId:'a2'}]};
  const shell=loadShell({novaStudio_dreamArchitectLink_v2:JSON.stringify(payload),novaStudio_dreamArchitectResults_v1:JSON.stringify([{resultId:'r1'}])});
  const html=shell.window.managementViewForRoute('dream-architect');
  assert.match(html,/共有作品/);assert.match(html,/project_1/);assert.match(html,/第2話/);
  assert.match(html,/共有キャラクター<\/dt><dd>1件/);assert.match(html,/共有素材<\/dt><dd>2件/);assert.match(html,/受け取り候補<\/dt><dd>1件/);
});

test('legacy data is readable and malformed JSON is non-fatal',()=>{
  const legacy=loadShell({novaStudio_dreamArchitectLink_v1:JSON.stringify({projectName:'旧作品',projectId:'legacy_1',episodeId:'legacy_ep'})});
  assert.match(legacy.window.managementViewForRoute('dream-architect'),/旧作品/);
  const invalid=loadShell({novaStudio_dreamArchitectLink_v2:'{broken'});
  const html=invalid.window.managementViewForRoute('dream-architect');
  assert.match(html,/一部の共有データを読み取れませんでした/);
  assert.match(html,/Nova Studioから作品が選択されていません/);
});

test('unfinished apps use the common preparation page',()=>{
  const shell=loadShell({}, {project:{id:'p1',title:'選択作品'}});
  const html=shell.window.managementViewForRoute('dream-comic');
  assert.match(html,/漫画制作/);assert.match(html,/未実装/);assert.match(html,/選択作品/);
  assert.match(html,/Dream Architect Studioホームへ戻る/);assert.match(html,/Nova Studioへ戻る/);
});
