'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function fixture(){
 const root={console,Date,Math,JSON,Intl,Blob,ArrayBuffer,DataView,Uint8Array,Float32Array,Float64Array,
  crypto:{randomUUID:()=>`audit-${Math.random()}`},location:{hash:'#music-studio'}};
 root.window=root;
 for(const file of ['music-studio-midi.js','music-studio.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),root);
 const app=root.MusicStudio;
 let project=app.makeProject({projectId:'audit-song',projectName:'Audit song'});
 for(const [name,level] of [['Instrument.wav',.02],['Vocal.wav',.01]]){
  const pcm={sampleRate:48000,channels:[Array.from({length:24000},(_,i)=>level*Math.sin(i*Math.PI/17))]};
  project=app.pcmImport(project,pcm,name);
 }
 const repo=app.memoryRepository([project]);app.setRepository(repo);app.state.projects=[project];
 const plan={format:'nova-final-export-plan-v1',targetLufs:-18,ceilingDb:-1,includeMidi:false,
  routes:project.pcmMix.assets.map((asset,index)=>({key:`pcm:${asset.id}`,role:index?'vocal':'instrument',startSeconds:0,gainDb:0,muted:false}))};
 return {app,project,repo,plan};
}

const copy=value=>JSON.parse(JSON.stringify(value));

test('a complete production ZIP embeds a source-specific, read-only audit and never claims rights clearance',async()=>{
 const {app,repo,plan}=fixture(),original=JSON.stringify(await repo.get('audit-song'));
 const result=await app.finalPreview('audit-song',plan);assert.equal(result.ok,true,result.error);
 const {manifest,files}=result.candidate,audit=manifest.audit;
 assert.equal(audit.format,'nova-final-package-audit-v1');
 assert.equal(audit.packageValid,true);
 assert.equal(audit.distributionReady,false);
 assert.deepEqual(copy(audit.errors),[]);
 assert.deepEqual(copy(audit.expectedFiles),['Master.wav','Mix.wav','Instrumental.wav','Vocal-Stem.wav','Instrument-1.wav','Vocal-2.wav']);
 assert.deepEqual(copy(audit.selectedSources),plan.routes.map(route=>({key:route.key,role:route.role})));
 assert.ok(audit.warnings.includes('distribution-rights-not-verified'));
 assert.match(app.finalExport.message,/権利・再配布条件は未確認/);
 assert.deepEqual(JSON.parse(await files.at(-1).blob.text()),copy(manifest));
 assert.equal(JSON.stringify(await repo.get('audit-song')),original,'preview must not persist acceptance, rights or audio changes');
});

test('audit fails closed on every missing, duplicate, unexpected, truncated or mismatched delivery artifact',async()=>{
 const {app,plan}=fixture(),result=await app.finalPreview('audit-song',plan);
 assert.equal(result.ok,true,result.error);
 const source=result.candidate.manifest;
 const changes=[
  [m=>m.files.pop(),/package-missing-file:Vocal-2.wav/],
  [m=>m.files.push(copy(m.files[0])),/package-duplicate-or-invalid-name/],
  [m=>m.files[0].name='Unexpected.wav',/package-unexpected-file:Unexpected.wav/],
  [m=>m.files[0].size--,/package-file-integrity|package-audio-format-or-length/],
  [m=>m.files[0].audio.frames--,/package-audio-format-or-length:Master.wav/],
  [m=>m.files[0].checksum.value='invalid',/package-file-integrity:Master.wav/],
  [m=>m.after.truePeakDb=0,/package-master-meter-invalid/],
  [m=>m.after.clippingSamples=1,/package-master-meter-invalid/],
  [m=>m.after.lufs=null,/package-master-meter-invalid/],
  [m=>delete m.plan.targetLufs,/package-master-loudness-invalid/],
  [m=>m.after.lufs=m.plan.targetLufs-1,/package-master-loudness-inconsistent/],
  [m=>m.targetReached=false,/package-master-loudness-inconsistent/],
 ];
 for(const [change,pattern] of changes){
  const manifest=copy(source);change(manifest);
  const audit=app.finalPackageAudit(manifest);
  assert.equal(audit.packageValid,false,String(pattern));
  assert.equal(audit.distributionReady,false);
  assert.match(audit.errors.join(' | '),pattern);
 }
});

test('muting and Master/Mix-only mode intentionally omit stems without fabricating failed checks',async()=>{
 const {app,plan}=fixture();plan.routes[1].muted=true;
 let result=await app.finalPreview('audit-song',plan);assert.equal(result.ok,true,result.error);
 assert.equal(result.candidate.manifest.audit.packageValid,true);
 assert.deepEqual(copy(result.candidate.manifest.audit.expectedFiles),['Master.wav','Mix.wav','Instrumental.wav','Instrument-1.wav']);
 plan.mixMasterOnly=true;
 result=await app.finalPreview('audit-song',plan);assert.equal(result.ok,true,result.error);
 assert.deepEqual(copy(result.candidate.manifest.audit.expectedFiles),['Master.wav','Mix.wav']);
 assert.ok(result.candidate.manifest.audit.warnings.includes('individual-stems-intentionally-excluded'));
 assert.equal(result.candidate.manifest.audit.distributionReady,false);
});

test('unreached loudness target is disclosed without treating a peak-limited master as a corrupt file',async()=>{
 const {app,plan}=fixture(),result=await app.finalPreview('audit-song',plan);
 assert.equal(result.ok,true,result.error);
 const manifest=copy(result.candidate.manifest);manifest.targetReached=false;
 manifest.after.lufs=manifest.plan.targetLufs-1;
 const audit=app.finalPackageAudit(manifest);
 assert.equal(audit.packageValid,true);
 assert.ok(audit.warnings.includes('master-loudness-target-not-reached'));
 assert.equal(audit.distributionReady,false);
 assert.equal(app.finalPackageAudit(null).packageValid,false);
});
