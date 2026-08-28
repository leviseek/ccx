# M1 收官快照（v0.3.71 终态）

> 由 `ccx doctor --summary` + demo all 实测生成；与 docs/working/m1-final-summary.json 同源。

## 数字（本机实测）

- CTest 62/62；node --test **125/125**（32 文件，2026-08-29 实测复跑）；引擎构建模块 14；demo all **18 步**全 ok（含真后端帧/骨骼/帧性能汇总）
- 守护合计 ≈ 194 项；vendor 包 6（pal/audio/storage/main/quickjs/webgpu-headers）
- demo 基线：frame.gif 44ms / contact.gif 40ms；总耗 ~90ms

## 能力清单（一条命令可验证）

| 面 | 入口 |
| --- | --- |
| 交付链 | `ccx demo all`（15 步） |
| 环境+健康+性能 | `ccx doctor` / `--demo` / `--summary` |
| 帧可视 | `ccx frame dump/gif`（--device/--contacts/--highlight） |
| 脚本 | `ccx script run`（--engine 走 QuickJS）；预算 `runner --budget` |
| AI 接口 | `ccx mcp tools/call` |
| 会话 | `ccx scene status/apply --cmd/--undo/--redo` |
| Web | `ccx build --out` / `editor preview --site` |

## 状态

- M0 ✅ 关闭；M1 里程碑评审材料齐备（m1-gate-review / m1-handoff / m1-final-summary）
- M2 首批（W3 会话 / W4 外部压缩 / W5 脚本三环）已在 M1 内实现主干；剩余工作包依赖环境（GPU/渠道/Actions）如实记录



## 门禁（2026-08-28 终检）

- layered_imports：**84 文件合规**（铁律 1/6；W7 新增 render→animation 依赖表项，2026-08-29 复跑）
- vendor_check：**6 包合规**（ADR-005；修复 .cxx 构建产物目录误扫）
- 双门禁纳入每轮全量验证（此前曾遗漏 layered，已修复并固化）







## W6 设备面（2026-08-28 补充）

- ccx device status/screenshot/push-frame；壳 App 运行（Java 壳）+ 帧循环 + 引擎场景数据面（Scene→光栅→上屏）+ QuickJS 脚本驱动场景（eval=7 OCR 实证）+ 帧统计上报（logcat CCX_STATS + ccx device stats，ALN-AL00 模拟器）。




