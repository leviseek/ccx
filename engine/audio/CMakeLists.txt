# audio — 播放事件数据面（无解码/无输出：M2 音频 worker；事件模型可测）

add_library(ccx_audio STATIC src/audio_bus.cpp)

target_include_directories(ccx_audio PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(ccx_audio PUBLIC ccx_foundation)
target_compile_features(ccx_audio PUBLIC cxx_std_20)

if(MSVC)
  target_compile_options(ccx_audio PRIVATE /W4 /WX)
else()
  target_compile_options(ccx_audio PRIVATE -Wall -Wextra -Werror -pedantic)
endif()
