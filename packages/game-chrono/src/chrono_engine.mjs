// 时之三重奏 · 纯逻辑时轴引擎（ccx.chrono/1）
// 确定性：同一输入序列 -> 同一世界状态（无随机；测试可直接断言）
// 模块无 DOM/定时器依赖：Node 测全机制，浏览器运行时仅为渲染壳

export const SCHEMA = 'ccx.chrono/1';
export const DT = 1 / 30;          // 固定步 30 Hz
export const GRAVITY = 30;         // tile/s^2
export const RUN_SPEED = 5.0;      // tile/s
export const JUMP_V = -10.0;       // tile/s（向下为正，负 = 起跳）
export const MAX_WINDOW_TICKS = 900; // 录制上界 30s

function rectHit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

/** 关卡校验（数据即文档：ccx.chrono/1 可 diff JSON） */
export function validateLevel(data) {
  const errs = [];
  if (!data || data.schema !== SCHEMA) errs.push('schema 需 ' + SCHEMA);
  if (!data.name) errs.push('缺 name');
  if (!Number.isFinite(data.width) || !Number.isFinite(data.height)) errs.push('缺 width/height');
  const rect = (v, tag) => {
    if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y) ||
        !Number.isFinite(v.w) || !Number.isFinite(v.h)) errs.push(tag + ' 需 {x,y,w,h} 数字');
  };
  if (data.spawn) {
    if (!Number.isFinite(data.spawn.x) || !Number.isFinite(data.spawn.y)) errs.push('spawn 需 {x,y} 数字');
    if (data.spawn.w !== undefined && !Number.isFinite(data.spawn.w)) errs.push('spawn.w 需数字');
    if (data.spawn.h !== undefined && !Number.isFinite(data.spawn.h)) errs.push('spawn.h 需数字');
  } else errs.push('缺 spawn');
  rect(data.finish, 'finish');
  for (const s of data.solids ?? []) rect(s, 'solid');
  const switchIds = new Set();
  const slotIds = new Set();
  const doorIds = new Set((data.doors ?? []).map((d) => d.id));
  for (const d of data.doors ?? []) rect(d, 'door ' + d.id);
  for (const s of data.switches ?? []) {
    if (!s.id) errs.push('switch 缺 id'); else switchIds.add(s.id);
    rect(s, 'switch ' + s.id);
    if (s.mode !== 'latch' && s.mode !== 'window') errs.push('switch ' + s.id + ' mode 需 latch|window');
    if (!(s.holdTicks > 0)) errs.push('switch ' + s.id + ' holdTicks 需 >0');
    if (!doorIds.has(s.target)) errs.push('switch ' + s.id + ' target 门不存在: ' + s.target);
  }
  for (const e of data.echoes ?? []) {
    if (!e.id) errs.push('echo 缺 id'); else slotIds.add(e.id);
    if (!(e.uses >= 1)) errs.push('echo ' + e.id + ' uses 需 >=1');
  }
  for (const c of data.collectibles ?? []) {
    if (!c.id) errs.push('collectible 缺 id');
    rect(c, 'collectible ' + c.id);
  }
  if (data.echoes?.length === 0) errs.push('至少 1 个残影槽（本作机制核心）');
  return { ok: errs.length === 0, errors: errs };
}

