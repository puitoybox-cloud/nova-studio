'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'music-studio.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'music-studio-ipad.css'), 'utf8');
const followUpCss = fs.readFileSync(path.join(root, 'music-studio-ipad-pr250-layout.css'), 'utf8');

test('standalone Music Studio loads the current iPad override after base styles', () => {
  const base = html.indexOf('./music-studio.css?v=1.4.129');
  const ipad = html.indexOf('./music-studio-ipad.css?v=1.0.16');
  const followUp = html.indexOf('./music-studio-ipad-pr250-layout.css?v=1.0.6');
  assert.ok(base >= 0);
  assert.ok(ipad > base);
  assert.ok(followUp > ipad);
});

test('standalone iPad home reuses the formal Nova Studio hero and bridge assets', () => {
  assert.match(html, /style\.css\?v=1\.4\.9/);
  assert.match(html, /nova-unified-ui\.css\?v=1\.1\.10/);
  assert.match(html, /gemini-bridge\.js\?v=1\.5\.2/);
  assert.match(html, /nova-menu\.js\?v=1\.0\.4/);
  assert.equal((html.match(/data-music-home-style/g) || []).length, 4);
  const app = fs.readFileSync(path.join(root, 'music-studio.js'), 'utf8');
  assert.match(app, /function standaloneHero\(\).*music-studio-home-hero-20260804-3\.jpeg.*MUSIC PRODUCTION.*Music Studio/s);
  assert.doesNotMatch(app.slice(app.indexOf('function standaloneHero'), app.indexOf('function standalonePage')), /MIDI \/ Logic Pro|studio-hero-badge/);
  assert.match(fs.readFileSync(path.join(root, 'music-studio.js'), 'utf8'), /\[data-music-home-style\][\s\S]*?sheet\.disabled=isEditor/);
  assert.match(fs.readFileSync(path.join(root, 'nova-menu.js'), 'utf8'), /#app,#music-studio-app,#musicStudioRoot/);
});

test('iPad home compaction is isolated from the editor and non-touch desktop', () => {
  assert.match(followUpCss, /@media \(min-width:601px\) and \(orientation:landscape\) and \(hover:none\) and \(pointer:coarse\)/);
  assert.match(followUpCss, /body\.music-studio-page\.is-studio-route:not\(:has\(\.music-midi-editor-page\)\)/);
  assert.match(followUpCss, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(followUpCss, /\.nova-studio-route-main>\.atelier-hero\{[^}]*height:auto;[^}]*aspect-ratio:4\/1/s);
});

test('iPad home Hero aligns with Home content and MENU overlays the uncropped formal artwork', () => {
  assert.match(followUpCss, /\.nova-studio-route-main>\.atelier-hero\{[^}]*width:100%;[^}]*max-width:100%;[^}]*margin-inline:0;/s);
  assert.match(followUpCss, /\.nova-studio-route-main>\.atelier-hero>\.atelier-hero-media>img\{[^}]*object-fit:contain;[^}]*object-position:center;/s);
  assert.match(fs.readFileSync(path.join(root, 'nova-menu.js'), 'utf8'), /hero\?target\.prepend\(toggle\)/);
  assert.equal(fs.statSync(path.join(root, 'assets/images/home/music-studio-home-hero-20260804-3.jpeg')).size > 0, true);
});

test('iPad width overrides cover every landscape coarse-pointer viewport above phone width', () => {
  for (const source of [css, followUpCss]) {
    const media = source.match(/@media\s*\(([^\n{]+)\)\{/);
    assert.ok(media);
    assert.match(media[1], /min-width:601px/);
    assert.doesNotMatch(media[1], /max-width/);
    assert.match(media[1], /orientation:landscape/);
    assert.match(media[1], /hover:none/);
    assert.match(media[1], /pointer:coarse/);
  }
});

test('iPad editor fills the native wrapper width without viewport breakout margins', () => {
  assert.match(css,/body\.is-music-studio-route \.music-studio-shell:has\(\.music-midi-editor-page\)/);
  assert.match(css,/\.music-studio-shell:has\(\.music-midi-editor-page\)\{box-sizing:border-box;width:100%!important;max-width:none!important;margin:0!important;padding:0!important\}/);
  assert.match(css,/\.management-layout:has\(\.music-midi-editor-page\)/);
  assert.match(css,/,\.music-midi-editor-page\{position:static!important;box-sizing:border-box;width:100%!important;max-width:none!important;[^}]*transform:none!important\}/);
  assert.doesNotMatch(css,/margin-left:calc\(50% - 50vw\)/);
  assert.doesNotMatch(css,/margin-right:calc\(50% - 50vw\)/);
});

test('iPad landscape keeps the editor inside the stable Safari viewport', () => {
  assert.match(css,/height:100svh;max-height:100svh;overflow:hidden/);
  assert.match(css,/\.music-editor-layout\{[^}]*height:50svh!important;[^}]*max-height:50svh!important;/s);
  assert.match(css,/\.music-piano-viewport\{[^}]*height:100%!important;[^}]*overscroll-behavior:contain/s);
});

test('iPad menu sits in the first app row after the native status safe area', () => {
  assert.match(css,/\.nova-menu-toggle\{[^}]*top:27px!important;[^}]*left:8px!important;/s);
  assert.match(css,/\.music-editor-topbar\{padding-left:40px!important\}/);
});

test('iPad hamburger remains three equal CSS lines', () => {
  assert.match(css,/\.nova-menu-glyph>span\{[^}]*width:18px!important;[^}]*height:2px!important;[^}]*background:#f2f5f8!important/s);
});

test('iPad landscape bottom controls remain a five-column row', () => {
  assert.match(css,/\.music-editor-bottom\{[^}]*grid-template-columns:1\.05fr 1\.55fr \.75fr 1\.5fr \.85fr;[^}]*grid-template-rows:minmax\(0,1fr\)/s);
  assert.match(css,/>section:nth-child\(1\)\{grid-column:1\}/);
  assert.match(css,/>\.music-display-assist\{grid-column:2\}/);
  assert.match(css,/>\.music-edit-range\{grid-column:3\}/);
  assert.match(css,/>\.music-partial-edit\{grid-column:4\}/);
  assert.match(css,/>section:last-child\{grid-column:5\}/);
});

test('Snap and Quantize controls retain the accepted compact layout', () => {
  assert.match(css,/\.music-assist-snap-controls\{[^}]*grid-template-columns:minmax\(126px,1fr\) 42px minmax\(72px,82px\)/s);
  assert.match(css,/\.music-assist-quantize-controls\{[^}]*grid-template-columns:minmax\(88px,1fr\) 58px minmax\(72px,82px\) minmax\(64px,70px\)/s);
});

test('iPad Piano Roll CSS does not globally disable WKWebView pinch gestures', () => {
  assert.doesNotMatch(css, /touch-action\s*:\s*none/);
});
