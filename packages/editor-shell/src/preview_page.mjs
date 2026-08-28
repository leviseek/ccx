// 编辑器预览页（M2 Web UI 的最小自包含形态：静态 HTML + 内联场景数据 + 基础交互）
import { renderViewHtml } from './html.mjs';

export function renderPreviewPage(view, sceneJson,
  { title = 'CCX Preview', history = null } = {}) {
  const base = renderViewHtml(view, { title });
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
  return base.replace('</body>', undoBar + lines.join('\n') + '</body>');
}
