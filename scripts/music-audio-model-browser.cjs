const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');

// Serve the checkout on port 8765 and start the provisioned Audio Helper on 8766.
const input=process.argv[2];
if(!input)throw Error('Usage: node scripts/music-audio-model-browser.cjs <piano.wav> [stem-input.wav]');
const stemInput=process.argv[3];
const transcriptionFixtures=process.env.NOVA_TRANSCRIPTION_FIXTURES;
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nova-real-audio-'));
const endpoint='http://127.0.0.1:8766';
const studio='http://127.0.0.1:8765/music-studio.html';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const upload=(file,page)=>page.evaluate(({data,name})=>{window.audioFixture=new File([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],name,{type:'audio/wav'})},{data:fs.readFileSync(file,'base64'),name:path.basename(file)});

async function main(){
  let browser;
  const external = [];
  async function launch(){
    browser=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROME_EXECUTABLE,headless:true,serviceWorkers:'block'});
    await browser.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(studio).origin || url.origin === endpoint ||
          ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      external.push(url.origin);
      return route.abort();
    });
    const page=await browser.newPage();
    await page.goto(studio+'#music-studio');
    await page.waitForFunction(()=>MusicStudio.state.loaded&&MusicStudio.audioStemMidiPipeline);
    page.on('pageerror',error=>console.error(error));
    page.on('dialog',dialog=>dialog.accept());
    return page;
  }
  try{
    let page=await launch();
    await page.evaluate(async()=>{
      const app=MusicStudio,repo=app.indexedDbRepository();
      const source=app.makeProject({projectId:'real-audio-source',projectName:'Real audio source',
        midiData:{ppq:480,tempo:120,tracks:[{id:'melody',part:'melody',notes:[]}]}});
      app.setRepository(repo);await repo.put(source);await app.refresh();app.openMidiEditor(source.projectId);
      window.original=JSON.stringify(await repo.get(source.projectId));
    });
    await page.locator('.music-editor-transfer').evaluate(node=>node.closest('details').open=true);
    if(!stemInput){
      const statusButton=page.getByRole('button',{name:'音源分離モデルの導入状況を確認'});
      await page.route(endpoint+'/separation-model',route=>route.abort(),{times:1});
      await statusButton.click();
      await page.getByText('Audio Helperに接続できません。起動後にもう一度確認してください。').waitFor();
      assert.equal(await page.getByLabel('分離する音声').isDisabled(),true);
      const health=page.waitForResponse(r=>r.url()===endpoint+'/separation-model'&&r.ok());
      await statusButton.click();
      const status=(await (await health).json()).state;
      assert.ok(['license-unavailable','helper-dependency-unavailable','invalid-cache','ready'].includes(status));
      await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>
        button.textContent==='音源分離モデルの導入状況を確認'&&!button.disabled));
      assert.equal(await page.getByLabel('分離する音声').isDisabled(),status!=='ready');
    }
    const reports=[];
    for(const mode of ['polyphonic','monophonic']){
      const selector=page.getByLabel('採譜の変換方式');
      await page.locator('.music-editor-transfer').evaluate(node=>node.closest('details').open=true);
      await selector.selectOption(mode);
      const response=page.waitForResponse(r=>r.url()===endpoint+'/transcribe'&&r.request().method()==='POST',{timeout:180000});
      await page.getByLabel('MIDIに変換する音声').setInputFiles(input);
      const result=await response;
      assert.equal(result.status(),200);
      await page.waitForFunction(expected=>MusicStudio.state.projects.some(p=>p.importSource?.transcription?.mode===expected),mode);
      const saved=await page.evaluate(async mode=>{
        const app=MusicStudio,repo=app.indexedDbRepository();
        const p=(await repo.list()).find(p=>p.importSource?.transcription?.mode===mode);
        const notes=p.midiData.tracks.flatMap(t=>t.notes).sort((a,b)=>a.startTick-b.startTick);
        return {id:p.projectId,notes,metadata:p.importSource.transcription,
          history:p.productionHistory.map(e=>e.type),
          originalUnchanged:JSON.stringify(await repo.get('real-audio-source'))===window.original};
      },mode);
      assert.equal(saved.metadata.instrument,'piano');
      assert.equal(saved.notes.length,saved.metadata.detection.noteCount);
      assert.equal(saved.metadata.sourceSha256,hash(fs.readFileSync(input)));
      assert.equal(saved.originalUnchanged,true);
      assert.ok(saved.notes.length>=3);
      await page.getByText('External Track Review / Assignment',{exact:false}).first().waitFor({state:'attached'});
      const review=page.locator('#externalTrackReviewPopover');
      await review.locator('[data-transcription-reference]').waitFor({state:'attached'});
      assert.match(await review.textContent(),/変換時/);
      await review.evaluate(node=>node.closest('details').open=true);
      const reference=review.getByLabel('比較する元音声');
      await reference.setInputFiles({name:'not-the-source.wav',mimeType:'audio/wav',buffer:Buffer.alloc(100)});
      await review.getByText('変換に使った元音声と一致しません。').waitFor();
      await reference.setInputFiles(input);
      await review.getByText('元音声を確認しました。').waitFor();
      const audio=review.locator('audio');
      await audio.evaluate(element=>element.play());
      await page.waitForFunction(()=>document.querySelector('#externalTrackReviewPopover audio')?.currentTime>0);
      await review.evaluate(node=>node.closest('details').open=false);
      await page.waitForFunction(()=>!document.querySelector('#externalTrackReviewPopover audio')?.hasAttribute('src'));
      assert.equal(await reference.inputValue(),'');
      await review.evaluate(node=>node.closest('details').open=true);
      await reference.setInputFiles(input);
      await review.getByText('元音声を確認しました。').waitFor();
      reports.push(saved);
      await page.evaluate(()=>MusicStudio.openMidiEditor('real-audio-source'));
      await page.waitForFunction(()=>MusicStudio.state.midiEditor?.projectId==='real-audio-source');
    }
    const overlaps=notes=>notes.some((n,i)=>i>0&&notes[i-1].startTick+notes[i-1].durationTicks>n.startTick);
    assert.equal(overlaps(reports[0].notes),true);
    assert.equal(overlaps(reports[1].notes),false);
    await browser.close();page=await launch();
    const reopened=await page.evaluate(async ids=>{
      const repo=MusicStudio.indexedDbRepository();
      return Promise.all(ids.map(async id=>{
        const p=await repo.get(id);
        return {notes:p.midiData.tracks.flatMap(t=>t.notes).sort((a,b)=>a.startTick-b.startTick),metadata:p.importSource.transcription};
      }));
    },reports.map(r=>r.id));
    assert.deepEqual(reopened,reports.map(({notes,metadata})=>({notes,metadata})));
    await page.evaluate(id=>MusicStudio.openMidiEditor(id),reports[1].id);
    await page.waitForFunction(id=>MusicStudio.state.midiEditor?.projectId===id,reports[1].id);
    const edited=await page.evaluate(async()=>{
      const app=MusicStudio,editor=MusicStudioEditor,session=app.state.midiEditor;
      const track=session.midiData.tracks.find(track=>track.notes.length);
      editor.selectTrackById(session,track.id);
      const note=track.notes[0],before=note.pitch,id=note.id;
      app.editorSelectNote(id);
      app.editorMoveSelected(0,1);
      const result=await app.saveMidiEditor({silent:true});
      if(!result.ok)throw Error(JSON.stringify(result));
      const saved=await app.indexedDbRepository().get(session.projectId);
      const after=saved.midiData.tracks.find(t=>t.id===track.id).notes.find(n=>n.id===id).pitch;
      return {before,after,detected:saved.importSource.transcription.detection.noteCount};
    });
    assert.equal(edited.after,edited.before+1);
    assert.equal(edited.detected,reports[1].notes.length);
    console.log(JSON.stringify({edited,transcription:reports.map(r=>({mode:r.metadata.mode,pitches:r.notes.map(n=>n.pitch),metadata:r.metadata,history:r.history})),restart:true}));
    if(transcriptionFixtures){
      const reports=[];
      for(const instrument of ['piano','voice','guitar','bass']){
        for(const mode of ['monophonic','polyphonic']){
          await page.evaluate(()=>MusicStudio.openMidiEditor('real-audio-source'));
          await page.locator('.music-editor-transfer').evaluate(node=>node.closest('details').open=true);
          await page.getByLabel('採譜する楽器').selectOption(instrument);
          await page.getByLabel('採譜の変換方式').selectOption(mode);
          const file=path.join(transcriptionFixtures,`${instrument}-${mode}.wav`);
          const digest=hash(fs.readFileSync(file));
          const response=page.waitForResponse(r=>r.url()===endpoint+'/transcribe'&&r.request().method()==='POST',{timeout:180000});
          await page.getByLabel('MIDIに変換する音声').setInputFiles(file);
          const actual=await response;
          assert.equal(actual.status(),200);
          await page.waitForFunction(hash=>MusicStudio.state.projects.some(p=>p.importSource?.transcription?.sourceSha256===hash),digest);
          const saved=await page.evaluate(async digest=>{
            const p=(await MusicStudio.indexedDbRepository().list()).find(p=>p.importSource?.transcription?.sourceSha256===digest);
            return {id:p.projectId,metadata:p.importSource.transcription,notes:p.midiData.tracks.flatMap(t=>t.notes)};
          },digest);
          assert.equal(saved.metadata.instrument,instrument);
          assert.equal(saved.metadata.mode,mode);
          assert.equal(saved.notes.length,saved.metadata.detection.noteCount);
          if(mode==='monophonic')assert.equal(overlaps(saved.notes.sort((a,b)=>a.startTick-b.startTick)),false);
          reports.push({id:saved.id,instrument,mode,noteCount:saved.notes.length});
        }
      }
      await browser.close();page=await launch();
      const restored=await page.evaluate(async ids=>{
        const repo=MusicStudio.indexedDbRepository();
        return Promise.all(ids.map(async id=>{
          const {instrument,mode,detection}= (await repo.get(id)).importSource.transcription;
          return {id,instrument,mode,noteCount:detection.noteCount};
        }));
      },reports.map(report=>report.id));
      assert.deepEqual(restored,reports);
      console.log(JSON.stringify({matrix:reports.map(({instrument,mode,noteCount})=>({instrument,mode,noteCount})),restart:true}));
    }
    if(!stemInput){assert.deepEqual(external, []);return;}
    await page.evaluate(async()=>{
      const app=MusicStudio,repo=app.indexedDbRepository();
      await app.refresh();app.openMidiEditor('real-audio-source');window.repo=repo;
      window.original=JSON.stringify(await repo.list());
    });
    await page.waitForFunction(()=>MusicStudio.state.midiEditor?.projectId==='real-audio-source');
    const failed=await page.evaluate(async()=>{
      const file=new File([new Uint8Array(1000)],'invalid.wav',{type:'audio/wav'});
      const result=await MusicStudio.audioStemMidiPipeline.importSeparatedAudio(file);
      return {ok:result.ok,unchanged:JSON.stringify(await window.repo.list())===window.original};
    });
    assert.deepEqual(failed,{ok:false,unchanged:true});
    await upload(stemInput,page);
    let confirmations=0;
    page.removeAllListeners('dialog');
    page.on('dialog',dialog=>++confirmations===2?dialog.dismiss():dialog.accept());
    const cancelled=await page.evaluate(async()=>{
      const result=await MusicStudio.audioStemMidiPipeline.importSeparatedAudio(window.audioFixture);
      return {cancelled:result.cancelled,unchanged:JSON.stringify(await window.repo.list())===window.original};
    });
    assert.deepEqual(cancelled,{cancelled:true,unchanged:true});
    page.removeAllListeners('dialog');
    page.on('dialog',dialog=>dialog.accept());
    const stems=await page.evaluate(async()=>{
      const result=await MusicStudio.audioStemMidiPipeline.importSeparatedAudio(window.audioFixture);
      if(!result.ok)throw Error(JSON.stringify(result));
      const p=await window.repo.get(result.project.projectId);
      const digest=async id=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await (await window.repo.getLongWav(id)).blob.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
      return {id:p.projectId,names:p.longWavAssets.map(a=>a.name),original:await digest(p.fileReferences.at(-1).binary.id),
        sourceUnchanged:JSON.stringify(await window.repo.get('real-audio-source'))===JSON.stringify(JSON.parse(window.original).find(p=>p.projectId==='real-audio-source'))};
    });
    assert.equal(stems.names.length,6);
    assert.equal(stems.original,hash(fs.readFileSync(stemInput)));
    assert.equal(stems.sourceUnchanged,true);
    assert.deepEqual(external, []);
    console.log(JSON.stringify({demucs:stems,failed,cancelled}));
  }finally{
    await browser?.close();
    fs.rmSync(profile,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});
