// 时之三重奏 · 关卡解法（虚拟控制器：输入序列 -> 引擎回放 -> win 验证）
// 供 verify_chrono / 测试使用；DSL：
//   {dir:'right'|'left'|null, jump:bool, ticks:N}   —— 持续输入 N 个固定步
//   {act:'recordStart'|'recordStop'|'summon'|'swap', slot?}  —— 单发动作
//   {until:{echoIn:{x,y,w,h}}, max:N}               —— tick 至残影进入区域（换位时机）
import { createGame, actions } from './chrono_engine.ts';
import type { Game, LevelDef } from './chrono_engine.ts';

export interface PlanStep {
  dir?: 'right' | 'left' | null;
  jump?: boolean;
  ticks?: number;
  act?: 'recordStart' | 'recordStop' | 'summon' | 'swap';
  slot?: string;
  until?: { echoIn: { x: number; y: number; w: number; h: number } };
  max?: number;
}

export interface PlanResult { win: boolean; collected: number; ticks: number; usesLeft: number[] }

export function runPlan(level: LevelDef, plan: PlanStep[]): PlanResult {
  const g: Game = createGame(level);
  let ticks = 0;
  for (const step of plan) {
    if (step.act) {
      const slot = step.slot ?? 'e1';
      const act = {
        recordStart: { recordStart: slot },
        recordStop: { recordStop: slot },
        summon: { summon: slot },
        swap: { swap: slot },
      }[step.act];
      if (!act) throw new Error('未知动作: ' + step.act);
      actions(g, act);
      continue;
    }
    if (step.until) {
      let done = false;
      for (let i = 0; i < (step.max ?? 400); i++) {
        g.tick({ left: false, right: false, jump: false });
        ticks += 1;
        const e = g.state.echoes[0];
        const r = step.until.echoIn;
        if (e && e.active && e.x >= r.x && e.x <= r.x + r.w &&
            e.y >= r.y && e.y <= r.y + r.h) { done = true; break; }
        if (g.state.won) break;
      }
      continue;
    }
    for (let i = 0; i < (step.ticks ?? 0); i++) {
      g.tick({
        left: step.dir === 'left',
        right: step.dir === 'right',
        jump: !!step.jump,
      });
      ticks += 1;
      if (g.state.won) break;
    }
    if (g.state.won) break;
  }
  return { win: g.state.won, collected: g.state.collected.size, ticks, usesLeft: g.slots.map((s) => s.uses) };
}

/** 第一章解法库（verify 回放；G3 关卡迭代时同步更新） */
export const SOLVERS: Record<string, PlanStep[]> = {
  '1-1 初涉矿区': [
    { dir: 'right', jump: true, ticks: 200 },
  ],
  '1-2 残影替我': [
    { dir: 'right', ticks: 51 },
    { act: 'recordStart' },
    { dir: null, ticks: 60 },
    { act: 'recordStop' },
    { dir: 'right', ticks: 26 },
    { act: 'summon' },
    { dir: 'right', ticks: 60 },
  ],
  '1-3 换位拾空': [
    { dir: 'right', ticks: 51 },
    { dir: null, ticks: 50 },                  // 压板 hold >=45 -> g1 永久开
    { dir: 'right', ticks: 26 },
    { dir: 'right', jump: true, ticks: 30 },   // 弹跳过箱（越顶吃 c1，至箱右侧）
    { dir: 'right', ticks: 90 },               // 地面直行到 finish
  ],
  '1-8 双段天梯': [
    { dir: null, ticks: 40 },                  // 落地
    { dir: 'right', ticks: 30 },               // x=6（板 0 左）
    { dir: 'right', jump: true, ticks: 22 },   // 跳上板 0
    { act: 'recordStart' },
    { dir: 'right', jump: true, ticks: 16 },   // 跳向板 1（记录穿板轨迹）
    { act: 'recordStop' },
    { dir: 'left', jump: true, ticks: 14 },    // 回地面
    { act: 'summon' },
    { until: { echoIn: { x: 9.2, y: 6.3, w: 1.5, h: 2.2 } }, max: 60 },
    { act: 'swap' },                           // 换位入板 1 -> 落站板顶
    { dir: null, ticks: 16 },
    { dir: null, jump: true, ticks: 14 },      // 跳吃 c1
    { dir: 'right', jump: true, ticks: 18 },   // 跳下板 1
    { dir: 'right', ticks: 90 },               // 到 finish
  ],
};
