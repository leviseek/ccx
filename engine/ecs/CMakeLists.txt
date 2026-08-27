# ecs — Archetype ECS（ADR-002 / engine-spec §3）；依赖 foundation
# 依赖方向门禁：ci/gates/layered_imports.mjs（ecs -> foundation 仅此一层）

add_library(ccx_ecs STATIC
  src/world.cpp
  src/command_buffer.cpp
  src/scheduler.cpp
)

target_include_directories(ccx_ecs PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(ccx_ecs PUBLIC ccx_foundation)
target_compile_features(ccx_ecs PUBLIC cxx_std_20)

if(MSVC)
  target_compile_options(ccx_ecs PRIVATE /W4 /WX)
else()
  target_compile_options(ccx_ecs PRIVATE -Wall -Wextra -Werror -pedantic)
endif()
