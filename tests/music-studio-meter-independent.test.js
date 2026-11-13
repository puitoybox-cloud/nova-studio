'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createHash}=require('node:crypto');
const {cases,signal}=require('./fixtures/music-meter-signals'),ref=require('./fixtures/music-meter-ffmpeg-reference.json');
function app(){const w={console,Date,Math,JSON,Intl,Blob,location:{hash:'#music-studio'}};w.window=w;vm.runInNewContext(fs.readFileSync('music-studio.js','utf8'),w);return w.MusicStudio}
const plain=x=>JSON.parse(JSON.stringify(x));
test('independent loudness references bind exact generated PCM and source provenance',()=>{assert.equal(createHash('sha256').update(fs.readFileSync('tests/fixtures/music-meter-signals.js')).digest('hex'),ref.signalSourceSha256);assert.equal(ref.rows.length,cases.length);for(const c of cases){const pcm=signal(c),bytes=Buffer.alloc(pcm.channels[0].length*pcm.channels.length*4);for(let i=0;i<pcm.channels[0].length;i++)for(let k=0;k<pcm.channels.length;k++)bytes.writeFloatLE(pcm.channels[k][i],4*(i*pcm.channels.length+k));assert.equal(createHash('sha256').update(bytes).digest('hex'),ref.rows.find(r=>r.id===c.id).pcmSha256)}});
for(const c of cases)test('independent FFmpeg loudness and clipping reference: '+c.id,async()=>{const a=app(),pcm=signal(c),before=JSON.stringify(pcm),expected=ref.rows.find(r=>r.id===c.id),whole=await a.masterMeasure([pcm]);if(c.amp===0)assert.equal(whole.lufs,null);else assert.ok(Math.abs(whole.lufs-expected.lufs)<=ref.lufsTolerance,`${c.id} ${whole.lufs} vs ${expected.lufs}`);
 assert.equal(whole.clippingSamples,pcm.channels.reduce((sum,channel)=>sum+channel.filter(v=>Math.abs(v)>=1).length,0));assert.equal(JSON.stringify(pcm),before);
 if(c.amp)assert.ok(Math.abs(whole.truePeakDb-expected.truePeakDb)<=ref.steadyTruePeakToleranceDb,`${c.id} TP ${whole.truePeakDb} vs ${expected.truePeakDb}`);
 const chunks=[];for(let at=0;at<pcm.channels[0].length;at+=7919)chunks.push({sampleRate:48000,channels:pcm.channels.map(c=>c.slice(at,at+7919))});assert.deepEqual(plain(await a.masterMeasure(chunks)),plain(whole));
});
test('hard onset true peak agrees with the unchanged independent reference tolerance',async()=>{const c=cases.find(c=>c.id==='hard-onset-12000'),m=await app().masterMeasure([signal(c)]),r=ref.rows.find(r=>r.id===c.id);assert.ok(Math.abs(m.truePeakDb-r.truePeakDb)<=ref.steadyTruePeakToleranceDb);assert.ok(m.truePeak>m.peak)});
const edge=require('./fixtures/music-meter-edge-signals'),edgeRef=require('./fixtures/music-meter-edge-reference.json');
test('independent abrupt-edge references bind exact PCM and retain the existing 0.2 dB tolerance',()=>{
 assert.equal(edgeRef.truePeakToleranceDb,ref.steadyTruePeakToleranceDb);assert.equal(createHash('sha256').update(fs.readFileSync('tests/fixtures/music-meter-edge-signals.js')).digest('hex'),edgeRef.signalSourceSha256);
 for(const c of edge.cases){const p=edge.signal(c),ch=p.channels.length,b=Buffer.alloc(p.channels[0].length*ch*4);for(let i=0;i<p.channels[0].length;i++)for(let k=0;k<ch;k++)b.writeFloatLE(p.channels[k][i],4*(i*ch+k));assert.equal(createHash('sha256').update(b).digest('hex'),edgeRef.rows.find(r=>r.id===c.id).pcmSha256)}
});
for(const c of edge.cases)test('independent abrupt-edge true peak and clipping: '+c.id,async()=>{
 const a=app(),pcm=edge.signal(c),before=JSON.stringify(pcm),r=edgeRef.rows.find(r=>r.id===c.id),m=await a.masterMeasure([pcm]);assert.ok(Math.abs(m.truePeakDb-r.truePeakDb)<=edgeRef.truePeakToleranceDb,`${c.id}: ${m.truePeakDb} vs ${r.truePeakDb}`);assert.equal(m.clippingSamples,r.clippingSamples);assert.equal(JSON.stringify(pcm),before);
 const chunks=[];for(let at=0;at<pcm.channels[0].length;){const size=at<35?1:7919,end=Math.min(at+size,pcm.channels[0].length);chunks.push({sampleRate:48000,channels:pcm.channels.map(ch=>ch.slice(at,end))});at=end}assert.deepEqual(plain(await a.masterMeasure(chunks)),plain(m));
});

test('terminal impulse is never lost when the independent resampler would omit its buffered tail',async()=>{const a=app(),samples=Array(48000).fill(0);samples[47999]=.9;const m=await a.masterMeasure([{sampleRate:48000,channels:[samples]}]);assert.equal(m.peak,.9);assert.ok(m.truePeak>=m.peak);assert.equal(m.clippingSamples,0)});
