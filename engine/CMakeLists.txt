# engine/ — C++20 引擎核心（engine-spec §1/§2）
# 依赖方向见 engine-spec §1 mermaid 与 ci/gates/layered_imports.mjs（CI 强制）

add_subdirectory(foundation)

if(CCX_BUILD_ECS)
  add_subdirectory(ecs)
endif()

if(CCX_BUILD_SCENE)
  add_subdirectory(scene)
endif()

if(CCX_BUILD_RENDER)
  add_subdirectory(render)
endif()

# 占位模块：README 已建，CMake 随 milestone 打开（roadmap M1/M2）
# add_subdirectory(gfx)
# add_subdirectory(render)
# add_subdirectory(animation)
# add_subdirectory(physics)
# add_subdirectory(audio)
# add_subdirectory(ui)
# add_subdirectory(input)
# add_subdirectory(asset)
# add_subdirectory(scripting)
# add_subdirectory(network)
# add_subdirectory(platform)

if(CCX_BUILD_TESTS)
  add_subdirectory(tests)
endif()
