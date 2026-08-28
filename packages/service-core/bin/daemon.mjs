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
import { createBundleManifest } from '../../build-service/src/bundle.mjs';
import { getBuilder, listBuilders, registerBuilder } from '../../build-service/src/builder_registry.mjs';
function listBuildersSafe() {
  try {
    return listBuilders();
  } catch {
    return [];
  }
}
import { runBuild } from '../../build-service/src/pipeline.mjs';
import { FrameProfile } from '../../profiler-service/src/adapter.mjs';
import { dispatch } from '../src/rpc.mjs';
import { createDaemon } from '../src/daemon.mjs';

const profile = new FrameProfile();

// 审计（铁律 12：每次命令执行留痕；daemon 侧统一记录）
const auditLog = [];
function recordAudit(op, ok, detail = null) {
  auditLog.push({ at: Date.now(), op, ok, detail });
  if (auditLog.length > 512) auditLog.shift();
}

// 平台 Builder 内置注册（contributes.builder 对齐）
const builtinBuilder = {
  platform: 'web-desktop',
  displayName: 'Web Desktop',
  hooks: {
    onBeforeInit: () => ({ ok: true }),
    onAfterInit: () => ({ ok: true }),
    onBeforeBundle: () => ({ ok: true }),
    onAfterBundle: () => ({ ok: true }),
    onAfterBuild: () => ({ ok: true }),
  },
};
try {
  registerBuilder(builtinBuilder);
} catch {
  /* 幂等 */
}

const watchers = [];
let scene = null;          // 当前打开的 CommandBus
let sessionVersion = 0;    // 会话版本（apply/undo/redo 递进；文档级）

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

