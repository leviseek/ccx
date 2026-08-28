import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePpm, ppmToBmp } from '../src/ppm_to_bmp.mjs';

// 构造 4x2 PPM：上排红蓝，下排绿金
function mkPpm() {
  const w = 4, h = 2;
  const rows = [];
  rows.push('P6');
  rows.push(w + ' ' + h);
  rows.push('255');
  const head = Buffer.from(rows.join('\n') + '\n', 'ascii');
  const px = Buffer.alloc(w * h * 3);
  const set = (x, y, r, g, b) => {
    const i = (y * w + x) * 3;
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  };
  set(0, 0, 255, 0, 0); set(1, 0, 0, 0, 255);
  set(0, 1, 0, 255, 0); set(1, 1, 255, 215, 0);
  return Buffer.concat([head, px]);
}

test('parsePpm：头与像素', () => {
  const { w, h, data } = parsePpm(mkPpm());
  assert.equal(w, 4);
  assert.equal(h, 2);
  assert.equal(data.length, 24);
  assert.ok(data[0] === 255 && data[1] === 0 && data[2] === 0);
});

test('ppmToBmp：头/尺寸/颜色（BGR 自底向上）', () => {
  const bmp = ppmToBmp(mkPpm());
  assert.equal(bmp.toString('ascii', 0, 2), 'BM');
  assert.equal(bmp.readInt32LE(18), 4);
  assert.equal(bmp.readInt32LE(22), 2);
  assert.equal(bmp.readUInt16LE(28), 24);
  const rowSize = 12;  // 4*3=12 已 4 对齐
  // 底行（源 y=1，文件首行）：源 (0,1)=绿(0,255,0) -> [B=0,G=255,R=0]；(1,1)=金
  assert.deepEqual([bmp[54], bmp[55], bmp[56]], [0, 255, 0], '底行 (0,1) 绿（BGR）');
  assert.deepEqual([bmp[54 + 3], bmp[54 + 4], bmp[54 + 5]], [0, 215, 255], '底行 (1,1) 金');
  // 顶行（源 y=0）：(0,0)=红 -> [0,0,255]；(1,0)=蓝 -> [255,0,0]
  const topRow = 54 + rowSize;
  assert.deepEqual([bmp[topRow], bmp[topRow + 1], bmp[topRow + 2]], [0, 0, 255], '顶行 (0,0) 红');
  assert.deepEqual([bmp[topRow + 3], bmp[topRow + 4], bmp[topRow + 5]], [255, 0, 0], '顶行 (1,0) 蓝');
});
