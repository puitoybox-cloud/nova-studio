const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
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
test('native whole-song controller verifies every runtime file packaged by the AU build',()=>{
 const root=path.join(__dirname,'..','tools','nova-au');
 const build=fs.readFileSync(path.join(root,'build.sh'),'utf8');
 const controller=fs.readFileSync(path.join(root,'WholeSongController.mm'),'utf8');
 const packaged=build.match(/^cp (.+) "\$BUNDLE\/Contents\/Resources\/"$/m)[1].split(/\s+/);
 const required=[...controller.match(/requiredScripts=@\[(.*?)\];/s)[1].matchAll(/@"([^"]+)"/g)].map(row=>row[1]).filter(name=>!name.startsWith('../'));
 assert.deepEqual(required.sort(),packaged.sort());
});
