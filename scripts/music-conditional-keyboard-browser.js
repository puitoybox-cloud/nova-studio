'use strict';
// Real native disclosure activation, nested Escape, repaint and Tab assertions.
// Fixtures populate production state through the same validators and DSP APIs.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright'),AxeBuilder=require('@axe-core/playwright').default;
const root=path.resolve(__dirname,'..'),report={head:process.env.NOVA_TESTED_HEAD,screens:[]};
const server=http.createServer((req,res)=>{const file=path.resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'music-studio.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res)});
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/usr/bin/chromium'});
 for(const width of [1440,1180,820,390]){
  const context=await browser.newContext({viewport:{width,height:820}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/music-studio.html');await page.waitForFunction(()=>MusicStudio.state.loaded);
  await page.evaluate(async()=>{
   const a=MusicStudio;let p=a.makeProject({projectId:'conditional-song',projectName:'Conditional keyboard',midiData:{ppq:480,tracks:[{id:'lead',part:'melody',notes:[{id:'n',pitch:60,velocity:80,startTick:0,durationTicks:480}]}]}});
   for(const name of ['Soft sample','Loud sample'])p=a.pcmImport(p,{sampleRate:48000,channels:[Array.from({length:24000},(_,i)=>Math.sin(2*Math.PI*220*i/48000)*.1)]},name);
   const instrument=MusicStudioInstruments.normalize({version:2,name:'Keyboard Piano',regions:p.pcmMix.assets.map((asset,i)=>({id:'zone-'+i,assetId:asset.id,rootPitch:60,velocityLow:i?71:1,velocityHigh:i?127:70}))});
   p.midiData.tracks[0].sampleInstrument=instrument;p.instrumentLibrary={version:1,patches:[{id:'preset-one',name:'Keyboard Piano',instrument},{id:'preset-two',name:'Second Piano',instrument}]};
   const checked=a.validateProject(p);if(!checked.valid)throw Error(JSON.stringify(checked));const repo=a.indexedDbRepository();a.setRepository(repo);await repo.put(p);await a.refresh();
   a.pcmEditor.projectId=p.projectId;
   const wav=a.vocalWav([Float32Array.from({length:24000},(_,i)=>.1*Math.sin(2*Math.PI*220*i/48000))],48000);
   const imported=await a.pcmImportLongFile(new File([wav.blob],'Long source.wav',{type:'audio/wav'}),p.projectId);if(!imported.ok)throw Error(imported.error);
   for(const name of ['Lead take.wav','Alternate take.wav']){a.vocal.projectId=p.projectId;a.vocal.target=repo;a.vocal.baseline=JSON.stringify(a.state.projects[0]);a.vocal.pending={...wav,name,captureMime:'audio/wav',startTick:0,latencyMs:0};a.vocal.phase='pending';const result=await a.vocalSave();if(!result.ok)throw Error(result.error);}

  });
  const routes=['music-studio','music-studio/projects','music-studio/new','music-studio/settings','music-studio/backup',...['project','midi-editor','ai-editor','lyrics-notes','vocal','mixing-workspace','mixing-master','mixing-long-master','mixing-export'].map(s=>'music-studio/'+s+'/conditional-song')];
  for(const route of routes){
   await page.goto(base+'/music-studio.html#'+route);await page.waitForFunction(()=>MusicStudio.state.loaded);await settle(page);
   const candidate=await page.evaluate(async route=>{
    const a=MusicStudio,id='conditional-song',p=a.state.projects.find(p=>p.projectId===id),asset=p.pcmMix.assets[0];
    if(route.includes('/midi-editor/')){MusicStudioAIAssistantPanel.setTab(id,'candidates');MusicStudioAIAssistantPanel.generateCandidates(id);const sets=MusicStudioAIAssistantPanel._states.get(id)?.state.workspace.candidateSets;if(!sets?.length)throw Error('missing AI candidates');return 'instrument-management-and-AI-ABC';}
    if(route.includes('/mixing-workspace/')){Object.assign(a.pcmEditor,{projectId:id,assetId:asset.id,gainDb:-3});a.pcmShowPreview(null,id);if(!a.pcmEditor.preview)throw Error('missing mix candidate');return 'mix';}
    if(route.includes('/mixing-long-master/')){a.pcmEditor.projectId=id;const r=await a.longMasterPreview(id,p.longWavAssets[0].id,-14,-1);if(!r.ok)throw Error(r.error);return 'long-master';}
    if(route.includes('/mixing-master/')){a.pcmEditor.projectId=id;const r=await a.masterCompare(id,asset.id);if(!r.ok)throw Error(r.error);if(!a.masterChoose(id,1).ok)throw Error('master choose failed');return 'master-ABC';}
    if(route.includes('/mixing-export/')){const r=await a.finalPreview(id,{format:'nova-final-export-plan-v1',routes:a.finalSources(p).map(s=>({key:s.key,role:'instrument',startSeconds:0,gainDb:-6,muted:false})),targetLufs:-14,ceilingDb:-1,includeMidi:true});if(!r.ok)throw Error(r.error);return 'export-files';}
    return 'saved-instruments';
   },route);await settle(page);
   // Expand every ancestor to expose conditional management and nested zones.
   await page.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));await settle(page);
   const violations=(await new AxeBuilder({page}).analyze()).violations;assert.deepEqual(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${width} ${route} populated axe`);
   const count=await page.locator('details').count(),checks=[];
   for(let i=0;i<count;i++){
    const detail=page.locator('details').nth(i),summary=detail.locator(':scope > summary');
    await detail.evaluate(d=>{const parents=[];for(let p=d;p;p=p.parentElement)if(p.tagName==='DETAILS')parents.unshift(p);for(const p of parents)p.open=true});await settle(page);
    if(!await summary.isVisible())continue;
    const label=await summary.innerText();
    if(!await detail.evaluate(d=>d.open)){await summary.press('Enter');await settle(page);}assert.equal(await detail.evaluate(d=>d.open),true,label+' opens before closure check');
    if(/Manage presets|^Zone |^Keyboard Piano$|^Second Piano$|Multi sample|Files（/.test(label)){const result=(await new AxeBuilder({page}).analyze()).violations;assert.deepEqual(result.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${width} ${route} ${label} axe`);}
    await summary.focus();await summary.press('Enter');await settle(page);assert.equal(await detail.evaluate(d=>d.open),false,label+' Enter closes');
    await summary.press('Enter');await settle(page);assert.equal(await detail.evaluate(d=>d.open),true,label+' Enter opens');
    await summary.evaluate(summary=>{
      const visible=e=>{if(e.disabled||e.tabIndex<0||!e.getClientRects().length||getComputedStyle(e).visibility!=='visible'||e.closest('[inert]'))return false;for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open&&!p.querySelector(':scope > summary')?.contains(e))return false;return true};
      const controls=[...document.querySelectorAll('input:not([type=hidden]),select,textarea,button,summary,a[href],[tabindex]')].filter(visible);
      if(controls.some(e=>e.tabIndex>0))throw Error('positive tabindex changes native DOM order');
      window.__expectedTab=controls[controls.indexOf(summary)+1]||document.body;
    });
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement===window.__expectedTab),true,label+' Tab follows visible DOM order');
    await page.keyboard.press('Shift+Tab');assert.equal(await summary.evaluate(e=>document.activeElement===e),true,label+' Shift+Tab returns to summary');
    // Focus a descendant when available; Escape must not collapse its parent.
    await detail.evaluate(d=>{const e=[...d.querySelectorAll('input:not([type=hidden]),select,textarea,button,summary')].find(e=>e!==d.querySelector(':scope > summary')&&!e.disabled&&e.tabIndex>=0&&e.getClientRects().length&&e.closest('details')===d);(e||d.querySelector(':scope > summary')).focus()});
    await page.keyboard.press('Escape');await settle(page);
    assert.equal(await detail.evaluate(d=>d.open),false,label+' Escape closes');
    assert.equal(await summary.evaluate(e=>document.activeElement===e),true,label+' Escape returns focus');
    assert.equal(await detail.evaluate(d=>{for(let p=d.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open)return false;return true}),true,label+' ancestors remain open');
    // Force actual DOM replacement while a disclosure trigger owns focus.
    await page.evaluate(()=>MusicStudio.repaint());await settle(page);
    assert.equal(await summary.evaluate(e=>document.activeElement===e),true,label+' repaint returns same live summary');
    assert.equal(await detail.evaluate(d=>d.open),false,label+' repaint preserves Escape closure');
    checks.push(label);
   }
   if(route.includes('/midi-editor/')){assert.ok(checks.some(s=>s.includes('Manage presets')),'preset management must be exercised');assert.ok(checks.some(s=>s.startsWith('Zone 1')),'multisample zones must be exercised');assert.ok(checks.includes('Keyboard Piano'),'saved preset must be exercised');}
   if(route.includes('/midi-editor/')){const saved=await page.evaluate(()=>MusicStudio.saveMidiEditor());assert.equal(saved.ok,true,'persist generated candidates before navigation');}
   report.screens.push({width,route,candidate,disclosures:checks,axeViolations:violations.length});console.log(width,route,candidate,checks.length,'disclosures passed');
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 report.complete=true;
 }finally{fs.writeFileSync(path.join(root,'verification/music-conditional-keyboard-browser.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
