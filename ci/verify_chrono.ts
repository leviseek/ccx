// 时之三重奏 · 全链验证（CI 入口：机制测试 + 关卡校验 + 解法回放 + 站点构建/产物）
// 用法：node ci/verify_chrono.ts [--json]
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLevel } from '../packages/game-chrono/src/chrono_engine.ts';
import { CHAPTERS, levelById } from '../packages/game-chrono/src/levels.ts';
import { runPlan, SOLVERS } from '../packages/game-chrono/src/solvers.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsonMode = process.argv.includes('--json');
const checks: { name: string; ok: boolean; detail: string }[] = [];
function report(name: string, ok: boolean, detail: string) { checks.push({ name, ok, detail }); }
function run(label: string, fn: () => string | boolean): void {
  try { const d = fn(); report(label, d !== false, String(d)); }
  catch (e) { report(label, false, e instanceof Error ? e.message : String(e)); }
}

// 1) Node 机制测试（3 文件）
run('node 机制测试', () => {
  execFileSync(process.execPath, [
    '--test', '--test-timeout=20000', '--test-force-exit',
    'packages/game-chrono/test/chrono_engine.test.ts',
    'packages/game-chrono/test/sprites_levels.test.ts',
    'packages/game-chrono/test/runtime.test.ts',
  ], { cwd: root, stdio: 'pipe' });
  return true;
});

// 2) 12 关结构/引用校验
run('12 关 ccx.chrono/1 校验', () => {
  const levels = CHAPTERS[0].levels;
  for (const lv of levels) {
    const v = validateLevel(lv);
    if (!v.ok) throw new Error(lv.name + ': ' + v.errors.join('; '));
  }
  return levels.length;
});

// 3) 解法回放
run('解法回放（1-1/1-2/1-3/1-8）', () => {
  const results: string[] = [];
  for (const name of Object.keys(SOLVERS)) {
    const lv = levelById(name);
    if (!lv) throw new Error('solver 关卡不存在: ' + name);
    const r = runPlan(lv, SOLVERS[name]);
    if (!r.win) throw new Error(name + ' 未通关（ticks=' + r.ticks + '）');
    results.push(name + ' win@' + r.ticks + 't c' + r.collected);
  }
  return results.join(' | ');
});

// 4) 站点构建 + 产物校验
run('Web 站点构建', () => {
  execFileSync(process.execPath, ['packages/game-chrono/scripts/build_site.mjs'], { cwd: root, stdio: 'pipe' });
  return true;
});
run('站点产物（assets/levels/index/运行时 ESM）', () => {
  const site = join(root, 'site', 'chrono');
  const assets = JSON.parse(readFileSync(join(site, 'assets.json'), 'utf8'));
  if (assets.schema !== 'ccx.assets.index/1' || assets.assets.length !== 8) throw new Error('assets 索引异常');
  const lv = JSON.parse(readFileSync(join(site, 'levels.json'), 'utf8'));
  if (lv.schema !== 'ccx.levels.index/1' || lv.levels.length !== 12) throw new Error('关卡索引异常');
  const html = readFileSync(join(site, 'index.html'), 'utf8');
  if (!html.includes('ccx-canvas') || !html.includes('game.js')) throw new Error('index.html 缺 canvas/入口');
  const main = readFileSync(join(site, 'runtime', 'main.js'), 'utf8');
  if (!/import .+ from .*chrono_engine/.test(main)) throw new Error('main.js 非 ESM/导入链断');
  const engine = readFileSync(join(site, 'chrono_engine.js'), 'utf8');
  if (!/export /.test(engine)) throw new Error('engine 非 ESM');
  if (!existsSync(join(site, 'assets', 'player.png'))) throw new Error('精灵 PNG 缺失');
  return '8 PNG + 12 关 + ESM 运行时';
});

const allPassed = checks.every((c) => c.ok);
if (jsonMode) {
  console.log(JSON.stringify({ allPassed, checks }, null, 2));
} else {
  let txt = '[verify_chrono] ' + (allPassed ? 'ALL PASSED' : 'FAILED');
  for (const c of checks) {
    txt += ' | ' + (c.ok ? 'OK' : 'FAIL') + ':' + c.name + (c.detail ? '(' + c.detail + ')' : '');
  }
  console.log(txt);
}
if (!allPassed) process.exitCode = 1;
