#!/usr/bin/env node
// 门禁 3：schema round-trip（ADR-003 §6）—— 由 CMake 构建产物 + ctest 强制执行
// - 本地未构建时输出 SKIP（exit 0）；真实门禁在 CI build 任务的 ctest 步骤
// - 可显式指定构建目录：node ci/gates/schema_roundtrip.mjs build/ci-linux
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const explicit = process.argv[2] && process.argv[2] !== '.';
const buildDir = process.env.CCX_BUILD_DIR ?? (explicit ? process.argv[2] : null);

if (!buildDir || !existsSync(buildDir)) {
  console.log('[schema_roundtrip] SKIP: 无构建目录（门禁由 CI 的 ctest 步骤强制执行）');
  process.exit(0);
}
const r = spawnSync('ctest', ['--test-dir', buildDir, '--output-on-failure'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);
