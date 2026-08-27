import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
    const open = await client.request('scene.open', { path: 'scenes/x.scene.json' });
    assert.equal(open.path, 'scenes/x.scene.json');
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

test('daemon: closed connection rejects requests', async () => {
  const client = new RpcClient(process.execPath, [daemonEntry]);
  await client.request('asset.scan');
  client.close();
  await new Promise((r) => setTimeout(r, 60));
  await assert.rejects(client.request('asset.scan', {}, 500), /daemon exited|超时/);
});

test('createDaemon: in-process handle unit (protocol error codes)', () => {
  const d = createDaemon({ asset: { list: () => ({ ok: true }) } });
  const ok = d.handle(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'asset.list', params: {} }));
  assert.deepEqual(ok.result, { ok: true });
  const bad = d.handle(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'asset.nope' }));
  assert.equal(bad.error.code, -32601);
  const parse = d.handle('not json');
  assert.equal(parse.error.code, -32700);
  const notify = d.handle(JSON.stringify({ jsonrpc: '2.0', method: 'asset.list' }));
  assert.equal(notify, null, 'notification no response');
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
