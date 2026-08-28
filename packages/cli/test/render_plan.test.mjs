import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname as pathDirname } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderPlan } from '../../scene-service/src/render_plan.mjs';

const cli = join(import.meta.dirname, '..', 'bin', 'ccx.mjs');
const fixture = join(import.meta.dirname, '..', '..', '..', 'examples', 'scenes', 'render_plan.scene.json');

test('renderPlan：fixture -> 3 批（与服务/引擎同语义）', () => {
  const json = JSON.parse(readFileSync(fixture, 'utf8'));
  const plan = renderPlan(json);
  assert.equal(plan.sprites, 5);
  assert.equal(plan.batches.length, 3);
  assert.deepEqual(
    plan.batches.map((b) => [b.atlas, b.material, b.count]),
    [[1, 1, 2], [2, 1, 1], [1, 1, 2]]);
  // 顺序：bg 层（alpha,beta,gamma）在 fg 层（delta,epsilon）之前
  const iAlpha = plan.order.indexOf('alpha');
  const iGamma = plan.order.indexOf('gamma');
  const iDelta = plan.order.indexOf('delta');
  assert.ok(iAlpha < iGamma && iGamma < iDelta, '层内/层间顺序');
});

test('ccx render plan --out：产物落盘', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-plan-out-'));
  try {
    const out = join(dir, 'plan.json');
    const r = spawnSync(process.execPath,
                        [cli, 'render', 'plan', fixture, '--out', out, '--json'],
                        { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(out), '计划文件已写');
    const planFile = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(planFile.schema, 'ccx.renderplan/1');
    assert.equal(planFile.sprites, 5);
    assert.equal(planFile.batches.length, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx render plan：CLI 冒烟（新建场景 -> 命令添加精灵 -> 计划）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-plan-'));
  try {
    const file = join(dir, 's.scene.json');
    writeFileSync(file, JSON.stringify({
      schema: 'ccx.scene/1',
      meta: {},
      entities: [
        { id: 1, name: 'root', parent: null, components: [] },
        { id: 2, name: 's1', parent: 1, components: [
          { type: 'ccx.Sprite', data: { atlas: 4, material: 2 } },
        ] },
        { id: 3, name: 's2', parent: 1, components: [
          { type: 'ccx.Sprite', data: { atlas: 4, material: 2 } },
        ] },
      ],
      systems: [],
    }));
    const r = spawnSync(process.execPath, [cli, 'render', 'plan', file, '--json'],
                        { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.ok, true);
    assert.equal(out.sprites, 2);
    assert.equal(out.batches.length, 1);
    assert.equal(out.batches[0].count, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
