// 时之三重奏 · 静态站点构建（Web 发布产物：index.html + game.js + 运行时 JS(tsc) + 资产 PNG + 关卡索引）
// 产物目录：site/chrono/（可直接 GitHub Pages 发布；assets.json 可被 build-service 校验）
// 工具脚本（mjs）；业务运行时为 TypeScript（ADR-001），经 tsc 转译为浏览器 ESM
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSprites } from '../src/sprites.ts';
import { CHAPTERS } from '../src/levels.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const site = resolve(process.argv[2] ?? join(root, 'site', 'chrono'));

rmSync(site, { recursive: true, force: true });
mkdirSync(join(site, 'assets'), { recursive: true });

// 1) 资产：精灵 PNG（经 asset-service png_writer 全链）
const sprites = buildSprites();
const assets = [];
for (const [name, s] of Object.entries(sprites)) {
  const path = 'assets/' + name + '.png';
  writeFileSync(join(site, path), s.png);
  assets.push({ uuid: 'sprite-' + name, path });
}

// 2) 关卡索引（ccx.levels.index/1）
const levelsDoc = { schema: 'ccx.levels.index/1', chapter: CHAPTERS[0].id, levels: CHAPTERS[0].levels };
writeFileSync(join(site, 'levels.json'), JSON.stringify(levelsDoc, null, 1));

// 3) 运行时：TypeScript -> Node 内置 stripTypeScriptTypes 转译（保留 ESM；.ts 导入改写为 .js）
//    镜像 src 结构到 site/（相对导入链 ../chrono_engine.js 保持有效）
import { stripTypeScriptTypes } from 'node:module';
const runtimeFiles = [
  'chrono_engine.ts', 'levels.ts', 'sprite_data.ts', 'metrics.ts',
  'runtime/scene_draw.ts', 'runtime/renderer.ts', 'runtime/input.ts', 'runtime/main.ts',
  'runtime/audio.ts', 'runtime/wasm_render.ts',
  // 平台桥（platform-web）：显示/输入/渠道适配器（与运行时同链进站点镜像）
  { root: 'packages/platform-web', rel: 'viewport.ts' },
  { root: 'packages/platform-web', rel: 'web_bridge.ts' },
  // 引擎 wasm（渐进增强；产物存在才携带）
  { root: 'examples/games/chrono-echo', rel: 'build/chrono-wasm/chrono_game.wasm' },
];
function transpileToJs(entry) {
  const rel = typeof entry === 'string' ? entry : entry.rel;
  const srcRoot = typeof entry === 'string'
    ? join(root, 'examples', 'games', 'chrono-echo', 'src')
    : join(root, entry.root, 'src');
  const srcPath = join(srcRoot, rel);
  const isWasm = rel.endsWith('.wasm');
  if (!existsSync(srcPath)) {
    if (typeof entry !== 'string' && isWasm) return rel;   // 可选产物：缺失跳过（渐进增强）
    throw new Error('缺失运行时源: ' + rel);
  }
  const outRel = (typeof entry === 'string')
    ? rel.replace(/\.ts$/, '.js')                                     // game-chrono -> site/<rel>（保持相对链）
    : (isWasm ? 'chrono_game.wasm'                                     // 引擎 wasm -> 站点根（fetch 相对 index.html）
              : 'platform-web/src/' + rel.replace(/\.ts$/, '.js'));  // 跨包 -> site/platform-web/src/（main 相对导入 ../../platform-web/src/ 命中）
  if (isWasm) {
    const outPath = join(site, outRel);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, readFileSync(srcPath));
    return outRel;
  }
  let code = readFileSync(srcPath, 'utf8');
  code = code.replace(/(from\s+['"])([^'"]+)\.ts(['"])/g, (m, a, b, c) => a + b + '.js' + c);
  code = stripTypeScriptTypes(code);
  const outPath = join(site, outRel);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, code);
  return outRel;
}
const runtimeBuilt = runtimeFiles.map(transpileToJs);

