cmake_minimum_required(VERSION 3.24)
project(ccx VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# 模块裁剪（engine-spec §2）：默认只开 M0 需要的模块
option(CCX_BUILD_FOUNDATION "Build foundation module" ON)
option(CCX_BUILD_TESTS "Build engine tests" ON)

option(CCX_BUILD_ECS "Build ecs module" ON)
option(CCX_BUILD_SCENE "Build scene module" ON)
option(CCX_BUILD_RENDER "Build render module" ON)
option(CCX_BUILD_GFX "Build gfx (RHI) module" ON)
option(CCX_BUILD_ANIMATION "Build animation module" ON)
option(CCX_BUILD_PARTICLE "Build particle module" ON)
option(CCX_BUILD_INPUT "Build input module" ON)
option(CCX_BUILD_GAME "Build game module" ON)
option(CCX_BUILD_ASSETS "Build assets module" ON)
option(CCX_BUILD_AUDIO "Build audio module" ON)
option(CCX_BUILD_PHYSICS "Build physics module" ON)
option(CCX_BUILD_SCRIPT "Build script module (QuickJS)" ON)

# 后续模块占位（M1+ 按 roadmap 打开）
# option(CCX_BUILD_GFX "Build gfx (RHI) module" OFF)
# option(CCX_BUILD_RENDER "Build render module" OFF)
# option(CCX_BUILD_PHYSICS "Build physics module" OFF)
# option(CCX_BUILD_AUDIO "Build audio module" OFF)
# option(CCX_BUILD_UI "Build ui module" OFF)
# option(CCX_BUILD_INPUT "Build input module" OFF)
# option(CCX_BUILD_ASSET "Build asset module" OFF)
# option(CCX_BUILD_SCRIPTING "Build scripting module" OFF)
# option(CCX_BUILD_NETWORK "Build network module" OFF)
# option(CCX_BUILD_PLATFORM "Build platform module" OFF)

if(CCX_BUILD_TESTS)
  enable_testing()
endif()

add_subdirectory(engine)
