# particle — 2D 粒子数据面（renderer-spec §5 粒子表项；CPU 更新先行，GPU 渲染在 M2）
# 依赖：foundation（math）

add_library(ccx_particle STATIC src/emitter.cpp)

target_include_directories(ccx_particle PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(ccx_particle PUBLIC ccx_foundation)
target_compile_features(ccx_particle PUBLIC cxx_std_20)

if(MSVC)
  target_compile_options(ccx_particle PRIVATE /W4 /WX)
else()
  target_compile_options(ccx_particle PRIVATE -Wall -Wextra -Werror -pedantic)
endif()
