# M2 立项评审发起文（邀请模板）

> 收件：评审人（架构/引擎/产品代表） · 日期：2026-08-28 · 预检：READY（16 材料 + 3 命令）

## 邀请

诚邀参加 **CCX 平台 M2 立项评审**。M1 已申报完结（m1-completion.md），M2 立项材料全部就绪（m2-package-index.md 总纲）。

## 议程（约 20 分钟，彩排实测）

| 时间 | 环节 | 材料 |
| --- | --- | --- |
| 2' | 交接实况 + 架构总览 | m1-final-summary + m1-architecture.html |
| 3' | 范围与批次（7 包/三批） | m2-proposal §2-§3 |
| 3' | 首批验收走查（9/9 票） | ci/verify_m2_batch1.mjs 实跑 |
| 2' | 决策点（QuickJS 主选） | script-engine-decision + ccx script run --engine |
| 3' | W1 预备（五级验收） | gpu-backend-plan 附录 B + ccx doctor --w1 |
| 2' | 环境依赖与风险登记 | ci-push-checklist + 预演文档 §3 |
| 5' | 讨论与结论 | 本文件下栏 |

## 会前准备（评审人）

1. `node ci/verify_review_package.mjs`（自检 READY，16 材料 + 3 命令，约 16s）。
2. 通读：m2-proposal（范围/批次）、m2-tickets（状态）、m2-review-ready（速览）。

## 预期产出

1. 结论：☐ 批准立项 ☐ 待补（列项） ☐ 退回（列项）
2. 批次决议：☐ 首批转正式跟踪（9/9 已验收） ☐ 二批待 GPU ☐ 三批待渠道
3. 遗留决议：环境就绪清单（ci-push-checklist）持有人：＿＿＿＿＿
4. 评审人签字：＿＿＿＿＿ 日期：＿＿＿＿＿

> 会后：结论与决议回写 m2-tickets.md（状态更新）与 m2-review-ready.md（评审记录）。


## 终核注记（2026-08-28）

- 环境：GPU ✅（RTX 4070 双后端 10/10）、网络待复测、Actions/真机待办。
- 首批 ✅ 11 张 + W7 ✅；待环境：W6 系 2 张。
- 就绪自检：node ci/verify_review_package.mjs → READY。

