# engine/ecs — Archetype ECS（ADR-002 / engine-spec §3）✅ M0 最小实现

World / Entity(index+version) / Archetype(SoA chunk，容量满自动翻倍扩容) / Query(任意签名) / CommandBuffer(延迟写入)。
组件类型经 CCX_TYPE 注册 + TypeOps<T> 生命周期；迁移 memmove/moveConstruct 双路径；保序 swap-remove。

- 状态：M0 最小集 + **M1 首轮（Query 缓存 + Stage 调度器 + job::TaskGraph 骨架）** 已实现并测试全绿（ctest 5/5，engine/tests/ecs_minimal_test.cpp + schedule_test.cpp）
- 已修 bug（记录在案）：单 chunk 容量 256 越界写（appendRow 扩容）；CommandBuffer 占位实体 op 残留；TaskGraph Kahn 入度递减缺失
- 待办（M1 剩余）：多 chunk 拆分、Defragment、非平凡列指针区、调度并行化（M1.5 worker 池 + 物理固定步长）
- 依赖：仅 foundation（门禁确保；job::TaskGraph 在 foundation/job）
