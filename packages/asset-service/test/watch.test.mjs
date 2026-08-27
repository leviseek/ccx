import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWatcher } from '../src/watch.mjs';

test('watch：文件变更进入事件队列（合并去重）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-watch-'));
  const watcher = createWatcher(dir, { debounceMs: 10 });
  const events = [];
  watcher.on((batch) => events.push(...batch));
  try {
    const target = join(dir, 'assets', 'sprite.png');
    mkdirSync(join(dir, 'assets'), { recursive: true });
    writeFileSync(target, 'png-bytes');
    // 等 fs.watch 递送（Windows 上 recursive 递送非即时）
    await new Promise((r) => setTimeout(r, 150));
    watcher.pump();
    const paths = events.map(([p]) => p.replace(/\\/g, '/'));
    assert.ok(paths.some((p) => p.includes('sprite.png')), '事件包含目标文件');
  } finally {
    watcher.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('watch：pump 手动冲刷且空队列不触发', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-watch2-'));
  const watcher = createWatcher(dir);
  let calls = 0;
  watcher.on(() => calls++);
  watcher.pump();
  assert.equal(calls, 0, '空队列 pump 不触发');
  watcher.close();
  rmSync(dir, { recursive: true, force: true });
});

test('watch：close 后不再递送', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-watch3-'));
  const watcher = createWatcher(dir, { debounceMs: 10 });
  let calls = 0;
  watcher.on(() => calls++);
  watcher.close();
  writeFileSync(join(dir, 'x.txt'), 'x');
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(calls, 0, '关闭后无事件');
  watcher.pump();
  assert.equal(calls, 0);
  rmSync(dir, { recursive: true, force: true });
});
