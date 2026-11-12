const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const plain=value=>JSON.parse(JSON.stringify(value));
function load(){const w={location:{hash:'#music-studio'},addEventListener(){},setTimeout,clearTimeout,console,TextEncoder};w.window=w;for(const file of ['music-studio-meter-map.js','music-studio-editor.js','music-studio-measure-locks.js','music-studio.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{window:w,globalThis:w},{filename:file});return{window:w,core:w.MusicStudioEditor,locks:w.MusicStudioMeasureLocks,app:w.MusicStudio}}
for(const route of ['save/reopen','JSON export/import','Backup/Restore'])test(`coordinated mixed protection survives ${route} without mutating its input`,async()=>{
  const{core,locks,app}=load(),repo=app.memoryRepository();app.setRepository(repo);
  const p=app.makeProject({projectId:'coordinated-persistence',projectName:'Synthetic mixed locks',midiData:{ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},timeSignatureMap:[{tick:1000,numerator:3,denominator:8},{tick:2200,numerator:6,denominator:8}],tempoMap:[{tick:777,bpm:60}],tracks:[{id:'lead',part:'melody',notes:[{id:'released',pitch:60,startTick:100,durationTicks:100,velocity:90}]}],editor:{measureCount:8,lockedMeasures:[2],parts:{melody:{lockedMeasures:[3]}},trackStates:{lead:{lockedMeasures:[1]}}}}}),original=plain(p),s=core.createCoordinatedSession(p);
  assert.deepEqual(plain(p),original);assert.equal(s.dirty,false);
  locks.addRangeLock(s,core,{trackId:'lead',startTick:8500,endTick:9000});locks.unlockRange(s,core,{trackId:'lead',startTick:100,endTick:200});core.selectNote(s,'released');assert.notEqual(core.moveSelected(s,0,1).ok,false);
  await repo.put(p);app.state.projects=[p];app.state.midiEditor=s;assert.equal((await app.saveMidiEditor({silent:true})).ok,true);
  const saved=await repo.get(p.projectId),input=plain(saved),expected=plain(locks.readState(saved.midiData,core));let restored=saved;
  if(route==='JSON export/import'){const exported=await app.exportProject(p.projectId),parsed=JSON.parse(exported.text);assert.deepEqual(parsed.midiData,input.midiData);app.setRepository(app.memoryRepository());app.state.projects=[];const imported=await app.importText(exported.text);assert.equal(imported.ok,true);restored=imported.project;}
  if(route==='Backup/Restore'){const backup=plain(app.backupObject()),before=plain(backup),target=app.memoryRepository();app.setRepository(target);app.state.projects=[];assert.equal((await app.restoreBackup(backup,{settings:false,projects:true})).ok,true);restored=await target.get(p.projectId);assert.deepEqual(backup,before);}
  const beforeReopen=plain(restored),reopened=core.createCoordinatedSession(restored);assert.deepEqual(plain(restored),beforeReopen);assert.equal(reopened.dirty,false);assert.deepEqual(plain(locks.readState(reopened.midiData,core)),expected);
  assert.equal(locks.isProtected(reopened.midiData,core,'lead',{startTick:100,durationTicks:100}),false);assert.equal(locks.isProtected(reopened.midiData,core,'lead',{startTick:200,durationTicks:1}),true);assert.equal(locks.isProtected(reopened.midiData,core,'lead',{startTick:8500,durationTicks:1}),true);
  assert.equal(core.currentTrack(reopened).notes[0].pitch,61);assert.deepEqual(plain(restored.midiData.timeSignatureMap),input.midiData.timeSignatureMap);assert.deepEqual(plain(restored.midiData.tempoMap),input.midiData.tempoMap);assert.deepEqual(plain(saved),input);assert.deepEqual(plain(p),original);
});

for (const entry of ['project', 'midi']) {
  test(`${entry} save recognizes the exact committed revision after a lost notification`, async () => {
    const {app, core, window}=load();
    const repo=app.memoryRepository();
    app.setRepository(repo);
    const project=app.makeProject({projectId:'lost-save-receipt',projectName:'Save receipt'});
    await repo.put(project);
    app.state.projects=[project];
    assert.equal((await app.productionSessionSave(project.projectId,'start','Save session')).ok,true);
    const before=await repo.get(project.projectId);
    const session=core.createCoordinatedSession(before);
    let save;
    if (entry==='midi') {
      app.state.midiEditor=session;
      core.addNote(session,{pitch:61,startTick:0,durationTicks:120});
      save=()=>app.saveMidiEditor({silent:true});
    } else {
      const fields={projectName:before.projectName,bpm:'120',timeSignature:'4/4',status:before.status,productionNotes:'New notes'};
      const form={elements:Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,{value}]))};
      window.document={querySelector:selector=>selector==='#musicProjectForm'?form:null};
      app.state.dirty=true;
      save=()=>app.saveCurrentProject(project.projectId);
    }

    const compareAndPut=repo.compareAndPut.bind(repo);
    let writes=0;
    repo.compareAndPut=async(...args)=>{
      writes++;
      await compareAndPut(...args);
      throw Error('lost completion notification');
    };
    assert.equal((await save()).ok,true);
    assert.equal((await save()).skipped,true);
    assert.equal(writes,1);
    const saved=await repo.get(project.projectId);
    assert.equal(saved.revision,before.revision+1);
    assert.equal(saved.songVersions.edits.length,(before.songVersions.edits||[]).length+1);
    assert.equal(saved.songVersions.edits.at(-1).source,entry==='project'?'project-editor':'midi-editor');
    assert.equal(saved.songVersions.edits.at(-1).sessionId,before.songVersions.sessions[0].id);
  });
}
