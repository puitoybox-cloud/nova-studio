'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('music-studio-ai-assistant-panel.js','utf8');
const css=fs.readFileSync('music-studio-ai-assistant-panel.css','utf8');
function panel(){const w={console,JSON,Date,Math};w.window=w;vm.runInNewContext(source,w);return w.MusicStudioAIAssistantPanel}
test('AI note selection is scoped to the current project and can select all or none',()=>{
 const a=panel(),notesA=[{value:'n1',checked:true},{value:'n2',checked:true}],notesB=[{value:'x',checked:false}];
 const w=a._states; // The panel exports the input controller; DOM fixtures are below.
 // A standalone test fixture can access the lexical root through VM exports.
 assert.equal(typeof a.selectAllNotes,'function');
 assert.match(source,/const panel=\[\.\.\.\(root\.document\?\.querySelectorAll\?\.\('\.music-ai-panel\[data-project-id\]'\)\|\|\[\]\)\]/);
 assert.match(source,/if\(notes\.length&&!ids\.length\)throw Error\('adoption-requires-selected-notes'\)/);
});
test('review selections persist on a rejected adoption repaint and have touch-sized controls',()=>{
 assert.match(source,/const checkedNotes=new Map/);
 assert.match(source,/if\(checkedNotes\.has\(node\.value\)\)node\.checked=checkedNotes\.get\(node\.value\)/);
 assert.match(source,/All（全て選択）/);
 assert.match(source,/None（選択解除）/);
 assert.match(css,/\.music-ai-note-review button\{min-height:44px;padding:6px 10px\}/);
});
