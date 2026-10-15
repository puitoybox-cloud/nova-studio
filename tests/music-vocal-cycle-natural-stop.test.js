'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('music-studio.js','utf8');
const start=source.indexOf('function vocalStop(naturalCompletion=false)');
const end=source.indexOf('async function vocalSave()',start);
assert.ok(start>0&&end>start);
function harness(){
 const clears=[],cycle={active:true,timer:99},recorder={state:'recording',stop(){this.state='inactive';this.calls=(this.calls||0)+1}};
 const vocal={phase:'recording',recorder,completion:Promise.resolve({ok:true}),stopPromise:null};
 const ctx={vocalCycle:cycle,vocal,root:{clearTimeout:n=>clears.push(n)},vocalMonitor:()=>{},vocalDiscard:()=>{},requestPaint:()=>{}};
 const stop=vm.runInNewContext('('+source.slice(start,end).trim()+')',ctx);
 return{stop,cycle,vocal,recorder,clears};
}
test('natural timeout stops and saves the take without cancelling remaining cycle takes',async()=>{
 const x=harness();const result=await x.stop(true);
 assert.equal(result.ok,true);assert.equal(x.cycle.active,true);
 assert.equal(x.recorder.calls,1);assert.ok(!x.clears.includes(99));
});
test('manual Stop cancels cycle continuation and stops the active recorder',async()=>{
 const x=harness();await x.stop();
 assert.equal(x.cycle.active,false);assert.ok(x.clears.includes(99));
 assert.equal(x.recorder.calls,1);
});
test('recording and Resume timeout paths call natural stop, not manual stop',()=>{
 assert.match(source,/vocal\.timer=plan\.enabled\?null:root\.setTimeout\?\.\(\(\)=>vocalStop\(true\),recordSeconds\*1000\)/);
 assert.match(source,/if\(remaining<=0\)return await vocalStop\(true\)/);
 assert.match(source,/vocal\.timer=root\.setTimeout\?\.\(\(\)=>vocalStop\(true\),remaining\*1000\)/);
 assert.match(source,/onended=\(\)=>\{vocal\.message=.*vocalStop\(\)/);
});
