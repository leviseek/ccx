// 图集打包（shelf 算法，asset-spec §4 Cook 阶段前置；M1 骨架）
// 输入：[{name, w, h}]；按高度降序排入 shelf；返回布局或 null（越界）
export function packAtlas(items, maxSize = 4096, startSize = 256) {
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w);
  for (let size = startSize; size <= maxSize; size *= 2) {
    const layout = tryPack(sorted, size);
    if (layout) return layout;
  }
  return null;
}

function tryPack(items, size) {
  const out = [];
  let shelfY = 0;      // 当前 shelf 顶
  let shelfH = 0;
  let x = 0;
  for (const it of items) {
    if (x + it.w > size) {
      x = 0;
      shelfY += shelfH;
      shelfH = 0;
    }
    if (shelfY + it.h > size) return null;
    out.push({ name: it.name, x, y: shelfY, w: it.w, h: it.h });
    x += it.w;
    shelfH = Math.max(shelfH, it.h);
  }
  return { width: size, height: size, items: out };
}
