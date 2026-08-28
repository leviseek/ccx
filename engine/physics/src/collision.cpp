#include "ccx/physics/collision.h"

#include <algorithm>
#include <cmath>
#include <set>

namespace ccx::physics {

bool SpatialGrid::cellValid(int64_t cx, int64_t cy) const {
    return cx >= 0 && cy >= 0 && cx < static_cast<int64_t>(gridW_) &&
           cy < static_cast<int64_t>(gridH_);
}

std::vector<uint32_t>& SpatialGrid::cellAt(int64_t cx, int64_t cy) {
    return cells_[{cx, cy}];
}

void SpatialGrid::clear() {
    cells_.clear();
}

void SpatialGrid::insert(uint32_t id, const Aabb& box) {
    const int64_t x0 = static_cast<int64_t>(std::floor(box.min.x / cellSize_));
    const int64_t x1 = static_cast<int64_t>(std::floor(box.max.x / cellSize_));
    const int64_t y0 = static_cast<int64_t>(std::floor(box.min.y / cellSize_));
    const int64_t y1 = static_cast<int64_t>(std::floor(box.max.y / cellSize_));
    for (int64_t cy = y0; cy <= y1; ++cy) {
        for (int64_t cx = x0; cx <= x1; ++cx) {
            if (!cellValid(cx, cy)) continue;
            cellAt(cx, cy).push_back(id);
        }
    }
}

std::vector<uint32_t> SpatialGrid::query(const Aabb& box) const {
    std::set<uint32_t> found;
    const int64_t x0 = static_cast<int64_t>(std::floor(box.min.x / cellSize_));
    const int64_t x1 = static_cast<int64_t>(std::floor(box.max.x / cellSize_));
    const int64_t y0 = static_cast<int64_t>(std::floor(box.min.y / cellSize_));
    const int64_t y1 = static_cast<int64_t>(std::floor(box.max.y / cellSize_));
    for (int64_t cy = y0; cy <= y1; ++cy) {
        for (int64_t cx = x0; cx <= x1; ++cx) {
            const auto it = cells_.find({cx, cy});
            if (it == cells_.end()) continue;
            for (const uint32_t id : it->second) found.insert(id);
        }
    }
    return {found.begin(), found.end()};
}

std::vector<std::pair<uint32_t, uint32_t>> SpatialGrid::pairs() const {
    std::set<std::pair<uint32_t, uint32_t>> out;
    for (const auto& [cell, ids] : cells_) {
        (void)cell;
        for (size_t i = 0; i < ids.size(); ++i) {
            for (size_t j = i + 1; j < ids.size(); ++j) {
                const uint32_t a = ids[i];
                const uint32_t b = ids[j];
                if (a != b) out.insert(a < b ? std::make_pair(a, b) : std::make_pair(b, a));
            }
        }
    }
    return {out.begin(), out.end()};
}

}  // namespace ccx::physics
