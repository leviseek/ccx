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
  '1-4 双影双门': [
    { dir: 'right', ticks: 51 },                   // sw1 (9.5)
    { act: 'recordStart' }, { dir: null, ticks: 65 }, { act: 'recordStop' },
    { dir: 'right', ticks: 26 },                   // 卡 g1 门前 (11.4)
    { act: 'summon' }, { dir: null, ticks: 70 },   // e1 站桩 -> g1 latch 开
    { dir: 'right', ticks: 18 },                   // 站 sw2 (14.4)
    { act: 'recordStart', slot: 'e2' }, { dir: null, ticks: 65 }, { act: 'recordStop', slot: 'e2' },
    { act: 'summon', slot: 'e2' }, { dir: null, ticks: 70 },  // e2 站桩 -> g2 latch 开
    { dir: 'right', ticks: 68 },                   // 过 g2 -> finish
  ],
  '1-5 瞬窗之下': [
    { dir: 'right', ticks: 73 },                   // sw1 (13.17)
    { act: 'recordStart' }, { dir: null, ticks: 70 }, { act: 'recordStop' },
    { dir: 'right', ticks: 8 },                    // 门 g1 前 (14.4)
    { act: 'summon' }, { dir: 'right', ticks: 55 },  // 窗开穿门 -> c1 -> finish
  ],
  '1-6 时序接力': [
    { dir: 'right', ticks: 51 },                   // sw1 (9.5)
    { act: 'recordStart' }, { dir: null, ticks: 65 }, { act: 'recordStop' },
    { dir: 'right', ticks: 26 },
    { act: 'summon' }, { dir: null, ticks: 70 },   // e1 锁 g1
    { dir: 'right', ticks: 13 },                   // sw2 (15.97，sw2 16..17.1)
    { act: 'recordStart', slot: 'e2' }, { dir: null, ticks: 40 }, { act: 'recordStop', slot: 'e2' },
    { dir: 'right', ticks: 21 },                   // g2 门前 (19.4)
    { act: 'summon', slot: 'e2' }, { dir: 'right', ticks: 42 },  // 窗开穿 g2 -> finish
  ],
  '1-7 残影守桥': [
    { dir: 'right', ticks: 52 },                   // 坑边 (9.67)
    { dir: 'right', jump: true, ticks: 14 },       // 跳越桥上桥 (12.4)
    { dir: 'right', ticks: 24 },                   // 桥面到 sw1 (16.4)
    { act: 'recordStart' }, { dir: null, ticks: 70 }, { act: 'recordStop' },
    { act: 'summon' }, { dir: 'right', ticks: 55 },  // 窗开穿 g1 -> finish
  ],
  '1-9 错拍双窗': [
    { dir: 'right', ticks: 61 },                   // sw2 (11.17)
    { act: 'recordStart' }, { dir: null, ticks: 65 }, { act: 'recordStop' },
    { dir: 'right', ticks: 8 },                    // g1 门前 (12.4)
    { act: 'summon' }, { dir: 'right', ticks: 18 },  // 窗开穿 g1 -> sw1 (15.07)
    { act: 'recordStart', slot: 'e2' }, { dir: null, ticks: 65 }, { act: 'recordStop', slot: 'e2' },
    { dir: 'right', ticks: 26 },                   // g2 门前 (19.4)
    { act: 'summon', slot: 'e2' }, { dir: 'right', ticks: 50 },  // 窗开穿 g2 -> finish
  ],
  '1-10 时间回廊': [
    { dir: 'right', ticks: 26 },                   // sw1 (5.33)
    { dir: null, ticks: 32 },                      // hold 20 -> g1 开
    { dir: 'right', ticks: 40 },                   // 过 g1 -> 梯 1 前 (11.4)
    { dir: 'right', jump: true, ticks: 20 },       // 跳上梯 1（12.8, 7.9）
    { dir: 'right', jump: true, ticks: 20 },       // -> 梯 2（16.1, 6.7）
    { dir: 'right', jump: true, ticks: 20 },       // -> 梯 3（19.4, 5.5）
    { dir: 'right', jump: true, ticks: 20 },       // -> 梯 4（22.7, 4.3）
    { dir: 'right', jump: true, ticks: 20 },       // 跳下梯 4 -> 地面 (26, 9.1)
    { dir: 'right', ticks: 12 },                   // -> finish (27+)
  ],
  '1-11 三锁连环': [
    { dir: 'right', ticks: 43 },                   // sw1 (8.17)
    { act: 'recordStart' }, { dir: null, ticks: 65 }, { act: 'recordStop' },
    { dir: 'right', ticks: 20 },                   // g1 门前 (10.4)
    { act: 'summon' }, { dir: null, ticks: 70 },   // e1 锁 g1
    { dir: 'right', ticks: 21 },                   // sw2 (15.0，sw2 14..15.1)
    { act: 'recordStart', slot: 'e2' }, { dir: null, ticks: 40 }, { act: 'recordStop', slot: 'e2' },
    { dir: 'right', ticks: 16 },                   // g2 门前 (16.4)
    { act: 'summon', slot: 'e2' }, { dir: 'right', ticks: 21 },  // 窗穿 g2 -> sw3 (19.9)
    { dir: null, ticks: 70 },                      // hold 60 -> g3 开
    { dir: 'right', ticks: 62 },                   // 过 g3 -> finish
  ],
  '1-12 时间监工': [
    { dir: 'right', ticks: 49 },                   // sw1 (9.17)
    { act: 'recordStart' }, { dir: null, ticks: 65 }, { act: 'recordStop' },
    { dir: 'right', ticks: 20 },                   // g1 门前 (11.4)
    { act: 'summon' }, { dir: null, ticks: 70 },   // e1 锁 g1
    { dir: 'right', ticks: 15 },                   // sw2 (13.9，sw2 14..15.1)
    { act: 'recordStart', slot: 'e2' }, { dir: null, ticks: 90 }, { act: 'recordStop', slot: 'e2' },
    { dir: 'right', ticks: 17 },                   // g2 门前 (16.4)
    { act: 'summon', slot: 'e2' }, { dir: 'right', ticks: 5 },   // 窗穿 g2
    { dir: 'right', jump: true, ticks: 20 },       // 越中枢台 -> 落右侧地面 (20.5)
    { dir: 'right', ticks: 3 },                    // sw3 区 (20.9)
    { dir: null, ticks: 95 },                      // hold 90 -> g3 开
    { dir: 'right', ticks: 16 },                   // 高台前 (23.4)
    { dir: 'right', jump: true, ticks: 18 },       // 跳越高台上 (24, 7.65)
    { dir: null, jump: true, ticks: 12 },          // 吃 c1
    { dir: 'right', jump: true, ticks: 12 },       // 跳下高台 -> 过 g3
    { dir: 'right', ticks: 40 },                   // -> finish
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
