# input — 统一输入事件源（engine-spec §1；platform adapter 之上，纯数据可测）

add_library(ccx_input STATIC src/input_state.cpp)

target_include_directories(ccx_input PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(ccx_input PUBLIC ccx_foundation)
target_compile_features(ccx_input PUBLIC cxx_std_20)

if(MSVC)
  target_compile_options(ccx_input PRIVATE /W4 /WX)
else()
  target_compile_options(ccx_input PRIVATE -Wall -Wextra -Werror -pedantic)
endif()
