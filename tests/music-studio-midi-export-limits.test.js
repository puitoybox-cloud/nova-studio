'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function writerWithArgumentLimit(maximum){
 const math=Object.create(Math);
 math.max=(...args)=>{if(args.length>maximum)throw RangeError('engine-argument-limit');return Math.max(...args)};
 const window={Math:math,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob};
 window.window=window;
 vm.runInNewContext(fs.readFileSync('music-studio-midi.js','utf8'),window);
 return window.MusicStudioMidi;
}
function largeSong(noteCount){return{ppq:480,tempo:120,timeSignature:{numerator:4,denominator:4},
 tracks:[{id:'large',name:'Large melody',channel:1,program:0,
  notes:Array.from({length:noteCount},(_,i)=>({id:`n${i}`,pitch:60,startTick:i*2,durationTicks:2,velocity:90}))}]}}

test('70,000-note MIDI export validates and round-trips without engine argument overflow',()=>{
 const writer=writerWithArgumentLimit(64000),data=largeSong(70000);
 const checked=writer.validateMidiProjectData(data);
 assert.equal(checked.ok,true,checked.errors.join('; '));
 assert.equal(checked.noteCount,70000);
 assert.equal(checked.data.totalTick,140000);
 const file=writer.createMidiFile(data);
 assert.equal(file.inspection.ok,true,file.inspection.errors.join('; '));
 assert.equal(file.inspection.noteOnCount,70000);
 assert.equal(file.inspection.noteOffCount,70000);
 assert.equal(file.inspection.totalTick,140000);
});

test('out-of-limit MIDI note count reports validation failure without an argument overflow',()=>{
 const writer=writerWithArgumentLimit(64000),checked=writer.validateMidiProjectData(largeSong(writer.MAX_NOTES+1));
 assert.equal(checked.ok,false);
 assert.ok(checked.errors.some(error=>error.includes('安全上限')));
});
