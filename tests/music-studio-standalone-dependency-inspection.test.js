const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {inspect}=require('../scripts/music-studio-standalone-dependency-inspection');
test('real Standalone dependencies present; runtime remains unassessed',()=>{const r=inspect(path.resolve(__dirname,'..'));assert.equal(r.valid,true,JSON.stringify(r.issues));assert.ok(r.dependencies.length>20);assert.ok(r.pythonRequirements.includes('demucs>=4,<5'));assert.equal(r.modelAvailability,'unassessed');});
test('missing duplicate remote and traversal detected without writing',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'nova-inspection-'));try{const html='<script src="./missing.js"></script><script src="./missing.js"></script><link href="https://example.invalid/style.css"><script src="./../escape.js"></script>';fs.writeFileSync(path.join(root,'music-studio.html'),html);const r=inspect(root);for(const code of ['missing-dependency','duplicate-dependency','nonlocal-dependency','unsafe-path'])assert.ok(r.issues.some(x=>x.code===code));assert.equal(fs.readFileSync(path.join(root,'music-studio.html'),'utf8'),html);assert.deepEqual(fs.readdirSync(root),['music-studio.html']);}finally{fs.rmSync(root,{recursive:true,force:true});}});

test('a local-looking script cannot escape the bundle through a symlink',()=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'nova-inspection-links-'));
 try{
  const root=path.join(parent,'bundle'),outside=path.join(parent,'outside.js');
  fs.mkdirSync(root);fs.mkdirSync(path.join(root,'assets'));
  fs.writeFileSync(outside,'/* private script, not part of the bundle */');
  fs.symlinkSync(outside,path.join(root,'assets','linked.js'));
  fs.writeFileSync(path.join(root,'music-studio.html'),'<script src="./assets/linked.js"></script>');
  const report=inspect(root);
  assert.equal(report.valid,false);
  assert.ok(report.issues.some(issue=>issue.code==='unsafe-path'&&issue.path==='assets/linked.js'));
  assert.ok(!report.dependencies.some(dep=>dep.path==='assets/linked.js'&&dep.exists));
  assert.equal(fs.readFileSync(outside,'utf8'),'/* private script, not part of the bundle */');
 }finally{fs.rmSync(parent,{recursive:true,force:true});}
});

test('an outside symlink cannot stand in for the Python requirements manifest',()=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'nova-inspection-tooling-'));
 try{
  const root=path.join(parent,'bundle'),outside=path.join(parent,'outside-requirements.txt');
  fs.mkdirSync(root);fs.mkdirSync(path.join(root,'tools'),{recursive:true});
  fs.mkdirSync(path.join(root,'tools','music-audio-pipeline'));
  fs.writeFileSync(path.join(root,'music-studio.html'),'');
  fs.writeFileSync(outside,'external-dependency>=1');
  fs.symlinkSync(outside,path.join(root,'tools','music-audio-pipeline','requirements.txt'));
  const report=inspect(root);
  assert.equal(report.valid,false);
  assert.ok(report.issues.some(issue=>issue.code==='unsafe-path'&&issue.path==='tools/music-audio-pipeline/requirements.txt'));
  assert.ok(!report.dependencies.some(dep=>dep.path==='tools/music-audio-pipeline/requirements.txt'&&dep.exists));
  assert.deepEqual(report.pythonRequirements,[],'must not read an external manifest as bundled requirements');
 }finally{fs.rmSync(parent,{recursive:true,force:true});}
});

test('the HTML entry is rejected if it resolves outside the bundle',()=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'nova-inspection-entry-'));
 try{
  const root=path.join(parent,'bundle'),outside=path.join(parent,'outside.html');
  fs.mkdirSync(root);fs.writeFileSync(outside,'<script src="./outside.js"></script>');
  fs.symlinkSync(outside,path.join(root,'music-studio.html'));
  const report=inspect(root);
  assert.equal(report.valid,false);
  assert.deepEqual(report.issues,[{code:'unsafe-path',path:'music-studio.html'}]);
  assert.deepEqual(report.dependencies,[]);
 }finally{fs.rmSync(parent,{recursive:true,force:true});}
});

test('a symlink to a script inside the bundle is still a local dependency',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nova-inspection-internal-'));
 try{
  fs.writeFileSync(path.join(root,'music-studio.html'),'<script src="./alias.js"></script>');
  fs.writeFileSync(path.join(root,'local.js'),'/* bundled */');
  fs.symlinkSync('local.js',path.join(root,'alias.js'));
  const report=inspect(root);
  assert.ok(report.dependencies.some(dep=>dep.path==='alias.js'&&dep.exists));
  assert.ok(!report.issues.some(issue=>issue.path==='alias.js'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
