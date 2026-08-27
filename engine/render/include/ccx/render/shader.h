#pragma once
#include <string>
#include <vector>

#include "ccx/foundation/serialization/json.h"
#include "ccx/render/material.h"

namespace ccx::render {

// Shader 资产（renderer-spec §4：uniform 声明；着色器编译在 M2）
struct UniformDecl {
    std::string name;
    std::string type;   // "float" | "vec4" | "texture"
};

struct ShaderDef {
    std::string schema;  // "ccx.shader/1"
    std::string name;    // "builtin/sprite"
    std::vector<UniformDecl> uniforms;
};

bool parseShader(const json::Value& doc, ShaderDef& out, std::string& err);

// uniform 类型判定（由 JSON 参数值推断）
std::string uniformKindOf(const json::Value& v);

// 校验：material.params 必须 ⊆ shader.uniforms 且类型匹配；
// shader 声明但 material 未给的参数允许（用默认值）。
bool validateMaterialAgainstShader(const MaterialDef& m, const ShaderDef& s,
                                   std::string& err);

}  // namespace ccx::render
