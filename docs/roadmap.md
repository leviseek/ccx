# roadmap — 里程碑与风险（M0–M5，2D-first）

> 配套：全部 ADR 与规格。里程碑以"可验证出口"（exit criteria）为准，不以日期为承诺。
> **v0.2：范围收敛 2D-first（用户裁切：不需要 3D 能力）——3D 项全部移除，渲染/物理/资产/基准均为 2D。**

---

## 1. 里程碑总览

| 阶段 | 时间窗（估） | 主题 | 关键出口（exit criteria） |
| --- | --- | --- | --- |
| M0 | 0–3 月 | 地基：repo/构建/反射/序列化/ECS 最小/数据格式/服务骨架 | ① 空场景 JSON 读写 + git diff 演示；② Reflector+Serializer round-trip 绿；③ 依赖门禁 CI 上线；④ bindgen 输出 napi hello（由 C++ 调 TS 函数） |
| M1 | 3–6 月 | 首帧 2D：RHI(WebGPU 先行)/RenderGraph/批处理管线/vendor 平台层(desktop+web)/脚本宿主/导入(png+sprite+图集) | ① Web + Win/mac 同代码首帧（精灵 + UI 样例场景）；② 10 万动态精灵 ECS+渲染 gate 达标（ADR-001 §5 / engine-spec §3.7）；③ 从零新建项目 → 脚本 → 构建 → 浏览器打开；④ spine 简单动画播放 |
| M2 | 6–12 月 | 产品化前半：编辑器壳+官方面板、Box2D 物理、2D 动画/粒子/tilemap、预制体+override、MCP 服务、移动端(GLES3/Metal) | ① 编辑器内完成"做一个小 2D 游戏"全程（Inspector+拖拽+脚本），无手改 JSON；② Android/iOS 真机跑通样例；③ MCP 脚本化建场景演示 |
| M3 | 12–18 月 | 交付力：小游戏渠道（微信/抖音）、移动 pipeline 资产（etc2/astc）、GLES3 全档、构建农场、崩溃上报、pixel-art/toon-2d Pipeline 插件 | ① 小游戏真机发布（微信+抖音）；② renderer-spec §6 移动端预算达标；③ 3 分钟演示：CI 从提交到出包 |
| M4 | 18–24 月 | 广度：网络同步通道、UI 工具深度、插件市场、云构建（远端 daemon）、纹理流送完善 | ① 2D 联机 demo（16 人同屏）；② 插件市场可安装第三方 builder/importer；③ 云构建公开测试 |
| M5 | 24 月+ | 存量收割：Creator 迁移器（2D 项目）+ cc4-compat 稳定、DAM/协作评审、v1.0 发布 | ① 真实 Creator 2D 项目迁移演示通过；② 迁移器 beta 公开 |

## 1b. 实施状态矩阵（2026-08-29 终检，证据 = 测试/CI/文档）

| 里程碑 | 工作包 | 状态 | 证据（一条命令/文件） |
| --- | --- | --- | --- |
| M0 | 地基/reflection/ECS 最小/服务骨架/CI 门禁 | ✅ | ctest 22+；m0-gate-review |
| M1 | 首帧/RHI/RenderGraph/批处理/脚本宿主/导入/模板 | ✅ | demo 19 步；ecs.bench_gate；verify_w1 双后端 10/10 |
| M2 | 编辑器壳/面板/动画/预制体/MCP/移动端 | ✅ | 14 票；verify_editor_game（出口①）；verify_mcp_loop（出口③）；W6-1（出口② Android） |
| M3 | 渠道插件/移动资产/GLES3 降级/pixel-art/toon/构建农场/崩溃上报/插件市场 | ✅ | channel_sdk 3 测试；cook 保底；render.caps；pixel_art/toon；crash_reporter |
| M4 | net sync/UI 深度/远端 daemon/纹理流送/插件市场 | ✅（三出口全闭合） | ① 16 人同屏：network.16p_sync；② 插件市场安装 builder：plugin 4 测试；③ 云构建 TLS+token：remote_daemon 测试（RpcClient.tls + 自签证书） |
| M5 | 迁移器/cc4-compat/DAM 评审 | ✅ | creator_migrator 4 测试；m5.cc4_compat；review 3 测试 |
| 环境缺口 | iOS 真机/渠道真机发布/真实 Creator 项目/QuickJS MSVC eval 上游限制 | ⏳ | 非本地代码可闭环（macOS/渠道账号/素材） |

