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
  assert.equal(app.openWorkAction('export'),true);assert.equal(window.location.hash,'music-studio/mixing-export/a%2Fb');
  app.state.midiInput.recording=true;assert.equal(app.openWorkAction('vocal'),false);assert.equal(window.location.hash,'music-studio/mixing-export/a%2Fb');
});
test('unsubmitted AI input blocks workspace changes and late typing is never repainted away',async()=>{
  const {app,window}=load();let release,paints=0;const input={type:'text',value:'',defaultValue:''};
  window.document={querySelectorAll:()=>[input],querySelector:()=>null};window.render=()=>{paints++};
  input.value='未送信の歌詞';assert.equal((await app.setWorkMode('mix')).ok,false);assert.equal(app.openWorkAction('settings'),false);
  input.value='';app.setRepository({putSettings:()=>new Promise(r=>{release=r})});const pending=app.setWorkMode('record'),before=paints;input.value='保存中に入力した相談';release();assert.equal((await pending).ok,true);assert.equal(paints,before);assert.equal(input.value,'保存中に入力した相談');
});

test('focused vocal route reuses the saved project and guarded explicit-project navigation',async()=>{
 const {app}=load();const p=app.makeProject({projectId:'a/b',projectName:'Vocal <song>'});app.state.projects=[p];app.state.loaded=true;
 const before=JSON.stringify(p),target=app.workActionTarget('vocal',p.projectId);assert.equal(target.route,'music-studio/vocal/a%2Fb');assert.match(app.renderRoute(target.route),/music-vocal-focused/);assert.match(app.vocalFocusedView(p.projectId),/Vocal &lt;song&gt;/);assert.equal(JSON.stringify(p),before);assert.equal(app.openWorkAction('mix','missing'),false);app.vocal.phase='recording';assert.equal(app.openVocalSettings(p.projectId),false);app.vocal.phase='idle';assert.equal(app.openVocalSettings('missing'),false);assert.equal(app.openVocalSettings(p.projectId),true);
});

test('hidden actions persist through backup, retain favorites and never alter project data',async()=>{
 const {app,repo}=load(),p=app.makeProject({projectId:'song',projectName:'Keep'});await repo.put(p);app.state.projects=[p];const before=JSON.stringify(p);
 await app.toggleFavorite('midi');assert.equal((await app.setWorkActionVisible('midi',false)).ok,true);
 assert.deepEqual(plain((await repo.getSettings()).workspace),{hidden:['midi'],mode:'compose',favorites:['midi']});
 assert.doesNotMatch(app.workspaceView(),/onclick="MusicStudio.openWorkAction\('midi'\)"/);
 const backup=app.backupObject();await app.setWorkActionVisible('midi',true);assert.equal((await app.restoreBackup(backup,{settings:true,projects:true})).ok,true);
 assert.deepEqual(plain(app.state.settings.workspace.hidden),['midi']);assert.equal(JSON.stringify(await repo.get('song')),before);
 assert.equal((await app.setWorkActionVisible('midi',true)).ok,true);assert.match(app.workspaceView(),/onclick="MusicStudio.openWorkAction\('midi'\)"/);
 assert.deepEqual(plain(app.state.settings.workspace.favorites),['midi']);
 assert.equal((await app.setWorkActionVisible('evil',false)).ok,false);
 assert.equal((await app.setWorkActionVisible('mix','false')).ok,false);
 assert.deepEqual(plain(app.normalizeWorkspace({hidden:['mix','mix','evil'],favorites:[]})).hidden,['mix']);
});
test('navigation request resolves all screen aliases without executing or sending requests',()=>{
 const {app,window}=load(),before=JSON.stringify(app.state);window.fetch=()=>{throw Error('must not send')};
 for(const [text,id] of [['ＭＩＤＩを編集したい','midi'],['歌詞の画面を開きたい','lyrics'],['編曲を相談','assistant'],['ボーカルを録音','vocal'],['ミックスの画面','mix'],['ハモリを確認','harmony'],['マスタリングを開く','master'],['書き出しをしたい','export'],['バックアップから復元したい','backup'],['設定を開く','settings']])assert.deepEqual(plain(app.resolveWorkRequest(text)),{ok:true,actions:[id]});
 assert.deepEqual(plain(app.resolveWorkRequest('歌詞と録音の画面')), {ok:true,actions:['lyrics','vocal']});
 for(const text of ['',null,{},'x'.repeat(241),'録音しないで','do not export','https://example.test/midi','<script>mix</script>','request','空を見たい'])assert.equal(app.resolveWorkRequest(text).ok,false);
 assert.equal(JSON.stringify(app.state),before);assert.equal(window.location.hash,'#music-studio');
});
test('record count-in, stopping and final export guard workspace navigation and settings',async()=>{
 const {app,window}=load();app.state.projects=[app.makeProject({projectId:'song'})];
 for(const field of ['countingIn','stopping']){app.state.midiInput[field]=true;assert.equal(app.openWorkAction('export','song'),false);assert.equal((await app.setWorkActionVisible('mix',false)).ok,false);app.state.midiInput[field]=false;}
 app.finalExport.busy=true;assert.equal(app.openWorkAction('settings'),false);assert.equal((await app.setWorkMode('mix')).ok,false);app.finalExport.busy=false;
 assert.equal(window.location.hash,'#music-studio');
});
test('failed visibility storage keeps published settings; typed navigation text survives repaint safely',async()=>{
 const {app}=load(),before=JSON.stringify(app.state.settings);app.setRepository({putSettings:async()=>{throw Error('quota')}});
 assert.equal((await app.setWorkActionVisible('mix',false)).ok,false);assert.equal(JSON.stringify(app.state.settings),before);
 app.setWorkRequestText('歌詞 <test>');assert.match(app.workspaceView(),/value="歌詞 &lt;test&gt;"/);
});


test('screen discovery buttons reject a changed project selection',()=>{
 const {app,window}=load();app.state.projects=[app.makeProject({projectId:'first'}),app.makeProject({projectId:'second'})];app.setWorkProject('first');
 app.setWorkProject('second');assert.equal(app.openRequestedWorkAction('midi','first'),false);assert.equal(window.location.hash,'#music-studio');
 assert.equal(app.openRequestedWorkAction('midi','second'),true);assert.equal(window.location.hash,'music-studio/midi-editor/second');
});
