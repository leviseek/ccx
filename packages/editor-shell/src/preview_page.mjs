// 编辑器预览页（M2 Web UI 的最小自包含形态：静态 HTML + 内联场景数据 + 基础交互）
import { renderViewHtml } from './html.mjs';

export function renderPreviewPage(view, sceneJson,
  { title = 'CCX Preview', history = null, resolution = null } = {}) {
  const base = renderViewHtml(view, { title });
  // M4 UI 工具深度：多分辨率视口（design resolution 驱动 viewport + 自适应缩放）
  const res = resolution && /^\d+x\d+$/.test(resolution)
    ? (() => { const [w, h] = resolution.split('x').map(Number); return { w, h }; })()
    : null;
  const viewport = res
    ? '<div id="ccx-viewport" style="border:1px solid #888;margin:8px;padding:8px;'
      + 'display:inline-block;background:#222;">'
      + '<div style="color:#aaa;font:11px monospace;margin-bottom:2px;">'
      + 'CCX 视口（设计分辨率 ' + res.w + 'x' + res.h + ' · 自适应缩放）</div>'
      + '<canvas id="ccx-scene-canvas" width="' + res.w + '" height="' + res.h + '" '
      + 'style="background:#101020;max-width:100%;height:auto;"></canvas>'
      + '</div>'
    : '';
  const undoBar = history
    ? '<div id="ccx-undo-bar" style="font:12px monospace;padding:6px;border-bottom:1px solid #ccc">' +
      '会话：可回退 ' + history.undoCount + ' 步 · 当前实体 ' + history.entities +
      (history.entitiesBefore != null ? '（回退后 ' + history.entitiesBefore + '）' : '') +
      ' <button id="ccx-undo" disabled="disabled">回退（预览为静态快照，编辑经 CLI/daemon 会话）</button></div>'
    : '';
  const lines = [
    '<script>',
    'window.__SCENE = ' + JSON.stringify(sceneJson) + ';',
    'window.__HISTORY = ' + JSON.stringify(history) + ';',
    'document.querySelectorAll("[data-entity]").forEach(function (li) {',
    '  li.addEventListener("click", function () { li.classList.toggle("selected"); });',
    '});',
    'document.querySelectorAll("[data-cmd]").forEach(function (b) {',
    '  b.addEventListener("click", function () { console.log("cmd " + b.dataset.cmd); });',
    '});',
    '</script>',
  ];
  return base.replace('</body>', undoBar + viewport + lines.join('\n') + '</body>');
}
