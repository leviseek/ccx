// 时之三重奏 · 资产与关卡数据测试
import test from 'node:test';
import assert from 'node:assert/strict';
import { artPixels, buildSprites, PALETTE, SPRITE_NAMES } from '../src/sprites.ts';
import { CHAPTERS, levelById } from '../src/levels.ts';
import { validateLevel } from '../src/chrono_engine.ts';

test('sprites: 全部精灵 16x16 + 像素采样', () => {
  for (const name of SPRITE_NAMES) {
    const { pixels, w, h } = artPixels(name);
    assert.equal(w, 16, name + ' 宽');
    assert.equal(h, 16, name + ' 高');
    assert.equal(pixels.length, 16 * 16 * 4);
  }
  const p = artPixels('player');
  const i = (8 * 16 + 8) * 4;
  assert.equal(p.pixels[i + 3], 255, 'player 中心不透明');
  assert.deepEqual([p.pixels[i], p.pixels[i + 1], p.pixels[i + 2]], PALETTE.b!.slice(0, 3));
  assert.equal(artPixels('player').pixels[3], 0, '角落透明');
});

test('sprites: buildSprites 全 PNG 合法头部', () => {
  const all = buildSprites();
  assert.equal(Object.keys(all).length, SPRITE_NAMES.length);
  for (const [name, s] of Object.entries(all)) {
    assert.equal(s.png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', name + ' PNG 签名');
  }
  assert.ok(all.player.png.length > 40, 'player PNG 非空');
});

test('levels: 12 关全部通过 ccx.chrono/1 校验（结构+引用完整性）', () => {
  const ch = CHAPTERS[0];
  assert.equal(ch.levels.length, 12);
  const names = ch.levels.map((l) => l.name);
  assert.equal(names[0], '1-1 初涉矿区');
  assert.equal(names[11], '1-12 时间监工');
  for (const lv of ch.levels) {
    const v = validateLevel(lv);
    assert.equal(v.ok, true, lv.name + ': ' + v.errors.join('; '));
  }
});

test('levels: 机制要素分布（教程梯度）', () => {
  const ls = CHAPTERS[0].levels;
  assert.equal(ls.filter((l) => l.echoes.length > 0).length, 12, '全 12 关配备残影槽');
  assert.ok(ls.filter((l) => l.doors.length > 0).length >= 6, '≥6 关有门+机关');
  assert.equal(ls.filter((l) => l.collectibles.length > 0).length, 12, '全 12 关有碎片收集');
  for (const lv of ls.slice(0, 4)) assert.ok(lv.hint!.length > 8, lv.name + ' 有提示');
});

test('levels: levelById 查询', () => {
  assert.equal(levelById('1-5 瞬窗之下')!.name, '1-5 瞬窗之下');
  assert.equal(levelById('9-9 不存在'), null);
});
