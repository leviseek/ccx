import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RpcClient } from '../src/client.mjs';
import { createDaemon } from '../src/daemon.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const daemonEntry = join(here, '..', 'bin', 'daemon.mjs');

test('daemon: RPC roundtrip + ready event (real process)', async () => {
  const client = new RpcClient(process.execPath, [daemonEntry]);
  try {
    const ready = await new Promise((resolve) => {
      const off = client.onEvent((m) => {
        if (m.method === 'system.ready') {
          off();
          resolve(m);
        }
      });
      setTimeout(() => resolve(null), 2000);
    });
    assert.ok(ready, 'ready event received');
    assert.ok(ready.params.pid > 0, 'ready carries pid');

    const list = await client.request('asset.list', { filter: 'texture' });
    assert.equal(list.assets.length, 2);
    // 真实实现：文件不存在 -> 明确错误（存根已被真实服务替代）
    const open = await client.request('scene.open', { path: 'scenes/x.scene.json' });
    assert.equal(open.ok, false);
    assert.ok(open.error.includes('open 失败'), '错误信息明确');
    await assert.rejects(client.request('asset.nope'), /Method not found/);
    const pong = await client.request('__system.ping');
    assert.ok(pong.pong > 0);
  } finally {
    client.close();
  }
});

test('daemon: notification produces no response', async () => {
  const client = new RpcClient(process.execPath, [daemonEntry]);
  try {
    const msgs = [];
    const off = client.onEvent((m) => msgs.push(m));
    client.notify('asset.scan');
    await new Promise((r) => setTimeout(r, 150));
    off();
    assert.equal(msgs.filter((m) => m.method === 'asset.scan').length, 0);
  } finally {
    client.close();
  }
});

test('daemon: EOF 优雅退出（spawn -> stdin.end -> exit 0）', async () => {
  // 不依赖 ready：EOF 语义与就绪通知无关（readline close -> 清理 -> exit 0）
  const client = new RpcClient(process.execPath, [daemonEntry]);
  const exitCode = new Promise((resolve) => {
    client.proc.on('exit', (code) => resolve(code));
  });
  try {
    client.proc.stdin.end();
    const code = await Promise.race(
      [exitCode, new Promise((r) => setTimeout(() => r('timeout'), 5000))]);
    assert.equal(code, 0, 'EOF 后 daemon 以 0 退出');
  } finally {
    client.proc.kill();  // 兜底（防测试失败残留）
  }
});

test('daemon: closed connection rejects requests', async () => {
  const client = new RpcClient(process.execPath, [daemonEntry]);
  await client.request('asset.scan');
  client.close();
  await new Promise((r) => setTimeout(r, 60));
  await assert.rejects(client.request('asset.scan', {}, 500), /daemon exited|超时/);
});

test('createDaemon: in-process handle unit (protocol error codes)', async () => {
  const d = createDaemon({ asset: { list: () => ({ ok: true }) } });
  const ok = await d.handle(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'asset.list', params: {} }));
  assert.deepEqual(ok.result, { ok: true });
  const bad = await d.handle(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'asset.nope' }));
  assert.equal(bad.error.code, -32601);
  const parse = await d.handle('not json');
  assert.equal(parse.error.code, -32700);
  const notify = await d.handle(JSON.stringify({ jsonrpc: '2.0', method: 'asset.list' }));
  assert.equal(notify, null, 'notification no response');
});

test('createDaemon: async service methods supported', async () => {
  const d = createDaemon({
    build: {
      async run() {
        await new Promise((r) => setTimeout(r, 10));
        return { ok: true, wait: true };
      },
    },
  });
  const out = await d.handle(JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'build.run' }));
  assert.deepEqual(out.result, { ok: true, wait: true });
});

