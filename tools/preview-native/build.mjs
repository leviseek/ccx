// 桌面原生预览器构建（Windows；w64devkit g++ 一键）
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = resolve(process.argv[2] ?? join(root, 'build', 'local'));
mkdirSync(out, { recursive: true });
const inc = ['foundation', 'render', 'gfx', 'scene', 'platform'].map((m) => '-I' + join(root, 'engine', m, 'include')).join(' ');
const incWin = '-I' + join(root, 'engine', 'platform', 'win32');
const toolchain = 'D:/engine/w64devkit/bin';
execFileSync(toolchain + '/g++.exe', [
  '-std=c++20', '-O2', inc.split(' '), incWin,
  join(root, 'engine', 'platform', 'win32', 'display_win32.cpp'),
  join(root, 'tools', 'preview-native', 'preview_native.cpp'),
  '-o', join(out, 'preview_native.exe'),
  // 引擎模块静态库（CMake 构建产物；反向依赖排序）
  '-L' + join(root, 'build', 'local', 'engine', 'gfx'), '-lccx_gfx',
  '-L' + join(root, 'build', 'local', 'engine', 'render'), '-lccx_render',
  '-L' + join(root, 'build', 'local', 'engine', 'scene'), '-lccx_scene',
  '-L' + join(root, 'build', 'local', 'engine', 'foundation'), '-lccx_foundation',
  '-lgdi32', '-luser32',
].flat(), { cwd: root, stdio: 'inherit', env: { ...process.env, Path: toolchain + ';' + (process.env.Path ?? '') } });
console.log('[preview-native] built ' + join(out, 'preview_native.exe'));
