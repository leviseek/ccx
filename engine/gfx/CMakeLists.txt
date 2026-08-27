# gfx — CCX RHI（renderer-spec §2。M1 先交付 CPU 可测面：描述校验 + 句柄池；
# GPU 后端（WebGPU/Vulkan/Metal/GLES）在 M2 挂载）

add_library(ccx_gfx STATIC src/gfx.cpp)

target_include_directories(ccx_gfx PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(ccx_gfx PUBLIC ccx_foundation)
target_compile_features(ccx_gfx PUBLIC cxx_std_20)

if(MSVC)
  target_compile_options(ccx_gfx PRIVATE /W4 /WX)
else()
  target_compile_options(ccx_gfx PRIVATE -Wall -Wextra -Werror -pedantic)
endif()
