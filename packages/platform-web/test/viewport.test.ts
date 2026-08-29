// CCX 平台桥 · 视口适配纯逻辑测试（screen-adaptation）
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitViewport, availableViewport } from '../src/viewport.ts';

test('fitViewport: 小屏 1x 兜底', () => {
  const vp = fitViewport(700, 500, 768, 384, 1);
  assert.equal(vp.scale, 1);
  assert.equal(vp.logicalW, 768);
  assert.equal(vp.logicalH, 384);
});

test('fitViewport: 大屏整数倍放大（1440 宽 -> 1x 仍需 2x? 高度限制）', () => {
  const vp = fitViewport(1440, 900, 768, 384, 1);
  assert.ok(vp.scale >= 1);
  assert.equal(vp.logicalW % 768, 0, '宽为基准整数倍');
  assert.equal(vp.logicalH, vp.logicalW * (384 / 768), '维持 2:1 比例');
});

test('fitViewport: 4K 高度受限 -> 2x（2160px 可用高度）', () => {
  const vp = fitViewport(3840, 2160 - 170, 768, 384, 1);
  assert.equal(vp.scale, 2);
  assert.equal(vp.logicalW, 1536);
  assert.equal(vp.logicalH, 768);
});

test('fitViewport: DPR 保留（高分屏物理渲染分辨率 = logical*dpr）', () => {
  const vp = fitViewport(2000, 1200, 768, 384, 2);
  assert.equal(vp.dpr, 2);
  assert.ok(vp.logicalW >= 768);
});

test('availableViewport: chrome 预留', () => {
  const a = availableViewport(1600, 900);
  assert.equal(a.availW, 1600 - 24);
  assert.equal(a.availH, 900 - 170);
  const small = availableViewport(200, 120);
  assert.ok(small.availW >= 64 && small.availH >= 64, '极小屏兜底');
});
