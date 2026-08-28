# physics — 2D 碰撞数据面（AABB + 空间网格宽相；engine-spec §1 物理起点，解算在 M2）

add_library(ccx_physics STATIC
  src/collision.cpp
  src/contact.cpp
  src/body.cpp
)

target_include_directories(ccx_physics PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(ccx_physics PUBLIC ccx_foundation)
target_compile_features(ccx_physics PUBLIC cxx_std_20)

if(MSVC)
  target_compile_options(ccx_physics PRIVATE /W4 /WX)
else()
  target_compile_options(ccx_physics PRIVATE -Wall -Wextra -Werror -pedantic)
endif()
