# M2 立项评审包（索引页）

> 评审人照着走：材料 → 要点 → 复核命令 → 签名。
> 全部材料在 docs/working/ 与仓库中；复核命令均可本机执行（≈2 分钟）。

## 材料清单（按评审顺序）

| # | 材料 | 要点 | 复核命令 |
| --- | --- | --- | --- |
| 1 | m1-final-summary.md/.json | M1 收官快照（51/105/15/181） | ccx doctor --all |
| 2 | m1-architecture.html | 四层架构总览（浏览器打开） | — |
| 3 | m2-proposal.md | 范围（7 包）/三批评交付/凭据表 §6b | — |
| 4 | m2-gate-dress-rehearsal.md | 60 分钟议程/判据对照/风险登记 | — |
| 5 | m2-tickets.md | 首批 9 票 ✅ 已验收；2 票待环境 | node ci/verify_m2_batch1.mjs |
| 6 | script-engine-decision.md | QuickJS 主选决策 | ccx script run --engine |
| 7 | gpu-backend-plan.md | W1 映射表 + 五级验收（附录 B） | ccx doctor --w1 |
| 8 | ci-push-checklist.md | push 终审清单 | — |

## 一键复核（评审现场）

```bash
ccx doctor --all --verify   # W1 五级 + 首批 9 票（≈15s）
ccx doctor --all            # 环境+规模+链（五合一）
ccx demo all --json         # 15 步交付链实跑（≈3s）
```

## 评审结论

- 结论：☐ 批准立项 ☐ 待补（列项） ☐ 退回（列项）
- 批次决议：☐ 首批（W3/W4/W5 主干已验收，转正式跟踪） ☐ 二批（W1/W7 待 GPU） ☐ 三批（W6 待渠道）
- 评审人：＿＿＿＿＿ 日期：＿＿＿＿＿
