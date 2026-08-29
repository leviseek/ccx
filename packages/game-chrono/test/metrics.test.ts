// 时之三重奏 · 评级/结算测试（纯逻辑）
import test from 'node:test';
import assert from 'node:assert/strict';
import { starRating, runResultOf, parTicksFor } from '../src/metrics.ts';
import { levelById } from '../src/levels.ts';

const L = levelById('1-1 初涉矿区')!;

test('parTicks：按宽度 1.2s/tile', () => {
  assert.equal(parTicksFor(L), 24 * 36);
});

test('starRating：1★ 仅通关（碎片不足）', () => {
  const r = starRating(L, { ticks: 300, collected: 0, totalCollectibles: 2, usesUsed: 0, usesTotal: 1 });
  assert.equal(r.stars, 1);
  assert.ok(r.reasons.includes('通关'));
});

test('starRating：2★ 碎片>=2/3 但超时', () => {
  const r = starRating(L, { ticks: 2000, collected: 2, totalCollectibles: 2, usesUsed: 0, usesTotal: 1 });
  assert.equal(r.stars, 2);
  assert.ok(r.reasons.some((x) => x.includes('碎片')));
});

test('starRating：3★ 全达标', () => {
  const r = starRating(L, { ticks: 120, collected: 2, totalCollectibles: 2, usesUsed: 0, usesTotal: 1 });
  assert.equal(r.stars, 3);
  assert.equal(r.timeRatio <= 1, true);
});

test('runResultOf：usesUsed 计算', () => {
  const rr = runResultOf(L, 100, new Set(['c1']), [0]);  // 剩 0 次 = 用完 1 次
  assert.equal(rr.usesUsed, 1);
  assert.equal(rr.collected, 1);
  assert.equal(rr.totalCollectibles, 2);
});
