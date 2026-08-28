cmake_minimum_required(VERSION 3.22)
project(ccx_shell C CXX)

# 引擎渲染源码复用（W6：真机帧走引擎光栅路径）
set(ENGINE_INC D:/engine/ai-ccc/engine/render/include D:/engine/ai-ccc/engine/scene/include
              D:/engine/ai-ccc/engine/foundation/include)
add_library(ccx_shell SHARED
  shell.cpp
  D:/engine/ai-ccc/engine/render/src/raster.cpp
  D:/engine/ai-ccc/engine/scene/src/scene.cpp
  D:/engine/ai-ccc/engine/scene/src/schema.cpp
  D:/engine/ai-ccc/engine/foundation/src/serialization/json.cpp
)
target_compile_features(ccx_shell PUBLIC cxx_std_20)
target_include_directories(ccx_shell PRIVATE ${ENGINE_INC})
