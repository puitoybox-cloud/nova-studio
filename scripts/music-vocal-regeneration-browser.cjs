const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');

async function run(){
  const origin=new URL(process.env.NOVA_HARMONY_ORIGIN||'http://127.0.0.1:8790');
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
    const observed=await page.evaluate(async()=>{
      const a=MusicStudio,core=MusicStudioEditor,repo=a.indexedDbRepository(),id='regenerate-japanese-vocal';
      const ok=result=>{if(!result.ok)throw Error(result.error);return result};
      const hash=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('');
      a.setRepository(repo);
      let p=a.makeProject({projectId:id,projectName:'Regenerate Japanese vocal',bpm:90,midiData:{ppq:480,tempo:90,
        editor:{measureCount:4},tracks:[{id:'melody',part:'melody',notes:[{id:'a',pitch:60,startTick:0,durationTicks:480,velocity:80},
          {id:'b',pitch:62,startTick:1920,durationTicks:480,velocity:80},{id:'c',pitch:64,startTick:2400,durationTicks:480,velocity:80}]}]}});
      p=a.adoptLyricsAssignment(p,a.lyricsAssignmentPreview(p,{trackId:'melody',fromNote:1,toNote:3,text:'あい',reading:'ア イ ~'}));
      await repo.put(p);a.state.projects=[p];
      const original=ok(await a.generateLocalScoreVocal(id,p.syllableAssignments[0].id));
      const originalWav=await a.pcmLoadLongWav(id,original.assetId),originalHash=await hash(originalWav);
      a.openMidiEditor(id);
      const deadline=Date.now()+10000;
      while(a.state.midiEditor?.projectId!==id&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
      core.updateNote(a.state.midiEditor,'b',{pitch:65});
      const edited=ok(await a.saveMidiEditor({silent:true})).project;
      if(edited.midiData.tracks[0].notes.find(n=>n.id==='b').pitch!==65)throw Error('MIDI edit was not stored');
      const next=a.adoptLyricsAssignment(edited,a.lyricsAssignmentPreview(edited,{trackId:'melody',fromNote:2,toNote:3,text:'うえ',reading:'ウ エ'}));
      await repo.compareAndPut(next,JSON.stringify(edited),()=>{});
      a.state.projects=[next];a.state.midiEditor=null;
      const record=next.syllableAssignments.at(-1);
      const regenerated=ok(await a.generateLocalScoreVocal(id,record.id,{startMeasure:2,endMeasure:2}));
      const candidate=regenerated.project.longWavAssets.find(x=>x.id===regenerated.assetId);
      const score=candidate.vocalTake.scoreSource.scoreXML;
      if(!score.includes('<text>う</text>')||!score.includes('<text>え</text>')||!score.includes('<step>F</step>'))
        throw Error('regenerated MusicXML must contain the edited Japanese text and melody');
      const preview=await a.vocalReplacementRender(id,original.assetId,regenerated.assetId),candidateHash=await hash(preview.blob);
      const [dry,wet]=await Promise.all([originalWav.arrayBuffer(),preview.blob.arrayBuffer()]).then(buffers=>buffers.map(b=>new Uint8Array(b)));
      const first=44+preview.first*preview.base.channels*2,end=44+preview.last*preview.base.channels*2;
      if(dry.length!==wet.length||!dry.slice(0,first).every((x,i)=>x===wet[i])||!dry.slice(end).every((x,i)=>x===wet[end+i])||
         dry.slice(first,end).every((x,i)=>x===wet[first+i]))throw Error('regeneration replaces only the targeted samples');
      const saved=ok(await a.vocalReplacementApply(id,original.assetId,regenerated.assetId));
      ok(await a.vocalReplacementUndo(id,-1));ok(await a.vocalReplacementUndo(id,1));
      return {id,originalId:original.assetId,newId:saved.assetId,originalHash,candidateHash,first,end};
    });
    await browser.close();
    page=await open();
    const checked=await page.evaluate(async expected=>{
      const a=MusicStudio,hash=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('');
      if(await hash(await a.pcmLoadLongWav(expected.id,expected.originalId))!==expected.originalHash||
         await hash(await a.pcmLoadLongWav(expected.id,expected.newId))!==expected.candidateHash)return false;
      const restored=await a.restoreLongWavArchive(await a.createLongWavArchive(),{settings:false});
      const project=restored.projects?.find(p=>p.vocalReplacement?.entries.length);
      const asset=project?.longWavAssets.find(x=>x.replacementSource);
      return !!asset&&await hash(await a.pcmLoadLongWav(project.projectId,asset.id))===expected.candidateHash;
    },observed);
    assert.equal(checked,true,'edited Japanese vocal and untouched original survive Chromium restart and Archive restore');
    assert.deepEqual(external,[]);
    console.log(JSON.stringify({...observed,restart:true,archive:true,external:0}));
  }finally{
    await browser?.close();
    await rm(profile,{recursive:true,force:true});
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
