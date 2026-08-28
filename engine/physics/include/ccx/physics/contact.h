#pragma once
#include <cstdint>
#include <map>
#include <utility>
#include <vector>

#include "ccx/physics/collision.h"

namespace ccx::physics {

// 窄相：接触事件（a < b，精确 AABB 重叠）
struct ContactEvent {
    uint32_t a = 0;
    uint32_t b = 0;
};

// 对宽相候选对做精确 AABB 判定；boxes 缺失的 id 忽略
std::vector<ContactEvent> narrowPhase(const SpatialGrid& grid,
                                      const std::map<uint32_t, Aabb>& boxes);

// 宽相 + 窄相一步（网格重建由调用方 clear/insert；本函数只做判定）
std::vector<ContactEvent> resolveContacts(const SpatialGrid& grid,
                                          const std::map<uint32_t, Aabb>& boxes);

}  // namespace ccx::physics
