// 时之三重奏 · pixel-art 精灵资产生成（Node 侧：字符图 -> RGBA -> PNG，经 asset-service png_writer）
// 主题：时间采掘公司（冷色 + 金碎片）；所有元素 16x16（tile 单位）
import { encodePng } from '../../asset-service/src/png_writer.mjs';

// 调色板（字符 -> RGBA）
export const PALETTE = {
  '.': null,
  'k': [0x1b, 0x1b, 0x2f, 255],  // 深蓝黑
  'b': [0x4e, 0x6b, 0xd8, 255],  // 主体蓝
  'B': [0x7f, 0xa0, 0xff, 255],  // 亮蓝
  'w': [0xe8, 0xe8, 0xff, 255],  // 白
  'g': [0x9f, 0xe2, 0xd0, 255],  // 青
  'G': [0x4c, 0xbf, 0xa8, 255],  // 青绿
  'y': [0xff, 0xd7, 0x5e, 255],  // 金
  'r': [0xe0, 0x52, 0x52, 255],  // 红
  'v': [0x8a, 0x5f, 0xd8, 255],  // 紫
  'n': [0x6b, 0x6f, 0x8f, 255],  // 灰石板
  't': [0x3b, 0x3d, 0x5c, 255],  // 暗砖
  'd': [0x2b, 0x2d, 0x48, 255],  // 深砖
};

// 字符图（16 行 x 16 列；'k' 为轮廓色）
const ART = {
  player: [
    '................',
    '......kkkk......',
    '.....kBBBBk.....',
    '....kBBBBBBk....',
    '....kBwkwwBk....',
    '....kBBBBBBk....',
    '.....kBBBBk.....',
    '..k.kBBBBBBk.k..',
    '.kBBkbbbbbbkBBk.',
    '.kBBbbbbbbbbbBk.',
    '.kbbbbbbbbbbbbk.',
    '.kbbbbbbbbbbbbk.',
    '.kbkbbbbbbbbkbk.',
    '..k.kbbbbbbk.k..',
    '.....kbbbbk.....',
    '......kkkk......',
  ],
  echo: [
    '................',
    '......gggg......',
    '.....gGGGGg.....',
    '....gGGGGGGg....',
    '....gGgwwgGg....',
    '....gGGGGGGg....',
    '.....gGGGGg.....',
    '..g.gGGGGGGg.g..',
    '.gGGggggggggGGg.',
    '.gGGgggggggggGg.',
    '.gggggggggggggg.',
    '.gggggggggggggg.',
    '.gGggggggggGgGg.',
    '..g.ggggggg.g..',
    '.....gggggg....',
    '......gggg......',
  ],
  tile: [
    'tttttttttttttttt',
    'tttttttttttttttt',
    'tttttttttttttttt',
    'tttttttttttttttt',
    'tttttttttttttttt',
    'tttttttttttttttt',
    'tttttttttttttttt',
    'tttttttttttttttt',
    'dddddddddddddddd',
    'dddddddddddddddd',
    'dddddddddddddddd',
    'dddddddddddddddd',
    'dddddddddddddddd',
    'dddddddddddddddd',
    'dddddddddddddddd',
    'dddddddddddddddd',
  ],
  switch: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....knnnnnnk....',
    '..kknnnnnnnnkk..',
    '.knnnnrrrrnnnnk.',
    '.knnnrrrrrrnnnk.',
    '.knnnrrrrrrnnnk.',
    '.knnnnrrrrnnnnk.',
    '..kknnnnnnnnkk..',
    '....knnnnnnk....',
    '................',
  ],
  door: [
    '................',
    '..kkkkkkkkkkkk..',
    '..kvvvvvvvvvvk..',
    '..kvvvvvvvvvvk..',
    '..kvvvvvkkvvvk..',
    '..kvvvvvkwvvvk..',
    '..kvvvvvkkvvvk..',
    '..kvvvvvvvvvvk..',
    '..kvvvvvvvvvvk..',
    '..kvvvvvkkvvvk..',
    '..kvvvvvkwvvvk..',
    '..kvvvvvkkvvvk..',
    '..kvvvvvvvvvvk..',
    '..kvvvvvvvvvvk..',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  collectible: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......kk.......',
    '......kkyk......',
    '.....kkyyyk.....',
    '.....kywyyk.....',
    '.....kkyyyk.....',
    '......kkyk......',
    '.......kk.......',
    '................',
    '................',
    '................',
    '................',
  ],
  finish: [
    '................',
    '................',
    '....kkkkkkkk....',
    '...kGGGGGGGGk...',
    '...kGwwwwwwGk...',
    '...kGwwwwwwGk...',
    '...kGwwwwwwGk...',
    '...kGwwkkwwGk...',
    '....kGwkwkwGk...',
    '...kGwwwwwwGk...',
    '...kGwwkkwwGk...',
    '...kGwwwwwwGk...',
    '...kGGGGGGGGk...',
    '....kkkkkkkk....',
    '................',
    '................',
  ],
  lamp: [
    '................',
    '................',
    '................',
    '........kk......',
    '.......kyyk.....',
    '.......kyyk.....',
    '.......kyyk.....',
    '.......kyyk.....',
    '.......kyyk.....',
    '.......kyyk.....',
    '.......kyyk.....',
    '........k.......',
    '................',
    '................',
    '................',
    '................',
  ],
};

/** 字符图 -> RGBA Buffer（16x16） */
export function artPixels(name) {
  const rows = ART[name];
  if (!rows) throw new Error('sprite 不存在: ' + name);
  const w = 16, h = 16;
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? '.';
      const c = PALETTE[ch];
      if (!c) continue; // 透明
      const i = (y * w + x) * 4;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
    }
  }
  return { pixels: px, w, h };
}

/** 全部精灵 -> PNG 文件 Buffer 映射（{ name: pngBuffer, w, h }） */
export function buildSprites() {
  const out = {};
  for (const name of Object.keys(ART)) {
    const { pixels, w, h } = artPixels(name);
    out[name] = { png: encodePng(pixels, w, h), w, h };
  }
  return out;
}

export const SPRITE_NAMES = Object.keys(ART);
