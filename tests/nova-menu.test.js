const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'nova-menu.js'),'utf8');
const css=fs.readFileSync(path.join(root,'nova-menu.css'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const gemini=fs.readFileSync(path.join(root,'gemini-bridge.js'),'utf8');
const archiveHome=fs.readFileSync(path.join(root,'story-archive-home-unified.js'),'utf8');

test('loads the independent menu without removing existing navigation',()=>{
  assert.match(html,/nova-menu\.css/);
  assert.match(html,/nova-menu\.js/);
  assert.match(fs.readFileSync(path.join(root,'app.js'),'utf8'),/<nav>/);
  assert.match(html,/class="nova-menu-toggle"/);
  assert.match(html,/>☰</);
  assert.match(html,/class="nova-menu-label" aria-hidden="true">MENU</);
  assert.match(source,/querySelector\('\.nova-menu-root'\)/);
});

test('menu provides the current Studio and management destinations without legacy controls',()=>{
  const labels=['ホーム','Story Studio','Prompt Studio','Music Studio','Character Studio','Background Studio','Voice Studio','Video Studio','Comic Studio','LINE・SNS Studio','Web Studio','Story Archive','Production Dashboard','Universe','プロジェクト','設定','バックアップ'];
  let previous=-1;
  for(const label of labels){const index=html.indexOf(`>${label}<`);assert.ok(index>previous,`${label} must follow the requested order`);previous=index}
  assert.doesNotMatch(html,/Dream Architect Studio|data-menu-back|>戻る</);
  assert.equal((html.match(/data-menu-close/g)||[]).length,1);
  assert.match(html,/class="nova-menu-close"[^>]*aria-label="メニューを閉じる"><span aria-hidden="true">×<\/span>/);
  assert.match(html,/<details class="nova-menu-group">[\s\S]*?<summary>制作Studio<\/summary>/);
  assert.match(html,/<details class="nova-menu-group">[\s\S]*?<summary>管理・保管<\/summary>/);
  assert.match(html,/<details class="nova-menu-group">[\s\S]*?<summary>その他<\/summary>/);
  assert.equal((html.match(/<details class="nova-menu-group">/g)||[]).length,3);
  assert.match(html,/aria-controls="novaMenuPanel"/);
  assert.match(html,/aria-expanded="false"/);
  assert.match(html,/aria-hidden="true"/);
  assert.match(source,/event\.key==='Escape'/);
  assert.match(source,/event\.key!=='Tab'/);
  assert.match(source,/scrim\.addEventListener\('click',event=>\{event\.preventDefault\(\);closeMenu\(\)\}\)/);
  assert.match(source,/toggle\.setAttribute\('aria-hidden','true'\);[\s\S]*?toggle\.removeAttribute\('aria-hidden'\)/);
  assert.match(source,/if\(restoreFocus\)\{toggle\.focus\(\);setTimeout\(\(\)=>toggle\.focus\(\),0\)\}/);
  assert.match(source,/scrim\.addEventListener\('pointerdown',event=>event\.preventDefault\(\)\)/);
  assert.match(source,/button\.setAttribute\('aria-current','page'\)/);
  assert.match(source,/function toggleGroup\(event\)/);
});

test('the upper-left control is a minimal hamburger and MENU label with a responsive restrained panel',()=>{
  assert.doesNotMatch(html,/class="nova-wordmark"/);
  assert.doesNotMatch(html,/>Nova Studio<\/text>/);
  assert.doesNotMatch(html,/<path d="M16 2l3\.4/);
  assert.doesNotMatch(html,/<circle cx="16"/);
  assert.match(css,/\.nova-menu-bar\{[^}]*display:contents[^}]*background:none[^}]*border:0[^}]*box-shadow:none/);
  assert.match(css,/\.nova-menu-toggle\{[^}]*position:fixed/);
  assert.match(css,/--nova-menu-control:48px/);
  assert.match(css,/\.nova-menu-toggle\{[^}]*border-radius:0!important/);
  assert.match(css,/\.nova-menu-toggle:hover[^}]*background:transparent!important[^}]*brightness\(1\.18\)/);
  assert.match(css,/width:min\(312px,86vw\)/);
  assert.match(css,/pointer-events:none/);
  assert.match(css,/backdrop-filter:blur\(18px\)/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/width:min\(300px,88vw\)/);
  assert.match(source,/function placeToggle\(\)/);
  assert.match(source,/querySelector\('\.home-only \.atelier-hero, \.universe-main \.atelier-hero, \.nova-unified-page \.atelier-hero'\)/);
  assert.match(css,/\.atelier-hero>\.nova-menu-toggle\{[^}]*position:absolute[^}]*top:2px[^}]*left:12px/);
  assert.match(css,/\.atelier-hero>\.nova-menu-toggle\{[^}]*min-width:72px[^}]*min-height:44px[^}]*background:transparent!important[^}]*border-radius:0!important[^}]*box-shadow:none!important/);
  assert.match(css,/\.atelier-hero>\.nova-menu-toggle \.nova-menu-label\{display:block/);
  assert.match(css,/@media\(max-width:760px\)\{:is\(body\.is-home-route,body\.is-universe-route,body\.is-unified-route\) \.atelier-hero>\.nova-menu-toggle\{top:1px;left:8px/);
  assert.match(css,/body:has\(\.nova-menu-root\.is-open\) \.nova-menu-toggle\{opacity:0!important;pointer-events:none\}/);
  assert.match(css,/\.nova-menu-panel button\.is-current\{[^}]*box-shadow:inset 3px 0 #7ee7ff/);
  assert.match(css,/\.nova-menu-toggle\{[^}]*white-space:nowrap/);
  assert.match(css,/\.nova-menu-panel \.nova-menu-group\{[^}]*background:rgba\(255,255,255,\.025\)[^}]*box-shadow:none/);
});

test('home Studio cards use compact, readable dimensions',()=>{
  const style=fs.readFileSync(path.join(root,'style.css'),'utf8');
  assert.match(style,/\.home-only \.atelier-action\{min-height:135px;padding:\.35rem \.6rem/);
  assert.match(style,/\.home-only \.atelier-action \.action-character\{width:min\(100%,86px\);height:68px/);
  assert.match(style,/\.home-only \.atelier-action button\{min-height:40px/);
  assert.match(style,/@media\(max-width:1024px\)\{[\s\S]*?\.home-only \.atelier-action\{[^}]*min-height:86px/);
  assert.match(style,/@media\(max-width:760px\)\{[\s\S]*?\.home-only \.atelier-action\{[^}]*min-height:76px/);
});

test('home fixes the atelier background without showing a background picker',()=>{
  const style=fs.readFileSync(path.join(root,'style.css'),'utf8');
  assert.match(app,/const DEFAULT_HOME_BACKGROUND_ID='fantasyAtelier'/);
  assert.match(app,/document\.body\.dataset\.homeBackground=DEFAULT_HOME_BACKGROUND_ID/);
  assert.doesNotMatch(app,/function homeBackgroundPicker/);
  assert.doesNotMatch(app,/home-top-tools/);
  assert.match(style,/body\[data-home-background="fantasyAtelier"\]\{--home-background-image:url\('\.\/fantasy_atelier_background\.png'\)/);
  assert.match(style,/body\.is-home-route\{background:[^}]*var\(--home-background-image\)[^}]*background-size:auto,cover,auto[^}]*background-position:center[^}]*background-attachment:fixed/);
  assert.doesNotMatch(style,/--home-bg-image/);
  assert.match(archiveHome,/const FIXED_HOME_BACKGROUND='fantasyAtelier'/);
  assert.match(archiveHome,/route==='home'\?BACKGROUNDS\.find\(item=>item\.id===FIXED_HOME_BACKGROUND\):selectedBackground\(\)/);
  assert.match(archiveHome,/classList\.toggle\('is-story-archive-route',route==='storyArchive'\);\s*applyHomeBackground\(\)/);
});

test('home Hero displays the replaceable 4:1 banner without cropping',()=>{
  const style=fs.readFileSync(path.join(root,'style.css'),'utf8');
  assert.match(app,/nova-studio-home-hero-20260804\.png/);
  assert.match(app,/width="1920" height="480"/);
  const finalHome=app.slice(app.lastIndexOf('homeView=function'));
  assert.doesNotMatch(finalHome,/おかえり、ティア/);
  assert.doesNotMatch(finalHome,/Nova_Happy\.png/);
  assert.match(style,/:is\(\.home-only,\.universe-main\)>\.atelier-hero\{[^}]*aspect-ratio:4\/1/);
  assert.match(style,/\.atelier-hero-media img\{[^}]*object-fit:contain/);
});

test('home keeps Gemini and a cute Tia inside the compact Continue card',()=>{
  const style=fs.readFileSync(path.join(root,'style.css'),'utf8');
  const finalHome=app.slice(app.lastIndexOf('homeView=function'));
  assert.doesNotMatch(finalHome,/home-logo-bar|home-logo-subtitle|nova-studio-home-logo-20260804/);
  assert.match(finalHome,/homeHeroSection\(\)[\s\S]*atelier-continue[\s\S]*home-gemini-actions/);
  assert.match(finalHome,/Tia_Chibi_Wink_Heart\.png/);
  assert.match(gemini,/querySelector\('\.home-gemini-actions'\)/);
  assert.match(gemini,/button\.dataset\.geminiBridge = 'home'/);
  assert.match(gemini,/event\.stopPropagation\(\);\s*openPanel\(\)/);
  assert.match(style,/\.home-only \.atelier-continue\{[^}]*min-height:0[^}]*padding:\.6rem \.8rem/);
  assert.match(style,/\.home-only \.atelier-continue dl\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(style,/\.home-gemini-actions\{[^}]*justify-content:flex-end[^}]*width:auto/);
});
