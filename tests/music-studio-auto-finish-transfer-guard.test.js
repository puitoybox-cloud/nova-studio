'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const test=require('node:test');
const vm=require('node:vm');

function setup(){
  const calls=[];
  const w={
    AbortController,
    __NOVA_AUTO_FINISH_HANDOFF:{version:1,token:'t'.repeat(43),lifecycleSession:'f'.repeat(32)},
    MusicStudio:{state:{projects:[{projectId:'project-a',revision:4}]},repaint(){}},
    setTimeout(){},
  };
  w.window=w;
  const event={preventDefault(){},target:{elements:{aligned:{checked:true},sourceKind:{value:'recorded-audio'}},querySelectorAll(){
    return ['voice','piano'].map((name,index)=>({
      querySelector(selector){
        if(selector==='[name=stem]')return{files:[{name:`${name}.wav`,size:4096,type:'audio/wav'}]};
        return{value:index===0?'vocal':'piano'};
      },
    }));
  }}};
  w.fetch=async(url,options={})=>{
    calls.push({url,options});
    let payload={};
    if(url.endsWith('/health'))payload={localOnly:true,host:'127.0.0.1',port:8767,protocol:1,lifecycleSession:'f'.repeat(32)};
    else if(url.endsWith('/sessions'))payload={session:'a'.repeat(32)};
    return{ok:true,json:async()=>payload};
  };
  vm.runInNewContext(fs.readFileSync('music-studio-auto-finish.js','utf8'),{window:w,globalThis:w});
  w.MusicStudioAutoFinish.install();
  return{w,calls,event};
}

test('stopping Auto-Finish aborts an in-flight WAV upload and cancels its helper session',async()=>{
  const f=setup(),original=f.w.fetch;
  let started;
  const uploading=new Promise(resolve=>{started=resolve});
  let release;
  f.w.fetch=async(url,options={})=>{
    if(options.method!=='PUT')return original(url,options);
    f.calls.push({url,options});
    started(options.signal);
    await new Promise((resolve,reject)=>{
      release=resolve;
      options.signal?.addEventListener('abort',()=>reject(Error('upload-aborted')),{once:true});
    });
    return{ok:true};
  };
  const running=f.w.MusicStudio.autoFinish.start(f.event,'project-a');
  const signal=await uploading;
  const cancelled=await f.w.MusicStudio.autoFinish.cancel();
  const aborted=signal?.aborted===true;
  if(!aborted)release();
  const result=await running;
  assert.equal(cancelled.ok,true);
  assert.equal(aborted,true,'cancel must abort the active upload, not wait for the whole WAV');
  assert.equal(result.ok,false);
  assert.equal(f.calls.filter(call=>call.options.method==='PUT').length,1);
  assert.equal(f.calls.filter(call=>call.url.endsWith('/start')).length,0);
  assert.equal(f.calls.filter(call=>call.url.endsWith('/cancel')).length,1);
  assert.equal(f.w.MusicStudio.autoFinish.state.busy,false);
});

test('manual Auto-Finish source cannot begin mastering after its project changes mid-transfer',async()=>{
  const f=setup(),original=f.w.fetch;
  f.w.fetch=async(url,options={})=>{
    const response=await original(url,options);
    if(options.method==='PUT')f.w.MusicStudio.state.projects[0].revision++;
    return response;
  };
  const result=await f.w.MusicStudio.autoFinish.start(f.event,'project-a');
  assert.equal(result.ok,false);
  assert.match(result.error,/source-changed/);
  assert.equal(f.calls.filter(call=>call.url.endsWith('/start')).length,0);
  assert.equal(f.calls.filter(call=>call.url.endsWith('/cancel')).length,1);
  assert.equal(f.w.MusicStudio.autoFinish.state.session,null);
});

test('manual Auto-Finish source cannot adopt a started helper session if its project changes during start',async()=>{
  const f=setup(),original=f.w.fetch;
  f.w.fetch=async(url,options={})=>{
    const response=await original(url,options);
    if(url.endsWith('/start'))f.w.MusicStudio.state.projects[0].revision++;
    return response;
  };
  const result=await f.w.MusicStudio.autoFinish.start(f.event,'project-a');
  assert.equal(result.ok,false);
  assert.match(result.error,/source-changed/);
  assert.equal(f.calls.filter(call=>call.url.endsWith('/cancel')).length,1);
  assert.equal(f.w.MusicStudio.autoFinish.state.session,null);
});
