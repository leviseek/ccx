#pragma once
#include <cstdint>
#include <map>
#include <utility>
#include <vector>

#include "ccx/foundation/math/vec2.h"

namespace ccx::physics {

// 2D AABB（碰撞数据面：相交/接触/包含查询）
struct Aabb {
    Vec2 min{0.0f, 0.0f};
    Vec2 max{0.0f, 0.0f};

    static Aabb fromCenter(Vec2 center, Vec2 halfSize) {
        return {center - halfSize, center + halfSize};
    }
    bool overlaps(const Aabb& o) const {
        return min.x <= o.max.x && o.min.x <= max.x && min.y <= o.max.y && o.min.y <= max.y;
    }
    bool contains(Vec2 p) const {
        return p.x >= min.x && p.x <= max.x && p.y >= min.y && p.y <= max.y;
    }
};

// 空间网格（宽相）：插入所有被覆盖 cell；查询与 pairs 派生潜在碰撞
class SpatialGrid {
public:
    SpatialGrid(float cellSize, uint32_t gridW, uint32_t gridH)
        : cellSize_(cellSize), gridW_(gridW), gridH_(gridH) {}

    void clear();
    void insert(uint32_t id, const Aabb& box);          // 越界 cell 忽略
    std::vector<uint32_t> query(const Aabb& box) const;  // 潜在重叠者（不含自身去重）
    // 所有同 cell 内的索引对（id < id，去重）
    std::vector<std::pair<uint32_t, uint32_t>> pairs() const;

private:
    bool cellValid(int64_t cx, int64_t cy) const;
    std::vector<uint32_t>& cellAt(int64_t cx, int64_t cy);

    float cellSize_;
    uint32_t gridW_;
    uint32_t gridH_;
    std::map<std::pair<int64_t, int64_t>, std::vector<uint32_t>> cells_;
};

}  // namespace ccx::physics
