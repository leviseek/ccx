#pragma once
#include <string>

#include "ccx/foundation/serialization/json.h"

namespace ccx::script {

// 脚本宿主（QuickJS 嵌入；W5a 主选决策 script-engine-decision）
// 生命周期：构造即建 Runtime+Context；析构释放。eval 结果/错误以 JSON 返回：
//   { ok: true, value: <json> } 或 { ok: false, error: <message> }
class ScriptHost {
public:
    ScriptHost();
    ~ScriptHost();
    ScriptHost(const ScriptHost&) = delete;
    ScriptHost& operator=(const ScriptHost&) = delete;

    json::Value eval(const std::string& code);
    // 宿主函数（W5b 绑定面第一环）：数值快速路径 hostFn(doubles, count) -> double
    using HostFn = double (*)(const double* args, int argc);
    // 注册后脚本可直接调用（如 hostScale(21) -> 42）；同名覆盖
    void setHostFunction(const std::string& name, HostFn fn);
    // 通用 JSON 命令面（W5b 第二环）：脚本传 JSON 字符串 -> 引擎回调返回 JSON 结果
    using JsonFn = const char* (*)(const char* jsonIn);
    void setJsonFunction(const std::string& name, JsonFn fn);
    // 事件桥（W5b 第三环）：C++ 侧调用脚本全局函数（如 onUpdate(dt)）
    // jsonArgs 传入；返回值与 eval 同构（ok/value 或 ok/error）
    json::Value invoke(const std::string& fnName, const std::string& jsonArgs);
    // 引擎侧统计（profiler）：eval/invoke 总次数与当次耗时（毫秒）
    uint64_t evalCount() const { return evalCount_; }
    double lastScriptMs() const { return lastScriptMs_; }

private:
    void* runtime_;  // JSRuntime*
    void* ctx_;      // JSContext*
    uint64_t evalCount_ = 0;
    double lastScriptMs_ = 0.0;
};

}  // namespace ccx::script
