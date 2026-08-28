// 编辑器预览页（M2 Web UI 的最小自包含形态：静态 HTML + 内联场景数据 + 基础交互）
import { renderViewHtml } from './html.mjs';

export function renderPreviewPage(view, sceneJson, { title = 'CCX Preview' } = {}) {
  const base = renderViewHtml(view, { title });
  const lines = [
    '<script>',
    'window.__SCENE = ' + JSON.stringify(sceneJson) + ';',
    'document.querySelectorAll("[data-entity]").forEach(function (li) {',
    '  li.addEventListener("click", function () { li.classList.toggle("selected"); });',
    '});',
    'document.querySelectorAll("[data-cmd]").forEach(function (b) {',
    '  b.addEventListener("click", function () { console.log("cmd " + b.dataset.cmd); });',
    '});',
    '</script>',
  ];
  return base.replace('</body>', lines.join('\n') + '</body>');
}
