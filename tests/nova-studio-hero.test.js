const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'nova-unified-ui.css'),'utf8');
const menu=fs.readFileSync(path.join(root,'nova-menu.js'),'utf8');

const studios=[
  ['story','story-studio','Story Studio'],
  ['prompt','prompt-studio','Prompt Studio'],
  ['music','music-studio','Music Studio'],
  ['character','character-studio','Character Studio'],
  ['background','background-studio','Background Studio'],
  ['voice','voice-studio','Voice Studio'],
  ['video','video-studio','Video Studio'],
  ['comic','comic-studio','Comic Studio'],
  ['line-sns','line-sns-studio','LINE / SNS Studio'],
  ['web','web-studio','Web Studio']
];

test('ten Studio routes are configured through one replaceable Hero catalog',()=>{
  const catalog=app.slice(app.indexOf('const NOVA_STUDIO_HERO_CONFIGS='),app.indexOf('const NOVA_STUDIO_HERO_BY_ROUTE='));
  for(const [studioKey,route,title] of studios){
    assert.match(catalog,new RegExp(`studioKey:'${studioKey}',route:'${route}',title:'${title.replace('/','\\/')}'`));
  }
  assert.equal((catalog.match(/status:'placeholder'/g)||[]).length,10);
  assert.match(app,/const NOVA_STUDIO_HERO_PLACEHOLDER='\.\/assets\/images\/home\/nova-studio-home-hero-20260804\.png'/);
});

test('one Hero renderer owns the shared 1920 by 480 DOM format',()=>{
  const renderer=app.slice(app.indexOf('function renderStudioHero'),app.indexOf('function novaStudioPlaceholderView'));
  assert.match(renderer,/class="atelier-hero studio-route-hero"/);
  assert.match(renderer,/class="atelier-hero-media"/);
  assert.match(renderer,/width="1920" height="480"/);
  assert.match(renderer,/class="studio-hero-copy"/);
  assert.match(renderer,/class="studio-hero-badge"/);
});

test('Studio shell shares route geometry and receives the existing menu toggle',()=>{
  assert.match(css,/:is\(\.atelier-home\.home-only,\.universe-main,\.nova-unified-main,\.nova-studio-route-main\)>\.atelier-hero\{[\s\S]*?aspect-ratio:4\/1[\s\S]*?border-radius:34px/);
  assert.match(css,/\.nova-studio-route-main>\.atelier-hero>\.atelier-hero-media>img\{[\s\S]*?width:100%;[\s\S]*?height:100%;[\s\S]*?object-fit:contain/);
  assert.match(css,/\.studio-route-hero\[data-studio-key="music"\] \.studio-hero-copy\{right:5px;left:auto;width:max-content;max-width:44%\}/);
  assert.match(menu,/\.nova-studio-route-main \.atelier-hero/);
  assert.equal((html.match(/class="nova-menu-toggle"/g)||[]).length,1);
});

test('Home cards and common menu enter the configured Studio routes',()=>{
  for(const [,route] of studios){
    assert.match(app,new RegExp(`setView\\('${route}'\\)`));
    if(route==='music-studio')assert.match(menu,/command==='music-studio'/);
    else assert.match(html,new RegExp(`data-(?:route|command)="${route}"`));
  }
  assert.match(app,/if\(appId==='promptStudio'&&!urlOverride\)return setView\('prompt-studio'\)/);
  assert.match(app,/if\(appId==='voiceStudio'&&!urlOverride\)return setView\('voice-studio'\)/);
});

test('Music Studio keeps the common post-unification Hero shell',()=>{
  const finalLayout=app.slice(app.indexOf('/* Final layout separation'),app.indexOf('/* Story Archive 1.3'));
  const studioBranch=finalLayout.indexOf('if(studioHeroConfigForRoute(v))');
  const legacyShell=finalLayout.indexOf('shell(managementViewForRoute(v))');
  assert.ok(studioBranch>0&&legacyShell>studioBranch);
  assert.match(finalLayout,/function studioHeroConfigForRoute\(route\)[\s\S]*startsWith\('music-studio\/'\)/);
  assert.match(finalLayout,/novaRenderStudioRoute\(v,managementViewForRoute\(v\)\)/);
  assert.match(finalLayout,/if\(v==='story-studio'\)return storyCollectionView\('scenes'\)/);
  assert.match(finalLayout,/if\(v==='character-studio'\)return storyCollectionView\('characters'\)/);
  assert.match(finalLayout,/if\(v==='background-studio'\)return storyCollectionView\('worlds'\)/);
  assert.match(finalLayout,/if\(v==='voice-studio'\)return appWorkspaceView\('voiceStudio'\)/);
  assert.match(finalLayout,/startsWith\('music-studio\/'\)/);
  const studioRenderer=finalLayout.slice(finalLayout.indexOf('function novaRenderStudioRoute'),finalLayout.indexOf('function novaRenderHomeOnly'));
  assert.doesNotMatch(studioRenderer,/management-header|management-layout|management-side|productionFlowNav|flow-guide/);
});
