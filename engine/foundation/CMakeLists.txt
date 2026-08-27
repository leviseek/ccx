# foundation — 容器/数学/内存/Job/反射/序列化（M0 首个子项目，engine-spec §1）

add_library(ccx_foundation STATIC
  src/reflection/type_registry.cpp
  src/serialization/json.cpp
  src/serialization/serializer.cpp
)

target_include_directories(ccx_foundation PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_compile_features(ccx_foundation PUBLIC cxx_std_20)

# ADR-001 §5：C++ 侧纪律 —— 全量告警即错误
if(MSVC)
  target_compile_options(ccx_foundation PRIVATE /W4 /WX)
else()
  target_compile_options(ccx_foundation PRIVATE -Wall -Wextra -Werror -pedantic)
endif()
