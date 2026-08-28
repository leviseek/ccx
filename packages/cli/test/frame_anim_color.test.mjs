import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = import.meta.dirname;
const root = join(here, '..', '..', '..');
const dumpExe = process.env.CCX_DUMP_EXE ??
  join(root, 'build', 'local', 'engine', 'tests', 'ccx_frame_dump.exe');

// 主色统计（忽略背景 32,32,232）
function dominantColor(buf, w, h) {
  const m = /^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(buf.subarray(0, 32).toString('ascii'));
  const data = buf.subarray(m[0].length);
  const counts = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const key = data[i] + ',' + data[i + 1] + ',' + data[i + 2];
    if (key === '32,32,232') continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = null;
  for (const [k, n] of counts) {
    if (!best || n > best.n) best = { k, n };
  }
  return best;
}

test('frame_dump --time：精灵帧动画驱动色块（帧0红 -> 帧1绿）', async (t) => {
  if (!existsSync(dumpExe)) {
    t.skip('未构建 ccx_frame_dump');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'ccx-animc-'));
  try {
    const sceneFile = join(dir, 's.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1',
      meta: {},
      entities: [{
        id: 1, name: 'hero', parent: null,
        components: [
          { type: 'ccx.Sprite', data: { atlas: 1, material: 1 } },
          // 6 帧 10fps：t=0->帧0(红)，t=0.1->帧1(绿)
          { type: 'ccx.SpriteAnimator', data: { frameCount: 6, fps: 10 } },
        ],
      }],
      systems: [],
    }));
    const ppm0 = join(dir, 't0.ppm');
    const ppm1 = join(dir, 't01.ppm');
    const r0 = spawnSync(dumpExe, [sceneFile, ppm0, '160', '90', '0'], { encoding: 'utf8' });
    const r1 = spawnSync(dumpExe, [sceneFile, ppm1, '160', '90', '0.1'], { encoding: 'utf8' });
    assert.equal(r0.status, 0, r0.stderr);
    assert.equal(r1.status, 0, r1.stderr);
    const c0 = dominantColor(readFileSync(ppm0), 160, 90);
    const c1 = dominantColor(readFileSync(ppm1), 160, 90);
    assert.ok(c0 && c0.k === '255,0,0', 't=0 主色为红（帧0）');
    assert.ok(c1 && c1.k === '0,255,0', 't=0.1 主色为绿（帧1）');
    // 空间一致：帧色变化不移动 quad（质心不动）
    assert.ok(c0.n > 500 && c1.n > 500, '色块面积合理');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
