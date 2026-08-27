# scene — 层级树 / 2D 排序 / Prefab runtime（ADR-002/003，engine-spec §4）
# 依赖：foundation（json/math）；本模块不依赖 ecs（数据即 JSON 视图）

add_library(ccx_scene STATIC
  src/scene.cpp
  src/schema.cpp
)

target_include_directories(ccx_scene PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(ccx_scene PUBLIC ccx_foundation)
target_compile_features(ccx_scene PUBLIC cxx_std_20)

if(MSVC)
  target_compile_options(ccx_scene PRIVATE /W4 /WX)
else()
  target_compile_options(ccx_scene PRIVATE -Wall -Wextra -Werror -pedantic)
endif()
