// shader 资产 + material 联动校验（renderer-spec §4）
#include <cstdio>
#include <string>

#include "ccx/foundation/serialization/json.h"
#include "ccx/render/material.h"
#include "ccx/render/shader.h"

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
bool hasErr(const std::string& e, const char* kw) {
    return e.find(kw) != std::string::npos;
}
}  // namespace

int main() {
    // 合法 shader 资产
    ShaderDef sh;
    std::string err;
    check(parseShader(json::parse(
              "{\"schema\":\"ccx.shader/1\",\"name\":\"builtin/sprite\","
              "\"uniforms\":[{\"name\":\"tint\",\"type\":\"vec4\"},"
              "{\"name\":\"brightness\",\"type\":\"float\"},"
              "{\"name\":\"albedo\",\"type\":\"texture\"}]}"),
              sh, err),
          "shader 解析成功");
    check(sh.name == "builtin/sprite" && sh.uniforms.size() == 3, "uniforms 数量");

    // 匹配材质
    MaterialDef m;
    check(parseMaterial(json::parse(
              "{\"schema\":\"ccx.material/1\",\"name\":\"mat\","
              "\"shader\":\"builtin/sprite\","
              "\"params\":{\"tint\":[1,0.5,0.5,1],\"brightness\":1.2,"
              "\"albedo\":\"atlas:hero/0\"}}"),
              m, err),
          "材质解析成功");
    check(validateMaterialAgainstShader(m, sh, err), "材质与 shader 匹配");
    check(err.empty(), "无校验错误");

    // 未声明参数 -> 错误
    MaterialDef bad;
    check(parseMaterial(json::parse(
              "{\"schema\":\"ccx.material/1\",\"name\":\"b\","
              "\"shader\":\"builtin/sprite\","
              "\"params\":{\"glow\":1.0}}"),
              bad, err),
          "解析成功");
    check(!validateMaterialAgainstShader(bad, sh, err), "多余参数被拒");
    check(hasErr(err, "glow"), "错误指名参数");

    // 类型不符（vec4 长度 3）
    MaterialDef badType;
    check(parseMaterial(json::parse(
              "{\"schema\":\"ccx.material/1\",\"name\":\"b\","
              "\"shader\":\"builtin/sprite\","
              "\"params\":{\"tint\":[1,0,0]}}"),
              badType, err),
          "解析成功");
    check(!validateMaterialAgainstShader(badType, sh, err), "vec4 长度不符被拒");
    check(hasErr(err, "tint"), "错误指名参数");

    // 缺参允许（用默认值）
    MaterialDef partial;
    check(parseMaterial(json::parse(
              "{\"schema\":\"ccx.material/1\",\"name\":\"c\","
              "\"shader\":\"builtin/sprite\","
              "\"params\":{\"brightness\":1.0}}"),
              partial, err),
          "解析成功");
    check(validateMaterialAgainstShader(partial, sh, err), "缺参数允许（默认值）");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (shader/material)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
