// 时之三重奏 · 核心机制测试（纯逻辑：残影/换位/时序机关/校验）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, validateLevel, actions, JUMP_V } from '../src/chrono_engine.mjs';

function makeLevel(o = {}) {
  return {
    schema: 'ccx.chrono/1',
    name: o.name ?? 't1',
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
  // 落地（spawn y=1，落到地面 y=5 -> p.y = 5-0.9 = 4.1）
  for (let i = 0; i < 60; i++) g.tick({});
  const p = g.state.player;
  assert.ok(Math.abs(p.y - 4.1) < 1e-6, '落地 y=' + p.y);
  assert.equal(p.onGround, true);
  const x0 = p.x;
  for (let i = 0; i < 30; i++) g.tick({ right: true });
  assert.ok(g.state.player.x > x0, '右移');
  // 跳跃（从地面起跳 -> vy 负）
  g.tick({ jump: true });
  assert.ok(g.state.player.vy < 0 || g.state.player.vy === JUMP_V, '起跳');
});

test('残影：录制-重放轨迹逐 tick 一致', () => {
  const g = createGame(makeLevel());
  for (let i = 0; i < 30; i++) g.tick({}); // 落地
  const startX = g.state.player.x;
  actions(g, { recordStart: 'e1' });
  // 录制 40 tick：原地 10 + 右移 30
  for (let i = 0; i < 10; i++) g.tick({});
  for (let i = 0; i < 30; i++) g.tick({ right: true });
  actions(g, { recordStop: 'e1' });
  assert.ok(g.events.some((e) => e.type === 'blueprint.ready'));
  const bp = g.slots[0].blueprint;
  assert.ok(bp.length >= 40, '蓝图长度 ' + bp.length);
  // 召唤后回放：每 tick 位置 == 对应录制时 player 位置（初始时对齐）
  // 回放第 0 帧应等于录制起点状态
  actions(g, { summon: 'e1' });
  assert.equal(g.state.echoes[0].active, true);
  const e0 = g.state.echoes[0];
  assert.ok(Math.abs(e0.x - bp.samples[0].x) < 1e-9, '回放首帧 x 与录制一致');
  // 回放行进：下一 tick 对应 samples[1]
  g.tick({}); // tick 内回放推进到 idx=1
  const e1 = g.state.echoes[0];
  assert.ok(Math.abs(e1.x - bp.samples[1].x) < 1e-9, '回放第2帧对齐');
});

test('换位瞬移：player ⇄ echo 位置守恒交换', () => {
  const g = createGame(makeLevel());
  for (let i = 0; i < 30; i++) g.tick({}); // 落稳 x=1
  actions(g, { recordStart: 'e1' });
  for (let i = 0; i < 20; i++) g.tick({ right: true }); // 录到 x≈1+5*20/30=4.33
  actions(g, { recordStop: 'e1' });
  const bx = g.state.player.x;
  actions(g, { summon: 'e1' });
  assert.equal(g.state.echoes[0].active, true);
  g.tick({}); // 回放推进一帧到样本1
  const ex = g.state.echoes[0].x;
  // 换位
  actions(g, { swap: 'e1' });
  assert.ok(Math.abs(g.state.player.x - ex) < 1e-9, 'player 获得 echo 位置');
  assert.ok(Math.abs(g.state.echoes[0].x - bx) < 1e-9, 'echo 获得 player 位置');
  // 换位后残影继续回放（不中断）
  const activeAfter = g.state.echoes[0].active;
  assert.equal(activeAfter, true);
});

