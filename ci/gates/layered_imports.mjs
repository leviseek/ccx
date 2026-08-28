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
  scene: ['ecs', 'foundation', 'physics'],
  gfx: ['platform', 'foundation'],
  render: ['scene', 'ecs', 'gfx', 'animation', 'foundation'],
  animation: ['scene', 'ecs', 'foundation'],
  physics: ['scene', 'ecs', 'foundation'],
  audio: ['foundation'],
  ui: ['render', 'scene', 'ecs', 'foundation'],
  input: ['platform', 'foundation'],
  asset: ['foundation'],
  assets: ['foundation'],          // 仓库目录名（asset-spec）
  game: ['foundation', 'ecs'],     // 帧循环（game-spec）
  particle: ['foundation'],        // 粒子（engine-spec §7）
  script: ['scene', 'ecs', 'foundation'],  // 脚本宿主（W5a QuickJS）
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