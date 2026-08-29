// 时之三重奏 · 精灵像素数据（零依赖：Node 资产生成与浏览器运行时共用）
// 字符图 -> RGBA 像素数组（Uint8Array）；PNG 构建见 sprites.ts（Node 侧）

export type Rgba = [number, number, number, number];

export const PALETTE: Record<string, Rgba | null> = {
  '.': null,
  'k': [0x1b, 0x1b, 0x2f, 255],
  'b': [0x4e, 0x6b, 0xd8, 255],
  'B': [0x7f, 0xa0, 0xff, 255],
  'w': [0xe8, 0xe8, 0xff, 255],
  'g': [0x9f, 0xe2, 0xd0, 255],
  'G': [0x4c, 0xbf, 0xa8, 255],
  'y': [0xff, 0xd7, 0x5e, 255],
  'r': [0xe0, 0x52, 0x52, 255],
  'v': [0x8a, 0x5f, 0xd8, 255],
  'n': [0x6b, 0x6f, 0x8f, 255],
  't': [0x3b, 0x3d, 0x5c, 255],
  'd': [0x2b, 0x2d, 0x48, 255],
};

export const ART: Record<string, string[]> = {
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
    'tttttttttttttttt','tttttttttttttttt','tttttttttttttttt','tttttttttttttttt',
    'tttttttttttttttt','tttttttttttttttt','tttttttttttttttt','tttttttttttttttt',
    'dddddddddddddddd','dddddddddddddddd','dddddddddddddddd','dddddddddddddddd',
    'dddddddddddddddd','dddddddddddddddd','dddddddddddddddd','dddddddddddddddd',
  ],
  switch: [
    '................','................','................','................',
    '................','................','................',
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
    '................','................','................','................',
    '................',
    '.......kk.......',
    '......kkyk......',
    '.....kkyyyk.....',
    '.....kywyyk.....',
    '.....kkyyyk.....',
    '......kkyk......',
    '.......kk.......',
    '................','................','................','................',
  ],
  finish: [
    '................','................',
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
    '................','................',
  ],
  lamp: [
    '................','................','................','................',
    '........kk......',
    '.......kyyk.....','.......kyyk.....','.......kyyk.....',
    '.......kyyk.....','.......kyyk.....','.......kyyk.....',
    '........k.......',
    '................','................','................','................',
  ],
};

export const SPRITE_NAMES = Object.keys(ART);

/** 字符图 -> RGBA Uint8Array（16x16，浏览器/Node 通用） */
export function artPixels(name: string): { pixels: Uint8Array; w: number; h: number } {
  const rows = ART[name];
  if (!rows) throw new Error('sprite 不存在: ' + name);
  const w = 16, h = 16;
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? '.';
      const c = PALETTE[ch];
      if (!c) continue;
      const i = (y * w + x) * 4;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
    }
  }
  return { pixels: px, w, h };
}
