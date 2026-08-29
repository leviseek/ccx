// CCX 实时预览服务（editor-shell 能力）：本地 http 服务器 + SSE 热刷新（保存即预）——双平台（Win/mac）浏览器通用
// 路由：/（预览页）· /__scene（场景 JSON）· /__events（SSE reload 信号）
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { renderPreviewPage } from './preview_page.mjs';
import { buildView } from './viewmodel.mjs';
import { EditorShell } from './shell.mjs';
import { CommandBus } from '../../scene-service/src/commands.mjs';

/** 场景文件 -> 预览页 HTML（纯函数：渲染正确性可测；异常返回诊断页） */
export function buildScenePreviewHtml(scenePath) {
  try {
    const doc = JSON.parse(readFileSync(scenePath, 'utf8'));
    const bus = CommandBus.fromSceneFile(doc);
    const shell = new EditorShell({ bus });
    shell.addPanel('hierarchy', 'left', 0);
    shell.addPanel('scene', 'center', 0);
    shell.addPanel('inspector', 'right', 10);
    shell.registerCommand('scene.save', '保存场景', () => {});
    const view = buildView(shell, bus);
    return renderPreviewPage(view, doc, { title: 'CCX 实时预览 · ' + scenePath });
  } catch (e) {
    return '<!doctype html><html><body style="font:14px monospace;background:#1b1b2f;color:#ffd75e;padding:20px">'
      + '场景解析失败: ' + e.message + '</body></html>';
  }
}

export async function startPreviewServer({ root, scenePath, port = 8321, watch = false, open = false }) {
  const state = { scenePreview: null, mtime: 0, subscribers: new Set() };
  function loadScene() {
    try {
      const st = statSync(scenePath);
      if (st.mtimeMs === state.mtime && state.scenePreview) return state.scenePreview;
      state.mtime = st.mtimeMs;
      state.scenePreview = buildScenePreviewHtml(scenePath);
      state.subscribers.forEach((fn) => fn('reload'));
      return state.scenePreview;
    } catch (e) {
      return '<!doctype html><html><body style="font:14px monospace;background:#1b1b2f;color:#ffd75e;padding:20px">'
        + '场景解析失败: ' + e.message + '</body></html>';
    }
  }
  if (!state.scenePreview) loadScene();

  let watcher = null;
  if (watch) {
    watcher = setInterval(() => loadScene(), 400);
  }

  const server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      let html = loadScene();
      if (watch) {
        const sse = '<script>if(window.EventSource){var es=new EventSource("/__events");'
          + 'es.onmessage=function(){location.reload();};}</script>';
        html = html.replace('</body>', sse + '</body>');
      }
      res.end(html);
      return;
    }
    if (url === '/__scene') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(readFileSync(scenePath, 'utf8'));
      return;
    }
    if (url === '/__events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store',
        'Connection': 'keep-alive',
      });
      const onReload = (msg) => res.write('data: ' + msg + '\n\n');
      state.subscribers.add(onReload);
      res.write(': connected\n\n');
      req.on('close', () => state.subscribers.delete(onReload));
      return;
    }
    res.writeHead(404); res.end('not found');
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    port, watch,
    url: 'http://127.0.0.1:' + port + '/',
    server,
    async close() { if (watcher) clearInterval(watcher); await new Promise((r) => server.close(r)); },
  };
}
