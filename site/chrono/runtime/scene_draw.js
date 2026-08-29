// 时之三重奏 · 场景绘制指令（纯逻辑：世界状态 -> 渲染意图；Node 可测，canvas 仅执行）
                                                                     

                                                                        
                            
                     
                                          
                                                                                          
                           
                   
                                                                         
                                                       
                                 
 

/** 世界状态 -> 渲染意图（确定性；同状态同输出） */
export function sceneDrawLists(state           , level          )            {
  const solids             = (level.solids ?? []).map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h }));
  const doors                     = state.doors.map((d) => ({
    x: d.rect.x, y: d.rect.y, w: d.rect.w, h: d.rect.h, open: d.open,
  }));
  const switches                        = (level.switches ?? []).map((s) => ({
    x: s.x, y: s.y, w: s.w, h: s.h,
    on: (state.switchHold[s.id] ?? 0) > 0,
    mode: s.mode,
    hold: state.switchHold[s.id] ?? 0,
    holdTicks: s.holdTicks,
  }));
  const collectibles             = (level.collectibles ?? [])
    .filter((c) => !state.collected.has(c.id))
    .map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h }));
  const finish           = { x: level.finish.x, y: level.finish.y, w: level.finish.w, h: level.finish.h };
  const p = state.player;
  const player                      = {
    x: p.x, y: p.y, w: p.w, h: p.h,
    facing: p.vx > 0.01 ? 1 : p.vx < -0.01 ? -1 : null,
    air: !p.onGround,
    vy: p.vy,
  };
  const echoes                      = state.echoes
    .filter((e) => e.active)
    .map((e) => ({ id: e.id, x: e.x, y: e.y, w: e.w, h: e.h, done: e.done }));
  return { solids, doors, switches, collectibles, finish, player, echoes,
           levelW: level.width, levelH: level.height };
}

                          
                    
               
                    
                            
                                                                                    
               
               
 

/** HUD 数据（同一确定性入口，供渲染与测试） */
export function hudData(state           , level          , game      )          {
  return {
    levelName: level.name,
    hint: level.hint ?? '',
    collected: state.collected.size,
    totalCollectibles: (level.collectibles ?? []).length,
    echoSlots: game.slots.map((s) => ({ id: s.id, uses: s.uses, hasBlueprint: !!s.blueprint, active: !!s.echo })),
    won: state.won,
    tick: state.tick,
  };
}
