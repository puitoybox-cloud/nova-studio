const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');

async function run(){
  const origin=new URL(process.env.NOVA_SECTION_ORIGIN||'http://127.0.0.1:8775');
  assert.equal(origin.hostname,'127.0.0.1');
  const profile=await mkdtemp(join(tmpdir(),'nova-sections-'));
  const requests=[],external=[];
  let browser;
  async function open(){
    browser=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:1180,height:820},
      ...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
    const page=browser.pages()[0];
    await page.route('**/*',route=>{
      const url=route.request().url();
      if(url.startsWith(origin.origin+'/')||/^(blob:|data:)/.test(url)){
        if(url.endsWith('/__nova_generation/compose'))requests.push(route.request().postDataJSON());
        return route.continue();
      }
      external.push(url);
      return route.abort();
    });
    await page.goto(new URL('/music-studio.html',origin).href);
    await page.waitForFunction(()=>MusicStudio.state.loaded);
    return page;
  }
  const scenarios=[
    ['continuation',8,null],['verse2',4,2],['final-chorus',6,3],['intro',1,2],
    ['interlude',5,3],['outro',7,6]
  ];
  try{
    let page=await open();
    const results=[];
    for(const [name,bar,reference] of scenarios){
      const observed=await page.evaluate(async ({name,bar,reference})=>{
        const app=MusicStudio,core=MusicStudioEditor,panel=MusicStudioAIAssistantPanel;
        app.state.midiEditor=null;
        const id='section-'+name,repo=app.indexedDbRepository();
        app.setRepository(repo);
        const notes=Array.from({length:7},(_,i)=>i+1).flatMap(measure=>
          [0,480,960].map((offset,j)=>({id:measure+'-'+j,pitch:[62,65,69][j]+measure%3,
            startTick:(measure-1)*1920+offset,durationTicks:360,velocity:82})));
        const p=app.makeProject({projectId:id,projectName:name,key:'Dm',bpm:96,midiData:{ppq:480,tempo:96,
          timeSignature:{numerator:4,denominator:4},editor:{measureCount:8,editRange:{startMeasure:bar,endMeasure:bar}},
          tracks:[{id:'melody',part:'melody',notes},{id:'bass',part:'bass',notes:[{id:'bass',pitch:38,startTick:0,durationTicks:1440,velocity:80}]}]}});
        await repo.put(p);
        app.state.projects=[p];app.openMidiEditor(id);
        const deadline=Date.now()+10000;
        while(app.state.midiEditor?.projectId!==id&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
        const session=app.state.midiEditor,before=structuredClone(session.midiData);
        panel.setTab(id,'candidates');
        document.querySelector('#aiRemakeMode').value='replace';
        document.querySelector('#aiMelodySection').value=name;
        document.querySelector('#aiMelodyReferenceFrom').value=reference??'';
        document.querySelector('#aiMelodyReferenceTo').value=reference??'';
        document.querySelector('#aiModelChords').value='Dmadd9/A';
        await panel.generateLocalModel(id);
        const record=panel._states.get(id),set=record.state.workspace.candidateSets.at(-1);
        if(set?.candidates.length!==3||set.candidates.some(c=>c.value.melodySection?.name!==name))throw Error(record.message);
        panel.previewCandidate(id,'A');
        for(const [variant,source] of [['A','original'],['A','candidate'],['B','candidate']]){
          panel.previewCandidate(id,variant);
          await panel.auditionCandidate(id,variant,source);
          if(!record.message.includes('試聴中'))throw Error(record.message);
          app.editorStopCandidateAudition();
        }
        panel.previewCandidate(id,'A');
        panel.applyCandidatePreview(id,'A');
        if(record.approval?.kind!=='candidate'||JSON.stringify(before)!==JSON.stringify(session.midiData))throw Error('approval boundary');
        panel.confirmApprovedChange(id);
        const after=structuredClone(session.midiData),start=(bar-1)*1920,end=bar*1920;
        const outside=note=>note.startTick<start||note.startTick>=end;
        const compare=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
        const generated=after.tracks[0].notes.filter(n=>!outside(n));
        if(!generated.length||generated.some(n=>n.startTick+n.durationTicks>end||![2,4,5,9].includes(n.pitch%12))||
           !compare(before.tracks[0].notes.filter(outside),after.tracks[0].notes.filter(outside))||
           !compare(before.tracks.slice(1),after.tracks.slice(1)))throw Error('section or harmony boundary');
        core.undo(session);
        if(!compare(before,session.midiData))throw Error('section Undo');
        core.redo(session);
        if(!compare(after,session.midiData))throw Error('section Redo');
        if(!(await app.saveMidiEditor({silent:true})).ok)throw Error('section Save');
        return {id,name,reference,variants:set.candidates.length,notes:generated.length,after};
      },{name,bar,reference});
      results.push(observed);
    }
    await browser.close();
    page=await open();
    for(const result of results){
      const stored=await page.evaluate(id=>MusicStudio.indexedDbRepository().get(id),result.id);
      assert.deepEqual(stored.midiData,result.after,'section survives Chromium restart');
      assert.equal(stored.aiWorkspace.candidateSets.at(-1).candidates[0].value.melodySection.name,result.name);
    }
    assert.equal(requests.length,6);
    assert.ok(requests.every(request=>request.sourceNotes?.length===3),'each section runs actual source-conditioned inference');
    assert.deepEqual(external,[]);
    console.log(JSON.stringify(results.map(({after,...result})=>({...result,restart:true,external:0}))));
  }finally{
    await browser?.close();
    await rm(profile,{recursive:true,force:true});
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
