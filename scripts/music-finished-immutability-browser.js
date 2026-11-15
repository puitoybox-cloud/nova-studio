'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'music-studio.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res)});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/usr/bin/chromium'});
 const context=await browser.newContext(),page=await context.newPage(),base=`http://127.0.0.1:${server.address().port}`;
 await page.goto(base+'/music-studio.html');await page.waitForFunction(()=>MusicStudio.state.loaded);
 const report=await page.evaluate(async()=>{
  const a=MusicStudio,r=a.indexedDbRepository();a.setRepository(r);
  let p=a.makeProject({projectId:'finished-boundary',projectName:'Finished boundary',productionNotes:'original',midiData:{ppq:480,tracks:[{id:'lead',notes:[{id:'n',pitch:60,velocity:80,startTick:0,durationTicks:480}]}]}});
  await r.put(p);a.state.projects=[p];a.state.loaded=true;
  let result=await a.versionSave(p.projectId,'Final',{kind:'finished'});if(!result.ok)throw Error(result.error);
  p=await r.get(p.projectId);const baseline=JSON.stringify(p),checkpoint=p.songVersions.checkpoints[0],cases=[];
  // Each persisted snapshot field, all receipt metadata and ledger deletion.
  const changes=[...Object.keys(checkpoint.snapshot).map(key=>['snapshot.'+key,q=>{delete q.songVersions.checkpoints[0].snapshot[key]}]),
   ['snapshot.replace',q=>q.songVersions.checkpoints[0].snapshot={}],
   ...['id','name','kind','createdAt','sourceRevision'].map(key=>['receipt.'+key,q=>{delete q.songVersions.checkpoints[0][key]}]),
   ['checkpoint.remove',q=>q.songVersions.checkpoints=[]],['ledger.remove',q=>{delete q.songVersions}]];
  for(const sink of ['put','compareAndPut','putLongWav'])for(const [name,mutate] of changes){
   const next=JSON.parse(baseline);mutate(next);const binaryId='must-rollback-'+sink+'-'+name;
   let error;try{if(sink==='putLongWav')await r.putLongWav(next,{id:binaryId,blob:new Blob(['unchanged binary'])},baseline,()=>{});else await r[sink](next,baseline)}catch(e){error=e.message}
   if(error!=='finished-snapshot-immutable')throw Error(sink+'/'+name+': '+error);
   if(JSON.stringify(await r.get(p.projectId))!==baseline)throw Error('failed write changed source');
   if(sink==='putLongWav'&&await r.getLongWav(binaryId))throw Error('failed metadata left binary');
   cases.push(sink+'/'+name);
  }
  // All replacement sinks allow working edits while retaining the receipt.
  for(const sink of ['put','compareAndPut','putLongWav']){
   const current=await r.get(p.projectId),next=JSON.parse(JSON.stringify(current));next.productionNotes=sink;next.revision++;
   if(sink==='putLongWav')await r.putLongWav(next,{id:'successful-working-binary',blob:new Blob(['working'])},JSON.stringify(current),()=>{});else await r[sink](next,JSON.stringify(current));
   const saved=await r.get(p.projectId);if(saved.productionNotes!==sink||JSON.stringify(saved.songVersions.checkpoints[0])!==JSON.stringify(checkpoint))throw Error('working edit or receipt lost');
  }
  await a.refresh();a.openProject(p.projectId);
  const before=JSON.stringify(await r.get(p.projectId));
  result=await a.finishedOpen(p.projectId,checkpoint.id);if(!result.ok)throw Error(result.error);
  const fork=await r.get(result.project.projectId);fork.productionNotes='editable copy';fork.revision++;await r.put(fork);
  if(JSON.stringify(await r.get(p.projectId))!==before)throw Error('copy edit changed source');
  if((await r.get(fork.projectId)).productionNotes!=='editable copy')throw Error('copy not editable');
  return{rejected:cases,workingSinks:['put','compareAndPut','putLongWav'],binaryRollback:true,editableForkId:fork.projectId,sourceId:p.projectId,source:before};
 });
 await page.close();const reopened=await context.newPage();await reopened.goto(base+'/music-studio.html');await reopened.waitForFunction(()=>MusicStudio.state.loaded);
 const persisted=await reopened.evaluate(async report=>{const r=MusicStudio.indexedDbRepository();if(JSON.stringify(await r.get(report.sourceId))!==report.source)throw Error('source changed after reopen');if((await r.get(report.editableForkId)).productionNotes!=='editable copy')throw Error('fork lost');return true},report);
 delete report.source;report.reopened=persisted;report.head=process.env.NOVA_TESTED_HEAD||null;
 fs.writeFileSync('verification/music-finished-immutability-browser.json',JSON.stringify(report,null,2)+'\n');console.log('Finished boundary browser cases:',report.rejected.length);
 await context.close();
 }finally{await browser?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
