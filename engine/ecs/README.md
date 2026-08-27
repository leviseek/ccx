# engine/ecs — Archetype ECS（ADR-002 / engine-spec §3）✅ M0 最小实现

World / Entity(index+version) / Archetype(SoA chunk，容量满自动翻倍扩容) / Query(任意签名) / CommandBuffer(延迟写入)。
组件类型经 CCX_TYPE 注册 + TypeOps<T> 生命周期；迁移 memmove/moveConstruct 双路径；保序 swap-remove。

- 状态：M0 最小集已实现并测试全绿（engine/tests/ecs_minimal_test.cpp，ctest 3/3）
- 已修 bug（记录在案）：单 chunk 容量 256 越界写（appendRow 扩容修复）；CommandBuffer 中被 destroy 的占位实体残留 Add/Remove op（apply 丢弃修复）
- 待办（M1）：Query 缓存、多 chunk 拆分、Defragment、非平凡列指针区、系统调度与 JobSystem
- 依赖：仅 foundation（门禁确保）
