// Real-browser local settings and navigation acceptance; no physical-device claim.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),report=[];
const server=http.createServer((req,res)=>{const file=path.resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'music-studio.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res)});
const deadline=setTimeout(()=>{console.error('workspace browser deadline');process.exit(1)},240000);
(async()=>{let browser;try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
  for(const width of [1440,1180,820,390]){
    const context=await browser.newContext({viewport:{width,height:width===1180?820:1000}}),errors=[],external=[];let page=await context.newPage();
    const monitor=p=>{p.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text())});p.on('pageerror',e=>errors.push(e.message))};monitor(page);
    await context.route('**/*',r=>{if(r.request().url().startsWith(base+'/')||/^(data:|blob:)/.test(r.request().url()))return r.continue();external.push(r.request().url());return r.abort()});
    await page.goto(base+'/music-studio.html');await page.waitForFunction(()=>MusicStudio.state.loaded);
    await page.evaluate(async()=>{const a=MusicStudio,p=a.makeProject({projectId:'workspace-song',projectName:'制作モードの曲',midiData:{ppq:480,tracks:[{id:'lead',part:'melody',name:'Melody',notes:[{id:'n',pitch:60,startTick:0,durationTicks:480,velocity:80}]}]}}),repo=a.indexedDbRepository();a.setRepository(repo);await repo.put(p);a.state.projects=[p];a.goHome()});
    // Exercise real mounted UI and IndexedDB: preferences must not repaint pending work.
    const guardedStates=await page.evaluate(async()=>{
      const a=MusicStudio,results=[];
      for(const kind of ['lyrics','checkpoint']){
        if(kind==='lyrics')a.lyricsEditor.pending={text:'未採用の歌詞'};else a.versionPanel.busy=true;
        const before=JSON.stringify([a.state.settings,a.lyricsEditor.pending,a.versionPanel]),dom=document.querySelector('#music-studio-app'),child=dom.firstChild,stored=JSON.stringify(await a.indexedDbRepository().getSettings());
        for(const op of [()=>a.setWorkMode('mix'),()=>a.toggleFavorite('midi'),()=>a.setWorkActionVisible('mix',false)]){
          const r=await op();if(r.ok||r.error!=='workspace-busy')throw Error(kind+': unguarded preference');
        }
        if(JSON.stringify([a.state.settings,a.lyricsEditor.pending,a.versionPanel])!==before||dom.firstChild!==child||JSON.stringify(await a.indexedDbRepository().getSettings())!==stored)throw Error(kind+': pending work changed');
        if(kind==='lyrics')a.lyricsEditor.pending=null;else a.versionPanel.busy=false;
        results.push(kind);
      }return results;
    });assert.deepEqual(guardedStates,['lyrics','checkpoint']);
    const blockedNavigation=await page.evaluate(()=>{
      const a=MusicStudio,results=[];
      const states=[['dirty project',()=>a.state.dirty=true,()=>a.state.dirty=false],['dirty MIDI',()=>a.state.midiEditor={dirty:true},()=>a.state.midiEditor=null],['MIDI recording',()=>a.state.midiInput.recording=true,()=>a.state.midiInput.recording=false],['MIDI count-in',()=>a.state.midiInput.countingIn=true,()=>a.state.midiInput.countingIn=false],['MIDI stopping',()=>a.state.midiInput.stopping=true,()=>a.state.midiInput.stopping=false],['MIDI save',()=>a.state.midiEditorSaveInFlight=true,()=>a.state.midiEditorSaveInFlight=false],['project save',()=>a.state.saveStatus='saving',()=>a.state.saveStatus='idle'],['lyrics candidate',()=>a.lyricsEditor.pending={},()=>a.lyricsEditor.pending=null],['lyrics save',()=>a.lyricsEditor.busy=true,()=>a.lyricsEditor.busy=false],['PCM save',()=>a.pcmEditor.busy=true,()=>a.pcmEditor.busy=false],['archive',()=>a.archiveTransfer.busy=true,()=>a.archiveTransfer.busy=false],['checkpoint',()=>a.versionPanel.busy=true,()=>a.versionPanel.busy=false],['export',()=>a.finalExport.busy=true,()=>a.finalExport.busy=false],['vocal recording',()=>a.vocal.phase='recording',()=>a.vocal.phase='idle'],['vocal pending',()=>a.vocal.pending={},()=>a.vocal.pending=null]];
      const confirm=window.confirm;window.confirm=()=>false;
      try{for(const [name,set,clear]of states){set();try{const origin=location.hash,snapshot=JSON.stringify(a.state.projects);for(const action of ['midi','assistant','lyrics','vocal','mix','harmony','master','export','backup','settings']){if(a.openWorkAction(action,'workspace-song')!==false||location.hash!==origin||JSON.stringify(a.state.projects)!==snapshot)throw Error(name+':'+action)}results.push(name)}finally{clear()}}}finally{window.confirm=confirm}return results;
    });assert.equal(blockedNavigation.length,15);
    await page.locator('[data-workspace]>summary').click();await page.locator('[data-work-mode]').selectOption('finish');await page.waitForFunction(()=>MusicStudio.state.settings.workspace.mode==='finish');await page.getByRole('button',{name:'Export（最終書き出し）のお気に入り追加',exact:true}).click();await page.waitForFunction(()=>MusicStudio.state.settings.workspace.favorites.includes('export'));
    assert.equal(await page.locator('[data-workspace]').getAttribute('open')!==null,true);
    await page.evaluate(async()=>{const r=await MusicStudio.setWorkActionVisible('export',false);if(!r.ok)throw Error(r.error)});
    assert.equal(await page.getByRole('button',{name:'Export（最終書き出し）',exact:true}).count(),0);

    const saved=await page.evaluate(async()=>{const a=MusicStudio,original=JSON.stringify(a.state.projects[0]),archive=await a.createLongWavArchive(),r=await a.restoreLongWavArchive(archive,{settings:true});if(!r.ok)throw Error(r.error);if(JSON.stringify(a.state.projects[0])!==original)throw Error('song-mutated');return a.state.settings.workspace});
    assert.deepEqual(saved,{hidden:['export'],mode:'finish',favorites:['export']});
    await page.close();page=await context.newPage();monitor(page);await page.goto(base+'/music-studio.html');await page.waitForFunction(()=>MusicStudio.state.loaded);assert.deepEqual(await page.evaluate(()=>MusicStudio.state.settings.workspace),saved);
    await page.locator('[data-workspace]>summary').click();await page.locator('[data-work-project]').selectOption('workspace-song');
    const beforeRequestHash=await page.evaluate(()=>location.hash);
    await page.locator('[data-work-request] input').fill('書き出しの画面を開きたい');
    await page.getByRole('button',{name:'Find（画面候補を表示）',exact:true}).click();
    assert.equal(await page.locator('[data-work-request-result] button').count(),1);
    assert.equal(await page.evaluate(()=>location.hash),beforeRequestHash);
    await page.locator('[data-work-request-result] button').click();await page.waitForSelector('.music-final-export');await page.waitForFunction(()=>document.activeElement?.matches('.music-final-export'));
    const routes=['music-studio','music-studio/recent-projects','music-studio/new-project','music-studio/project/workspace-song','music-studio/vocal/workspace-song','music-studio/settings','music-studio/backup','music-studio/lyrics-notes/workspace-song','music-studio/mixing/workspace-song','music-studio/midi-editor/workspace-song'];const screens=[];
    const metrics=()=>page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,small:[...document.querySelectorAll('[data-workspace] button,[data-workspace] select,.music-editor-popover button,.music-correction-popover button')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().height<43.9).map(e=>e.textContent),labels:[...document.querySelectorAll('[data-workspace] label')].map(e=>getComputedStyle(e).gap)}));
    for(let i=0;i<routes.length;i++){
      await page.evaluate(route=>{location.hash=route},routes[i]);await page.waitForTimeout(200);let m=await metrics();assert.equal(m.overflow,false,`${width}: ${routes[i]}`);assert.deepEqual(m.small,[]);assert.ok(m.labels.every(g=>g==='4px'));screens.push({route:routes[i],...m});await page.screenshot({path:`verification/music-workspace-${width}-${i}.png`,fullPage:true});
    }
    const menus=await page.locator('.music-editor-topbar>details').count();let opened=0,hiddenMenus=0;
    for(let i=0;i<menus;i++){
      const menu=page.locator('.music-editor-topbar>details').nth(i),summary=menu.locator(':scope>summary');if(!await summary.isVisible()){hiddenMenus++;continue}await summary.click();await page.waitForTimeout(100);const m=await metrics();assert.equal(m.overflow,false);assert.deepEqual(m.small,[],`${width}: popup ${i}`);await page.screenshot({path:`verification/music-workspace-popup-${width}-${i}.png`,fullPage:true});if(await menu.getAttribute('open')!==null)await menu.locator(':scope>summary').click();opened++;
    }
    await page.evaluate(()=>MusicStudio.goHome());await page.waitForSelector('#musicHomeHelp',{state:'attached'});await page.evaluate(()=>MusicStudio.openHelp('musicHomeHelp'));await page.waitForFunction(()=>document.querySelector('#musicHomeHelp').open);await page.screenshot({path:`verification/music-workspace-help-${width}.png`,fullPage:true});await page.evaluate(()=>MusicStudio.closeHelp('musicHomeHelp'));
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);report.push({width,screens,menusOpened:opened,responsiveHiddenMenus:hiddenMenus,guardedStates,blockedNavigation,fullArchive:true,freshReopen:true,explicitExportNavigation:true,errors,external});await context.close();
  }
  fs.writeFileSync(path.join(root,'verification/music-workspace-browser.json'),JSON.stringify({head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),report},null,2));console.log(JSON.stringify(report));
}finally{clearTimeout(deadline);await browser?.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
