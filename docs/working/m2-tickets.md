# M2 Ticket 清单（立项转 ticket 的决议兑现）

> 日期：2026-08-28 · 来源：m2-proposal（§3 批次）+ §6b 凭据 + 评审预演输出模板"决议记录"
> 状态图例：⬜ 未开工 · 🟦 主干已在 M1 完成（转 ticket 即验收复核） · ⏳ 待环境

## 第一批（无 GPU 即行）

| Ticket | 标题 | 验收凭据 | 状态 |
| --- | --- | --- | --- |
| T-W3-1 | 场景会话 undo/redo/status RPC | daemon.test.mjs 2 测试；ccx scene status/apply --undo/--redo | 🟦 |
| T-W3-2 | 会话版本化 + session.save/load | daemon.test.mjs（版本 3→2 回退断言） | 🟦 |
| T-W4-1 | 外部压缩器接口（spawn 任意工具） | cook.test.mjs；CCX_EXTERNAL_COMPRESSOR 端到端 | 🟦 |
| T-W5-1 | QuickJS 嵌入（eval/错误/状态） | script.host 测试组 | 🟦 |
| T-W5-2 | 宿主函数 + JSON 命令桥 | script.scene_bridge / scene_api | 🟦 |
| T-W5-3 | 事件桥 onUpdate(dt) | script.game_loop | 🟦 |
| T-W5-4 | 引擎脚本执行器 + CLI --engine | script_runner.test.mjs；cli.test.mjs | 🟦 |
| T-W5-5 | 跨语言一致性对拍 | cross_script_consistency.test.mjs | 🟦 |
| T-W2-1 | 编辑器 Web UI 接会话 undo | editor preview --apply 回路（依赖 W1 预览） | ⬜ 依赖 W1 |

## 第二批（GPU 到位即启动）

| Ticket | 标题 | 验收凭据 | 状态 |
| --- | --- | --- | --- |
| T-W1-1 | 真后端接入（wgpu-native/GLES） | gpu-backend-plan 附录 B 五级里程碑 L1-L5 | ⏳ |
| T-W1-2 | 五级像素对照验收 | L3/L4 黄金 PPM 差分 ≤ 容差 | ⏳ |
| T-W7-1 | Spine 桥（骨骼动画） | 帧动画/帧循环 + W1 渲染路径 | ⬜ 依赖 W1 |

## 第三批（渠道）

| Ticket | 标题 | 验收凭据 | 状态 |
| --- | --- | --- | --- |
| T-W6-1 | Android 样例构建链 | 真机首帧截图+帧统计 | ⏳ |
| T-W6-2 | iOS 样例构建链 | 同上 | ⏳ |

## 运行说明

- 🟦 ticket 验收 = 跑 §6b 复核路径（ctest -R "script|e2e" && node --test 3 文件 ≈ 5.3s）+ 相关命令演示。
- 新 ticket 验收模板：标题/验收凭据（一条命令或测试名）/依赖/评审签字。
