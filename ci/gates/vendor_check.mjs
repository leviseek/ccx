#!/usr/bin/env node
// 门禁 2：vendor 纪律（ADR-005 §4/§7）
// - 每个 vendor 包必须带 UPSTREAM.md（来源 commit/同步日期/本地改动清单）
// - UPSTREAM.md 声明本地改动时必须配套 patches/
// - 缺 LICENSE 给警告（MIT 合规）
// 用法：node ci/gates/vendor_check.mjs [repo-root]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');

function findVendorDirs(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (['.git', 'node_modules', 'build'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'vendor') out.push(p);
      else findVendorDirs(p, out);
    }
  }
  return out;
}

const vendors = findVendorDirs(root);
if (vendors.length === 0) {
  console.log('[vendor_check] OK: 当前无 vendor 目录（空通过；M1 vendor 落地后本门禁生效）');
  process.exit(0);
}

const violations = [];
const warnings = [];
let pkgs = 0;
for (const dir of vendors) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkg = path.join(dir, entry.name);
    ++pkgs;
    const upstream = path.join(pkg, 'UPSTREAM.md');
    if (!fs.existsSync(upstream)) {
      violations.push(path.relative(root, pkg) + ': 缺少 UPSTREAM.md（必须记录来源 commit/同步日期/本地改动）');
      continue;
    }
    const text = fs.readFileSync(upstream, 'utf8');
    const m = text.match(/LOCAL[- ]?CHANGES\s*:\s*(\d+)/i);
    const hasChanges = (m && m[1] !== '0') ||
      /^\s*-\s+/m.test((text.split('Local Changes')[1] ?? '')) ||
      /^\s*-\s+/m.test((text.split('LOCAL CHANGES')[1] ?? ''));
    if (hasChanges && !fs.existsSync(path.join(pkg, 'patches'))) {
      violations.push(path.relative(root, pkg) +
        ': UPSTREAM.md 声明本地改动但缺 patches/（改动必须走 patch 文件，ADR-005 §7）');
    }
    if (!fs.existsSync(path.join(pkg, 'LICENSE'))) {
      warnings.push(path.relative(root, pkg) + ': 缺少 LICENSE（MIT 合规要求，ADR-005 §4）');
    }
  }
}
for (const w of warnings) console.warn('[vendor_check] WARN: ' + w);
if (violations.length > 0) {
  for (const v of violations) console.error('[vendor_check] FAIL: ' + v);
  process.exit(1);
}
console.log('[vendor_check] OK: ' + pkgs + ' vendor package(s) 合规（ADR-005 §4/§7）');
