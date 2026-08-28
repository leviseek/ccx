# assets — runtime 资产注册表（句柄池 + 失效语义；asset-spec §2 的运行时侧）

add_library(ccx_assets STATIC
  src/registry.cpp
  src/parse_png.cpp
)

target_include_directories(ccx_assets PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(ccx_assets PUBLIC ccx_foundation)
target_compile_features(ccx_assets PUBLIC cxx_std_20)

if(MSVC)
  target_compile_options(ccx_assets PRIVATE /W4 /WX)
else()
  target_compile_options(ccx_assets PRIVATE -Wall -Wextra -Werror -pedantic)
endif()
