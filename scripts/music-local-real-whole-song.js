// Explicit 480-second, 144-bar fixture through the production whole-song path.
// Requires licensed local weights. Never substitutes a mock model.
const fs=require('node:fs'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const fixture=new Function('require',fs.readFileSync('tests/music-studio-ai-midi-candidate-import.test.js','utf8').split('\ntest(')[0]+'\nreturn fixture;')(require);
const base='http://127.0.0.1:8768',report={testedCommit:process.env.NOVA_TESTED_HEAD||null,version:1,completed:false,fixture:true,seconds:480,bars:144,bpm:72,ppq:480,sourceNotes:576,measurements:[]},started=performance.now();
const server=spawn(process.env.PYTHON||'python',['tools/music-local-generation/serve.py','--port','8768','--weights',process.env.NOVA_MODEL_WEIGHTS||'/missing-model'],{stdio:['ignore','pipe','inherit']});
function attach(f,pause){
 f.w.location.hostname='127.0.0.1';f.w.atob=atob;
 f.w.fetch=async(url,options={})=>{
  if(pause&&url.endsWith('/compose')&&report.measurements.length===72)throw Error('injected-midpoint-disconnection');
  const response=await fetch(base+url,{...options,headers:{...options.headers,...(options.method==='POST'?{Origin:base}:{})}});
  if(url.endsWith('/compose')&&response.ok){const result=await response.clone().json();assert.ok(result.performance.onnxCalls.base>0&&result.performance.onnxCalls.token>0);report.measurements.push(result.performance);console.log(JSON.stringify({bar:report.measurements.length,performance:result.performance}));}
  return response;
 };
}
(async()=>{try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('host exited '+code)))});
 const f=fixture();f.s.midiData.editor.measureCount=144;f.s.midiData.tempo=72;
 f.s.midiData.tracks[0].notes=Array.from({length:576},(_,i)=>({id:'source-'+i,pitch:[60,64,67,64][i%4],startTick:i*480,durationTicks:360,velocity:80}));
 const record=f.panel._states.get(f.p.projectId);record.state.workspace.sectionArrangements=[{range:f.core.measureRangeToTicks({startMeasure:1,endMeasure:144},f.s.midiData),name:'verse',density:'normal',roles:['piano','bass','strings','drums'],targets:{}}];
 const before=JSON.stringify(f.s.midiData),repo=f.a.memoryRepository();f.a.setRepository(repo);await repo.put(f.p);attach(f,true);
 await f.panel.generateWholeSong(f.p.projectId,false,true);
 assert.equal(record.state.workspace.wholeSongCheckpoint?.results.length,72,record.message);
 assert.equal(JSON.stringify(f.s.midiData),before);
 const stored=await repo.get(f.p.projectId);assert.equal(stored.aiWorkspace.wholeSongCheckpoint.results.length,72);
 const midpointBackup=f.a.backupObject();
 report.midpointCheckpointBytes=Buffer.byteLength(JSON.stringify(stored.aiWorkspace.wholeSongCheckpoint));
 const g=fixture(),rr=g.a.memoryRepository();g.a.setRepository(rr);
 assert.equal((await g.a.restoreBackup(f.a.backupObject(),{settings:false,projects:true})).ok,true);
 const restored=await rr.get(f.p.projectId);g.a.state.projects=[restored];g.a.state.midiEditor=g.core.createCoordinatedSession(restored);g.panel.render(restored,g.a.state.midiEditor,g.core);attach(g,false);
 await g.panel.generateWholeSong(restored.projectId,true,true);
 const r=g.panel._states.get(restored.projectId),set=r.state.workspace.candidateSets.at(-1);assert.ok(set,r.message);assert.equal(set.candidates.length,3);assert.equal(report.measurements.length,144);assert.equal(JSON.stringify(g.a.state.midiEditor.midiData),before);
 report.generatedNotes=set.candidates.map(c=>({variant:c.value.variant,notes:c.value.ensemble.wholeSong.parts.reduce((n,p)=>n+p.importedMidi.notes.length,0)}));
 const saved=await rr.get(restored.projectId);assert.equal(saved.aiWorkspace.wholeSongCheckpoint,undefined);report.savedProjectBytes=Buffer.byteLength(JSON.stringify(saved));
 if(process.env.NOVA_WHOLE_SONG_FIXTURE)fs.writeFileSync(process.env.NOVA_WHOLE_SONG_FIXTURE,JSON.stringify({testedCommit:report.testedCommit,sourceMidi:JSON.parse(before),midpointBackup,project:saved}));
 report.completed=true;report.backupReopenResume=true;report.originalMidiUnchanged=true;
}catch(error){report.error=error.stack;process.exitCode=1;}finally{
 report.elapsedSeconds=(performance.now()-started)/1000;
 report.onnxCalls=report.measurements.reduce((a,p)=>({base:a.base+p.onnxCalls.base,token:a.token+p.onnxCalls.token}),{base:0,token:0});
 report.midiBytes=report.measurements.reduce((n,p)=>n+p.midiBytes,0);
 report.processPeakRssBytes=report.measurements.length?Math.max(...report.measurements.map(p=>p.memoryAfter.processPeakRssBytes)):null;report.memoryScope='Python host process lifetime';
 fs.writeFileSync(process.env.NOVA_WHOLE_SONG_REPORT||'verification/music-local-real-whole-song.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));server.kill('SIGTERM');
}})();
