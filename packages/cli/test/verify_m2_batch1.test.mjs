import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = import.meta.dirname;
const script = join(here, '..', '..', '..', 'ci', 'verify_m2_batch1.mjs');

test('M2 首批 9 张 ticket 验收走查全过', () => {
  const r = spawnSync(process.execPath, [script, '--json'], {
    encoding: 'utf8',
    env: { ...process.env, CC_CTEST: 'D:\\engine\\w64devkit\\bin\\ctest.exe' },
  });
  const out = JSON.parse(r.stdout);
  assert.equal(out.tickets.length, 9);
  assert.equal(out.allPassed, true, JSON.stringify(out.tickets.filter((x) => !x.passed)));
  assert.equal(r.status, 0, r.stderr);
  const ids = out.tickets.map((x) => x.ticket);
  for (const want of ['T-W3-1', 'T-W3-2', 'T-W4-1', 'T-W5-1', 'T-W5-2', 'T-W5-3', 'T-W5-4', 'T-W5-5', 'T-W2-1']) {
    assert.ok(ids.includes(want), want);
  }
});
