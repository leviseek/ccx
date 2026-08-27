#include "ccx/foundation/serialization/json.h"

#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstdlib>

namespace ccx::json {

Kind Value::kind() const {
    if (std::holds_alternative<std::nullptr_t>(storage_)) return Kind::Null;
    if (std::holds_alternative<bool>(storage_)) return Kind::Bool;
    if (std::holds_alternative<double>(storage_)) return Kind::Number;
    if (std::holds_alternative<std::string>(storage_)) return Kind::String;
    if (std::holds_alternative<Array>(storage_)) return Kind::Array;
    return Kind::Object;
}

double Value::asNumber() const { return std::get<double>(storage_); }
bool Value::asBool() const { return std::get<bool>(storage_); }
const std::string& Value::asString() const { return std::get<std::string>(storage_); }
const Value::Array& Value::asArray() const { return std::get<Array>(storage_); }
const Value::ObjectEntries& Value::asObject() const { return std::get<ObjectEntries>(storage_); }

const Value* Value::find(std::string_view key) const {
    if (kind() != Kind::Object) return nullptr;
    for (const auto& [k, v] : std::get<ObjectEntries>(storage_)) {
        if (k == key) return &v;
    }
    return nullptr;
}

namespace {

struct Parser {
    std::string_view s;
    size_t i = 0;

