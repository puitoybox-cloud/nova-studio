const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
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
