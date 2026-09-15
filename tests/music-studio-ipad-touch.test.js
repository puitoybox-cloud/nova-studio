const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'music-studio.html'),'utf8');
const touch=fs.readFileSync(path.join(root,'music-studio-ipad-touch.js'),'utf8');

test('Music Studio loads the iPad Piano Roll touch bridge after the editor API',()=>{
  const core=html.indexOf('./music-studio.js?v=1.4.103');
  const bridge=html.indexOf('./music-studio-ipad-touch.js?v=1.0.1');
  assert.ok(core>=0);
  assert.ok(bridge>core);
});

test('iPad touch bridge is restricted to coarse-pointer landscape',()=>{
  assert.match(touch,/orientation: landscape/);
  assert.match(touch,/hover: none/);
  assert.match(touch,/pointer: coarse/);
});

test('one-finger Piano Roll gesture routes vertical motion to pitch scroll and horizontal motion to timeline scroll',()=>{
  assert.match(touch,/Math\.abs\(dy\)>=Math\.abs\(dx\)\?'vertical':'horizontal'/);
  assert.match(touch,/drag\.viewport\.scrollTop=Math\.max\(0,drag\.startTop-dy\)/);
  assert.match(touch,/drag\.scroll\.scrollLeft=Math\.max\(0,drag\.startLeft-dx\)/);
});

test('empty-roll touch scrolling suppresses the legacy coarse-pointer playhead path',()=>{
  assert.match(touch,/suppressPointerUntil/);
  assert.match(touch,/event\.pointerType!==['"]touch['"]/);
  assert.match(touch,/rollFor\(event\.target\).*music-midi-note,.music-note-resize/s);
  assert.match(touch,/stopImmediatePropagation/);
  assert.match(touch,/markTouchGesture\(\)/);
});

test('two-finger Piano Roll gesture converts pinch distance to existing editor zoom',()=>{
  assert.match(touch,/event\.touches\?\.length>=2/);
  assert.match(touch,/ratio=current\/pinch\.startDistance/);
  assert.match(touch,/root\.MusicStudio\?\.editorZoom\?\.\(steps\)/);
});

test('touch bridge preserves note and control gestures during one-finger scrolling',()=>{
  assert.match(touch,/const EDIT_INTERACTIVE=.*\.music-midi-note.*\.music-note-resize.*\.music-pitch-hit/);
  assert.match(touch,/event\.target\?\.closest\?\.\(EDIT_INTERACTIVE\)/);
});
