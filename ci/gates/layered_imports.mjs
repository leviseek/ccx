#!/usr/bin/env node
// 门禁 1：依赖方向 lint（铁律 1/6；engine-spec §1 依赖图）
// 用法：node ci/gates/layered_imports.mjs [repo-root]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const engineRoot = path.join(root, 'engine');

// engine-spec §1 mermaid：允许的向下依赖集合
const ALLOWED = {
  foundation: [],
  ecs: ['foundation'],
  scene: ['ecs', 'foundation'],
  gfx: ['platform', 'foundation'],
  render: ['scene', 'ecs', 'gfx', 'foundation'],
  animation: ['scene', 'ecs', 'foundation'],
  physics: ['scene', 'ecs', 'foundation'],
  audio: ['foundation'],
  ui: ['render', 'scene', 'ecs', 'foundation'],
  input: ['platform', 'foundation'],
  asset: ['foundation'],
  scripting: ['ecs', 'foundation'],
  network: ['foundation'],
  platform: ['foundation'],
  app: null,
};
// 全局禁止（铁律 1）：引擎不得依赖编辑器/服务/CLI/MCP/兼容层
const FORBIDDEN = ['editor', 'services', 'cli', 'mcp', 'extensions', 'compat'];
const SRC_EXT = ['.h', '.hpp', '.cpp', '.cc', '.cxx'];

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === '.git' || e.name === 'node_modules' || e.name === 'build' ||
        e.name.startsWith('CMakeFiles')) {
      continue;
    }
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p, out);
    } else if (SRC_EXT.includes(path.extname(e.name).toLowerCase())) {
      out.push(p);
    }
  }
  return out;
}

const includeRe = /#\s*include\s*[<"]([^>"]+)[>"]/g;
const violations = [];
let filesChecked = 0;

for (const file of walk(engineRoot)) {
  const rel = path.relative(engineRoot, file);
  const moduleName = rel.split(path.sep)[0];
  if (moduleName === 'tests') continue; // 测试可依赖任意引擎模块
  const allowed = ALLOWED[moduleName];
  if (allowed === undefined) {
    violations.push(rel + ': 未登记模块（请在 ALLOWED 中登记）');
    continue;
  }
  const src = fs.readFileSync(file, 'utf8');
  includeRe.lastIndex = 0;
  let m;
  while ((m = includeRe.exec(src)) !== null) {
    const inc = m[1];
    const parts = inc.split(/[\\/]/);
    if (parts.some((p) => FORBIDDEN.includes(p))) {
      violations.push(rel + ': 禁止引用 "' + inc + '"（引擎不得依赖 ' + FORBIDDEN.join('/') + '）');
      continue;
    }
    if (inc.startsWith('ccx/')) {
      const target = parts[1] ?? '';
      if (target === moduleName) continue;
      if (allowed !== null && !allowed.includes(target)) {
        violations.push(rel + ': ' + moduleName + ' -> ' + target +
          ' 违反依赖方向（允许: ' + (allowed.join(', ') || '无') + '）');
      }
    }
  }
  ++filesChecked;
}

if (violations.length > 0) {
  console.error('[layered_imports] FAIL: ' + violations.length + ' violation(s)');
  for (const v of violations) console.error('  ' + v);
  process.exit(1);
}
console.log('[layered_imports] OK: ' + filesChecked + ' files，engine 依赖方向合规（铁律 1/6）');
