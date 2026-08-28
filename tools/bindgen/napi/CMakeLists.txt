# 灯塔 C 出口④：bindgen 生成 napi 源码的编译冒烟（CMake 直连 MSVC，绕过 node-gyp 对 VS18 的探测限制）
cmake_minimum_required(VERSION 3.24)
project(ccx_bindgen_napi LANGUAGES CXX)

# Node 头/库路径由环境提供（node-gyp 下载的缓存或 setup-node 缓存）
if(NOT DEFINED NODE_ROOT)
  set(NODE_ROOT "$ENV{LOCALAPPDATA}/node-gyp/Cache")
endif()

file(GLOB BINDINGS_SRC "${CMAKE_CURRENT_SOURCE_DIR}/gen/*.cpp")
if(NOT BINDINGS_SRC)
  message(FATAL_ERROR "gen/ 缺 bindings 源码（先跑 bindgen 生成）")
endif()

add_library(ccx_hello_bindings MODULE ${BINDINGS_SRC})
target_include_directories(ccx_hello_bindings PRIVATE ${NODE_ROOT})
if(MSVC)
  target_compile_options(ccx_hello_bindings PRIVATE /std:c++20 /W3)
endif()
set_target_properties(ccx_hello_bindings PROPERTIES
  PREFIX ""
  SUFFIX ".node"
  OUTPUT_NAME "ccx_hello_bindings"
  LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/Release"
)
