#include "ccx/script/host.h"

#include <cstdio>
#include <cstring>

// quickjs.h 的 inline 函数在严格标志下触发 unused-parameter 警告：隔离
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-parameter"
extern "C" {
#include "quickjs.h"
}
#pragma GCC diagnostic pop

namespace ccx::script {

namespace {
// eval 结果转 JSON（number/string/bool/null 基本类型；其他序列化为类型名）
json::Value toJson(JSContext* ctx, JSValueConst v) {
    if (JS_IsException(v)) return json::Value::string("exception");
    if (JS_IsNull(v) || JS_IsUndefined(v)) return json::Value::nil();
    if (JS_IsBool(v)) return json::Value::boolean(JS_ToBool(ctx, v) != 0);
    if (JS_IsNumber(v)) {
        double d = 0;
        JS_ToFloat64(ctx, &d, v);
        return json::Value::number(d);
    }
    if (JS_IsString(v)) {
        const char* s = JS_ToCString(ctx, v);
        json::Value out = json::Value::string(s ? s : "");
        if (s) JS_FreeCString(ctx, s);
        return out;
    }
    // 复杂类型（对象/数组/函数）：序列化为类型标签
    return json::Value::string(JS_IsFunction(ctx, v) ? "function"
                              : JS_IsObject(v) ? "object" : "value");
}
}  // namespace

ScriptHost::ScriptHost() {
    runtime_ = JS_NewRuntime();
    ctx_ = runtime_ ? JS_NewContext(static_cast<JSRuntime*>(runtime_)) : nullptr;
}

ScriptHost::~ScriptHost() {
    if (ctx_) JS_FreeContext(static_cast<JSContext*>(ctx_));
    if (runtime_) JS_FreeRuntime(static_cast<JSRuntime*>(runtime_));
}

json::Value ScriptHost::eval(const std::string& code) {
    if (!ctx_) return json::parse("{\"ok\":false,\"error\":\"host not initialized\"}");
    JSContext* ctx = static_cast<JSContext*>(ctx_);
    JSValue result = JS_Eval(ctx, code.c_str(), code.size(), "<eval>", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(result)) {
        JSValue ex = JS_GetException(ctx);
        std::string msg = "js error";
        // 异常为 Error 对象：先转字符串再取文本
        JSValue es = JS_IsString(ex) ? JS_DupValue(ctx, ex) : JS_ToString(ctx, ex);
        if (JS_IsString(es)) {
            const char* s = JS_ToCString(ctx, es);
            msg = s ? s : "js error";
            if (s) JS_FreeCString(ctx, s);
        }
        JS_FreeValue(ctx, es);
        JS_FreeValue(ctx, ex);
        JS_FreeValue(ctx, result);
        json::Value::ObjectEntries e;
        e.emplace_back("ok", json::Value::boolean(false));
        e.emplace_back("error", json::Value::string(msg));
        return json::Value::object(std::move(e));
    }
    json::Value::ObjectEntries e;
    e.emplace_back("ok", json::Value::boolean(true));
    e.emplace_back("value", toJson(ctx, result));
    JS_FreeValue(ctx, result);
    return json::Value::object(std::move(e));
}

void ScriptHost::setHostFunction(const std::string& name, void* jsFn) {
    // v1：占位（绑定生成物接入点；宿主函数注册在 W5b）
    (void)name;
    (void)jsFn;
}

}  // namespace ccx::script
