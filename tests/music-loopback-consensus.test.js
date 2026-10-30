'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const loopback=require('../music-studio-loopback.js');
const studio=fs.readFileSync('music-studio.js','utf8');
const page=fs.readFileSync('music-studio.html','utf8');
const host=fs.readFileSync('app.js','utf8');
function signal(delay){
 const sampleRate=8000,n=sampleRate;
 const left=new Float32Array(n),right=new Float32Array(n);
 // One nonperiodic, phase-stable transient window, with no clipping.
 let z=17;for(let j=0;j<384;j++){z=(Math.imul(z,1664525)+1013904223)|0;
   const val=(((z>>>8)&65535)/65535-.5)*.7;
   left[900+j]=val;right[900+j+delay]=val;
 }
 return{sampleRate,channels:[left,right]};
}
test('multi-file loopback requires independent measurements to agree',async()=>{
 const result=await loopback.analyzeBatch([signal(80),signal(81)]);
 assert.equal(result.measurementCount,2);
 assert.ok(result.spreadMs<=5);
 assert.ok(Math.abs(result.latencyMs-10.0625)<.5);
 assert.equal(result.format,'nova-stereo-loopback-consensus-v1');
});
test('large repeatability gap rejects compensation before adoption',async()=>{
 await assert.rejects(()=>loopback.analyzeBatch([signal(80),signal(160)]),/loopback-batch-disagreement/);
 await assert.rejects(()=>loopback.analyzeBatch([]),/loopback-batch-count-invalid/);
 await assert.rejects(()=>loopback.analyzeBatch([signal(80),signal(80),signal(80),signal(80)]),/loopback-batch-count-invalid/);
});
test('recording UI connects selected WAV batch to guarded explicit application',()=>{
 assert.match(studio,/root\.MusicStudioLoopback\.analyzeBatch\(recordings,\{guard\}\)/);
 assert.match(studio,/accept="\.wav,audio\/wav" multiple/);
 assert.match(studio,/files\.length>3/);
 assert.match(studio,/vocalLoopbackForms\.set\(form,\{token,result,device\}\)/);
 assert.match(page,/music-studio-loopback\.js\?v=1\.0\.1/);
 assert.match(host,/music-studio-loopback\.js\?v=1\.0\.1/);
 assert.match(host,/MusicStudioLoopback\?\.analyzeBatch/);
});

test('median record preserves consistent measured lag frames',async()=>{
 const result=await loopback.analyzeBatch([signal(80),signal(82),signal(81)]);
 assert.equal(result.measurementCount,3);
 assert.equal(result.sampleRate,8000);
 assert.equal(result.lagFrames,81);
 assert.ok(Math.abs(result.latencyMs-result.lagFrames*1000/result.sampleRate)<.001);
});
test('mixed channel polarity rejects a shared recording compensation',async()=>{
 const negative=signal(81);for(let i=0;i<negative.channels[1].length;i++)negative.channels[1][i]*=-1;
 await assert.rejects(()=>loopback.analyzeBatch([signal(80),negative]),/loopback-batch-polarity-mismatch/);
});
test('mixed capture sample rates are not combined as one calibration path',async()=>{
 const higher=signal(80);higher.sampleRate=16000;
 // Both records are still each within their own supported capture window.
 await assert.rejects(()=>loopback.analyzeBatch([signal(80),higher]),/loopback-batch-sample-rate-mismatch/);
});
