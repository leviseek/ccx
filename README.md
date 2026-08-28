# CCX — Game Runtime Platform 架构规格（2D-first）

> 工作代号 **CCX**（"Cocos eXperimental" 的占位名），完整产品名候选：**Game Runtime Platform (GRP)**。
> 本目录是架构规格的**唯一事实来源**（Single Source of Truth）；实际产品仓库按 RD-28 拆分，规格先于代码。

| 项 | 值 |
| --- | --- |
| 规格版本 | v0.2（2D-first 收敛版） |
| 状态 | 决策已定，待立项 |
| 事实基线核实日期 | 2026-08-27（GitHub 实测） |
| 语言 | 引擎核心 C++20；脚本/工具/服务 TypeScript（见 ADR-001） |
| 范围 | **2D-first：不做 3D 能力**（用户裁切，2026-08-27） |
| 许可方向 | MIT（对齐上游可复用资产） |

---

## 0. 这份文档是什么

承接《把 Cocos 重构为 Game Runtime Platform》的完整方案，把其中 28 节内容收敛为**可开工的技术决策（ADR）与模块级规格**。方案中"继续把 Cocos 4 做强"与"推倒重建"之间的争论，在本规格中已落到具体取舍；所有"重写 / 保留"判断都对照了真实仓库状态（见 §1），不是空谈。

**范围声明（v0.2，用户裁切）**：CCX 为 **2D-first** 平台——**不做 3D 能力**。3D 内容管线（网格渲染/PBR/光照/阴影/延迟渲染/GPU-driven/骨骼 3D、gltf/fbx 网格导入、Jolt 物理）全部移出 v1 范围（见 [renderer-spec](docs/renderer-spec.md) §1 范围声明、[asset-spec](docs/asset-spec.md) §8、[roadmap](docs/roadmap.md)）；渲染器抽象层（RHI/Render Graph/Pipeline）保持维度无关，若未来 3D 需求回潮，走"3D Pipeline 插件"评审通道（roadmap §5），不进默认路径。

**阅读顺序**：README（总览）→ 6 份 ADR（为什么这么定）→ 4 份规格（怎么实现）→ roadmap（什么时候做）。

---

## 1. 已核实的事实基线（2026-08-27，GitHub API/文档实测）

