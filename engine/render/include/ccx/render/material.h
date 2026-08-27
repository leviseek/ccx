#pragma once
#include <string>
#include <utility>
#include <vector>

#include "ccx/foundation/serialization/json.h"

namespace ccx::render {

// 材质资产（renderer-spec §4 配套；v1 只做解析与校验，GPU 绑定在 M2）
struct MaterialDef {
    std::string schema;      // "ccx.material/1"
    std::string name;
    std::string shader;      // "builtin/sprite" 等
    std::string blendMode;   // "alpha"（默认）/"additive"/"opaque"
    std::vector<std::pair<std::string, json::Value>> params;  // 参数表（保留声明序）
};

bool parseMaterial(const json::Value& doc, MaterialDef& out, std::string& err);

}  // namespace ccx::render
