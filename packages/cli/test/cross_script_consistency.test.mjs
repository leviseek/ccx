import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { RpcClient } from '../../service-core/src/client.mjs';

const here = import.meta.dirname;
const root = join(here, '..', '..', '..');
const exe = process.env.CCX_BRIDGE_EXE ??
  join(root, 'build', 'local', 'engine', 'tests', 'ccx_script_scene_bridge_test.exe');
const daemonEntry = join(root, 'packages', 'service-core', 'bin', 'daemon.mjs');

// exit3 剧本雏形：脚本命令面 vs daemon 命令面同名序列，结果一致
test('跨语言一致：脚本命令面 == daemon 命令面（固定三命令序列）', async (t) => {
  if (!existsSync(exe)) {
    t.skip('未构建脚本桥 exe');
    return;
  }
  // 1) 脚本侧（C++）
  const r = spawnSync(exe, ['--dump'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const script = JSON.parse(r.stdout.trim());
  assert.equal(script.entities, 2);
  assert.deepEqual(script.names, ['hero', 'npc']);

  // 2) daemon 侧（Node）同序列
  const dir = mkdtempSync(join(tmpdir(), 'ccx-consis-'));
  const client = new RpcClient(process.execPath, [daemonEntry]);
  try {
    await new Promise((resolve) => {
      const off = client.onEvent((m) => {
        if (m.method === 'system.ready') { off(); resolve(); }
      });
      setTimeout(() => resolve(), 2000);
    });
    const sceneFile = join(dir, 's.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1', meta: {},
      entities: [], systems: [],
    }));
    assert.equal((await client.request('scene.open', { path: sceneFile })).ok, true);
    await client.request('scene.apply', { command: { op: 'create_entity', name: 'hero' } });
    await client.request('scene.apply', { command: { op: 'create_entity', name: 'npc' } });
    await client.request('scene.apply', {
      command: { op: 'add_component', id: 1, type: 'game.Health', data: {} } });
    const q = await client.request('scene.query');
    const names = q.entities.map((e) => e.name).sort();
    assert.equal(names.length, 2, 'daemon 侧 2 实体');
    assert.deepEqual(names, script.names.slice().sort(), '两侧实体名集合一致');
  } finally {
    client.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
