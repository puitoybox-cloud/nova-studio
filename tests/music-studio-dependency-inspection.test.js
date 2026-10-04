const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const api=require('../music-studio-dependency-inspection');
const fixture=()=>({format:'music-studio-project',schemaVersion:'1.0',version:1,audioAssets:[{assetId:'voice',storage:{kind:'external-file',reference:'voice.wav',requiresReselection:false},custom:{keep:true}}],fileReferences:[],midiAssets:[],future:{keep:1}});
const codes=p=>api.inspect(p).issues.map(x=>x.code);
test('normal metadata never claims file presence or compatibility',()=>{const p=fixture(),before=JSON.stringify(p);Object.freeze(p);const r=api.inspect(p);assert.equal(r.valid,true);assert.equal(r.assets[0].referenceState,'unverified');assert.equal(r.compatibility,'unassessed');assert.equal(JSON.stringify(p),before);r.assets[0].identity='changed';assert.equal(p.audioAssets[0].assetId,'voice');});
for(const [name,change,expected] of [
 ['missing',p=>p.audioAssets[0].missing=true,'declared-missing'],
 ['duplicate',p=>p.midiAssets.push({...p.audioAssets[0]}),'duplicate-identity'],
 ['unknown',p=>p.schemaVersion='2.0','unknown-version'],
 ['temporary',p=>p.audioAssets[0].storage.reference='blob:dead','temporary-reference'],
 ['malformed',p=>p.audioAssets={},'malformed-collection'],
 ['reselection',p=>p.audioAssets[0].storage.requiresReselection=true,'requires-reselection'],
 ['dependency',p=>p.audioAssets[0].derivedFromAssetId='gone','missing-dependency'],
 ['storage',p=>p.audioAssets[0].storage.kind='future','unknown-storage-kind'],
 ['asset-version',p=>p.audioAssets[0].version=9,'unassessed-asset-version'],
 ['remote',p=>p.audioAssets[0].storage.reference='https://example.invalid/signed?token=secret','remote-reference-unassessed']
])test(name+' reports without mutation',()=>{const p=fixture();change(p);const before=JSON.stringify(p);assert.ok(codes(p).includes(expected));assert.equal(JSON.stringify(p),before);assert.ok(!JSON.stringify(api.inspect(p)).includes('secret'));});
test('malformed records and references',()=>{assert.equal(api.inspect(null).valid,false);const p=fixture();p.audioAssets.push(null,3,{assetId:'x',storage:[]},{assetId:'y',storage:{reference:3}});assert.ok(codes(p).includes('malformed-storage'));assert.ok(codes(p).includes('malformed-reference'));});
test('ambiguous dependency remains unresolved',()=>{const p=fixture();p.midiAssets=[{...p.audioAssets[0]}];p.audioAssets.push({assetId:'derived',derivedFromAssetId:'voice'});assert.ok(codes(p).includes('ambiguous-dependency'));});
test('legacy zero-write and unknown fields',()=>{const p={projectId:'old',unknown:{x:1}};assert.equal(api.inspect(p).assets.length,0);assert.deepEqual(p,{projectId:'old',unknown:{x:1}});});
test('stale and Cancel own no persistent state',()=>{const p=fixture(),s=api.session(p);assert.equal(s.inspect(p).valid,true);p.future.keep++;assert.equal(s.inspect(p).issues[0].code,'stale-project');assert.equal(s.cancel().cancelled,true);assert.equal(s.inspect(p).cancelled,true);});
test('Save/Reopen JSON and Backup retain baseline bytes after inspection',async()=>{
 const window={console,Date,Math,JSON,Intl,setTimeout,clearTimeout};window.window=window;
 vm.runInNewContext(fs.readFileSync(require.resolve('../music-studio.js'),'utf8'),{window,globalThis:window});
 const app=window.MusicStudio,repo=app.memoryRepository();app.setRepository(repo);app.state.settings=app.defaultSettings('2026-10-04T00:00:00.000Z');const p=app.makeProject({projectId:'synthetic',projectName:'Synthetic'});Object.assign(p,fixture());await repo.put(p);app.state.projects=await repo.list();
 const before=JSON.stringify(await repo.get(p.projectId)),exportBefore=(await app.exportProject(p.projectId)).text,backupBefore=app.backupObject();let writes=0;const put=repo.put;repo.put=async p=>{writes++;return put(p)};
 api.inspect(p);api.session(p).inspect(p);
 assert.equal(writes,0);assert.equal(JSON.stringify(await repo.get(p.projectId)),before);assert.equal((await app.exportProject(p.projectId)).text,exportBefore);
 const backupAfter=app.backupObject();delete backupBefore.metadata.createdAt;delete backupAfter.metadata.createdAt;assert.equal(JSON.stringify(backupAfter),JSON.stringify(backupBefore));assert.equal(JSON.stringify(await repo.get(p.projectId)),before);
});
