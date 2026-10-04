const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('Chrome regression exception closes page and browser and exits nonzero without open handles',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'nova-browser-cleanup-'));
 try{
  const marker=path.join(temp,'cleanup.json'),hook=path.join(temp,'hook.js');
  fs.writeFileSync(hook,`require('node:child_process').execFileSync=()=> 'cleanup-fixture';const Module=require('module'),fs=require('fs'),original=Module._load;let events=[];Module._load=function(name,...args){if(name==='playwright')return{chromium:{launch:async()=>({newPage:async()=>({on(){},route:async()=>{},goto:async()=>{},addScriptTag:async()=>{},waitForFunction:async()=>{},evaluate:async()=>{throw Error('injected-evaluate-failure')},close:async()=>events.push('page')}),close:async()=>{events.push('browser');fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify(events))}})}};return original.call(this,name,...args)};`);
  const result=spawnSync(process.execPath,['--require',hook,path.resolve(__dirname,'../scripts/music-transaction-regression.js')],{cwd:temp,encoding:'utf8',timeout:4000});
  assert.equal(result.error,undefined);assert.equal(result.status,1);assert.match(result.stderr,/injected-evaluate-failure/);assert.deepEqual(JSON.parse(fs.readFileSync(marker)),['page','browser']);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
