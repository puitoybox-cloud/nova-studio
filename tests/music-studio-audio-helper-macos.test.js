const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const launcher = fs.readFileSync(path.join(root, 'tools', 'music-audio-pipeline', 'mac-app', 'NovaMusicAudioHelper'), 'utf8');
const plist = fs.readFileSync(path.join(root, 'tools', 'music-audio-pipeline', 'mac-app', 'Info.plist'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'music-audio-helper-macos.yml'), 'utf8');

test('macOS helper keeps routine use out of Terminal', () => {
  assert.match(launcher, /Library\/Application Support\/\$APP_NAME/);
  assert.match(launcher, /127\.0\.0\.1:8766\/health/);
  assert.match(launcher, /localOnly/);
  assert.match(launcher, /setuptools<82/);
  assert.match(launcher, /open -a \"Google Chrome\"/);
  assert.doesNotMatch(launcher, /Terminal\.app/);
});

test('macOS helper bundle has a stable app identity', () => {
  assert.match(plist, /Nova Music Audio Helper/);
  assert.match(plist, /cloud\.puitoybox\.nova\.music-audio-helper/);
  assert.match(plist, /<string>APPL<\/string>/);
});

test('macOS helper workflow packages and verifies an app artifact', () => {
  assert.match(workflow, /runs-on: macos-13/);
  assert.match(workflow, /codesign --verify --deep --strict/);
  assert.match(workflow, /Nova-Music-Audio-Helper-macOS\.zip/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});
