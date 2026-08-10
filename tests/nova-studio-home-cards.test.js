const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const menuCss=fs.readFileSync(path.join(root,'nova-menu.css'),'utf8');
const sections=fs.readFileSync(path.join(root,'nova-studio-sections.js'),'utf8');
const dreamLink=fs.readFileSync(path.join(root,'dream-architect-link.js'),'utf8');
const geminiBridge=fs.readFileSync(path.join(root,'gemini-bridge.js'),'utf8');

const studios=[
  'Story Studio','Prompt Studio','Music Studio','Character Studio','Background Studio',
  'Voice Studio','Video Studio','Comic Studio','LINE・SNS Studio','Web Studio'
];

test('home exposes all Studio cards in the required DOM order',()=>{
  const catalog=app.slice(app.indexOf('const HOME_STUDIOS='),app.indexOf('const HOME_MANAGEMENT='));
  let previous=-1;
  for(const title of studios){
    const index=catalog.indexOf(`'${title}'`);
    assert.ok(index>previous,`${title} must follow the requested order`);
    previous=index;
  }
  assert.equal((catalog.match(/^  \[/gm)||[]).length,10);
});

test('management destinations use one shared link panel and required home areas remain',()=>{
  const management=app.slice(app.indexOf('const HOME_MANAGEMENT='),app.indexOf('function homeCardSection'));
  for(const title of ['Story Archive','Production Dashboard','Universe'])assert.match(management,new RegExp(title));
  assert.match(app,/homeCardSection\('Creative Studios','Studios',HOME_STUDIOS,'studio-section'\)/);
  assert.match(app,/function homeManagementSection\(\)/);
  assert.match(app,/class="atelier-management-links"/);
  assert.doesNotMatch(app,/homeCardSection\('Management & Archive','管理・保管'/);
  assert.match(app,/制作を続ける/);
  assert.match(app,/nova-studio-home-hero-20260804\.png/);
  const finalHome=app.slice(app.lastIndexOf('homeView=function'),app.indexOf('render=function(){',app.lastIndexOf('homeView=function')));
  for(const title of ['最近開いた作品','今日やること','保存状況'])assert.doesNotMatch(finalHome,new RegExp(title));
});

test('Mac and iPad use five portrait columns and narrow mobile uses two columns',()=>{
  assert.match(css,/\.home-only \.atelier-card-section \.atelier-actions\{\s*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css,/\.home-only \.atelier-card-section \.atelier-action\{[\s\S]*?grid-template-columns:1fr;[\s\S]*?grid-template-rows:64px 35\.4px minmax\(29\.7px,auto\) 44px/);
  assert.match(css,/\.home-only \.atelier-card-section \.atelier-action\{[\s\S]*?gap:\.15rem;[\s\S]*?padding:\.3rem/);
  assert.match(css,/\.home-only \.atelier-card-section \.atelier-action-copy p\{[^}]*line-height:1\.22/);
  assert.doesNotMatch(css,/\.atelier-card-section[\s\S]*?\border\s*:/);
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.home-only \.atelier-card-section \.atelier-actions\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?grid-template-rows:60px 35\.4px minmax\(29\.7px,auto\) 44px/);
});

test('home and Universe share the same responsive outer width rule',()=>{
  assert.match(css,/:root\{--nova-route-max-width:1120px;--nova-route-inline-padding:\.85rem\}/);
  assert.match(css,/:is\(\.atelier-home\.home-only,\.universe-main\)\{width:min\(100%,var\(--nova-route-max-width\)\);max-width:none;margin-inline:auto;padding-inline:var\(--nova-route-inline-padding\)\}/);
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?:root\{--nova-route-inline-padding:\.65rem\}/);
});

test('all shared Hero routes use one final geometry rule',()=>{
  const unified=fs.readFileSync(path.join(root,'nova-unified-ui.css'),'utf8');
  assert.match(unified,/:is\(\.atelier-home\.home-only,\.universe-main,\.nova-unified-main,\.nova-studio-route-main\)\{[\s\S]*?width:min\(100%,var\(--nova-route-max-width\)\);[\s\S]*?padding-top:clamp\(1rem,3vw,2\.4rem\);[\s\S]*?padding-inline:var\(--nova-route-inline-padding\)/);
  assert.match(unified,/:is\(\.atelier-home\.home-only,\.universe-main,\.nova-unified-main,\.nova-studio-route-main\)>\.atelier-hero\{[\s\S]*?aspect-ratio:4\/1;[\s\S]*?margin:0 0 var\(--nova-route-section-gap\);[\s\S]*?padding:0;[\s\S]*?border-radius:34px/);
  assert.match(unified,/@media\(max-width:760px\)\{[\s\S]*?--nova-route-inline-padding:\.65rem;[\s\S]*?padding-top:\.85rem[\s\S]*?border-radius:24px/);
});

test('card art mixes Tia and Nova and preserves contained centered images',()=>{
  const catalog=app.slice(app.indexOf('const HOME_STUDIOS='),app.indexOf('const HOME_MANAGEMENT='));
  assert.ok((catalog.match(/Tia_Chibi_/g)||[]).length>=4);
  assert.ok((catalog.match(/Nova_/g)||[]).length>=3);
  assert.match(css,/\.atelier-card-section \.atelier-action \.action-character img\{[\s\S]*?object-fit:contain;[\s\S]*?object-position:center/);
  assert.match(css,/\.atelier-card-section \.atelier-action button\{[^}]*min-height:44px/);
  assert.match(app,/nova-action-character/);
  assert.match(css,/\.nova-action-character img\{transform:scale\(\.8\)/);
});

test('Universe uses one home-style panel with compact context filters and zoom controls',()=>{
  assert.match(app,/class="atelier-card-section universe-panel"/);
  assert.match(app,/function homeHeroSection\(\)/);
  assert.match(app,/class="universe-main">\$\{homeHeroSection\(\)\}/);
  assert.doesNotMatch(app,/class="universe-return-home"/);
  assert.match(app,/class="universe-context"/);
  assert.match(app,/class="universe-filters"/);
  assert.match(app,/aria-pressed="\$\{on\}"/);
  assert.match(app,/class="universe-zoom"/);
  assert.match(app,/if\(route==='universe'\)\{[\s\S]*?return;/);
  assert.match(css,/body\.is-management-route\.is-universe-route\{[^}]*fantasy_atelier_background\.png/);
  assert.match(menuCss,/:is\(body\.is-home-route,body\.is-universe-route,body\.is-unified-route,body\.is-studio-route\) \.atelier-hero>\.nova-menu-toggle\{[^}]*min-width:72px[^}]*min-height:44px/);
  assert.match(css,/\.universe-main \.universe\{height:var\(--universe-desktop-height\)/);
  assert.match(app,/unlinked\.length\?`<section class="universe-unlinked"/);
});

test('legacy feature catalogs and Dream Architect entry stay available but are not injected into final home',()=>{
  assert.match(sections,/function sectionCards\(\)/);
  assert.match(sections,/html\.includes\('class="atelier-home home-only"'\)\?html:insertSections\(html\)/);
  assert.match(dreamLink,/function entryCard\(\)/);
  assert.match(dreamLink,/if\(html\.includes\('class="atelier-home home-only"'\)\)return html/);
  const finalHome=app.slice(app.lastIndexOf('homeView=function'));
  assert.doesNotMatch(finalHome,/homeBackupSummary\(\)/);
  assert.match(geminiBridge,/document\.querySelector\('nav:not\(\.atelier-management-links\)'\)/);
  assert.match(geminiBridge,/document\.querySelector\('header:not\(\.universe-header\)'\)/);
});
