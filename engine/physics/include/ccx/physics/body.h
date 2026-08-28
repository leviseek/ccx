#pragma once
#include <cstdint>
#include <map>
#include <utility>
#include <vector>

#include "ccx/physics/collision.h"
#include "ccx/physics/contact.h"

namespace ccx::physics {

// 碰撞体（带层/掩码）：layer=自身所在层（bit 位），mask=能与哪些层碰撞
struct Body {
    Aabb box;
    uint32_t layer = 1;
    uint32_t mask = 0xFFFFFFFFu;
};

// 常用层约定（示例）
constexpr uint32_t kLayerPlayer = 1u << 0;
constexpr uint32_t kLayerEnvironment = 1u << 1;
constexpr uint32_t kLayerProjectile = 1u << 2;

// 掩码判定：双方都允许才算
inline bool canCollide(const Body& a, const Body& b) {
    return (a.mask & b.layer) != 0 && (b.mask & a.layer) != 0;
}

// 带层的窄相：宽相候选 -> 掩码 + AABB 双重过滤
std::vector<ContactEvent> narrowPhaseLayered(const SpatialGrid& grid,
                                             const std::map<uint32_t, Body>& bodies);

}  // namespace ccx::physics
