#pragma once
#include <cstdint>

namespace ccx::ecs {

// 实体句柄：index + version（防悬垂；engine-spec §3.1）
struct Entity {
    uint32_t index = 0;
    uint32_t version = 0;
};

inline constexpr Entity kNullEntity{0, 0};

inline bool operator==(Entity a, Entity b) {
    return a.index == b.index && a.version == b.version;
}
inline bool operator!=(Entity a, Entity b) { return !(a == b); }
inline bool operator<(Entity a, Entity b) { return a.index < b.index; }  // map 键/排序

}  // namespace ccx::ecs
