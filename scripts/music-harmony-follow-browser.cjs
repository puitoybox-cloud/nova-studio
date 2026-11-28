const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');

async function run(){
  const origin=new URL(process.env.NOVA_HARMONY_ORIGIN||'http://127.0.0.1:8776');
  assert.equal(origin.hostname,'127.0.0.1');
  const profile=await mkdtemp(join(tmpdir(),'nova-sections-'));
  const external=[];
  let browser;
  async function open(){
    browser=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:1180,height:820},
      ...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
    const page=browser.pages()[0];
    await page.route('**/*',route=>{
      const url=route.request().url();
      if(url.startsWith(origin.origin+'/')||/^(blob:|data:)/.test(url)){
        return route.continue();
      }
      external.push(url);
      return route.abort();
    });
    await page.goto(new URL('/music-studio.html',origin).href);
    await page.waitForFunction(()=>MusicStudio.state.loaded);
    return page;
  }
  try{
    let page=await open();
    const observed=await page.evaluate(async ()=>{
      const app=MusicStudio,core=MusicStudioEditor,panel=MusicStudioAIAssistantPanel,id='follow-chord-browser';
      const notes=(id,pitch)=>[0,1920,2400,3840].map((startTick,i)=>({id:id+i,pitch,startTick,durationTicks:120,velocity:80}));
      const repo=app.indexedDbRepository();app.setRepository(repo);
      const p=app.makeProject({projectId:id,projectName:'Follow chords',bpm:96,midiData:{ppq:480,tempo:96,editor:{measureCount:4,editRange:{startMeasure:2,endMeasure:3}},
        tracks:[{id:'melody',part:'melody',notes:notes('m',61)},{id:'bass',part:'bass',notes:notes('b',41)},
          {id:'other',trackType:'midi-melodic',channel:4,notes:notes('o',67)}]}});
      await repo.put(p);app.state.projects=[p];app.openMidiEditor(id);
      const deadline=Date.now()+10000;
      while(app.state.midiEditor?.projectId!==id&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
      const session=app.state.midiEditor;
      MusicStudioMeasureLocks.addRangeLock(session,core,{trackId:'melody',startTick:2400,endTick:2520});
      panel.setTab(id,'candidates');panel.analyzeHarmony(id);
      document.querySelector('#aiHarmony0').value='Cadd9/E';
      document.querySelector('#aiHarmony1').value='G7/B';
      panel.useHarmony(id);panel.confirmApprovedChange(id);
      const record=panel._states.get(id);
      if(record.state.workspace.harmonyReview?.chords!=='Cadd9/E G7/B')throw Error(record.message);
      for(const input of document.querySelectorAll('[name=aiHarmonyFollowTrack]'))input.checked=['melody','bass'].includes(input.value);
      const before=structuredClone(session.midiData);
      panel.generateHarmonyFollow(id);
      const choices=record.state.workspace.candidateSets.at(-1)?.candidates;
      if(choices?.length!==2)throw Error(record.message);
      const pitchOptions=[];
      for(const variant of ['A','B']){
        panel.previewCandidate(id,variant);
        pitchOptions.push(record.candidatePreview.result.changes.updates.find(n=>n.id==='m1')?.pitch);
        await panel.auditionCandidate(id,variant);
        if(!record.message.includes('試聴中'))throw Error(record.message);
        app.editorStopCandidateAudition();
      }
      if(pitchOptions.join()!=='60,62')throw Error('expected distinct pitch choices');
      panel.previewCandidate(id,'B');panel.applyCandidatePreview(id,'B');
      const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
      if(record.approval?.kind!=='candidate'||!same(before,session.midiData))throw Error('preapproval boundary');
      panel.confirmApprovedChange(id);
      const after=structuredClone(session.midiData);
      const pitch=(track,id)=>after.tracks.find(t=>t.id===track).notes.find(n=>n.id===id).pitch;
      if(pitch('melody','m1')!==62||pitch('melody','m2')!==61||pitch('melody','m0')!==61||
        pitch('bass','b1')%12!==4||pitch('bass','b3')%12!==11||
        !same(before.tracks.find(t=>t.id==='other'),after.tracks.find(t=>t.id==='other')))throw Error('scope and slash bass');
      core.undo(session);if(!same(before,session.midiData))throw Error('Undo');
      core.redo(session);if(!same(after,session.midiData))throw Error('Redo');
      if(!(await app.saveMidiEditor({silent:true})).ok)throw Error('save');
      return {id,after,pitchOptions};
    });
    await browser.close();
    page=await open();
    const stored=await page.evaluate(id=>MusicStudio.indexedDbRepository().get(id),observed.id);
    assert.deepEqual(stored.midiData,observed.after,'chord-follow correction survives Chromium restart');
    assert.equal(stored.aiWorkspace.harmonyReview.chords,'Cadd9/E G7/B');
    const arrangement=await page.evaluate(async ()=>{
      const app=MusicStudio,core=MusicStudioEditor,panel=MusicStudioAIAssistantPanel,id='voicing-and-locks';
      const repo=app.indexedDbRepository();app.setRepository(repo);
      const note=(id,pitch,startTick)=>({id,pitch,startTick,durationTicks:120,velocity:80});
      const p=app.makeProject({projectId:id,projectName:'Voicing and locks',key:'C',bpm:96,midiData:{ppq:480,tempo:96,
        editor:{measureCount:4,editRange:{startMeasure:2,endMeasure:3}},
        tracks:[{id:'melody',part:'melody',notes:[note('lead',65,1920),note('lead2',72,3840)]},
          {id:'bass',part:'bass',notes:[note('bassout',36,0)]},
          {id:'piano',name:'Piano',trackType:'midi-melodic',channel:4,notes:[note('pianoout',59,0),note('locked',61,3700),note('old',57,3840)]}]}});
      await repo.put(p);app.state.projects=[p];app.openMidiEditor(id);
      const deadline=Date.now()+10000;
      while(app.state.midiEditor?.projectId!==id&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
      const session=app.state.midiEditor,locks=MusicStudioMeasureLocks;
      for(const [trackId,startTick,endTick] of [['melody',1920,5760],['piano',3700,3820]]){
        if(!locks.addRangeLock(session,core,{trackId,startTick,endTick}).changed)throw Error('arrangement lock failed');
      }
      panel.setTab(id,'candidates');
      document.querySelector('#aiSectionName').value='chorus';
      for(const role of ['piano','bass','strings','drums'])document.querySelector('#aiSection'+role).checked=role==='piano';
      document.querySelector('#aiSectionTargetpiano').value='piano';
      panel.saveSectionArrangement(id);panel.confirmApprovedChange(id);
      document.querySelector('#aiRemakeMode').value='ensemble';
      document.querySelector('#aiModelChords').value='Cadd9/E G7/B';
      const before=structuredClone(session.midiData);
      await panel.generateLocalModel(id);
      const record=panel._states.get(id),set=record.state.workspace.candidateSets.at(-1),voicings=[];
      if(set?.candidates.length!==3||set.candidates.some(c=>c.value.ensemble?.chords!=='Cadd9/E G7/B'||!c.value.modelGeneration))throw Error(record.message);
      for(const variant of ['A','B']){
        panel.previewCandidate(id,variant);
        const notes=record.candidatePreview?.result.changes.adds||[];
        const first=notes.filter(n=>n.startTick>=1920&&n.startTick<2400);
        if(first.length<4||first[0].pitch%12!==4||![0,2,4,7].every(pc=>first.some(n=>n.pitch%12===pc)))throw Error('extended chord or slash bass lost');
        voicings.push(first.map(n=>[n.pitch,n.startTick]));
        await panel.auditionCandidate(id,variant);
        if(!record.message.includes('試聴中'))throw Error(record.message);
        app.editorStopCandidateAudition();
      }
      if(JSON.stringify(voicings[0].map(n=>n[0]))===JSON.stringify(voicings[1].map(n=>n[0])))throw Error('voicings must differ');
      panel.previewCandidate(id,'B');panel.applyCandidatePreview(id,'B');
      const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
      if(record.approval?.kind!=='candidate'||!same(before,session.midiData))throw Error('preapproval voicing boundary');
      panel.confirmApprovedChange(id);
      const after=structuredClone(session.midiData),originalPiano=before.tracks.find(t=>t.id==='piano');
      const piano=after.tracks.find(t=>t.id==='piano');
      if(same(originalPiano,piano)||!same(before.tracks.filter(t=>t.id!=='piano'),after.tracks.filter(t=>t.id!=='piano'))||
         !same(before.editor.measureLocks,after.editor.measureLocks))throw Error('melody and range locks both survive arrangement');
      for(const note of originalPiano.notes.filter(n=>n.id==='locked'||n.id==='pianoout')){
        if(!same(note,piano.notes.find(n=>n.id===note.id)))throw Error('protected piano note changed');
      }
      core.undo(session);if(!same(before,session.midiData))throw Error('voicing Undo');
      core.redo(session);if(!same(after,session.midiData))throw Error('voicing Redo');
      if(!(await app.saveMidiEditor({silent:true})).ok)throw Error('voicing save');
      return {id,after,voicings};
    });
    await browser.close();
    page=await open();
    const saved=await page.evaluate(id=>MusicStudio.indexedDbRepository().get(id),arrangement.id);
    assert.deepEqual(saved.midiData,arrangement.after,'voicings and both lock types survive Chromium restart');
    assert.equal(saved.aiWorkspace.candidateSets.at(-1).candidates[1].value.ensemble.chords,'Cadd9/E G7/B');
    assert.deepEqual(external,[]);
    console.log(JSON.stringify({pitchOptions:observed.pitchOptions,voicings:arrangement.voicings,external:0,restart:true}));
  }finally{
    await browser?.close();
    await rm(profile,{recursive:true,force:true});
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