/** 创建一局（关卡数据 -> 可变游戏状态句柄） */
export function createGame(level, opts = {}) {
  const v = validateLevel(level);
  if (!v.ok) throw new Error('关卡校验失败: ' + v.errors.join('; '));
  const game = {
    level,
    slots: level.echoes.map((e) => ({
      id: e.id, uses: e.uses, blueprint: null, recActive: false, samples: [],
      echo: null,            // { t } 回放指针；echo.pos 由 tick 写入
    })),
    state: null,
    events: [],
    tickCount: 0,
    _win: false,
  };
  game.reset = () => {
    const L = level;
    game.state = {
      tick: 0,
      player: { x: L.spawn.x, y: L.spawn.y, w: L.spawn.w ?? 0.6, h: L.spawn.h ?? 0.9,
                vx: 0, vy: 0, onGround: false },
      echoes: game.slots.map((s) => ({ id: s.id, active: false, t: 0,
        x: 0, y: 0, w: L.spawn.w ?? 0.6, h: L.spawn.h ?? 0.9, vx: 0, vy: 0, done: false })),
      doors: L.doors.map((d) => ({ id: d.id, open: d.openHint ?? false, rect: { ...d } })),
      collected: new Set(),
      switchHold: {},
      won: false,
      log: [],           // 事件累积日志（铁律 12 审计精神；运行时 HUD/音效消费）
      recActive: game.slots.map((s) => s.recActive),
    };
    for (const s of game.slots) { s.blueprint = null; s.samples = []; s.recActive = false; s.echo = null; }
    game.events = [];
    game.tickCount = 0;
    game._win = false;
    return game.state;
  };
  game.tick = (input = {}) => {
    const st = game.state;
    st.tick += 1;
    if (st.won) return st; // 通关后冻结：事件保持 win tick 内容
    const ev = [];
    game.events = ev;

    // 1) 录制状态推进（每槽独立：recStart 后逐 tick 记录 player 快照）
    game.slots.forEach((slot, i) => {
      if (slot.recActive) {
        slot.samples.push(snapshot(st.player));
        if (slot.samples.length >= MAX_WINDOW_TICKS) {
          slot.recActive = false;
          slot.blueprint = { length: slot.samples.length, samples: slot.samples };
          ev.push({ type: 'blueprint.locked', slot: slot.id, ticks: slot.samples.length });
        }
      }
    });

    // 2) 残影回放推进（播放中：按蓝图逐 tick 置位）
    game.slots.forEach((slot, i) => {
      const e = st.echoes[i];
      if (!e.active || !slot.echo) return;
      const bp = slot.blueprint;
      const idx = slot.echo.t;
      if (idx < bp.length) {
        const s = bp.samples[idx];
        e.x = s.x; e.y = s.y; e.vx = s.vx; e.vy = s.vy;
        slot.echo.t += 1;
        ev.push({ type: 'echo.replay', slot: slot.id, x: e.x, y: e.y });
      } else {
        e.active = false; e.done = true;
        slot.echo = null;
        ev.push({ type: 'echo.done', slot: slot.id });
      }
    });

    // 3) 玩家物理（AABB vs solids；门开启后不再是实体）
    const p = st.player;
    _playerPhysics(p, st.doors.filter((d) => !d.open).map((d) => d.rect), level.solids ?? [], input);
    // 残影不参与物理（严格按记录轨迹行走）

    // 4) 机关：实体集 = player + 活跃 echoes
    const bodies = [
      { id: 'player', rect: p },
      ...game.slots.map((_, i) => ({ id: st.echoes[i].id, rect: st.echoes[i] })).filter((e, i) => st.echoes[i].active),
    ];
    for (const sw of level.switches ?? []) {
      const on = bodies.filter((b) => rectHit(b.rect, sw)).length > 0;
      const key = sw.id;
      if (on) st.switchHold[key] = (st.switchHold[key] ?? 0) + 1;
      else st.switchHold[key] = 0;
      if (sw.mode === 'window') {
        const door = st.doors.find((d) => d.id === sw.target);
        if (door) {
          if (on && !door.open) { door.open = true; ev.push({ type: 'door.open', door: sw.target, mode: 'window' }); }
          if (!on && door.open) { door.open = false; ev.push({ type: 'door.close', door: sw.target, mode: 'window' }); }
        }
      } else { // latch
        if (!st.switchHold[key] || st.switchHold[key] < sw.holdTicks) continue;
        const door = st.doors.find((d) => d.id === sw.target);
        if (door && !door.open) {
          door.open = true;
          ev.push({ type: 'door.open', door: sw.target, mode: 'latch', heldTicks: st.switchHold[key] });
        }
      }
    }

    // 5) 收集（玩家触碰；残影为解谜工具不拾取）
    for (const c of level.collectibles ?? []) {
      if (!st.collected.has(c.id) && rectHit(p, c)) {
        st.collected.add(c.id);
        ev.push({ type: 'collect', id: c.id });
      }
    }

    // 6) 到达终点
    if (!st.won && rectHit(p, level.finish)) {
      st.won = true; game._win = true;
      ev.push({ type: 'win' });
    }
    st.log.push(...ev);
    if (st.log.length > 512) st.log.splice(0, st.log.length - 512);
    return st;
  };
  game.reset();
  return game;
}

