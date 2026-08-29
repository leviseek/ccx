// CCX 平台桥 · Web 显示适配（platform-spec §2 Capability+Adapter 契约）
// 纯逻辑视口策略：可用空间 -> 整数倍像素缩放（1x/2x/3x…）+ DPR；Node 可测

                                 
                                          
                                    
                   
                                                    
 

/** 设计分辨率 baseWxbaseH；avail 为可用 CSS 空间；minScale 兜底最小 1x */
export function fitViewport(
  availW        , availH        ,
  baseW        , baseH        ,
  dpr         = 1,
)                 {
  const aspect = baseW / baseH;
  let scale = Math.floor(Math.min(availW / baseW, availH / (baseH * aspect)));
  scale = Math.max(1, scale);
  const logicalW = baseW * scale;
  const logicalH = baseH * scale;
  return { scale, logicalW, logicalH, dpr: Math.max(1, dpr) };
}

/** 可用空间估算（页面 chrome 预留）；供平台调用方直接使用 */
export function availableViewport(innerW        , innerH        , chromePx         = 170) {
  return { availW: Math.max(64, innerW - 24), availH: Math.max(64, innerH - chromePx) };
}
