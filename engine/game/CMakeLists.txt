# game — 帧循环宿主（固定步长 + 防螺旋；engine-spec §1 app 层地基）

add_library(ccx_game STATIC src/game_loop.cpp)

target_include_directories(ccx_game PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(ccx_game PUBLIC ccx_foundation)
target_compile_features(ccx_game PUBLIC cxx_std_20)

if(MSVC)
  target_compile_options(ccx_game PRIVATE /W4 /WX)
else()
  target_compile_options(ccx_game PRIVATE -Wall -Wextra -Werror -pedantic)
endif()
