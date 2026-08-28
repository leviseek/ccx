import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameProfile, kCapacity } from '../src/adapter.mjs';

test('帧统计环形缓冲：record/last/snapshot 与 C++ 同构', () => {
  const p = new FrameProfile();
  assert.equal(p.last(), null);
  for (let i = 1; i <= 3; ++i) {
    p.recordFrameStats({ frame: i, frameTimeMs: 16.6, entities: 2, batches: 1, drawCalls: 1, allocBytes: 256 });
  }
  assert.equal(p.last().frame, 3);
  const snap = p.snapshotJson(2);
  assert.equal(snap.schema, 'ccx.profile/1');
  assert.equal(snap.frames.length, 2);
  assert.deepEqual(snap.frames[0], {
    frame: 2, frameTimeMs: 16.6, entities: 2, batches: 1, drawCalls: 1, allocBytes: 256 });
  assert.deepEqual(Object.keys(snap.frames[1]).sort(),
                   ['allocBytes', 'batches', 'drawCalls', 'entities', 'frame', 'frameTimeMs']);
});

test('容量封顶：超过后覆盖最旧（环形）', () => {
  const p = new FrameProfile(4);
  for (let i = 1; i <= 6; ++i) p.recordFrameStats({ frame: i });
  assert.equal(p.history.length, 4, '保留最近 4 帧');
  const snap = p.snapshotJson(10);
  assert.equal(snap.frames.length, 4);
  assert.equal(snap.frames[0].frame, 3);
  assert.equal(snap.frames[3].frame, 6);
});

test('默认 frame 序号自动递增', () => {
  const p = new FrameProfile();
  p.recordFrameStats({ frameTimeMs: 8 });
  p.recordFrameStats({ frameTimeMs: 9 });
  assert.equal(p.last().frame, 1);
});
