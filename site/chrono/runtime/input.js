// 时之三重奏 · 浏览器输入（键盘 -> 引擎输入/单发动作）
// 移动/跳跃 = 持续输入；R/E/Q = 单发动作（主循环采样）
                                                               

                                                                                                       

                        
                                                         
                                       
                                                                                               
                                                     
 

const keymap                         = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', Space: 'jump', KeyW: 'jump',
  KeyR: 'recordA', KeyT: 'recordB',
  KeyE: 'summon', KeyQ: 'swap',
};

/** 键盘采样（浏览器事件绑定；触屏按钮一并支持） */
export function createInput(target         = window)        {
  const held = { left: false, right: false, jump: false };
  const pulseOrder           = [];

  target.addEventListener('keydown', (ev               ) => {
    const a = keymap[ev.code];
    if (!a) return;
    ev.preventDefault();
    if (a === 'left' || a === 'right' || a === 'jump') held[a] = true;
    else if (!pulseOrder.includes(a)) pulseOrder.push(a);
  });
  target.addEventListener('keyup', (ev               ) => {
    const a = keymap[ev.code];
    if (!a) return;
    if (a === 'left' || a === 'right' || a === 'jump') held[a] = false;
  });

  function sample(level          )              {
    const input            = {
      left: held.left, right: held.right,
      jump: held.jump || pulseOrder.some((p) => p === 'jump'),
    };
    const acts                      = [];
    for (const p of pulseOrder.splice(0)) {
      if (p === 'recordA') acts.push({ action: 'record', slot: level.echoes[0]?.id });
      if (p === 'recordB') acts.push({ action: 'record', slot: level.echoes[1]?.id });
      if (p === 'summon') acts.push({ action: 'summon', slot: level.echoes[0]?.id });
      if (p === 'swap') acts.push({ action: 'swap', slot: level.echoes[0]?.id });
    }
    return { input, acts };
  }

  function touchPress(act                                                                       )       {
    if (act === 'left' || act === 'right' || act === 'jump') held[act] = true;
    else if (!pulseOrder.includes(act)) pulseOrder.push(act);
  }
  function touchRelease(act                           )       {
    if (act === 'left' || act === 'right' || act === 'jump') held[act] = false;
  }

  return { held, sample, touchPress, touchRelease };
}
