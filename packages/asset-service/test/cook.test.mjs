import test from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORM_MATRIX, compressTexture, cook, planCook } from '../src/cook.mjs';

test('PLATFORM_MATRIX：2D 平台纹理/音频目标（renderer-spec §2.3/asset-spec §4）', () => {
  assert.equal(PLATFORM_MATRIX['web-desktop'].texture, 'png');
  assert.equal(PLATFORM_MATRIX.android.texture, 'astc4');
  assert.equal(PLATFORM_MATRIX['minigame-wechat'].texture, 'etc2');
  assert.equal(PLATFORM_MATRIX.windows.texture, 'bc7');
  assert.equal(PLATFORM_MATRIX.ios.audio, 'aac');
});

test('planCook：目标矩阵推导', () => {
  const plan = planCook({ uuid: 'tex-1', type: 'ccx.Texture', sourceFormat: 'png' }, 'android');
  assert.equal(plan.platform, 'android');
  assert.equal(plan.targets[0].format, 'astc4');
  assert.equal(plan.targets[1].kind, 'audio');
  assert.throws(() => planCook({ uuid: 'x' }, 'ps5'), /未知平台/);
});


test('compressor 接口：注册 + 调用 + 未注册报错', async () => {
  const { registerCompressor, compressTexture, cookWithCompression } = await import('../src/cook.mjs');
  let called = null;
  registerCompressor('astc4', async (intermediate, format) => {
    called = { uuid: intermediate.uuid, format };
    return { ok: true, bytes: 512 };
  });
  const r = await compressTexture({ uuid: 't1', sourceFormat: 'png' }, 'astc4');
  assert.equal(r.ok, true);
  assert.equal(r.bytes, 512);
  assert.equal(called.uuid, 't1');
  const missing = await compressTexture({ uuid: 't1' }, 'bc7');
  assert.equal(missing.ok, false);
  assert.ok(missing.error.includes('bc7'));
  const full = await cookWithCompression({ uuid: 't1', sourceFormat: 'png' }, 'android');
  const tex = full.artifact.parts.find((x) => x.kind === 'texture');
  assert.equal(tex.ok, true);
  assert.equal(tex.bytes, 512);
});


test('外部压缩器：spawn 接入（W4 形态）', async () => {
  const { externalCompressor, cookWithCompression, registerCompressor } = await import('../src/cook.mjs');
  const { writeFileSync, mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'ccx-extc-'));
  try {
    const src = join(dir, 'hero.png');
    writeFileSync(src, 'PNG-DATA');
    const compressor = externalCompressor({
      cmd: process.execPath,
      args: [join(import.meta.dirname, 'fixtures', 'fake_compressor.mjs'), '{src}'],
    });
    registerCompressor('png', compressor);
    const r = await compressTexture({ path: src, uuid: 't1' }, 'png');
    assert.equal(r.ok, true);
    assert.ok(r.bytes > 0, '外部产物字节上报');
    assert.ok(r.note.includes('external'), '标注外部来源');
    // 经 cook 全流
    const full = await cookWithCompression({ path: src, uuid: 't1', sourceFormat: 'png' }, 'web-desktop');
    const tex = full.artifact.parts.find((x) => x.kind === 'texture');
    assert.ok(tex.ok, '平台矩阵（png）走外挂压缩器');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cook：产物记录（真实压缩留 M2 worker）', () => {
  const a = cook({ uuid: 'tex-1', type: 'ccx.Texture', sourceFormat: 'png', sizeBytes: 2048 },
                  'ios');
  assert.equal(a.artifact.key, 'tex-1@ios');
  assert.equal(a.artifact.parts[0].format, 'astc4');
  assert.ok(a.artifact.parts.every((p) => ['texture', 'audio'].includes(p.kind)));
});
