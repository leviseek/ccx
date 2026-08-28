import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGif, lzwEncode, lzwDecode } from '../src/gif.mjs';

test('LZW roundtrip：任意索引序列可逆', () => {
  const seq = [0, 1, 1, 2, 2, 2, 0, 3, 3, 1, 1, 1, 1, 2, 0, 0];
  const enc = lzwEncode(seq);
  const dec = lzwDecode(enc, 8, seq.length);
  assert.deepEqual(dec, seq);
  // 大序列：字典增长 + reset 路径
  const big = [];
  for (let i = 0; i < 3000; ++i) big.push(i % 8);
  const enc2 = lzwEncode(big);
  const dec2 = lzwDecode(enc2, 8, big.length);
  assert.deepEqual(dec2, big);
});

test('buildGif：结构 + 像素 roundtrip（两帧）', () => {
  const mk = (r, g, b) => {
    const w = 4, h = 3;
    const pixels = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; ++i) {
      pixels[i * 4] = r; pixels[i * 4 + 1] = g; pixels[i * 4 + 2] = b; pixels[i * 4 + 3] = 255;
    }
    return { w, h, pixels };
  };
  const gif = buildGif([mk(255, 0, 0), mk(0, 255, 0)], { delayCs: 20 });
  assert.equal(gif.toString('ascii', 0, 6), 'GIF89a');
  assert.equal(gif.readUInt16LE(6), 4, '逻辑屏宽');
  assert.equal(gif.readUInt16LE(8), 3, '逻辑屏高');
  // GCT 标志
  assert.ok((gif[10] & 0x80) !== 0, '全局色表存在');
  // 结构：两个 GCE(0x21 0xF9) + 两个图像描述符(0x2C) + trailer(0x3B)
  let gceCount = 0, imgCount = 0, trailer = false;
  for (let i = 0; i < gif.length; ++i) {
    if (gif[i] === 0x21 && gif[i + 1] === 0xF9) ++gceCount;
    if (gif[i] === 0x2C) ++imgCount;
    if (gif[i] === 0x3B) trailer = true;
  }
  assert.equal(gceCount, 2);
  assert.equal(imgCount, 2);
  assert.ok(trailer);

  // 抽取帧像素数据并解码验证颜色（第一帧红、第二帧绿）
  const lzwBlocks = [];
  let i = 0;
  // 跳过 header(6) + LSD(7) + GCT(24)
  i = 6 + 7 + 24;
  const counts = [];
  for (let frameIdx = 0; frameIdx < 2; ++frameIdx) {
    i += 8;  // GCE
    assert.equal(gif[i], 0x2C, '图像描述符');
    i += 10;
    const minCode = gif[i++];
    const blocks = [];
    while (true) {
      const len = gif[i++];
      if (len === 0) break;
      blocks.push(gif.subarray(i, i + len));
      i += len;
    }
    const all = Buffer.concat(blocks);
    const indices = lzwDecode(all, minCode, 12);
    assert.equal(indices.length, 12);
    assert.ok(indices.every((ci) => ci === (frameIdx === 0 ? 1 : 2)),
              '帧 ' + frameIdx + ' 全为该帧颜色索引（红=1 绿=2）');
  }
});
