const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const startPath = path.join(__dirname, '..', 'tools', 'music-audio-pipeline', 'START_AUDIO_PIPELINE.command');
const text = fs.readFileSync(startPath, 'utf8');

test('audio pipeline startup uses unbuffered python and health polling', () => {
  assert.match(text, /PYTHONUNBUFFERED=1/);
  assert.match(text, /bin\/python\" -u server\.py/);
  assert.match(text, /127\.0\.0\.1:8766\/health/);
  assert.match(text, /for _ in 1 2 3 4 5 6 7 8 9 10/);
});

test('audio pipeline startup surfaces port conflicts and startup log', () => {
  assert.match(text, /lsof -nP -iTCP:8766 -sTCP:LISTEN/);
  assert.match(text, /起動時の内容を下に表示します/);
  assert.match(text, /cat \"\$LOG_FILE\"/);
});
