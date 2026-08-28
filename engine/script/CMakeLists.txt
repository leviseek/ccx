# script — 脚本宿主（W5a：QuickJS 主选；引擎侧嵌入/求值/错误面）
enable_language(C)  # quickjs.c 等为 C 源码

# vendor quickjs（ADR-005：原始快照，见 vendor/quickjs/UPSTREAM.md）
set(QUICKJS_DIR ${CMAKE_SOURCE_DIR}/engine/platform/vendor/quickjs)

add_library(ccx_script STATIC
  src/host.cpp
  src/scene_bridge.cpp
  ${QUICKJS_DIR}/quickjs.c
  ${QUICKJS_DIR}/cutils.c
  ${QUICKJS_DIR}/libregexp.c
  ${QUICKJS_DIR}/libunicode.c
  ${QUICKJS_DIR}/dtoa.c
)
set_source_files_properties(
  ${QUICKJS_DIR}/quickjs.c
  ${QUICKJS_DIR}/cutils.c
  ${QUICKJS_DIR}/libregexp.c
  ${QUICKJS_DIR}/libunicode.c
  ${QUICKJS_DIR}/dtoa.c
  PROPERTIES LANGUAGE C
)

target_include_directories(ccx_script PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_include_directories(ccx_script PRIVATE ${QUICKJS_DIR})
target_link_libraries(ccx_script PUBLIC ccx_foundation ccx_scene)
target_compile_features(ccx_script PUBLIC cxx_std_20)

# 严格标志只作用于自有源码（GCC/MSVC 各自方言）；vendor C 源豁免（上游风格差异）+ CONFIG_VERSION 兜底
set_source_files_properties(src/host.cpp PROPERTIES
  COMPILE_OPTIONS "$<$<CXX_COMPILER_ID:MSVC>:/W4;/WX;$<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-Wall;-Wextra;-Werror;-pedantic;-Wno-error=pedantic;-Wno-error=unused-parameter>>")
set_source_files_properties(
  ${QUICKJS_DIR}/quickjs.c
  ${QUICKJS_DIR}/cutils.c
  ${QUICKJS_DIR}/libregexp.c
  ${QUICKJS_DIR}/libunicode.c
  ${QUICKJS_DIR}/dtoa.c
  PROPERTIES COMPILE_OPTIONS "-w;-DCONFIG_VERSION=\"1.0.0\""
)

