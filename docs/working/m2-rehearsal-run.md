# M2 评审彩排演练实录（计时实测）

> 日期：2026-08-28 · 目的：验证预演议程"60 分钟内完成"声明；结果远优于预算。

## 逐段计时（本机实跑）

| 段 | 内容 | 实测耗时 |
| --- | --- | --- |
| 1 | 交接实况（ccx doctor --all） | <1s |
| 2 | 架构总览（浏览器打开 m1-architecture.html） | 人工 ~1min |
| 3 | 范围与批次（m2-proposal 阅读） | 人工 ~5min |
| 4 | 首批凭据（node ci/verify_m2_batch1.mjs） | 13s |
| 5 | W1 预备（ccx doctor --w1） | <3s |
| 6 | 决策点（ccx script run --engine 演示） | <2s |
| 7 | 自检收口（ci/verify_review_package.mjs） | 16.3s |
| 8 | 健康性能（ccx doctor --demo 两轮） | 7.7s |
| Σ 机器段 | — | ≈ 45s |

## 结论

- 机器段全部 <1 分钟；人工段（阅读/讨论）预算 10-15 分钟——**全程可在 20 分钟内完成**，远优于 60 分钟声明。
- 评审当天的额外风险仅剩：环境依赖项讨论（GPU/Actions/真机）与结论填写。

## 现场检查表（评审人）

1. [ ] ccx doctor --all --verify（≈15s）全绿
2. [ ] ccx demo all（≈3s）15 步全 ok
3. [ ] 材料 10/10（verify_review_package）
4. [ ] 结论三择 + 批次决议 + 签名
## 终版彩排重演（2026-08-28，v0.3.142，双就绪环境）

- 自检 READY：18.9s（材料 16 + 命令 3）
- demo all 18 步：2.6s
- W1 双后端 10/10：2.7s
- 设备：ALN-AL00 在线（ccx device status）
- **机器段合计 ≈24.2s**——评审全程仍可在 20 分钟内完成；环境矩阵仅剩 Actions CI 真跑（push 后确认）。
## 终版彩排 3（2026-08-28，v0.3.160，全链含设备）

- 自检 READY 19s + demo 18 步 2.6s + W1 双后端 2.7s + device status 0.1s + screenshot 0.2s
- **机器段合计 ≈24.6s**——评审随时可举行；环境矩阵仅剩 Actions CI 真跑（push 后）。
## 终版彩排 4（2026-08-28，v0.3.170，全链终态）

- 自检 19s + demo 18 步 2.6s + W1 10/10 2.7s + 设备截图 0.8s——机器段 ≈25.1s
- 环境：GPU + 设备（壳全链）+ vendor；仅 Actions CI 真跑待 push。
## 终版彩排 5（2026-08-28，v0.3.176，含统计上报）

- 自检 18.9s + demo 2.6s + 设备 stats 0.1s——机器段 ≈21.6s（W1 另 2.7s）
- 设备统计上报链路（logcat CCX_STATS → ccx device stats）纳入评审路径。
