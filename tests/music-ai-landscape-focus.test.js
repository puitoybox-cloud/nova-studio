'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('music-studio-ai-assistant-panel.js','utf8');
const css=fs.readFileSync('music-studio-ai-assistant-panel.css','utf8');
const html=fs.readFileSync('music-studio.html','utf8');
test('landscape AI panel keeps existing preview/action family inside preserved detail',()=>{
 assert.match(source,/class="music-ai-focus"/);
 assert.match(source,/const prior=previous\?\.querySelector\?\.\('\.music-ai-focus'\)/);
 assert.match(source,/const expanded=prior\?prior\.open:!landscape/);
 assert.match(source,/music-ai-body.*projectSectionsHtml\(project,session\).*\$\{body\}<\/div><\/details><\/section>/);
 assert.match(source,/function previewEdit\(id\)/);
 assert.match(source,/function confirmSong\(id\)/);
});
test('landscape AI editor is bounded and touch-sized without hiding advanced candidate controls',()=>{
 assert.match(css,/@media \(min-width:601px\) and \(orientation:landscape\) and \(hover:none\) and \(pointer:coarse\)/);
 assert.match(css,/\.music-midi-editor-page \.music-ai-focus\[open\]\{/);
 assert.match(css,/max-height:calc\(100dvh - 24px\)/);
 assert.match(css,/\.music-ai-panel :is\(button,select,input:not\(\[type=checkbox\]\):not\(\[type=radio\]\),textarea\)/);
 assert.match(css,/min-height:44px;padding:6px 10px/);
 assert.match(html,/music-studio-ai-assistant-panel\.css\?v=1\.0\.5/);
 assert.match(html,/music-studio-ai-assistant-panel\.js\?v=1\.0\.37/);
});