## 2. 里程碑内的工作包（与文档对应）

- **M0 工作包**：foundation（容器/数学/内存）、reflection+serialization、ecs 最小（World/Archetype/Query/CommandBuffer）、ADR-003 JSON round-trip、services 骨架（project/asset/scene stub + JSON-RPC + 事件）、CLI 壳（--no-interactive + --json）、CI 门禁（依赖 lint、vendor 目录、schema round-trip）。
- **M1 工作包**：gfx WebGPU 后端（buffer/texture/pass/draw）、RenderGraph 最小编译执行、Pipeline 资产解析（forward-2d 首版）、SpriteBatch/UI batch 首版、platform/vendor desktop+web 装配、scripting 宿主（V8 desktop / browser）、bindgen 完整化（napi+IDL）、ImageImporter/Png+sprite+图集 Importer 首版、项目模板（ccx create）。
- **M2 工作包**：Box2D bridge、2D 动画（曲线/精灵帧/Spine/DragonBones 桥）、粒子 2D、tilemap、预制体 runtime+override、编辑器 Shell（docking+command palette+undo）、官方面板集（inspector/hierarchy/scene/asset browser/profiler）、SceneService 全量命令集、MCP servers（ccx-mcp）、GLES3/Metal 后端移植、UI 基础控件库。
- **M3 工作包**：小游戏 channel 插件（IChannelSDK：微信/抖音）、移动 pipeline 资产（etc2/astc 矩阵）、GLES3 全档降级表、pixel-art/toon-2d Pipeline 插件、build 农场、崩溃上报与远程日志、插件市场骨架。
- **M4 工作包**：net sync（ECS delta 通道）、UI 工具深度（布局/自适应/多分辨率）、远端 daemon（TLS+token）、纹理流送完善、插件市场上线。
- **M5 工作包**：Creator 场景/资产迁移器（2D 项目）、cc4-compat 基线、DAM/协作评审、v1.0 发布。

## 3. 团队结构（建议最小规模，可扩）

| 组 | 人力（M0–M1） | M2+ |
| --- | --- | --- |
| Foundation/ECS（含序列化反射） | 2–3 C++ | +1 |
| 渲染（2D：WebGPU 先行 + RenderGraph + 批处理） | 2 | +2（GLES3/Metal） |
| 平台/vendor | 1（兼职 vendor 同步）+ 1 兼职 | +2（移动） |
| 工具链（service/CLI/MCP/asset） | 2 TS | +2 |
| 编辑器 | 1（Shell）→ 2 | +3（面板） |
| QA/CI/基准 | 1 兼职 | 1–2 |

- 总规模 M0：7–9 人；M2：14–16；M3：20+（含渠道与构建农场）。
- 2D-first 让"渲染组人数"风险显著低于 3D 方案（无 PBR/光照/GPU-driven 三座大山），但批处理优化人才仍关键。

## 4. 风险登记表

