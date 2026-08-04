const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
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
  for(const title of ['制作を続ける','最近開いた作品','今日やること','保存状況'])assert.match(app,new RegExp(title));
  assert.match(app,/nova-studio-home-hero-20260804\.png/);
});

test('Mac and iPad use five portrait columns and narrow mobile uses two columns',()=>{
  assert.match(css,/\.home-only \.atelier-card-section \.atelier-actions\{\s*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css,/\.home-only \.atelier-card-section \.atelier-action\{[\s\S]*?grid-template-columns:1fr;[\s\S]*?grid-template-rows:76px auto 1fr auto/);
  assert.doesNotMatch(css,/\.atelier-card-section[\s\S]*?\border\s*:/);
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.home-only \.atelier-card-section \.atelier-actions\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('card art mixes Tia and Nova and preserves contained centered images',()=>{
  const catalog=app.slice(app.indexOf('const HOME_STUDIOS='),app.indexOf('const HOME_MANAGEMENT='));
  assert.ok((catalog.match(/Tia_Chibi_/g)||[]).length>=4);
  assert.ok((catalog.match(/Nova_/g)||[]).length>=3);
  assert.match(css,/\.atelier-card-section \.atelier-action \.action-character img\{[\s\S]*?object-fit:contain;[\s\S]*?object-position:center/);
  assert.match(css,/\.atelier-card-section \.atelier-action button\{[^}]*min-height:44px/);
});

test('legacy feature catalogs and Dream Architect entry stay available but are not injected into final home',()=>{
  assert.match(sections,/function sectionCards\(\)/);
  assert.match(sections,/html\.includes\('class="atelier-home home-only"'\)\?html:insertSections\(html\)/);
  assert.match(dreamLink,/function entryCard\(\)/);
  assert.match(dreamLink,/if\(html\.includes\('class="atelier-home home-only"'\)\)return html/);
  const finalHome=app.slice(app.lastIndexOf('homeView=function'));
  assert.doesNotMatch(finalHome,/homeBackupSummary\(\)/);
  assert.match(geminiBridge,/document\.querySelector\('nav:not\(\.atelier-management-links\)'\)/);
});
