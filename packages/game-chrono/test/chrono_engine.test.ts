// 时之三重奏 · 核心机制测试（纯逻辑：残影/换位/时序机关/校验）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, validateLevel, actions, JUMP_V } from '../src/chrono_engine.ts';
import type { LevelDef } from '../src/chrono_engine.ts';

function makeLevel(o: Partial<LevelDef> = {}): LevelDef {
  return {
    schema: 'ccx.chrono/1',
    name: 't1',
    width: 30, height: 12,
    spawn: { x: 1, y: 1, w: 0.6, h: 0.9 },
    solids: [{ x: 0, y: 5, w: 30, h: 1 }],
    finish: { x: 24, y: 4.1, w: 1.2, h: 1 },
    doors: [{ id: 'g1', x: 12, y: 4, w: 0.8, h: 1 }],
    switches: [{ id: 'sw1', x: 10, y: 4.2, w: 0.9, h: 0.8, mode: 'latch', holdTicks: 5, target: 'g1' }],
    echoes: [{ id: 'e1', uses: 2 }],
    collectibles: [],
    ...o,
  };
}

test('关卡校验：引用完整性与 schema', () => {
  assert.equal(validateLevel(makeLevel()).ok, true);
  const bad = makeLevel({ switches: [{ id: 'sw1', x: 0, y: 0, w: 1, h: 1, mode: 'latch', holdTicks: 5, target: 'gNOPE' }] });
  const r = validateLevel(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('target 门不存在')));
  const noSchema = validateLevel({ ...makeLevel(), schema: 'wrong' });
  assert.ok(!noSchema.ok);
  const noEcho = validateLevel({ ...makeLevel(), echoes: [] });
  assert.ok(noEcho.errors.some((e) => e.includes('残影槽')));
  assert.throws(() => createGame(bad), /关卡校验失败/);
});

test('物理：落地 / 右移 / 跳跃', () => {
  const g = createGame(makeLevel());
  for (let i = 0; i < 60; i++) g.tick({});
  const p = g.state.player;
  assert.ok(Math.abs(p.y - 4.1) < 1e-6, '落地 y=' + p.y);
  assert.equal(p.onGround, true);
  const x0 = p.x;
  for (let i = 0; i < 30; i++) g.tick({ right: true });
  assert.ok(g.state.player.x > x0, '右移');
  g.tick({ jump: true });
  assert.ok(g.state.player.vy < 0 || g.state.player.vy === JUMP_V, '起跳');
});

test('残影：录制-重放轨迹逐 tick 一致', () => {
  const g = createGame(makeLevel());
  for (let i = 0; i < 30; i++) g.tick({});
  actions(g, { recordStart: 'e1' });
  for (let i = 0; i < 10; i++) g.tick({});
  for (let i = 0; i < 30; i++) g.tick({ right: true });
  actions(g, { recordStop: 'e1' });
  assert.ok(g.events.some((e) => e.type === 'blueprint.ready'));
  const bp = g.slots[0].blueprint!;
  assert.ok(bp.length >= 40, '蓝图长度 ' + bp.length);
  actions(g, { summon: 'e1' });
  assert.equal(g.state.echoes[0].active, true);
  const e0 = g.state.echoes[0];
  assert.ok(Math.abs(e0.x - bp.samples[0].x) < 1e-9, '回放首帧 x 与录制一致');
  g.tick({});
  const e1 = g.state.echoes[0];
  assert.ok(Math.abs(e1.x - bp.samples[1].x) < 1e-9, '回放第2帧对齐');
});

test('换位瞬移：player ⇄ echo 位置守恒交换', () => {
  const g = createGame(makeLevel());
  for (let i = 0; i < 30; i++) g.tick({});
  actions(g, { recordStart: 'e1' });
  for (let i = 0; i < 20; i++) g.tick({ right: true });
  actions(g, { recordStop: 'e1' });
  const bx = g.state.player.x;
  actions(g, { summon: 'e1' });
  assert.equal(g.state.echoes[0].active, true);
  g.tick({});
  const ex = g.state.echoes[0].x;
  actions(g, { swap: 'e1' });
  assert.ok(Math.abs(g.state.player.x - ex) < 1e-9, 'player 获得 echo 位置');
  assert.ok(Math.abs(g.state.echoes[0].x - bx) < 1e-9, 'echo 获得 player 位置');
  assert.equal(g.state.echoes[0].active, true);
});

