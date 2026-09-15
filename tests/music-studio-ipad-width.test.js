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
  const ipad = html.indexOf('./music-studio-ipad.css?v=1.0.3');
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

test('iPad landscape upper editor chrome stays compact and toolbar stays on one row', () => {
  assert.match(css, /\.music-editor-chrome\{[^}]*min-height:32px;[^}]*flex:0 0 32px;[^}]*padding:0 48px;/s);
  assert.match(css, /\.music-editor-chrome \.music-editor-heading h1\{[^}]*font-size:\.88rem;[^}]*line-height:1;/s);
  assert.match(css, /\.music-editor-topbar\{[^}]*min-height:28px;[^}]*max-height:28px;[^}]*flex:0 0 28px;[^}]*flex-wrap:nowrap;[^}]*overflow-x:hidden;/s);
  assert.match(css, /\.music-editor-topbar \.music-editor-menu>summary,[^{]+\{[^}]*min-height:24px;[^}]*height:24px;[^}]*font-size:\.6rem;/s);
});

test('iPad landscape hamburger stays inside the Melody制作 header band', () => {
  assert.match(css, /body\.music-studio-page:has\(\.music-midi-editor-page\) \.nova-menu-toggle\{[^}]*top:max\(0px,env\(safe-area-inset-top\)\);[^}]*left:max\(4px,env\(safe-area-inset-left\)\);[^}]*width:32px;[^}]*height:32px;[^}]*min-height:32px;/s);
  assert.match(css, /body\.music-studio-page:has\(\.music-midi-editor-page\) \.nova-menu-glyph\{[^}]*font-size:20px;/s);
});

test('iPad landscape track tabs remain a compact single row', () => {
  assert.match(css, /\.music-part-tabs\{[^}]*min-height:26px;[^}]*flex:0 0 26px;[^}]*flex-wrap:nowrap;[^}]*overflow-x:auto;[^}]*overflow-y:hidden;/s);
  assert.match(css, /\.music-part-tab-list\{[^}]*min-width:max-content;[^}]*flex-wrap:nowrap;/s);
  assert.match(css, /\.music-history-controls>button\{[^}]*height:22px;[^}]*min-height:22px;[^}]*max-height:22px;/s);
});

test('iPad landscape Piano Roll ruler keeps all information in a shorter header', () => {
  assert.match(css, /\.music-piano-frame\{--music-piano-header-height:46px\}/);
  assert.match(css, /\.music-loop-ruler\{height:22px\}/);
  assert.match(css, /\.music-loop-ruler\+\.music-measure-row,[^{]+\{[^}]*height:24px!important;[^}]*min-height:24px!important;[^}]*max-height:24px!important;/s);
  assert.match(css, /\.music-time-ruler,[^{]+\{height:10px\}/s);
});
