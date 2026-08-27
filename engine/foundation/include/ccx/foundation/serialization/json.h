#pragma once
#include <cstdint>
#include <string>
#include <string_view>
#include <utility>
#include <variant>
#include <vector>

namespace ccx::json {

// 极简 JSON 值模型（M0：schema 驱动序列化的载体；不追求性能）
// - 解析失败返回 Null（不抛异常，M0 约定；强校验进 M2）
// - dump 数字按 %.6g（ADR-003：浮点保留 6 位有效）
enum class Kind : uint8_t { Null, Bool, Number, String, Array, Object };

class Value {
public:
    using Array = std::vector<Value>;
    using ObjectEntries = std::vector<std::pair<std::string, Value>>;

    Value() = default;  // Null

    static Value nil() { return {}; }
    static Value boolean(bool b) { Value v; v.storage_ = b; return v; }
    static Value number(double d) { Value v; v.storage_ = d; return v; }
    static Value string(std::string s) { Value v; v.storage_ = std::move(s); return v; }
    static Value array(Array a) { Value v; v.storage_ = std::move(a); return v; }
    static Value object(ObjectEntries o) { Value v; v.storage_ = std::move(o); return v; }

    Kind kind() const;
    bool isNull() const { return kind() == Kind::Null; }
    double asNumber() const;
    bool asBool() const;
    const std::string& asString() const;
    const Array& asArray() const;
    const ObjectEntries& asObject() const;
    const Value* find(std::string_view key) const;

    // 对象写入（Prefab override 字段链用）：将节点视为对象，返回（或创建）该键子节点
    Value& setField(std::string_view key);

    bool operator==(const Value&) const = default;

private:
    std::variant<std::nullptr_t, bool, double, std::string, Array, ObjectEntries> storage_;
};

Value parse(std::string_view text);
std::string dump(const Value& v);       // 紧凑
std::string dumpPretty(const Value& v); // 2 空格缩进

}  // namespace ccx::json
