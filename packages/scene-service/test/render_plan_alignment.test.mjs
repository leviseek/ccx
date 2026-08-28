import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderPlan } from '../src/render_plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const fixture = join(root, 'examples', 'scenes', 'render_plan.scene.json');
const dumpExe = process.env.CCX_DUMP_EXE ??
  join(root, 'build', 'local', 'engine', 'tests', 'ccx_render_plan_dump.exe');

test('跨语言对拍：C++ 渲染计划 == Node 渲染计划（同一 fixture）', async (t) => {
  if (!existsSync(dumpExe)) {
    t.skip('未构建 C++ dump 工具（先运行 cmake --build build/local）');
    return;
  }
  const r = spawnSync(dumpExe, [fixture], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const cpp = JSON.parse(r.stdout.trim());
  const node = renderPlan(JSON.parse(
    await import('node:fs').then((fs) => fs.promises.readFile(fixture, 'utf8'))));
  assert.equal(cpp.sprites, node.sprites, 'sprites 数一致');
  assert.deepEqual(cpp.batches, node.batches, '批次结构与顺序逐项一致');
});