| 事实 | 实测内容 | 对方案的影响 |
| --- | --- | --- |
| [cocos/cocos4](https://github.com/cocos/cocos4) | MIT；14.4k star；主语言 C++；默认分支 `v4.0.0`；monorepo：`cocos/`（TS 引擎：2d/3d/animation/asset/core/gfx/gi/input/particle/physics/rendering/render-scene/scene-graph/serialization/ui/webgpu/xr…）、`native/`（C++：cocos/cmake/extensions/tools/utils/vendor）、`editor/`（src/inspector/dashboard）、`extensions/`、`exports/`、`templates/`、`docs/` | "引擎 = TS 核心 + C++ 原生层"的现状确认；**最大可复用资产 = `native/` 平台适配与 `exports/` 模块面**（ADR-005）；**CCX 仅取 2D 相关面**（平台适配/渲染后端基座，不取 3D 模块） |
| [cocos/cocos-cli](https://github.com/cocos/cocos-cli) | MIT；TypeScript；独立仓库（不再在引擎 monorepo 内）；命令面：`create`（--path/--type 2d|3d）、`build`（--project/--platform web-desktop/web-mobile/android/ios…、--stage compile/bundle…、--config、--skip-check）、`start-mcp-server`（--project/--port 缺省 3000）、`wizard`（构建向导/启动 MCP 服务面板/文档）、`pack`；全局 `--no-interactive`（CI 场景） | "CLI 已独立 + 有 MCP"确认。**BuildService 必须保持 CLI 命令面兼容**（services-spec §6） |
| cocos-cli 平台构建插件 | `contributes.builder`（VS Code contributes 思路）：package.json 声明 register/platform/config/hooks；config.ts 继承 `IPlatformBuildPluginConfig`（displayName/platformType HTML5|WINDOWS/options JSON Schema/commonOptions：polyfills、textureCompressConfig（platformType mini-game，etc2_rgb/astc_4x4…））；hooks.ts 状态机：Start→onBeforeInit→Init→onAfterInit→onBeforeBundleInit→BundleInit→onAfterBundleInit→onBeforeBuildAssets→BuildAssets→onAfterBuildAssets→onBeforeCompressSettings→CompressSettings→onAfterCompressSettings→onBeforeCopyBuildTemplate→CopyTemplate→onAfterCopyBuildTemplate→onAfterBuild→End（+ErrorHandling）；可选 `run` | 方案的"Build System 插件化"已被官方实现验证；**CCX 直接采纳该协议**（build-service 与 cli 语义兼容），不另造（ADR-006） |
| MCP 生态 | 官方 CLI `start-mcp-server` + 社区 cocos-mcp（execute_javascript、prompts/resources、截图、资产依赖校验等，基于 Creator 编辑器自动化） | "AI 通过服务操作引擎"方向成立；CCX 的 MCP 是 **Service API 的薄适配层**，业务逻辑一次性写在服务里（services-spec §7） |

**结论**：原方案中"**保留 / 重构平台适配与交付链路，重写引擎核心、渲染、资产系统、编辑器**"的判断，与仓库现状吻合，本规格据此展开（3D 内容管线除外，见范围声明）。另注意：cocos4 引擎本体仍是 **TS 代码在前、C++ native 在后**（`cocos/native-binding`），渲染/物理等热路径大量在 TS 侧 —— 这正是 CCX 要换掉的架构（ADR-001/002 的理由之一）。

---

## 2. 决策摘要表

| ADR | 主题 | 决策 | 状态 |
| --- | --- | --- | --- |
| ADR-001 | 语言选型 | **C++20（引擎核心）+ TypeScript（脚本/工具/服务）双语言**；不引入 Rust | ✅ 采纳 |
| ADR-002 | 运行时数据模型 | **Archetype ECS 为统一数据模型**；底层子系统不强制 ECS；保留树层级 | ✅ 采纳 |
| ADR-003 | 场景/预制体格式 | **公开可 diff 的 JSON schema（v1）+ 二进制变体**；prefab = 模板 + override | ✅ 采纳 |
| ADR-004 | 脚本系统 | **TypeScript 为游戏脚本；V8/JSC/Web 宿主 + 代码生成绑定**；不造 VM | ✅ 采纳 |
| ADR-005 | 平台层策略 | **vendor 复用 cocos4 `native/` 适配 + 能力模型**；后端矩阵按 2D 视角收敛（GLES3 移动主后端，D3D12 不做） | ✅ 采纳 |
| ADR-006 | 服务层协议 | **JSON-RPC 2.0 + JSON Schema IDL；CLI/Editor/MCP 同一服务面**；Build 插件协议对齐 cocos-cli | ✅ 采纳 |

> 每份 ADR 内含：背景 → 候选 → 决策 → 理由 → 后果与反制。修订走 ADR 流程（draft/proposed/accepted/obsolete）。

---

## 3. 原方案"12 条架构铁律" → 落地映射

| # | 铁律 | 落地机制（本规格） |
| --- | --- | --- |
| 1 | Engine 不依赖 Editor | 依赖方向图（engine-spec §1）+ CI 依赖门禁（layered_imports lint） |
| 2 | Editor 不拥有独占能力 | 所有编辑能力 = Service API 调用（services-spec §2）；Editor 无私有后端 |
| 3 | CLI/Editor/MCP 同一 Service API | ADR-006；`packages/*-service` 单一实现 |
| 4 | 核心功能必须 Headless | asset-spec §3（headless 队列）；build-service 无 UI 依赖；scene-service 可无窗口运行 |
| 5 | Runtime 与 UI 数据模型分离 | ECS 数据 ↔ 编辑器命令模型分离（engine-spec §3 / services-spec §4） |
| 6 | ECS 统一数据模型、不强迫全 ECS | ADR-002：物理/渲染/音频保持自有结构 + bridge 组件 |
| 7 | Renderer = RHI + Render Graph + Pipeline | renderer-spec §2-4（2D 内容管线） |
| 8 | Platform = Capability + Adapter，无平台宏污染 | platform-spec §2-3；CI 禁止 `#ifdef PLATFORM` 进入引擎/游戏代码 |
| 9 | Asset Pipeline 脱离 Editor | asset-spec：Importer/Cook 服务化，CLI 可直接驱动 |
| 10 | Build Pipeline 插件化 | ADR-006：contributes.builder 兼容协议 |
| 11 | Scene/Prefab 公开结构化可 diff | ADR-003 + asset-spec §2 |
| 12 | 所有 Editor 操作映射为 Command | services-spec §4 Command Bus + 命令日志 |

---

## 4. 文档地图

| 文件 | 内容 | 读者 |
| --- | --- | --- |
| [docs/adr/001-engine-language.md](docs/adr/001-engine-language.md) | 语言选型（C++20+TS，不选 Rust 的理由） | 全员 |
| [docs/adr/002-ecs-and-data-model.md](docs/adr/002-ecs-and-data-model.md) | ECS 统一数据模型与边界 | 引擎组 |
| [docs/adr/003-scene-prefab-format.md](docs/adr/003-scene-prefab-format.md) | 公开场景/预制体数据格式（2D 组件集） | 引擎组/工具组 |
| [docs/adr/004-scripting-host-and-binding.md](docs/adr/004-scripting-host-and-binding.md) | 脚本宿主与绑定生成 | 引擎组 |
| [docs/adr/005-platform-reuse-strategy.md](docs/adr/005-platform-reuse-strategy.md) | 平台层复用策略（vendor 清单、2D 后端矩阵） | 平台组 |
| [docs/adr/006-service-api-and-rpc.md](docs/adr/006-service-api-and-rpc.md) | 服务层协议与客户端统一 | 服务组 |
| [docs/engine-spec.md](docs/engine-spec.md) | 模块树、ECS 规格、反射/序列化、脚本绑定、构建（2D） | 引擎组 |
| [docs/renderer-spec.md](docs/renderer-spec.md) | RHI / Render Graph / Pipeline、2D 批处理路线 | 渲染组 |
| [docs/asset-spec.md](docs/asset-spec.md) | 三阶段资产流水线、AssetDB 协议、Cook 矩阵（2D） | 工具组 |
| [docs/platform-spec.md](docs/platform-spec.md) | Capability 模型、vendor 来源、平台测试矩阵 | 平台组 |
| [docs/services-spec.md](docs/services-spec.md) | Service API 目录、Command Bus、MCP 映射、Editor 边界 | 服务组 |
| [docs/roadmap.md](docs/roadmap.md) | M0-M5 里程碑、风险登记、回退点（2D） | 管理/全员 |

---

## 5. 快速阅读指南

- **老板/投资人**：README §1-2 + roadmap 风险页。
- **架构评审**：6 份 ADR 全部 + 各规格的"边界与禁止事项"章节。
- **引擎工程师**：engine-spec + renderer-spec。
- **工具链工程师**：asset-spec + services-spec。
- **平台工程师**：platform-spec + ADR-005。
- **AI/Agent 开发者**：services-spec §7（MCP 映射）+ ADR-003（数据格式）。

---

## 6. 与 cocos4 / cocos-cli / Cocos Creator 的关系（一句话各版）

- **CCX 不是 cocos4 的下一版**：引擎核心用新架构（ADR-002），但**尽可能多地 vendor 复用 cocos4 `native/` 平台适配**（ADR-005），并**完整兼容 cocos-cli 的命令面与构建插件协议**（ADR-006）。
- **Creator 存量用户**：由 `cc4-compat` 兼容层 + 迁移器承载（engine-spec §8），数据格式直接转 ADR-003 新格式（**2D 项目为主**）。
- **CCX 的护城河**：跨平台 Runtime（继承）+ 模块化现代引擎（重建）+ 组件化编辑器（重建）+ Headless 工具链（重建）+ AI/Agent 接口（重建），与原方案 §27 一致；**v0.2 起为 2D-first（用户裁切：不需要 3D 能力）**。

---

## 7. 执行状态（T+0 开工记录，2026-08-27）

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 仓库骨架（monorepo） | ✅ 已建 | CMakeLists + CMakePresets（ci-linux/ci-windows）+ engine/foundation + 13 个模块占位 + packages/（cli + 5 服务占位） |
| 三条 CI 门禁 | ✅ 已建并本地验证 | ci/gates/layered_imports.mjs（9 文件通过）/ vendor_check.mjs（空通过）/ schema_roundtrip.mjs；.github/workflows/m0-ci.yml 双平台矩阵 |
| 灯塔任务 A（反射+序列化） | ✅ **本地编译并测试全绿** | w64devkit g++ 16.2 + mise cmake 4.4.3/ninja 1.13.2；ctest 1/1 Passed（详见 engine/tests/roundtrip_test.cpp 输出） |
| 灯塔任务 B（vendor 清单） | ✅ **评审完成** | docs/working/vendor-candidates.md（GitHub API 实测目录与大小；V1–V9 取 ≈5.5–6MB；修正 ADR-005 两处假设） |
| 灯塔任务 C（bindgen） | ✅ **原型完成并验证** | tools/bindgen：IDL → napi/.d.ts/schema；node --test 5/5 + tsc 类型检查通过 |
| 灯塔任务 D（SpriteBatch） | ✅ **原型完成并验证** | engine/tests/batch_prototype_test.cpp：100 同键精灵=1 批；ctest 2/2 Passed |
| 工具链 | ✅ mise 管理 | .mise.toml（cmake/ninja）；本地编译器 w64devkit（CI 用系统编译器，见 engine/README） |
| CLI 壳 | ✅ doctor/version + --json | packages/cli/bin/ccx.mjs |
| ADR 会签 | ✅ 用户已认可（2026-08-27） | 6 份 ADR 全部采纳；后续变更走 ADR 流程 |
| M0 gate 评审 | ✅ **已会签关闭 M0（2026-08-27）** | docs/working/m0-gate-review.md §5（裁定 A + 签字）；M1 已开工 |
| ECS 最小实现（M0 工作包） | ✅ **实现并测试全绿** | engine/ecs：World/Entity(版本)/Archetype(SoA+自动扩容)/Query/CommandBuffer；ctest 3/3（含 1000 实体跨 chunk 扩容用例） |
| M0 出口①（场景 JSON+diff） | ✅ **补齐** | examples/scenes/sample.scene.json + scene_sample_test（golden/反读/幂等）；git diff 演示见评审材料 §3 |
| M0 出口④（bindgen napi） | 🟡 **基础设施补齐，待真 CI** | napi/binding.gyp + smoke + CI 任务 lighthouse-c-bindgen；本机 5/5+tsc 通过 |
| **M1 引擎（13 构建模块）** | ✅ 本地全绿 | foundation/ecs/scene/render/gfx/animation/particle/input/game/assets/audio/physics + CTest 43 项 |
| **M1 服务三形态** | ✅ 真进程守护 | stdio daemon（scene/asset/audit/profiler/build RPC + EOF 优雅退出 + detached 常驻）、CommandBus、CLI 17 子命令 |
| **M1 交付链** | ✅ 单命令八步 | `ccx demo all`：open→apply→save→build→profiler→frame.gif→contact.gif→cook |
| **M1 物理面** | ✅ 全链 | 宽相（SpatialGrid）→窄相→层掩码→ccx.Collider 组件→接触事件→组件/音效联动→时序动画断言 |
| **M1 动画/渲染面** | ✅ 全链 | 曲线/精灵帧/状态机合流↔渲染项↔packer↔相机↔软件光栅像素断言（PPM/BMP/GIF 可视） |
| **M1 编辑器面** | ✅ 模型+视图 | EditorShell + buildView + renderViewHtml + preview（--frame/--gif 嵌入）——M2 Web UI 的完备前端产物 |
| **M1 工具与一致性** | ✅ 持续守护 | 跨语言对拍（render plan）、场景 diff（ADR-003）、CLI cook/atlas/doctor 环境体检（模块/测试计数） |
| **M1 剩余硬缺口** | 🟡 环境依赖 | GPU 首帧（缓冲上传/绘制= M2 W1）、V8 脚本宿主（CI 待跑）、Web 构建目标——见 m1-handoff §2 |

构建复现（本地）：`mise install` 后 `cmake -S . -B build/local -G Ninja -DCMAKE_CXX_COMPILER=<g++>` → `cmake --build build/local` → `ctest --test-dir build/local`。

## 变更记录

- **v0.3.94（2026-08-28）**：M2 评审包终版——**评审包索引 10 件 + 自检 12 材料**（就绪实录/彩排实录并入）；**ctest 自动探测**（--verify 无 CC_CTEST 时默认 w64devkit——评审环境零配置）；README 2 处数字残留修正；ctest 51/51 + node 106/106。
- **v0.3.93（2026-08-28）**：M2 彩排面——**评审彩排演练实录**（m2-rehearsal-run.md：逐段计时（机器段合计 ≈45s）+ 结论（20 分钟内可完成，远优于 60 分钟声明）+ 现场检查表）；ctest 51/51 + node 106/106。
- **v0.3.92（2026-08-28）**：M2 就绪面——**评审就绪实录**（m2-review-ready.md：自检实跑（10 材料/3 命令 READY）+ 评审现场速览 + 结论栏——评审当天状态页）；ctest 51/51 + node 106/106。
- **v0.3.91（2026-08-28）**：M1 预算链面——**脚本预算入交付链**（runner --budget <ms>（overBudget 输出）+ demo script.engine 步 budgetMs/budgetOk（100ms 预算实跑未超支，7ms）；断言入链）；ctest 51/51 + node 106/106。
- **v0.3.90（2026-08-28）**：M1 链终态——**文档链数字终检**（summary/md/README 对齐 106/51/15/182；29 测试文件；109+ commits）；ctest 51/51 + node 106/106。
- **v0.3.89（2026-08-28）**：M2 评审预检——**评审包自检脚本**（ci/verify_review_package.mjs：10 件材料存在性 + 3 条一键复核命令实跑（--all --verify/--all/demo all）→ READY 判定；评审前 30 秒自检）；ctest 51/51 + node 106/106。
- **v0.3.88（2026-08-28）**：M2 评审包——**立项评审包索引**（m2-review-package.md：8 件材料顺序+一键复核命令（doctor --all --verify / demo all）+ 签名栏——评审人照着走）；链终态：109 commits/19 文档；ctest 51/51 + node 106/106。
- **v0.3.87（2026-08-28）**：M2 状态回流——**首批 9 张 ticket 标记 ✅ 已验收**（m2-tickets.md：凭据自动复核通过 + 日期；验收方法段更新为 verify 脚本/doctor 命令）；ctest 51/51 + node 106/106。
- **v0.3.86（2026-08-28）**：M1 总页面——**ccx doctor --all --verify**（验收总键：W1 五级 + M2 首批 9 票一页输出；修复 cmd 引号拆词（pattern 无空格）+ 子进程超时治理（120s）；batch 复核从 55s 提速到 13s）；ctest 51/51 + node 106/106。
- **v0.3.85（2026-08-28）**：M2 验收走查——**首批 9 张 ticket 自动化验收**（ci/verify_m2_batch1.mjs：逐张执行凭据（node/ctest 双形态）→ JSON 表；T-W2-1 静态源码 grep 规避 node24 管道二进制 TAP；9/9 全过 ≈55s）；ctest 51/51 + node 106/106。
- **v0.3.84（2026-08-28）**：W1 命令面——**ccx doctor --w1**（五级里程碑验收一键（仿真侧）：ok/allPassed/gpu 标记；GPU 到达接真后端同骨架）；ctest 51/51 + node 103/103。
- **v0.3.83（2026-08-28）**：W1 验收面——**五级里程碑验收脚本**（ci/verify_w1_sim.mjs：L1-L5 仿真验收 JSON（rhi_fake/fake_gpu_frame/render_frame/fake_gpu_runtime/script_to_frame）5/5 全过；GPU/lavapipe 到达后同骨架接真后端段；测试含 CC_CTEST 注入）；ctest 51/51 + node 102/102。
- **v0.3.82（2026-08-28）**：M1 探测面——**ccx doctor --net**（W1 预备网络探测：webgpu.h/quickjs 源可达性（curl HEAD 200 判定）；当前环境如实回报不可达）、**demo 计时快照落库**（demo-timing-latest.json）；ctest 51/51 + node 101/101。
- **v0.3.81（2026-08-28）**：M2 决议面——**Ticket 清单**（m2-tickets.md：三批 14 张票（首批 9 张主干已完成=验收复核态/二批 W1/W7/三批 W6），每张附验收凭据与依赖）；ctest 51/51 + node 100/100。
- **v0.3.80（2026-08-28）**：M2 评审面——**立项评审预演**（m2-gate-dress-rehearsal.md：60 分钟议程/5 判据凭据对照/风险登记/输出模板；七件材料落库核对全过——M2 达到"可评审"状态）；ctest 51/51 + node 100/100。
- **v0.3.79（2026-08-28）**：W1 预演——**RHI↔webgpu.h 接口映射核对表**（gpu-backend-plan 附录 B：8 项契约对齐 + lavapipe 路径 + 五级里程碑细化检查项；webgpu.h 下载评估网络不可达如实记录为待复测）；ctest 51/51 + node 100/100。
- **v0.3.78（2026-08-28）**：M1 可视化收官——**CCX 架构总览图**（docs/working/m1-architecture.html：archify showcase 9/9 校验通过；四层（CLI/服务/引擎/消费）+ 12 节点 + 三视图（主路径/脚本面/外部接口）；640KB 自包含可交互）；ctest 51/51 + node 100/100。
- **v0.3.77（2026-08-28）**：M2 首批收官——**工作包凭据表**（m2-proposal §6b：W3/W4/W5 每条附可复核验证方法；复核路径实测 5.3s 全绿）；ctest 51/51 + node 100/100。
- **v0.3.76（2026-08-28）**：M1 push 终核——**提交链 97 commits 连续**（树干净）、**快照刷新**（100/27 files/14 模块/175 守护）；ctest 51/51 + node 100/100。
- **v0.3.75（2026-08-28）**：M1 总页面——**ccx doctor --all 五合一**（环境 checks + 规模 summary + 交付链 demo 一页输出；含脚本宿主/QuickJS vendor 检查）；ctest 51/51 + node 100/100。
- **v0.3.74（2026-08-28）**：M1 治理面——**脚本预算**（setBudgetMs/overBudget：单次执行耗时限额+超支标记+清除；零预算触发/恢复无告警测试）、**CI push 终审清单**（docs/working/ci-push-checklist.md：本地复核/push 后 Actions 确认/待环境项）；ctest 51/51 + node 99/99。
- **v0.3.73（2026-08-28）**：M1 统计面——**引擎侧脚本统计**（ScriptHost::evalCount/lastScriptMs：每次 eval/invoke 计时毫秒 + 执行计数——QuickJS 耗时入 profiler 视野；game_loop 测试断言计数/耗时）；ctest 51/51 + node 99/99。
- **v0.3.72（2026-08-28）**：M1 收官——**成品快照**（m1-final-summary.json/md：51/99/15/174 实时值 + 能力清单 + 状态）、**文档链数字核对**（m1-gate-review 全同步）；ctest 51/51 + node 99/99。
- **v0.3.71（2026-08-28）**：M1 链终面——**demo all 十五步**（+script.engine：QuickJS 引擎执行器入交付链，2 命令/2 实体实跑 ok）；summary/doctor 同步 15；ctest 51/51 + node 99/99。
- **v0.3.70（2026-08-28）**：M1 双路径面——**ccx script run --engine**（CLI 走 QuickJS 引擎执行器（未构建则明确提示回落 daemon）；测试断言 engine=quickjs/2 命令/2 实体）、**终评数字同步**（CTest 51/98/14/172）；ctest 51/51 + node 99/99。
- **v0.3.69（2026-08-28）**：M1 引擎脚本面——**ccx_script_runner 引擎脚本执行器**（命令文件裸 JSON 行/JS 表达式双模式：QuickJS eval + 真实场景桥 + ADR-003 落盘；Node 冒烟两模式全过；路径 JSON 规整）；终评刷新（97/172/14）；ctest 51/51 + node 98/98。
- **v0.3.68（2026-08-28）**：M1 闭环面——**脚本→引擎消费闭环**（脚本创作（2 实体+组件+transform）→ ADR-003 保存 → 装载 → packer 渲染帧等价（8 顶点/2 批/位置一致）——脚本场景可被渲染管线直接消费，一次通过）、**doctor 脚本宿主/QuickJS vendor 自检**；ctest 51/51 + node 97/97。
- **v0.3.67（2026-08-28）**：M1 脚本链面——**demo all 十四步**（+script.run：命令脚本驱动场景入交付链）；summary/断言同步 14；ctest 50/50 + node 97/97。
- **v0.3.66（2026-08-28）**：M1 正式化面——**脚本命令桥升级正式场景数据面**（script::applySceneCommand 直通 scene::Scene：create_entity/add_component/set_transform/destroy_entity/snapshot 五操作真实生效；测试 6 组（组件数据在场/世界变换更新/销毁/快照/未知拒绝）；途中澄清 EntityId 索引 0 起语义）；ctest 50/50 + node 97/97。
- **v0.3.65（2026-08-28）**：M1 脚本入口面——**ccx script run**（命令脚本文件（每行 JSON 命令 + # 注释）→ daemon 同序执行 → 场景文件落盘；非法命令行明确报错——exit3 的用户侧命令面）；CLI 25/25；ctest 49/49 + node 97/97。
- **v0.3.64（2026-08-28）**：M1 一致性面——**跨语言统一断言**（exit3 剧本雏形：脚本桥 exe --dump（固定三命令：create hero/npc + add Health）与 daemon 同序列对拍——entities=2、名字集合一致；脚本/CLI/daemon 三路命令面同构验证）；ctest 49/49 + node 97/97。
- **v0.3.63（2026-08-28）**：M1 W5b 第三环——**onUpdate(dt) 事件桥**（ScriptHost::invoke：C++ 调脚本全局函数（参数 JSON 字符串、错误面同构）；脚本驱动的游戏循环测试：GameLoop 5 步→每步 invoke onUpdate→脚本建实体×5+tick 计数、未定义函数明确报错——**"脚本驱动游戏"最小闭环**）；ctest 49/49 + node 96/96。
- **v0.3.62（2026-08-28）**：M1 W5b 第二环——**脚本→引擎场景命令桥**（ScriptHost::setJsonFunction（JS 字符串→C++ 回调→JSON 结果）；CCX/eval 中调 ccxSceneCommand 驱动 C++ 迷你场景总线：create_entity/add_component/snapshot/未知实体错误——**脚本命令直达引擎数据面**）；ctest 48/48 + node 96/96。
- **v0.3.61（2026-08-28）**：M1 W5b 第一环——**宿主函数接入**（ScriptHost::setHostFunction：HostFn 数值快速路径 + JS_NewCFunctionMagic(generic_magic) 全局注册；脚本调用断言 hostScale(21)+hostSum(1,2,3)=48；调试三连：cproto 调用约定（generic vs generic_magic）、JS_SetProperty 所有权转移、magic 越界防护）；ctest 47/47 + node 96/96。
- **v0.3.60（2026-08-28）**：M1 W5a 突破——**QuickJS 嵌入编译冒烟**（engine/script：ScriptHost（Runtime/Context/eval 错误面/跨 eval 状态保真）；四段调试（enable_language(C)、venor 警告豁免、CONFIG_VERSION 兜底、异常对象转字符串提取）；ctest 47/47 + node 96/96——**脚本宿主在引擎内跑通**。
- **v0.3.59（2026-08-28）**：M1 vendor 与叙事面——**QuickJS 源码 vendor 落位**（engine/platform/vendor/quickjs：quickjs.c/h/cutils/list 四文件大小校验（2.03MB）+ UPSTREAM/LICENSE，遵循 ADR-005——W5a 嵌入的实现体就位）、**demo all 十三步**（+status.summary 守护规模汇总）；vendor gate 5/5；ctest 46/46 + node 96/96。
- **v0.3.58（2026-08-28）**：M1 绑定面——**bindgen IDL→QuickJS C 绑定目标**（generateQuickjs：extern 声明（C 类型：string→const char*）+ JSValue 包装（ToCString/ToFloat64/ToBool + 返回值）+ JS_CFUNC_DEF 方法表 + 模块注册；CLI --quickjs 生成文件；两测试（结构/端到端）全过；途中修 C 类型映射与断言命名）；ctest 46/46 + node 96/96。
- **v0.3.57（2026-08-28）**：M1 决策面——**脚本引擎决策评估**（docs/working/script-engine-decision.md：v8 vs QuickJS 八维对比 + 绑定衔接（IDL→quickjs 目标）+ 风险缓解 → **采纳 QuickJS 主选、v8 备选（接口不变双后端）**）、终评数字刷新（95/162/12 步）；ctest 46/46 + node 95/95。
- **v0.3.56（2026-08-28）**：M1 配置可见面——**doctor 外部压缩器配置位**（CCX_EXTERNAL_COMPRESSOR 已配置/未配置提示；doctor 路径统一仓库根修复）、**M2 首批进度表**（W3 会话全交付 ✅ / W4 环境变量接入 ✅ / W5a 待决策点）；ctest 46/46 + node 95/95。
- **v0.3.55（2026-08-28）**：M1 压缩配置面——**ccx cook 环境变量接入外部压缩器**（CCX_EXTERNAL_COMPRESSOR=格式|cmd|args 注册，png 走外挂端到端 okCount=1；修复 cook 漏传 path 致外挂源缺失的 bug），runCli 支持 env 透传；ctest 46/46 + node 95/95。
- **v0.3.54（2026-08-28）**：M1 会话命令与压缩面——**scene apply 流内 --undo/--redo**（与 --cmd 同序执行，进程内共享历史（跨命令新会话语义澄清）；scene status 命令保留）、**外部压缩器接口**（cook externalCompressor：spawn 任一工具（pngquant/astcenc…），{src} 模板 + 产物字节上报 + 全流接入（web-desktop png 经外挂）——W4 真实接入形态验证）；ctest 46/46 + node 95/95。
- **v0.3.53（2026-08-28）**：M1 会话面——**会话版本化 + session.save/load**（scene 服务：version 随 apply/undo/redo 递进；ccx.session/1 快照落盘/恢复（文档级，undo 栈重置）——W3 续批）、**demo all 十二步**（+session.demo：undo×2/redo×2 角色扮演，undoWorked/redoWorked 断言）；daemon 16/16；ctest 46/46 + node 94/94。
- **v0.3.52（2026-08-28）**：M1 会话面——**daemon 场景会话 undo/redo/status RPC**（W3 首批：undo 计数/redo 计数/实体数可查可回滚）、**undo 语义 v2（全量快照）**（create/destroy/属性全部可逆——修复 create 不可逆的 v1 缺口；scene+daemon 22/22）；ctest 46/46 + node 92/92。
- **v0.3.51（2026-08-28）**：M1 汇总面——**doctor --summary**（机器可消费状态：milestone/模块 13/CTest 46/测试文件 25/11 步/时间戳）、**M2 立项建议书**（docs/working/m2-proposal.md：背景/工作包状态/交付节奏三批/资源/验收）；ctest 46/46 + node 92/92。
- **v0.3.50（2026-08-27）**：M1 性能面——**doctor --demo 两轮计时统计**（runs 2 / totalMs 88 / slowest frame.gif / fastest mcp.tools——健康+性能四合一输出）；ctest 46/46 + node 92/92。
- **v0.3.49（2026-08-27）**：M1 入口面——**game.js 运行时入口骨架**（window.CCX.boot：loadIndex（fetch 资产索引）+ ready 回调 + 平台注入——Web 目标的可解释入口形态）、**demo build.web 步产物经校验器回读**（indexValidated: true，校验入交付链）；ctest 46/46 + node 92/92。
- **v0.3.48（2026-08-27）**：M1 站点视图面——**editor preview --site**（消费 ccx.assets.index/1 展示 Web 游戏壳：平台+资产列表；缺产物优雅降级）、**M1 终评刷新**（46/92/155、demo 十一步）；ctest 46/46 + node 92/92。
- **v0.3.47（2026-08-27）**：M1 Web 面——**资产索引校验器**（build-service parseAssetsIndex：schema/platform/assets 条目校验，损坏即拒）、**demo all 十一步**（+build.web：index.html/game.js/assets.json 站点装配入交付链）；ctest 46/46 + node 92/92。
- **v0.3.46（2026-08-27）**：M1 目标面——**帧链全设备化**（frame/contact gif 逐帧走 FakeDevice 上传/绘制/读回路径）、**Web 构建目标骨架**（ccx build --platform web-desktop --out：装配 index.html + game.js + ccx.assets.index/1 清单）；CLI 20/20；ctest 46/46 + node 91/91。
- **v0.3.45（2026-08-27）**：M1 U形路径与预研面——**frame_dump --device**（帧产出经 FakeDevice 上传/清屏/绘制/读回再落盘，与普通路径逐字节一致——真后端替换点已有黄金对照）、**V8 宿主设计**（docs/working/v8-host-design.md：结构/桥接清单/沙箱/风险/W5a 决策点）；ctest 46/46 + node 91/91。
- **v0.3.44（2026-08-27）**：M1 稳定面——**demo 长跑 5 轮计时分布**（总耗时 87–90ms 稳定无抖动；frame.gif 44.6 / contact.gif 40.2 为锚定基线，计入 m1-gate-review）、**CI 覆盖核对**（ctest 跑全量 46 项含假 GPU/物理——push 后 Actions 即验证）；ctest 46/46 + node 90/90。
- **v0.3.43（2026-08-27）**：M1 工具入口与地图面——**ccx mcp tools / mcp call**（CLI 一条命令调任何工具：9 工具列表、asset.list 调用、非法 JSON 报错，CLI 19/19）、**engine README 模块地图**（13 模块能力/依赖/测试矩阵表）；ctest 46/46 + node 90/90。
- **v0.3.42（2026-08-27）**：M1 AI 接口面——**MCP 工具层**（services-spec §7 兑现：daemon mcp.listTools/callTool——9 个现有服务方法注册为工具（schema），callTool 结果以 MCP content 文本返回；真场景流程（open→apply→query）可被 AI 调用、未知工具明确报错），daemon 14/14；ctest 46/46 + node 90/90。
- **v0.3.41（2026-08-27）**：M1 运行时帧面——**假 GPU 运行时**（GameLoop 固定步→场景→packer→动态缓冲重传→清屏/绘制/提交每 render 帧→metrics 记账：3 render 帧 3 提交、hero 移动 6 固定步后新位置像素红、旧位置蓝底——"运行时首帧"全链仿真）、**m1-handoff 基线更新**（首帧仿真写入已实现清单）；ctest 46/46 + node 87/87。
- **v0.3.40（2026-08-27）**：M1 首帧仿真面——**假 GPU 全链端到端**（场景→渲染项→packer 缓冲→FakeDevice 上传（顶点/索引）→清屏→模拟绘制（软件光栅逐像素提交 = 真后端 draw call 的位置）→readback 像素断言：中心红/quad 外蓝底/帧提交计数——**"首帧"在无 GPU 环境的完整生产链**）；ctest 45/45 + node 87/87。
- **v0.3.39（2026-08-27）**：M1 接口面——**RHI 抽象接口核**（engine/gfx rhi.h：Device{createBuffer/createTexture/upload/clear/readback/beginFrame/submit}——PackedVertex→缓冲、RasterTarget→clear/readback 黄金对照的契约）+ **FakeDevice 软件实现**（内存缓冲/纹理像素，无 GPU 环境 3 组契约测试一次通过）；W1 后端实现者拿到明确契约；ctest 44/44 + node 87/87。
- **v0.3.38（2026-08-27）**：M1 健康面——**ccx doctor --demo 一键 e2e 健康**（自跑 demo all：8 步全绿/总耗时/最慢步；嵌套 spawn 输出经临时文件规避 stdout 怪癖后稳定），CLI 18/18；ctest 43/43 + node 87/87。
- **v0.3.37（2026-08-27）**：M1 预演与可观测面——**M2 gate 预演清单**（docs/working/m2-gate-rehearsal.md：五条 exit ← M1 已承接 ← 承接工作 ← 验收动作 + 执行顺序建议）、**demo all 步耗时**（每步 ms 输出：open 1 / apply 0 / save 1 / build 1 / profiler 0 / frame.gif 44 / contact.gif 40 / cook 1）；ctest 43/43 + node 86/86。
- **v0.3.36（2026-08-27）**：M1 文档与自检面——**六模块 README**（particle/input/game/assets/audio/physics：用途/API/语义/测试/依赖/M2 接入点）、**doctor 测试计数自检**（引擎模块 13 / Node 测试文件 23 / CTest 43，一键可见守护规模）；ctest 43/43 + node 86/86。
- **v0.3.35（2026-08-27）**：M1 叙事与透传面——**demo all 八步**（+contact.gif：碰撞时序动画（--contacts 自动高亮）八步全 ok）、**CLI 校验错误透传**（scene apply --cmd Collider 非法数据 → 服务端校验错误原样上浮，CLI 17/17）；ctest 43/43 + node 86/86。
- **v0.3.34（2026-08-27）**：M1 碰撞时序面——**frame_dump --contacts 自动接触高亮**（曲线应用到节点变换→正式 runCollisionSim→接触对白块；vs 手动列表）、**碰撞时序动画断言**（hero 曲线 x0→140 撞 pillar：t0 零白、t2 白块>400px，GIF 同源可生成）；ctest 43/43 + node 85/85。
- **v0.3.33（2026-08-27）**：M1 写路径校验面——**component 数据校验**（CommandBus.validateComponentData：Collider hx/hy 非负数字、layer/mask 整数范围内；非法即拒，未知组件原样放行，测试 7/7 全过）、**frame gif --highlight 透传**（接触高亮进入多帧动画序列）；ctest 43/43 + node 84/84。
- **v0.3.32（2026-08-27）**：M1 组件往返面——**Collider 组件 ADR-003 往返**（文件→loadSceneFile→collectBodies→saveSceneFile→重载→物理体字段逐项一致；文件数据驱动接触：移动 hero 后 runCollisionSim 命中 1 对——物理数据完整走场景文件生命周期）；ctest 43/43 + node 83/83。
- **v0.3.31（2026-08-27）**：M1 接触可视面——**tick_contact 迁移正式碰撞系统**（Scheduler 内调 scene::runCollisionSim（组件体+层窄相），音频触发语义保留）、**frame_dump --highlight**（接触对实体白块叠加：无高亮零白像素、高亮后 >500px 白，一次通过）；ctest 42/42 + node 83/83。
- **v0.3.30（2026-08-27）**：M1 正式化面——**场景碰撞集成 API**（scene::collectBodies + runCollisionSim 进 ccx_scene（scene 依赖 physics 合规），Collider 测试改用正式接口）、**M2 立项刷新**（m2-kickoff §6：七工作包前置实况表——W1 只差 GPU 上传/绘制，W2 有可消费产物）；ctest 42/42 + node 82/82。
- **v0.3.29（2026-08-27）**：M1 组件化面——**ccx.Collider 组件->物理体**（组件 {hx,hy,layer,mask} -> Body -> 宽相+层窄相：英雄移动帧3 起接触，掩码不含对方层时 AABB 重叠也零接触，一次通过）、**doctor 引擎模块计数**（读 engine/*/CMakeLists 如实上报，+物理/音频检查）；ctest 42/42 + node 82/82。
- **v0.3.28（2026-08-27）**：M1 层与叙事面——**碰撞层/掩码**（engine/physics body：Body{box,layer,mask} + canCollide 双向判定 + narrowPhaseLayered 层+AABB 双重过滤；玩家/环境/子弹三层场景下两对接触、玩家-子弹被过滤，一次通过）、**demo all 七步**（+frame.gif：三时间点帧→GIF 动画文件落盘）；ctest 41/41 + node 82/82。
- **v0.3.27（2026-08-27）**：M1 接触驱动面——**接触→组件+音效组合**（tick 中碰撞系统：宽相重建→窄相→ccx.Contact 组件写回 + 新接触唯一触发 PlayEvent（AudioBus）——物理/场景/音频三系统一帧联动，一次通过）；ctest 40/40 + node 82/82。
- **v0.3.26（2026-08-27）**：M1 接触与可视化面——**窄相**（engine/physics contact：宽相候选→AABB 精确接触事件，误报过滤/链式三对/排序稳定，一次通过）、**editor preview --gif**（GIF data URL 嵌入 anim-view——动画序列进编辑器页面）；ctest 39/39 + node 82/82。
- **v0.3.25（2026-08-27）**：M1 动画文件与物理循环面——**ccx frame gif CLI**（--times 多时间点→frame_dump→GIF 动画文件；途中修 buildDir mkdir 与 flags 解析）、**碰撞宽相接入帧循环**（tick 中每帧重建 SpatialGrid→候选对时序：接触期（帧3 起）必有对、宽相 cell 级语义澄清）；ctest 38/38 + node 81/81。
- **v0.3.24（2026-08-27）**：M1 碰撞与动画文件面——**2D 碰撞数据面**（engine/physics：AABB 相交/接触/包含 + 空间网格宽相（跨 cell 插入、潜在对去重、越界忽略），测试一次修正预期后全绿）、**GIF89a 打包器**（gif.mjs：教科书 LZW 编解码 + 调色板量化 + 双帧结构 GCE/图像描述符/像素解码 roundtrip；调试判定编码 add 时机与解码定址两处结构性错位）；引擎模块增至 16 个；ctest 37/37 + node 80/80。
- **v0.3.23（2026-08-27）**：M1 帧动画可视面——**精灵帧动画驱动色块**（frame_dump 读 ccx.SpriteAnimator：帧号→tint 色表，t=0 红帧 vs t=0.1 绿帧主色断言；修复帧号浮点取整与残留 tint 覆盖）、**editor preview --frame**（PPM→BMP→data URL 嵌入页面 frame-view，编辑器看到渲染帧——可视闭环）；ctest 36/36 + node 78/78。
- **v0.3.22（2026-08-27）**：M1 命令与媒体面——**ccx frame dump CLI**（正式入口：--out/--size/--time；flags 解析补 --size/--time/--count）、**PPM→BMP 转换**（24bit BGR 自底向上行对齐，浏览器 data URL 可显示；测试修整 rowSize/行序语义后 2 组全绿）、**音频播放事件数据面**（engine/audio：PlayEvent 队列/音量钳制/主音量/清空，3 组一次通过）；引擎模块增至 15 个；ctest 36/36 + node 76/76。
- **v0.3.21（2026-08-27）**：M1 动态帧面——**frame_dump 时间参数 + 曲线动画采样**（ccx.CurveAnim 线性轨 pos.x：u 钳位插值）、**两帧像素质心差异断言**（t0/t1/t2 红像素质心单调位移 160→224→288，帧 diff 测试——"会动"的像素验证；途中修正视口外幅度的测试设计）；ctest 35/35 + node 73/73。
- **v0.3.20（2026-08-27）**：M1 帧可视面——**虚拟帧导出工具**（ccx_frame_dump：场景→渲染项（atlas 映射色）→光栅→PPM 落盘 + Node 像素对拍（P6 头/尺寸/红与金 quad 像素存在/面积合理）——"看到第一帧"；途中修复 JSON 反斜杠路径转义、Transform position 组件格式、清除色字节序三处真实问题）；ctest 35/35 + node 72/72。
- **v0.3.19（2026-08-27）**：M1 像素与审计面——**软件光栅**（render::RasterTarget + rasterizeQuads：虚拟帧缓冲像素断言）、**daemon 审计记录**（铁律 12 服务化：scene.apply 统一留痕 {at,op,ok,detail}，失败也记录；audit.recent/clear RPC，上限 512）、**demo all 六步**（+profiler.snapshot）；ctest 35/35 + node 71/71。
- **v0.3.18（2026-08-27）**：M1 屏幕链与采集面——**屏幕帧全链**（资产 byteSize→渲染项→packer→OrthoCamera→屏幕像素坐标，(0,0)→(368,257)/(432,193) 与平移后坐标断言）、**C++ PNG 头尺寸解析**（assets::parsePngSize：签名/IHDR/大端宽高；坏签名/短数据拒绝；IHDR→byteSize→渲染边长 E2E）、**`ccx profiler snapshot`**（临时 daemon record→snapshot→schema ccx.profile/1 输出）；ctest 34/34 + node 70/70。
- **v0.3.17（2026-08-27）**：M1 视口与采集面——**正交相机/视口**（Mat4 正交投影 + OrthoCamera worldToScreen）、**资产注册表驱动渲染尺寸**（lookup byteSize→边长→quad 范围）、**profiler-service**（Node 帧统计环形缓冲，与 C++ FrameStats 同构 schema ccx.profile/1；daemon profiler.record/snapshot RPC）；ctest 32/32 + node 69/69。
- **v0.3.16（2026-08-27）**：M1 渲染帧与资产面——**渲染帧全链测试**（GameLoop 固定步 20fps→Scheduler 推进→渲染项收集（含动画 UV）→packer 缓冲→metrics 如实映射 batches/drawCalls/allocBytes，2 精灵 8 顶点 1 draw）、**runtime 资产注册表**（engine/assets：句柄池、槽位复用+版本失效、load 状态、池满拒绝，4 组一次通过）、**doctor 增至 15 项检查**（+粒子/输入/帧循环/资产注册表模块）；引擎模块增至 **13 个**；ctest 30/30 + node 64/64。
- **v0.3.15（2026-08-27）**：M1 渲染提交与宿主面——**Sprite 渲染提交打包**（engine/render packer：RenderItem→批+顶点+索引，UV/旋转/缩放/染色字节化）、**GameLoop 帧循环宿主**（engine/game：固定步长累积/多帧/螺旋保护 maxSubSteps）；引擎模块增至 12 个；ctest 28/28 + node 64/64。
- **v0.3.14（2026-08-27）**：M1 全帧链路——**完整帧循环集成测试**（一帧全接：InputState 按住 W 移动 3 帧→+15px、动画状态机摆动、粒子稳态计数写场景组件、SceneBridge 同步、FrameMetrics 记录；途中揪出忘记 release 导致持续移动的语义坑）、**`ccx editor preview --apply`**（命令回路：--apply 序列在预览生成前应用，7→8 实体入视图）；ctest 26/26 + node 64/64。
- **v0.3.13（2026-08-27）**：M1 内容与交互面——**2D 粒子数据面**（engine/particle：确定性 LCG、固定池、发射/重力/拖拽/淡出、稳态 rate×life）、**输入归一化模型**（engine/input：边沿 pressed/released、多键独立、指针按下/拖拽/抬起；Vec2 补 operator*=）、**`ccx editor preview`**（自包含预览页：buildView→HTML+内联场景+点击交互 JS；修理 preview_page 语法崩坏导致 CLI 全停的问题）；ctest 25/25 + node 63/63。
- **v0.3.12（2026-08-27）**：M1 编辑器渲染与运维面——**最小 HTML 渲染器**（renderViewHtml：buildView→HTML 字符串产物，实体/组件/选中/命令/转义，M2 实 DOM 起点）、**M2 立项材料**（docs/working/m2-kickoff.md：7 工作包/5 exit 标准/依赖风险/Owner）、**`ccx service start/status/stop` 常驻模式**（detached+pid 文件+日志流；阶段复现并修复三个真问题：worker fork 不支持 stdio 路径、detached 下 stdin 为 ignore 事件循环空、常驻需心跳保持）；ctest 23/23 + node 62/62。
- **v0.3.11（2026-08-27）**：M1 编辑器与差分面——**编辑器视图模型**（buildView：panel 分区/命令/快捷键/选中/场景实体组件/undo-redo 状态的无头快照，M2 Web UI 渲染层消费）、**结构化场景 diff**（diffScenes：实体/组件/字段三类变更、稳定顺序；`ccx scene diff a b` 可读摘要 + --json 机器输出——兑现 ADR-003 'Git 友好'承诺）；ctest 23/23 + node 60/60。
- **v0.3.10（2026-08-27）**：M1 资产闭环与运维面——**atlas pack→scene atlas→render plan 闭环**（png 目录→ccx.atlas/1→Sprite 场景→1 批渲染计划，'从像素到渲染计划'单链）、**daemon EOF 优雅退出**（stdlib readline close→清理→exit 0，自终止诊断定位挂起根因：测试失败路径未 kill 残留 daemon，修复后套件 10/10）、**M1 交接清单**（docs/working/m1-handoff.md：基线 + 7 项硬缺口与归属）；ctest 23/23 + node 56/56。
- **v0.3.9（2026-08-27）**：M1 整合与诊断面——**动画整合**（状态机选 clip→精灵帧采样→帧循环：AnimState 新增可选 sprite 字段，idle(2帧4fps)→walk(6帧10fps) 切换序列 0,0,1,1,0..5,0 断言）、**`ccx doctor` 环境体检**（11 项检查：骨架/规格/门禁/示例场景/vendor 纪律/构建产物，含修复提示）、**render plan `--out` 产物**（ccx.renderplan/1 JSON 落盘；flags 解析补齐五键）；ctest 23/23 + node 55/55。
- **v0.3.8（2026-08-27）**：M1 循环与编排面——**精灵帧动画接入帧循环**（Scheduler 系统帧首采样→SpriteSampler→场景组件写回，0..5→回绕 0..1 断言；非循环钳末帧）、**`ccx demo all` 端到端编排**（一命令串起 daemon：open(7)→apply(+1)→save→build(5 hooks)→cook，5 步全 ok 输出）；ctest 22/22 + node 52/52。
- **v0.3.7（2026-08-27）**：M1 全链面——**CLI `ccx cook`**（资产扫描→Cook→bundle 一步，压缩器未注册时产物标记 fail 不阻塞 bundle）、**资产全链组装测试**（场景装载→Sprite 收集→material↔shader 校验→pipeline 编译(registry)→渲染计划，一条链路 6 层）；ctest 21/21 + node 51/51。
- **v0.3.6（2026-08-27）**：M1 交付与组装面——**CLI `ccx build` 接入 daemon**（Builder RPC 全链：configure→run→bundle 清单/trace，未知平台明确报错）、**Pipeline pass.shader 引用一致性**（compilePipeline 可选 shaderRegistry，缺失资产指名拒绝）、**帧循环组装测试**（Scheduler(Animation)→Scene 变换→SceneBridge 同步→FrameMetrics 记录，3 帧 x=3 线性断言 + ECS 镜像一致）；ctest 20/20 + node 50/50。
- **v0.3.5（2026-08-27）**：M1 一致性与异步面——**跨语言对拍**（C++ render_plan_dump 与 Node renderPlan 对同一 fixture 逐项一致，消灭双实现漂移）、**daemon 异步化 + build RPC**（dispatch/handle 支持 async 方法；build.platforms/configure/run 走真 Builder 管线；修复 bin 同步调用 Promise 序列化成 {} 的挂起 bug）、**Cook 压缩器插件接口**（注册/调用/缺省报错；M2 由原生 worker 实现）；ctest 19/19 + node 49/49。
- **v0.3.4（2026-08-27）**：M1 服务与桥面——**daemon 真实服务**（scene.open/query/apply/save 接 CommandBus 真写路径 + asset.scan 真目录扫描，真进程 RPC 编排持久化测试）、**BuildService 骨架**（Builder 注册表对齐 contributes.builder + bundle 清单确定性哈希 + hooks 状态机错误中断）、**场景↔ECS 桥**（SceneBridge：节点↔实体双向映射 + Transform 数值镜像 + 全量重建；反射特化移入头文件解决跨 TU 可见性）；ctest 19/19 + node 42/42。
- **v0.3.3（2026-08-27）**：M1 组装面——**动画→渲染 E2E**（状态机驱动变换→场景→批结构稳定）、**daemon 事件推送实装**（asset.subscribe：真实 fs 变更→assetChanged 推送，真进程测试）、**编辑器 Shell 最小集**（editor-shell：命令注册表/快捷键归一化/选择集/面板布局模型，与 CommandBus 绑定驱动写路径）；ctest 18/18 + node 37/37。
- **v0.3.2（2026-08-27）**：M1 服务与资产面——**JSON-RPC 2.0 daemon**（service-core：协议/dispatcher/stdio daemon/客户端，真进程测试 4 组 + `ccx service demo` 端到端）、Cook 管线骨架（2D 平台矩阵：png/webp/astc4/etc2/bc7 + 音频目标 + 产物记录）、shader 资产与 material 联动校验（参数 ⊆ uniforms、类型匹配、缺参默认值）；ctest 17/17 + node 31/31。
- **v0.3.1（2026-08-27）**：M1 交互与分析面——动画状态机（时间/触发器条件、计时重置、非法过渡容错）、`ccx render plan`（服务侧渲染计划：树序→稳定排序→合批，fixture 与服务/引擎双侧同断言）、foundation metrics（帧统计环形缓冲 128 + JSON 快照，Profiler 骨架）、AssetService 导入队列（确定性 uuid + 优先级 + 幂等去重 + 状态机）；ctest 16/16 + node 24/24。
- **v0.3.0（2026-08-27）**：M1 运行面——精灵帧动画（帧网格/循环/UV）、**场景文件装载/导出**（C++ 引擎读 ADR-003，Transform/Sorting 属性与组件互转，Scene::setParent）、**E2E 渲染计划演示**（fixture 场景 → 装载 → 渲染序 → 合批 → 导出往返）、AssetService watch 事件流（合并/pump/close）；ctest 14/14 + node 19/19。
- **v0.2.9（2026-08-27）**：M1“场景→渲染提交”数据链路——animation 模块（关键帧曲线/缓动/Sampler 循环/驱动 Transform）、render::batcher 正式化（灯塔 D 逻辑入住 render，场景 renderOrder→合批集成测试）、CLI `ccx scene apply`（命令总线接入 CLI）、材质资产解析（shader/blend/params 校验）；ctest 12/12 + node 16/16。
- **v0.2.8（2026-08-27）**：M1 渲染链路 CPU 面——Pipeline 资产解析→RenderGraph 编译（启用剔除/minFeatures 降级门槛/同 target 隐式链，修正写-写与读写顺序规则）、gfx RHI CPU 面（纹理/缓冲描述校验 + HandlePool 防悬垂句柄）、SceneService/CommandBus（命令应用 + undo/redo + ADR-003 读写）；ctest 9/9 + node 14/14。
- **v0.2.7（2026-08-27）**：M1 深度推进——scene 模块（树/2D 排序/world 变换/Prefab override，engine/scene）、RenderGraph 编译器（engine/render，6 组校验用例）、CLI create/scene-new（项目模板 + ADR-003 空场景）、AssetService 骨架（importer 注册表/PNG 头解析/图集 shelf 打包）；ctest 7/7 + node 8/8。
- **v0.2.6（2026-08-27）**：M1 首轮四件套完成——① GITHUB-SETUP.md 推送说明；② bindgen v0.2 扩展（数组/默认值/回调，7/7+tsc）；③ ECS M1 化（Query 缓存 + Stage 调度器 + job::TaskGraph，ctest 5/5）；④ vendor 落地（pal/audio/storage/main 369 文件，tools/vendor/sync.mjs 可复现）。
- **v0.2.5（2026-08-27）**：**M0 gate 会签通过，M0 正式关闭，M1 开工**（裁定 A；出口③④ 待 push 后真 CI 复核）。M1 首轮：bindgen 扩展 / ECS M1 化 / vendor 落地 / GitHub push 说明。
- **v0.2.4（2026-08-27）**：M0 gate 会前材料就绪（docs/working/m0-gate-review.md）；补齐出口①（场景样例+golden 测试+diff 演示）与出口④（bindgen napi 编译冒烟 CI 任务）；ctest 升至 4/4。
- **v0.2.3（2026-08-27）**：ADR 会签通过（用户认可）；ECS 最小实现完成并测试全绿（engine/ecs，ctest 3/3；修复 chunk 越界与 CommandBuffer 占位实体 op 残留两个真 bug）
- **v0.2.2（2026-08-27）**：灯塔任务 B/C/D 全部完成——vendor 裁剪清单（实测数据）、bindgen 原型（5/5 测试 + tsc 通过）、SpriteBatch 合批原型（ctest 2/2）。
- **v0.2.1（2026-08-27）**：T+0 开工——仓库骨架 + 三条 CI 门禁 + 灯塔任务 A（反射/序列化 round-trip）本地编译测试全绿；工具链转入 mise（cmake/ninja）。
- **v0.2（2026-08-27）**：范围收敛 **2D-first**（用户裁切：不需要 3D 能力）——renderer/engine/asset/roadmap 重写，ADR-005 后端矩阵改 2D 视角（GLES3 移动主后端、D3D12 不做），ADR-003 示例组件改 2D 集；修复全部 Markdown 代码块转义。
- **v0.1（2026-08-27）**：首版可开工基线（决策与规格全量）。

*规格基线 v0.2 · 所有决策点均以 ADR 状态为准；修改需走 ADR 流程。*

