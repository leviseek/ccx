// v1.0 基准6（roadmap §8.2）：MCP 自然语言闭环验证（verify_mcp_loop.mjs 包装）
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const script = join(import.meta.dirname, '..', '..', '..', 'ci', 'verify_mcp_loop.mjs');

test('v1.0 基准6: MCP 闭环（open→精灵→脚本→保存→截图→构建）', () => {
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 0, 'MCP 闭环退出码 0\n' + (r.stdout || '') + (r.stderr || ''));
  assert.match(r.stdout || '', /ALL MCP LOOP GATES PASSED/, '闭环全部通过标记');
});