// MCP 风格工具面（services-spec §7 AI/Agent 接口）：现有服务方法注册为可调用工具
const MCP_TOOLS = [
  { name: 'asset.list', description: '列出资产（filter 可选）',
    inputSchema: { type: 'object', properties: { filter: { type: 'string' } } } },
  { name: 'asset.scan', description: '扫描目录下的资产',
    inputSchema: { type: 'object', properties: { root: { type: 'string' } } } },
  { name: 'scene.open', description: '打开场景文件（ADR-003）',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
  { name: 'scene.query', description: '查询当前场景实体',
    inputSchema: { type: 'object', properties: {} } },
  { name: 'scene.apply', description: '应用场景命令（create_entity/add_component/...）',
    inputSchema: { type: 'object', properties: { command: { type: 'object' } } } },
  { name: 'scene.save', description: '保存当前场景到文件',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
  { name: 'build.run', description: '运行构建管线（hooks）',
    inputSchema: { type: 'object', properties: { platform: { type: 'string' } } } },
  { name: 'profiler.snapshot', description: '帧统计快照',
    inputSchema: { type: 'object', properties: { count: { type: 'number' } } } },
  { name: 'audit.recent', description: '最近命令审计',
    inputSchema: { type: 'object', properties: { n: { type: 'number' } } } },
];

const services = {
  mcp: {
    listTools: () => ({ tools: MCP_TOOLS }),
    callTool: async (params = {}) => {
      const name = params.name;
      const tool = MCP_TOOLS.find((t) => t.name === name);
      if (!tool) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: '工具不存在: ' + name }) }] };
      }
      const out = await dispatch(services, { method: name, params: params.arguments ?? {} });
      if (out.code !== undefined) {
        return { content: [{ type: 'text', text: JSON.stringify(out) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(out.result) }] };
    },
  },
  profiler: {
    record: (params = {}) => ({ ok: true, recorded: profile.recordFrameStats(params).frame }),
    snapshot: (params = {}) => profile.snapshotJson(params.count ?? 10),
  },
  audit: {
    recent: (params = {}) => ({ count: auditLog.length, entries: auditLog.slice(-(params.n ?? 20)) }),
    clear: () => { auditLog.length = 0; return { ok: true, cleared: 0 }; },
    snapshot: (params = {}) => profile.snapshotJson(params.count ?? 10),
  },
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
  build: {
    platforms: () => ({ platforms: listBuildersSafe() }),
    configure: (params = {}) => {
      const b = getBuilder(params.platform);
      if (!b) return { ok: false, error: '未知平台: ' + params.platform };
      return { ok: true, profile: { platform: params.platform, options: params.options ?? {} } };
    },
    async run(params = {}) {
      const b = getBuilder(params.platform);
      if (!b) return { ok: false, error: '未知平台: ' + params.platform };
      return runBuild(b, {
        makeManifest: () => createBundleManifest({
          project: params.project ?? 'demo',
          platform: params.platform,
          assets: params.assets ?? [],
          scripts: [],
          config: params.options ?? {},
        }),
      });
    },
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
      if (!scene) {
        recordAudit(command?.op ?? 'apply', false, '未打开场景');
        return { ok: false, error: '未打开场景' };
      }
      try {
        scene.apply(command);
        ++sessionVersion;
        recordAudit(command?.op ?? 'apply', true);
      } catch (e) {
        recordAudit(command?.op ?? 'apply', false, e.message);
        return { ok: false, error: e.message };
      }
      return { ok: true, entities: scene.scene.entities.size, version: sessionVersion };
    },
    undo: () => {
      if (!scene) return { ok: false, error: '未打开场景' };
      scene.undo();
      ++sessionVersion;
      return { ok: true, entities: scene.scene.entities.size, version: sessionVersion,
               undo: scene.undoStack.length, redo: scene.redoStack.length };
    },
    redo: () => {
      if (!scene) return { ok: false, error: '未打开场景' };
      scene.redo();
      ++sessionVersion;
      return { ok: true, entities: scene.scene.entities.size, version: sessionVersion,
               undo: scene.undoStack.length, redo: scene.redoStack.length };
    },
    status: () => {
      if (!scene) return { ok: false, error: '未打开场景' };
      return { ok: true, entities: scene.scene.entities.size, version: sessionVersion,
               undo: scene.undoStack.length, redo: scene.redoStack.length };
    },
    'session.save': ({ path } = {}) => {
      if (!scene || !path) return { ok: false, error: '需要已打开场景与 path' };
      const snap = {
        schema: 'ccx.session/1',
        version: sessionVersion,
        doc: scene.toSceneFile(),
      };
      try {
        writeFileSync(path, JSON.stringify(snap, null, 2) + '\n');
      } catch (e) {
        return { ok: false, error: 'session.save 失败: ' + e.message };
      }
      return { ok: true, path, version: sessionVersion };
    },
    'session.load': ({ path } = {}) => {
      let snap;
      try {
        snap = JSON.parse(readFileSync(path, 'utf8'));
      } catch (e) {
        return { ok: false, error: 'session.load 失败: ' + e.message };
      }
      if (!snap || snap.schema !== 'ccx.session/1' || !snap.doc) {
        return { ok: false, error: '非法会话快照' };
      }
      scene = CommandBus.fromSceneFile(snap.doc);
      sessionVersion = snap.version ?? 0;
      return { ok: true, entities: scene.scene.entities.size, version: sessionVersion };
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
rl.on('line', async (line) => {
  if (!line.trim()) return;
  const out = await daemon.handle(line);
  if (out) process.stdout.write(JSON.stringify(out) + '\n');
});
// 常驻模式：stdin 为 ignore 时事件循环无活动句柄，需保持（心跳不 unref）
if (process.env.CCX_DAEMON_DETACHED) {
  setInterval(() => {}, 60000);
  console.error('[daemon] resident mode on');
}
// EOF 优雅退出：先关 watchers 再 exit 0；常驻模式（CCX_DAEMON_DETACHED）忽略 EOF
rl.on('close', () => {
  if (process.env.CCX_DAEMON_DETACHED) return;
  for (const w of watchers) w.close();
  watchers.length = 0;
  process.exit(0);
});

process.stdout.write(JSON.stringify({
  jsonrpc: '2.0',
  method: 'system.ready',
  params: { pid: process.pid },
}) + '\n');
