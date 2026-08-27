#!/usr/bin/env node
// ccx-cli（M1：create / scene new 落地；doctor/version 保留）
// 约定：--json 机器可读；--no-interactive 适配 CI。
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const positional = args.filter((a) => !a.startsWith('--'));
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--at') flags.at = args[++i];
    if (args[i] === '--type') flags.type = args[++i];
  }
  const sub = positional[0] ?? 'doctor';

  function emit(obj) {
    console.log(jsonMode ? JSON.stringify(obj, null, 2) : JSON.stringify(obj));
    if (!obj.ok) process.exitCode = 1;
  }

  function dirNonEmpty(dir) {
    try {
      return readdirSync(dir).length > 0;
    } catch {
      return false;
    }
  }

  // —— create <path>：项目脚手架（2D 模板）——
  if (sub === 'create') {
    const target = positional[1] ? resolve(positional[1]) : null;
    if (!target) return emit({ ok: false, error: '用法: ccx create <path> [--type 2d]' });
    if (flags.type && flags.type !== '2d') {
      return emit({ ok: false, error: '目前只支持 2d（范围声明见 README）' });
    }
    if (existsSync(target) && dirNonEmpty(target)) {
      return emit({ ok: false, error: '目标目录非空: ' + target });
    }
    mkdirSync(target, { recursive: true });
    cpSync(join(here, '..', 'templates', 'project'), target, { recursive: true });
    return emit({
      ok: true,
      created: target,
      template: '2d',
      files: ['ccx.project.json', 'scenes/main.scene.json', 'scripts/main.ts'],
    });
  }

  // —— scene new [--at path]：空场景（ADR-003 v1）——
  if (sub === 'scene') {
    if (positional[1] !== 'new') {
      return emit({ ok: false, error: '用法: ccx scene new [--at path]' });
    }
    const out = flags.at ? resolve(flags.at) : resolve('scenes/new.scene.json');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({
      schema: 'ccx.scene/1',
      meta: { name: 'New Scene', generator: 'ccx-cli' },
      entities: [],
      systems: [],
    }, null, 2) + '\n');
    return emit({ ok: true, created: out, schema: 'ccx.scene/1' });
  }

  // —— doctor / version ——
  if (sub === 'version') return emit({ ok: true, name: '@ccx/cli', version: '0.1.0', milestone: 'M1' });
  if (sub === 'doctor') {
    const cwd = process.cwd();
    const git = spawnSync('git', ['--version'], { encoding: 'utf8' });
    return emit({
      ok: true,
      tool: 'ccx doctor',
      cwd,
      checks: {
        node: process.version,
        git: git.status === 0 ? git.stdout.trim() : 'missing',
        'engine/ 骨架': existsSync(join(cwd, 'engine', 'foundation', 'include')),
        'packages/ 骨架': existsSync(join(cwd, 'packages')),
        'docs/ 规格': existsSync(join(cwd, 'docs', 'engine-spec.md')),
        'ci/gates': existsSync(join(cwd, 'ci', 'gates')),
        'CMakeLists': existsSync(join(cwd, 'CMakeLists.txt')),
        'mise.toml': existsSync(join(cwd, '.mise.toml')),
      },
    });
  }
  return emit({
    ok: false,
    error: 'unknown subcommand: ' + sub,
    usage: 'ccx create|scene new|doctor|version [--json]',
  });
}

main();
