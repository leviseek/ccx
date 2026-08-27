#include "ccx/render/material.h"

namespace ccx::render {

bool parseMaterial(const json::Value& doc, MaterialDef& out, std::string& err) {
    if (doc.kind() != json::Kind::Object) {
        err = "material: 根节点必须是对象";
        return false;
    }
    const json::Value* schema = doc.find("schema");
    if (schema == nullptr || schema->kind() != json::Kind::String ||
        schema->asString() != "ccx.material/1") {
        err = "material: 缺少或错误的 schema（需要 ccx.material/1）";
        return false;
    }
    out.schema = schema->asString();
    if (const json::Value* n = doc.find("name")) out.name = n->asString();
    const json::Value* shader = doc.find("shader");
    if (shader == nullptr || shader->kind() != json::Kind::String ||
        shader->asString().empty()) {
        err = "material: 必须声明 shader";
        return false;
    }
    out.shader = shader->asString();
    if (const json::Value* b = doc.find("blend")) out.blendMode = b->asString();
    if (out.blendMode.empty()) out.blendMode = "alpha";  // 默认 alpha

    const json::Value* params = doc.find("params");
    if (params != nullptr) {
        if (params->kind() != json::Kind::Object) {
            err = "material: params 必须是对象";
            return false;
        }
        for (const auto& [k, v] : params->asObject()) {
            out.params.emplace_back(k, v);
        }
    }
    return true;
}

}  // namespace ccx::render