function snapshot(ent) {
  return { x: ent.x, y: ent.y, vx: ent.vx, vy: ent.vy, onGround: ent.onGround };
}

function _playerPhysics(p, solidRects, solids, input) {
  const platforms = [...solidRects, ...solids];
  p.vx = input.left ? -RUN_SPEED : input.right ? RUN_SPEED : 0;
  p.vy += GRAVITY * DT;
  if (input.jump && p.onGround) { p.vy = JUMP_V; p.onGround = false; }
  // X 轴
  p.x += p.vx * DT;
  for (const s of platforms) {
    if (rectHit(p, s)) {
      if (p.vx > 0) p.x = s.x - p.w;
      else if (p.vx < 0) p.x = s.x + s.w;
      p.vx = 0;
    }
  }
  // Y 轴
  p.y += p.vy * DT;
  p.onGround = false;
  for (const s of platforms) {
    if (rectHit(p, s)) {
      if (p.vy > 0) { p.y = s.y - p.h; p.onGround = true; }
      else if (p.vy < 0) p.y = s.y + s.h;
      p.vy = 0;
    }
  }
}

/** 操作层：录制/重放/换位（输入事件的语义化入口；返回事件数组） */
export function actions(game, input) {
  const ev = [];
  const st = game.state;
  game.slots.forEach((slot, i) => {
    if (input.recordStart === slot.id && !slot.recActive && !slot.blueprint) {
      slot.recActive = true;
      slot.samples = [snapshot(st.player)];
      ev.push({ type: 'record.start', slot: slot.id });
    }
    if (input.recordStop === slot.id && slot.recActive) {
      slot.recActive = false;
      if (slot.samples.length > 1) {
        slot.blueprint = { length: slot.samples.length, samples: slot.samples };
        ev.push({ type: 'blueprint.ready', slot: slot.id, ticks: slot.samples.length });
      } else {
        ev.push({ type: 'record.short', slot: slot.id });
      }
    }
    if (input.summon === slot.id) {
      if (slot.blueprint && slot.uses > 0 && !st.echoes[i].active) {
        slot.uses -= 1;
        slot.echo = { t: 0 };
        st.echoes[i].active = true;
        st.echoes[i].done = false;
        // 召唤即呈现首帧（残影从录制起点瞬时出现）
        st.echoes[i].x = slot.blueprint.samples[0].x;
        st.echoes[i].y = slot.blueprint.samples[0].y;
        ev.push({ type: 'echo.summon', slot: slot.id, usesLeft: slot.uses });
      } else {
        ev.push({ type: 'echo.denied', slot: slot.id,
                  reason: !slot.blueprint ? 'no-blueprint' : slot.uses <= 0 ? 'no-uses' : 'busy' });
      }
    }
    if (input.swap === slot.id) {
      const e = st.echoes[i];
      if (e.active) {
        const px = st.player.x, py = st.player.y, pvx = st.player.vx, pvy = st.player.vy;
        st.player.x = e.x; st.player.y = e.y; st.player.vx = e.vx; st.player.vy = e.vy;
        e.x = px; e.y = py; e.vx = pvx; e.vy = pvy;
        ev.push({ type: 'swap', slot: slot.id });
      } else {
        ev.push({ type: 'swap.denied', slot: slot.id, reason: 'inactive' });
      }
    }
  });
  game.events = ev; // 操作事件并入游戏事件流（与 tick 同语义）
  st.log.push(...ev);
  if (st.log.length > 512) st.log.splice(0, st.log.length - 512);
  return ev;
}
