'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
function api(BlobType=Blob){const root={Blob:BlobType,crypto:crypto.webcrypto,TextEncoder,DataView,setTimeout(callback,delay){if(delay===0)setTimeout(callback,0)},console};vm.runInNewContext(fs.readFileSync('music-studio-audio-pipeline.js','utf8'),root);return root.MusicStudioAudioPipeline}
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const size of [0,1,55,56,63,64,65,65535,65536,65537,64*1024*1024-1,64*1024*1024,64*1024*1024+1,96*1024*1024+19])test('bounded SHA-256 matches independent Node: '+size,async()=>{
 const a=api(),unit=Buffer.alloc(65536);for(let i=0;i<unit.length;i++)unit[i]=i%251;
 const parts=[],expected=crypto.createHash('sha256');for(let i=0;i<size;i+=unit.length){const b=unit.subarray(0,Math.min(unit.length,size-i));parts.push(b);expected.update(b)}
 const blob=new Blob(parts);blob.arrayBuffer=()=>{throw Error('whole-file-read-forbidden')};blob.slice=()=>{throw Error('overridden-slice-forbidden')};let count=0,max=0;
 const r=await a.hashBrowserArtifact(blob,{onChunk:c=>{count++;max=Math.max(max,c.byteLength)}});
 assert.equal(r.digest,expected.digest('hex'));assert.equal(r.byteLength,size);assert.equal(count,Math.ceil(size/65536));assert.ok(max<=65536);
 const snapshot=a.consumeBrowserArtifact(blob,r);assert.equal(snapshot.size,size);assert.throws(()=>a.consumeBrowserArtifact(blob,r),/replayed/);
});
test('cache uses exact native Blob and exact invalidation, no filename identity',async()=>{
 const a=api(),b=new Blob(['abc']);b.name='same';const r=await a.hashBrowserArtifact(b);assert.equal(r.digest,digest('abc'));
 const c=await a.hashBrowserArtifact(b);assert.equal(c.chunks,0);a.invalidateArtifactHash();assert.throws(()=>a.consumeBrowserArtifact(b,r),/stale/);
 const d=await a.hashBrowserArtifact(new Blob(['xyz']));assert.equal(d.digest,digest('xyz'));assert.notEqual(d.digest,r.digest);
});
test('cancel and exception invalidate all outstanding receipts and cache',async()=>{
 for(const kind of ['cancel','failure']){const a=api(),b=new Blob([Buffer.alloc(131073)]),old=await a.hashBrowserArtifact(new Blob(['old'])),controller=new AbortController();
 await assert.rejects(a.hashBrowserArtifact(b,{signal:controller.signal,onChunk(){if(kind==='cancel')controller.abort();else throw Error('read-path-failure')}}),kind==='cancel'?/Abort/:/failure/);
 assert.throws(()=>a.consumeBrowserArtifact(b,old),/stale/);assert.equal((await a.hashBrowserArtifact(b)).chunks,3);
 }
});
test('digest, size, native brand and replaced artifact reject before admission',async()=>{
 const a=api(),b=new Blob(['abc']);for(const expectedIdentity of [{digest:'f'.repeat(64),byteLength:3},{digest:digest('abc'),byteLength:4}])await assert.rejects(a.hashBrowserArtifact(b,{expectedIdentity}),/mismatch/);
 await assert.rejects(a.hashBrowserArtifact({size:3,slice(){return b}}));
 Object.defineProperty(b,'size',{value:4});await assert.rejects(a.hashBrowserArtifact(b),/size-mismatch/);
 const real=new Blob([Buffer.alloc(131073)]);let current=real;
 await assert.rejects(a.hashBrowserArtifact(real,{currentArtifact:()=>current,onChunk(){current=new Blob(['replaced'])}}),/replaced/);
});
test('receipt binds session request contract, replacement and duplicate consumption',async()=>{
 const a=api(),b=new Blob(['abc']),context={session:'a'.repeat(64),request:'b'.repeat(64),processingContract:'c'.repeat(64)};
 const r=await a.hashBrowserArtifact(b,context);
 for(const field of ['session','request','processingContract'])assert.throws(()=>a.consumeBrowserArtifact(b,r,{...context,[field]:'f'.repeat(64)}),/stale/);
 assert.throws(()=>a.consumeBrowserArtifact(new Blob(['abc']),r,context),/replaced/);
 assert.throws(()=>a.consumeBrowserArtifact(b,{...r},context),/replayed/);
 assert.equal(a.consumeBrowserArtifact(b,r,context).size,3);assert.throws(()=>a.consumeBrowserArtifact(b,r,context),/replayed/);
});
test('single active hash admission bounds memory and rejects concurrent work',async()=>{
 const a=api(),b=new Blob([Buffer.alloc(65537)]);let other;
 await a.hashBrowserArtifact(b,{onChunk(){other??=a.hashBrowserArtifact(b);other.catch(()=>{})}});await assert.rejects(other,/occupied/);
});

for(const kind of ['read-failure','short-read'])test('actual bounded read boundary '+kind+' invalidates receipt/cache',async()=>{
 let reads=0;class Reader extends Blob {async arrayBuffer(){reads++;if(reads===2){if(kind==='read-failure')throw Error('disposable-read-failure');return new ArrayBuffer(1)}return Blob.prototype.arrayBuffer.call(this)}}
 Object.defineProperty(Reader.prototype,'size',Object.getOwnPropertyDescriptor(Blob.prototype,'size'));
 const a=api(Reader),b=new Blob([Buffer.alloc(131073)]);
 await assert.rejects(a.hashBrowserArtifact(b),kind==='read-failure'?/read-failure/:/size-mismatch/);assert.equal(reads,2);
 const r=await a.hashBrowserArtifact(b);assert.equal(r.chunks,3);assert.equal(r.digest,digest(Buffer.alloc(131073)));
});
