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

// 红像素质心
function redCentroid(buf, w, h) {
  const headerLen = 15;  // "P6\n320 180\n255\n" 固定 15 字节
  const data = buf.subarray(headerLen);
  let sx = 0, n = 0;
  for (let y = 0; y < h; ++y) {
    for (let x = 0; x < w; ++x) {
      const i = (y * w + x) * 3;
      if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 0) {
        sx += x;
        n += 1;
      }
    }
  }
  return n > 0 ? { cx: sx / n, n } : null;
}

test('frame_dump --time：曲线动画驱动两帧像素位移', async (t) => {
  if (!existsSync(dumpExe)) {
    t.skip('未构建 ccx_frame_dump');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'ccx-fdiff-'));
  try {
    const sceneFile = join(dir, 'scene.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1',
      meta: {},
      entities: [{
        id: 1, name: 'hero', parent: null,
        components: [
          { type: 'ccx.Sprite', data: { atlas: 1, material: 1 } },
          // 线性曲线：2 秒内 pos.x 0 -> 128（留视口内：相机 ±160））
          { type: 'ccx.CurveAnim', data: { t0: 0, v0: 0, t1: 2, v1: 128 } },
        ],
      }],
      systems: [],
    }));
    const ppm0 = join(dir, 't0.ppm');
    const ppm2 = join(dir, 't2.ppm');
    const r0 = spawnSync(dumpExe, [sceneFile, ppm0, '320', '180', '0'], { encoding: 'utf8' });
    const r2 = spawnSync(dumpExe, [sceneFile, ppm2, '320', '180', '2'], { encoding: 'utf8' });
    assert.equal(r0.status, 0, r0.stderr);
    assert.equal(r2.status, 0, r2.stderr);
    const c0 = redCentroid(readFileSync(ppm0), 320, 180);
    const c2 = redCentroid(readFileSync(ppm2), 320, 180);
    assert.ok(c0 && c2, '两帧都有红像素质心');
    // 世界尺度：320px 视口 = 320 世界单位 -> 128 单位 = 128px 位移
    assert.ok(Math.abs(c2.cx - c0.cx) > 100, '质心位移 > 100px（' + c0.cx + ' -> ' + c2.cx + ')');
    assert.ok(c0.n > 500 && c2.n > 500, '两帧红面积一致');
    // t=1 中点：位移约 128px（可选精简；断言 t2>t1>t0）
    const ppm1 = join(dir, 't1.ppm');
    const r1 = spawnSync(dumpExe, [sceneFile, ppm1, '320', '180', '1'], { encoding: 'utf8' });
    assert.equal(r1.status, 0);
    const c1 = redCentroid(readFileSync(ppm1), 320, 180);
    assert.ok(c1 && c0.cx < c1.cx && c1.cx < c2.cx, '单调位移（' +
              c0.cx.toFixed(1) + ' < ' + c1.cx.toFixed(1) + ' < ' + c2.cx.toFixed(1) + '）');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