| # | 风险 | 概率 | 影响 | 缓解 / 回退 |
| --- | --- | --- | --- | --- |
| R1 | 批处理/合批性能退化（批次爆炸、图集碎片化） | 中 | 高 | renderer-spec §5 规则 + CI demo 断言（同键 >2 批即失败）；图集打包质量指标入看板；M2 gate 前置 |
| R2 | ECS 数据模型与实际玩法摩擦（层级/脚本习惯） | 高 | 中 | cc4-compat 兜底（Node facade）；迁移器两阶段；M2 前用 2–3 个真实 2D 玩法样例验证 |
| R3 | vendor 上游（cocos4）演进与我们分叉 | 中 | 中 | 季度同步 + patch 制度（ADR-005）；封装层为唯一依赖面 |
| R4 | 绑定生成器质量（TS↔C++ 边界 bug） | 中 | 高 | IDL 唯一来源；生成代码全量 CI（含 fuzz）；不做手写桥接（ADR-004） |
| R5 | 小游戏渠道政策/API 变动 | 高 | 中 | IChannelSDK 隔离；渠道插件独立版本；发布自动化只在构建农场跑通 |
| R6 | "AI 能编辑场景"承诺过载（MCP 复杂度） | 中 | 中 | 命令面收敛为服务子集；先示例场景路径后开放全量 |
| R7 | 目标场景："重 2D 游戏"（弹幕/大规模 UI）性能门达不到 | 中 | 中 | M1 gate 前置（10 万精灵）；失败 → 降承诺至 5 万并公开分档；不靠架构妥协换达标 |
| R8 | 许可/合规（vendor MIT 传播、渠道合规） | 低 | 高 | 第三方组件清单进 CI；法务评审 M0 内完成 |
| R9 | 编辑器 UX 投入超过预期 | 高 | 高 | 官方面板仅覆盖核心路径（scene/inspector/hierarchy/asset/anim 基础）；深度面板交插件生态 |
| R10 | 团队 ECS 经验断层 | 中 | 中 | 内部教程 + 样例场景 + 代码审查门（engine-spec §3 写入纪律） |
| R11 | 2D 差异化不足（vs Creator/Cocos2d-x 存量方案） | 中 | 高 | 2D-first 的护城河 = Headless 工具链 + AI/MCP + 模块化；市场验证放 M2 早期（试点用户） |

## 5. 决策回退点（红线检查）

| 回退点 | 触发条件 | 动作 |
| --- | --- | --- |
| M1 结束 | 10 万精灵 gate 不达标 | 降承诺至 5 万 + 重排 M2 批处理专项；不推翻架构 |
| M2 结束 | 移动端真机性能 < 预算 60% | M3 专项批处理/图集优化；小游戏渠道后置 |
| M3 结束 | 小游戏渠道发布仍不可用 | 渠道插件独立 SRE 小组；核心引擎不受阻塞 |
| 任何时点 | 3D 需求回潮且被确认 | 走"3D Pipeline 插件"评审通道（renderer-spec 范围声明），不进默认路径 |

## 6. 成功指标（发布前）

- 开发者从零到"三端（Web/Android/小游戏）出包" < 1 小时（含文档）。
- 新用户 1 周内完成首个 2D 小游戏（编辑器内，无硬编码障碍）。
- AI 用户自然语言完成"建场景 → 放精灵 → 加脚本 → 预览截图"（M2 演示基线）。
- 10 万动态精灵移动端 benchmark 公开可复现（含设备型号）。
- 小游戏主包 ≤ 4 MB 预算达成率 ≥ 95%（渠道要求）。

## 7. 下一个开工步骤（T+0 起 2 周内）

1. 冻结 ADR 001–006（v0.2 修订版已含 2D 收敛）；评审会签（引擎/平台/工具各组组长）。
2. 建 CCX 组织仓库骨架（monorepo 按 engine-spec §1）；写入 3 条 CI 门禁（依赖 lint / schema round-trip / vendor patch 校验）。
3. 灯塔任务 A：Reflector + JSON 序列化 hello（M0 出口④前置）。
4. 灯塔任务 B：cocos4 native vendor 裁剪清单评审（ADR-005 物料表逐项确认许可/大小/依赖；**2D 相关面优先**）。
5. 灯塔任务 C：bindgen 最小原型（1 个 IDL 文件 → napi + d.ts + schema）。
6. 灯塔任务 D：SpriteBatch 原型（100 精灵 → 1 批）提前验证合批模型。
7. 明确 M0 gate 会议日期与 Owner（每项出口一个 Owner）。

