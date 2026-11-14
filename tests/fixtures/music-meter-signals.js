'use strict';
// Generated, redistributable synthetic PCM. No reference values use the app meter.
const cases=[
 {id:'mono-997',hz:997,amp:.1,seconds:3},
 {id:'stereo-997',hz:997,amp:.1,seconds:3,channels:2},
 {id:'low-50',hz:50,amp:.1,seconds:3},
 {id:'high-10000',hz:10000,amp:.1,seconds:3},
 {id:'intersample-12000',hz:12000,amp:.9,seconds:3},
 {id:'high-19000',hz:19000,amp:.9,seconds:3},
 {id:'absolute-gate',hz:997,amp:.0005,seconds:4,gate:'absolute'},
 {id:'relative-gate',hz:997,amp:.1,seconds:6,gate:'relative'},
 {id:'silence-tail',hz:997,amp:.1,seconds:6,gate:'silence'},
 {id:'asymmetric-stereo',hz:997,amp:.1,seconds:3,channels:2,asymmetric:true},
 {id:'hard-onset-12000',hz:12000,amp:.9,seconds:3,hard:true},
 {id:'clipped-997',hz:997,amp:1.2,seconds:3,hard:true},
 {id:'silence',hz:997,amp:0,seconds:3}
];
function signal(c){const n=48000*c.seconds;return{sampleRate:48000,channels:Array.from({length:c.channels||1},(_,channel)=>Array.from({length:n},(_,i)=>{
 let gain=c.amp;if(c.gate==='absolute'&&i>=96000)gain=1e-5;if(c.gate==='relative'&&i>=144000)gain=.001;if(c.gate==='silence'&&i>=144000)gain=0;
 const envelope=c.hard?1:Math.max(0,Math.min(1,i/4800,(n-1-i)/4800));
 return Math.fround(envelope*gain*(c.asymmetric&&channel?.3:1)*Math.sin(2*Math.PI*c.hz*i/48000+Math.PI/4));
 }))}}
module.exports={cases,signal};
