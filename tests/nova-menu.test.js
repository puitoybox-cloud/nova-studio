const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'nova-menu.js'),'utf8');
const css=fs.readFileSync(path.join(root,'nova-menu.css'),'utf8');

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

test('SVG wordmark and responsive restrained panel are present',()=>{
  assert.match(html,/<svg viewBox="0 0 238 34"/);
  assert.match(html,/NOVA STUDIO/);
  assert.match(css,/\.nova-menu-bar\{[^}]*display:contents[^}]*background:none[^}]*border:0[^}]*box-shadow:none/);
  assert.match(css,/\.nova-menu-toggle\{[^}]*position:fixed|\.nova-menu-toggle,.nova-wordmark\{position:fixed/);
  assert.match(css,/--nova-menu-control:48px/);
  assert.match(css,/\.nova-wordmark svg\{[^}]*width:160px/);
  assert.match(css,/width:min\(330px,86vw\)/);
  assert.match(css,/pointer-events:none/);
  assert.match(css,/backdrop-filter:blur\(18px\)/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/width:min\(318px,88vw\)/);
});
