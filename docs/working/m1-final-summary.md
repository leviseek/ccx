# M1 收官快照（v0.3.71 终态）

> 由 `ccx doctor --summary` + demo all 实测生成；与 docs/working/m1-final-summary.json 同源。

## 数字（本机实测）

- CTest 51/51；node --test 106/106；引擎构建模块 14；Node 测试文件 29；demo all **15 步**全 ok
- 守护合计 ≈ 182 项；vendor 包 5（pal/audio/storage/main/quickjs）
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

