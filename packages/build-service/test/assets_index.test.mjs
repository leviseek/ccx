import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAssetsIndex } from '../src/assets_index.mjs';

test('parseAssetsIndex：正常/损坏/条目校验', () => {
  const ok = parseAssetsIndex(JSON.stringify({
    schema: 'ccx.assets.index/1',
    platform: 'web-desktop',
    assets: [{ uuid: 'a-1', path: 'assets/hero.png', hash: 'x' }],
  }));
  assert.equal(ok.platform, 'web-desktop');
  assert.equal(ok.assets.length, 1);
  assert.throws(() => parseAssetsIndex('{bad'), /JSON/);
  assert.throws(() => parseAssetsIndex(JSON.stringify({ platform: 'x', assets: [] })), /schema/);
  assert.throws(() => parseAssetsIndex(JSON.stringify({
    schema: 'ccx.assets.index/1', platform: '', assets: [] })), /platform/);
  assert.throws(() => parseAssetsIndex(JSON.stringify({
    schema: 'ccx.assets.index/1', platform: 'p', assets: [{ uuid: 'a' }] })), /uuid\+path/);
});
