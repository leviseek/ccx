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
