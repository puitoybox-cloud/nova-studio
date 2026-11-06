'use strict';
const cases=[
 {id:'abrupt-50',hz:50,phase:Math.PI/4},
 {id:'abrupt-997',hz:997,phase:Math.PI/4},
 {id:'abrupt-10000',hz:10000,phase:Math.PI/4},
 {id:'abrupt-12000-zero',hz:12000,phase:0},
 {id:'abrupt-12000-quarter',hz:12000,phase:Math.PI/2},
 {id:'abrupt-19000',hz:19000,phase:Math.PI/4},
 {id:'first-impulse',impulse:0},
 {id:'last-impulse',impulse:47999},
 {id:'clipped-12000',hz:12000,phase:Math.PI/4,amp:1.5},
 {id:'asymmetric-19000',hz:19000,phase:Math.PI/4,channels:2}
];
function signal(c){return{sampleRate:48000,channels:Array.from({length:c.channels||1},(_,channel)=>Array.from({length:48064},(_,i)=>Math.fround(i>=48000?0:(channel?.3:1)*(c.impulse===undefined?(c.amp||.9)*Math.sin(2*Math.PI*c.hz*i/48000+c.phase):i===c.impulse?.9:0))))}}
module.exports={cases,signal};
