'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function fixture(key='Am'){
 const host={console,Intl,Date,Math,JSON,location:{hash:'#music-studio'},TextEncoder,TextDecoder};host.window=host;
 vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),host);
 const app=host.MusicStudio,repo=app.memoryRepository(),project=app.makeProject({projectId:'key-source',projectName:'Original',bpm:120,key,
  midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},totalTick:1920,
   tempoMap:[{tick:0,bpm:120}],tracks:[{id:'lead',channel:1,notes:[{id:'n',pitch:60,startTick:0,durationTicks:480,velocity:90}]},
    {id:'drums',part:'drums',channel:10,notes:[{id:'d',pitch:36,startTick:0,durationTicks:240,velocity:100}]}]}});
 app.setRepository(repo);app.state.loaded=true;app.state.settings=app.defaultSettings();app.state.projects=[project];
 return {app,repo,project};
}
const plain=x=>JSON.parse(JSON.stringify(x));

test('matching a saved minor-key MIDI material creates a tempo/key-adjusted copy and preserves drum pitches',async()=>{
 const {app,repo,project}=fixture('Am');await repo.put(project);
 const captured=await app.materialCapture(project.projectId,{name:'Night groove',description:'minor piano'});
 assert.equal(captured.ok,true,captured.error);
 const source=JSON.stringify(await repo.get(project.projectId));
 const created=await app.materialCreate(project.projectId,captured.material.id,{targetKey:'Bm',bpm:90,semitones:0});
 assert.equal(created.ok,true,created.error);
 const copy=await repo.get(created.project.projectId);
 assert.equal(copy.musicalSettings.key,'Bm');assert.equal(copy.musicalSettings.bpm,90);
 assert.equal(copy.midiData.tempo,90);assert.equal(copy.midiData.tempoMap[0].bpm,90);
 assert.equal(copy.midiData.tracks[0].notes[0].pitch,62);
 assert.equal(copy.midiData.tracks[1].notes[0].pitch,36);
 assert.equal(copy.productionHistory.at(-1).targetKey,'Bm');
 assert.equal(copy.productionHistory.at(-1).semitones,2);
 assert.equal(JSON.stringify(await repo.get(project.projectId)),source);
 assert.equal(app.validateProject(copy).valid,true);
 const fresh=fixture('C');fresh.app.setRepository(fresh.app.memoryRepository());
 const restored=await fresh.app.restoreBackup(app.backupObject(),{projects:true,settings:false});
 assert.equal(restored.ok,true,restored.message);
 assert.deepEqual(plain(fresh.app.state.projects.find(x=>x.projectId===copy.projectId).midiData),plain(copy.midiData));
});

test('enharmonic aliases use the shortest chromatic interval without changing major/minor quality',()=>{
 const {app}=fixture();
 assert.equal(app.materialKeyShift('C','G'),-5);
 assert.equal(app.materialKeyShift('C♯/D♭','D'),1);
 assert.equal(app.materialKeyShift('Db','C'),-1);
 assert.equal(app.materialKeyShift('Bbm','G#m'),-2);
 assert.equal(app.materialKeyShift('F#','C'),6);
 assert.throws(()=>app.materialKeyShift('C','Am'),/material-key-mode-mismatch/);
 assert.throws(()=>app.materialKeyShift(null,'C'),/material-key-required/);
 assert.throws(()=>app.materialKeyShift('H','C'),/material-key-unsupported/);
});

test('enharmonic respelling clears obsolete MIDI signature while retaining exact pitches',async()=>{
 const {app,repo,project}=fixture('C#');await repo.put(project);
 const captured=await app.materialCapture(project.projectId,{name:'Enharmonic copy'});assert.equal(captured.ok,true);
 const p=await repo.get(project.projectId);p.materialLibrary[0].midiData.keySignatureMap=[{tick:0,sharps:7,minor:false}];
 await repo.put(p);app.state.projects=[p];
 const result=await app.materialCreate(project.projectId,captured.material.id,{targetKey:'Db',bpm:120});
 assert.equal(result.ok,true,result.error);
 assert.equal(result.project.musicalSettings.key,'Db');
 assert.equal(result.project.midiData.tracks[0].notes[0].pitch,60);
 assert.equal(result.project.midiData.keySignatureMap,undefined);
 assert.equal(JSON.stringify(await repo.get(project.projectId)),JSON.stringify(p));
});

test('invalid modes, conflicting manual shifts and unsafe resulting pitches never create a project',async()=>{
 const {app,repo,project}=fixture('C');await repo.put(project);
 const captured=await app.materialCapture(project.projectId,{name:'Unsafe example'});
 assert.equal(captured.ok,true,captured.error);
 const baseline=JSON.stringify(await repo.list());
 for(const [options,reason] of [
  [{targetKey:'Dm',bpm:120},/material-key-mode-mismatch/],
  [{targetKey:'H',bpm:120},/material-key-unsupported/],
  [{targetKey:'D',semitones:1,bpm:120},/material-key-adjustment-conflict/],
  [{targetKey:'D',bpm:500},/material-adjustment-invalid/],
 ]){
  const result=await app.materialCreate(project.projectId,captured.material.id,options);
  assert.equal(result.ok,false);assert.match(result.error,reason);
  assert.equal(JSON.stringify(await repo.list()),baseline);
 }
 const altered=await repo.get(project.projectId);altered.materialLibrary[0].midiData.tracks[0].notes[0].pitch=127;
 await repo.put(altered);app.state.projects=[altered];
 const result=await app.materialCreate(project.projectId,captured.material.id,{targetKey:'D',bpm:100});
 assert.equal(result.ok,false);assert.match(result.error,/material-pitch-range/);
 assert.equal((await repo.list()).length,1);
});

test('material search UI exposes key matching and manual transpose remains backward-compatible',async()=>{
 const {app,repo,project}=fixture('Dm');await repo.put(project);
 const captured=await app.materialCapture(project.projectId,{name:'Solo'});assert.equal(captured.ok,true);
 const html=app.productionToolsView(app.state.projects[0]);
 assert.match(html,/name="targetKey"/);assert.match(html,/同じ長調・短調/);
 assert.match(html,/手動の移調/);
 const result=await app.materialCreate(project.projectId,captured.material.id,{semitones:3,bpm:110});
 assert.equal(result.ok,true,result.error);
 assert.equal(result.project.musicalSettings.key,null,'manual transposition never fabricates a new key declaration');
 assert.equal(result.project.midiData.tracks[0].notes[0].pitch,63);
});
