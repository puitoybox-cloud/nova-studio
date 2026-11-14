// Real browser against the exact staged native Web resources (no index.html).
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{
 const staged=fs.mkdtempSync(path.join(os.tmpdir(),'nova-menu-'));
 let browser,server;
 try{
  execFileSync('python3',['scripts/music-stage-native-web.py',staged]);
  assert(!fs.existsSync(path.join(staged,'index.html')));
  const missing=[],errors=[];
  server=http.createServer((req,res)=>{const file=path.resolve(staged,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(staged+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){missing.push(req.url);res.writeHead(404);return res.end()};res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res)});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${server.address().port}/music-studio.html`;
  await page.goto(url);await page.waitForFunction(()=>window.MusicStudio?.state.loaded);
  await page.evaluate(async()=>{const a=MusicStudio,p=a.makeProject({projectId:'menu-regression',projectName:'Menu persistence',bpm:117});await a.indexedDbRepository().put(p);await a.refresh();a.openProject(p.projectId)});
  const original=await page.evaluate(async()=>JSON.stringify(await MusicStudio.indexedDbRepository().get('menu-regression')));
  const click=async route=>{await page.locator('.nova-menu-toggle').click();await page.locator('.nova-menu-panel [data-route="'+route+'"]').click()};
  // Unstored MIDI edits must prevent menu navigation via the existing guard.
  const before=page.url();await page.evaluate(()=>{MusicStudio.state.midiEditor={dirty:true}});await click('projects');assert.equal(page.url(),before);await page.evaluate(()=>{MusicStudio.state.midiEditor=null});
  for(const [route,target] of [['projects','recent-projects'],['settings','settings'],['backup','backup'],['home',''],['music-studio','']]){
   await click(route);await page.waitForFunction(hash=>location.hash===hash,'#music-studio'+(target?'/'+target:''));
   assert.equal(page.url().split('#')[0],url);
   assert.equal(await page.evaluate(async()=>(await MusicStudio.prepareForShutdown()).ok),true);
  }
  assert.equal(await page.evaluate(async()=>JSON.stringify(await MusicStudio.indexedDbRepository().get('menu-regression'))),original);
  await page.reload();await page.waitForFunction(()=>window.MusicStudio?.state.loaded);
  assert.equal(await page.evaluate(async()=>JSON.stringify(await MusicStudio.indexedDbRepository().get('menu-regression'))),original);
  assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({stagedNativeResources:true,menuDestinations:5,dirtyMidiBlocked:true,shutdownSave:true,reloadPersistence:true,missing,errors}));
 }finally{await browser?.close();if(server)await new Promise(r=>server.close(r));fs.rmSync(staged,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
