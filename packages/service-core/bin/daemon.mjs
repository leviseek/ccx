#!/usr/bin/env node
// ccx-service-daemon：stdio daemon（services-spec §2 子集）
// - scene.open/query/apply/save：真实场景写路径（CommandBus + ADR-003 文件）
// - asset.scan/list：真实目录扫描 + 确定性 uuid
// - asset.subscribe：真实 fs watch -> assetChanged 推送
import { createInterface } from 'node:readline';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createWatcher } from '../../asset-service/src/watch.mjs';
import { assetUuid } from '../../asset-service/src/queue.mjs';
import { CommandBus } from '../../scene-service/src/commands.mjs';
import { createDaemon } from '../src/daemon.mjs';

const watchers = [];
let scene = null;          // 当前打开的 CommandBus

function scanDir(root) {
  let entries = [];
  try {
    for (const name of readdirSync(root)) {
      const full = join(root, name);
      const st = statSync(full);
      if (st.isFile()) {
        entries.push({ uuid: assetUuid(full, 'ccx.generic'), path: full });
      }
    }
  } catch (e) {
    return { error: e.message };
  }
  return { assets: entries };
}

const services = {
  asset: {
    scan: ({ root } = {}) => (root ? scanDir(root) : { assets: [], error: 'need root' }),
    list: (params = {}) => ({
      assets: [
        { uuid: 'a-1', type: 'ccx.Texture', path: 'assets/hero.png',
          filter: params.filter ?? null },
        { uuid: 'a-2', type: 'ccx.Sprite', path: 'assets/coin.atlas',
          filter: params.filter ?? null },
      ],
    }),
    subscribe: null,  // 由下方事件源绑定
    unsubscribe: null,
  },
  scene: {
    open: ({ path } = {}) => {
      let doc;
      try {
        doc = JSON.parse(readFileSync(path, 'utf8'));
      } catch (e) {
        return { ok: false, error: 'open 失败: ' + e.message };
      }
      scene = CommandBus.fromSceneFile(doc);
      return { ok: true, path, entities: scene.scene.entities.size, schema: doc.schema };
    },
    query: () => {
      if (!scene) return { ok: false, error: '未打开场景（scene.open）' };
      return {
        entities: [...scene.scene.entities.values()].map((e) => ({
          id: e.id,
          name: e.name,
          parent: e.parent,
          components: [...e.components.keys()],
        })),
      };
    },
    apply: ({ command } = {}) => {
      if (!scene) return { ok: false, error: '未打开场景' };
      try {
        scene.apply(command);
      } catch (e) {
        return { ok: false, error: e.message };
      }
      return { ok: true, entities: scene.scene.entities.size };
    },
    save: ({ path } = {}) => {
      if (!scene) return { ok: false, error: '未打开场景' };
      try {
        const out = scene.toSceneFile();
        out.meta.generator = 'ccx-service-daemon';
        writeFileSync(path, JSON.stringify(out, null, 2) + '\n');
      } catch (e) {
        return { ok: false, error: 'save 失败: ' + e.message };
      }
      return { ok: true, path };
    },
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
  return { ok: true, closed: watchers.length };
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
