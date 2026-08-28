# CCX M2 立项建议书（v0.3.50 汇总）

> 日期：2026-08-28 · 输入：m1-gate-review / m2-kickoff / m2-gate-rehearsal / gpu-backend-plan / v8-host-design
> 一句话：让第一帧出现在真实 GPU 上，并让"编辑器全程无手改 JSON + 脚本可跑"内测通过。

## 1. 背景（M1 交接实况）

- 引擎 13 构建模块；CTest 46 + Node 92 用例守卫；交付链 **demo all 11 步**单命令（含 Web 站点、物理动画、AI 接口、性能统计）。
- 首帧仿真（RHI 契约 + FakeDevice）与软件光栅黄金对照**已就绪**——W1 真后端只差 GPU 环境。
- Web 目标（index.html/game.js/资产索引 + 校验器）与编辑器预览闭环已产出。

## 2. M2 范围与状态

| 工作包 | 内容 | M1 前置状态 | 依赖 |
| --- | --- | --- | --- |
| W1 首帧 | wgpu-native/GLES 接入 RHI（FakeDevice 替换）；五级里程碑验收对照软件光栅 | 契约/仿真/黄金全就绪 | GPU 或 lavapipe CI |
| W2 编辑器 Web UI | buildView→DOM；命令→daemon RPC；帧/动画/GIF 视图已有 | 预览产物全有 | W1（场景预览） |
| W3 服务会话 | daemon 订阅会话（开启场景/undo 级别） | RPC/事件/审计已就 | — |
| W4 压缩 worker | astcenc/etc 接入 registerCompressor | 插件接口+管线就绪 | — |
| W5 脚本宿主 | V8（或 QuickJS，W5a 决策点）嵌入+绑定面+事件桥 | IDL→napi 就绪；设计文档已出 | bindgen CI 真跑 |
| W6 真机 | Android/iOS 样例构建链 | 平台矩阵/打包就绪 | 真机/签名 |
| W7 Spine 桥 | 骨骼动画 | 帧动画/帧循环就绪 | W1 |

## 3. 交付节奏建议

- 第一批（无 GPU 即行）：W3 + W4 + W5a（宿主嵌入与绑定面先行，脚本可驱动场景命令）。
- 第二批：W1（环境到位即五级里程碑验收）、W7 并行。
- 第三批：W2（依赖 W1 预览）、W6（渠道）。

## 4. 资源需求

- 渲染组（W1/W7）：GPU 开发机或 lavapipe CI runner。
- 引擎组（W4/W5）：无额外（CI bindgen 任务仅需 push）。
- 编辑器/工具（W2/W3）：无额外。
- 平台组（W6）：真机/签名/账号。

## 5. 验收（与 m2-gate-rehearsal 五条一致）

第一帧像素对照 / 编辑器 15 步无手改 JSON 内测 / 脚本 10 命令场景 diff 可核 / 真机首帧截图+帧统计 / 压缩产物 magic 校验。

> 本建议书为立项评审输入；批准后 W 包拆 ticket 挂 owner。

## 6. 首批进度（v0.3.55 实况）

- **W3 会话**：daemon undo/redo/status RPC ✅ + 会话版本化 + session.save/load ✅ + CLI 流程内 --undo/--redo ✅ —— **首批可交付项完成**。
- **W4 压缩**：registerCompressor 插件 + externalCompressor（spawn 任意工具）✅ + CCX_EXTERNAL_COMPRESSOR 环境变量配置接入 CLI cook ✅ —— 接 pngquant/astcenc 仅差指名工具。
- **W5a 宿主**：v8-host-design 文档 ✅（决策点：v8 vs QuickJS 未决）—— 待决策后嵌入。
- 剩余依赖：真 GPU（W1/W7）、渠道（W6）、编辑器 DOM 层（W2，依赖 W1 预览）。
## 6b. 首批凭据（复核方法，2026-08-28 实况）

| 工作包 | 状态 | 凭据（一条命令/一处测试可复核） |
| --- | --- | --- |
| W3 会话 | ✅ 交付 | ccx scene status/apply --cmd/--undo/--redo（CLI 会话面）；daemon.test.mjs：场景会话 undo/redo/status、会话版本化与 session.save/load（2 测试）；demo all 第 10 步 session.demo |
| W4 压缩 | ✅ 接入 | cook.test.mjs：外部压缩器（spawn 接入）1 测试；CLI 端到端 CCX_EXTERNAL_COMPRESSOR 配置（cli.test.mjs 1 测试）；doctor 输出"外部压缩器配置"键 |
| W5a 宿主 | ✅ 嵌入 | script.host（eval/错误/状态/宿主函数/预算 断言组）；QuickJS vendor 5 文件 + UPSTREAM（vendor_check 5 包） |
| W5b 绑定 | ✅ 三环 | script.scene_bridge / script.game_loop / script.scene_api / e2e.script_to_frame（4 测试）；script_runner.test.mjs（引擎执行器双模式）；cross_script_consistency.test.mjs（脚本==daemon 对拍） |
| W1 真 GPU | ⏳ 待环境 | 仿真全备：fake_gpu_runtime / rhi_fake / render_frame（3 测试）；五级里程碑验收标准见 m2-gate-rehearsal |
| W6 真机 | ⏳ 待渠道 | 平台矩阵/打包链（cook PLATFORM_MATRIX + build web）本地可跑 |

> 复核路径：ctest --test-dir build/local -R "script|e2e" && node --test packages/service-core/test/daemon.test.mjs packages/cli/test/cross_script_consistency.test.mjs packages/cli/test/script_runner.test.mjs（约 40s）
