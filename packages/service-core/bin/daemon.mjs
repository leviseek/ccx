#!/usr/bin/env node
// ccx-service-daemon：stdio daemon 演示实例
// - asset.list/scan、scene.open 存根
// - asset.subscribe(root)：监视目录，变更推送 asset.event/assetChanged（services-spec §3）
import { createInterface } from 'node:readline';
import { createWatcher } from '../../asset-service/src/watch.mjs';
import { createDaemon } from '../src/daemon.mjs';

const watchers = [];

const services = {
  asset: {
    list: (params = {}) => ({
      assets: [
        { uuid: 'a-1', type: 'ccx.Texture', path: 'assets/hero.png',
          filter: params.filter ?? null },
        { uuid: 'a-2', type: 'ccx.Sprite', path: 'assets/coin.atlas',
          filter: params.filter ?? null },
      ],
    }),
    scan: () => ({ scanned: 2, changed: 0 }),
    // 事件源：subscribe 后由 daemon.pushEvent 推送（下方引导时绑定）
  },
  scene: {
    open: (params = {}) => ({
      schema: params.schema ?? 'ccx.scene/1',
      path: params.path ?? 'scenes/main.scene.json',
      entities: 0,
    }),
  },
};

const daemon = createDaemon(services);
daemon.onPush((payload) => process.stdout.write(payload + '\n'));

services.asset.subscribe = (params = {}) => {
  if (!params.root) return { ok: false, error: '需要 root 目录' };
  const watcher = createWatcher(params.root, { debounceMs: 10 });
  watcher.on((batch) => {
    for (const [path, event] of batch) {
      daemon.pushEvent('asset', 'assetChanged', { path, event });
    }
  });
  watchers.push(watcher);
  return { ok: true, watching: params.root, watchers: watchers.length };
};

services.asset.unsubscribe = () => {
  for (const w of watchers) w.close();
  watchers.length = 0;
  return { ok: true, closed: 0 };
};

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  if (!line.trim()) return;
  const out = daemon.handle(line);
  if (out) process.stdout.write(JSON.stringify(out) + '\n');
});

process.stdout.write(JSON.stringify({
  jsonrpc: '2.0',
  method: 'system.ready',
  params: { pid: process.pid },
}) + '\n');
