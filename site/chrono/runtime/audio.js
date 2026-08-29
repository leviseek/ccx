// 时之三重奏 · 程序化音效（WebAudio 合成；浏览器专用，无音频资产依赖）
                      
                                                              
                                          
 
                                                         

export function createAudio()              {
  let ctx                      = null;
  function ensure()                      {
    try {
      if (!ctx) ctx = new AudioContext();
      if (ctx.state === 'suspended') void ctx.resume();
      return ctx;
    } catch { return null; }
  }
  function tone(freq        , dur        , type                 = 'square', vol = 0.07, slide = 0, delay = 0)       {
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide !== 0) osc.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  const sfx      = {
    jump: () => tone(300, 0.1, 'square', 0.05, 90),
    collect: () => { tone(880, 0.08, 'square', 0.06); tone(1318, 0.12, 'square', 0.06, 0, 0.06); },
    door: () => tone(180, 0.28, 'sawtooth', 0.06, 60),
    summon: () => { tone(520, 0.22, 'triangle', 0.08, -160); },
    swap: () => { tone(700, 0.07, 'square', 0.08, 240); tone(940, 0.07, 'square', 0.06, 240, 0.05); },
    deny: () => tone(130, 0.16, 'sawtooth', 0.06, -30),
    win: () => { tone(523, 0.14, 'triangle', 0.08); tone(659, 0.14, 'triangle', 0.08, 0, 0.12); tone(784, 0.24, 'triangle', 0.09, 0, 0.24); },
  };
  return { sfx, resume: ensure };
}
