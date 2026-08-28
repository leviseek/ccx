# 引擎测试：每条 add_test 对应 engine-spec 质量门
# gate 3（schema round-trip）在 CI 中经 ctest 强制执行（ci/gates/schema_roundtrip.mjs）

add_executable(ccx_foundation_tests roundtrip_test.cpp)
target_link_libraries(ccx_foundation_tests PRIVATE ccx_foundation)
add_test(NAME foundation.roundtrip COMMAND ccx_foundation_tests)

# 灯塔任务 D：SpriteBatch 合批模型（renderer-spec §5，逻辑在 render::batcher）
add_executable(ccx_batch_prototype_test batch_prototype_test.cpp)
target_link_libraries(ccx_batch_prototype_test PRIVATE ccx_render)
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

# M1：animation（曲线采样/循环/驱动场景变换）
add_executable(ccx_animation_test animation_test.cpp)
target_link_libraries(ccx_animation_test PRIVATE ccx_animation)
add_test(NAME animation.module COMMAND ccx_animation_test)

# M1：场景 -> 渲染提交（renderOrder -> 合批）
add_executable(ccx_scene_to_batch_test scene_to_batch_test.cpp)
target_link_libraries(ccx_scene_to_batch_test PRIVATE ccx_render ccx_scene)
add_test(NAME render.scene_to_batch COMMAND ccx_scene_to_batch_test)

# M1：材质资产解析
add_executable(ccx_material_test material_test.cpp)
target_link_libraries(ccx_material_test PRIVATE ccx_render)
add_test(NAME render.material COMMAND ccx_material_test)

# M1：精灵帧动画（帧推进/循环/UV）
add_executable(ccx_sprite_anim_test sprite_anim_test.cpp)
target_link_libraries(ccx_sprite_anim_test PRIVATE ccx_animation)
add_test(NAME animation.sprite COMMAND ccx_sprite_anim_test)

# M1 E2E：场景文件 -> 渲染计划（装载/渲染序/合批/导出往返；仓库根 cwd）
add_executable(ccx_e2e_render_plan_test e2e_render_plan_test.cpp)
target_link_libraries(ccx_e2e_render_plan_test PRIVATE ccx_render ccx_scene)
add_test(NAME e2e.render_plan
         COMMAND ccx_e2e_render_plan_test
         WORKING_DIRECTORY ${PROJECT_SOURCE_DIR})

# M1：动画状态机（时间/触发器条件）
add_executable(ccx_state_machine_test state_machine_test.cpp)
target_link_libraries(ccx_state_machine_test PRIVATE ccx_animation)
add_test(NAME animation.state_machine COMMAND ccx_state_machine_test)

# M1：metrics（帧统计环形缓冲 + JSON 快照）
add_executable(ccx_metrics_test metrics_test.cpp)
target_link_libraries(ccx_metrics_test PRIVATE ccx_foundation)
add_test(NAME foundation.metrics COMMAND ccx_metrics_test)

# M1：shader 资产 + material 联动校验
add_executable(ccx_shader_material_test shader_material_test.cpp)
target_link_libraries(ccx_shader_material_test PRIVATE ccx_render)
add_test(NAME render.shader_material COMMAND ccx_shader_material_test)

# M1 E2E：动画状态机 -> 场景变换 -> 渲染计划
add_executable(ccx_anim_to_plan_test anim_to_plan_test.cpp)
target_link_libraries(ccx_anim_to_plan_test PRIVATE ccx_animation ccx_render)
add_test(NAME e2e.anim_to_plan COMMAND ccx_anim_to_plan_test)

# M1：场景 <-> ECS 桥（映射 + Transform 数值镜像）
add_executable(ccx_bridge_test bridge_test.cpp)
target_link_libraries(ccx_bridge_test PRIVATE ccx_scene)
add_test(NAME scene.bridge COMMAND ccx_bridge_test)

# 跨语言对拍工具（非 CTest；Node 测试 spawn 后与 renderPlan 对拍）
add_executable(ccx_render_plan_dump render_plan_dump.cpp)
target_link_libraries(ccx_render_plan_dump PRIVATE ccx_render ccx_scene)

