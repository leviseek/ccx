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
| 工具链 | ✅ mise 管理 | .mise.toml（cmake/ninja）；本地编译器 w64devkit（CI 用系统编译器，见 engine/README） |
| CLI 壳 | ✅ doctor/version + --json | packages/cli/bin/ccx.mjs |
| ADR 会签 | ⏳ 需人 | roadmap §7.1 |
| 灯塔任务 B/C/D | ⏳ 待做 | vendor 清单评审 / bindgen 原型 / SpriteBatch 原型 |

构建复现（本地）：`mise install` 后 `cmake -S . -B build/local -G Ninja -DCMAKE_CXX_COMPILER=<g++>` → `cmake --build build/local` → `ctest --test-dir build/local`。

## 变更记录

- **v0.2.1（2026-08-27）**：T+0 开工——仓库骨架 + 三条 CI 门禁 + 灯塔任务 A（反射/序列化 round-trip）本地编译测试全绿；工具链转入 mise（cmake/ninja）。
- **v0.2（2026-08-27）**：范围收敛 **2D-first**（用户裁切：不需要 3D 能力）——renderer/engine/asset/roadmap 重写，ADR-005 后端矩阵改 2D 视角（GLES3 移动主后端、D3D12 不做），ADR-003 示例组件改 2D 集；修复全部 Markdown 代码块转义。
- **v0.1（2026-08-27）**：首版可开工基线（决策与规格全量）。

*规格基线 v0.2 · 所有决策点均以 ADR 状态为准；修改需走 ADR 流程。*
