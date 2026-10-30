const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function load(){const w={TextEncoder,TextDecoder,Uint8Array,ArrayBuffer};w.window=w;w.globalThis=w;for(const file of ['music-studio-midi.js','music-studio-midi-parser.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),w);return{writer:w.MusicStudioMidi,parser:w.MusicStudioMidiParser}}
const plain=v=>JSON.parse(JSON.stringify(v));
function source(writer){return{...plain(writer.createTestMidiData()),totalTick:3840,timeSignatureMap:[{tick:0,numerator:4,denominator:4,clocksPerClick:24,thirtySecondsPerQuarter:8},{tick:1920,numerator:3,denominator:4,clocksPerClick:36,thirtySecondsPerQuarter:8}],keySignature:{tick:0,sharps:0,minor:false},keySignatureMap:[{tick:1920,sharps:-3,minor:true},{tick:0,sharps:0,minor:false}]}}
test('writer retains changing meter and major/minor key through parser and does not mutate source',()=>{
 const{writer,parser}=load(),data=source(writer),before=plain(data),n=parser.parseMidiFile(writer.createMidiFile(data).bytes).normalized;
 assert.deepEqual(plain(n.timeSignatureMap.map(e=>[e.tick,e.numerator,e.denominator,e.clocksPerClick,e.thirtySecondsPerQuarter])),[[0,4,4,24,8],[1920,3,4,36,8]]);
 assert.deepEqual(plain(n.keySignatureMap.map(e=>[e.tick,e.sharps,e.minor])),[[0,0,false],[1920,-3,true]]);
 assert.equal(n.totalNotes,10);assert.deepEqual(plain(data),before);
});
test('legacy files keep the initial meter and do not invent a key',()=>{const{writer,parser}=load(),data=plain(writer.createTestMidiData()),n=parser.parseMidiFile(writer.createMidiFile(data).bytes).normalized;assert.equal(n.timeSignatureMap.length,1);assert.equal(n.keySignatureMap.length,0);assert.equal(n.totalNotes,10)});
for(const [field,value] of [['timeSignatureMap',[{tick:-1,numerator:3,denominator:4}]],['timeSignatureMap',[{tick:1.5,numerator:3,denominator:4}]],['timeSignatureMap',[{tick:1920,numerator:0,denominator:4}]],['timeSignatureMap',[{tick:1920,numerator:3,denominator:3}]],['timeSignatureMap',[{tick:4000,numerator:3,denominator:4}]],['keySignatureMap',[{tick:1920,sharps:8,minor:false}]],['keySignatureMap',[{tick:1920,sharps:0,minor:'false'}]],['keySignatureMap',[{tick:4000,sharps:0,minor:false}]],['keySignatureMap',{}]])test(`invalid ${field} ${JSON.stringify(value)} rejects atomically`,()=>{const{writer}=load(),data=source(writer);data[field]=value;const before=plain(data);assert.throws(()=>writer.createMidiFile(data));assert.deepEqual(plain(data),before)});
test('conflicting tick-zero meter is rejected rather than silently discarded',()=>{const{writer}=load(),data=source(writer);data.timeSignatureMap[0].numerator=3;assert.throws(()=>writer.createMidiFile(data),/timeSignatureMap/)});
test('later metadata keeps initial meter but does not invent an initial key',()=>{const{writer,parser}=load(),data=source(writer);data.timeSignatureMap=data.timeSignatureMap.slice(1);data.keySignature=null;data.keySignatureMap=[{tick:1920,sharps:2,minor:false}];const n=parser.parseMidiFile(writer.createMidiFile(data).bytes).normalized;assert.deepEqual(plain(n.timeSignatureMap.map(e=>e.tick)),[0,1920]);assert.deepEqual(plain(n.keySignatureMap.map(e=>e.tick)),[1920])});
test('single key signature and signed extremes are encoded correctly',()=>{const{writer,parser}=load(),data=source(writer);delete data.keySignatureMap;data.keySignature={tick:0,sharps:-7,minor:true};assert.equal(parser.parseMidiFile(writer.createMidiFile(data).bytes).normalized.keySignature.sharps,-7);data.keySignature.sharps=7;assert.equal(parser.parseMidiFile(writer.createMidiFile(data).bytes).normalized.keySignature.sharps,7)});
