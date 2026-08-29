// 时之三重奏 · 浏览器输入（键盘 -> 引擎输入/单发动作）
// 移动/跳跃 = 持续输入；R/E/Q = 单发动作（主循环采样）
import type { LevelDef, TickInput } from '../chrono_engine.ts';

export interface InputSample { input: TickInput; acts: { action: string; slot: string | undefined }[] }

export interface Input {
  held: { left: boolean; right: boolean; jump: boolean };
  sample(level: LevelDef): InputSample;
  touchPress(act: 'left' | 'right' | 'jump' | 'recordA' | 'recordB' | 'summon' | 'swap'): void;
  touchRelease(act: 'left' | 'right' | 'jump'): void;
}

const keymap: Record<string, string> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', Space: 'jump', KeyW: 'jump',
  KeyR: 'recordA', KeyT: 'recordB',
  KeyE: 'summon', KeyQ: 'swap',
};

/** 键盘采样（浏览器事件绑定；触屏按钮一并支持） */
export function createInput(target: Window = window): Input {
  const held = { left: false, right: false, jump: false };
  const pulseOrder: string[] = [];

  target.addEventListener('keydown', (ev: KeyboardEvent) => {
    const a = keymap[ev.code];
    if (!a) return;
    ev.preventDefault();
    if (a === 'left' || a === 'right' || a === 'jump') held[a] = true;
    else if (!pulseOrder.includes(a)) pulseOrder.push(a);
  });
  target.addEventListener('keyup', (ev: KeyboardEvent) => {
    const a = keymap[ev.code];
    if (!a) return;
    if (a === 'left' || a === 'right' || a === 'jump') held[a] = false;
  });

  function sample(level: LevelDef): InputSample {
    const input: TickInput = {
      left: held.left, right: held.right,
      jump: held.jump || pulseOrder.some((p) => p === 'jump'),
    };
    const acts: InputSample['acts'] = [];
    for (const p of pulseOrder.splice(0)) {
      if (p === 'recordA') acts.push({ action: 'record', slot: level.echoes[0]?.id });
      if (p === 'recordB') acts.push({ action: 'record', slot: level.echoes[1]?.id });
      if (p === 'summon') acts.push({ action: 'summon', slot: level.echoes[0]?.id });
      if (p === 'swap') acts.push({ action: 'swap', slot: level.echoes[0]?.id });
    }
    return { input, acts };
  }

  function touchPress(act: 'left' | 'right' | 'jump' | 'recordA' | 'recordB' | 'summon' | 'swap'): void {
    if (act === 'left' || act === 'right' || act === 'jump') held[act] = true;
    else if (!pulseOrder.includes(act)) pulseOrder.push(act);
  }
  function touchRelease(act: 'left' | 'right' | 'jump'): void {
    if (act === 'left' || act === 'right' || act === 'jump') held[act] = false;
  }

  return { held, sample, touchPress, touchRelease };
}
