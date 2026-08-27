// 材质资产解析（renderer-spec §4 配套）
#include <cstdio>
#include <string>

#include "ccx/foundation/serialization/json.h"
#include "ccx/render/material.h"

using namespace ccx;
using namespace ccx::render;

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
    {
        // 合法材质
        const auto doc = json::parse(
            "{\"schema\":\"ccx.material/1\",\"name\":\"mat_hero\","
            "\"shader\":\"builtin/sprite\",\"blend\":\"additive\","
            "\"params\":{\"tint\":[1,0.5,0.5,1],\"brightness\":1.2}}");
        MaterialDef m;
        std::string err;
        check(parseMaterial(doc, m, err), "材质解析成功");
        check(m.name == "mat_hero" && m.shader == "builtin/sprite", "名称/shader");
        check(m.blendMode == "additive", "blend 读取");
        check(m.params.size() == 2, "两个参数");
        check(m.params[0].first == "tint" &&
                  m.params[0].second.asArray().size() == 4,
              "tint 颜色数组");
        check(m.params[1].second.asNumber() == 1.2, "brightness 数值");
    }
    {
        // 默认 blend = alpha
        const auto doc = json::parse(
            "{\"schema\":\"ccx.material/1\",\"name\":\"m\",\"shader\":\"builtin/ui\"}");
        MaterialDef m;
        std::string err;
        check(parseMaterial(doc, m, err), "最小材质解析成功");
        check(m.blendMode == "alpha", "默认 blend=alpha");
    }
    {
        // schema 错误 / 缺 shader
        MaterialDef m;
        std::string err;
        check(!parseMaterial(json::parse("{\"name\":\"x\"}"), m, err),
              "缺 schema 拒绝");
        check(err.find("schema") != std::string::npos, "schema 错误信息");
        check(!parseMaterial(json::parse(
                  "{\"schema\":\"ccx.material/1\",\"name\":\"x\"}"),
                              m, err),
              "缺 shader 拒绝");
        check(err.find("shader") != std::string::npos, "shader 错误信息");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (material)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
