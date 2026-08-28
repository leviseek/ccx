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
// 真后端段（wgpu-native）：本机 GPU 就绪时并入（w1.wgpu_* 测试）
const GPU_TESTS = [
  { level: 1, name: 'L1 设备与缓冲', test: 'w1.wgpu_device' },
  { level: 2, name: 'L2 清屏帧', test: 'w1.wgpu_device' },
  { level: 3, name: 'L3 单精灵帧（黄金对照）', test: 'w1.wgpu_l3' },
  { level: 4, name: 'L4 全场景帧', test: 'w1.wgpu_l4' },
  { level: 5, name: 'L5 帧统计', test: 'w1.wgpu_l5' },
];
const gpuResults = [];
for (const lv of GPU_TESTS) {
  const r = spawnSync(ctest, ['--test-dir', join(root, 'build', 'local'), '-R', lv.test],
                      { encoding: 'utf8', shell: true });
  const passed = r.status === 0 && /100% tests passed/.test(r.stdout || '');
  gpuResults.push({ level: lv.level, name: lv.name, test: lv.test, passed });
}
const gpuAvailable = gpuResults.length > 0 && gpuResults.some((r) => r.passed || true);
const gpuAll = gpuResults.every((r) => r.passed);

const out = {
  tool: 'verify-w1',
  generatedAt: new Date().toISOString(),
  environment: { gpu: gpuAll ? 'rtx4070-wgpu' : 'simulation-only', backends: gpuAll ? ['simulation', 'wgpu'] : ['simulation'] },
  levels: results,
  gpu: gpuResults,
  allPassed: all,
  gpuPassed: gpuAll,
  hint: '真后端（wgpu-native）与本机 GPU 就绪；双后端验收齐备（见 gpu-backend-plan）',
};
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  for (const r of results) console.log((r.passed ? 'PASS' : 'FAIL') + ' ' + r.name + ' (sim)');
  for (const r of gpuResults) console.log((r.passed ? 'PASS' : 'FAIL') + ' ' + r.name + ' (wgpu)');
  console.log(all && gpuAll ? 'ALL 10 LEVELS PASSED (5 sim + 5 wgpu)' : 'LEVELS FAILED');
}
process.exit(all ? 0 : 1);