// 时之三重奏 · 浏览器入口/主循环（HTML 静态站点 game.js 的加载入口）
// 流程：URL ?level=1-N 选关 -> createGame -> 30Hz 固定步 -> canvas 渲染 -> 事件处理
import { createGame, actions } from '../chrono_engine.js';
import { CHAPTERS } from '../levels.js';
import { sceneDrawLists, hudData } from './scene_draw.js';
import { createRenderer } from './renderer.js';
import { createInput } from './input.js';

const levels = CHAPTERS[0].levels;
const params = new URLSearchParams(location.search);
const q = parseInt((params.get('level') ?? '1-1').split('-')[1] ?? '1', 10) || 1;
let levelIndex = Math.min(Math.max(q, 1), levels.length) - 1;

const canvas = document.getElementById('ccx-canvas')                     ;
const overlay = document.getElementById('ccx-overlay')                  ;
const statsEl = document.getElementById('ccx-stats')                  ;
const renderer = createRenderer(canvas);
const input = createInput(window);

let game = createGame(levels[levelIndex]);
let level = levels[levelIndex];

function load(i        )       {
  levelIndex = Math.min(Math.max(i, 0), levels.length - 1);
  level = levels[levelIndex];
  game = createGame(level);
  overlay.classList.add('hidden');
  statsEl.textContent = '';
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
  overlay.classList.remove('hidden');
  (overlay.querySelector('.ccx-win-title')                  ).textContent = '通关！' + level.name;
  (overlay.querySelector('.ccx-win-stats')                  ).textContent =
    '用时 ' + (winStats.ticks / 30).toFixed(1) + 's · 碎片 ' +
    winStats.collected + '/' + winStats.total + ' · 残影余量 ' + winStats.usesLeft;
}

document.getElementById('ccx-next') .addEventListener('click', () => load(levelIndex + 1));
document.getElementById('ccx-retry') .addEventListener('click', () => load(levelIndex));
document.getElementById('ccx-prev') .addEventListener('click', () => load(levelIndex - 1));

function frame(now        )       {
  const dt = (now - last) / 1000;
  last = now;
  acc += dt;
  const { input: inp, acts } = input.sample(level);
  for (const a of acts) {
    const slot = a.slot;
    const s = game.slots.find((x) => x.id === slot);
    if (!s) continue;
    if (a.action === 'record') {
      if (s.recActive) actions(game, { recordStop: slot });
      else actions(game, { recordStart: slot });
    } else if (a.action === 'summon') actions(game, { summon: slot });
    else if (a.action === 'swap') actions(game, { swap: slot });
  }
  let steps = 0;
  while (acc >= STEP && steps < 4) {
    acc -= STEP;
    steps += 1;
    game.tick(inp);
    if (game.state.won && !winStats) showWin();
  }
  if (acc > STEP * 4) acc = 0;
  renderer.draw(sceneDrawLists(game.state, level), hudData(game.state, level, game));
  requestAnimationFrame(frame);
}

document.addEventListener('DOMContentLoaded', () => {
  load(levelIndex);
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
});
