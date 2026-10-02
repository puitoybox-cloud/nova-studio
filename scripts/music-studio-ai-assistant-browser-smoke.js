const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const{chromium}=require('playwright');
const root=path.join(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),name=url.pathname==='/'?'music-studio.html':url.pathname.slice(1),file=path.resolve(root,name);
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end('not found')}
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const options={headless:true};if(process.env.CHROME_EXECUTABLE)options.executablePath=process.env.CHROME_EXECUTABLE;const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch(options),reports=[];
  try{
    for(const width of [1440,820,390]){
      const page=await browser.newPage({viewport:{width,height:1000}}),messages=[],external=[];
      page.on('console',message=>{if(['error','warning'].includes(message.type()))messages.push({type:message.type(),text:message.text()})});
      page.on('pageerror',error=>messages.push({type:'pageerror',text:error.message}));
      await page.route('**/*',route=>{const url=route.request().url();if(url.startsWith(base+'/')||url.startsWith('data:'))return route.continue();external.push(url);return route.abort()});
      await page.goto(`${base}/music-studio.html#music-studio`,{waitUntil:'networkidle'});await page.waitForFunction(()=>MusicStudio?.state.loaded===true);
      await page.evaluate(async()=>{
        const app=MusicStudio,p=app.makeProject({projectId:'ai-browser',projectName:'AI Browser Fixture',midiData:{version:1,ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},totalTick:3840,editor:{measureCount:2,editRange:{startMeasure:1,endMeasure:2}},tracks:[{id:'melody',part:'melody',name:'Melody',notes:[{id:'n1',pitch:60,startTick:0,durationTicks:480,velocity:90},{id:'n2',pitch:64,startTick:1920,durationTicks:480,velocity:90}]},{id:'drums',part:'drums',notes:[]},{id:'bass',part:'bass',notes:[]}]}}),repo=app.memoryRepository();
        await repo.put(p);let writes=0;const put=repo.put;repo.put=async value=>{writes++;return put(value)};window.__aiRepo=repo;window.__aiWrites=()=>writes;app.setRepository(repo);app.state.projects=[p];location.hash='music-studio/midi-editor/ai-browser';
      });
      await page.waitForSelector('.music-ai-panel');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>__aiWrites()),0,'render must not write');assert.equal(await page.locator('.music-ai-safe').textContent(),'External request 0');
      await page.fill('#musicAIInstruction','選択範囲を1音上げる');const original=await page.evaluate(()=>MusicStudioEditor.currentTrack(MusicStudio.state.midiEditor).notes.map(note=>note.pitch));await page.getByRole('button',{name:'Preview',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('input[name="musicAINote"]').length===2);assert.deepEqual(await page.evaluate(()=>MusicStudioEditor.currentTrack(MusicStudio.state.midiEditor).notes.map(note=>note.pitch)),original);
      await page.locator('input[name="musicAINote"]').nth(1).uncheck();await page.getByRole('button',{name:'Apply',exact:true}).click();await page.waitForFunction(()=>MusicStudioEditor.currentTrack(MusicStudio.state.midiEditor).notes[0].pitch===61);assert.deepEqual(await page.evaluate(()=>MusicStudioEditor.currentTrack(MusicStudio.state.midiEditor).notes.map(note=>note.pitch)),[61,64]);await page.locator('.music-ai-actions').getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>MusicStudioEditor.currentTrack(MusicStudio.state.midiEditor).notes.map(note=>note.pitch)),original);
      await page.getByRole('button',{name:'A/B/C候補'}).click();await page.selectOption('#aiCandidateKind','chord');await page.getByRole('button',{name:'A/B/Cを生成'}).click();await page.waitForSelector('.music-ai-candidates article');assert.equal(await page.locator('.music-ai-candidates article').count(),3);await page.fill('#aiFromB','1');await page.fill('#aiToB','2');await page.locator('.music-ai-candidates article').nth(1).getByRole('button',{name:'Apply'}).click();const saved=await page.evaluate(()=>MusicStudio.saveMidiEditor({silent:true}));assert.equal(saved.ok,true);
      const persisted=await page.evaluate(async()=>__aiRepo.get('ai-browser'));assert.equal(persisted.aiWorkspace.candidateSets[0].adopted[0].candidateId,'B');assert.deepEqual(persisted.aiWorkspace.candidateSets[0].adopted[0].selection.measures,[1,2]);const sourceBefore=await page.evaluate(async()=>JSON.stringify(await __aiRepo.get('ai-browser')));
      await page.getByRole('button',{name:'New Song'}).click();await page.fill('#aiSongTitle','Synthetic New Song');await page.fill('#aiSongBpm','72');await page.fill('#aiSongMeter','6/8');await page.getByRole('button',{name:'Preview',exact:true}).click();assert.equal((await page.evaluate(()=>__aiRepo.list())).length,1);await page.getByRole('button',{name:'Confirmして新規作成'}).click();await page.waitForFunction(()=>MusicStudio.state.projects.length===2);assert.equal((await page.evaluate(()=>__aiRepo.list())).length,2);assert.equal(await page.evaluate(async before=>JSON.stringify(await __aiRepo.get('ai-browser'))===before,sourceBefore),true);
      const layout=await page.evaluate(()=>{const panel=document.querySelector('.music-ai-panel'),rect=panel.getBoundingClientRect();return{scrollWidth:document.documentElement.scrollWidth,innerWidth,rect:{left:rect.left,right:rect.right,width:rect.width},display:getComputedStyle(panel).display}});assert.ok(layout.rect.left>=-1&&layout.rect.right<=layout.innerWidth+1);assert.equal(messages.length,0,JSON.stringify(messages));assert.equal(external.length,0,JSON.stringify(external));await page.screenshot({path:`music-ai-assistant-${width}.png`,fullPage:true});reports.push({width,layout,messages,external,writes:await page.evaluate(()=>__aiWrites())});await page.close();
    }
    fs.writeFileSync(path.join(root,'verification/music-ai-assistant-browser-report-20261002.json'),JSON.stringify({head:'working-tree',reports},null,2));console.log(JSON.stringify(reports,null,2));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
