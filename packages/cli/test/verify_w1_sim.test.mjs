import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = import.meta.dirname;
const script = join(here, '..', '..', '..', 'ci', 'verify_w1_sim.mjs');

test('W1 五级验收（仿真侧）：5 级全过', () => {
  const r = spawnSync(process.execPath, [script, '--json'], {
    encoding: 'utf8',
    env: { ...process.env, CC_CTEST: 'D:\\engine\\w64devkit\\bin\\ctest.exe' },
  });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const out = JSON.parse(r.stdout);
  assert.equal(out.tool, 'verify-w1-sim');
  assert.equal(out.levels.length, 5);
  assert.equal(out.allPassed, true);
  assert.deepEqual(out.levels.map((l) => l.level), [1, 2, 3, 4, 5]);
  assert.ok(out.environment.gpu === 'not-available', '环境标记');
});
