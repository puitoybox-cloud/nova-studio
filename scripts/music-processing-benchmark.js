// Controlled CPU/Blob regression benchmark, not a listening song or device acceptance.
// Run each source in a fresh process on the same host, with the same seconds value.
const fs=require('node:fs'),{webcrypto,createHash}=require('node:crypto'),assert=require('node:assert/strict');
const source=process.argv[2]||'music-studio.js',output=process.argv[3],seconds=Number(process.env.NOVA_BENCH_SECONDS||480.8);
if(!Number.isFinite(seconds)||seconds<.5||seconds>480.8)throw Error('invalid benchmark duration');
const w={console,Date,Math,JSON,Intl,Blob,ArrayBuffer,DataView,Uint8Array,Float32Array,Float64Array,crypto:webcrypto,performance,location:{hash:'#music-studio'}};w.window=w;
new Function('window',fs.readFileSync(source,'utf8'))(w);
(async()=>{const a=w.MusicStudio,frames=Math.round(seconds*48000),header=Buffer.from(a.pcmEncodeWav({sampleRate:48000,channels:[[0],[0]]})).subarray(0,44),raw=Buffer.alloc(44+frames*4);header.copy(raw);raw.writeUInt32LE(raw.length-8,4);raw.writeUInt32LE(frames*4,40);
for(let i=0;i<frames;i++){const n=Math.round(.02*32768*Math.sin(2*Math.PI*997*i/48000));raw.writeInt16LE(n,44+i*4);raw.writeInt16LE(n,46+i*4)}
const blob=new Blob([raw]),hashes=[],p=a.makeProject({projectId:'benchmark',projectName:'CPU and Blob regression'});
for(let at=0;at<blob.size;at+=1048576)hashes.push(createHash('sha256').update(Buffer.from(await blob.slice(at,at+1048576).arrayBuffer())).digest('hex'));
p.longWavAssets=Array.from({length:4},(_,i)=>({id:'stem-'+i,name:'Stem '+i,size:blob.size,frames,sampleRate:48000,channels:2,hashes}));
const repo=a.memoryRepository([p]);repo.getLongWav=async id=>({id,blob,hashes});a.setRepository(repo);a.state.projects=[p];
const plan={format:'nova-final-export-plan-v1',routes:p.longWavAssets.map(x=>({key:'wav:'+x.id,role:'instrument',startSeconds:0,gainDb:-3,muted:false})),targetLufs:-18,ceilingDb:-1,includeMidi:false,mixMasterOnly:true,masterCompressor:{thresholdDb:-48,ratio:6,attackMs:.1,releaseMs:100}};
let t=performance.now(),reads=0;const wrapped={size:blob.size,slice(s,e){reads++;return blob.slice(s,e)}};let decoded=0;for await(const c of a.pcmDecodeWavStream(wrapped))decoded+=c.channels[0].length;assert.equal(decoded,frames);const decodeMs=performance.now()-t;
t=performance.now();const result=await a.finalPreview(p.projectId,plan),totalMs=performance.now()-t;assert.equal(result.ok,true,result.error);const c=result.candidate;assert.equal(c.manifest.after.clippingSamples,0);assert.ok(c.manifest.after.truePeakDb<=-.998);
const sha=async b=>{const h=createHash('sha256');for(let at=0;at<b.size;at+=1048576)h.update(Buffer.from(await b.slice(at,at+1048576).arrayBuffer()));return h.digest('hex')};
const report={date:new Date().toISOString(),source,seconds,frames,stemBytes:blob.size,decodeMs,decodeReads:reads,totalMs,performance:c.performance||null,before:c.manifest.before,after:c.manifest.after,gainDb:c.manifest.gainDb,passes:c.manifest.passes,hashes:await Promise.all(c.files.filter(f=>f.name.endsWith('.wav')).map(async f=>({name:f.name,size:f.blob.size,sha256:await sha(f.blob)}))),maxRssKiB:process.resourceUsage().maxRSS,scope:'Node CPU/Blob in-memory repository, no browser/IndexedDB/native or acoustic samples; not comparable to 478.15-second CI acceptance'};
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
