const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'nova-unified-ui.css'),'utf8');
const menu=fs.readFileSync(path.join(root,'nova-menu.js'),'utf8');
const style=fs.readFileSync(path.join(root,'style.css'),'utf8');
const musicCss=fs.readFileSync(path.join(root,'music-studio.css'),'utf8');
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

test('shared routes use the Home text hierarchy with dark-surface contrast',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','nova-unified-ui.css'),'utf8');
  for(const token of ['--nova-text-heading:#12395d','--nova-text-body:#153044','--nova-text-muted:#5b7083','--nova-text-action:#12395d','--nova-text-heading-on-dark:#fff','--nova-text-muted-on-dark:#dce8f5'])assert.match(css,new RegExp(token));
  assert.match(css,/\.nova-studio-route-content\) :is\(h1,h2,h3,h4,h5,h6\)\{color:var\(--nova-text-heading\)\}/);
  assert.match(css,/\.music-studio-shell :is\(h1,h2,h3,h4,h5,h6\)\{color:var\(--nova-text-heading-on-dark\)\}/);
  assert.match(css,/input,textarea\)::placeholder\{color:var\(--nova-text-muted\);opacity:1\}/);
});

test('shared route shells reuse the Home width spacing and glass panel tokens',()=>{
  for(const token of [
    '--nova-route-max-width:1120px',
    '--nova-route-inline-padding:.85rem',
    '--nova-route-section-gap:.65rem',
    '--nova-route-panel-padding:1rem',
    '--nova-route-panel-radius:22px',
    '--nova-route-panel-background:rgba(255,255,255,.76)',
    '--nova-route-panel-shadow:0 12px 30px rgba(18,57,93,.12)',
  ])assert.match(css,new RegExp(token.replace(/[().]/g,'\\$&')));
  assert.match(css,/width:min\(100%,var\(--nova-route-max-width\)\)/);
  assert.match(css,/margin:0 0 var\(--nova-route-section-gap\)/);
  assert.match(css,/\.universe-panel,\s*\.nova-studio-route-content,\s*\.nova-unified-content\{[\s\S]*?padding:var\(--nova-route-panel-padding\)!important;[\s\S]*?border-radius:var\(--nova-route-panel-radius\)/);
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?--nova-route-inline-padding:\.65rem;[\s\S]*?--nova-route-panel-padding:\.85rem;[\s\S]*?--nova-route-panel-radius:18px/);
});

test('Music Studio dark common surfaces reuse the exact Home continue gradient token',()=>{
  assert.match(css,/--nova-continue-surface:radial-gradient\(circle at 90% 16%,rgba\(255,247,223,\.42\),transparent 30%\),linear-gradient\(135deg,#12395d,#1c7f94\)/);
  assert.match(style,/\.atelier-continue\{[^}]*background:var\(--nova-continue-surface\)/);
  assert.match(musicCss,/\.is-studio-route \.music-studio-shell :is\(\.music-quick-nav \.music-secondary,\.music-recent,\.music-recent-item,\.music-status-summary div,\.music-feature-card\),\.music-project-page :is\(\.music-project-panel,\.music-project-row\)\{background:var\(--nova-continue-surface\)\}/);
});

test('one shared menu toggle is moved directly into every supported Hero',()=>{
  assert.match(menu,/querySelector\('\.home-only \.atelier-hero, \.universe-main \.atelier-hero, \.nova-unified-main \.atelier-hero, \.nova-studio-route-main \.atelier-hero'\)/);
  assert.match(menu,/if\(toggle\.parentElement!==target\)\(hero\?target\.prepend\(toggle\):target\.appendChild\(toggle\)\)/);
  assert.match(menu,/new MutationObserver\(placeToggle\)\.observe\(document\.querySelector\('#app'\),\{childList:true,subtree:true\}\)/);
  assert.equal((html.match(/class="nova-menu-toggle"/g)||[]).length,1);
});
