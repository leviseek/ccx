#!/usr/bin/env node
// ccx-cli 壳（v0.1，M0 占位）：
// - 输出约定：--json（机器可读）/ 默认人类可读（当前即 JSON）
// - --no-interactive：CI 场景（doctor/version 天然无交互）
// 完整命令面（create/build/start-mcp-server/wizard/pack/asset/scene/...）M1 起转调 Service API。
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const sub = args.find((a) => !a.startsWith('-')) ?? 'doctor';

function emit(obj) {
  console.log(jsonMode ? JSON.stringify(obj, null, 2) : JSON.stringify(obj));
  if (!obj.ok) process.exitCode = 1;
}

if (sub === 'version') {
  emit({ ok: true, name: '@ccx/cli', version: '0.0.0', milestone: 'M0 骨架' });
} else if (sub === 'doctor') {
  const cwd = process.cwd();
  const git = spawnSync('git', ['--version'], { encoding: 'utf8' });
  emit({
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
} else {
  emit({ ok: false, error: 'unknown subcommand: ' + sub, usage: 'ccx doctor|version [--json]' });
}
