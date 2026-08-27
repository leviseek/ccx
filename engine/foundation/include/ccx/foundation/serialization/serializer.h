#pragma once
#include <string>

#include "ccx/foundation/reflection/type.h"
#include "ccx/foundation/serialization/json.h"

// schema 驱动的对象 <-> JSON（engine-spec §6；ADR-003 双格式的 JSON 侧）
// 二进制 .cscene 由同一 schema 在 Cook 阶段生成（M1+）

namespace ccx::serialization {

json::Value toJson(const TypeInfo& ti, const void* obj);
bool fromJson(const TypeInfo& ti, const json::Value& v, void* obj);

// JSON Schema（draft-07 子集）：Inspector / MCP 参数校验 / 序列化共用同一来源
std::string jsonSchema(const TypeInfo& ti);

}  // namespace ccx::serialization
