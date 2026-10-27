const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../music-studio-logic-instruments.js');
const service=globalThis.NovaLogicInstruments;
test('AU shares the existing assistant module but routes audio proposals separately from instruments',()=>{
 for(const instruction of ['ピアノを柔らかくして','ボーカルをもう少し前に出して','高音を少し抑えて']){
  const r=service.parseAudioCommand(instruction);assert.equal(r.operation,'preview');assert.equal(r.instruction,instruction);assert.equal(r.target,'NOVA AU自身');assert.equal(r.approvalRequired,true);assert.equal(r.audioAnalyzed,false);
 }
 assert.equal(service.parseAudioCommand('前の設定に戻して').operation,'undo');
 assert.throws(()=>service.parseAudioCommand('市販AUを自由に変更して'));
 assert.equal(service.parse('ピアノを柔らかくして').operation,'recommend');
});
