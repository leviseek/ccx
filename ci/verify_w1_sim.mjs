#!/usr/bin/env node
// W1 五级里程碑验收（仿真侧）：GPU 到达前每天可跑；到达后同骨架接真后端段
// 用法：node ci/verify_w1_sim.mjs [--json]
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = import.meta.dirname;
const root = join(here, '..');
const ctest = process.env.CC_CTEST ?? 'ctest';

// 五级 -> 仿真测试（CTest 名）+ 说明
const LEVELS = [
  { level: 1, name: 'L1 设备与缓冲', test: 'rhi_fake', note: 'createBuffer/upload/readback 环回' },
  { level: 2, name: 'L2 清屏帧', test: 'fake_gpu_frame', note: 'clear 后全像素断言' },
  { level: 3, name: 'L3 单精灵帧', test: 'render_frame', note: '黄金 PPM 对照（软件光栅）' },
  { level: 4, name: 'L4 全场景帧', test: 'fake_gpu_runtime', note: 'demo 场景每帧上传/绘制/提交' },
  { level: 5, name: 'L5 帧统计', test: 'script_to_frame', note: '脚本创作场景经引擎消费（同 metrics 面）' },
];

const results = [];
for (const lv of LEVELS) {
  const r = spawnSync(ctest, ['--test-dir', join(root, 'build', 'local'), '-R', lv.test],
                      { encoding: 'utf8', shell: true });
  const passed = r.status === 0 && /100% tests passed/.test(r.stdout || '');
  results.push({ level: lv.level, name: lv.name, test: lv.test, passed, note: lv.note });
}

const all = results.every((r) => r.passed);
const out = {
  tool: 'verify-w1-sim',
  generatedAt: new Date().toISOString(),
  environment: { gpu: 'not-available', backend: 'simulation' },
  levels: results,
  allPassed: all,
  hint: 'GPU/lavapipe 到达后：同一骨架接 wgpu-native 段（见 gpu-backend-plan 附录 B）',
};
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  for (const r of results) console.log((r.passed ? 'PASS' : 'FAIL') + ' ' + r.name);
  console.log(all ? 'ALL SIM LEVELS PASSED' : 'SIM LEVELS FAILED');
}
process.exit(all ? 0 : 1);
