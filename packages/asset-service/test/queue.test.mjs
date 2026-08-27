import test from 'node:test';
import assert from 'node:assert/strict';
import { assetUuid, ImportQueue } from '../src/queue.mjs';

test('assetUuid：确定性 + 区分输入', () => {
  const a = assetUuid('assets/hero.png', 'ccx.png');
  const b = assetUuid('assets/hero.png', 'ccx.png');
  assert.equal(a, b, '同输入同 uuid');
  assert.equal(a.length, 36, 'uuid 形态');
  const c = assetUuid('assets/enemy.png', 'ccx.png');
  const d = assetUuid('assets/hero.png', 'ccx.alt');
  assert.notEqual(a, c, '不同路径不同 uuid');
  assert.notEqual(a, d, '不同 importer 不同 uuid');
});

test('ImportQueue：优先级排序（高位先出）+ 幂等去重', () => {
  const q = new ImportQueue();
  q.enqueue({ uuid: 'u-low', priority: 0 });
  q.enqueue({ uuid: 'u-high', priority: 10 });
  q.enqueue({ uuid: 'u-back', priority: 5 });
  assert.equal(q.enqueue({ uuid: 'u-low', priority: 0 }), false, '重复入队幂等');
  assert.equal(q.summary().queued, 3);
  assert.equal(q.next().uuid, 'u-high', '高优先级先出');
  assert.equal(q.next().uuid, 'u-back');
  assert.equal(q.next().uuid, 'u-low');
  assert.equal(q.next(), null, '空队列 next 为 null');
});

test('ImportQueue：complete/failed/cancel/状态', () => {
  const q = new ImportQueue();
  q.enqueue({ uuid: 'ok', priority: 1 });
  q.enqueue({ uuid: 'bad', priority: 1 });
  q.enqueue({ uuid: 'gone', priority: 1 });
  assert.equal(q.cancel('gone'), true, '取消 pending');
  const first = q.next();
  assert.equal(first.uuid, 'ok');
  q.complete('ok', { file: 'x.png' });
  const second = q.next();
  assert.equal(second.uuid, 'bad');
  q.fail('bad', 'no such importer');
  assert.deepEqual(q.summary(), { queued: 0, running: 0, done: 2 });
  assert.equal(q.get('ok').status, 'done');
  assert.equal(q.get('bad').status, 'failed');
  assert.equal(q.get('gone'), null, '被取消的不可查');
});
