#include "ccx/render/shader.h"

#include <algorithm>

namespace ccx::render {

bool parseShader(const json::Value& doc, ShaderDef& out, std::string& err) {
    if (doc.kind() != json::Kind::Object) {
        err = "shader: 根节点必须是对象";
        return false;
    }
    const json::Value* schema = doc.find("schema");
    if (schema == nullptr || schema->kind() != json::Kind::String ||
        schema->asString() != "ccx.shader/1") {
        err = "shader: 缺少或错误的 schema（需要 ccx.shader/1）";
        return false;
    }
    out.schema = schema->asString();
    const json::Value* name = doc.find("name");
    if (name == nullptr || name->kind() != json::Kind::String) {
        err = "shader: 缺少 name";
        return false;
    }
    out.name = name->asString();
    const json::Value* uniforms = doc.find("uniforms");
    if (uniforms != nullptr) {
        if (uniforms->kind() != json::Kind::Array) {
            err = "shader: uniforms 必须是数组";
            return false;
        }
        for (const json::Value& u : uniforms->asArray()) {
            UniformDecl u0;
            if (const json::Value* n = u.find("name")) u0.name = n->asString();
            if (const json::Value* t = u.find("type")) u0.type = t->asString();
            out.uniforms.push_back(std::move(u0));
        }
    }
    return true;
}

std::string uniformKindOf(const json::Value& v) {
    switch (v.kind()) {
        case json::Kind::Number: return "float";
        case json::Kind::String: return "texture";
        case json::Kind::Array:
            return v.asArray().size() == 4 ? "vec4" : "?";
        default: return "?";
    }
}

bool validateMaterialAgainstShader(const MaterialDef& m, const ShaderDef& s,
                                   std::string& err) {
    for (const auto& [pname, pval] : m.params) {
        const auto it = std::find_if(s.uniforms.begin(), s.uniforms.end(),
                                     [&](const UniformDecl& u) { return u.name == pname; });
        if (it == s.uniforms.end()) {
            err = "material 参数未在 shader 声明: " + pname;
            return false;
        }
        const std::string kind = uniformKindOf(pval);
        if (kind == "?") {
            err = "参数类型无法识别: " + pname;
            return false;
        }
        if (kind != it->type) {
            err = "参数类型不符: " + pname + "（shader:" + it->type + "，实际:" + kind + "）";
            return false;
        }
    }
    return true;
}

}  // namespace ccx::render
