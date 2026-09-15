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
  const ipad = html.indexOf('./music-studio-ipad.css?v=1.0.1');
  assert.ok(base >= 0);
  assert.ok(ipad > base);
});

test('iPad width override is limited to landscape coarse pointers from 601px through 1366px', () => {
  const media = css.match(/@media\s*\(([^\n{]+)\)\{/);
  assert.ok(media);
  assert.match(media[1], /min-width:601px/);
  assert.match(media[1], /max-width:1366px/);
  assert.match(media[1], /orientation:landscape/);
  assert.match(media[1], /hover:none/);
  assert.match(media[1], /pointer:coarse/);
});

test('iPad editor uses the full available width without restoring outer max widths or margins', () => {
  assert.match(css, /#music-studio-app\{[^}]*width:100%;[^}]*max-width:none;[^}]*margin:0;[^}]*padding:0;/s);
  assert.match(css, /\.management-layout,[^{]*\.management-main\{[^}]*width:100%;[^}]*max-width:none;[^}]*margin-inline:0;/s);
  assert.match(css, /\.music-midi-editor-page,[^{]*\.music-midi-editor-page\{[^}]*width:100%;[^}]*max-width:none;[^}]*margin-inline:0;/s);
});

test('safe-area padding stays on the shell and editor side padding stays zero', () => {
  assert.match(css, /\.music-studio-shell,[^{]*\.music-studio-shell\{[^}]*padding-inline:max\(4px,env\(safe-area-inset-left\)\) max\(4px,env\(safe-area-inset-right\)\);/s);
  assert.match(css, /\.music-midi-editor-page,[^{]*\.music-midi-editor-page\{[^}]*padding-right:0;[^}]*padding-left:0;/s);
  assert.doesNotMatch(css, /\.music-midi-editor-page,[^{]*\.music-midi-editor-page\{[^}]*safe-area-inset-/s);
});
