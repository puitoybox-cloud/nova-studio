'use strict';
const assert = require('node:assert/strict');
function compare(before, after) {
  assert.equal(before.completed, true); assert.equal(after.completed, true);
  const audio = r => r.assets.map(({bytes, frames, peak, chunkSha256}) => ({bytes, frames, peak, chunkSha256}));
  assert.deepEqual(audio(after.result), audio(before.result));
  assert.equal(after.result.masterHash, before.result.masterHash);
  const stableMeter = ({method, truePeak, truePeakDb, ...stable}) => stable;
  assert.deepEqual(stableMeter(after.result.mastering), stableMeter(before.result.mastering));
  assert.equal(after.result.mastering.clippingSamples, 0);
  assert.ok(after.result.mastering.truePeakDb <= after.result.masterPlan.ceilingDb + .002);
  function plan(result) {
    const ids = result.assets.map(x => 'wav:' + x.id);
    assert.equal(new Set(ids).size, ids.length, 'unique source IDs');
    assert.equal(result.masterPlan.routes.length, ids.length);
    const routes = result.masterPlan.routes.map((route, i) => {
      assert.equal(route.key, ids[i], 'route must bind its ordered saved source');
      return {...route, key: 'source:' + i};
    });
    return {...result.masterPlan, routes};
  }
  assert.deepEqual(plan(after.result), plan(before.result));
  return {baselineHead: before.head, head: after.head, beforeSteps: before.result.steps, afterSteps: after.result.steps, beforeMemory: before.memory, afterMemory: after.memory, audioEqual: true};
}
module.exports = {compare};
if (require.main === module) {
  const fs = require('node:fs'), [before, after, output] = process.argv.slice(2);
  fs.writeFileSync(output, JSON.stringify(compare(JSON.parse(fs.readFileSync(before)), JSON.parse(fs.readFileSync(after))), null, 2));
}
