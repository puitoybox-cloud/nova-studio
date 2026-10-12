const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const test=require('node:test');
function load(){
  const values=new Map(),window={location:{hash:'#music-studio'},localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},console,Intl,Date,Math,JSON};window.window=window;
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../music-studio.js'),'utf8'),{window,globalThis:window});
  const app=window.MusicStudio,repo=app.memoryRepository();app.setRepository(repo);app.state.loaded=true;app.state.settings=app.defaultSettings();return {app,repo,window};
}
const plain=v=>JSON.parse(JSON.stringify(v));
test('old and malformed settings get a bounded allowlisted workspace',()=>{
  const {app}=load();assert.deepEqual(plain(app.normalizeSettings({}).workspace),{mode:'compose',favorites:[]});
  assert.deepEqual(plain(app.normalizeWorkspace({mode:'toString',favorites:['mix','mix','../../evil','midi','export']})),{mode:'compose',favorites:['mix','midi','export']});
  assert.deepEqual(plain(app.normalizeWorkspace({mode:'finish',favorites:{}})),{mode:'finish',favorites:[]});
});
test('mode and favorites save, reopen and full JSON restore without changing songs',async()=>{
  const {app,repo}=load(),p=app.makeProject({projectId:'song',projectName:'原曲'});await repo.put(p);app.state.projects=[p];const original=JSON.stringify(p);
  app.state.settings.opaqueFuture={version:7};
  assert.equal((await app.setWorkMode('finish')).ok,true);assert.equal((await app.toggleFavorite('export')).ok,true);assert.equal((await app.toggleFavorite('vocal')).ok,true);
  assert.deepEqual(plain((await repo.getSettings()).workspace),{mode:'finish',favorites:['export','vocal']});assert.equal(JSON.stringify(app.state.projects[0]),original);assert.equal(app.state.settings.opaqueFuture.version,7);
  const backup=app.backupObject();assert.equal((await app.toggleFavorite('export')).ok,true);assert.equal((await app.restoreBackup(backup,{settings:true,projects:true})).ok,true);
  assert.deepEqual(plain(app.state.settings.workspace),{mode:'finish',favorites:['export','vocal']});assert.equal((await repo.get('song')).projectName,'原曲');
});
test('workspace rejects dirty edits and active recording, archive and invalid actions',async()=>{
  const {app,repo}=load(),before=JSON.stringify(app.state.settings);app.state.dirty=true;assert.equal((await app.setWorkMode('mix')).ok,false);app.state.dirty=false;
  app.state.midiInput.recording=true;assert.equal((await app.toggleFavorite('mix')).ok,false);app.state.midiInput.recording=false;
  app.archiveTransfer.busy=true;assert.equal((await app.setWorkMode('mix')).ok,false);app.archiveTransfer.busy=false;
  assert.equal((await app.setWorkMode('invalid')).ok,false);assert.equal((await app.toggleFavorite('invalid')).ok,false);assert.equal(JSON.stringify(app.state.settings),before);assert.equal(await repo.getSettings(),null);
});
test('failed storage and duplicate pending writes cannot claim a save',async()=>{
  const {app}=load(),before=JSON.stringify(app.state.settings);app.setRepository({putSettings:async()=>{throw Error('quota')}});
  assert.equal((await app.toggleFavorite('midi')).error,'quota');assert.equal(JSON.stringify(app.state.settings),before);assert.match(app.workspaceView(),/保存できません/);
  let release;app.setRepository({putSettings:()=>new Promise(r=>{release=r})});const pending=app.setWorkMode('mix');assert.equal((await app.toggleFavorite('mix')).error,'workspace-busy');release();assert.equal((await pending).ok,true);
});
test('late dirty state is preserved and repository changes reject stale publication',async()=>{
  const {app}=load();let release;app.setRepository({putSettings:()=>new Promise(r=>{release=r})});const pending=app.setWorkMode('record');app.state.dirty=true;app.state.settingsDraft=app.defaultSettings();app.state.settingsDraft.projectDefaults.notes='keep';release();assert.equal((await pending).ok,true);assert.equal(app.state.dirty,true);assert.equal(app.state.settingsDraft.projectDefaults.notes,'keep');assert.equal(app.state.settingsDraft.workspace.mode,'record');
  app.state.dirty=false;const other=app.setWorkMode('mix');app.setRepository(app.memoryRepository());release();assert.equal((await other).error,'workspace-storage-changed');assert.equal(app.state.settings.workspace.mode,'record');
});
test('navigation uses exact existing project routes and refuses recording or lost projects',()=>{
  const {app,window}=load();app.state.projects=[app.makeProject({projectId:'a/b',projectName:'test'})];
  for(const id of ['midi','assistant','lyrics','vocal','mix','harmony','master','export'])assert.ok(app.workActionTarget(id,'a/b').route.includes('a%2Fb'));
  assert.equal(app.workActionTarget('evil','a/b'),null);assert.equal(app.workActionTarget('midi','missing'),null);
  assert.equal(app.openWorkAction('export'),true);assert.equal(window.location.hash,'music-studio/mixing/a%2Fb');
  app.state.midiInput.recording=true;assert.equal(app.openWorkAction('vocal'),false);assert.equal(window.location.hash,'music-studio/mixing/a%2Fb');
});
