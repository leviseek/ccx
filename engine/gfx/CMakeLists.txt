# gfx — CCX RHI（renderer-spec §2。M1 先交付 CPU 可测面：描述校验 + 句柄池；
# GPU 后端（WebGPU/Vulkan/Metal/GLES）在 M2 挂载）

add_library(ccx_gfx STATIC
  src/gfx.cpp
  src/rhi_fake.cpp
)

target_include_directories(ccx_gfx PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(ccx_gfx PUBLIC ccx_foundation)
target_compile_features(ccx_gfx PUBLIC cxx_std_20)

if(MSVC)
  target_compile_options(ccx_gfx PRIVATE /W4 /WX)
else()
  target_compile_options(ccx_gfx PRIVATE -Wall -Wextra -Werror -pedantic)
endif()
# W1 真后端（wgpu-native）：本机构建产物存在时启用（见 gpu-backend-plan）
set(CCX_WGPU_LIB_DIR "D:/engine/ai-ccc/build/wgpu-native/target/x86_64-pc-windows-gnu/release" CACHE STRING "wgpu-native lib 目录（MinGW ABI）")
set(CCX_WGPU_INC_DIR "D:/engine/ai-ccc/engine/platform/vendor/webgpu-headers" CACHE STRING "webgpu.h 目录")
if(EXISTS "${CCX_WGPU_LIB_DIR}/wgpu_native.lib" AND EXISTS "${CCX_WGPU_INC_DIR}/webgpu.h")
  add_library(ccx_gfx_wgpu STATIC src/rhi_wgpu.cpp)
  target_include_directories(ccx_gfx_wgpu PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include ${CCX_WGPU_INC_DIR})
  target_link_libraries(ccx_gfx_wgpu PUBLIC ccx_foundation)
  target_compile_features(ccx_gfx_wgpu PUBLIC cxx_std_20)
  target_link_libraries(ccx_gfx_wgpu PUBLIC ${CCX_WGPU_LIB_DIR}/wgpu_native.lib ws2_32 userenv advapi32 d3d12 dxgi)
  if(MSVC)
    target_compile_options(ccx_gfx_wgpu PRIVATE /W4)
  else()
    target_compile_options(ccx_gfx_wgpu PRIVATE -Wall -Wextra -Werror -pedantic -Wno-error=pedantic)
  endif()
endif()