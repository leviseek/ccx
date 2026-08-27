#pragma once
#include <cstddef>
#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <type_traits>
#include <unordered_map>
#include <vector>

namespace ccx {

struct Vec2;  // math/vec2.h（kind_of 特化只需要类型名）
struct Color; // math/color.h

using TypeId = uint64_t;  // FNV-1a 64 稳定字符串哈希（跨平台一致，ADR-003 引用稳定）

enum class TypeKind : uint8_t {
    None,
    Float,
    Int,
    UInt,
    Bool,
    String,
    Vec2,
    Color,
    Object,
    Array,  // 预留：序列化 v1 暂不支持
};

// 属性元数据（engine-spec §5.1）：Inspector / MCP 校验 / 序列化三处消费同一来源
struct PropertyMeta {
    std::optional<float> rangeMin;   // 设置任一即启用范围
    std::optional<float> rangeMax;
    std::string_view ui;             // "slider"|"color"|"assetRef"|"enum"|"vectorN"
    std::string_view assetType;      // 资产引用类型提示，如 "ccx.Sprite"
    bool readOnly = false;
    TypeKind overrideKind = TypeKind::None;  // 极少用：显式覆盖成员类型推断
};

struct TypeInfo;

struct PropertyInfo {
    std::string_view name;
    size_t offset = 0;
    TypeKind kind = TypeKind::None;
    const TypeInfo* (*nestedInfo)() = nullptr;  // Object 类型：其 TypeInfo 获取器（须已注册）
    PropertyMeta meta;
};

struct TypeInfo {
    std::string_view name;
    TypeId id = 0;
    size_t size = 0;
    size_t align = 0;
    std::vector<PropertyInfo> properties;
};

// 默认空实现；CCX_TYPE（ccx_type.h）为每个类型生成显式特化
template <class T>
inline const TypeInfo* type_info_of() {
    return nullptr;
}

namespace detail {

constexpr TypeId fnv1a_64(const char* s) {
    TypeId h = 14695981039346656037ULL;
    for (; *s; ++s) {
        h ^= static_cast<TypeId>(static_cast<unsigned char>(*s));
        h *= 1099511628211ULL;
    }
    return h;
}

template <class T, class M>
size_t member_offset(M T::* member) {
    static_assert(std::is_default_constructible_v<T>,
                  "CCX 组件/数据类型必须默认可构造（POD 聚合）");
    T dummy{};
    const char* base = reinterpret_cast<const char*>(&dummy);
    const char* field = reinterpret_cast<const char*>(&(dummy.*member));
    return static_cast<size_t>(field - base);
}

template <class M>
struct kind_of {
    static constexpr TypeKind value = TypeKind::Object;  // 泛型结构：需已注册其类型
};
template <>
struct kind_of<float> {
    static constexpr TypeKind value = TypeKind::Float;
};
template <>
struct kind_of<double> {
    static constexpr TypeKind value = TypeKind::Float;
};
template <>
struct kind_of<int> {
    static constexpr TypeKind value = TypeKind::Int;
};
template <>
struct kind_of<unsigned> {
    static constexpr TypeKind value = TypeKind::UInt;
};
template <>
struct kind_of<bool> {
    static constexpr TypeKind value = TypeKind::Bool;
};
template <>
struct kind_of<std::string> {
    static constexpr TypeKind value = TypeKind::String;
};
template <>
struct kind_of<Vec2> {
    static constexpr TypeKind value = TypeKind::Vec2;
};
template <>
struct kind_of<Color> {
    static constexpr TypeKind value = TypeKind::Color;
};

template <class T, class M>
PropertyInfo make_property(M T::* member, const char* name, PropertyMeta meta) {
    PropertyInfo p;
    p.name = name;
    p.offset = member_offset<T, M>(member);
    p.kind = meta.overrideKind != TypeKind::None ? meta.overrideKind : kind_of<M>::value;
    p.meta = meta;
    if (p.kind == TypeKind::Object) {
        p.nestedInfo = type_info_of<M>;  // 要求该类型已先 CCX_TYPE 注册（TU 内顺序）
    }
    return p;
}

template <class T>
TypeInfo make_type_info(const char* name, std::vector<PropertyInfo> props) {
    TypeInfo ti;
    ti.name = name;
    ti.id = fnv1a_64(name);
    ti.size = sizeof(T);
    ti.align = alignof(T);
    ti.properties = std::move(props);
    return ti;
}

}  // namespace detail

class TypeRegistry {
public:
    static TypeRegistry& instance();

    bool registerType(const TypeInfo& ti);  // 重复注册返回 false（幂等）
    const TypeInfo* find(TypeId id) const;
    const TypeInfo* find(std::string_view name) const;
    size_t count() const;

private:
    std::unordered_map<TypeId, TypeInfo> byId_;
    std::map<std::string, TypeId> byName_;
};

template <class T>
inline bool register_type() {
    const TypeInfo* ti = type_info_of<T>();
    return ti != nullptr && TypeRegistry::instance().registerType(*ti);
}

}  // namespace ccx
