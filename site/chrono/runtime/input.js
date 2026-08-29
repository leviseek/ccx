// 时之三重奏 · 游戏输入归一化（消费平台桥事件流；游戏不直接接触 DOM）
                                                                                                            
                                                     

                                                                                                       

                           
                                                         
                                                           
 

/** 桥接层输入：键盘/触钮统一 -> 持续输入 + 单发动作 */
export function createInput(bridge                )           {
  const held = { left: false, right: false, jump: false };
  const pulses           = [];

  function consume()       {
    let ev                         ;
    while ((ev = bridge.takeInput()) !== null) {
      switch (ev.key) {
        case 'Left': held.left = ev.type !== 'Release'; break;
        case 'Right': held.right = ev.type !== 'Release'; break;
        case 'Jump': held.jump = ev.type !== 'Release'; break;
        case 'Record': if (ev.type === 'Press') pulses.push('recordA'); break;
        case 'Summon': if (ev.type === 'Press') pulses.push('summon'); break;
        case 'Swap': if (ev.type === 'Press') pulses.push('swap'); break;
        case 'Pause': if (ev.type === 'Press') pulses.push('pause'); break;
      }
    }
  }

  function sample(level                              )              {
    consume();
    const input            = { left: held.left, right: held.right, jump: held.jump };
    const acts                      = [];
    for (const p of pulses.splice(0)) {
      if (p === 'recordA') acts.push({ action: 'record', slot: level.echoes[0]?.id });
      if (p === 'summon') acts.push({ action: 'summon', slot: level.echoes[0]?.id });
      if (p === 'swap') acts.push({ action: 'swap', slot: level.echoes[0]?.id });
      if (p === 'pause') acts.push({ action: 'pause', slot: undefined });
    }
    return { input, acts };
  }

  return { held, sample };
}
