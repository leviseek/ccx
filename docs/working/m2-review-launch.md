# M2 评审正式发起（终态声明）

> 2026-08-28 · 前置：m2-review-invitation（发起文）+ m2-review-ready（就绪页）+ m2-rehearsal-run（彩排实测）

## 就绪终态（全绿复核）

| 面 | 状态 |
| --- | --- |
| 交付链 | demo all 16 步（含真后端帧/脚本双路径/预算） |
| 引擎 | CTest 61/61（含 W1 真后端 5 级 + W7 骨骼全链） |
| 服务/工具 | node 114/114；CLI 28+ 子命令 |
| 验收 | W1 双后端 10/10；首批 9 票 + W1×2 + W7 ✅（12 张） |
| 门禁 | layered 80 文件 + vendor 6 包 |
| 环境 | GPU ✅（RTX 4070）；网络待复测；Actions/真机（W6）待办 |

## 发起

- 评审可随时举行（约 20 分钟，彩排实测）；材料路径：m2-package-index.md。
- 会前自检：`node ci/verify_review_package.mjs` → READY。
- 会后回写：结论/批次决议 → m2-tickets.md（跟踪规则已就绪）。

## 待环境项（如实）

- W6 真机（Android/iOS 渠道）：adb 无设备；账号/签名待配置。
- Actions CI 真跑：push 后确认（ci-push-checklist）。
- 网络（webgpu.h 等上游源）：doctor --net 可查。
