// 脚本宿主测试（W5a：QuickJS 嵌入 eval/错误面）
#include <cstdio>
#include <string>

#include "ccx/script/host.h"

using namespace ccx::script;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
}  // namespace

int main() {
    ScriptHost host;
    // 1) 表达式求值
    const auto r1 = host.eval("1 + 2 * 3");
    check(r1.find("ok") && r1.find("ok")->asBool(), "eval 成功");
    check(r1.find("value")->asNumber() == 7.0, "1+2*3 = 7");
    // 2) 字符串
    const auto r2 = host.eval("'hello ' + 'ccx'");
    check(r2.find("ok")->asBool() && r2.find("value")->asString() == "hello ccx",
          "字符串拼接");
    // 3) 函数定义与调用
    const auto r3 = host.eval("(function (a, b) { return a * b; })(6, 7)");
    check(r3.find("ok")->asBool() && r3.find("value")->asNumber() == 42.0,
          "函数调用 6*7=42");
    // 4) 错误传播
    const auto r4 = host.eval("no_such_var_xyz");
    check(r4.find("ok")->asBool() == false, "未定义变量 -> 错误");
    std::printf("  r4 error = %s\n", r4.find("error")->asString().c_str());
    check(r4.find("error")->asString().find("ReferenceError") != std::string::npos,
          "错误消息含 ReferenceError");
    // 5) 状态保真（跨 eval 变量保留）
    host.eval("var counter = 10;");
    const auto r5 = host.eval("counter + 5");
    check(r5.find("ok")->asBool() && r5.find("value")->asNumber() == 15.0,
          "跨 eval 变量保留");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (script host)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}

