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
  const ipad = html.indexOf('./music-studio-ipad.css?v=1.0.6');
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
  assert.ok(css.includes('html,body.music-studio-page,body.is-music-studio-route{box-sizing:border-box;width:100%;max-width:none;margin:0;padding:0}'));
  assert.ok(css.includes('body.music-studio-page #music-studio-app,body.is-music-studio-route #app{box-sizing:border-box;width:100%;max-width:none;min-width:0;margin:0;padding:0}'));
  assert.ok(css.includes('.management-main{box-sizing:border-box;width:100%;max-width:none;min-width:0;margin-inline:0;padding-inline:0}'));
  assert.ok(css.includes('.music-midi-editor-page{box-sizing:border-box;width:100%;max-width:none;min-width:0;margin-inline:0;'));
});

test('safe-area padding is applied once at the editor edge', () => {
  assert.match(css, /\.music-midi-editor-page\{[^}]*padding-right:max\(4px,env\(safe-area-inset-right\)\);[^}]*padding-left:max\(4px,env\(safe-area-inset-left\)\)/s);
  assert.doesNotMatch(css, /#music-studio-app\{[^}]*safe-area-inset-/s);
});

test('iPad landscape editor uses the stable Safari viewport and keeps page overflow internal', () => {
  assert.ok(css.includes('.management-main{height:100svh;max-height:100svh;overflow:hidden}'));
  assert.ok(css.includes('.music-midi-editor-page{height:100svh;max-height:100svh;overflow:hidden}'));
  assert.ok(css.includes('.music-editor-layout{min-height:150px;flex:1 1 auto;overflow:hidden}'));
  assert.ok(css.includes('.music-piano-viewport{height:100%!important;min-height:0;'));
});

test('iPad landscape bottom controls keep Mac order in one five-column row', () => {
  assert.match(css, /\.music-editor-bottom\{[^}]*height:clamp\(276px,36svh,330px\);[^}]*max-height:36svh;[^}]*flex-basis:clamp\(276px,36svh,330px\);[^}]*grid-template-columns:1\.05fr 1\.55fr \.75fr 1\.5fr \.85fr;[^}]*grid-template-rows:minmax\(0,1fr\);/s);
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

test('Snap and Quantize controls reserve one-row widths inside the wider assist column', () => {
  assert.match(css, /\.music-assist-snap-controls\{[^}]*grid-template-columns:minmax\(130px,1fr\) minmax\(112px,auto\);/s);
  assert.match(css, /\.music-assist-quantize-controls\{[^}]*grid-template-columns:minmax\(92px,1fr\) minmax\(128px,auto\) minmax\(44px,auto\);/s);
  assert.match(css, /\.music-assist-quantize-controls>label\{[^}]*white-space:nowrap/s);
});

test('iPad landscape upper editor chrome stays compact and toolbar stays on one row', () => {
  assert.ok(css.includes('.music-editor-chrome{box-sizing:border-box;min-height:32px;flex:0 0 32px;padding:0 48px}'));
  assert.ok(css.includes('.music-editor-chrome .music-editor-heading h1{font-size:.88rem;line-height:1}'));
  assert.match(css, /\.music-editor-topbar\{[^}]*min-height:28px;[^}]*max-height:28px;[^}]*flex:0 0 28px;[^}]*flex-wrap:nowrap;[^}]*overflow-x:hidden/s);
  assert.match(css, /\.music-editor-topbar \.music-editor-menu>summary,[^{]+\{[^}]*min-height:24px;[^}]*height:24px;[^}]*font-size:\.6rem/s);
});

test('iPad landscape hamburger stays inside the Melody制作 header band', () => {
  assert.ok(css.includes('body.music-studio-page:has(.music-midi-editor-page) .nova-menu-toggle{top:max(0px,env(safe-area-inset-top));left:max(4px,env(safe-area-inset-left));width:32px;height:32px;min-height:32px;'));
  assert.ok(css.includes('body.music-studio-page:has(.music-midi-editor-page) .nova-menu-glyph{font-size:20px}'));
});

test('iPad landscape track tabs remain a compact single row', () => {
  assert.match(css, /\.music-part-tabs\{[^}]*min-height:26px;[^}]*flex:0 0 26px;[^}]*flex-wrap:nowrap;[^}]*overflow-x:auto;[^}]*overflow-y:hidden;/s);
  assert.match(css, /\.music-part-tab-list\{[^}]*min-width:max-content;[^}]*flex-wrap:nowrap;/s);
  assert.match(css, /\.music-history-controls>button\{[^}]*height:22px;[^}]*min-height:22px;[^}]*max-height:22px;/s);
});

test('iPad landscape Piano Roll ruler keeps all information in a shorter header', () => {
  assert.ok(css.includes('.music-piano-frame{--music-piano-header-height:46px}'));
  assert.ok(css.includes('.music-loop-ruler{height:22px}'));
  assert.ok(css.includes('.music-loop-ruler+.music-measure-row,.music-midi-editor-page .music-measure-row,.music-midi-editor-page .music-measure{height:24px!important;min-height:24px!important;max-height:24px!important}'));
  assert.ok(css.includes('.music-time-ruler,.music-midi-editor-page .music-playhead-handle{height:10px}'));
});
