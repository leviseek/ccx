// 编辑器最小 HTML 渲染（无 DOM 依赖的字符串产物；真实交互 Web UI 在 M2）
// 消费 buildView 快照 —— 模型 -> 视图的第一步，纯函数可测
function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderViewHtml(view, { title = 'CCX Editor' } = {}) {
  const parts = [];
  parts.push('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title></head><body>');
  for (const [region, panels] of Object.entries(view.panels)) {
    parts.push('<section data-region="' + esc(region) + '">');
    for (const p of panels) {
      parts.push('<div class="panel" data-panel="' + esc(p.id) + '">' + esc(p.id) + '</div>');
    }
    parts.push('</section>');
  }
  parts.push('<section id="hierarchy"><ul>');
  for (const e of view.scene.entities) {
    parts.push('<li data-entity="' + e.id + '"' + (e.selected ? ' class="selected"' : '') +
               '>' + esc(e.name) + '</li>');
    parts.push('<ul>');
    for (const c of e.components) {
      parts.push('<li class="component" data-type="' + esc(c.type) + '">' +
                 esc(c.type) + ' ' + esc(JSON.stringify(c.data)) + '</li>');
    }
    parts.push('</ul>');
  }
  parts.push('</ul></section>');
  parts.push('<section id="commands">' +
             view.commands.map((c) => '<button data-cmd="' + esc(c) + '">' + esc(c) + '</button>').join('') +
             '</section>');
  parts.push('<footer>' + esc('entities=' + view.scene.entityCount) + '</footer>');
  parts.push('</body></html>');
  return parts.join('\n');
}
