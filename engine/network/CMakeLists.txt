# network — ECS delta 同步通道（roadmap M4：net sync；无 socket 纯数据面）

add_library(ccx_network STATIC
  src/sync_channel.cpp
)

target_include_directories(ccx_network PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_compile_features(ccx_network PUBLIC cxx_std_20)
target_link_libraries(ccx_network PUBLIC ccx_foundation)

if(MSVC)
  target_compile_options(ccx_network PRIVATE /W4 /WX)
else()
  target_compile_options(ccx_network PRIVATE -Wall -Wextra -Werror -pedantic)
endif()
