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

// PPM P6 解析 -> 颜色计数
function parsePpm(buf) {
  const text = buf.subarray(0, 64).toString('ascii');
  const m = /^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(text);
  assert.ok(m, 'P6 头: ' + text.slice(0, 32));
  const w = Number(m[1]);
  const h = Number(m[2]);
  const max = Number(m[3]);
  const headerLen = m[0].length;
  assert.equal(max, 255);
  const data = buf.subarray(headerLen);
  assert.equal(data.length, w * h * 3, '像素数据完整');
  const counts = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const key = data[i] + ',' + data[i + 1] + ',' + data[i + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { w, h, counts };
}

test('frame_dump：虚拟帧落盘 PPM（红 quad + 金 quad 像素存在）', async (t) => {
  if (!existsSync(dumpExe)) {
    t.skip('未构建 ccx_frame_dump（先 cmake --build build/local）');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'ccx-frame-'));
  try {
    // 双精灵场景（atlas 1=红, 2=金，位于世界原点两侧）
    const sceneFile = join(dir, 'scene.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1',
      meta: {},
      entities: [
        { id: 1, name: 'hero', parent: null,
          components: [{ type: 'ccx.Sprite', data: { atlas: 1, material: 1 } }] },
        { id: 2, name: 'coin', parent: null,
          components: [
            { type: 'ccx.Transform', data: { position: [96, 0] } },
            { type: 'ccx.Sprite', data: { atlas: 2, material: 1 } },
          ] },
      ],
      systems: [],
    }));
    const ppm = join(dir, 'frame.ppm');
    const r = spawnSync(dumpExe, [sceneFile, ppm, '320', '180'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const meta = JSON.parse(r.stdout.trim());
    assert.equal(meta.quads, 2);
    assert.equal(meta.width, 320);
    assert.ok(existsSync(ppm), 'PPM 落盘');
    const { w, h, counts } = parsePpm(readFileSync(ppm));
    assert.equal(w, 320);
    assert.equal(h, 180);
    assert.ok((counts.get('255,0,0') ?? 0) > 0, '红 quad 像素存在');
    assert.ok((counts.get('255,214,0') ?? 0) > 0, '金 quad 像素存在（0.84*255=214）');
    // 背景深蓝 (#2020E8) 存在
    assert.ok((counts.get('32,32,232') ?? 0) > 0, '背景像素存在');
    // 两 quad 覆盖区域（世界 (0,0) 与 (64,0) 附近 -> 屏幕中心区）
    const red = counts.get('255,0,0') ?? 0;
    const gold = counts.get('255,214,0') ?? 0;
    assert.ok(red > 500, '红面积合理（约 64x64=4096）');
    assert.ok(gold > 500, '金面积合理');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