// 4) 页与装配脚本
writeFileSync(join(site, 'index.html'), [
  '<!doctype html><html lang="zh"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<title>时之三重奏 Chrono Echo</title>',
  '<style>',
  'body{margin:0;background:#0b0c1a;color:#e8e8ff;font:14px monospace;display:flex;flex-direction:column;align-items:center;}',
  '#ccx-title{margin:14px 0 4px;font-size:20px;letter-spacing:2px;}',
  '#ccx-sub{color:#7f88b8;font-size:12px;margin-bottom:12px;}',
  '#ccx-canvas{border:1px solid #33365a;border-radius:6px;box-shadow:0 0 24px rgba(76,191,168,.25);display:block;margin:0 auto;}',
  '#ccx-controls{margin:12px 0;color:#9fe2d0;font-size:12px;}',
  '#ccx-overlay{position:absolute;inset:0;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;background:rgba(11,12,26,.82);}',
  '#ccx-overlay.hidden{display:none;}',
  '.ccx-win-title{font-size:26px;letter-spacing:3px;color:#ffd75e;}',
  '.ccx-win-stats{font-size:14px;color:#e8e8ff;}',
  '#ccx-overlay button{font:14px monospace;padding:8px 18px;border:1px solid #4cbfa8;background:#13223a;color:#9fe2d0;border-radius:4px;cursor:pointer;}',
  '#ccx-overlay button:hover{background:#1d3a52;}',
  '#ccx-touch-buttons{display:flex;gap:10px;justify-content:center;margin-top:10px;flex-wrap:wrap;}',
  '#ccx-touch-buttons button{font:20px monospace;padding:10px 22px;border:1px solid #4cbfa8;background:#13223a;color:#9fe2d0;border-radius:8px;cursor:pointer;touch-action:none;user-select:none;}',
  '#ccx-touch-buttons button:active{background:#1d3a52;}',
  '</style></head><body>',
  '<div id="ccx-title">时之三重奏 · Chrono Echo</div>',
  '<div id="ccx-sub">时间采掘公司第一章 · 遗迹采掘（残影 = 过去的你）</div>',
  '<div style="position:relative">',
  '<canvas id="ccx-canvas"></canvas>',
  '<div id="ccx-overlay" class="hidden">',
  '<div class="ccx-win-title"></div><div class="ccx-win-stats"></div>',
  '<div><button id="ccx-retry">重玩本关</button> ',
  '<button id="ccx-prev">上一关</button> ',
  '<button id="ccx-next">下一关</button> ',
  '<button id="ccx-share" style="display:none">分享</button></div>',
  '</div></div>',
  '<div id="ccx-controls">←→/AD 移动 · 空格/W/↑ 跳跃 · R 录制/停止 · E 召唤残影 · Q 与残影换位 · P 暂停 · 选关 ?level=1-N</div>',
  '<div id="ccx-pause-hint" style="color:#4cbfa8;height:16px;margin-bottom:8px;"></div>',
  '<div id="ccx-touch-buttons">',
  '<button id="ccx-btn-left">◀</button> <button id="ccx-btn-right">▶</button>',
  '<button id="ccx-btn-jump">跳</button> <button id="ccx-btn-rec">R</button>',
  '<button id="ccx-btn-sum">E</button> <button id="ccx-btn-swap">Q</button>',
  '</div>',
  '<script type="module" src="game.js"></script></body></html>', '',
].join('\n'));

writeFileSync(join(site, 'game.js'),
  '// 时之三重奏 启动（ESM；window.CCX 兼容）\n' +
  'window.CCX = window.CCX || { game: "chrono-echo" };\n' +
  "import './runtime/main.js';\n");

// 5) 资产索引（build-service parseAssetsIndex 可消费）
writeFileSync(join(site, 'assets.json'),
  JSON.stringify({ schema: 'ccx.assets.index/1', platform: 'web-desktop', assets }, null, 2));

console.log('[chrono-site] ' + site);
console.log('[chrono-site] sprites=' + assets.length + ' levels=' + levelsDoc.levels.length + ' runtime=' + runtimeBuilt.length);
