'use strict';
// Browser state-machine fixtures, not microphone/long-recording lifecycle proof.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'music-studio.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res)});
(async()=>{let browser;const cases=[];try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 for(const width of [1440,1180,820,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.goto(base+'/music-studio.html');await page.waitForFunction(()=>window.MusicStudio?.state.loaded);
  const baseline=await page.evaluate(async()=>{const a=MusicStudio,p=a.makeProject({projectId:'veto-song',projectName:'保持する曲',midiData:{ppq:480,tracks:[{id:'lead',part:'melody',notes:[{id:'n',pitch:60,startTick:0,durationTicks:480,velocity:80}]}]}});await a.indexedDbRepository().put(p);a.state.projects=[p];a.openMidiEditor('veto-song');a.state.settings.autosave.enabled=false;return JSON.stringify(p)});
  await page.waitForFunction(()=>MusicStudio.state.midiInput.initialized);
  const actions=['midi','assistant','lyrics','vocal','mix','harmony','master','long-master','export','settings','backup'];
  for(const pending of ['starting','countingIn'])for(const veto of ['midi','project'])for(const action of actions)for(const entry of ['workspace','hash','menu']){
   const before=await page.evaluate(({pending,veto})=>{const a=MusicStudio;a.state.midiEditor.dirty=veto==='midi';a.state.dirty=veto==='project';Object.assign(a.state.midiInput,{starting:true,countingIn:pending==='countingIn',recordingPart:'melody',recordingTrackId:'lead',countInBeat:2});return JSON.stringify(a.state.midiInput)},{pending,veto});
   if(entry==='hash'){
    await page.evaluate(action=>{window.__vetoObserved=false;addEventListener('hashchange',()=>{window.__vetoObserved=true},{once:true});location.hash=MusicStudio.workActionTarget(action,'veto-song').route},action);
    await page.waitForFunction(()=>window.__vetoObserved&&location.hash==='#music-studio/midi-editor/veto-song');
   }else await page.evaluate(({action,entry})=>{if(entry==='workspace'){if(MusicStudio.openWorkAction(action,'veto-song')!==false)throw Error('navigation accepted')}else MusicStudio.goProjects()},{action,entry});
   assert.equal(await page.evaluate(()=>location.hash),'#music-studio/midi-editor/veto-song');
   assert.equal(await page.evaluate(()=>JSON.stringify(MusicStudio.state.midiInput)),before,`${width}/${pending}/${veto}/${action}/${entry}`);
   assert.equal(await page.evaluate(async()=>JSON.stringify(await MusicStudio.indexedDbRepository().get('veto-song'))),baseline);
   await page.evaluate(()=>{MusicStudio.state.dirty=false;MusicStudio.state.midiEditor.dirty=false;Object.assign(MusicStudio.state.midiInput,{starting:false,countingIn:false})});
   cases.push({width,pending,veto,action,entry,retained:true});
  }
  // A real form draft survives a rejected browser hash navigation too.
  await page.evaluate(()=>MusicStudio.openProject('veto-song'));
  const name=page.locator('[name="projectName"]');await name.fill('未保存の曲名を保持');
  await page.evaluate(()=>{window.__vetoObserved=false;addEventListener('hashchange',()=>window.__vetoObserved=true,{once:true});location.hash=MusicStudio.workActionTarget('settings','veto-song').route});
  await page.waitForFunction(()=>window.__vetoObserved&&location.hash.includes('/project/'));
  assert.equal(await name.inputValue(),'未保存の曲名を保持');assert.equal(await page.evaluate(()=>MusicStudio.state.dirty),true);
  assert.equal(await page.evaluate(async()=>JSON.stringify(await MusicStudio.indexedDbRepository().get('veto-song'))),baseline);
  assert.deepEqual(errors,[]);await context.close();
 }
 const report={head:process.env.NOVA_TESTED_HEAD||require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),complete:true,scope:'MIDI start/count-in veto fixtures plus real project form; not exhaustive MS28-A02 acceptance',cases,formDraftWidths:4};
 fs.writeFileSync(path.join(root,'verification/music-navigation-veto-browser.json'),JSON.stringify(report,null,2));console.log(`Navigation veto: ${cases.length} fixture cases, four real form drafts`);
}finally{await browser?.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
