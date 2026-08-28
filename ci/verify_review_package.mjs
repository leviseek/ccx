#!/usr/bin/env node
// M2 评审包自检：材料存在性 + 一键复核命令实跑（评审前预检）
// 用法：node ci/verify_review_package.mjs [--json]
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = import.meta.dirname;
const root = join(here, '..');
const docs = join(root, 'docs', 'working');
const node = process.execPath;
const cli = join(root, 'packages', 'cli', 'bin', 'ccx.mjs');

const MATERIALS = [
  'm1-final-summary.md', 'm1-final-summary.json', 'm1-architecture.html',
  'm2-proposal.md', 'm2-gate-dress-rehearsal.md', 'm2-tickets.md',
  'script-engine-decision.md', 'gpu-backend-plan.md', 'ci-push-checklist.md',
  'm2-review-package.md',
];

const materials = MATERIALS.map((f) => ({ file: f, exists: existsSync(join(docs, f)) }));

// 一键复核命令（评审包 §一键复核）
const commands = [
  { name: 'doctor --all --verify', run: [node, [cli, 'doctor', '--all', '--verify', '--json']],
    check: (out) => out.ok && out.w1?.ok && out.m2Batch1?.ok },
  { name: 'doctor --all', run: [node, [cli, 'doctor', '--all', '--json']],
    check: (out) => out.ok && out.checks && out.summary && out.demo },
  { name: 'demo all', run: [node, [cli, 'demo', 'all', '--json']],
    check: (out) => out.ok && out.steps?.length === 15 },
];

const cmdResults = [];
for (const c of commands) {
  const r = spawnSync(c.run[0], c.run[1], { encoding: 'utf8', timeout: 240000,
                                            env: { ...process.env,
                                                   CC_CTEST: process.env.CC_CTEST ?? '' } });
  let out = null;
  try {
    out = JSON.parse(r.stdout || '');
  } catch {
    /* noop */
  }
  const passed = r.status === 0 && out && c.check(out);
  cmdResults.push({ name: c.name, passed, status: r.status,
                    detail: passed ? 'ok' : (out ? JSON.stringify(out).slice(0, 90)
                                                : (r.stderr || '').slice(0, 90)) });
}

const all = materials.every((m) => m.exists) && cmdResults.every((c) => c.passed);
const out = { tool: 'verify-review-package', materials, commands: cmdResults, allPassed: all };
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  for (const m of materials) console.log((m.exists ? 'PASS' : 'FAIL') + ' material ' + m.file);
  for (const c of cmdResults) console.log((c.passed ? 'PASS' : 'FAIL') + ' command ' + c.name);
  console.log(all ? 'REVIEW PACKAGE READY' : 'REVIEW PACKAGE NOT READY');
}
process.exit(all ? 0 : 1);
