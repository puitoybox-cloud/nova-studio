'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const calls=[],timeouts=[];let sessionStatus={complete:false,progress:{stage:'measure',completed:1,total:2}};
 const form={elements:{aligned:{checked:true},sourceKind:{value:'logic-render'}},querySelectorAll:()=>[
  {querySelector:s=>s==='[name=stem]'?{files:[{name:'vocal.wav',size:64,type:'audio/wav'}]}:{value:'vocal'}},
  {querySelector:s=>s==='[name=stem]'?{files:[{name:'piano.wav',size:64,type:'audio/wav'}]}:{value:'piano'}}]};
 const w={window:null,location:{},MusicStudio:{state:{projects:[{projectId:'p',revision:3}]},repaint(){}},setTimeout:fn=>timeouts.push(fn),document:{createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}}};w.window=w;
 w.fetch=async(url,options={})=>{calls.push({url,options});let payload={};if(url.endsWith('/health'))payload={localOnly:true,host:'127.0.0.1',port:8767,protocol:1,token:'token'};else if(url.endsWith('/sessions'))payload={session:'a'.repeat(32)};else if(url.endsWith('/start'))payload={ok:true};else if(options.method==='PUT')payload={ok:true};else if(url.includes('/sessions/'))payload=sessionStatus;return{ok:true,json:async()=>payload}};
 vm.runInNewContext(fs.readFileSync('music-studio-auto-finish.js','utf8'),{window:w,globalThis:w,console});w.MusicStudioAutoFinish.install();
 return{w,form,calls,timeouts,setStatus:v=>sessionStatus=v};
}
test('GUI uploads explicit stems then starts existing CLI session',async()=>{const f=fixture(),event={preventDefault(){},target:f.form};const result=await f.w.MusicStudio.autoFinish.start(event,'p');assert.equal(result.ok,true);assert.equal(f.calls.filter(x=>x.options.method==='PUT').length,2);const create=JSON.parse(f.calls.find(x=>x.url.endsWith('/sessions')).options.body);assert.equal(create.audioVersion,'project-revision-3');assert.deepEqual(create.stems.map(x=>x.role),['vocal','piano']);assert.equal(create.alignmentConfirmed,true);assert.ok(f.calls.some(x=>x.url.endsWith('/start')))});
test('GUI refuses unconfirmed alignment before network or processing',async()=>{const f=fixture();f.form.elements.aligned.checked=false;const result=await f.w.MusicStudio.autoFinish.start({preventDefault(){},target:f.form},'p');assert.equal(result.ok,false);assert.equal(f.calls.length,0)});
test('completion exposes candidates but download remains approval-gated',async()=>{const f=fixture();f.w.MusicStudio.autoFinish.state.session='a'.repeat(32);f.w.MusicStudio.autoFinish.state.token='token';f.setStatus({complete:true,progress:{stage:'complete',completed:1,total:1},adopted:null});await f.w.MusicStudio.autoFinish.poll();assert.equal(f.w.MusicStudio.autoFinish.state.manifest.complete,true);assert.equal(f.w.MusicStudio.autoFinish.download().ok,false);assert.match(f.w.MusicStudio.autoFinish.view({projectId:'p'}),/候補Aを承認/)});
