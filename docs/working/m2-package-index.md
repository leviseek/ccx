# M2 立项材料包（总纲索引）

> 一站式入口：M2 立项所需全部材料、生成方式、复核入口。
> 全部位于 docs/working/；自动生成物标注 ⚙。

## A. 立项主体

| 材料 | 用途 | 生成/更新 |
| --- | --- | --- |
| m2-kickoff.md | 7 工作包 + 5 条 exit criteria（源头） | 人工维护 |
| m2-proposal.md | 立项建议书（范围/批次/凭据表 §6b） | 人工维护 |
| m2-tickets.md | 三批 14 张票（✅ 9 + 环境 2 + 未开工 3） | 人工 + 验收记录 ⚙ |
| m2-gate-dress-rehearsal.md | 60 分钟评审议程（判据对照/风险登记） | 人工维护 |

## B. 评审支持

| 材料 | 用途 | 生成/更新 |
| --- | --- | --- |
| m2-review-package.md | 评审包索引（10 件顺序 + 一键复核） | 人工维护 |
| m2-review-ready.md | 评审就绪实录（当天状态页） | 半自动（自检后更新） |
| m2-rehearsal-run.md | 彩排演练实录（机器段 ≈45s 实测） | 半自动 |
| ci/verify_review_package.mjs ⚙ | 自检：材料 12 + 命令 3 → READY | 自动 |

## C. 技术决策与预备

| 材料 | 用途 | 生成/更新 |
| --- | --- | --- |
| script-engine-decision.md | QuickJS 主选决策（八维对比） | 人工维护 |
| gpu-backend-plan.md | W1 映射表 + 五级验收（附录 B） | 人工维护 |
| ci/verify_w1_sim.mjs ⚙ | W1 五级仿真验收（5/5） | 自动 |
| ci/verify_m2_batch1.mjs ⚙ | 首批 9 票验收（9/9） | 自动 |

## D. 状态基线（M1 交接）

| 材料 | 用途 | 生成/更新 |
| --- | --- | --- |
| m1-handoff.md | M1 基线 + 环境缺口 | 人工维护 |
| m1-gate-review.md | 里程碑评审数字 | 人工 + ⚙ 同步 |
| m1-final-summary.json/md | 收官快照（51/108/15） | ⚙ doctor --summary |
| ci-push-checklist.md | push 终审 | 人工维护 |
| m1-architecture.html | 架构总览图（四层/三视图） | ⚙ archify（candidate.json 源） |

## 使用路径

- 评审前：`node ci/verify_review_package.mjs`（READY 判定）
- 评审中：m2-review-package.md 顺序走 + 签名
- 立项后：m2-tickets.md 跟踪；首批 ✅ 已验收即转正式
## 校验记录（2026-08-28）

- 自检（ci/verify_review_package.mjs）16 件 md 材料 **覆盖总纲全部**（A-D 四组 + 索引）；4 个 .mjs 工具由命令段（3 条）覆盖。
- 结论：**材料包闭环一致（16 md + 4 mjs + 3 命令）→ READY**。

