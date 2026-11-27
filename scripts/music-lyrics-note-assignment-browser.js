const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'music-studio.html',file=path.resolve(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});const base=`http://127.0.0.1:${server.address().port}`,report=[];
for(const width of [1440,820,390]){const page=await browser.newPage({viewport:{width,height:1000}}),messages=[],external=[];page.on('console',m=>{if(['error','warning'].includes(m.type()))messages.push(m.text())});page.on('pageerror',e=>messages.push(e.message));await page.route('**/*',r=>{if(r.request().url().startsWith(base+'/')||r.request().url().startsWith('data:'))return r.continue();external.push(r.request().url());return r.abort()});await page.goto(base+'/music-studio.html');await page.waitForFunction(()=>MusicStudio.state.loaded);
await page.evaluate(async()=>{const a=MusicStudio,p=a.makeProject({projectId:'lyrics-browser',projectName:'Lyrics browser',midiData:{ppq:480,tracks:[{id:'lead',part:'melody',notes:[{id:'a',pitch:60,startTick:0,durationTicks:480},{id:'b',pitch:64,startTick:480,durationTicks:480},{id:'c',pitch:67,startTick:960,durationTicks:480}]}]}});window.__lyricsRepo=a.indexedDbRepository();a.setRepository(__lyricsRepo);await __lyricsRepo.put(p);a.state.projects=[p];a.openLyricsAssignment(p.projectId)});await page.waitForSelector('#musicLyricsForm');await page.selectOption('[name=trackId]','lead');await page.fill('[name=toNote]','3');await page.fill('[name=text]','君');await page.fill('[name=reading]','きみ');
await page.getByRole('button',{name:'Split kana（かなの読みを分ける）',exact:true}).click();
assert.match(await page.locator('[data-lyrics-fit]').textContent(),/歌詞 1文字.*読み 2枠.*選択音符 3個.*1枠不足/);
await page.getByRole('button',{name:'末尾の読みを残りの音符へ伸ばす',exact:true}).click();
assert.equal(await page.locator('[name=reading]').inputValue(),'き み ~');
assert.match(await page.locator('[data-lyrics-fit]').textContent(),/読み 2枠 ＋ 伸ばす 1枠/);await page.getByRole('button',{name:'Preview（割付を確認）',exact:true}).click();assert.equal(await page.evaluate(async()=>(await __lyricsRepo.get('lyrics-browser')).syllableAssignments.length),0);await page.getByRole('button',{name:'Apply / Save（採用・保存）',exact:true}).click();await page.waitForFunction(()=>MusicStudio.lyricsEditor.message.includes('保存しました'));assert.equal(await page.evaluate(async()=>(await __lyricsRepo.get('lyrics-browser')).syllableAssignments[0].assignments.length),3);await page.reload();await page.waitForSelector('#musicLyricsForm');assert.match(await page.locator('main').innerText(),/君/);
const original=await page.evaluate(async()=>{
 const saved=await MusicStudio.indexedDbRepository().get('lyrics-browser');
 return {id:saved.syllableAssignments[0].id,midi:saved.midiData};
});
await page.selectOption('[name=trackId]','lead');await page.fill('[name=toNote]','1');
await page.fill('[name=text]','君');await page.fill('[name=reading]','き');
await page.getByRole('button',{name:'Preview（割付を確認）',exact:true}).click();
await page.getByText('置き換える保存済みの読み',{exact:true}).waitFor();
assert.equal(await page.evaluate(async()=>(await MusicStudio.indexedDbRepository().get('lyrics-browser')).productionHistory
 .filter(row=>row.type==='lyrics-assignment-reconcile').length),0);
await page.getByRole('button',{name:'Apply / Save（採用・保存）',exact:true}).click();
await page.waitForFunction(()=>MusicStudio.lyricsEditor.message.includes('保存しました'));
await page.reload();await page.waitForSelector('#musicLyricsForm');
const reopened=await page.evaluate(async()=>{
 const saved=await MusicStudio.indexedDbRepository().get('lyrics-browser');
 return {assignments:saved.syllableAssignments,midi:saved.midiData,events:saved.productionHistory.filter(row=>row.type==='lyrics-assignment-reconcile')};
});
assert.equal(reopened.events.length,1);
assert.equal(reopened.events[0].assignmentId,reopened.assignments.at(-1).id);
assert.equal(reopened.events[0].replaced[0].recordId,original.id);
assert.equal(reopened.events[0].replaced[0].previous[0].token,'き');
assert.deepEqual(reopened.assignments[0].assignments.map(row=>row.token),['み','~']);
assert.deepEqual(reopened.midi,original.midi);
await page.getByText('歌詞割付の置き換え履歴',{exact:true}).click();
await page.getByText(/以前の読み き/).waitFor();
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(messages,[]);assert.deepEqual(external,[]);report.push({width,savedReopened:true,lyricsSlotsAndSustain:true,lyricsConflictHistory:true,overflow:false,console:messages,external});await page.close()}
console.log(JSON.stringify(report,null,2));}finally{await browser?.close();server.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
