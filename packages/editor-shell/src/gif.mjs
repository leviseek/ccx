// GIF89a 打包（无依赖；LZW 编解码同实现，roundtrip 自洽保证）
// 输入帧：{ w, h, pixels: Uint8Array(RGBA) }；固定调色板邻近量化

export const PALETTE = [
  [32, 32, 232],   // 0 背景（深蓝）
  [255, 0, 0],     // 1 红
  [0, 255, 0],     // 2 绿
  [0, 0, 255],     // 3 蓝
  [255, 255, 0],   // 4 黄
  [255, 214, 0],   // 5 金
  [255, 255, 255], // 6 白
  [0, 0, 0],       // 7 黑
];

function nearestIndex(r, g, b) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < PALETTE.length; ++i) {
    const dr = r - PALETTE[i][0];
    const dg = g - PALETTE[i][1];
    const db = b - PALETTE[i][2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// GIF LZW——教科书规则：宽度随 nextCode 增长（nextCode==1<<width 时升位），编码/解码镜像
export function lzwEncode(indices, minCodeSize = 8) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const dict = new Map();   // "prefix" -> code
  const keyOf = (arr) => arr.join(',');
  let width = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  const codes = [];
  let current = [indices[0]];
  // 发射码：宽度=写入时刻；非首字典码推进 nextCode（升位判断用推进前值）；
  // dict.set 用"添加前值"（与解码端 push 的索引严格对齐）
  // 编码端每个字典码写后都添加条目（含 clear 后首个），索引=推进前值（258 起）
  const emit = (c, addKey) => {
    codes.push({ c, width });
    if (c !== clearCode && c !== eoiCode) {
      const idx = nextCode;
      if (nextCode === (1 << width) && width < 12) ++width;
      ++nextCode;
      if (addKey != null) dict.set(addKey, idx);
    }
  };
  emit(clearCode, null);
  for (let i = 1; i < indices.length; ++i) {
    const test = current.concat(indices[i]);
    if (dict.has(keyOf(test))) {
      current = test;
    } else {
      const code = current.length === 1 ? current[0] : dict.get(keyOf(current));
      if (nextCode >= 4096) {      // 表满：发 clear 重置
        emit(clearCode, null);
        dict.clear();
        nextCode = eoiCode + 1;
        width = minCodeSize + 1;
        current = [indices[i]];
        continue;   // 当前串已放弃（表满重置语义），下轮重新累积
      }
      emit(code, keyOf(test));
      current = [indices[i]];
    }
  }
  emit(current.length === 1 ? current[0] : dict.get(keyOf(current)), null);
  emit(eoiCode, null);
  // 打包（LSB-first）
  const bitLen = codes.reduce((acc, x) => acc + x.width, 0);
  const out = Buffer.alloc(Math.ceil(bitLen / 8));
  let bitPos = 0;
  for (const { c, width: w } of codes) {
    for (let b = 0; b < w; ++b) {
      if (c & (1 << b)) out[bitPos >> 3] |= 1 << (bitPos & 7);
      ++bitPos;
    }
  }
  return out;
}

export function lzwDecode(data, minCodeSize = 8, count) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  // 解码字典以码值直接定址（258 起），与编码端 idx 语义对称
  let dict = new Array(4096);
  for (let i = 0; i < clearCode; ++i) dict[i] = [i];
  let width = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  const readCode = (pos, w) => {
    let v = 0;
    for (let b = 0; b < w; ++b) {
      if (data[(pos + b) >> 3] & (1 << ((pos + b) & 7))) v |= 1 << b;
    }
    return v;
  };
  const out = [];
  let pos = 0;
  let prev = null;
  let first = true;
  while (out.length < count) {
    const code = readCode(pos, width);
    pos += width;
    if (code === clearCode) {
      dict = new Array(4096);
      for (let i = 0; i < clearCode; ++i) dict[i] = [i];
      nextCode = eoiCode + 1;
      width = minCodeSize + 1;
      prev = null;
      first = true;
      continue;
    }
    if (code === eoiCode) break;
    let entry;
    if (code < nextCode && dict[code]) entry = dict[code];
    else if (code === nextCode && prev) entry = prev.concat(prev[0]);
    else throw new Error('bad lzw code ' + code + ' next=' + nextCode);
    out.push(...entry);
    if (prev && !first) {
      dict[nextCode] = prev.concat(entry[0]);
      if (nextCode === (1 << width) && width < 12) ++width;
      ++nextCode;
    }
    first = false;
    prev = entry;
  }
  return out.slice(0, count);
}// 帧 -> GIF 文件
export function buildGif(frames, { delayCs = 20 } = {}) {
  const w = frames[0].w;
  const h = frames[0].h;
  const parts = [];
  parts.push(Buffer.from('GIF89a', 'ascii'));
  // LSD
  const lsd = Buffer.alloc(7);
  lsd.writeUInt16LE(w, 0);
  lsd.writeUInt16LE(h, 2);
  lsd[4] = 0x80 | (PALETTE.length - 1);  // GCT flag + size=8
  lsd[5] = 0;   // bg index
  lsd[6] = 0;
  parts.push(lsd);
  // 全局色表
  const gct = Buffer.alloc(PALETTE.length * 3);
  for (let i = 0; i < PALETTE.length; ++i) {
    gct[i * 3] = PALETTE[i][0];
    gct[i * 3 + 1] = PALETTE[i][1];
    gct[i * 3 + 2] = PALETTE[i][2];
  }
  parts.push(gct);
  for (const frame of frames) {
    // GCE
    // GCE：label, blockSize=4, packed, delayLo, delayHi, transparentIdx, terminator
    const gce = Buffer.from([0x21, 0xF9, 4, 0, 0, 0, 0, 0]);
    gce[3] = delayCs & 0xFF;
    gce[4] = (delayCs >> 8) & 0xFF;
    parts.push(gce);
    // 图像描述符
    const id = Buffer.alloc(10);
    id[0] = 0x2C;
    id.writeUInt16LE(0, 1);
    id.writeUInt16LE(0, 3);
    id.writeUInt16LE(w, 5);
    id.writeUInt16LE(h, 7);
    id[9] = 0;  // 无局部调色板
    parts.push(id);
    parts.push(Buffer.from([8]));  // LZW 最小码长
    const indices = Buffer.alloc(w * h);
    for (let i = 0; i < w * h; ++i) {
      const p = i * 4;
      indices[i] = nearestIndex(frame.pixels[p], frame.pixels[p + 1], frame.pixels[p + 2]);
    }
    const lzw = lzwEncode(indices);
    // 子块封装
    const sub = Buffer.concat([
      Buffer.from([Math.min(255, lzw.length)]),
      lzw,
    ]);
    parts.push(sub);
    parts.push(Buffer.from([0]));  // 块终止
  }
  parts.push(Buffer.from([0x3B]));  // trailer
  return Buffer.concat(parts);
}