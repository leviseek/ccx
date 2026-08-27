import test from 'node:test';
import assert from 'node:assert/strict';
import { registerBuilder, getBuilder, listBuilders } from '../src/builder_registry.mjs';
import { createBundleManifest, contentHash } from '../src/bundle.mjs';
import { runBuild } from '../src/pipeline.mjs';

test('builder 注册/查询/重复注册拒绝', () => {
  assert.equal(listBuilders().length, 0);
  registerBuilder({
    platform: 'web-desktop',
    displayName: 'Web Desktop',
    hooks: { onAfterInit: () => ({ ok: true }) },
  });
  assert.equal(getBuilder('web-desktop').displayName, 'Web Desktop');
  assert.equal(getBuilder('android'), null);
  assert.throws(() => registerBuilder({ platform: 'web-desktop' }), /已注册|already/);
  assert.throws(() => registerBuilder({}), /platform/);
  assert.equal(listBuilders().length, 1);
});

test('bundle 清单：结构 + 确定性哈希', () => {
  const m1 = createBundleManifest({
    project: 'MyGame',
    platform: 'minigame-wechat',
    assets: [{ uuid: 'a-1', path: 'assets/hero.png' }],
    scripts: [{ name: 'main', code: 'Game.main();' }],
    config: { orientation: 'landscape' },
  });
  assert.equal(m1.schema, 'ccx.bundle/1');
  assert.equal(m1.buildId, 'MyGame@minigame-wechat');
  assert.equal(m1.entries.assets[0].hash.length, 40, 'sha1 40 hex');
  const m2 = createBundleManifest({ project: 'MyGame', platform: 'minigame-wechat',
    assets: [{ uuid: 'a-1', path: 'assets/hero.png' }],
    scripts: [{ name: 'main', code: 'Game.main();' }] });
  assert.equal(m1.entries.assets[0].hash, m2.entries.assets[0].hash, '确定性');
  assert.notEqual(contentHash('a'), contentHash('b'));
});

test('runBuild：hooks 顺序 + 错误中断', async () => {
  const order = [];
  const mk = (name) => () => { order.push(name); return { ok: true }; };
  const builder = {
    platform: 'android',
    hooks: {
      onBeforeInit: mk('onBeforeInit'),
      onAfterInit: mk('onAfterInit'),
      onBeforeBundle: mk('onBeforeBundle'),
      onAfterBundle: mk('onAfterBundle'),
      onAfterBuild: mk('onAfterBuild'),
    },
  };
  const r = await runBuild(builder, { makeManifest: () => ({ ok: true }) });
  assert.equal(r.ok, true);
  assert.deepEqual(order, ['onBeforeInit', 'onAfterInit', 'onBeforeBundle', 'onAfterBundle', 'onAfterBuild']);

  const failBuilder = {
    platform: 'ios',
    hooks: {
      onBeforeInit: mk('onBeforeInit'),
      onAfterInit: () => ({ ok: false, error: 'no code sign cert' }),
    },
  };
  const f = await runBuild(failBuilder, { makeManifest: () => ({ ok: true }) });
  assert.equal(f.ok, false);
  const errPhase = f.trace.find((t) => t.status === 'error');
  assert.equal(errPhase.name, 'onAfterInit');
  assert.ok(errPhase.error.includes('cert'));
});