## 8. 最终版本（v1.0）判定标准（Definition of Final）

> 判定原则：**"最终" = 范围承诺 100% 兑现且每一项都有可复现的验证证据**。规格里每一个"会做" → 有实现 + 验证记录；每一个"不做" → 有范围声明兜底。**无法验证的雄心 = 未完成。**

### 8.1 五层判定矩阵

| 层 | 判据 | 证据形态 |
| --- | --- | --- |
| L1 文档 | 6 份 ADR 全部 accepted、无 unresolved；各规格无 TODO/待定点；scene schema v1 冻结 + 迁移器机制就位 | ADR 状态表、schema changelog、迁移器注册表 |
| L2 工程 | 三条 CI 门禁全绿（依赖 lint / schema round-trip / vendor patch）；fuzz 无致命发现；无 P0/P1 未关闭缺陷；**12 条铁律每条都有 CI 自动检查化身** | CI 绿标、铁律→检查项映射表 |
| L3 性能 | 六条公开基准全部达标（§8.2），含设备型号与复现步骤 | 发布页 benchmark 页 |
| L4 交付 | 一个真实游戏（内部 dogfood）Web/Android/小游戏三端真机发布、渠道商店可下载；从零到三端出包 < 1h | 商店链接 + 计时记录 |
| L5 生态 | ≥ 1 个第三方插件（importer/builder/inspector 任意一种）完整链路跑通；Creator 2D 迁移器通过一个真实项目 | 插件仓库、迁移评审记录 |

### 8.2 六条硬性基准（v1.0 gate，全部公开可复现）

1. **10 万动态精灵**：移动端（骁龙 8 Gen2 级）提交批 ≤ 500、总帧 < 6 ms（renderer-spec §6）；
2. **空世界 tick < 0.5 ms**；实体创建 ≥ 1M/s（engine-spec §3.7）；
3. **从零新建项目 → 三端出包 < 1 小时**（含文档时间，两人盲测取均值）；
4. **场景 JSON ↔ .cscene round-trip 全等**（含 10 万实体场景），Git 结构化 diff 演示通过；
5. **迁移器**把一个真实 Creator 2D 项目转为 ADR-003 v1 并运行，功能等价用例集全绿；
6. **MCP 自然语言闭环**：建场景 → 放精灵 → 加脚本 → 截图 → 构建（services-spec §7 剧情），无人工干预跑通。

### 8.3 不算最终（反向判据）

- M1 gate（10 万精灵）不达标却照常发布 —— 不算；降级至 5 万必须重新走 ADR。
- 范围蔓延：未走 ADR 就把 3D/VR/云端托管等能力塞进默认路径 —— 不算。
- 依赖反向：engine → editor/services/cli/mcp 任一条出现 —— 架构腐化，不算。
- 性能只有口头承诺、无公开可复现数据 —— 不算。
- 编辑器闭环需要手工改 JSON 才能完成 demo 游戏 —— 不算（违反铁律 12）。

### 8.4 验收机制（谁来判断）

- **外部盲测**：2 名不认识内部实现的人，仅凭文档从零完成"三端出包 + 编辑器内小游戏"；记录耗时与求助次数。
- **试点用户**：≥ 3 个真实项目持续 2 个迭代；P0/P1 问题归零才允许发布。
- **冻结仪式**：v1.0 tag、发布页 benchmark、scene schema/API 冻结声明；此后 breaking change 必须走 deprecation 周期（SemVer 承诺）。

> 与 §6 成功指标的关系：§6 是"发布前应该有的样子"（方向性），§8 是"可证伪的完成定义"（验收性）；两者同时满足才算 v1.0。
