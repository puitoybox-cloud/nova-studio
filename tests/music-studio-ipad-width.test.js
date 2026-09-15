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
  const ipad = html.indexOf('./music-studio-ipad.css?v=1.0.2');
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

test('iPad landscape editor uses the stable Safari viewport and keeps page overflow internal', () => {
  assert.match(css, /html:has\(\.music-midi-editor-page\),[^{]+\{[^}]*height:100svh;[^}]*max-height:100svh;[^}]*overflow:hidden;/s);
  assert.match(css, /\.music-midi-editor-page,[^{]*\.music-midi-editor-page\{[^}]*height:100svh;[^}]*max-height:100svh;[^}]*overflow:hidden;/s);
  assert.match(css, /\.music-editor-layout\{[^}]*min-height:150px;[^}]*flex:1 1 auto;[^}]*overflow:hidden;/s);
  assert.match(css, /\.music-piano-viewport\{[^}]*height:100%!important;[^}]*min-height:0;/s);
});

test('iPad landscape bottom controls keep Mac order in one five-column row', () => {
  assert.match(css, /\.music-editor-bottom\{[^}]*height:clamp\(276px,36svh,330px\);[^}]*max-height:36svh;[^}]*flex-basis:clamp\(276px,36svh,330px\);[^}]*grid-template-columns:1\.15fr 1\.25fr \.75fr 1\.65fr \.9fr;[^}]*grid-template-rows:minmax\(0,1fr\);/s);
  assert.match(css, />section\{[^}]*grid-row:1!important;/s);
  assert.match(css, />section:nth-child\(1\)\{grid-column:1\}/);
  assert.match(css, />\.music-display-assist\{grid-column:2\}/);
  assert.match(css, />\.music-edit-range\{grid-column:3\}/);
  assert.match(css, />\.music-partial-edit\{grid-column:4\}/);
  assert.match(css, />section:last-child\{grid-column:5\}/);
});

test('iPad landscape controls remain compact but operable', () => {
  assert.match(css, /\.music-editor-bottom button\{[^}]*min-height:32px;/s);
  assert.match(css, /\.music-editor-bottom :is\(input,select,textarea\)\{[^}]*min-height:32px;[^}]*height:32px;/s);
});
