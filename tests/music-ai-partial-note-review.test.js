'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('music-studio-ai-assistant-panel.js','utf8');
const css=fs.readFileSync('music-studio-ai-assistant-panel.css','utf8');
function fixture(){
 const w={console,JSON,Date,Math};w.window=w;vm.runInNewContext(source,w);
 const noteA=[{value:'n1',checked:true},{value:'n2',checked:true}],noteB=[{value:'other',checked:false}];
 const nodes=[{dataset:{projectId:'song-a'},querySelectorAll:()=>noteA},{dataset:{projectId:'song-b'},querySelectorAll:()=>noteB}];
 w.document={querySelectorAll:()=>nodes};
 return{api:w.MusicStudioAIAssistantPanel,noteA,noteB};
}
test('AI note review All/None changes only the current project choices without MIDI writes',()=>{
 const {api,noteA,noteB}=fixture();
 assert.equal(api.selectAllNotes('song-a',false),2);
 assert.deepEqual(noteA.map(n=>n.checked),[false,false]);
 assert.equal(noteB[0].checked,false);
 assert.equal(api.selectAllNotes('song-a',true),2);
 assert.deepEqual(noteA.map(n=>n.checked),[true,true]);
 assert.equal(api.selectAllNotes('missing',false),0);
});
test('empty AI note selection prevents unintended adopt and rejected review remains unchecked',()=>{
 assert.match(source,/adoption-requires-selected-notes/);
 assert.match(source,/const checkedNotes=new Map/);
 assert.match(source,/if\(checkedNotes\.has\(node\.value\)\)node\.checked=checkedNotes\.get\(node\.value\)/);
 assert.match(source,/All（全て選択）/);
 assert.match(source,/None（選択解除）/);
 assert.match(css,/\.music-ai-note-review button\{min-height:44px;padding:6px 10px\}/);
});
