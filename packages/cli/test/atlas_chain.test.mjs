import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderPlan } from '../../scene-service/src/render_plan.mjs';

const cli = join(import.meta.dirname, '..', 'bin', 'ccx.mjs');

// 最小合法 PNG（签名 + IHDR），供 parsePng 通过
function mkPng(width, height) {
  const buf = Buffer.alloc(32);
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].forEach((b, i) => { buf[i] = b; });
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8;
  buf[25] = 6;
  return buf;
}

test('闭环：png 目录 -> atlas pack -> scene atlas -> render plan', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-e2e-atlas-'));
  try {
    const assetsDir = join(dir, 'assets');
    mkdirSync(assetsDir);
    writeFileSync(join(assetsDir, 'hero.png'), mkPng(64, 64));
    writeFileSync(join(assetsDir, 'coin.png'), mkPng(32, 32));
    writeFileSync(join(assetsDir, 'enemy.png'), mkPng(64, 48));
    writeFileSync(join(assetsDir, 'ignored.txt'), 'x');

    // 1) atlas pack
    const atlasJson = join(dir, 'atlas.json');
    const r1 = spawnSync(process.execPath,
                         [cli, 'atlas', 'pack', '--root', assetsDir, '--out', atlasJson],
                         { encoding: 'utf8' });
    assert.equal(r1.status, 0, r1.err + r1.out);
    const atlas = JSON.parse(readFileSync(atlasJson, 'utf8'));
    assert.equal(atlas.schema, 'ccx.atlas/1');
    assert.equal(atlas.items.length, 3, '3 个 png 打包');
    assert.ok(atlas.items.every((it) => it.w > 0 && it.h > 0), '尺寸解析自 PNG 头');

    // 2) scene atlas
    const sceneJson = join(dir, 'scene.json');
    const r2 = spawnSync(process.execPath,
                         [cli, 'scene', 'atlas', atlasJson, '--out', sceneJson],
                         { encoding: 'utf8' });
    assert.equal(r2.status, 0, r2.err + r2.out);
    const scene = JSON.parse(readFileSync(sceneJson, 'utf8'));
    assert.equal(scene.entities.length, 3, '每图集项一个精灵实体');

    // 3) render plan（服务侧视图）
    const plan = renderPlan(scene);
    assert.equal(plan.sprites, 3);
    assert.equal(plan.batches.length, 1, '同图集同材质 -> 1 批');
    assert.equal(plan.batches[0].count, 3);
    // 命名顺序与图集项一致（hero/coin/enemy 的树序）
    const names = plan.order.filter((n) => n !== undefined);
    assert.ok(names.includes('hero') && names.includes('coin') && names.includes('enemy'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
