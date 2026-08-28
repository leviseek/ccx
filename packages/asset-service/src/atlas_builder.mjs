// 图集构建：目录 png -> parsePng -> shelf 打包 -> ccx.atlas/1（asset-spec §2.2/§4 之间）
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePng } from './png.mjs';
import { packAtlas } from './atlas.mjs';

export function buildAtlasFromDir(dir) {
  const images = [];
  for (const name of readdirSync(dir)) {
    if (!name.toLowerCase().endsWith('.png')) continue;
    let meta;
    try {
      meta = parsePng(readFileSync(join(dir, name)));
    } catch {
      continue;  // 坏文件跳过（AssetStatus 待办由队列负责）
    }
    images.push({ name: name.replace(/\.png$/i, ''), w: meta.width, h: meta.height });
  }
  if (images.length === 0) return null;
  const packed = packAtlas(images, 4096, 256);
  if (!packed) return null;
  return {
    schema: 'ccx.atlas/1',
    width: packed.width,
    height: packed.height,
    items: packed.items,
  };
}
