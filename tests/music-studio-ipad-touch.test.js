const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'music-studio.html'),'utf8');
const touch=fs.readFileSync(path.join(root,'music-studio-ipad-touch.js'),'utf8');
const ipadCss=fs.readFileSync(path.join(root,'music-studio-ipad.css'),'utf8');

require(path.join(root,'music-studio-ipad-touch.js'));

test('Music Studio loads current iPad Piano Roll gesture assets',()=>{
  assert.match(html,/music-studio-ipad\.css\?v=1\.0\.16/);
  const core=html.indexOf('./music-studio.js?v=1.4.111');
  const bridge=html.indexOf('./music-studio-ipad-touch.js?v=1.0.6');
  assert.ok(core>=0);assert.ok(bridge>core);
});

test('iPad gesture bridge is restricted to coarse-pointer landscape',()=>{
  assert.match(touch,/orientation: landscape/);assert.match(touch,/hover: none/);assert.match(touch,/pointer: coarse/);
});

test('Piano Roll keeps browser multi-touch available for the WKWebView fallback',()=>{
  assert.doesNotMatch(ipadCss,/touch-action\s*:\s*none/);
  assert.match(ipadCss,/\.music-piano-viewport\{[^}]*overscroll-behavior:contain/);
});

test('empty-roll pointerdown is intercepted before legacy playhead selection',()=>{
  assert.match(touch,/event\.pointerType==='touch'/);
  assert.match(touch,/emptyRollTouch\(event\)/);
  assert.match(touch,/addEventListener\?\.\('pointerdown',onPointerDown,\{capture:true,passive:false\}\)/);
  assert.match(touch,/stopImmediatePropagation/);
});

test('one-finger Piano Roll gesture routes vertical motion to pitch scroll and horizontal motion to timeline scroll',()=>{
  assert.match(touch,/Math\.abs\(dy\)>=Math\.abs\(dx\)\?'vertical':'horizontal'/);
  assert.match(touch,/drag\.viewport\.scrollTop=Math\.max\(0,drag\.startTop-dy\)/);
  assert.match(touch,/drag\.scroll\.scrollLeft=Math\.max\(0,drag\.startLeft-dx\)/);
});

test('two active touch pointers drive existing editor zoom while the pinch is moving',()=>{
  assert.match(touch,/points\.length>=2/);
  assert.match(touch,/applyLiveZoom\(pinch,current\)/);
  assert.match(touch,/root\.MusicStudio\?\.editorZoom\?\.\(steps\)/);
});

test('WKWebView multi-touch fallback drives live zoom without duplicating pointer zoom',()=>{
  assert.match(touch,/addEventListener\?\.\('touchstart',onTouchStart,\{capture:true,passive:false\}\)/);
  assert.match(touch,/addEventListener\?\.\('touchmove',onTouchMove,\{capture:true,passive:false\}\)/);
  assert.match(touch,/applyLiveZoom\(touchPinch,current\)/);
  assert.match(touch,/if\(!touchPinch&&pinch&&pointsFor\(viewport\)\.length<2\)finishPinch\(\)/);
});

test('pinch distance maps deterministically to bounded zoom steps',()=>{
  const {zoomSteps}=globalThis.MusicStudioIPadTouch;
  assert.equal(zoomSteps(100,120),1);
  assert.equal(zoomSteps(100,80),-1);
  assert.equal(zoomSteps(100,105),0);
  assert.equal(zoomSteps(100,400),6);
});

test('note and control pointer gestures remain on the existing editor path',()=>{
  assert.match(touch,/const EDIT_INTERACTIVE=.*\.music-midi-note.*\.music-note-resize.*\.music-pitch-hit/);
  assert.match(touch,/!event\.target\?\.closest\?\.\(EDIT_INTERACTIVE\)/);
});
