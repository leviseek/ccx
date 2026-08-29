// 时之三重奏 · 运行时绘制指令 + 解法回放测试（纯逻辑层）
import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneDrawLists, hudData, computeCam } from '../src/runtime/scene_draw.ts';
import { CHAPTERS, levelById } from '../src/levels.ts';
import { createGame, actions } from '../src/chrono_engine.ts';
import { runPlan, SOLVERS } from '../src/solvers.ts';

test('computeCam: 视口大于关卡 -> 居中（负相机曾把世界推出屏外）', () => {
  const cam = computeCam(100, 768, 2560);
  assert.equal(cam, (768 - 2560) / 2, '视口超出即居中');
});

test('computeCam: 正常视口钳制 [0, span]', () => {
  assert.equal(computeCam(100, 768, 512), 0);
  assert.equal(computeCam(700, 768, 512), 256);
});

test('sceneDrawLists: 1-1 世界 -> 渲染意图（结构黄金）', () => {
  const level = levelById('1-1 初涉矿区')!;
  const g = createGame(level);
  for (let i = 0; i < 30; i++) g.tick({});
  const L = sceneDrawLists(g.state, level);
  assert.ok(L.solids.length >= 2, '地面+高台');
  assert.equal(L.doors.length, 0, '1-1 无门');
  assert.equal(L.collectibles.length, 2, '两碎片未取');
  assert.equal(L.echoes.length, 0, '无残影活跃');
  assert.ok(L.player.x > 0 && L.player.y > 0, '玩家在场地');
  assert.equal(L.levelW, 24);
  assert.equal(L.levelH, 11);
});

test('sceneDrawLists: 残影活跃进入绘制列表 + 门开启半透意图', () => {
  const level = levelById('1-2 残影替我')!;
  const g = createGame(level);
  for (let i = 0; i < 30; i++) g.tick({});
  const L0 = sceneDrawLists(g.state, level);
  assert.equal(L0.doors[0].open, false, '初始门闭');
  // 模拟：录制+召唤残影（直接触发）
  actions(g, { recordStart: 'e1' });
  for (let i = 0; i < 40; i++) g.tick({});
  actions(g, { recordStop: 'e1' });
  actions(g, { summon: 'e1' });
  const L1 = sceneDrawLists(g.state, level);
  assert.equal(L1.echoes.length, 1, '残影在绘制列表');
});

test('hudData: 关卡名/碎片/残影槽', () => {
  const level = levelById('1-1 初涉矿区')!;
  const g = createGame(level);
  for (let i = 0; i < 30; i++) g.tick({});
  const hud = hudData(g.state, level, g);
  assert.equal(hud.levelName, '1-1 初涉矿区');
  assert.equal(hud.totalCollectibles, 2);
  assert.equal(hud.echoSlots.length, 1);
  assert.equal(hud.won, false);
});

test('solvers: 1-1 全部解法回放 win（虚拟控制器）', () => {
  const level = levelById('1-1 初涉矿区')!;
  const r = runPlan(level, SOLVERS['1-1 初涉矿区']);
  assert.equal(r.win, true, '1-1 可解（ticks=' + r.ticks + '）');
});

test('solvers: 1-2 残影压板解 win + 收集', () => {
  const level = levelById('1-2 残影替我')!;
  const r = runPlan(level, SOLVERS['1-2 残影替我']);
  assert.equal(r.win, true, '1-2 可解（ticks=' + r.ticks + '）');
  assert.ok(r.collected >= 1, '1-2 收集碎片');
});
