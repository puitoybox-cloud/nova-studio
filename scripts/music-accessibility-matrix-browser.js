'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright'),AxeBuilder=require('@axe-core/playwright').default;
const root=path.resolve(__dirname,'..'),report={head:process.env.NOVA_TESTED_HEAD,screens:[]};
const server=http.createServer((req,res)=>{const file=path.resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'music-studio.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res)});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/usr/bin/chromium'});const context=await browser.newContext(),page=await context.newPage();
 await page.goto(base+'/music-studio.html');await page.waitForFunction(()=>MusicStudio.state.loaded);
 await page.evaluate(async()=>{const a=MusicStudio,r=a.indexedDbRepository(),p=a.makeProject({projectId:'a11y-song',projectName:'Keyboard acceptance',midiData:{ppq:480,tempo:120,tracks:[{id:'lead',part:'melody',notes:[{id:'n',pitch:60,velocity:80,startTick:0,durationTicks:480}]}]}});await r.put(p);await a.refresh()});
 for(const route of ['music-studio','music-studio/projects','music-studio/new','music-studio/settings','music-studio/backup',...['project','midi-editor','ai-editor','lyrics-notes','vocal','mixing-workspace','mixing-master','mixing-long-master','mixing-export'].map(s=>'music-studio/'+s+'/a11y-song')]){
  await page.goto(base+'/music-studio.html#'+route);await page.waitForFunction(()=>MusicStudio.state.loaded);await page.waitForTimeout(100);
  console.log('Checking accessibility route',route);
  const focus=await page.evaluate(async()=>{
   const selector='input:not([type=hidden]),select,textarea,button,summary,a[href],[tabindex]';
   const visible=e=>{if(e.disabled||e.tabIndex<0||!e.getClientRects().length||getComputedStyle(e).visibility!=='visible'||e.closest('[inert]'))return false;for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open&&!p.querySelector(':scope > summary')?.contains(e))return false;return true};
   const describe=e=>[e.tagName,e.id,e.name,e.getAttribute('aria-label'),e.getAttribute('onclick'),e.textContent?.trim().slice(0,160)].join('|');
   const all=[...document.querySelectorAll(selector)].filter(visible),positive=all.filter(e=>e.tabIndex>0).map(describe),samples=[];
   for(const tag of ['INPUT','SELECT','TEXTAREA','BUTTON','SUMMARY']){
    const element=[...document.querySelectorAll(selector)].find(e=>e.tagName===tag&&visible(e));if(!element)continue;
    element.focus();if(document.activeElement!==element)throw Error('control not focusable '+element.outerHTML);const before=describe(element);MusicStudio.repaint();await Promise.resolve();const after=describe(document.activeElement);
    if(before!==after)throw Error('focus lost '+tag+': '+before+' -> '+after+'; old='+element.outerHTML+'; matching='+[...document.querySelectorAll(selector)].filter(e=>e.tagName===tag).map(e=>e.outerHTML.slice(0,200)).join(' / '));samples.push(tag);
   }
   return{positive,restored:samples,tabbable:all.length};
  });assert.deepEqual(focus.positive,[],route+' positive tab order');
  // Record an actual keyboard traversal, including native summary toggling.
  await page.evaluate(()=>{document.activeElement?.blur()});const visited=[];
  for(let i=0;i<Math.min(focus.tabbable+1,400);i++){await page.keyboard.press('Tab');visited.push(await page.evaluate(()=>({tag:document.activeElement.tagName,name:document.activeElement.getAttribute('aria-label')||document.activeElement.name||document.activeElement.textContent?.trim().slice(0,60)})))}
  const collapsed=await new AxeBuilder({page}).analyze();
  await page.locator('details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
  const expanded=await new AxeBuilder({page}).analyze();
  report.screens.push({route,focus,tabOrder:visited,collapsed:collapsed.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})),expanded:expanded.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});
  console.log(route,'focus samples',focus.restored.join(','),'axe violations',collapsed.violations.length,expanded.violations.length);
 }
 report.complete=true;await context.close();
 }finally{fs.writeFileSync('verification/music-accessibility-matrix-browser.json',JSON.stringify(report,null,2)+'\n');await browser?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
