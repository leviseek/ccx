#!/usr/bin/env node
// vendor 同步工具（ADR-005 §4/§7 + docs/working/vendor-candidates.md）
// 用法：node tools/vendor/sync.mjs [--stage <dir>] [--offline]
//  - 以 blobless 稀疏克隆 cocos4 @ v4.0.0，只取清单内路径
//  - 按 pkg 映射拷贝进 engine/platform/vendor/<pkg>/upstream/，并写 UPSTREAM.md/LICENSE
//  - 本地禁止改 vendor 源码（改动必须走 patches/，ADR-005 §7）
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const stage = join(root, 'build', 'vendor-stage');
const repo = join(stage, 'cocos4');
const vendorRoot = join(root, 'engine', 'platform', 'vendor');
const UPSTREAM = 'https://github.com/cocos/cocos4';
const TAG = 'v4.0.0';

// V1-V9（vendor-candidates.md）：pkg -> 来源子路径（相对 native/cocos/）
const PKGS = [
  { pkg: 'pal', src: 'platform', skip: ['ohos', 'openharmony', 'qnx'] },
  { pkg: 'audio', src: 'audio', skip: [] },
  { pkg: 'storage', src: 'storage', skip: [] },
  { pkg: 'main', src: 'main', skip: [] },
];
const SKIP_SUBDIRS = new Set(['ohos', 'openharmony', 'qnx']);

function sh(args, opts) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}

// 1) 克隆（blobless + 稀疏）
if (!existsSync(join(repo, '.git'))) {
  mkdirSync(stage, { recursive: true });
  console.log('[sync] 克隆 cocos4 (blobless)...');
  sh(['clone', '--depth', '1', '--filter=blob:none', '--no-checkout', '--branch', TAG,
      UPSTREAM, repo]);
}
const commit = sh(['rev-parse', 'HEAD'], { cwd: repo }) ||
               sh(['rev-parse', 'origin/' + TAG], { cwd: repo });
console.log('[sync] upstream commit:', commit);

// 2) 稀疏检出目标路径
if (!existsSync(join(repo, 'native', 'cocos'))) {
  sh(['sparse-checkout', 'init', '--cone'], { cwd: repo });
  sh(['sparse-checkout', 'set', ...PKGS.map((p) => 'native/cocos/' + p.src)], { cwd: repo });
  sh(['checkout', TAG], { cwd: repo });
}

// 3) 拷贝 + 元数据
const date = new Date().toISOString().slice(0, 10);
for (const { pkg, src } of PKGS) {
  const from = join(repo, 'native', 'cocos', src);
  const to = join(vendorRoot, pkg, 'upstream');
  rmSync(join(vendorRoot, pkg), { recursive: true, force: true });
  mkdirSync(join(vendorRoot, pkg), { recursive: true });

  if (pkg === 'pal') {
    const entries = readdirSync(from, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && SKIP_SUBDIRS.has(e.name)) continue;
      cpSync(join(from, e.name), join(to, e.name), { recursive: true });
    }
  } else {
    cpSync(from, to, { recursive: true });
  }
  const files = countFiles(to);
  writeFileSync(join(vendorRoot, pkg, 'UPSTREAM.md'),
    '# UPSTREAM: ' + pkg + '\n\n' +
    '- \u6765\u6e90\uff1a' + UPSTREAM + '\n' +
    '- tag\uff1a' + TAG + ' \u00b7 commit\uff1a' + commit + '\n' +
    '- \u540c\u6b65\u65e5\u671f\uff1a' + date + '\n' +
    '- LOCAL-CHANGES: 0\n' +
    '- \u6587\u4ef6\u6570\uff1a' + files + '\n' +
    '- \u7eaa\u5f8b\uff08ADR-005 \u00a77\uff09\uff1a\u7981\u6b62\u76f4\u63a5\u4fee\u6539\u672c\u76ee\u5f55\uff1b\u672c\u5730\u6539\u52a8\u5fc5\u987b\u843d patches/ \u5e76\u767b\u8bb0 localChanges\u3002\n');
  for (const f of ['LICENSE', 'AUTHORS.txt']) {
    const uf = join(repo, f);
    if (existsSync(uf)) cpSync(uf, join(vendorRoot, pkg, f));
  }
  console.log('[sync]', pkg, '->', files, 'files');
}

function countFiles(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(join(dir, e.name));
    else n++;
  }
  return n;
}

console.log('[sync] \u5b8c\u6210\u3002\u8fd0\u884c ci/gates/vendor_check.mjs \u9a8c\u8bc1\u7eaa\u5f8b\u3002');
