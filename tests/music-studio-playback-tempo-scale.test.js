'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

function playback(){
  const host={};host.window=host;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','music-studio-playback.js'),'utf8'),{window:host,globalThis:host});
  return host.MusicStudioPlayback;
}

const largeMap=()=>Array.from({length:1500},(_,index)=>({tick:(index+1)*480,bpm:index%2?90:140}));
const deadlineMs=1500;
function timed(fn){const before=process.hrtime.bigint(),value=fn();return{value,elapsedMs:Number(process.hrtime.bigint()-before)/1e6}}

test('long songs with 1,500 real tempo changes calculate audio duration without a multi-second stall',()=>{
  const api=playback(),map=largeMap(),endTick=(map.length+1)*480;
  const expected=60/120+map.reduce((sum,event)=>sum+60/event.bpm,0);
  const result=timed(()=>api.tickDurationSeconds(0,endTick,480,map,120));
  assert.ok(Math.abs(result.value-expected)<1e-7,`tempo integration drifted: ${result.value} vs ${expected}`);
  assert.ok(result.elapsedMs<deadlineMs,`music timeline froze for ${result.elapsedMs.toFixed(1)} ms`);
});

test('the same long song can seek by elapsed seconds without scanning the tempo map repeatedly',()=>{
  const api=playback(),map=largeMap(),endTick=(map.length+1)*480;
  const seconds=60/120+map.reduce((sum,event)=>sum+60/event.bpm,0);
  const result=timed(()=>api.tickAtSeconds(0,seconds,480,map,120));
  assert.ok(Math.abs(result.value-endTick)<1e-6,`seek position drifted: ${result.value} vs ${endTick}`);
  assert.ok(result.elapsedMs<deadlineMs,`music seek froze for ${result.elapsedMs.toFixed(1)} ms`);
});

test('tempo integration and seeking preserve a fractional position across several event boundaries',()=>{
  const api=playback(),map=[{tick:240,bpm:180},{tick:700,bpm:80},{tick:1400,bpm:110}];
  const expected=(240-100)*60/(120*480)+(700-240)*60/(180*480)+(1400-700)*60/(80*480)+(1500-1400)*60/(110*480);
  assert.ok(Math.abs(api.tickDurationSeconds(100,1500,480,map,120)-expected)<1e-10);
  assert.ok(Math.abs(api.tickAtSeconds(100,expected,480,map,120)-1500)<1e-7);
});
