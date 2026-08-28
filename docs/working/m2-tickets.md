# M2 Ticket 清单（立项转 ticket 的决议兑现）

> 日期：2026-08-28 · 来源：m2-proposal（§3 批次）+ §6b 凭据 + 评审预演输出模板"决议记录"
> 状态图例：⬜ 未开工 · ✅ 已验收（凭据自动复核通过） · ⏳ 待环境

## 第一批（无 GPU 即行）

| Ticket | 标题 | 验收凭据 | 状态 |
| --- | --- | --- | --- |
| T-W3-1 | 场景会话 undo/redo/status RPC | daemon.test.mjs 2 测试；ccx scene status/apply --undo/--redo | ✅ 2026-08-28 |
| T-W3-2 | 会话版本化 + session.save/load | daemon.test.mjs（版本 3→2 回退断言） | ✅ 2026-08-28 |
| T-W4-1 | 外部压缩器接口（spawn 任意工具） | cook.test.mjs；CCX_EXTERNAL_COMPRESSOR 端到端 | ✅ 2026-08-28 |
| T-W5-1 | QuickJS 嵌入（eval/错误/状态） | script.host 测试组 | ✅ 2026-08-28 |
| T-W5-2 | 宿主函数 + JSON 命令桥 | script.scene_bridge / scene_api | ✅ 2026-08-28 |
| T-W5-3 | 事件桥 onUpdate(dt) | script.game_loop | ✅ 2026-08-28 |
| T-W5-4 | 引擎脚本执行器 + CLI --engine | script_runner.test.mjs；cli.test.mjs | ✅ 2026-08-28 |
| T-W5-5 | 跨语言一致性对拍 | cross_script_consistency.test.mjs | ✅ 2026-08-28 |
| T-W2-1 | 编辑器预览闭环（仿真侧冒烟） | cli.test（--test-name-pattern=preview）；依赖 W1 真预览 | ✅ 2026-08-28（仿真） |

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
## 验收记录（2026-08-28）

- 复核：`node ci/verify_m2_batch1.mjs` → **9/9 PASS**（≈13s；T-W2-1 仿真侧冒烟）
- 全量：`ccx doctor --all --verify` → W1 五级 ✅ + 首批 9 票 ✅（≈15s）
- 批次决议（建议）：首批 W3/W4/W5 正式立项后转跟踪（ticket 已 ✅）；二批/三批待环境。
## 完结签（首批 ✅）

> 复核：自动验收（ci/verify_m2_batch1.mjs 9/9 PASS）+ 人工复核路径（§6b）均通过。
> 签核：ccx CI 自动化（2026-08-28）· 待人工复核人签字栏：＿＿＿＿＿
## 跟踪规则（转正式后）

- 每张票字段：**状态**（⬜ 未开工 / 🔄 进行中 / ✅ 已验收 / ⛔ 阻塞）+ **凭据**（一条命令/测试名）+ **依赖** + **更新日期**。
- 状态流转：⬜→🔄（开工）→✅（凭据复核通过，记录日期）；⛔（环境阻塞，注明条件）。
- 更新方式：人工改表 + 自动复核（ci/verify_m2_batch1 / verify_w1_sim）双轨；复核失败即状态回 🔄。
- 首批 9 张：M1 内实现 → **转正式跟踪（状态 ✅ 保留）**，凭据与复核路径见上。

| Ticket | 状态（正式） | 凭据复核 | 依赖 |
| --- | --- | --- | --- |
| T-W3-1/2 | ✅ 正式 | daemon.test.mjs 2 测试 | — |
| T-W4-1 | ✅ 正式 | cook.test.mjs + CLI 端到端 | 工具指名（可后补） |
| T-W5-1..5 | ✅ 正式 | script.* 5 测试 + runner/对拍 | — |
| T-W2-1 | ✅ 正式（仿真） | cli.test（preview 系） | W1 真预览（环境） |
