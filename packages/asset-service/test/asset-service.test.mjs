import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePng } from '../src/png.mjs';
import { packAtlas } from '../src/atlas.mjs';
import { registerImporter, findImporter, listImporters } from '../src/registry.mjs';

test('PNG 头解析（签名 + IHDR）', () => {
  const buf = Buffer.alloc(32);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  sig.forEach((b, i) => { buf[i] = b; });
  buf.writeUInt32BE(13, 8);          // IHDR 长度
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(640, 16);
  buf.writeUInt32BE(480, 20);
  buf[24] = 8;                       // bit depth
  buf[25] = 6;                       // RGBA
  const meta = parsePng(buf);
  assert.deepEqual(meta, { width: 640, height: 480, bitDepth: 8, colorType: 6 });
});

test('PNG 非文件/截断拒绝', () => {
  assert.throws(() => parsePng(Buffer.from('not a png')), /非 PNG/);
  assert.throws(() => parsePng(Buffer.alloc(8)), /长度不足|非 PNG/);
});

test('图集打包：5×64² + 128² 放进 256²', () => {
  const items = [
    { name: 'a', w: 64, h: 64 },
    { name: 'b', w: 64, h: 64 },
    { name: 'c', w: 64, h: 64 },
    { name: 'd', w: 64, h: 64 },
    { name: 'e', w: 64, h: 64 },
    { name: 'big', w: 128, h: 128 },
  ];
  const atlas = packAtlas(items, 4096, 256);
  assert.ok(atlas, '256² 可装入');
  assert.equal(atlas.width, 256);
  assert.equal(atlas.items.length, 6);
  // 不重叠 + 越界检查
  for (let i = 0; i < atlas.items.length; i++) {
    const a = atlas.items[i];
    assert.ok(a.x + a.w <= 256 && a.y + a.h <= 256, 'a 在界内');
    for (let j = i + 1; j < atlas.items.length; j++) {
      const b = atlas.items[j];
      const noOverlap = a.x + a.w <= b.x || b.x + b.w <= a.x ||
                        a.y + a.h <= b.y || b.y + b.h <= a.y;
      assert.ok(noOverlap, a.name + ' 与 ' + b.name + ' 不重叠');
    }
  }
});

test('图集打包：装不下的返回 null', () => {
  const items = [{ name: 'huge', w: 5000, h: 5000 }];
  assert.equal(packAtlas(items, 4096, 256), null);
});

test('importer 注册表', () => {
  registerImporter({
    id: 'ccx.png',
    accepts: { ext: ['png'] },
    outputs: ['ccx.Texture'],
  });
  assert.ok(findImporter('PNG'), '大小写不敏感');
  assert.equal(findImporter('png').id, 'ccx.png');
  assert.equal(findImporter('jpg'), null);
  assert.deepEqual(listImporters(), ['ccx.png']);
});
