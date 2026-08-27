// PNG 头解析（asset-spec §2.3：Intermediate = 元数据 + 预览）
// 校验签名 + IHDR（宽/高/位深/颜色类型）
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function parsePng(buf) {
  if (!buf || buf.length < 24 || !SIGNATURE.every((b, i) => buf[i] === b)) {
    throw new Error('png: 非 PNG 文件或长度不足');
  }
  if (buf.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('png: 缺少 IHDR 块');
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
  };
}
