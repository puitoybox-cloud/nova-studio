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
  assert.match(css,/display:flex!important;visibility:visible!important;opacity:1!important/);
  assert.match(css,/width:min\(340px,86vw\)/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/width:min\(320px,88vw\)/);
});