# M1：帧循环组装（Scheduler -> Scene -> Bridge -> Metrics 一体 tick）
add_executable(ccx_tick_test tick_test.cpp)
target_link_libraries(ccx_tick_test PRIVATE ccx_animation ccx_ecs ccx_scene ccx_foundation)
add_test(NAME e2e.frame_tick COMMAND ccx_tick_test)

# M1：资产全链组装（scene -> material/shader 校验 -> pipeline -> 渲染计划）
add_executable(ccx_asset_chain_test asset_chain_test.cpp)
target_link_libraries(ccx_asset_chain_test PRIVATE ccx_render ccx_scene)
add_test(NAME e2e.asset_chain
         COMMAND ccx_asset_chain_test
         WORKING_DIRECTORY ${PROJECT_SOURCE_DIR})

# M1：精灵帧动画接入帧循环（Scheduler -> SpriteSampler -> 场景组件）
add_executable(ccx_tick_sprite_anim_test tick_sprite_anim_test.cpp)
target_link_libraries(ccx_tick_sprite_anim_test PRIVATE ccx_animation ccx_ecs ccx_scene)
add_test(NAME e2e.sprite_anim_tick COMMAND ccx_tick_sprite_anim_test)

# M1：2D 粒子数据面（发射/更新/回收/稳态）
add_executable(ccx_particle_test particle_test.cpp)
target_link_libraries(ccx_particle_test PRIVATE ccx_particle)
add_test(NAME particle.emitter COMMAND ccx_particle_test)

# M1：输入归一化（边沿/多键/指针）
add_executable(ccx_input_test input_test.cpp)
target_link_libraries(ccx_input_test PRIVATE ccx_input)
add_test(NAME input.state COMMAND ccx_input_test)

# M1：完整帧循环集成（input+anim+particle+bridge+metrics 一帧全链）
add_executable(ccx_full_tick_test full_tick_test.cpp)
target_link_libraries(ccx_full_tick_test PRIVATE ccx_particle ccx_input ccx_animation ccx_ecs ccx_scene ccx_foundation)
add_test(NAME e2e.full_tick COMMAND ccx_full_tick_test)

# M1：Sprite 渲染提交打包（批/顶点/索引/UV/变换/染色）
add_executable(ccx_packer_test packer_test.cpp)
target_link_libraries(ccx_packer_test PRIVATE ccx_render)
add_test(NAME render.packer COMMAND ccx_packer_test)

# M1：GameLoop 固定步长帧循环宿主
add_executable(ccx_game_loop_test game_loop_test.cpp)
target_link_libraries(ccx_game_loop_test PRIVATE ccx_game)
add_test(NAME game.loop COMMAND ccx_game_loop_test)

# M1：渲染帧全链（GameLoop -> Scheduler -> 渲染项收集 -> packer -> metrics）
add_executable(ccx_render_frame_test render_frame_test.cpp)
target_link_libraries(ccx_render_frame_test PRIVATE
  ccx_game ccx_ecs ccx_scene ccx_render ccx_animation ccx_foundation)
add_test(NAME e2e.render_frame COMMAND ccx_render_frame_test)

# M1：runtime 资产注册表（句柄/复用/失效）
add_executable(ccx_asset_registry_test asset_registry_test.cpp)
target_link_libraries(ccx_asset_registry_test PRIVATE ccx_assets)
add_test(NAME assets.registry COMMAND ccx_asset_registry_test)

# M1：正交相机/视口（world -> NDC -> screen）
add_executable(ccx_camera_test camera_test.cpp)
target_link_libraries(ccx_camera_test PRIVATE ccx_render)
add_test(NAME render.camera COMMAND ccx_camera_test)

# M1：资产注册表驱动渲染尺寸（asset-driven rendering）
add_executable(ccx_asset_driven_frame_test asset_driven_frame_test.cpp)
target_link_libraries(ccx_asset_driven_frame_test PRIVATE ccx_assets ccx_render)
add_test(NAME assets.driven_render COMMAND ccx_asset_driven_frame_test)

# M1：动画整合（状态机选 clip -> 精灵帧采样 -> 帧循环）
add_executable(ccx_integrated_animation_test integrated_animation_test.cpp)
target_link_libraries(ccx_integrated_animation_test PRIVATE ccx_animation ccx_ecs ccx_scene)
add_test(NAME e2e.integrated_animation COMMAND ccx_integrated_animation_test)
