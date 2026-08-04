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
  assert.match(source,/querySelector\('\.nova-menu-root'\)/);
});

test('menu provides all requested destinations and accessible state',()=>{
  for(const label of ['ホーム','プロジェクト','Music Studio','Dream Architect Studio','設定','戻る','閉じる'])assert.match(html,new RegExp(label));
  assert.match(html,/aria-controls="novaMenuPanel"/);
  assert.match(html,/aria-expanded="false"/);
  assert.match(html,/aria-hidden="true"/);
  assert.match(source,/event\.key==='Escape'/);
  assert.match(source,/event\.key!=='Tab'/);
});

test('the upper-left control is hamburger-only with a responsive restrained panel',()=>{
  assert.doesNotMatch(html,/class="nova-wordmark"/);
  assert.doesNotMatch(html,/>Nova Studio<\/text>/);
  assert.doesNotMatch(html,/<path d="M16 2l3\.4/);
  assert.doesNotMatch(html,/<circle cx="16"/);
  assert.match(css,/\.nova-menu-bar\{[^}]*display:contents[^}]*background:none[^}]*border:0[^}]*box-shadow:none/);
  assert.match(css,/\.nova-menu-toggle\{[^}]*position:fixed/);
  assert.match(css,/--nova-menu-control:48px/);
  assert.match(css,/\.nova-menu-toggle\{[^}]*border-radius:0!important/);
  assert.match(css,/\.nova-menu-toggle:hover[^}]*background:transparent!important[^}]*brightness\(1\.18\)/);
  assert.match(css,/width:min\(330px,86vw\)/);
  assert.match(css,/pointer-events:none/);
  assert.match(css,/backdrop-filter:blur\(18px\)/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/width:min\(318px,88vw\)/);
  assert.match(source,/function placeToggle\(\)/);
  assert.match(source,/querySelector\('\.home-only \.atelier-hero'\)/);
  assert.match(css,/\.atelier-hero>\.nova-menu-toggle\{[^}]*position:absolute[^}]*top:12px[^}]*left:12px/);
  assert.match(css,/@media\(max-width:760px\)\{body\.is-home-route \.atelier-hero>\.nova-menu-toggle\{top:8px;left:8px/);
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
  assert.match(style,/\.home-only \.atelier-hero\{[^}]*aspect-ratio:4\/1/);
  assert.match(style,/\.atelier-hero-media img\{[^}]*object-fit:contain/);
});

test('home keeps Gemini and a cute Tia inside the compact Continue card',()=>{
  const style=fs.readFileSync(path.join(root,'style.css'),'utf8');
  const finalHome=app.slice(app.lastIndexOf('homeView=function'));
  assert.doesNotMatch(finalHome,/home-logo-bar|home-logo-subtitle|nova-studio-home-logo-20260804/);
  assert.match(finalHome,/atelier-hero[\s\S]*atelier-continue[\s\S]*home-gemini-actions/);
  assert.match(finalHome,/Tia_Chibi_Wink_Heart\.png/);
  assert.match(gemini,/querySelector\('\.home-gemini-actions'\)/);
  assert.match(gemini,/button\.dataset\.geminiBridge = 'home'/);
  assert.match(gemini,/event\.stopPropagation\(\);\s*openPanel\(\)/);
  assert.match(style,/\.home-only \.atelier-continue\{[^}]*min-height:0[^}]*padding:\.6rem \.8rem/);
  assert.match(style,/\.home-only \.atelier-continue dl\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(style,/\.home-gemini-actions\{[^}]*justify-content:flex-end[^}]*width:auto/);
});