test('时序机关 latch：持续 holdTicks 开门；中途离开重置', () => {
  const L = makeLevel({ switches: [{ id: 'sw1', x: 5, y: 4.2, w: 0.9, h: 0.8, mode: 'latch', holdTicks: 5, target: 'g1' }] });
  const g = createGame(L);
  for (let i = 0; i < 30; i++) g.tick({});
  for (let i = 0; i < 24; i++) g.tick({ right: true });
  assert.equal(g.state.switchHold.sw1 > 0, true, '已压上');
  for (let i = 0; i < 20; i++) g.tick({});
  assert.equal(g.state.doors[0].open, true, 'latch 5 ticks 开门');
  assert.ok(g.state.log.some((e) => e.type === 'door.open' && e.mode === 'latch'), 'latch 事件入日志');
  for (let i = 0; i < 12; i++) g.tick({ left: true });
  assert.equal((g.state.switchHold.sw1 ?? 0), 0, '离开后重置');
  for (let i = 0; i < 12; i++) g.tick({ right: true });
  for (let i = 0; i < 5; i++) g.tick({});
  assert.equal(g.state.switchHold.sw1 >= 5, true, 'hold 重新累计');
});

test('时序机关 window：离开即关', () => {
  const L = makeLevel({ switches: [{ id: 'sw1', x: 5, y: 4.2, w: 3, h: 0.8, mode: 'window', holdTicks: 1, target: 'g1' }] });
  const g = createGame(L);
  for (let i = 0; i < 30; i++) g.tick({});
  for (let i = 0; i < 26; i++) g.tick({ right: true });
  assert.equal(g.state.doors[0].open, true, '压上即开');
  for (let i = 0; i < 30; i++) g.tick({ left: true });
  assert.equal(g.state.doors[0].open, false, '离开即关');
});

test('残影踩开关：echo 亦可激活机关（不拾取收集）', () => {
  const L = makeLevel({
    switches: [{ id: 'sw1', x: 5, y: 4.2, w: 1.2, h: 0.8, mode: 'latch', holdTicks: 3, target: 'g1' }],
    echoes: [{ id: 'e1', uses: 1 }],
  });
  const g = createGame(L);
  for (let i = 0; i < 30; i++) g.tick({});
  actions(g, { recordStart: 'e1' });
  for (let i = 0; i < 20; i++) g.tick({ right: true });
  for (let i = 0; i < 12; i++) g.tick({ right: true });
  actions(g, { recordStop: 'e1' });
  for (let i = 0; i < 60; i++) g.tick({ left: true });
  actions(g, { summon: 'e1' });
  let echoOnSwitch = false;
  for (let i = 0; i < g.slots[0].samples.length && !echoOnSwitch; i++) {
    g.tick({});
    const e = g.state.echoes[0];
    if (e.x >= 4.9 && e.x <= 6.4 && e.y < 5) echoOnSwitch = true;
  }
  assert.equal(echoOnSwitch, true, '残影经过压板');
});

test('uses 限制：用尽拒绝召唤', () => {
  const L = makeLevel({ echoes: [{ id: 'e1', uses: 1 }] });
  const g = createGame(L);
  for (let i = 0; i < 30; i++) g.tick({});
  actions(g, { recordStart: 'e1' });
  for (let i = 0; i < 10; i++) g.tick({ right: true });
  actions(g, { recordStop: 'e1' });
  actions(g, { summon: 'e1' });
  assert.equal(g.state.echoes[0].active, true);
  assert.equal(g.slots[0].uses, 0);
  for (let i = 0; i < 12; i++) g.tick({});
  actions(g, { summon: 'e1' });
  assert.ok(g.events.some((e) => e.type === 'echo.denied' && e.reason === 'no-uses'));
});

test('收集与通关：碰撞即得 + finish 判定', () => {
  const L = makeLevel({ collectibles: [{ id: 'c1', x: 3, y: 4.2, w: 0.5, h: 0.5 }], switches: [] });
  const g = createGame(L);
  for (let i = 0; i < 30; i++) g.tick({});
  for (let i = 0; i < 80; i++) g.tick({ right: true });
  const p = g.state.player;
  assert.ok(p.x <= 12.2, '门未开被挡 x=' + p.x);
  assert.equal(g.state.collected.has('c1'), true, '途中吃了碎片');
  assert.equal(g.state.won, false);
  g.state.doors[0].open = true;
  for (let i = 0; i < 200; i++) g.tick({ right: true });
  assert.equal(g.state.won, true, '到终点');
  assert.ok(g.events.some((e) => e.type === 'win'));
});
