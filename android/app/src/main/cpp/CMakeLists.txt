cmake_minimum_required(VERSION 3.22)
project(ccx_shell C CXX)

# 引擎渲染源码复用（W6：真机帧走引擎光栅路径）
set(QUICKJS_DIR D:/engine/ai-ccc/engine/platform/vendor/quickjs)
set(ENGINE_INC D:/engine/ai-ccc/engine/render/include D:/engine/ai-ccc/engine/scene/include
              D:/engine/ai-ccc/engine/foundation/include D:/engine/ai-ccc/engine/script/include
              D:/engine/ai-ccc/engine/ecs/include
              ${QUICKJS_DIR})
add_library(ccx_shell SHARED
  shell.cpp
  D:/engine/ai-ccc/engine/render/src/raster.cpp
  D:/engine/ai-ccc/engine/scene/src/scene.cpp
  D:/engine/ai-ccc/engine/scene/src/schema.cpp
  D:/engine/ai-ccc/engine/foundation/src/serialization/json.cpp
  D:/engine/ai-ccc/engine/foundation/src/reflection/type_registry.cpp
  D:/engine/ai-ccc/engine/ecs/src/world.cpp
  D:/engine/ai-ccc/engine/script/src/host.cpp
  D:/engine/ai-ccc/engine/script/src/scene_bridge.cpp
  ${QUICKJS_DIR}/quickjs.c
  ${QUICKJS_DIR}/cutils.c
  ${QUICKJS_DIR}/libregexp.c
  ${QUICKJS_DIR}/libunicode.c
  ${QUICKJS_DIR}/dtoa.c
)
target_compile_definitions(ccx_shell PRIVATE CONFIG_VERSION="1.0.0")
target_compile_features(ccx_shell PUBLIC cxx_std_20)
target_include_directories(ccx_shell PRIVATE ${ENGINE_INC})
target_link_libraries(ccx_shell PRIVATE log)