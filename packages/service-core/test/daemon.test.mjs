import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RpcClient } from '../src/client.mjs';
import { createDaemon } from '../src/daemon.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const daemonEntry = join(here, '..', 'bin', 'daemon.mjs');

test('daemon：RPC 往返 + 事件订阅（真进程）', async () => {
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
    assert.ok(ready, '收到 system.ready 事件');
    assert.ok(ready.params.pid > 0, 'ready 携带 pid');

    const list = await client.request('asset.list', { filter: 'texture' });
    assert.equal(list.assets.length, 2);
    assert.equal(list.assets[0].uuid, 'a-1');
    const open = await client.request('scene.open', { path: 'scenes/x.scene.json' });
    assert.equal(open.path, 'scenes/x.scene.json');
    await assert.rejects(client.request('asset.nope'), /Method not found/);
    const pong = await client.request('__system.ping');
    assert.ok(pong.pong > 0);
  } finally {
    client.close();
  }
});

test('daemon：通知不产生响应', async () => {
  const client = new RpcClient(process.execPath, [daemonEntry]);
  try {
    const msgs = [];
    const off = client.onEvent((m) => msgs.push(m));
    client.notify('asset.scan');
    await new Promise((r) => setTimeout(r, 150));
    off();
    assert.equal(msgs.filter((m) => m.method === 'asset.scan').length, 0,
                 '通知不推事件');
  } finally {
    client.close();
  }
});

test('daemon：关闭后请求失败（连接生命周期）', async () => {
  const client = new RpcClient(process.execPath, [daemonEntry]);
  await client.request('asset.scan');
  client.close();
  await new Promise((r) => setTimeout(r, 60));
  await assert.rejects(client.request('asset.scan', {}, 500), /daemon exited|超时/);
});

test('createDaemon：进程内 handle 单测（协议错误码）', () => {
  const d = createDaemon({ asset: { list: () => ({ ok: true }) } });
  const ok = d.handle(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'asset.list', params: {} }));
  assert.deepEqual(ok.result, { ok: true });
  const bad = d.handle(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'asset.nope' }));
  assert.equal(bad.error.code, -32601);
  const parse = d.handle('not json');
  assert.equal(parse.error.code, -32700);
  const notify = d.handle(JSON.stringify({ jsonrpc: '2.0', method: 'asset.list' }));
  assert.equal(notify, null, '通知无响应');
});
