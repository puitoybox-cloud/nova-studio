const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');

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

test('management cards remain in a separate section and required home areas remain',()=>{
  const management=app.slice(app.indexOf('const HOME_MANAGEMENT='),app.indexOf('function homeCardSection'));
  for(const title of ['Story Archive','Production Dashboard','Universe'])assert.match(management,new RegExp(title));
  assert.match(app,/homeCardSection\('Creative Studios','Studios',HOME_STUDIOS,'studio-section'\)/);
  assert.match(app,/homeCardSection\('Management & Archive','管理・保管',HOME_MANAGEMENT,'management-section'\)/);
  for(const title of ['制作を続ける','最近開いた作品','今日やること','保存状況'])assert.match(app,new RegExp(title));
  assert.match(app,/nova-studio-home-hero-20260804\.png/);
});

test('Mac and iPad share two-column DOM-flow grid and only narrow mobile becomes one column',()=>{
  assert.match(css,/\.atelier-card-section \.atelier-actions\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css,/\.atelier-card-section[\s\S]*?\border\s*:/);
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.atelier-card-section \.atelier-actions\{grid-template-columns:1fr\}/);
});

test('card art mixes Tia and Nova and preserves contained centered images',()=>{
  const catalog=app.slice(app.indexOf('const HOME_STUDIOS='),app.indexOf('const HOME_MANAGEMENT='));
  assert.ok((catalog.match(/Tia_Chibi_/g)||[]).length>=4);
  assert.ok((catalog.match(/Nova_/g)||[]).length>=3);
  assert.match(css,/\.atelier-card-section \.atelier-action \.action-character img\{[\s\S]*?object-fit:contain;[\s\S]*?object-position:center/);
  assert.match(css,/\.atelier-card-section \.atelier-action button\{[^}]*min-height:44px/);
});