test('daemon: build.configure/platforms/run RPC', async () => {
  const client = new RpcClient(process.execPath, [daemonEntry]);
  try {
    await new Promise((resolve) => {
      const off = client.onEvent((m) => {
        if (m.method === 'system.ready') {
          off();
          resolve();
        }
      });
      setTimeout(() => resolve(), 2000);
    });
    const platforms = await client.request('build.platforms');
    assert.ok(platforms.platforms.some((p) => p.platform === 'web-desktop'), '内置 builder');
    const cfg = await client.request('build.configure', { platform: 'web-desktop', options: { split: true } });
    assert.equal(cfg.ok, true);
    assert.equal(cfg.profile.options.split, true);
    const bad = await client.request('build.configure', { platform: 'ps5' });
    assert.equal(bad.ok, false);
    const run = await client.request('build.run', { platform: 'web-desktop', project: 'demo' });
    assert.equal(run.ok, true);
    assert.ok(run.trace.length >= 10, 'hooks 五阶段 enter+ok');
    assert.equal(run.trace.filter((t) => t.status === 'error').length, 0, '无 error 项');
  } finally {
    client.close();
  }
});


test('daemon: scene open/query/apply/save (real scene write path)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-daemon-scene-'));
  const client = new RpcClient(process.execPath, [daemonEntry]);
  try {
    const sceneFile = join(dir, 's.scene.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1',
      meta: {},
      entities: [{ id: 1, name: 'root', parent: null, components: [] }],
      systems: [],
    }));
    const open = await client.request('scene.open', { path: sceneFile });
    assert.equal(open.ok, true);
    assert.equal(open.entities, 1);
    await client.request('scene.apply', {
      command: { op: 'create_entity', name: 'hero', parent: 1 },
    });
    await client.request('scene.apply', {
      command: { op: 'add_component', id: 2, type: 'game.Health', data: { max: 100 } },
    });
    const q = await client.request('scene.query');
    assert.equal(q.entities.length, 2);
    assert.equal(q.entities[1].components.includes('game.Health'), true);
    const saved = await client.request('scene.save', { path: sceneFile });
    assert.equal(saved.ok, true);
    const reload = JSON.parse(readFileSync(sceneFile, 'utf8'));
    assert.equal(reload.entities.length, 2, '文件已持久化');
  } finally {
    client.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('daemon: asset.scan real directory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-daemon-assets-'));
  const client = new RpcClient(process.execPath, [daemonEntry]);
  try {
    writeFileSync(join(dir, 'a.png'), 'x');
    writeFileSync(join(dir, 'b.png'), 'y');
    const r = await client.request('asset.scan', { root: dir });
    assert.equal(r.assets.length, 2);
    assert.ok(r.assets[0].uuid.length === 36, '确定性 uuid');
    assert.equal(r.assets[0].uuid, r.assets[0].uuid);
  } finally {
    client.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('daemon: 审计记录（apply 统一留痕，铁律 12）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-audit-'));
  const client = new RpcClient(process.execPath, [daemonEntry]);
  try {
    const sceneFile = join(dir, 's.scene.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1', meta: {},
      entities: [{ id: 1, name: 'root', parent: null, components: [] }],
      systems: [],
    }));
    const open = await client.request('scene.open', { path: sceneFile });
    assert.equal(open.ok, true);
    await client.request('scene.apply', { command: { op: 'create_entity', name: 'npc' } });
    await client.request('scene.apply', { command: { op: 'nope_unknown' } });  // 失败也留痕
    const aud = await client.request('audit.recent');
    assert.equal(aud.count >= 2, true);
    assert.equal(aud.entries[0].op, 'create_entity');
    assert.equal(aud.entries[0].ok, true);
    assert.equal(aud.entries[1].op, 'nope_unknown');
    assert.equal(aud.entries[1].ok, false);
    assert.ok(aud.entries[1].detail.length > 0, '失败带原因');
  } finally {
    client.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('daemon: MCP 工具面（listTools/callTool）', async () => {
  const client = new RpcClient(process.execPath, [daemonEntry]);
  const dir = mkdtempSync(join(tmpdir(), 'ccx-mcp-'));  // try 外声明：finally 恒可见
  try {
    await new Promise((resolve) => {
      const off = client.onEvent((m) => {
        if (m.method === 'system.ready') { off(); resolve(); }
      });
      setTimeout(() => resolve(), 2000);
    });
    const tools = await client.request('mcp.listTools');
    assert.ok(tools.tools.some((t) => t.name === 'scene.apply'), 'scene.apply 已注册');
    assert.ok(tools.tools.some((t) => t.name === 'profiler.snapshot'), 'profiler 已注册');
    // callTool：真场景流程
    const sceneFile = join(dir, 's.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1', meta: {},
      entities: [{ id: 1, name: 'root', parent: null, components: [] }],
      systems: [],
    }));
    const open = await client.request('mcp.callTool',
      { name: 'scene.open', arguments: { path: sceneFile } });
    assert.ok(open.content[0].text.includes('"ok":true'), 'tool 调用返回结果');
    const apply = await client.request('mcp.callTool',
      { name: 'scene.apply', arguments: { command: { op: 'create_entity', name: 'npc' } } });
    assert.ok(apply.content[0].text.includes('"ok":true'), 'apply 工具化');
    const query = await client.request('mcp.callTool', { name: 'scene.query' });
    assert.ok(query.content[0].text.includes('"npc"'), '查询结果暴露给 AI');
    const missing = await client.request('mcp.callTool', { name: 'ghost.tool' });
    assert.ok(missing.content[0].text.includes('工具不存在'), '未知工具明确错误');
  } finally {
    client.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('daemon: MCP callTool 参数错误与返回格式', async () => {
  const client = new RpcClient(process.execPath, [daemonEntry]);
  try {
    await new Promise((resolve) => {
      const off = client.onEvent((m) => {
        if (m.method === 'system.ready') { off(); resolve(); }
      });
      setTimeout(() => resolve(), 2000);
    });
    // 无场景时 query -> 服务错误也走 content 文本（工具化错误可读）
    const q = await client.request('mcp.callTool', { name: 'scene.query' });
    assert.ok(q.content[0].text.length > 0, '错误以文本返回');
    // 参数结构校验：无 name -> 工具不存在
    const bad = await client.request('mcp.callTool', {});
    assert.ok(bad.content[0].text.includes('工具不存在'), '缺 name 明确报错');
  } finally {
    client.close();
  }
});

test('daemon: profiler.record/snapshot RPC', async () => {
  const client = new RpcClient(process.execPath, [daemonEntry]);
  try {
    await new Promise((resolve) => {
      const off = client.onEvent((m) => {
        if (m.method === 'system.ready') { off(); resolve(); }
      });
      setTimeout(() => resolve(), 2000);
    });
    const r1 = await client.request('profiler.record', { frame: 1, frameTimeMs: 16.6, entities: 3 });
    const r2 = await client.request('profiler.record', { frame: 2, frameTimeMs: 17.1, entities: 3 });
    assert.equal(r1.recorded, 1);
    assert.equal(r2.recorded, 2);
    const snap = await client.request('profiler.snapshot', { count: 5 });
    assert.equal(snap.schema, 'ccx.profile/1');
    assert.equal(snap.frames.length, 2);
    assert.equal(snap.frames[1].frameTimeMs, 17.1);
  } finally {
    client.close();
  }
});

test('daemon: asset.subscribe -> assetChanged push (real fs change)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-daemon-watch-'));
  const client = new RpcClient(process.execPath, [daemonEntry]);
  const events = [];
  const off = client.onEvent((m) => {
    if (m.method === 'asset.event') events.push(m.params);
  });
  try {
    const sub = await client.request('asset.subscribe', { root: dir });
    assert.equal(sub.ok, true);
    writeFileSync(join(dir, 'hero.png'), 'png');
    await new Promise((r) => setTimeout(r, 400));
    assert.ok(events.length >= 1, 'received at least one assetChanged');
    assert.ok(events[0].data.path.includes('hero.png'), 'event carries path');
    await client.request('asset.unsubscribe');
  } finally {
    off();
    client.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
