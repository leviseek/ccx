# M1 里程碑完结申报（终版，v0.3.101）

> 申报：2026-08-28 · 依据：m1-gate-review（判据源）+ m1-final-summary（快照）+ 双门禁
> 结论：**M1 全部判据达成（除环境绑定项如实列明）——可申报完结。**

## 判据逐条核对

| # | 判据 | 终态凭据 | 状态 |
| --- | --- | --- | --- |
| 1 | 引擎 13 模块数据面 | 14 构建模块；51 CTest 全绿 | ✅ |
| 2 | 服务三形态 + 事件 + 协议 | daemon 22 测试（undo/redo/会话/审计） | ✅ |
| 3 | AI 接口（MCP） | mcp tools/call 2 用例 + CLI 入口 | ✅ |
| 4 | 工具链 21+ 子命令 | CLI 27 用例（script/doctor 系/verify 系） | ✅ |
| 5 | 编辑器预览闭环 | preview 5 用例（--frame/--gif/--site/--apply/undo 栏） | ✅ |
| 6 | 交付链单命令 | demo all 15 步（≈3s）含脚本双路径/预算 | ✅ |
| 7 | 脚本宿主（W5a 前置） | script 5 测试（eval/桥/事件/API/闭环） | ✅ |
| 8 | 门禁 | layered 76 文件 + vendor 5 包 | ✅ |
| 9 | 环境绑定项 | GPU ✅（RTX 4070 双后端）/ 设备 ✅（壳 App 运行+帧循环）/ Actions | 🟡 仅 Actions |

## 终态数字

- CTest 62/62 · node 121/121 · 守护 ≈203 · 测试文件 32 · 构建模块 14 · commits 140+
- 交付链 18 步（含真 GPU/骨骼帧/帧性能汇总/设备全链）；评审材料 16/16 自检 READY；验收 13 张 ✅（首批 9 + W1×2 + W7）+ W1 双后端 10/10

## 申报路径

1. 评审人核 m1-gate-review + m1-final-summary + m1-architecture.html（20 分钟彩排实测）。
2. 环境项（GPU/Actions/真机）转 M2 环境就绪清单（ci-push-checklist / m2-tickets 待办）。
3. 签核：＿＿＿＿＿ 日期：＿＿＿＿＿





## W6 补充（2026-08-28）

- 壳 App 在 Android 模拟器运行（CCX 显示实证）；帧循环 + 引擎光栅上屏 + QuickJS 脚本驱动 + 帧统计上报（ccx device stats）。
- 环境绑定项收敛：仅 Actions CI 真跑（push 后）、签名发布与 iOS 平台待办；W6-1 壳工程 🔄（核心五实证）。






## 终核 12（2026-08-28，v0.3.194）

- 四线终态：材料/环境/彩排/ticket 一致（13 ✅ + W6-1 🔄 + W6-2 ⏳）——M1 申报完结、M2 评审发起就绪。

