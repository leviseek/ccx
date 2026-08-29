// PNG 编码器测试：结构 + IDAT 解压 roundtrip（资产管线增量）
import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { encodePng } from '../src/png_writer.mjs';

function readChunks(png) {
  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', 'PNG 签名');
  const chunks = [];
  let off = 8;
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString('ascii', off + 4, off + 8);
    chunks.push({ type, data: png.subarray(off + 8, off + 8 + len) });
    off += 12 + len;
  }
  return chunks;
}

test('encodePng: 结构（IHDR/IDAT/IEND, 8x4 RGBA）', () => {
  const w = 8, h = 4;
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { px[i * 4] = 255; px[i * 4 + 3] = 255; } // 纯红
  const png = encodePng(px, w, h);
  const chunks = readChunks(png);
  assert.deepEqual(chunks.map((c) => c.type), ['IHDR', 'IDAT', 'IEND']);
  const ihdr = chunks[0].data;
  assert.equal(ihdr.readUInt32BE(0), w);
  assert.equal(ihdr.readUInt32BE(4), h);
  assert.equal(ihdr[8], 8, 'bit depth');
  assert.equal(ihdr[9], 6, 'RGBA');
});

test('encodePng: IDAT 解压后 filter0 扫描线像素一致', () => {
  const w = 16, h = 10;
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = (i * 7) % 256; px[i * 4 + 1] = (i * 13) % 256;
    px[i * 4 + 2] = (i * 29) % 256; px[i * 4 + 3] = (i * 31) % 256;
  }
  const png = encodePng(px, w, h);
  const idat = Buffer.concat(readChunks(png).filter((c) => c.type === 'IDAT').map((c) => c.data));
  const raw = inflateSync(idat);
  assert.equal(raw.length, h * (1 + w * 4), '扫描线 = h*(1+w*4)');
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 4);
    assert.equal(raw[row], 0, 'filter 0');
    assert.deepEqual(raw.subarray(row + 1, row + 1 + w * 4), px.subarray(y * w * 4, (y + 1) * w * 4), 'row ' + y);
  }
});

test('encodePng: 非法输入拒绝', () => {
  assert.throws(() => encodePng(Buffer.alloc(4), 2, 2), /不符/);
  assert.throws(() => encodePng(Buffer.alloc(0), 0, 1), /尺寸/);
  assert.throws(() => encodePng('nope', 2, 2), /Buffer/);
});
