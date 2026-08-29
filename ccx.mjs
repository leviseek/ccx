#!/usr/bin/env node
// 仓库内 ccx 便捷入口（单一事实源：转调 packages/cli/bin/ccx.mjs）
// 用法：node ccx.mjs <子命令> [参数]   （任意 cwd；保持当前目录语义）
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const realCli = resolve(join(here, 'packages', 'cli', 'bin', 'ccx.mjs'));
try {
  process.exitCode = execFileSync(process.execPath, [realCli, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });  // 退出码透传（0 时 exitCode 置 0 无害）
} catch (e) {
  process.exitCode = typeof e?.status === 'number' ? e.status : 1;
}
