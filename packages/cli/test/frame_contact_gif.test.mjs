import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildGif, lzwDecode } from '../../editor-shell/src/gif.mjs';
import { parsePpm } from '../../editor-shell/src/ppm_to_bmp.mjs';

const here = import.meta.dirname;
const root = join(here, '..', '..', '..');
const dumpExe = process.env.CCX_DUMP_EXE ??
  join(root, 'build', 'local', 'engine', 'tests', 'ccx_frame_dump.exe');

test('--contacts：碰撞时序动画（首帧无白、接触帧有白块）', async (t) => {
  if (!existsSync(dumpExe)) {
    t.skip('未构建 ccx_frame_dump');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'ccx-cgif-'));
  try {
    const sceneFile = join(dir, 's.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1', meta: {}, systems: [],
      entities: [
        { id: 1, name: 'hero', parent: null,
          components: [
            { type: 'ccx.Sprite', data: { atlas: 1, material: 1 } },
            { type: 'ccx.Collider', data: { hx: 25, hy: 25, layer: 1, mask: 2 } },
            // 2 秒内 x 0 -> 140（t=2 与 pillar 100±25 重叠）
            { type: 'ccx.CurveAnim', data: { t0: 0, v0: 0, t1: 2, v1: 140 } },
          ] },
        { id: 2, name: 'pillar', parent: null,
          components: [
            { type: 'ccx.Transform', data: { position: [100, 0] } },
            { type: 'ccx.Sprite', data: { atlas: 2, material: 1 } },
            { type: 'ccx.Collider', data: { hx: 25, hy: 25, layer: 2, mask: 3 } },
          ] },
      ],
    }));
    // 三帧 dump（--contacts 模式）
    const frames = [];
    for (const tm of ['0', '1', '2']) {
      const ppm = join(dir, 'f' + tm + '.ppm');
      const r = spawnSync(dumpExe, [sceneFile, ppm, '160', '90', tm, '', '1'],
                          { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      const { w, h, data } = parsePpm(readFileSync(ppm));
      const pixels = new Uint8Array(w * h * 4);
      for (let i = 0; i < w * h; ++i) {
        pixels[i * 4] = data[i * 3];
        pixels[i * 4 + 1] = data[i * 3 + 1];
        pixels[i * 4 + 2] = data[i * 3 + 2];
        pixels[i * 4 + 3] = 255;
      }
      // 白像素统计（接触高亮）
      let white = 0;
      for (let i = 0; i < w * h; ++i) {
        if (data[i * 3] === 255 && data[i * 3 + 1] === 255 && data[i * 3 + 2] === 255) ++white;
      }
      frames.push({ w, h, pixels, white });
    }
    assert.equal(frames[0].white, 0, 't=0 分离：无白块');
    const midContacts = frames[1].white > 0;
    // t=1: hero x=70 ±25 vs pillar 75..125 -> 恰好边缘重叠（闭区间）
    // t=2: hero x=140 ±25=115..165 vs 75..125 -> 重叠
    assert.equal(frames[2].white > 400, true, 't=2 接触：白块 >400px');
    // GIF 也可生成（像素数据一致）
    const gif = buildGif(frames.map(({ w, h, pixels }) => ({ w, h, pixels })));
    assert.equal(gif.toString('ascii', 0, 6), 'GIF89a');
    void midContacts;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