test('时序机关 latch：持续 holdTicks 开门；中途离开重置', () => {
  const L = makeLevel({ switches: [{ id: 'sw1', x: 5, y: 4.2, w: 0.9, h: 0.8, mode: 'latch', holdTicks: 5, target: 'g1' }] });
  const g = createGame(L);
  for (let i = 0; i < 30; i++) g.tick({}); // 落地 x=1
  // 精确走上压板（1 + 5*24/30 = 5.0，压板 x 5..5.9）
  for (let i = 0; i < 24; i++) g.tick({ right: true });
  assert.equal(g.state.switchHold.sw1 > 0, true, '已压上');
  // 静止：hold 连续到 5 ticks 即 latch 开门
  for (let i = 0; i < 20; i++) g.tick({});
  assert.equal(g.state.doors[0].open, true, 'latch 5 ticks 开门');
  assert.ok(g.state.log.some((e) => e.type === 'door.open' && e.mode === 'latch'), 'latch 事件入日志');
  // 离开（12 ticks left = 2 tiles -> x=3）：hold 计数重置
  for (let i = 0; i < 12; i++) g.tick({ left: true });
  assert.equal((g.state.switchHold.sw1 ?? 0), 0, '离开后重置');
  // 重新压回（x=3 出发 12 ticks = 2 tiles -> x=5.0）：hold 重新累计（门已永久开）
  for (let i = 0; i < 12; i++) g.tick({ right: true });
  for (let i = 0; i < 5; i++) g.tick({});
  assert.equal(g.state.switchHold.sw1 >= 5, true, 'hold 重新累计');
});

test('时序机关 window：离开即关', () => {
  const L = makeLevel({ switches: [{ id: 'sw1', x: 5, y: 4.2, w: 3, h: 0.8, mode: 'window', holdTicks: 1, target: 'g1' }] });
  const g = createGame(L);
  for (let i = 0; i < 30; i++) g.tick({});
  for (let i = 0; i < 26; i++) g.tick({ right: true }); // 到压板
  assert.equal(g.state.doors[0].open, true, '压上即开');
  for (let i = 0; i < 30; i++) g.tick({ left: true }); // 离开
  assert.equal(g.state.doors[0].open, false, '离开即关');
});

test('残影踩开关：echo 亦可激活机关（不拾取收集）', () => {
  const L = makeLevel({
    switches: [{ id: 'sw1', x: 5, y: 4.2, w: 1.2, h: 0.8, mode: 'latch', holdTicks: 3, target: 'g1' }],
    echoes: [{ id: 'e1', uses: 1 }],
  });
  const g = createGame(L);
  for (let i = 0; i < 30; i++) g.tick({});
  // 录一段：从压板上方走过（x 5~6）
  actions(g, { recordStart: 'e1' });
  for (let i = 0; i < 20; i++) g.tick({ right: true }); // 1..4.33
  for (let i = 0; i < 12; i++) g.tick({ right: true }); // 4.33..6.33 经过压板
  actions(g, { recordStop: 'e1' });
  // 玩家回起点，残影自行踩板
  for (let i = 0; i < 60; i++) g.tick({ left: true });
  actions(g, { summon: 'e1' });
  // 回放让残影走到压板区（找 echo 在压板上的 tick）
  let echoOnSwitch = false;
  for (let i = 0; i < bp_len(g) && !echoOnSwitch; i++) {
    g.tick({});
    const e = g.state.echoes[0];
    if (e.x >= 4.9 && e.x <= 6.4 && e.y < 5) echoOnSwitch = true;
  }
  assert.equal(echoOnSwitch, true, '残影经过压板');
  function bp_len() { return g.slots[0].samples.length; }
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
  // 播完后（等待蓝图长度）再召唤被拒
  for (let i = 0; i < 12; i++) g.tick({});
  actions(g, { summon: 'e1' });
  assert.ok(g.events.some((e) => e.type === 'echo.denied' && e.reason === 'no-uses'));
});

test('收集与通关：碰撞即得 + finish 判定', () => {
  // 无开关（switches: []）→ 门保持关闭：验证阻挡；后手动开门验证通行
  const L = makeLevel({ collectibles: [{ id: 'c1', x: 3, y: 4.2, w: 0.5, h: 0.5 }], switches: [] });
  const g = createGame(L);
  for (let i = 0; i < 30; i++) g.tick({});
  // 撞门受阻：右移到 12 停下（未开门门挡）
  for (let i = 0; i < 80; i++) g.tick({ right: true });
  const p = g.state.player;
  assert.ok(p.x <= 12.2, '门未开被挡 x=' + p.x);
  assert.equal(g.state.collected.has('c1'), true, '途中吃了碎片');
  assert.equal(g.state.won, false);
  // 开门（拆除/关闭门即通）→ 到终点
  g.state.doors[0].open = true;
  for (let i = 0; i < 200; i++) g.tick({ right: true });
  assert.equal(g.state.won, true, '到终点');
  assert.ok(g.events.some((e) => e.type === 'win'));
});
