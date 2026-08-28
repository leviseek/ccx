#!/usr/bin/env node
// M2 首批验收走查：ticket 清单（m2-tickets.md）🟦 9 张逐张执行验收凭据
// 用法：node ci/verify_m2_batch1.mjs [--json]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = import.meta.dirname;
const root = join(here, '..');
const node = process.execPath;
const ctest = process.env.CC_CTEST ?? 'ctest';
const tdir = join(root, 'build', 'local');
const t = (f) => join(root, 'packages', f);

// ticket -> 验收执行（命令形态）
const TICKETS = [
  { ticket: 'T-W3-1', title: '场景会话 undo/redo/status RPC',
    run: [node, [t('service-core/test/daemon.test.mjs')]], kind: 'node' },
  { ticket: 'T-W3-2', title: '会话版本化 + session.save/load',
    run: [node, [t('service-core/test/daemon.test.mjs')]], kind: 'node' },
  { ticket: 'T-W4-1', title: '外部压缩器接口 + 配置接入',
    run: [node, [t('asset-service/test/cook.test.mjs')]], kind: 'node' },
  { ticket: 'T-W5-1', title: 'QuickJS 嵌入（eval/错误/状态/预算）',
    run: [ctest, ['--test-dir', tdir, '-R', 'script.host']], kind: 'ctest' },
  { ticket: 'T-W5-2', title: '宿主函数 + JSON 命令桥 + 正式场景 API',
    run: [ctest, ['--test-dir', tdir, '-R', 'script.scene']], kind: 'ctest' },
  { ticket: 'T-W5-3', title: '事件桥 onUpdate(dt)',
    run: [ctest, ['--test-dir', tdir, '-R', 'script.game_loop']], kind: 'ctest' },
  { ticket: 'T-W5-4', title: '引擎脚本执行器 + CLI --engine',
    run: [node, [t('cli/test/script_runner.test.mjs')]], kind: 'node' },
  { ticket: 'T-W5-5', title: '跨语言一致性对拍',
    run: [node, [t('cli/test/cross_script_consistency.test.mjs')]], kind: 'node' },
  { ticket: 'T-W2-1', title: '编辑器预览闭环（依赖 W1 预览，仿真侧冒烟）',
    run: [node, [t('cli/test/cli.test.mjs')], { srcGrep: 'ccx editor preview' }], kind: 'node-partial' },
];

const results = [];
for (const tk of TICKETS) {
  const [cmd, args, opts = {}] = tk.run;
  const args2 = tk.kind === 'node' || tk.kind === 'node-partial'
    ? [...args.slice(0, -1), '--test-timeout=20000',
       ...(tk.ticket === 'T-W2-1' ? ['--test-name-pattern=preview'] : []),
       args[args.length - 1]]
    : args;
  const r = spawnSync(cmd, args2, { encoding: 'utf8', shell: true, timeout: 120000,
                                    env: { ...process.env, CC_CTEST: process.env.CC_CTEST ?? ctest } });
  let passed = r.status === 0;
  if (passed && opts.grep) passed = ((r.stdout || '') + (r.stderr || '')).includes(opts.grep);
  if (passed && opts.srcGrep) {
    try {
      passed = readFileSync(args[args.length - 1], 'utf8').includes(opts.srcGrep);
    } catch {
      passed = false;
    }
  }
  results.push({ ticket: tk.ticket, title: tk.title, kind: tk.kind, passed });
}
const all = results.every((r) => r.passed);
const out = { tool: 'verify-m2-batch1', tickets: results, allPassed: all,
              note: 'm2-tickets.md 🟦 首批 9 张；复核路径≈10s' };
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  for (const r of results) console.log((r.passed ? 'PASS' : 'FAIL') + ' ' + r.ticket + ' ' + r.title);
  console.log(all ? 'ALL 9 TICKETS PASSED' : 'TICKETS FAILED');
}
process.exit(all ? 0 : 1);
