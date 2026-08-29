# 时之三重奏 Chrono Echo · 游戏与发布文档

> 版本：v0.3.212（2026-08-29）· 第一章「遗迹采掘」12 关完整可玩 · 全链验证 ALL PASSED

## 1. 游戏是什么

**时之三重奏** 是一款 2D 时间解谜小游戏（CCX 平台示例，机制核心 = 时间残影）：

- **残影重放**：按 R 录制你的一段动作，再按 R 结束；到需要处按 E 召唤——残影会严格按你的轨迹重放（残影不受物理：它是幻影，可以"替你压板"）。
- **换位瞬移**：按 Q 与残影瞬间交换位置（守恒律：你获得残影的时空坐标）——残影在门后/高台时，你就"借位"过去了。
- **时序机关**：
  - **锁门（latch）**：压板被连续压满 holdTicks 后永久开门（离开会重置进度）。
  - **窗门（window）**：压板被压住时才开门，离开即关——需要残影"一直按着"。
- **收集与评级**：每关 3 枚时之碎片为满（1★ 通关 / 2★ 碎片 ≥2/3 / 3★ 达标 + 用时 ≤ 1.2s×tile 参考）。

## 2. 操作

| 键 | 动作 |
|---|---|
| ←→ / A D | 移动 |
| 空格 / W / ↑ | 跳跃 |
| R | 录制开始 / 录制结束（同一键切换） |
| E | 召唤残影（消耗 1 次使用） |
| Q | 与残影换位（仅残影存活时） |
| P | 暂停 / 继续 |

选关：URL 参数 `?level=1-N`（1-1 .. 1-12）。

## 3. 第一章关卡表

| 关 | 名 | 机制 | 核心玩法 |
|---|---|---|---|
| 1-1 | 初涉矿区 | 移动/跳跃 | 跳过场的箱台，吃碎片到石碑 |
| 1-2 | 残影替我 | latch + 召唤 | 录"站压板"→残影替你开门 |
| 1-3 | 换位拾空 | latch + 换位 | 弹跳过箱；残影借位拾高台碎片 |
| 1-4 | 双影双门 | 双槽 | 两个压板两扇门，双残影齐上 |
| 1-5 | 瞬窗之下 | window | 残影按住窗门，你穿那一瞬 |
| 1-6 | 时序接力 | latch+window | 先锁后窗，残影接力 |
| 1-7 | 残影守桥 | window+桥 | 窄桥尽头窗门，残影压板守桥 |
| 1-8 | 双段天梯 | 换位+多槽 | 残影借位登高台 |
| 1-9 | 错拍双窗 | 双 window | 压 1 开 2、压 2 开 1，各踩一边 |
| 1-10 | 时间回廊 | 组合 | 墙门+残影探路 |
| 1-11 | 三锁连环 | 三门 | 锁窗锁三连，规划残影站位 |
| 1-12 | 时间监工 | 全机制 | 第一章 Boss 关 |

（通关解法被 ci/verify_chrono 虚拟控制器回放验证：1-1/1-2/1-3/1-8 可解；其余关解法在 G3 内容轮补齐。）

## 4. 工程结构（TypeScript，ADR-001 双语言）

```
examples/games/chrono-echo/
  src/
    chrono_engine.ts      # 纯逻辑时轴引擎（残影/换位/机关/物理；确定性强可测）
    metrics.ts            # 星级评级（纯逻辑）
    levels.ts             # 第一章 12 关（ccx.chrono/1 可 diff JSON）
    sprite_data.ts        # 字符图像素（浏览器/Node 共享）
    sprites.ts            # Node：像素 -> PNG（asset-service png_writer）
    solvers.ts            # 解法库（虚拟控制器 DSL）
    runtime/
      main.ts  renderer.ts  input.ts  audio.ts  channel.ts  scene_draw.ts
  scripts/build_site.mjs  # 静态站点构建（资产+转译+网页）
  test/*.test.ts          # 引擎/资产/评级/运行时（node --test 原生 TS）
ci/verify_chrono.ts       # 全链验证器（CI 入口）
```

## 5. 运行时/构建

- **Node 24 原生跑 TS**（type stripping 默认开启）：`node --test examples/games/chrono-echo/test/*.test.ts`
- **TS -> 浏览器 ESM**：Node 内置 `stripTypeScriptTypes` 转译（保留 import/export；.ts 导入改写为 .js）。
  注意：tsc 6.0.3 在 ES2022/NodeNext/Preserve + "type":"module" 下实测仍 emit CommonJS，故弃用（记录于 2026-08-29）。
- **站点构建**：`node examples/games/chrono-echo/scripts/build_site.mjs` → `site/chrono/`
  （index.html + game.js + ESM 运行时 10 模块 + assets/*.png 8 张 + levels.json + assets.json）

## 6. 发布（GitHub Pages）

```bash
node examples/games/chrono-echo/scripts/build_site.mjs
# 产物 build/chrono-site/ 推到 gh-pages 分支或仓库 Pages 目录（Settings -> Pages -> Deploy from branch）
# 访问 https://<user>.github.io/<repo>/chrono/
```

资产索引 `assets.json`（ccx.assets.index/1）可被 build-service 校验器消费（资产管线叙事闭环）。

## 7. 渠道接入（小游戏）

- `runtime/channel.ts` 检测宿主：`window.wx`（微信小游戏）/ `window.tt`（抖音小游戏）→ mini 适配器（vibrate/share/login 能力面，走 channel-sdk 语义）；否则 generic Web（无分享）。
- 微信/抖音发布步骤（需开发者账号）：构建 H5/小游戏壳 → 注入 wx/tt Game 全局 → channel 适配器自动激活 → 验收 `channel.caps`。
- 完整真机发布链按 roadmap M3 出口①（小游戏渠道真机发布）验收，当前为适配层就绪（账号后补）。

## 8. 全链验证

```bash
node ci/verify_chrono.ts
# ALL PASSED：机制测试（引擎/资产/评级/运行时）+ 12 关校验 + 4 关解法回放 + 站点构建/产物
```
