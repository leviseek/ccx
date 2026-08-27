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
