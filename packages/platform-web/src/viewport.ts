// CCX 平台桥 · Web 显示适配（platform-spec §2 Capability+Adapter 契约）
// 纯逻辑视口策略：可用空间 -> 整数倍像素缩放（1x/2x/3x…）+ DPR；Node 可测

export interface ViewportResult {
  scale: number;        // 设计分辨率缩放（>=1 整数）
  logicalW: number;     // 逻辑（CSS）像素
  logicalH: number;
  dpr: number;          // 设备像素比（物理 = logical * dpr）
}

/** 设计分辨率 baseWxbaseH；avail 为可用 CSS 空间；minScale 兜底最小 1x */
export function fitViewport(
  availW: number, availH: number,
  baseW: number, baseH: number,
  dpr: number = 1,
): ViewportResult {
  const aspect = baseW / baseH;
  let scale = Math.floor(Math.min(availW / baseW, availH / (baseH * aspect)));
  scale = Math.max(1, scale);
  const logicalW = baseW * scale;
  const logicalH = baseH * scale;
  return { scale, logicalW, logicalH, dpr: Math.max(1, dpr) };
}

/** 可用空间估算（页面 chrome 预留）；供平台调用方直接使用 */
export function availableViewport(innerW: number, innerH: number, chromePx: number = 170) {
  return { availW: Math.max(64, innerW - 24), availH: Math.max(64, innerH - chromePx) };
}
