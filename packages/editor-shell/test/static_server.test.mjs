// 静态站点服务测试：路由/MIME/防护/目录回退（纯函数；listen 闭环由真环境验证）
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { routeFor, dirFingerprint } from '../src/static_server.mjs';

test('routeFor: 根/资产/JSON 的 MIME', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-static-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html>');
  writeFileSync(join(dir, 'game.js'), 'window.x=1');
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'assets', 't.png'), 'png-bytes');
  writeFileSync(join(dir, 'levels.json'), '{}');
  writeFileSync(join(dir, 'g.wasm'), 'wasm-bytes');
  try {
    assert.equal(routeFor('/', dir).ok, true);
    assert.ok(routeFor('/', dir).mime.includes('text/html'));
    const js = routeFor('/game.js', dir);
    assert.ok(js.mime.includes('javascript'));
    assert.ok(routeFor('/assets/t.png', dir).mime.includes('image/png'));
    assert.ok(routeFor('/levels.json', dir).mime.includes('application/json'));
    assert.ok(routeFor('/g.wasm', dir).mime.includes('application/wasm'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('routeFor: 目录回退 index.html / 越界 403 / 不存在 404', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-static2-'));
  writeFileSync(join(dir, 'index.html'), 'home');
  try {
    assert.equal(routeFor('/nope/', dir).status, 404);
    const esc = routeFor('/..%2F..%2FREADME.md', dir);
    assert.equal(esc.status, 403);
    assert.equal(routeFor('/missing.js', dir).status, 404);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('dirFingerprint: 内容变化 -> 指纹变化', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-static3-'));
  writeFileSync(join(dir, 'a.txt'), '1');
  const fp1 = dirFingerprint(dir);
  writeFileSync(join(dir, 'a.txt'), '2');
  const fp2 = dirFingerprint(dir);
  assert.notEqual(fp1, fp2, '修改触发指纹变化');
  rmSync(dir, { recursive: true, force: true });
});
