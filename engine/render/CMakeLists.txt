# render — RenderGraph 编译器（renderer-spec §3，CPU 侧可测）
# GPU 后端（RHI 对接/提交）在 M2；本模块先固化图的验证与编译规则

add_library(ccx_render STATIC
  src/render_graph.cpp
  src/pipeline.cpp
  src/batcher.cpp
  src/material.cpp
  src/shader.cpp
  src/packer.cpp
  src/raster.cpp
)

target_include_directories(ccx_render PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(ccx_render PUBLIC ccx_foundation)
target_compile_features(ccx_render PUBLIC cxx_std_20)

if(MSVC)
  target_compile_options(ccx_render PRIVATE /W4 /WX)
else()
  target_compile_options(ccx_render PRIVATE -Wall -Wextra -Werror -pedantic)
endif()
