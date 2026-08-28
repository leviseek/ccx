import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const cli = join(import.meta.dirname, '..', 'bin', 'ccx.mjs');

function runCli(args, cwd) {
  const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd });
  return { status: r.status, out: r.stdout, err: r.stderr };
}

test('create：生成项目模板', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-create-'));
  try {
    const r = runCli(['create', join(dir, 'proj'), '--json'], dir);
    assert.equal(r.status, 0, r.err);
    const json = JSON.parse(r.out);
    assert.equal(json.ok, true);
    const proj = join(dir, 'proj');
    assert.ok(existsSync(join(proj, 'ccx.project.json')), 'ccx.project.json');
    assert.ok(existsSync(join(proj, 'scenes', 'main.scene.json')), '主场景');
    assert.ok(existsSync(join(proj, 'scripts', 'main.ts')), '入口脚本');
    const scene = JSON.parse(readFileSync(join(proj, 'scenes', 'main.scene.json'), 'utf8'));
    assert.equal(scene.schema, 'ccx.scene/1');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scene new：ADR-003 v1 空场景', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-scene-'));
  try {
    const r = runCli(['scene', 'new', '--at', join(dir, 's.scene.json'), '--json'], dir);
    assert.equal(r.status, 0, r.err);
    const scene = JSON.parse(readFileSync(join(dir, 's.scene.json'), 'utf8'));
    assert.equal(scene.schema, 'ccx.scene/1');
    assert.deepEqual(scene.entities, []);
    assert.deepEqual(scene.systems, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('doctor/version 冒烟', () => {
  const v = runCli(['version', '--json'], join(import.meta.dirname, '..'));
  assert.equal(v.status, 0);
  assert.ok(JSON.parse(v.out).milestone === 'M1');
});

test('scene apply：命令总线写场景文件', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-apply-'));
  try {
    const sceneFile = join(dir, 's.scene.json');
    const init = runCli(['scene', 'new', '--at', sceneFile, '--json'], dir);
    assert.equal(init.status, 0);
    const r = runCli([
      'scene', 'apply', sceneFile,
      '--cmd', JSON.stringify({ op: 'create_entity', name: 'player' }),
      '--cmd', JSON.stringify({ op: 'add_component', id: 1, type: 'game.Health', data: { max: 100 } }),
      '--cmd', JSON.stringify({ op: 'set_property', id: 1, type: 'game.Health', path: ['max'], value: 120 }),
      '--json',
    ], dir);
    assert.equal(r.status, 0, r.err + r.out);
    assert.deepEqual(JSON.parse(r.out).applied, ['create_entity', 'add_component', 'set_property']);
    const scene = JSON.parse(readFileSync(sceneFile, 'utf8'));
    assert.equal(scene.entities.length, 1);
    assert.equal(scene.entities[0].components[0].data.max, 120);
    assert.equal(scene.meta.generator, 'ccx-cli scene apply');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test('ccx build：经 daemon 的 Builder RPC', async () => {
  const r = runCli(['build', '--platform', 'web-desktop', '--project', 'MyGame', '--json'],
                   join(import.meta.dirname, '..'));
  assert.equal(r.status, 0, r.err + r.out);
  const out = JSON.parse(r.out);
  assert.equal(out.ok, true);
  assert.equal(out.platform, 'web-desktop');
  assert.ok(out.traceSteps >= 5, 'hooks 已走');
  // 未知平台 -> 明确错误
  const bad = runCli(['build', '--platform', 'ps5', '--json'], join(import.meta.dirname, '..'));
  assert.equal(bad.status, 1);
  const out2 = JSON.parse(bad.out);
  assert.equal(out2.ok, false);
});

test('scene apply：非法命令拒绝且不写坏文件', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-apply-bad-'));
  try {
    const sceneFile = join(dir, 's.scene.json');
    runCli(['scene', 'new', '--at', sceneFile], dir);
    const before = readFileSync(sceneFile, 'utf8');
    const r = runCli([
      'scene', 'apply', sceneFile,
      '--cmd', JSON.stringify({ op: 'destroy_entity', id: 999 }),
      '--json',
    ], dir);
    assert.equal(r.status, 0, 'destroy 不存在的实体应幂等成功');
    const json = JSON.parse(r.out);
    assert.equal(json.ok, true);
    assert.equal(before.length > 0, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
