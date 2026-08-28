# animation — 2D 动画（曲线/精灵帧，engine-spec §1；状态机 M2）
# 依赖：scene（输出到 LocalTransform）、foundation

add_library(ccx_animation STATIC
  src/clip.cpp
  src/sprite_anim.cpp
  src/skeleton.cpp
  src/state_machine.cpp
)

target_include_directories(ccx_animation PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(ccx_animation PUBLIC ccx_scene)
target_compile_features(ccx_animation PUBLIC cxx_std_20)

if(MSVC)
  target_compile_options(ccx_animation PRIVATE /W4 /WX)
else()
  target_compile_options(ccx_animation PRIVATE -Wall -Wextra -Werror -pedantic)
endif()