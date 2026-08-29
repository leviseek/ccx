// 时之三重奏 · 引擎 wasm 构建（emcc；产物 site 复制由 build_site 完成）
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { dirname, fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const outDir = resolve(process.argv[2] ?? join(root, 'build', 'chrono-wasm'));
const cpp = join(root, 'engine', 'render', 'wasm', 'render_wasm.cpp');
const incs = ['foundation', 'render'].map((m) => '-I' + join(root, 'engine', m, 'include')).join(' ');
try {
  execFileSync('emcc', [
    cpp, '-O2', '-s', 'WASM=1', '-s', 'EXPORTED_FUNCTIONS=["_ccx_render_frame"]',
    '-s', 'ALLOW_MEMORY_GROWTH=1', '-s', 'EXPORTED_RUNTIME_METHODS=["cwrap"]',
    '-o', join(outDir, 'chrono_game.wasm'), incs.split(' '),
  ].flat(), { cwd: root, stdio: 'pipe' });
  console.log('[chrono-wasm] built ' + join(outDir, 'chrono_game.wasm'));
} catch (e) {
  console.warn('[chrono-wasm] emcc 不可用，跳过（运行时回退 JS 精灵渲染）: ' + e.message);
  process.exitCode = 0;
}
