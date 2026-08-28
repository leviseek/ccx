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
    // 暴露宿主函数（v1：JSON 字符串捕获；绑定生成物接入点）
    void setHostFunction(const std::string& name, void* jsFn);

private:
    void* runtime_;  // JSRuntime*
    void* ctx_;      // JSContext*
};

}  // namespace ccx::script
