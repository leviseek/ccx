// PPM(P6) -> 24bit BMP（浏览器可显示 data URL；无依赖纯 Node Buffer）
// BITMAPFILEHEADER(14) + BITMAPINFOHEADER(40) + 行（4 字节对齐，自底向上，BGR）
export function parsePpm(buf) {
  const head = buf.subarray(0, 64).toString('ascii');
  const m = /^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(head);
  if (!m) throw new Error('非 P6 PPM');
  const w = Number(m[1]);
  const h = Number(m[2]);
  const off = m[0].length;
  return { w, h, data: buf.subarray(off, off + w * h * 3) };
}

export function ppmToBmp(buf) {
  const { w, h, data } = parsePpm(buf);
  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const pixelBytes = rowSize * h;
  const fileSize = 14 + 40 + pixelBytes;
  const out = Buffer.alloc(fileSize);
  // BITMAPFILEHEADER
  out.write('BM', 0, 'ascii');
  out.writeUInt32LE(fileSize, 2);
  out.writeUInt32LE(54, 10);
  // BITMAPINFOHEADER
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(w, 18);
  out.writeInt32LE(h, 22);
  out.writeUInt16LE(1, 26);        // planes
  out.writeUInt16LE(24, 28);       // bpp
  out.writeUInt32LE(0, 30);        // compression BI_RGB
  out.writeUInt32LE(pixelBytes, 34);
  // 像素：自底向上、BGR、行 4 对齐
  for (let y = 0; y < h; ++y) {
    const srcRow = (h - 1 - y) * w * 3;
    const dstRow = 54 + y * rowSize;
    for (let x = 0; x < w; ++x) {
      const s = srcRow + x * 3;
      const d = dstRow + x * 3;
      out[d] = data[s + 2];      // B
      out[d + 1] = data[s + 1];  // G
      out[d + 2] = data[s];      // R
    }
  }
  return out;
}
