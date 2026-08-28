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

test('frame_dump --device：设备路径像素与普通路径一致', async (t) => {
  if (!existsSync(dumpExe)) {
    t.skip('未构建 ccx_frame_dump');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'ccx-dev-'));
  try {
    const sceneFile = join(dir, 's.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1', meta: {}, systems: [],
      entities: [
        { id: 1, name: 'hero', parent: null,
          components: [{ type: 'ccx.Sprite', data: { atlas: 1, material: 1 } }] },
        { id: 2, name: 'coin', parent: null,
          components: [
            { type: 'ccx.Transform', data: { position: [48, 0] } },
            { type: 'ccx.Sprite', data: { atlas: 2, material: 1 } },
          ] },
      ],
    }));
    const ppmP = join(dir, 'plain.ppm');
    const ppmD = join(dir, 'device.ppm');
    const rp = spawnSync(dumpExe, [sceneFile, ppmP, '160', '90', '0'], { encoding: 'utf8' });
    const rd = spawnSync(dumpExe, [sceneFile, ppmD, '160', '90', '0', '', '', '1'],
                         { encoding: 'utf8' });
    assert.equal(rp.status, 0, rp.stderr);
    assert.equal(rd.status, 0, rd.stderr);
    const a = readFileSync(ppmP);
    const b = readFileSync(ppmD);
    assert.equal(a.length, b.length, '文件同长');
    assert.deepEqual(a, b, '设备路径像素 == 普通路径（黄金一致）');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
