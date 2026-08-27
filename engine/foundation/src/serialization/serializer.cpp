#include "ccx/foundation/serialization/serializer.h"

#include <string>

#include "ccx/foundation/math/color.h"
#include "ccx/foundation/math/vec2.h"

namespace ccx::serialization {

using json::Value;

Value toJson(const TypeInfo& ti, const void* obj) {
    const char* base = static_cast<const char*>(obj);
    Value::ObjectEntries entries;
    entries.reserve(ti.properties.size());
    auto add = [&entries](std::string_view name, Value v) {
        entries.emplace_back(std::string(name), std::move(v));
    };
    for (const PropertyInfo& p : ti.properties) {
        const void* fp = base + p.offset;
        switch (p.kind) {
            case TypeKind::Float:
                add(p.name, Value::number(static_cast<double>(*static_cast<const float*>(fp))));
                break;
            case TypeKind::Int:
                add(p.name, Value::number(static_cast<double>(*static_cast<const int*>(fp))));
                break;
            case TypeKind::UInt:
                add(p.name, Value::number(static_cast<double>(*static_cast<const unsigned*>(fp))));
                break;
            case TypeKind::Bool:
                add(p.name, Value::boolean(*static_cast<const bool*>(fp)));
                break;
            case TypeKind::String:
                add(p.name, Value::string(*static_cast<const std::string*>(fp)));
                break;
            case TypeKind::Vec2: {
                const Vec2& v = *static_cast<const Vec2*>(fp);
                add(p.name, Value::array({Value::number(v.x), Value::number(v.y)}));
                break;
            }
            case TypeKind::Color: {
                const Color& c = *static_cast<const Color*>(fp);
                add(p.name, Value::array({Value::number(c.r), Value::number(c.g),
                                          Value::number(c.b), Value::number(c.a)}));
                break;
            }
            case TypeKind::Object: {
                const TypeInfo* nested = p.nestedInfo ? p.nestedInfo() : nullptr;
                if (nested == nullptr) {
                    add(p.name, Value::nil());
                } else {
                    add(p.name, toJson(*nested, fp));
                }
                break;
            }
            default:
                add(p.name, Value::nil());
        }
    }
    return Value::object(std::move(entries));
}

bool fromJson(const TypeInfo& ti, const Value& v, void* obj) {
    if (v.kind() != json::Kind::Object) return false;
    char* base = static_cast<char*>(obj);
    for (const PropertyInfo& p : ti.properties) {
        const Value* fv = v.find(p.name);
        if (fv == nullptr) continue;  // 缺字段 = 保持默认（容错）
        void* fp = base + p.offset;
        switch (p.kind) {
            case TypeKind::Float: {
                if (fv->kind() != json::Kind::Number) return false;
                *static_cast<float*>(fp) = static_cast<float>(fv->asNumber());
                break;
            }
            case TypeKind::Int: {
                if (fv->kind() != json::Kind::Number) return false;
                *static_cast<int*>(fp) = static_cast<int>(fv->asNumber());
                break;
            }
            case TypeKind::UInt: {
                if (fv->kind() != json::Kind::Number) return false;
                *static_cast<unsigned*>(fp) = static_cast<unsigned>(fv->asNumber());
                break;
            }
            case TypeKind::Bool: {
                if (fv->kind() != json::Kind::Bool) return false;
                *static_cast<bool*>(fp) = fv->asBool();
                break;
            }
            case TypeKind::String: {
                if (fv->kind() != json::Kind::String) return false;
                static_cast<std::string*>(fp)->assign(fv->asString());
                break;
            }
            case TypeKind::Vec2: {
                if (fv->kind() != json::Kind::Array || fv->asArray().size() < 2) return false;
                Vec2& vec = *static_cast<Vec2*>(fp);
                vec.x = static_cast<float>(fv->asArray()[0].asNumber());
                vec.y = static_cast<float>(fv->asArray()[1].asNumber());
                break;
            }
            case TypeKind::Color: {
                if (fv->kind() != json::Kind::Array || fv->asArray().size() < 3) return false;
                Color& c = *static_cast<Color*>(fp);
                c.r = static_cast<float>(fv->asArray()[0].asNumber());
                c.g = static_cast<float>(fv->asArray()[1].asNumber());
                c.b = static_cast<float>(fv->asArray()[2].asNumber());
                c.a = fv->asArray().size() > 3
                          ? static_cast<float>(fv->asArray()[3].asNumber())
                          : 1.0f;
                break;
            }
            case TypeKind::Object: {
                const TypeInfo* nested = p.nestedInfo ? p.nestedInfo() : nullptr;
                if (nested == nullptr || !fromJson(*nested, *fv, fp)) return false;
                break;
            }
            default:
                return false;
        }
    }
    return true;
}

namespace {

Value makeFieldSchema(const PropertyInfo& p) {
    Value::ObjectEntries spec;
    auto put = [&spec](const char* k, Value v) { spec.emplace_back(k, std::move(v)); };
    switch (p.kind) {
        case TypeKind::Float: put("type", Value::string("number")); break;
        case TypeKind::Int:
        case TypeKind::UInt: put("type", Value::string("integer")); break;
        case TypeKind::Bool: put("type", Value::string("boolean")); break;
        case TypeKind::String: put("type", Value::string("string")); break;
        case TypeKind::Vec2:
        case TypeKind::Color: {
            put("type", Value::string("array"));
            put("items", Value::object({{"type", Value::string("number")}}));
            const double n = p.kind == TypeKind::Vec2 ? 2.0 : 4.0;
            put("minItems", Value::number(n));
            put("maxItems", Value::number(n));
            break;
        }
        default:
            put("type", Value::string("object"));
    }
    if (p.meta.rangeMin) put("minimum", Value::number(*p.meta.rangeMin));
    if (p.meta.rangeMax) put("maximum", Value::number(*p.meta.rangeMax));
    if (!p.meta.ui.empty()) put("ui", Value::string(std::string(p.meta.ui)));
    if (!p.meta.assetType.empty()) {
        put("assetType", Value::string(std::string(p.meta.assetType)));
    }
    if (p.meta.readOnly) put("readOnly", Value::boolean(true));
    return Value::object(std::move(spec));
}

}  // namespace

std::string jsonSchema(const TypeInfo& ti) {
    Value::ObjectEntries props;
    props.reserve(ti.properties.size());
    for (const PropertyInfo& p : ti.properties) {
        props.emplace_back(std::string(p.name), makeFieldSchema(p));
    }
    Value::ObjectEntries root;
    root.emplace_back("$schema", Value::string("http://json-schema.org/draft-07/schema#"));
    root.emplace_back("title", Value::string(std::string(ti.name)));
    root.emplace_back("type", Value::string("object"));
    root.emplace_back("properties", Value::object(std::move(props)));
    return json::dumpPretty(Value::object(std::move(root)));
}

}  // namespace ccx::serialization
