const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('nova-menu.js','utf8');
function fixture(standalone=true){
 const listeners={},calls=[],routes=['home','projects','music-studio','settings','backup','dream-architect'];
 const element=()=>({dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){}});
 const buttons=routes.map(route=>({...element(),dataset:{route},addEventListener(name,fn){listeners[route]=fn}}));
 const toggle=element(),bar=element(),panel={...element(),querySelectorAll(){return buttons}},scrim=element();toggle.parentElement=bar;
 const root={...element(),querySelector(selector){return {'.nova-menu-toggle':toggle,'.nova-menu-bar':bar,'.nova-menu-panel':panel,'.nova-menu-scrim':scrim}[selector]},querySelectorAll(selector){return selector==='[data-route]'?buttons:[]}};
 const location={hash:'#music-studio',href:'http://127.0.0.1:8765/music-studio.html'};
 const api=Object.fromEntries(['goHome','goProjects','goSettings','goBackup'].map(name=>[name,()=>calls.push(name)]));
 const window={MusicStudio:api,addEventListener(){},setView(route){calls.push(route)}};
 const document={body:{dataset:{musicStudioStandalone:String(standalone)}},querySelector(selector){return selector==='.nova-menu-root'?root:null},addEventListener(){}};
 vm.runInNewContext(source,{document,window,location,setTimeout});
 return {click:route=>listeners[route](),location,calls,api};
}
test('standalone menu uses guarded Studio actions without replacing its document',()=>{
 const f=fixture();
 for(const route of ['projects','settings','backup','home','music-studio'])f.click(route);
 assert.deepEqual(f.calls,['goProjects','goSettings','goBackup','goHome','goHome']);
 assert.equal(f.location.href,'http://127.0.0.1:8765/music-studio.html');
 assert.equal(f.location.hash,'#music-studio');
});
test('unavailable API or unsupported standalone route cannot leave the saved document',()=>{
 const f=fixture();delete f.api.goProjects;f.click('projects');f.click('dream-architect');
 assert.deepEqual(f.calls,[]);assert.equal(f.location.href,'http://127.0.0.1:8765/music-studio.html');
});
test('full Nova Studio retains its existing menu routes',()=>{
 const f=fixture(false);f.click('projects');f.click('settings');
 assert.deepEqual(f.calls,['projects','settings']);
});
test('standalone document exposes only packaged destinations',()=>{
 const html=fs.readFileSync('music-studio.html','utf8');
 const routes=[...html.matchAll(/data-route="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(routes,['home','projects','music-studio','backup','settings']);
});
