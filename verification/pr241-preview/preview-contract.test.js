const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'pr241-exact-head-macos-preview.yml'), 'utf8');
const launcher = fs.readFileSync(path.join(__dirname, 'NovaMusicStudioPR241Preview'), 'utf8');

test('PR241 preview packages the exact product head without changing product files', () => {
  assert.match(workflow, /runs-on: macos-15-intel/);
  assert.match(workflow, /d50204ac623814154a425885a06815d8ef4ae3c3/);
  assert.match(workflow, /Nova-Music-Studio-PR241-Exact-Head-Preview\.zip/);
});

test('PR241 preview starts loopback-only product and audio services', () => {
  assert.match(launcher, /127\.0\.0\.1:8765\/music-studio\.html/);
  assert.match(launcher, /127\.0\.0\.1:8766\/health/);
  assert.match(launcher, /EXPECTED_HEAD="d50204ac623814154a425885a06815d8ef4ae3c3"/);
  assert.doesNotMatch(launcher, /github\.io/);
  assert.doesNotMatch(launcher, /Terminal\.app/);
});
