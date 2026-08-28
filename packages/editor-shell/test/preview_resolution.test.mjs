// M4 UI 工具深度：多分辨率视口注入测试
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPreviewPage } from '../src/preview_page.mjs';

test('preview: 多分辨率视口注入（--resolution）', () => {
  const view = { panels: {}, scene: { entities: [], entityCount: 0 }, commands: [] };
  const html = renderPreviewPage(view, {}, { resolution: '1280x720' });
  assert.ok(html.includes('ccx-viewport'), 'viewport 容器');
  assert.ok(html.includes('1280'), '设计分辨率宽');
  assert.ok(html.includes('720'), '设计分辨率高');
  assert.ok(html.includes('ccx-scene-canvas'), '画布');
});

test('preview: 无 resolution 不注入', () => {
  const view = { panels: {}, scene: { entities: [], entityCount: 0 }, commands: [] };
  const html = renderPreviewPage(view, {});
  assert.ok(!html.includes('ccx-viewport'), '缺省无 viewport');
});
