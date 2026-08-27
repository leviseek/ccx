# ADR-002 运行时数据模型：Archetype ECS 为统一数据模型（含边界）

- 状态：**采纳**（2026-08-27）
- 关联：ADR-001（语言）、ADR-003（数据格式）、ADR-004（脚本）
- 影响范围：ecs/scene/transform/动画/粒子等模块的数据层

---

## 1. 背景

原方案的核心分歧点之一："Engine 核心采用 Data-Oriented + ECS，而不是 Node/Component"。方案同时警告"不要做纯 ECS 教条主义"。本 ADR 把这两句话变成**可执行的边界规则**。

cocos4（及 Creator 3.x 血统）的现状是 Node/Component + TS 侧的 cc.Component 生命周期；渲染/物理大量逻辑在 TS 侧逐对象遍历。CCX 要换数据模型，但**不能把场景层级树扔掉**（动画、UI、预制体 override 都依赖父子关系），也不能让物理/渲染为迁就 ECS 而自废武功。

## 2. 候选

| 候选 | 描述 | 问题 |
| --- | --- | --- |
| A | 全 ECS（含物理/渲染/音频内部全部 ECS 化） | 渲染图、物理 world、音频 voice 强行 ECS 化是灾难（方案已指出） |
| B | **Archetype ECS 为游戏数据模型 + 底层子系统保持自有结构 + bridge 组件** | 需要严格的 bridge 纪律 |
| C | 保留 Node/Component 分层 + 引入稀疏 set | 数据仍是对象图，性能与编辑器/AI 收益全丢 |

## 3. 决策

**采纳 B。** 具体三条：

1. **ECS 是"统一游戏数据模型"**：Entity 即场景对象；Component 即数据；System 即行为。编辑器、序列化（场景文件）、AI、脚本都面对 ECS 数据视图（JSON 化后见 ADR-003）。
2. **底层子系统不强制 ECS**：物理 World、渲染场景（RenderScene）、音频 Voice、寻路、Render Graph 保持自己的高性能结构；通过 **bridge 组件**（PhysicsBody、Renderable、AudioSource，持句柄）接入 ECS。
3. **保留层级树语义**：Transform 组件 + Parent/FirstChild/NextSibling 内部结构（数组化实现），ECS 之上提供 HierarchyView；动画/UI/预制体依赖它。

## 4. 决策细节（规格级摘要，完整版见 engine-spec）

- **Entity** = u32 索引（世代计数防悬垂，句柄形式 Entity{index,version}）。
- **Archetype** = 组件类型签名；**Chunk** = SoA 连续存储（默认 16 KiB/块）；组件迁移做 memmove，不逐组件拷贝。
- **ComponentType** 由反射系统注册（C++ 宏 DSL 或 TS 注解），携带序列化 schema。
- **Query** = 签名（with/without/optional）+ archetype 过滤缓存；系统内迭代即"连续内存 + 可向量化"。
- **System** = 无状态纯函数（读 World 的查询结果）；阶段化调度：Stage::Simulation/Physics/Animation/PostProcess + 显式 before/after 顺序约束；运行时按依赖图做并行调度（JobSystem）。
- **写入纪律**：系统对组件的写必须经 Sweep/Sync 通道或 CommandBuffer（延迟插入/删除/改组件），保证查询遍历期间内存稳定。
- **兼容层**：提供 Node facade（Entity + 树的视图），供 cc4-compat 迁移使用，但禁止游戏代码把 Node 当唯一真相。

## 5. 理由

1. **性能**：SoA + 连续内存 + 并行系统 = 移动端 10 万实体预算唯一可行路径（gate 基准见 ADR-001）。
2. **Editor/AI**：操作对象是数据（{entity, components:{...}}），Inspector/CommandBus/场景差异化服务共用同一模型（铁律 5/11/12）。
3. **序列化即天然**：World 快照 = 场景文件；组件 schema 驱动 diff。cocos4 的 scene 是编辑器私有格式（含大量编辑器态），CCX 从根上换掉。
4. **子系统解耦**：物理步进、渲染提交不需要经过 ECS 迭代，bridge 组件把"频率差异"（物理 60Hz、渲染 30Hz、动画混合器）分隔开，避免"ECS 里塞高频系统然后全卡一起"。
5. **不炸树语义**：预设 override、骨骼动画、UI 布局都需要树；用内部结构 + facade 而不是废弃它。

## 6. 后果与反制

- **bridge 纪律**：bridge 组件只允许"薄句柄 + 同步标记"，不允许在里面积累业务逻辑（lint 检查：bridge 组件类不得含虚函数与重逻辑）。
- **反脆化**：ECS 的组件变体（variant）与"蓝色委托"（tagged component blueprint，即组件即 prefab 的叶子）进 M2（roadmap）。
- **迁移**：Creator 场景 → CCX 场景的迁移器在 M5；cc4-compat 在迁移器之前提供运行时兼容（engine-spec §8）。
- **风险**：ECS 熟练度门槛。反制：System 模板 + 示例场景集 + 内部代码审查强制查询/写入模式。

## 7. 不做

- 不做 GPU-ECS（数据在 CPU ECS，渲染提交走 RenderScene 桥）。
- 不做完全扁平无层级的世界（树由内部结构保留）。
- 不在第一版做 network-replicated ECS（同步走 net 模块的 delta 通道，M4）。
