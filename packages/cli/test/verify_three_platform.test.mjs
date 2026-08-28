// v1.0 基准3（roadmap §8.2）：从零新建项目 → 三端出包 < 1 小时
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const script = join(import.meta.dirname, '..', '..', '..', 'ci', 'verify_three_platform.mjs');

test('v1.0 基准3: 从零项目→Web+Android 出包 < 1h', () => {
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 900000 });
  assert.equal(r.status, 0, '出包验证退出码 0\n' + (r.stdout || '') + (r.stderr || ''));
  assert.match(r.stdout || '', /ALL THREE-PLATFORM GATES PASSED/, '出包全部通过');
});
