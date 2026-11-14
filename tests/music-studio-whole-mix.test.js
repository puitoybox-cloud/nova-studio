const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){let i=0;const w={console,Date,Math,JSON,Intl,Blob,ArrayBuffer,DataView,Uint8Array,Float64Array,Float32Array,crypto:{randomUUID:()=>`new-${++i}`},location:{hash:'#music-studio'}};w.window=w;for(const file of ['music-studio-midi.js','music-studio.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),w);const a=w.MusicStudio;let p=a.makeProject({projectId:'p',projectName:'Export',bpm:120});const tone=amp=>({sampleRate:48000,channels:[Array.from({length:24000},(_,i)=>amp*Math.sin(2*Math.PI*997*i/48000))]});p=a.pcmImport(p,tone(.02),'Piano.wav');p=a.pcmImport(p,tone(.01),'Voice.wav');const repo=a.memoryRepository([p]);a.setRepository(repo);a.state.projects=[p];const plan={format:'nova-final-export-plan-v1',targetLufs:-18,ceilingDb:-1,includeMidi:false,routes:p.pcmMix.assets.map((s,i)=>({key:'pcm:'+s.id,role:i?'vocal':'instrument',startSeconds:i?.125:0,gainDb:0,muted:false}))};return{w,a,p,repo,plan}}
test('edited vocal placement is checked before reading WAV and ignores discarded source frames',async()=>{
  const {a,p,repo,plan}=fixture();
  const asset={id:'take',name:'Take.wav',sampleRate:48000,channels:1,frames:48000*3600,
    vocalTake:{format:'nova-vocal-take-v1',cursor:0,waveform:[],
      edits:[{first:12000,end:36000,gainDb:0,startTick:480,latencyMs:125}]}};
  p.longWavAssets=[asset];
  plan.routes.push({key:'wav:take',role:'vocal',startSeconds:.125,gainDb:0,muted:false});
  await repo.put(p);
  let reads=0;
  repo.getLongWav=async()=>{reads++;return null};
  const nearStart=await a.finalPreview(p.projectId,plan);
  assert.match(nearStart.error,/corrupt-or-missing/);
  assert.equal(reads,1,'a short edit of a large source fits the output budget');

  asset.vocalTake.edits[0].startTick=480*60*120;
  await repo.put(p);
  const beyondEnd=await a.finalPreview(p.projectId,plan);
  assert.equal(beyondEnd.error,'final-one-hour-limit');
  assert.equal(reads,1,'placement beyond the timeline is rejected before binary access');
  assert.equal(a.finalExport.candidate,null);
  assert.deepEqual(plain(await repo.get(p.projectId)),plain(p));
});

test('mixed stereo PCM, WAV and edited take match a sample-by-sample reference across chunk boundaries',async()=>{
  const {a,w,p,repo,plan}=fixture();
  const {webcrypto,createHash}=require('node:crypto');
  w.crypto.subtle=webcrypto.subtle;
  const length=24000;
  const signal=(amplitude,index)=>index%40<20?amplitude:-amplitude;
  const wave=(amplitudes)=>amplitudes.map(amplitude=>Array.from({length},(_,i)=>signal(amplitude,i)/32768));
  p.pcmMix.assets[0].original.channels=wave([800,400]);
  const binaries=new Map();
  function binary(id,amplitudes,take){
    const bytes=Buffer.from(a.pcmEncodeWav({sampleRate:48000,channels:wave(amplitudes)}));
    const hashes=[createHash('sha256').update(bytes).digest('hex')];
    binaries.set(id,{blob:new Blob([bytes]),hashes});
    return{id,name:id+'.wav',sampleRate:48000,channels:amplitudes.length,frames:length,size:bytes.length,hashes,...take};
  }
  const wav=binary('import',[120,240]);
  const take=binary('take',[320],{vocalTake:{format:'nova-vocal-take-v1',cursor:0,waveform:[],
    edits:[{first:1000,end:21000,gainDb:0,startTick:480,latencyMs:125,regions:[{first:1000,end:21000,semitones:0,ratio:.5}]}]}});
  p.longWavAssets=[wav,take];
  plan.routes[1].muted=true;
  plan.routes.push(
    {key:'wav:import',role:'instrument',startSeconds:.25,gainDb:0,muted:false},
    {key:'wav:take',role:'vocal',startSeconds:.125,gainDb:0,muted:false});
  await repo.put(p);
  repo.getLongWav=async id=>binaries.get(id);
  // Measure placement and duration independently. For pitch-preserving region
  // processing, use the audible edited take itself as the mixer input reference.
  const rendered=await a.vocalRender(p.projectId,take.id);
  const vocal=a.pcmDecodeWav(await rendered.blob.arrayBuffer()).channels[0];
  const result=await a.finalPreview(p.projectId,plan);
  assert.equal(result.ok,true,result.error);
  const start=25000;
  assert.equal(vocal.length,10000);
  assert.equal(result.candidate.manifest.handoff.stems[2].sourceStartFrame,start);
  assert.equal(result.candidate.manifest.frames,36000);
  const mix=result.candidate.files.find(file=>file.name==='Mix.wav');
  const bytes=new DataView(await mix.blob.arrayBuffer());
  for(let frame=0;frame<36000;frame++){
    for(let c=0;c<2;c++){
      const pcm=frame<length?signal([800,400][c],frame):0;
      const imported=frame>=12000&&frame<36000?signal([120,240][c],frame-12000):0;
      const voice=frame>=start&&frame<start+vocal.length?vocal[frame-start]*32768:0;
      assert.equal(bytes.getInt16(44+frame*4+c*2,true),pcm+imported+voice);
    }
  }
  const before=JSON.stringify(await repo.get(p.projectId));
  const original=binaries.get(take.id);
  binaries.set(take.id,{...original,blob:new Blob([new Uint8Array(original.blob.size)])});
  const corrupt=await a.finalPreview(p.projectId,plan);
  assert.match(corrupt.error,/corrupt-or-missing: bytes/);
  assert.equal(a.finalExport.candidate,null);
  assert.equal(JSON.stringify(await repo.get(p.projectId)),before);
});
