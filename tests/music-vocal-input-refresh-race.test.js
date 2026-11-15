const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
  const w={console,Date,Math,JSON,Intl,Blob,ArrayBuffer,DataView,Float32Array,Uint8Array,location:{hash:'#music-studio'}};
  w.window=w;vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),w);
  const select={value:'mic-a',options:[{value:'mic-a',textContent:'A'}],add(option){this.options.push(option)}};
  const status={textContent:'unchanged'};
  let mounted=true;
  w.document={querySelectorAll(s){
    if(s.includes('select[name="device"]'))return mounted?[select]:[];
    if(s==='[data-vocal-status]')return mounted?[status]:[];
    return[];
  },createElement(){return{value:'',textContent:''}}};
  return{w,select,status,unmount(){mounted=false}};
}
function deferred(){
  let resolve,reject;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail});
  return{promise,resolve,reject};
}
test('out-of-order microphone enumeration cannot replace newer input choices or unsaved form selection',async()=>{
  const f=fixture(),old=deferred(),newer=deferred();let index=0;
  f.w.navigator={mediaDevices:{enumerateDevices:()=>++index===1?old.promise:newer.promise}};
  const a=f.w.MusicStudio,first=a.vocalRefreshInputs(),second=a.vocalRefreshInputs();
  newer.resolve([{kind:'audioinput',deviceId:'mic-b',label:'New mic'}, {kind:'audioinput',deviceId:'mic-b',label:'Duplicate'}]);
  const latest=await second;assert.equal(latest.ok,true);
  assert.deepEqual(Array.from(latest.devices,x=>x.id),['mic-b']);
  old.resolve([{kind:'audioinput',deviceId:'mic-stale',label:'Stale mic'}]);
  assert.equal((await first).error,'vocal-input-refresh-stale');
  assert.equal(f.select.value,'mic-a');assert.equal(f.select.options.some(x=>x.value==='mic-b'),true);
  assert.equal(f.select.options.some(x=>x.value==='mic-stale'),false);
  assert.match(f.status.textContent,/Inputs/);
});
test('stale permission failure cannot erase a more recent successful refresh',async()=>{
  const f=fixture(),old=deferred();let i=0;
  f.w.navigator={mediaDevices:{enumerateDevices:()=>++i===1?old.promise:Promise.resolve([{kind:'audioinput',deviceId:'mic-c',label:'C'}])}};
  const a=f.w.MusicStudio,pending=a.vocalRefreshInputs();
  assert.equal((await a.vocalRefreshInputs()).ok,true);
  const prior=f.status.textContent;
  old.reject(Error('NotAllowedError'));
  assert.equal((await pending).error,'vocal-input-refresh-stale');
  assert.equal(f.status.textContent,prior);
  assert.equal(f.select.options.some(x=>x.value==='mic-c'),true);
});
test('microphone refresh does not write old results into a different mounted editor',async()=>{
  const f=fixture(),request=deferred();
  f.w.navigator={mediaDevices:{enumerateDevices:()=>request.promise}};
  const pending=f.w.MusicStudio.vocalRefreshInputs();f.unmount();
  request.resolve([{kind:'audioinput',deviceId:'mic-other',label:'Other'}]);
  assert.equal((await pending).error,'vocal-input-refresh-stale');
  assert.equal(f.select.options.length,1);
  assert.equal(f.status.textContent,'unchanged');
});
