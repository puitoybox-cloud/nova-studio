'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), {compare}=require('../scripts/music-production-comparison');
function report(prefix) { return {completed:true,result:{assets:[0,1].map(i=>({id:prefix+i,bytes:100,frames:20,peak:.5,chunkSha256:'hash'+i})),masterHash:'master',mastering:{method:'new',truePeak:.6,truePeakDb:-4,clippingSamples:0,lufs:-18,peak:.5},masterPlan:{ceilingDb:-1,targetLufs:-18,routes:[0,1].map(i=>({key:'wav:'+prefix+i,gainDb:-3,muted:false}))}}}; }
test('independent UUIDs retain source-bound audio and plan equality',()=>assert.equal(compare(report('a'),report('b')).audioEqual,true));
test('comparison rejects changed audio, routes, settings and ceiling violations',()=>{
 for(const change of [r=>r.assets[0].chunkSha256='changed',r=>r.masterHash='changed',r=>r.masterPlan.routes.reverse(),r=>r.masterPlan.routes[0].key='wav:missing',r=>r.masterPlan.routes[0].gainDb=-2,r=>r.masterPlan.targetLufs=-16,r=>r.mastering.lufs=-17,r=>r.mastering.truePeakDb=0,r=>r.assets[1].id=r.assets[0].id]) {
   const after=report('b');change(after.result);assert.throws(()=>compare(report('a'),after));
 }
});
