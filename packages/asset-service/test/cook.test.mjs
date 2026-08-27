import test from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORM_MATRIX, cook, planCook } from '../src/cook.mjs';

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

test('cook：产物记录（真实压缩留 M2 worker）', () => {
  const a = cook({ uuid: 'tex-1', type: 'ccx.Texture', sourceFormat: 'png', sizeBytes: 2048 },
                  'ios');
  assert.equal(a.artifact.key, 'tex-1@ios');
  assert.equal(a.artifact.parts[0].format, 'astc4');
  assert.ok(a.artifact.parts.every((p) => ['texture', 'audio'].includes(p.kind)));
});
