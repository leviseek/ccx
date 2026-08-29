// CCX 静态站点服务（本地预览构建产物：index.html + 运行时 ESM + 资产；零依赖；可选 --watch SSE 热重载）
import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/** 路由解析（纯函数可测）：URL -> { path, mime, ok }；目录回退 index.html；越界防护 */
export function routeFor(url, root) {
  const q = url.split('?')[0].split('#')[0];
  const rel = q === '/' ? 'index.html' : decodeURIComponent(q.replace(/^\/+/, ''));
  const target = normalize(join(resolve(root), rel));
  if (!target.startsWith(resolve(root) + sep)) return { ok: false, status: 403 };
  let p = target;
  if (!existsSync(p)) {
    // 目录回退
    const idx = join(p, 'index.html');
    if (existsSync(idx)) p = idx;
    else return { ok: false, status: 404 };
  }
  const st = statSync(p);
  if (st.isDirectory()) {
    const idx = join(p, 'index.html');
    if (existsSync(idx)) p = idx;
    else return { ok: false, status: 404 };
  }
  return { ok: true, path: p, mime: MIME[extname(p).toLowerCase()] ?? 'application/octet-stream' };
}

/** 目录内容指纹（watch 用：全量递归 mtime 映射哈希） */
export function dirFingerprint(root) {
  let hash = 0;
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else {
        let buf;
        try { buf = readFileSync(full); } catch { return; }
        hash = (hash * 31 + buf.length) % 0x7fffffff;
        for (let i = 0; i < buf.length; i++) hash = (hash * 31 + buf[i]) % 0x7fffffff;
      }
    }
  };
  walk(root);
  return hash;
}

export async function startStaticServer({ root, port = 8321, watch = false }) {
  let lastFp = dirFingerprint(root);
  const subscribers = new Set();
  let watcher = null;
  if (watch) {
    watcher = setInterval(() => {
      const fp = dirFingerprint(root);
      if (fp !== lastFp) { lastFp = fp; subscribers.forEach((fn) => fn('reload')); }
    }, 400);
  }
  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url === '/__reload') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive' });
      const onReload = (msg) => res.write('data: ' + msg + '\n\n');
      subscribers.add(onReload);
      res.write(': connected\n\n');
      req.on('close', () => subscribers.delete(onReload));
      return;
    }
    const r = routeFor(url, root);
    if (!r.ok) { res.writeHead(r.status); res.end(r.status === 403 ? 'forbidden' : 'not found'); return; }
    res.writeHead(200, { 'Content-Type': r.mime, 'Cache-Control': 'no-store' });
    res.end(readFileSync(r.path));
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    port,
    root,
    url: 'http://127.0.0.1:' + port + '/',
    server,
    async close() { if (watcher) clearInterval(watcher); await new Promise((r) => server.close(r)); },
  };
}