    void skipWs() {
        while (i < s.size() &&
               (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) {
            ++i;
        }
    }

    char peek() const { return i < s.size() ? s[i] : '\0'; }

    bool consume(char c) {
        if (peek() == c) {
            ++i;
            return true;
        }
        return false;
    }

    Value parseValue() {
        skipWs();
        const char c = peek();
        if (c == '{') return parseObject();
        if (c == '[') return parseArray();
        if (c == '"') return Value::string(parseString());
        if (c == 't') {
            if (s.size() - i >= 4 && s.substr(i, 4) == "true") {
                i += 4;
                return Value::boolean(true);
            }
            return Value::nil();
        }
        if (c == 'f') {
            if (s.size() - i >= 5 && s.substr(i, 5) == "false") {
                i += 5;
                return Value::boolean(false);
            }
            return Value::nil();
        }
        if (c == 'n') {
            if (s.size() - i >= 4 && s.substr(i, 4) == "null") {
                i += 4;
                return Value::nil();
            }
            return Value::nil();
        }
        if (c == '-' || (c >= '0' && c <= '9')) return parseNumber();
        return Value::nil();  // 解析失败约定：Null
    }

    Value parseNumber() {
        const size_t start = i;
        if (peek() == '-') ++i;
        while (i < s.size() &&
               (std::isdigit(static_cast<unsigned char>(s[i])) || s[i] == '.' ||
                s[i] == 'e' || s[i] == 'E' || s[i] == '+' || s[i] == '-')) {
            ++i;
        }
        const std::string tok(s.substr(start, i - start));
        const double d = std::strtod(tok.c_str(), nullptr);
        return Value::number(d);
    }

    uint32_t readHex4() {
        uint32_t v = 0;
        for (int k = 0; k < 4 && i < s.size(); ++k) {
            const char c = s[i++];
            v <<= 4;
            if (c >= '0' && c <= '9') {
                v |= static_cast<uint32_t>(c - '0');
            } else if (c >= 'a' && c <= 'f') {
                v |= static_cast<uint32_t>(c - 'a' + 10);
            } else if (c >= 'A' && c <= 'F') {
                v |= static_cast<uint32_t>(c - 'A' + 10);
            }
        }
        return v;
    }

    static void appendUtf8(std::string& out, uint32_t cp) {
        if (cp <= 0x7Fu) {
            out.push_back(static_cast<char>(cp));
        } else if (cp <= 0x7FFu) {
            out.push_back(static_cast<char>(0xC0u | (cp >> 6)));
            out.push_back(static_cast<char>(0x80u | (cp & 0x3Fu)));
        } else if (cp <= 0xFFFFu) {
            out.push_back(static_cast<char>(0xE0u | (cp >> 12)));
            out.push_back(static_cast<char>(0x80u | ((cp >> 6) & 0x3Fu)));
            out.push_back(static_cast<char>(0x80u | (cp & 0x3Fu)));
        } else {
            out.push_back(static_cast<char>(0xF0u | (cp >> 18)));
            out.push_back(static_cast<char>(0x80u | ((cp >> 12) & 0x3Fu)));
            out.push_back(static_cast<char>(0x80u | ((cp >> 6) & 0x3Fu)));
            out.push_back(static_cast<char>(0x80u | (cp & 0x3Fu)));
        }
    }

    std::string parseString() {
        std::string out;
        ++i;  // 跳过开引号
        while (i < s.size()) {
            const char c = s[i++];
            if (c == '"') break;
            if (c == '\\') {
                if (i >= s.size()) break;
                const char e = s[i++];
                switch (e) {
                    case '"': out.push_back('"'); break;
                    case '\\': out.push_back('\\'); break;
                    case '/': out.push_back('/'); break;
                    case 'b': out.push_back('\b'); break;
                    case 'f': out.push_back('\f'); break;
                    case 'n': out.push_back('\n'); break;
                    case 'r': out.push_back('\r'); break;
                    case 't': out.push_back('\t'); break;
                    case 'u': {
                        uint32_t cp = readHex4();
                        if (cp >= 0xD800u && cp <= 0xDBFFu && i + 1 < s.size() &&
                            s[i] == '\\' && s[i + 1] == 'u') {
                            i += 2;
                            const uint32_t lo = readHex4();
                            if (lo >= 0xDC00u && lo <= 0xDFFFu) {
                                cp = 0x10000u + ((cp - 0xD800u) << 10) + (lo - 0xDC00u);
                            }
                        }
                        appendUtf8(out, cp);
                        break;
                    }
                    default: out.push_back(e); break;
                }
            } else {
                out.push_back(c);
            }
        }
        return out;
    }

    Value parseArray() {
        ++i;  // '['
        Value::Array arr;
        skipWs();
        if (consume(']')) return Value::array(std::move(arr));
        for (;;) {
            arr.push_back(parseValue());
            skipWs();
            if (consume(']')) break;
            if (!consume(',')) break;
            skipWs();
        }
        return Value::array(std::move(arr));
    }

    Value parseObject() {
        ++i;  // '{'
        Value::ObjectEntries entries;
        skipWs();
        if (consume('}')) return Value::object(std::move(entries));
        for (;;) {
            skipWs();
            if (peek() != '"') break;
            std::string key = parseString();
            skipWs();
            consume(':');
            Value v = parseValue();
            entries.emplace_back(std::move(key), std::move(v));
            skipWs();
            if (consume('}')) break;
            if (!consume(',')) break;
        }
        return Value::object(std::move(entries));
    }
};

std::string escapeString(std::string_view s) {
    std::string out;
    out.reserve(s.size() + 8);
    for (const char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b"; break;
            case '\f': out += "\\f"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20u) {
                    char buf[8];
                    std::snprintf(buf, sizeof buf, "\\u%04x",
                                  static_cast<unsigned>(static_cast<unsigned char>(c)));
                    out += buf;
                } else {
                    out.push_back(c);
                }
        }
    }
    return out;
}

std::string formatNumber(double d) {
    if (std::isnan(d) || std::isinf(d)) return "null";  // JSON 无 NaN/Inf
    if (d >= -1e15 && d <= 1e15 && d == std::floor(d)) {
        return std::to_string(static_cast<long long>(d));
    }
    char buf[32];
    std::snprintf(buf, sizeof buf, "%.6g", d);
    return buf;
}

void appendCompact(std::string& out, const Value& v) {
    switch (v.kind()) {
        case Kind::Null: out += "null"; break;
        case Kind::Bool: out += v.asBool() ? "true" : "false"; break;
        case Kind::Number: out += formatNumber(v.asNumber()); break;
        case Kind::String:
            out += '"';
            out += escapeString(v.asString());
            out += '"';
            break;
        case Kind::Array: {
            out += '[';
            bool first = true;
            for (const Value& e : v.asArray()) {
                if (!first) out += ',';
                first = false;
                appendCompact(out, e);
            }
            out += ']';
            break;
        }
        case Kind::Object: {
            out += '{';
            bool first = true;
            for (const auto& [k, val] : v.asObject()) {
                if (!first) out += ',';
                first = false;
                out += '"';
                out += escapeString(k);
                out += "\":";
                appendCompact(out, val);
            }
            out += '}';
            break;
        }
    }
}

void appendPretty(std::string& out, const Value& v, int depth) {
    const std::string indent(static_cast<size_t>(depth) * 2, ' ');
    switch (v.kind()) {
        case Kind::Array: {
            if (v.asArray().empty()) {
                out += "[]";
                return;
            }
            out += "[\n";
            bool first = true;
            for (const Value& e : v.asArray()) {
                if (!first) out += ",\n";
                first = false;
                out += indent;
                out += "  ";
                appendPretty(out, e, depth + 1);
            }
            out += '\n';
            out += indent;
            out += ']';
            break;
        }
        case Kind::Object: {
            if (v.asObject().empty()) {
                out += "{}";
                return;
            }
            out += "{\n";
            bool first = true;
            for (const auto& [k, val] : v.asObject()) {
                if (!first) out += ",\n";
                first = false;
                out += indent;
                out += "  ";
                out += '"';
                out += escapeString(k);
                out += "\": ";
                appendPretty(out, val, depth + 1);
            }
            out += '\n';
            out += indent;
            out += '}';
            break;
        }
        default:
            appendCompact(out, v);
    }
}

}  // namespace

Value parse(std::string_view text) {
    Parser p{text};
    return p.parseValue();
}

std::string dump(const Value& v) {
    std::string out;
    out.reserve(128);
    appendCompact(out, v);
    return out;
}

std::string dumpPretty(const Value& v) {
    std::string out;
    out.reserve(256);
    appendPretty(out, v, 0);
    return out;
}

}  // namespace ccx::json
