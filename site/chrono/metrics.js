// 时之三重奏 · 关卡评定（纯逻辑：星级/结算数据；Node 可测、运行时消费）
// 星级规则：1★ 通关；2★ 通关 + 碎片 >= 2/3；3★ 2★ + 用时 <= parTicks（默认 1.2s/tile）
                                                   

                            
                
                    
                            
                   
                    
 

                         
                       
                         
                                                        
                   
                    
 

export function parTicksFor(level          )         {
  return Math.round(level.width * 36);   // 1.2s/tile @30Hz
}

/** 结算（胜负无关的统计）：usesLeft 为各槽剩余次数 */
export function runResultOf(level          , ticks        , collected             , usesLeft          )            {
  const usesTotal = (level.echoes ?? []).reduce((a, e) => a + e.uses, 0);
  return {
    ticks,
    collected: collected.size,
    totalCollectibles: (level.collectibles ?? []).length,
    usesUsed: usesTotal - usesLeft.reduce((a, b) => a + b, 0),
    usesTotal,
  };
}

export function starRating(level          , result           )         {
  const par = parTicksFor(level);
  const total = result.totalCollectibles;
  const collectedRatio = total > 0 ? Math.min(1, result.collected / total) : 1;
  const timeRatio = result.ticks / par;
  const reasons           = [];
  let stars                = 1;
  reasons.push('通关');
  if (collectedRatio >= 2 / 3 && (total === 0 || result.collected > 0)) {
    stars = 2;
    reasons.push('碎片 ' + result.collected + '/' + total);
    if (timeRatio <= 1) {
      stars = 3;
      reasons.push('用时达标 ' + result.ticks + '/' + par);
    }
  }
  return { stars, collectedRatio, timeRatio, parTicks: par, reasons };
}
