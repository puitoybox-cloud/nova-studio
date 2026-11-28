const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const {mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');

async function run(){
  const origin=new URL(process.env.NOVA_HARMONY_ORIGIN||'http://127.0.0.1:8779');
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
    const fixture=fs.readFileSync(process.argv[2]).toString('base64');
    const obs=await page.evaluate(async fixture=>{
      const a=MusicStudio,panel=MusicStudioAIAssistantPanel,id='wav-chord-fixture',repo=a.indexedDbRepository();
      a.setRepository(repo);
      const project=a.makeProject({projectId:id,projectName:'WAV harm',bpm:120,midiData:{ppq:480,tempo:120,editor:{measureCount:4,editRange:{startMeasure:1,endMeasure:4}},tracks:[{id:'melody',part:'melody',notes:[{id:'original',pitch:61,startTick:3840,durationTicks:240,velocity:70}]}]}});
      await repo.put(project);a.state.projects=[project];a.openMidiEditor(id);
      const deadline=Date.now()+10000;
      while(a.state.midiEditor?.projectId!==id&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
      const session=a.state.midiEditor,before=JSON.stringify(session.midiData);
      panel.setTab(id,'candidates');
      const file=new File([Uint8Array.from(atob(fixture),n=>n.charCodeAt(0))],'piano-recorded-samples.wav',{type:'audio/wav'});
      await panel.analyzeHarmonyWav(id,{files:[file]});
      const record=panel._states.get(id),rows=record.harmonyAnalysis?.rows;
      if(!rows)throw Error(record.message);
      const symbols=rows.map(r=>r.symbol);
      if(JSON.stringify(symbols)!==JSON.stringify(['C','Am','G7',null]))throw Error('WAV bar labels match the known chords and silence: '+JSON.stringify(symbols));
      if(!rows[2].segments.some(x=>x.symbol==='Cadd9/E'&&Math.abs(x.startSeconds-5)<=.4))throw Error('WAV change and inverted extension detected');
      document.querySelector('#aiHarmony2').value='Cadd9/E';
      panel.useHarmony(id);
      if(record.approval?.kind!=='harmony'||record.state.workspace.harmonyReview)throw Error('explicit approval before saving corrected chords');
      panel.confirmApprovedChange(id);
      if(record.state.workspace.harmonyReview?.rows[2].symbol!=='Cadd9/E'||JSON.stringify(session.midiData)!==before)throw Error(record.message);
      MusicStudioEditor.setEditRange(session,{startMeasure:3,endMeasure:3});
      a.repaintEditor();panel.setTab(id,'candidates');
      document.querySelector('[name=aiHarmonyFollowTrack][value=melody]').checked=true;
      panel.generateHarmonyFollow(id);
      const set=record.state.workspace.candidateSets.at(-1);
      if(set?.candidates[0]?.value?.harmonyFollow?.chords!=='Cadd9/E')throw Error('WAV review feeds chord-follow: '+record.message);
      if(!(await a.saveMidiEditor({silent:true})).ok)throw Error('WAV harmony save');
      const count=rows.flatMap(r=>r.segments).reduce((r,x)=>{
        for(let t=x.startSeconds+.0001;t<x.endSeconds;t+=.01){
          const label=t<2?'C':t<4?'Am':t<5?'G7':t<6?'Cadd9/E':null;
          r.expected++;if(x.symbol===label)r.correct++;
        }
        return r;
      },{correct:0,expected:0});
      return {id,symbols,segments:rows[2].segments,accuracy:count,tracks:JSON.parse(before).tracks};
    },fixture);
    await browser.close();
    page=await open();
    const saved=await page.evaluate(id=>MusicStudio.indexedDbRepository().get(id),obs.id);
    assert.equal(saved.aiWorkspace.harmonyReview.rows[2].symbol,'Cadd9/E','corrected WAV harmony survives Chromium restart');
    assert.equal(saved.aiWorkspace.harmonyReview.rows[3].symbol,null);
    assert.deepEqual(saved.midiData.tracks,obs.tracks);
    assert.deepEqual(external,[]);
    delete obs.tracks;
    console.log(JSON.stringify({...obs,restart:true,external:0}));
  }finally{
    await browser?.close();
    await rm(profile,{recursive:true,force:true});
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
