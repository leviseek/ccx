# 引擎测试：每条 add_test 对应 engine-spec 质量门
# gate 3（schema round-trip）在 CI 中经 ctest 强制执行（ci/gates/schema_roundtrip.mjs）

add_executable(ccx_foundation_tests roundtrip_test.cpp)
target_link_libraries(ccx_foundation_tests PRIVATE ccx_foundation)
add_test(NAME foundation.roundtrip COMMAND ccx_foundation_tests)
