import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = import.meta.dirname;
const script = join(here, '..', '..', '..', 'ci', 'verify_review_package.mjs');

test('M2 评审包自检：材料 17/17 + 命令 3/3', () => {
  const r = spawnSync(process.execPath, [script, '--json'], {
    encoding: 'utf8', timeout: 300000,
    env: { ...process.env, CC_CTEST: 'D:\\engine\\w64devkit\\bin\\ctest.exe' },
  });
  assert.equal(r.status, 0, r.stderr + '\n' + (r.stdout || '').slice(0, 300));
  const out = JSON.parse(r.stdout);
  assert.equal(out.materials.length, 17);
  assert.ok(out.materials.every((m) => m.exists), '材料全在');
  assert.equal(out.commands.length, 3);
  assert.ok(out.commands.every((c) => c.passed), JSON.stringify(out.commands));
  assert.equal(out.allPassed, true);
});
