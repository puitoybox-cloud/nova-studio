const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'nova-unified-ui.css'),'utf8');
const menu=fs.readFileSync(path.join(root,'nova-menu.js'),'utf8');
const finalLayout=app.slice(app.indexOf('/* Final layout separation'),app.indexOf('/* Final route aliases'));

test('four unified routes are rendered before the legacy management shell',()=>{
  assert.match(finalLayout,/const NOVA_UNIFIED_ROUTES=new Set\(\['storyArchive','productionDashboard','backup','settings'\]\)/);
  const unifiedBranch=finalLayout.indexOf('if(NOVA_UNIFIED_ROUTES.has(v))');
  const shellCall=finalLayout.indexOf('shell(managementViewForRoute(v))');
  assert.ok(unifiedBranch>0&&shellCall>unifiedBranch);
  assert.match(finalLayout,/novaRenderUnifiedRoute\(v,managementViewForRoute\(v\)\);\s*return;/);
});

test('unified route DOM contains one shared Hero and no legacy shell markup',()=>{
  const renderer=finalLayout.slice(finalLayout.indexOf('function novaRenderUnifiedRoute'),finalLayout.indexOf('function novaReturnHome'));
  assert.equal((renderer.match(/homeHeroSection\(\)/g)||[]).length,1);
  assert.match(renderer,/class="nova-unified-main nova-unified-page"/);
  assert.match(renderer,/data-nova-unified-route="\$\{route\}"/);
  assert.match(renderer,/class="nova-unified-content"/);
  assert.doesNotMatch(renderer,/management-(?:header|nav|side|bottom)|productionFlowNav/);
});

test('home and Universe keep their dedicated render paths',()=>{
  assert.match(finalLayout,/if\(v===HOME_ROUTE\)\{\s*novaRenderHomeOnly\(\);\s*return;/);
  assert.match(finalLayout,/document\.body\.classList\.toggle\('is-universe-route',v==='universe'\)/);
  assert.match(finalLayout,/if\(route==='universe'\)\{[\s\S]*?class="universe-main">\$\{homeHeroSection\(\)\}/);
});

test('obsolete shell-wrapping script is no longer loaded',()=>{
  assert.doesNotMatch(html,/nova-unified-ui\.js/);
});

test('unified Hero media and image fill the shared Hero slot',()=>{
  assert.match(css,/\.nova-unified-main>\.atelier-hero>\.atelier-hero-media,[\s\S]*?\{[\s\S]*?display:block;[\s\S]*?width:100%;[\s\S]*?height:100%/);
  assert.match(css,/\.nova-unified-main>\.atelier-hero>\.atelier-hero-media>img,[\s\S]*?\{[\s\S]*?display:block;[\s\S]*?width:100%;[\s\S]*?height:100%;[\s\S]*?object-fit:contain/);
});

test('Home background is shared by Universe unified pages and every Studio route',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','nova-unified-ui.css'),'utf8');
  assert.match(css,/body:is\(\.is-home-route,\.is-management-route\.is-universe-route,\.is-unified-route,\.is-studio-route\)\{[^}]*radial-gradient\(circle at 16% 8%[^}]*fantasy_atelier_background\.png[^}]*center\/cover fixed no-repeat/);
});

test('one shared menu toggle is moved directly into every supported Hero',()=>{
  assert.match(menu,/querySelector\('\.home-only \.atelier-hero, \.universe-main \.atelier-hero, \.nova-unified-main \.atelier-hero, \.nova-studio-route-main \.atelier-hero'\)/);
  assert.match(menu,/if\(toggle\.parentElement!==target\)\(hero\?target\.prepend\(toggle\):target\.appendChild\(toggle\)\)/);
  assert.match(menu,/new MutationObserver\(placeToggle\)\.observe\(document\.querySelector\('#app'\),\{childList:true,subtree:true\}\)/);
  assert.equal((html.match(/class="nova-menu-toggle"/g)||[]).length,1);
});
