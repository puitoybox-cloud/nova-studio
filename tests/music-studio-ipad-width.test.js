'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'music-studio.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'music-studio-ipad.css'), 'utf8');

test('standalone Music Studio loads the iPad width override after base styles', () => {
  const base = html.indexOf('./music-studio.css?v=1.4.127');
  const ipad = html.indexOf('./music-studio-ipad.css?v=1.0.0');
  assert.ok(base >= 0);
  assert.ok(ipad > base);
});

test('iPad landscape override is coarse-pointer scoped and keeps the editor full width', () => {
  assert.match(css, /min-width:601px/);
  assert.match(css, /max-width:1366px/);
  assert.match(css, /orientation:landscape/);
  assert.match(css, /hover:none/);
  assert.match(css, /pointer:coarse/);
  assert.match(css, /\.music-midi-editor-page/);
  assert.match(css, /width:100%/);
  assert.match(css, /max-width:none/);
  assert.match(css, /safe-area-inset-left/);
  assert.match(css, /safe-area-inset-right/);
});
