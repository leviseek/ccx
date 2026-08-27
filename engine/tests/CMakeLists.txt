# 引擎测试：每条 add_test 对应 engine-spec 质量门
# gate 3（schema round-trip）在 CI 中经 ctest 强制执行（ci/gates/schema_roundtrip.mjs）

add_executable(ccx_foundation_tests roundtrip_test.cpp)
target_link_libraries(ccx_foundation_tests PRIVATE ccx_foundation)
add_test(NAME foundation.roundtrip COMMAND ccx_foundation_tests)

# 灯塔任务 D：SpriteBatch 合批模型原型（renderer-spec §5，纯 CPU 数据模型）
add_executable(ccx_batch_prototype_test batch_prototype_test.cpp)
add_test(NAME render.batch_prototype COMMAND ccx_batch_prototype_test)

# ECS 最小实现（engine-spec §3、ADR-002）
add_executable(ccx_ecs_minimal_test ecs_minimal_test.cpp)
target_link_libraries(ccx_ecs_minimal_test PRIVATE ccx_ecs)
add_test(NAME ecs.minimal COMMAND ccx_ecs_minimal_test)

# M0 出口①：场景 JSON 读写 + golden 校验（ADR-003；需仓库根 cwd）
add_executable(ccx_scene_sample_test scene_sample_test.cpp)
target_link_libraries(ccx_scene_sample_test PRIVATE ccx_foundation)
add_test(NAME foundation.scene_sample
         COMMAND ccx_scene_sample_test
         WORKING_DIRECTORY ${PROJECT_SOURCE_DIR})

# M1：系统调度（Stage + 拓扑序）与 job::TaskGraph 骨架
add_executable(ccx_schedule_test schedule_test.cpp)
target_link_libraries(ccx_schedule_test PRIVATE ccx_ecs)
add_test(NAME ecs.schedule COMMAND ccx_schedule_test)

# M1：scene 模块（树/排序/world 变换/Prefab override）
add_executable(ccx_scene_test scene_test.cpp)
target_link_libraries(ccx_scene_test PRIVATE ccx_scene)
add_test(NAME scene.module COMMAND ccx_scene_test)

# M1：RenderGraph 编译器（renderer-spec §3）
add_executable(ccx_render_graph_test render_graph_test.cpp)
target_link_libraries(ccx_render_graph_test PRIVATE ccx_render)
add_test(NAME render.graph COMMAND ccx_render_graph_test)

# M1：Pipeline 资产解析 -> RenderGraph 编译（renderer-spec §4）
add_executable(ccx_pipeline_test pipeline_test.cpp)
target_link_libraries(ccx_pipeline_test PRIVATE ccx_render)
add_test(NAME render.pipeline COMMAND ccx_pipeline_test)

# M1：gfx CPU 面（描述校验 + 句柄池）
add_executable(ccx_gfx_test gfx_test.cpp)
target_link_libraries(ccx_gfx_test PRIVATE ccx_gfx)
add_test(NAME gfx.cpu COMMAND ccx_gfx_test)
