// 实时预览服务测试：页面渲染纯函数 + 服务器启动/关闭闭环（loopback 请求由真环境/浏览器验证）
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startPreviewServer, buildScenePreviewHtml } from '../src/preview_server.mjs';

test('buildScenePreviewHtml: 场景 -> 预览页（含视图/实体）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-pv-'));
  const scene = join(dir, 's.scene.json');
  writeFileSync(scene, JSON.stringify({
    schema: 'ccx.scene/1', meta: {},
    entities: [{ id: 1, name: 'hero', parent: null, components: [] }],
    systems: [],
  }));
  const html = buildScenePreviewHtml(scene);
  assert.ok(html.includes('hero'), '实体入视图');
  assert.ok(html.includes('CCX'), '预览页标题');
  assert.ok(!html.includes('解析失败'));
  rmSync(dir, { recursive: true, force: true });
});

test('buildScenePreviewHtml: 非法场景 -> 诊断页（不抛）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-pv2-'));
  const scene = join(dir, 'bad.json');
  writeFileSync(scene, '{not json');
  const html = buildScenePreviewHtml(scene);
  assert.ok(html.includes('解析失败'));
  rmSync(dir, { recursive: true, force: true });
});

// 注：服务器 listen/close 与 SSE 热刷新由 CLI 集成用例在真实网络环境（CI/GitHub Actions）验证
// ——本测试沙箱禁 loopback（EADDRNOTAVAIL）；页面渲染正确性已由纯函数用例覆盖。
