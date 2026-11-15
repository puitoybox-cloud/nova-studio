'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('music-studio-ai-assistant-panel.js','utf8');
function panel(){const w={console,JSON,Date,Math};w.window=w;vm.runInNewContext(source,w);return w.MusicStudioAIAssistantPanel}
test('AI drawer Escape closes and returns focus to its summary, other keys stay inert',()=>{
 const a=panel();let focused=0,prevented=0,stopped=0;
 const detail={open:true,querySelector(q){assert.equal(q,'summary');return{focus(){focused++}}}};
 const event={key:'Enter',preventDefault(){prevented++},stopPropagation(){stopped++}};
 assert.equal(a.closeOnEscape(event,detail),false);assert.equal(detail.open,true);
 event.key='Escape';assert.equal(a.closeOnEscape(event,detail),true);
 assert.equal(detail.open,false);assert.equal(focused,1);
 assert.equal(prevented,1);assert.equal(stopped,1);
 assert.equal(a.closeOnEscape(event,detail),false);
});
test('AI refresh preserves only unsubmitted instruction and new-song fields, not adoption state',()=>{
 assert.match(source,/target\.querySelectorAll\?\.\('textarea\[id\],input\[id\],select\[id\]'\)/);
 assert.match(source,/node\.id==='musicAIInstruction'\|\|node\.id\.startsWith\('aiSong'\)/);
 assert.match(source,/target\.outerHTML=render\(p,s\)/);
 assert.match(source,/if\(node&&typeof draft\.value==='string'\)node\.value=draft\.value/);
 assert.match(source,/onkeydown="MusicStudioAIAssistantPanel\.closeOnEscape\(event,this\)"/);
 assert.doesNotMatch(source,/localStorage\.setItem|fetch\(/);
});
