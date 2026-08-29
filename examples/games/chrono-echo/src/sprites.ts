// @ts-nocheck  // Node-only 资产构建（Buffer 来自 node 全局；运行时链不包含本文件）
// 时之三重奏 · 精灵 PNG 资产生成（Node 侧：sprite_data 像素 -> PNG，经 asset-service png_writer）
import { encodePng } from '../../../../packages/asset-service/src/png_writer.mjs';
import { artPixels, PALETTE, SPRITE_NAMES } from './sprite_data.ts';

/** 全部精灵 -> PNG 文件 Buffer 映射（{ name: { png, w, h } }） */
export function buildSprites(): Record<string, { png: Buffer; w: number; h: number }> {
  const out: Record<string, { png: Buffer; w: number; h: number }> = {};
  for (const name of SPRITE_NAMES) {
    const { pixels, w, h } = artPixels(name);
    out[name] = { png: encodePng(Buffer.from(pixels), w, h), w, h };
  }
  return out;
}

export { artPixels, PALETTE, SPRITE_NAMES };
