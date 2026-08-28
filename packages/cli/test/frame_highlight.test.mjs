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

function countColor(buf, w, h, r, g, b) {
  const m = /^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(buf.subarray(0, 32).toString('ascii'));
  const data = buf.subarray(m[0].length);
  let n = 0;
  for (let i = 0; i < data.length; i += 3) {
    if (data[i] === r && data[i + 1] === g && data[i + 2] === b) ++n;
  }
  return n;
}

test('frame_dump --highlight：接触实体白块叠加', async (t) => {
  if (!existsSync(dumpExe)) {
    t.skip('未构建 ccx_frame_dump');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'ccx-hl-'));
  try {
    const sceneFile = join(dir, 's.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1', meta: {},
      entities: [
        { id: 1, name: 'hero', parent: null,
          components: [
            { type: 'ccx.Sprite', data: { atlas: 1, material: 1 } },
            { type: 'ccx.Collider', data: { hx: 30, hy: 30, layer: 1, mask: 2 } },
          ] },
        { id: 2, name: 'pillar', parent: null,
          components: [
            { type: 'ccx.Transform', data: { position: [80, 0] } },
            { type: 'ccx.Sprite', data: { atlas: 2, material: 1 } },
            { type: 'ccx.Collider', data: { hx: 30, hy: 30, layer: 2, mask: 3 } },
          ] },
      ],
      systems: [],
    }));
    const ppm0 = join(dir, 'plain.ppm');
    const ppm1 = join(dir, 'hl.ppm');
    const r0 = spawnSync(dumpExe, [sceneFile, ppm0, '160', '90', '0'], { encoding: 'utf8' });
    const r1 = spawnSync(dumpExe, [sceneFile, ppm1, '160', '90', '0', '1,2'],
                         { encoding: 'utf8' });
    assert.equal(r0.status, 0, r0.stderr);
    assert.equal(r1.status, 0, r1.stderr);
    const white0 = countColor(readFileSync(ppm0), 160, 90, 255, 255, 255);
    const white1 = countColor(readFileSync(ppm1), 160, 90, 255, 255, 255);
    assert.equal(white0, 0, '无高亮时无白块');
    assert.ok(white1 > 500, '高亮后白块存在（' + white1 + ' px）');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
