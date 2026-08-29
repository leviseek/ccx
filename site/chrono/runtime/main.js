// 时之三重奏 · 浏览器入口/主循环（HTML 静态站点 game.js 的加载入口）
// 流程：URL ?level=1-N 选关 -> createGame -> 30Hz 固定步 -> canvas 渲染 -> 事件处理
import { createGame, actions } from '../chrono_engine.js';
import { CHAPTERS } from '../levels.js';
import { sceneDrawLists, hudData } from './scene_draw.js';
import { createRenderer } from './renderer.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createWebBridge } from '../../platform-web/src/web_bridge.js';
import { createEngineRenderer } from './wasm_render.js';
import { starRating, runResultOf } from '../metrics.js';

const levels = CHAPTERS[0].levels;
const params = new URLSearchParams(location.search);
const q = parseInt((params.get('level') ?? '1-1').split('-')[1] ?? '1', 10) || 1;
let levelIndex = Math.min(Math.max(q, 1), levels.length) - 1;

const canvas = document.getElementById('ccx-canvas')                     ;
const overlay = document.getElementById('ccx-overlay')                  ;
const statsEl = document.getElementById('ccx-stats')                  ;
const renderer = createRenderer(canvas);
// 平台桥（platform-spec §2：显示/输入/渠道 统一由桥接层提供；游戏不直接触碰 DOM/window 适配细节）
const bridge = createWebBridge({ canvas, target: window, baseW: VIEW_TILES_X * TILE, baseH: VIEW_TILES_Y * TILE });
const input = createInput(bridge);
const channel = bridge.channel;
// 引擎渲染（wasm 软件光栅，渐进增强：加载失败回退 JS 精灵渲染）
void createEngineRenderer().then((engine) => { if (engine.ready) renderer.setEngine(engine); });

// 屏幕适配（桥接层策略）：游戏只请求视口应用；DPR/整数倍缩放由 platform-web 实现
function fitToView()       {
  const vp = bridge.display.applyViewport();
  renderer.setView(vp.logicalW, vp.logicalH, bridge.display.dpr);
}
bridge.display.onResize(fitToView);
const audio = createAudio();
let paused = false;
let lastLogLen = 0;
let pendingJumpSound = 0;

let game = createGame(levels[levelIndex]);
let level = levels[levelIndex];

function load(i        )       {
  levelIndex = Math.min(Math.max(i, 0), levels.length - 1);
  level = levels[levelIndex];
  game = createGame(level);
  overlay.classList.add('hidden');
  statsEl.textContent = '';
  paused = false;
  lastLogLen = 0;
  pendingJumpSound = 0;
}

const STEP = 1 / 30;
let acc = 0;
let last = performance.now();
let winStats                                                                               = null;

function showWin()       {
  winStats = {
    ticks: game.state.tick,
    collected: game.state.collected.size,
    total: (level.collectibles ?? []).length,
    usesLeft: game.slots.map((s) => s.uses).join('/'),
  };
  audio.sfx.win();
  const rating = starRating(level, runResultOf(level, game.state.tick, game.state.collected, game.slots.map((s) => s.uses)));
  const stars = '★'.repeat(rating.stars) + '☆'.repeat(3 - rating.stars);
  overlay.classList.remove('hidden');
  (overlay.querySelector('.ccx-win-title')                  ).textContent = '通关！' + level.name + '  ' + stars;
  (overlay.querySelector('.ccx-win-stats')                  ).textContent =
    '用时 ' + (rating.parTicks / 30).toFixed(1) + 's 参考 / 实际 ' + (winStats.ticks / 30).toFixed(1) +
    's · 碎片 ' + winStats.collected + '/' + winStats.total +
    ' · 残影余量 ' + winStats.usesLeft + ' · ' + rating.reasons.join(' / ');
  const shareBtn = document.getElementById('ccx-share')                            ;
  if (shareBtn) {
    shareBtn.style.display = channel.caps.share ? 'inline-block' : 'none';
  }
}

function togglePause()       {
  paused = !paused;
  const p = document.getElementById('ccx-pause-hint');
  if (p) p.textContent = paused ? '已暂停（P 继续）' : '';
}

document.getElementById('ccx-next') .addEventListener('click', () => load(levelIndex + 1));
document.getElementById('ccx-retry') .addEventListener('click', () => load(levelIndex));
document.getElementById('ccx-prev') .addEventListener('click', () => load(levelIndex - 1));
document.getElementById('ccx-share')?.addEventListener('click', () => {
  channel.share({ title: '时之三重奏 · 我通关了 ' + level.name + '（' + (starRating(level, runResultOf(level, game.state.tick, game.state.collected, game.slots.map((s) => s.uses))).stars) + '★）' });
});

function frame(now        )       {
  const dt = (now - last) / 1000;
  last = now;
  acc += dt;
  const { input: inp, acts } = input.sample(level);
  for (const a of acts) {
    if (a.action === 'pause') { togglePause(); continue; }
    const slot = a.slot;
    const s = game.slots.find((x) => x.id === slot);
    if (!s) continue;
    if (a.action === 'record') {
      if (s.recActive) actions(game, { recordStop: slot });
      else actions(game, { recordStart: slot });
    } else if (a.action === 'summon') actions(game, { summon: slot });
    else if (a.action === 'swap') actions(game, { swap: slot });
  }
  if (!paused) {
    let steps = 0;
    while (acc >= STEP && steps < 4) {
      acc -= STEP;
      steps += 1;
      if (inp.jump && game.state.player.onGround) pendingJumpSound += 1;
      game.tick(inp);
      // 事件音效（增量日志，幂等）
      const log = game.state.log;
      for (let i = lastLogLen; i < log.length; i++) {
        const t = log[i].type;
        if (t === 'collect') audio.sfx.collect();
        else if (t === 'door.open') audio.sfx.door();
        else if (t === 'echo.summon') audio.sfx.summon();
        else if (t === 'swap') audio.sfx.swap();
        else if (t === 'echo.denied') audio.sfx.deny();
      }
      lastLogLen = log.length;
      if (game.state.won && !winStats) showWin();
    }
    while (pendingJumpSound > 0) { audio.sfx.jump(); pendingJumpSound -= 1; }
    if (acc > STEP * 4) acc = 0;
  }
  renderer.draw(sceneDrawLists(game.state, level), hudData(game.state, level, game));
  requestAnimationFrame(frame);
}

document.addEventListener('DOMContentLoaded', () => {
  load(levelIndex);
  fitToView();
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
});
